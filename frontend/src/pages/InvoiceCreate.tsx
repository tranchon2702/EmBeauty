import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Trash2, Plus, Minus, QrCode,
  CheckCircle2, Edit3, StickyNote, Search, X, ChevronDown, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch } from "../config";
import { PaymentAccountLogo } from "../components/PaymentAccountLogo";
import { matchesVietnameseSearch } from "../lib/search";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  category: string;
}

interface SelectedItem {
  serviceId: string;
  name: string;
  price: number;        // actual price for this invoice (may differ from catalog)
  quantity: number;
  employeeId: string;   // which technician performed this specific service
}

interface BankAccount {
  _id: string;
  accountType?: "bank" | "momo";
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  displayName: string;
  qrImageBase64?: string;
}

interface Employee {
  _id: string;
  name: string;
  role: string;
  avatar?: string;
}

type InvoiceStatus = "idle" | "draft" | "paid";

const InvoiceCreate = () => {
  const navigate = useNavigate();

  // Data from DB
  const [dbServices, setDbServices] = useState<ServiceItem[]>([]);
  const [dbCategories, setDbCategories] = useState<{ _id: string; key: string; name: string; icon: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Invoice fields
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [selectedServices, setSelectedServices] = useState<SelectedItem[]>([]);

  const [surcharge, setSurcharge] = useState(0);
  const [surchargeNote, setSurchargeNote] = useState("");
  const [discount, setDiscount] = useState(0);
  const [invoiceNote, setInvoiceNote] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [selectedBankId, setSelectedBankId] = useState("");

  // Invoice lifecycle
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>("idle");
  const [loading, setLoading] = useState(false);

  // ── Search UI ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // ── Price editing per-item ─────────────────────────────────────────────────
  const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState<string>("");

  // ── Qty editing ───────────────────────────────────────────────────────────
  const [editingQtyIdx, setEditingQtyIdx] = useState<number | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState<string>("");
  const [employeePickerIdx, setEmployeePickerIdx] = useState<number | null>(null);

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [showPayModal, setShowPayModal] = useState(false);

  // ── Session check ──────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("embeauty_session");
    if (!raw) { toast.error("Vui lòng đăng nhập"); navigate("/staff"); return; }
    try { JSON.parse(raw); } catch { navigate("/staff"); }
  }, [navigate]);

  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  // ── Load existing draft if param ?id=... ─────────────────────────────────
  useEffect(() => {
    if (!editId) return;
    const loadDraft = async () => {
      try {
        const res = await authFetch(`${API_BASE}/invoices/${editId}`);
        if (res.ok) {
          const inv = await res.json();
          setInvoiceId(inv._id);
          setInvoiceNumber(inv.invoiceNumber);
          setInvoiceStatus(inv.status);
          setCustomerPhone(inv.customerPhone || "");
          setCustomerName(inv.customerName || "");
          const workerIds = Array.isArray(inv.employeeIds) && inv.employeeIds.length > 0
            ? inv.employeeIds.map((e: any) => typeof e === "object" ? e._id : e)
            : inv.employeeId ? [typeof inv.employeeId === "object" ? inv.employeeId._id : inv.employeeId] : [];
          if (Array.isArray(inv.services)) {
            setSelectedServices(inv.services.map((s: any) => ({
              serviceId: (typeof s.serviceId === "object" ? s.serviceId?._id : s.serviceId) || "",
              name: s.name,
              price: s.price,
              quantity: s.quantity || 1,
              employeeId: (typeof s.employeeId === "object" ? s.employeeId?._id : s.employeeId) || workerIds[0] || "",
            })));
          }
          setSurcharge(inv.surcharge || 0);
          setSurchargeNote(inv.surchargeNote || "");
          setDiscount(inv.discount || 0);
          setInvoiceNote(inv.note || "");
          setPaymentMethod(inv.paymentMethod || "cash");
          if (inv.bankAccountId) {
            setSelectedBankId(typeof inv.bankAccountId === "object" ? inv.bankAccountId._id : inv.bankAccountId);
          }
          toast.info(`Đã mở hóa đơn nháp ${inv.invoiceNumber}`);
        }
      } catch {
        toast.error("Lỗi nạp hóa đơn nháp");
      }
    };
    loadDraft();
  }, [editId]);

  // ── Load data ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [srvRes, bankRes, empRes, catRes] = await Promise.all([
          authFetch(`${API_BASE}/services?context=invoice`),
          authFetch(`${API_BASE}/bank-accounts`),
          authFetch(`${API_BASE}/employees/list`),
          authFetch(`${API_BASE}/categories`),
        ]);
        if (srvRes.ok) setDbServices(await srvRes.json());
        if (catRes.ok) setDbCategories(await catRes.json());
        if (bankRes.ok) {
          const banks = await bankRes.json();
          setBankAccounts(banks);
          if (banks.length > 0) setSelectedBankId(banks[0]._id);
        }
        if (empRes.ok) setEmployees(await empRes.json());
      } catch {
        toast.error("Lỗi nạp dữ liệu");
      }
    };
    load();
  }, []);

  // ── Close search dropdown on outside click ────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subTotal = selectedServices.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalAmount = Math.max(subTotal + surcharge - discount, 0);

  // ── Search / filter services ──────────────────────────────────────────────
  const filteredServices = dbServices.filter(srv =>
    matchesVietnameseSearch(searchQuery, srv.name)
  );

  // ── Category helpers ──────────────────────────────────────────────────────
  const getCategoryLabel = (catKey: string) => {
    const found = dbCategories.find(c => c.key === catKey);
    return found ? `${found.icon} ${found.name}` : catKey;
  };

  // ── Service list management ───────────────────────────────────────────────
  const addService = (srv: ServiceItem) => {
    setSelectedServices(prev => {
      const idx = prev.findIndex(i => i.serviceId === srv._id);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx].quantity += 1;
        return copy;
      }
      return [...prev, {
        serviceId: srv._id,
        name: srv.name,
        price: srv.price,
        quantity: 1,
        employeeId: "",
      }];
    });
    setSearchQuery("");
    setSearchOpen(false);
  };

  const updateQty = (idx: number, delta: number) => {
    setSelectedServices(prev => {
      const copy = [...prev];
      copy[idx].quantity = Math.max(1, copy[idx].quantity + delta);
      return copy;
    });
  };

  const setExactQty = (idx: number, val: number) => {
    const qty = Math.max(1, Math.floor(val) || 1);
    setSelectedServices(prev => {
      const copy = [...prev]; copy[idx].quantity = qty; return copy;
    });
  };

  const removeService = (idx: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== idx));
    setEmployeePickerIdx(null);
    setEditingPriceIdx(null);
    setEditingQtyIdx(null);
  };

  const setServiceEmployee = (idx: number, employeeId: string) => {
    setSelectedServices(prev => {
      const copy = [...prev]; copy[idx].employeeId = employeeId; return copy;
    });
    setEmployeePickerIdx(null);
  };

  const setServicePrice = (idx: number, price: number) => {
    setSelectedServices(prev => {
      const copy = [...prev]; copy[idx].price = Math.max(0, price); return copy;
    });
  };

  // ── Build invoice payload ─────────────────────────────────────────────────
  const buildPayload = useCallback(() => {
    const employeeIds = [...new Set(selectedServices.map(service => service.employeeId).filter(Boolean))];
    return {
      employeeId: employeeIds[0],
      employeeIds,
      customerPhone: customerPhone.trim(),
      customerName: customerName.trim(),
      services: selectedServices.map(s => ({
        serviceId: s.serviceId || null,
        name: s.name,
        price: s.price,
        quantity: s.quantity,
        employeeId: s.employeeId || null,
      })),
      discount,
      surcharge,
      surchargeNote,
      paymentMethod,
      bankAccountId: paymentMethod === "bank" ? selectedBankId || null : null,
      note: invoiceNote,
    };
  }, [customerPhone, customerName, selectedServices, discount, surcharge, surchargeNote, paymentMethod, selectedBankId, invoiceNote]);

  const syncFromServer = (inv: any) => {
    const workerIds = Array.isArray(inv.employeeIds) && inv.employeeIds.length > 0
      ? inv.employeeIds.map((employee: any) => typeof employee === "object" ? employee._id : employee)
      : inv.employeeId ? [typeof inv.employeeId === "object" ? inv.employeeId._id : inv.employeeId] : [];
    if (Array.isArray(inv.services)) {
      setSelectedServices(inv.services.map((s: any) => {
        const serviceId = (typeof s.serviceId === "object" ? s.serviceId?._id : s.serviceId) || "";
        return {
          serviceId,
          name: s.name,
          price: s.price,
          quantity: s.quantity || 1,
          employeeId: (typeof s.employeeId === "object" ? s.employeeId?._id : s.employeeId) || workerIds[0] || "",
        };
      }));
    }
    setDiscount(inv.discount || 0);
    setSurcharge(inv.surcharge || 0);
  };

  // ── Save/Update draft ─────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (selectedServices.length === 0) { toast.warning("Thêm ít nhất 1 dịch vụ"); return; }
    if (selectedServices.some(service => !service.employeeId)) {
      toast.warning("Vui lòng chọn nhân viên thực hiện cho từng dịch vụ");
      return;
    }
    setLoading(true);
    try {
      let res;
      if (invoiceId) {
        res = await authFetch(`${API_BASE}/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
      } else {
        res = await authFetch(`${API_BASE}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInvoiceId(data._id);
      setInvoiceNumber(data.invoiceNumber);
      setInvoiceStatus("draft");
      syncFromServer(data);
      toast.success(invoiceId ? "Đã cập nhật hóa đơn" : `Tạo hóa đơn ${data.invoiceNumber}`);
      setShowPayModal(true);
    } catch (err: any) {
      toast.error(err.message || "Lỗi lưu hóa đơn");
    } finally { setLoading(false); }
  };

  // ── Mark as paid ──────────────────────────────────────────────────────────
  const handleMarkPaid = async () => {
    if (!invoiceId) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/invoices/${invoiceId}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod, bankAccountId: paymentMethod === "bank" ? selectedBankId : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setInvoiceStatus("paid");
      toast.success(`✅ Thanh toán thành công!`);
      setShowPayModal(false);
      setTimeout(() => navigate("/employee/dashboard"), 1500);
    } catch (err: any) {
      toast.error(err.message || "Lỗi xác nhận thanh toán");
    } finally { setLoading(false); }
  };

  const handleEditInvoice = () => {
    setShowPayModal(false);
    setInvoiceStatus("draft");
  };

  // ── QR generation ─────────────────────────────────────────────────────────
  const getSelectedBank = () => bankAccounts.find(b => b._id === selectedBankId);

  const getQRUrl = () => {
    const bank = getSelectedBank();
    if (!bank) return "";
    if (bank.qrImageBase64 && bank.qrImageBase64.startsWith("data:")) return bank.qrImageBase64;
    if (bank.accountType === "momo") return "";
    const desc = encodeURIComponent(`Embeauty Nails ${invoiceNumber || ""}`);
    return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNumber}-print.jpg?amount=${totalAmount}&addInfo=${desc}&accountName=${encodeURIComponent(bank.accountHolder)}`;
  };

  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  const getEmpName = (empId: string) => {
    const e = employees.find(x => x._id === empId);
    if (!e) return "";
    return e.name.split(" ").pop() || e.name;
  };

  const getEmpInitials = (empId: string) => {
    const e = employees.find(x => x._id === empId);
    if (!e) return "?";
    return e.name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
  };

  const invoiceEmployeeIds = [...new Set(selectedServices.map(service => service.employeeId).filter(Boolean))];
  const invoiceEmployees = employees.filter(employee => invoiceEmployeeIds.includes(employee._id));
  const unassignedServiceCount = selectedServices.filter(service => !service.employeeId).length;

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F4EFEB]/40 pb-28 overscroll-contain">

      {/* ── Fixed Header ── */}
      <div
        className="bg-[#9E5E6F] text-white px-5 flex items-center justify-between shadow-lg fixed top-0 left-0 right-0 z-30"
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)", paddingBottom: "12px" }}
      >
        <div className="flex items-center gap-3">
          <Link to="/employee/dashboard" className="p-1.5 hover:bg-white/15 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif text-base font-bold leading-tight">Lập Hóa Đơn</h1>
            {invoiceNumber && (
              <span className="text-[10px] text-white/70 font-mono">{invoiceNumber}</span>
            )}
          </div>
        </div>
        {invoiceStatus === "draft" && (
          <span className="text-[10px] bg-white/20 rounded-full px-2.5 py-1 font-semibold">Bản nháp</span>
        )}
      </div>

      <div style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 57px)" }}>

        {/* ── Search Box ── */}
        <div className="bg-white border-b border-stone-100 px-4 py-3" ref={searchContainerRef}>
          <div className="relative">
            <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-2xl px-3 py-2.5 focus-within:border-[#9E5E6F] focus-within:ring-1 focus-within:ring-[#9E5E6F]/20 transition">
              <Search className="w-4 h-4 text-stone-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Tìm dịch vụ... (vd: sơn gel, móng)"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                className="flex-1 bg-transparent text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setSearchOpen(false); }} className="p-0.5 text-stone-400 hover:text-stone-600 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Dropdown */}
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-200 rounded-2xl shadow-xl z-20 max-h-64 overflow-y-auto">
                {filteredServices.length === 0 ? (
                  <p className="text-center text-xs text-stone-400 py-6 italic">Không tìm thấy dịch vụ nào</p>
                ) : (
                  filteredServices.slice(0, 12).map(srv => {
                    const inCart = selectedServices.some(s => s.serviceId === srv._id);
                    return (
                      <button
                        key={srv._id}
                        onClick={() => addService(srv)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#F9ECEF] transition border-b border-stone-50 last:border-0 ${inCart ? "bg-[#F9ECEF]/60" : ""}`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-stone-800 truncate">{srv.name}</p>
                          <p className="text-[10px] text-stone-400">{getCategoryLabel(srv.category)}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-sm font-bold text-[#9E5E6F] font-serif">{formatPrice(srv.price)}</p>
                          {inCart && <p className="text-[9px] text-[#9E5E6F] font-bold">✓ Đã thêm</p>}
                        </div>
                      </button>
                    );
                  })
                )}
                {filteredServices.length > 12 && (
                  <p className="text-center text-[10px] text-stone-400 py-2">
                    Còn {filteredServices.length - 12} dịch vụ — nhập từ khóa cụ thể hơn
                  </p>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ── Selected Services Cart ── */}
        {selectedServices.length > 0 && (
          <div className="mx-4 mt-3 mb-4 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* Cart header */}
            <div className="px-4 py-2.5 bg-[#F9ECEF]/70 border-b border-stone-100 flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#9E5E6F] uppercase tracking-wider">
                🧾 Dịch vụ trên hóa đơn ({selectedServices.length})
              </p>
              <p className="text-[10px] text-stone-500">
                Dịch vụ: <span className="font-bold text-stone-700">{formatPrice(subTotal)}</span>
              </p>
            </div>

            {/* Items */}
            <div className="divide-y divide-stone-50">
              {selectedServices.map((srv, idx) => (
                <div key={idx} className="px-3 py-3 space-y-2">
                  {/* Row 1: name + remove */}
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-stone-800">{srv.name}</p>
                    </div>
                    <button
                      onClick={() => removeService(idx)}
                      className="p-1 text-stone-300 hover:text-red-500 transition shrink-0 active:scale-90 mt-0.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Row 2: price (editable) + qty controls + subtotal */}
                  <div className="flex items-center gap-2">
                    {/* Editable price */}
                    <div className="flex-1 min-w-0">
                      {editingPriceIdx === idx ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            enterKeyHint="done"
                            autoFocus
                            value={editingPriceVal}
                            onChange={e => setEditingPriceVal(e.target.value)}
                            onBlur={() => {
                              const p = parseInt(editingPriceVal, 10);
                              setServicePrice(idx, isNaN(p) || p < 0 ? srv.price : p);
                              setEditingPriceIdx(null);
                              setEditingPriceVal("");
                            }}
                            onKeyDown={e => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                              if (e.key === "Escape") { setEditingPriceIdx(null); setEditingPriceVal(""); }
                            }}
                            className="w-24 px-2 py-1 text-xs font-bold bg-amber-50 border border-amber-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-400 text-amber-800"
                          />
                          <span className="text-[10px] text-stone-400">đ</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingPriceIdx(idx); setEditingPriceVal(String(srv.price)); }}
                          className="flex items-center gap-1 group"
                          title="Chạm để sửa giá"
                        >
                          <span className="text-xs font-bold text-[#9E5E6F] font-serif">{formatPrice(srv.price)}</span>
                          <Edit3 className="w-2.5 h-2.5 text-stone-300 group-hover:text-[#9E5E6F] transition ml-0.5" />
                        </button>
                      )}
                    </div>

                    {/* Qty controls */}
                    <div className="flex items-center gap-0.5 bg-stone-50 border border-stone-200 rounded-xl p-0.5 shrink-0">
                      <button onClick={() => updateQty(idx, -1)} className="p-1 text-stone-500 hover:text-stone-800 rounded-lg active:scale-90 transition">
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        value={editingQtyIdx === idx ? editingQtyVal : String(srv.quantity)}
                        onFocus={() => { setEditingQtyIdx(idx); setEditingQtyVal(String(srv.quantity)); }}
                        onChange={e => setEditingQtyVal(e.target.value)}
                        onBlur={() => {
                          const n = parseInt(editingQtyVal, 10);
                          setExactQty(idx, isNaN(n) || n < 1 ? 1 : n);
                          setEditingQtyIdx(null); setEditingQtyVal("");
                        }}
                        className="w-8 text-center font-bold text-stone-800 text-xs bg-white rounded-lg border border-stone-200 focus:border-[#9E5E6F] focus:outline-none py-0.5"
                      />
                      <button onClick={() => updateQty(idx, 1)} className="p-1 text-stone-500 hover:text-stone-800 rounded-lg active:scale-90 transition">
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Subtotal */}
                    <span className="text-xs font-bold text-stone-700 shrink-0 min-w-[60px] text-right">
                      = {formatPrice(srv.price * srv.quantity)}
                    </span>
                  </div>

                  {/* Row 3: employee picker belongs to this service only */}
                  <div className="relative">
                    {(() => {
                      const assignedEmployee = employees.find(employee => employee._id === srv.employeeId);
                      return (
                        <button
                          type="button"
                          onClick={() => setEmployeePickerIdx(current => current === idx ? null : idx)}
                          className={`w-full min-h-10 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-left transition ${
                            assignedEmployee
                              ? "border-[#E5B2C0] bg-[#F9ECEF]/60"
                              : "border-dashed border-amber-300 bg-amber-50 text-amber-700"
                          }`}
                          aria-expanded={employeePickerIdx === idx}
                        >
                          {assignedEmployee ? (
                            <>
                              <div className="w-7 h-7 rounded-full overflow-hidden bg-[#9E5E6F] text-white flex items-center justify-center text-[9px] font-bold shrink-0">
                                {assignedEmployee.avatar ? (
                                  <img src={assignedEmployee.avatar} alt={assignedEmployee.name} className="w-full h-full object-cover" />
                                ) : getEmpInitials(assignedEmployee._id)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[9px] text-stone-400 leading-none mb-0.5">Nhân viên thực hiện</p>
                                <p className="text-[11px] font-bold text-stone-700 truncate">{assignedEmployee.name}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-4 h-4 shrink-0" />
                              <span className="flex-1 text-[11px] font-bold">Chọn nhân viên thực hiện *</span>
                            </>
                          )}
                          <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition ${employeePickerIdx === idx ? "rotate-180" : ""}`} />
                        </button>
                      );
                    })()}

                    {employeePickerIdx === idx && (
                      <div className="mt-1.5 rounded-xl border border-stone-200 bg-white p-1.5 shadow-lg grid grid-cols-2 gap-1.5">
                        {employees.map(employee => {
                          const isAssigned = employee._id === srv.employeeId;
                          return (
                            <button
                              type="button"
                              key={employee._id}
                              onClick={() => setServiceEmployee(idx, employee._id)}
                              className={`flex items-center gap-2 rounded-lg p-2 text-left transition ${
                                isAssigned ? "bg-[#9E5E6F] text-white" : "bg-stone-50 text-stone-700 hover:bg-stone-100"
                              }`}
                            >
                              <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center text-[9px] font-bold shrink-0 ${
                                isAssigned ? "bg-white/20 text-white" : "bg-[#F9ECEF] text-[#9E5E6F]"
                              }`}>
                                {employee.avatar ? (
                                  <img src={employee.avatar} alt={employee.name} className="w-full h-full object-cover" />
                                ) : getEmpInitials(employee._id)}
                              </div>
                              <span className="text-[10px] font-bold truncate">{employee.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Surcharge / Discount / Note */}
            <div className="px-4 py-3 border-t border-stone-100 space-y-2.5 bg-stone-50/50">
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-stone-500 w-20 shrink-0">Phụ thu:</label>
                <input
                  type="number" min={0}
                  value={surcharge || ""}
                  placeholder="0"
                  onChange={e => setSurcharge(Number(e.target.value))}
                  className="flex-1 text-right bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                />
                <span className="text-[11px] text-stone-400 shrink-0">đ</span>
              </div>
              {surcharge > 0 && (
                <input
                  type="text"
                  placeholder="Lý do phụ thu (vẽ nhũ, đính đá...)"
                  value={surchargeNote}
                  onChange={e => setSurchargeNote(e.target.value)}
                  className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              )}
              <div className="flex items-center gap-3">
                <label className="text-[11px] text-stone-500 w-20 shrink-0">Giảm giá:</label>
                <input
                  type="number" min={0}
                  value={discount || ""}
                  placeholder="0"
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="flex-1 text-right bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                />
                <span className="text-[11px] text-stone-400 shrink-0">đ</span>
              </div>
              <div className="flex items-center gap-2">
                <StickyNote className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Ghi chú hóa đơn..."
                  value={invoiceNote}
                  onChange={e => setInvoiceNote(e.target.value)}
                  className="flex-1 bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {selectedServices.length === 0 && (
          <div className="mx-4 mt-6 flex flex-col items-center text-center text-stone-400 py-8">
            <Search className="w-10 h-10 text-stone-200 mb-3" />
            <p className="text-sm font-semibold">Chưa có dịch vụ nào</p>
            <p className="text-xs mt-1">Dùng ô tìm kiếm ở trên để thêm dịch vụ vào hóa đơn</p>
          </div>
        )}

      </div>

      {/* ── Sticky Bottom Bar ── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-stone-200 px-4 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        style={{ paddingTop: "12px", paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        <div className="flex-1 min-w-0">
          {selectedServices.length === 0 ? (
            <p className="text-xs text-stone-400 italic">Chọn dịch vụ để bắt đầu...</p>
          ) : (
            <>
              <p className={`text-[10px] ${unassignedServiceCount > 0 ? "text-amber-600 font-semibold" : "text-stone-400"}`}>
                {unassignedServiceCount > 0
                  ? `Còn ${unassignedServiceCount} dịch vụ chưa chọn nhân viên`
                  : `${selectedServices.length} dịch vụ${invoiceStatus === "draft" ? " · Bản nháp" : ""}`}
              </p>
              <p className="text-xl font-extrabold text-[#9E5E6F] font-serif leading-none">{formatPrice(totalAmount)}</p>
            </>
          )}
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={loading || selectedServices.length === 0 || unassignedServiceCount > 0}
          className="px-5 py-3 bg-[#9E5E6F] hover:bg-[#8D5060] text-white font-bold text-sm rounded-2xl disabled:bg-stone-300 disabled:shadow-none transition active:scale-95 shadow-lg shadow-[#9E5E6F]/30 flex items-center gap-2 shrink-0"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <><CheckCircle2 className="w-4 h-4" /> {invoiceStatus === "draft" ? "Cập nhật" : "Thanh Toán"}</>
          )}
        </button>
      </div>

      {/* ── Payment / QR Modal ── */}
      {showPayModal && (
        <div
          className="fixed inset-0 bg-stone-900/65 backdrop-blur-sm flex items-end sm:items-center justify-center px-4 z-50"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="bg-white rounded-3xl w-full max-w-sm max-h-[calc(100dvh-24px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] border border-stone-100 shadow-2xl overflow-y-auto scroll-momentum">
            {/* Modal header */}
            <div className="bg-[#9E5E6F] text-white px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-serif font-bold text-base">Thanh Toán Hóa Đơn</h3>
                <p className="text-[10px] text-white/70 font-mono">{invoiceNumber}</p>
              </div>
              <span className="text-2xl font-extrabold font-serif">{formatPrice(totalAmount)}</span>
            </div>

            <div className="p-5 space-y-4">
              {/* Invoice summary */}
              <div className="bg-stone-50 rounded-xl p-3 text-xs space-y-1.5 border border-stone-100">
                <div className="flex justify-between gap-3 pb-1.5 border-b border-stone-200">
                  <span className="text-stone-500 shrink-0">Thợ thực hiện</span>
                  <span className="font-semibold text-stone-800 text-right">
                    {invoiceEmployees.map(employee => employee.name).join(", ")}
                  </span>
                </div>
                {selectedServices.map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <div className="min-w-0 flex-1">
                      <span className="text-stone-600 truncate">{s.name} × {s.quantity}</span>
                      {employees.length > 1 && s.employeeId && (
                        <span className="text-[9px] text-stone-400 ml-1">({getEmpName(s.employeeId)})</span>
                      )}
                    </div>
                    <span className="font-semibold shrink-0 ml-2">{formatPrice(s.price * s.quantity)}</span>
                  </div>
                ))}
                {surcharge > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Phụ thu {surchargeNote && `(${surchargeNote})`}</span>
                    <span className="font-semibold">+{formatPrice(surcharge)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Giảm giá</span>
                    <span className="font-semibold">-{formatPrice(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-stone-200 pt-1.5 text-stone-900">
                  <span>Tổng cộng</span>
                  <span className="text-primary font-sans tabular-nums">{formatPrice(totalAmount)}</span>
                </div>
              </div>

              {/* Payment method tabs */}
              <div className="flex gap-2">
                {(["cash", "bank"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold border transition ${
                      paymentMethod === m ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-stone-50 border-stone-200 text-stone-600"
                    }`}
                  >
                    {m === "cash" ? "💵 Tiền mặt" : "📱 QR / Ví"}
                  </button>
                ))}
              </div>

              {/* QR for bank */}
              {paymentMethod === "bank" && (
                <div className="space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {bankAccounts.map(bank => (
                      <button
                        key={bank._id}
                        onClick={() => setSelectedBankId(bank._id)}
                        className={`shrink-0 pl-1.5 pr-3 py-1.5 rounded-full text-[10px] font-bold border transition flex items-center gap-1.5 ${
                          selectedBankId === bank._id ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-stone-50 border-stone-200 text-stone-600"
                        }`}
                      >
                        <PaymentAccountLogo
                          accountType={bank.accountType === "momo" ? "momo" : "bank"}
                          bankId={bank.bankId}
                          name={bank.bankName}
                          className="w-7 h-7"
                        />
                        {bank.displayName}
                      </button>
                    ))}
                  </div>
                  {selectedBankId && (
                    <div className="flex flex-col items-center gap-2">
                      {getQRUrl() ? (
                        <div className="bg-white border-2 border-stone-100 rounded-2xl p-3 shadow-inner">
                          <img
                            src={getQRUrl()}
                            alt={getSelectedBank()?.accountType === "momo" ? "Mã QR Ví MoMo" : "Mã VietQR"}
                            className="w-52 h-52 object-contain rounded-lg"
                          />
                        </div>
                      ) : (
                        <div className="w-52 h-36 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-center px-5 text-[11px] font-semibold text-amber-700">
                          Tài khoản này chưa có ảnh QR. Quản trị viên cần tải ảnh QR nhận tiền lên.
                        </div>
                      )}
                      <div className="text-center text-[10px] text-stone-500">
                        <div className="flex items-center justify-center gap-2 mb-1">
                          {getSelectedBank() && (
                            <PaymentAccountLogo
                              accountType={getSelectedBank()?.accountType === "momo" ? "momo" : "bank"}
                              bankId={getSelectedBank()?.bankId || ""}
                              name={getSelectedBank()?.bankName || ""}
                              className="w-8 h-8"
                            />
                          )}
                          <p className="font-bold text-stone-700">{getSelectedBank()?.displayName}</p>
                        </div>
                        <p>{getSelectedBank()?.accountType === "momo" ? "SĐT" : "STK"}: <span className="font-mono font-bold">{getSelectedBank()?.accountNumber}</span></p>
                        <p>{getSelectedBank()?.accountHolder}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Cash instruction */}
              {paymentMethod === "cash" && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-xs text-green-700 font-semibold">
                  💵 Thu <strong>{formatPrice(totalAmount)}</strong> tiền mặt từ khách
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleEditInvoice}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Sửa HĐ
                </button>
                <button
                  onClick={handleMarkPaid}
                  disabled={loading}
                  className="flex-[2] py-2.5 bg-[#9E5E6F] hover:bg-[#7D4050] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition shadow-md disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {loading ? "Đang lưu..." : "Đã Thanh Toán ✓"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceCreate;
