import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Trash2, Plus, Minus, QrCode,
  CheckCircle2, Edit3, StickyNote, Search, X, UserCheck
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch } from "../config";
import { PaymentAccountLogo } from "../components/PaymentAccountLogo";
import { InvoiceBreakdown } from "../components/InvoiceBreakdown";
import { matchesVietnameseSearch } from "../lib/search";
import { formatVnd, formatVndInput, parseVndInput } from "../lib/money";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  category: string;
}

interface SelectedItem {
  serviceId: string;
  name: string;
  catalogPrice: number;
  price: number;
  quantity: number;
  employeeId: string;
}

interface ServiceEditDraft {
  index: number;
  name: string;
  catalogPrice: number;
  price: string;
  quantity: string;
  employeeId: string;
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
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("id");

  const [sessionEmployee] = useState<Employee | null>(() => {
    const raw = localStorage.getItem("embeauty_session");
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?._id && parsed?.name ? parsed : null;
    } catch {
      return null;
    }
  });
  const currentEmployeeId = sessionEmployee?._id || "";

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
  const [primaryEmployeeId, setPrimaryEmployeeId] = useState(currentEmployeeId);

  const [surcharge, setSurcharge] = useState(0);
  const [surchargeNote, setSurchargeNote] = useState("");
  const [discountType, setDiscountType] = useState<"amount" | "percent">("amount");
  const [discountValue, setDiscountValue] = useState(0);
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

  // ── Service editing modal ──────────────────────────────────────────────────
  const [serviceEdit, setServiceEdit] = useState<ServiceEditDraft | null>(null);
  const [recentServiceId, setRecentServiceId] = useState("");
  const newestServiceRef = useRef<HTMLDivElement>(null);

  // ── Payment modal ─────────────────────────────────────────────────────────
  const [showPayModal, setShowPayModal] = useState(false);

  // ── Session check ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionEmployee) {
      toast.error("Vui lòng đăng nhập");
      navigate("/staff");
    }
  }, [navigate, sessionEmployee]);

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
          const creatorId = typeof inv.createdBy === "object" ? inv.createdBy?._id : inv.createdBy;
          const primaryId = (creatorId === currentEmployeeId ? currentEmployeeId : null)
            || (typeof inv.employeeId === "object" ? inv.employeeId?._id : inv.employeeId)
            || currentEmployeeId;
          setPrimaryEmployeeId(primaryId);
          const workerIds = Array.isArray(inv.employeeIds) && inv.employeeIds.length > 0
            ? inv.employeeIds.map((e: any) => typeof e === "object" ? e._id : e)
            : inv.employeeId ? [typeof inv.employeeId === "object" ? inv.employeeId._id : inv.employeeId] : [];
          if (Array.isArray(inv.services)) {
            setSelectedServices(inv.services.map((s: any) => ({
              serviceId: (typeof s.serviceId === "object" ? s.serviceId?._id : s.serviceId) || "",
              name: s.name,
              catalogPrice: s.catalogPrice ?? s.price,
              price: s.price,
              quantity: s.quantity || 1,
              employeeId: (typeof s.employeeId === "object" ? s.employeeId?._id : s.employeeId) || primaryId || workerIds[0] || "",
            })));
          }
          setSurcharge(inv.surcharge || 0);
          setSurchargeNote(inv.surchargeNote || "");
          const restoredDiscountType = inv.discountType === "percent" ? "percent" : "amount";
          setDiscountType(restoredDiscountType);
          setDiscountValue(restoredDiscountType === "percent"
            ? (inv.discountValue ?? 0)
            : (inv.discountValue || inv.discount || 0));
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
  }, [editId, currentEmployeeId]);

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

  // Bring the item the user just selected into a comfortable editing position.
  // The highlight fades by itself after price/quantity/worker are easy to spot.
  useEffect(() => {
    if (!recentServiceId) return;
    const frame = window.requestAnimationFrame(() => {
      newestServiceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const timer = window.setTimeout(() => setRecentServiceId(""), 1600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [recentServiceId]);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subTotal = selectedServices.reduce((s, i) => s + i.price * i.quantity, 0);
  const discountBase = subTotal + surcharge;
  const normalizedDiscountValue = discountType === "percent"
    ? Math.min(100, Math.max(0, discountValue))
    : Math.min(discountBase, Math.max(0, discountValue));
  const discount = discountType === "percent"
    ? Math.round(discountBase * normalizedDiscountValue / 100)
    : normalizedDiscountValue;
  const totalAmount = Math.max(discountBase - discount, 0);

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
    setServiceEdit(null);

    setSelectedServices(prev => {
      const idx = prev.findIndex(i => i.serviceId === srv._id);
      if (idx > -1) {
        const existing = { ...prev[idx], quantity: prev[idx].quantity + 1 };
        // Selecting an existing service again both increases its quantity and
        // moves it to the top, matching the same "just selected" behaviour.
        return [existing, ...prev.filter((_, currentIdx) => currentIdx !== idx)];
      }
      return [{
        serviceId: srv._id,
        name: srv.name,
        catalogPrice: srv.price,
        price: srv.price,
        quantity: 1,
        employeeId: primaryEmployeeId || currentEmployeeId,
      }, ...prev];
    });
    setRecentServiceId(srv._id);
    setSearchQuery("");
    setSearchOpen(false);
  };

  const openServiceEditor = (idx: number) => {
    const service = selectedServices[idx];
    if (!service) return;
    setServiceEdit({
      index: idx,
      name: service.name,
      catalogPrice: service.catalogPrice,
      price: formatVndInput(service.price),
      quantity: String(service.quantity),
      employeeId: service.employeeId,
    });
  };

  const saveServiceEdit = () => {
    if (!serviceEdit) return;
    const quantity = Math.max(1, Math.floor(Number(serviceEdit.quantity)) || 1);
    const price = Math.max(0, parseVndInput(serviceEdit.price));
    setSelectedServices(prev => {
      if (!prev[serviceEdit.index]) return prev;
      return prev.map((service, idx) => idx === serviceEdit.index ? {
        ...service,
        quantity,
        price,
        employeeId: serviceEdit.employeeId,
        // A higher edit becomes the quoted price. A later lower edit keeps
        // that reference so the reduction is visible on the invoice.
        catalogPrice: Math.max(service.catalogPrice, price),
      } : service);
    });
    setServiceEdit(null);
  };

  const removeService = (idx: number) => {
    setSelectedServices(prev => prev.filter((_, i) => i !== idx));
    setServiceEdit(null);
  };

  // ── Build invoice payload ─────────────────────────────────────────────────
  const buildPayload = useCallback(() => {
    const primaryId = primaryEmployeeId || currentEmployeeId
      || selectedServices.find(service => service.employeeId)?.employeeId
      || "";
    const employeeIds = [...new Set([
      primaryId,
      ...selectedServices.map(service => service.employeeId),
    ].filter(Boolean))];
    return {
      employeeId: primaryId,
      employeeIds,
      customerPhone: customerPhone.trim(),
      customerName: customerName.trim(),
      services: selectedServices.map(s => ({
        serviceId: s.serviceId || null,
        name: s.name,
        catalogPrice: s.catalogPrice,
        price: s.price,
        quantity: s.quantity,
        employeeId: s.employeeId || null,
      })),
      discount,
      discountType,
      discountValue: normalizedDiscountValue,
      surcharge,
      surchargeNote,
      paymentMethod,
      bankAccountId: paymentMethod === "bank" ? selectedBankId || null : null,
      note: invoiceNote,
    };
  }, [customerPhone, customerName, selectedServices, discount, discountType, normalizedDiscountValue, surcharge, surchargeNote, paymentMethod, selectedBankId, invoiceNote, primaryEmployeeId, currentEmployeeId]);

  const syncFromServer = (inv: any) => {
    const primaryId = (typeof inv.employeeId === "object" ? inv.employeeId?._id : inv.employeeId)
      || primaryEmployeeId
      || currentEmployeeId;
    setPrimaryEmployeeId(primaryId);
    const workerIds = Array.isArray(inv.employeeIds) && inv.employeeIds.length > 0
      ? inv.employeeIds.map((employee: any) => typeof employee === "object" ? employee._id : employee)
      : inv.employeeId ? [typeof inv.employeeId === "object" ? inv.employeeId._id : inv.employeeId] : [];
    if (Array.isArray(inv.services)) {
      setSelectedServices(inv.services.map((s: any) => {
        const serviceId = (typeof s.serviceId === "object" ? s.serviceId?._id : s.serviceId) || "";
        return {
          serviceId,
          name: s.name,
          catalogPrice: s.catalogPrice ?? s.price,
          price: s.price,
          quantity: s.quantity || 1,
          employeeId: (typeof s.employeeId === "object" ? s.employeeId?._id : s.employeeId) || primaryId || workerIds[0] || "",
        };
      }));
    }
    const restoredDiscountType = inv.discountType === "percent" ? "percent" : "amount";
    setDiscountType(restoredDiscountType);
    setDiscountValue(restoredDiscountType === "percent"
      ? (inv.discountValue ?? 0)
      : (inv.discountValue || inv.discount || 0));
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

  const formatPrice = formatVnd;

  const getEmpInitials = (empId: string) => {
    const e = employees.find(x => x._id === empId);
    if (!e) return "?";
    return e.name.split(" ").slice(-2).map(w => w[0]).join("").toUpperCase();
  };

  const invoiceEmployeeIds = [...new Set(selectedServices.map(service => service.employeeId).filter(Boolean))];
  const invoiceEmployees = employees.filter(employee => invoiceEmployeeIds.includes(employee._id));
  const primaryEmployee = employees.find(employee => employee._id === primaryEmployeeId)
    || (sessionEmployee?._id === primaryEmployeeId ? sessionEmployee : null);
  const unassignedServiceCount = selectedServices.filter(service => !service.employeeId).length;
  const serviceEditPrice = serviceEdit ? parseVndInput(serviceEdit.price) : 0;
  const serviceEditQuantity = serviceEdit ? Math.max(1, Math.floor(Number(serviceEdit.quantity)) || 1) : 1;
  const serviceEditDiscount = serviceEdit ? Math.max(serviceEdit.catalogPrice - serviceEditPrice, 0) : 0;
  const invoiceBreakdownData = {
    services: selectedServices.map(service => ({
      ...service,
      employeeId: employees.find(employee => employee._id === service.employeeId) || null,
    })),
    subTotal,
    surcharge,
    surchargeNote,
    discount,
    discountType,
    discountValue: normalizedDiscountValue,
    totalAmount,
    note: invoiceNote,
    employeeId: primaryEmployee || invoiceEmployees[0] || null,
  };

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
                <div
                  key={srv.serviceId || `${srv.name}-${idx}`}
                  ref={idx === 0 ? newestServiceRef : undefined}
                  className={`transition-colors duration-500 ${
                    recentServiceId === srv.serviceId ? "bg-amber-50/80" : "bg-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => openServiceEditor(idx)}
                    className="group w-full px-4 py-3.5 text-left transition hover:bg-[#F9ECEF]/35 active:bg-[#F9ECEF]/70"
                    aria-label={`Chỉnh dịch vụ ${srv.name}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[15px] min-[375px]:text-base font-bold leading-snug text-stone-800">{srv.name}</p>
                          {recentServiceId === srv.serviceId && (
                            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">
                              Vừa thêm · ở trên cùng
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                          {srv.price < srv.catalogPrice && (
                            <span className="text-xs font-semibold text-stone-400 line-through">{formatPrice(srv.catalogPrice)}</span>
                          )}
                          <span className="text-[15px] min-[375px]:text-base font-extrabold text-[#9E5E6F]">{formatPrice(srv.price)}</span>
                          {srv.price < srv.catalogPrice && srv.catalogPrice > 0 && (
                            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
                              -{Math.round((srv.catalogPrice - srv.price) / srv.catalogPrice * 10000) / 100}%
                            </span>
                          )}
                          <span className="text-xs font-semibold text-stone-400">× {srv.quantity}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                          {(() => {
                            const assignedEmployee = employees.find(employee => employee._id === srv.employeeId);
                            return assignedEmployee ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-stone-500">
                                <UserCheck className="h-3.5 w-3.5 text-[#9E5E6F]" />
                                {assignedEmployee.name}
                                {assignedEmployee._id === primaryEmployeeId && <span className="font-normal text-stone-400">· mặc định</span>}
                              </span>
                            ) : (
                              <span className="font-bold text-amber-600">Chưa chọn nhân viên thực hiện</span>
                            );
                          })()}
                          {srv.price < srv.catalogPrice && (
                            <span className="font-semibold text-emerald-600">Giảm dòng {formatPrice((srv.catalogPrice - srv.price) * srv.quantity)}</span>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <Edit3 className="ml-auto h-4 w-4 text-stone-300 transition group-hover:text-[#9E5E6F]" />
                        <p className="mt-3 whitespace-nowrap text-sm min-[375px]:text-[15px] font-extrabold text-stone-800">
                          {formatPrice(srv.price * srv.quantity)}
                        </p>
                        <p className="mt-0.5 hidden text-[9px] font-semibold uppercase tracking-wide text-stone-400 min-[360px]:block">Thành tiền</p>
                      </div>
                    </div>
                  </button>
                </div>
              ))}
            </div>

            {/* Surcharge / Discount / Note */}
            <div className="px-4 py-3 border-t border-stone-100 space-y-2.5 bg-stone-50/50">
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                <label className="text-[11px] text-stone-500">Phụ thu:</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={formatVndInput(surcharge)}
                  placeholder="0"
                  onChange={e => setSurcharge(parseVndInput(e.target.value))}
                  className="min-w-0 w-full text-right tabular-nums bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                />
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
              <div className="grid grid-cols-[72px_minmax(0,1fr)] items-center gap-2">
                <label className="text-[11px] text-stone-500">Giảm tổng:</label>
                <div className="flex min-w-0 items-stretch gap-2">
                  <input
                    type="text"
                    inputMode={discountType === "percent" ? "decimal" : "numeric"}
                    value={discountType === "amount" ? formatVndInput(discountValue) : (discountValue || "")}
                    placeholder="0"
                    onChange={e => {
                      if (discountType === "amount") {
                        setDiscountValue(parseVndInput(e.target.value));
                      } else {
                        const value = e.target.value.replace(/[^\d.]/g, "");
                        setDiscountValue(Math.min(100, Number(value) || 0));
                      }
                    }}
                    className="min-w-0 w-full text-right tabular-nums bg-white border border-stone-200 rounded-xl px-2.5 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                  />
                  <div className="grid w-[68px] shrink-0 grid-cols-2 rounded-xl border border-stone-200 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => { setDiscountType("amount"); setDiscountValue(0); }}
                      className={`min-h-8 rounded-lg px-1 text-[9px] font-bold transition ${discountType === "amount" ? "bg-[#9E5E6F] text-white" : "text-stone-400"}`}
                    >VND</button>
                    <button
                      type="button"
                      onClick={() => { setDiscountType("percent"); setDiscountValue(0); }}
                      className={`min-h-8 rounded-lg px-1 text-[10px] font-bold transition ${discountType === "percent" ? "bg-[#9E5E6F] text-white" : "text-stone-400"}`}
                    >%</button>
                  </div>
                </div>
              </div>
              {discount > 0 && (
                <p className="text-right text-[9px] font-semibold text-emerald-600">
                  Tổng bill được giảm {formatPrice(discount)}
                </p>
              )}
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

      {/* ── Service Edit Modal ── */}
      {serviceEdit && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-stone-900/60 px-3 backdrop-blur-[2px] sm:items-center sm:px-4"
          style={{ paddingTop: "calc(12px + env(safe-area-inset-top, 0px))", paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="service-edit-title"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setServiceEdit(null);
          }}
        >
          <form
            onSubmit={event => { event.preventDefault(); saveServiceEdit(); }}
            className="flex w-full max-w-sm max-h-[calc(100dvh-24px-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px))] flex-col overflow-hidden rounded-3xl border border-stone-100 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-start gap-3 border-b border-stone-100 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#9E5E6F]">Chỉnh dịch vụ</p>
                <h2 id="service-edit-title" className="mt-1 text-lg font-bold leading-snug text-stone-800">{serviceEdit.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setServiceEdit(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 transition active:scale-95"
                aria-label="Đóng cửa sổ chỉnh dịch vụ"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-600">Số lượng</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setServiceEdit(current => current ? {
                      ...current,
                      quantity: String(Math.max(1, (Number(current.quantity) || 1) - 1)),
                    } : current)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-700 transition active:scale-95"
                    aria-label="Giảm số lượng"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    inputMode="numeric"
                    value={serviceEdit.quantity}
                    onChange={event => setServiceEdit(current => current ? { ...current, quantity: event.target.value } : current)}
                    className="h-11 w-20 border-0 border-b-2 border-stone-300 bg-transparent text-center text-xl font-extrabold text-stone-800 focus:border-[#9E5E6F] focus:outline-none"
                    aria-label="Số lượng dịch vụ"
                  />
                  <button
                    type="button"
                    onClick={() => setServiceEdit(current => current ? {
                      ...current,
                      quantity: String((Number(current.quantity) || 0) + 1),
                    } : current)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-stone-300 bg-white text-stone-700 transition active:scale-95"
                    aria-label="Tăng số lượng"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label htmlFor="service-edit-price" className="text-sm font-semibold text-stone-600">Đơn giá</label>
                  {serviceEditDiscount > 0 && (
                    <span className="text-xs font-bold text-emerald-600">
                      Giảm {formatPrice(serviceEditDiscount)} / dịch vụ
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="service-edit-price"
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    value={serviceEdit.price}
                    onChange={event => setServiceEdit(current => current ? {
                      ...current,
                      price: formatVndInput(event.target.value),
                    } : current)}
                    className="h-12 w-full border-0 border-b-2 border-stone-300 bg-transparent pr-8 text-lg font-extrabold tabular-nums text-stone-800 focus:border-[#9E5E6F] focus:outline-none"
                  />
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-sm font-semibold text-stone-400">đ</span>
                </div>
                {serviceEditPrice < serviceEdit.catalogPrice && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-stone-400 line-through">{formatPrice(serviceEdit.catalogPrice)}</span>
                    <span className="font-bold text-[#9E5E6F]">còn {formatPrice(serviceEditPrice)}</span>
                    {serviceEdit.catalogPrice > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                        -{Math.round(serviceEditDiscount / serviceEdit.catalogPrice * 10000) / 100}%
                      </span>
                    )}
                  </div>
                )}
                {serviceEditPrice > serviceEdit.catalogPrice && (
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    {formatPrice(serviceEditPrice)} sẽ là giá đã báo mới. Nếu giảm sau đó, giá này sẽ được gạch đi.
                  </p>
                )}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="text-sm font-semibold text-stone-600">Nhân viên thực hiện</label>
                  <span className="text-[10px] text-stone-400">Chỉ đổi khi có người hỗ trợ</span>
                </div>
                <div className="grid max-h-36 grid-cols-2 gap-2 overflow-y-auto pr-0.5">
                  {employees.map(employee => {
                    const isAssigned = employee._id === serviceEdit.employeeId;
                    return (
                      <button
                        type="button"
                        key={employee._id}
                        onClick={() => setServiceEdit(current => current ? { ...current, employeeId: employee._id } : current)}
                        className={`flex min-h-12 items-center gap-2 rounded-xl border p-2 text-left transition ${
                          isAssigned
                            ? "border-[#9E5E6F] bg-[#F9ECEF] text-[#7F4353]"
                            : "border-stone-200 bg-white text-stone-600"
                        }`}
                      >
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-[9px] font-bold ${
                          isAssigned ? "bg-[#9E5E6F] text-white" : "bg-stone-100 text-stone-500"
                        }`}>
                          {employee.avatar ? (
                            <img src={employee.avatar} alt="" className="h-full w-full object-cover" />
                          ) : getEmpInitials(employee._id)}
                        </div>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold">{employee.name}</span>
                          {employee._id === primaryEmployeeId && (
                            <span className="block text-[9px] font-semibold text-[#9E5E6F]">Mặc định của bill</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl bg-stone-50 px-3.5 py-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold text-stone-500">Thành tiền dịch vụ</span>
                  <span className="text-base font-extrabold text-[#9E5E6F]">{formatPrice(serviceEditPrice * serviceEditQuantity)}</span>
                </div>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-stone-100 bg-white px-5 py-4">
              <button
                type="button"
                onClick={() => removeService(serviceEdit.index)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-red-200 bg-white text-sm font-bold text-red-600 transition active:scale-[0.98]"
              >
                <Trash2 className="h-4 w-4" /> Xóa
              </button>
              <button
                type="submit"
                disabled={!serviceEdit.employeeId}
                className="min-h-12 rounded-xl bg-[#187B49] px-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition active:scale-[0.98] disabled:bg-stone-300 disabled:shadow-none"
              >
                Lưu
              </button>
            </div>
          </form>
        </div>
      )}

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
              <InvoiceBreakdown invoice={invoiceBreakdownData} />

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
