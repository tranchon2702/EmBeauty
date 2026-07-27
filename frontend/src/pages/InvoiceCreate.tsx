import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Trash2, Plus, Minus, QrCode,
  CheckCircle2, Edit3, StickyNote
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch } from "../config";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  category: string;
}

interface SelectedItem {
  name: string;
  price: number;
  quantity: number;
}

interface BankAccount {
  _id: string;
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

  // Session
  const [session, setSession] = useState<{ _id: string; name: string; role: string } | null>(null);

  // Data from DB
  const [dbServices, setDbServices] = useState<ServiceItem[]>([]);
  const [dbCategories, setDbCategories] = useState<{ _id: string; key: string; name: string; icon: string }[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  // Invoice fields
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPoints, setCustomerPoints] = useState<number | null>(null);
  const [checkingCustomer, setCheckingCustomer] = useState(false);
  const [isNewCustomer, setIsNewCustomer] = useState(false);

  const [selectedServices, setSelectedServices] = useState<SelectedItem[]>([]);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePrice, setCustomServicePrice] = useState("");

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

  // UI
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [showPayModal, setShowPayModal] = useState(false);
  // Qty editing (allow clear + retype, enforce min=1 on blur)
  const [editingQtyIdx, setEditingQtyIdx] = useState<number | null>(null);
  const [editingQtyVal, setEditingQtyVal] = useState<string>("");

  // ── Session check ─────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("embeauty_session");
    if (!raw) { toast.error("Vui lòng đăng nhập"); navigate("/staff"); return; }
    const s = JSON.parse(raw);
    setSession(s);
    setSelectedEmployee(s._id); // default to current user
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
          if (inv.employeeId) {
            setSelectedEmployee(typeof inv.employeeId === "object" ? inv.employeeId._id : inv.employeeId);
          }
          if (Array.isArray(inv.services)) {
            setSelectedServices(inv.services.map((s: any) => ({ name: s.name, price: s.price, quantity: s.quantity || 1 })));
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

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      try {
        const [srvRes, bankRes, empRes, catRes] = await Promise.all([
          // Paused services stay out of the picker.
          authFetch(`${API_BASE}/services?activeOnly=true`),
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
      } catch (err) {
        toast.error("Lỗi nạp dữ liệu");
      }
    };
    load();
  }, []);

  // ── Computed totals ───────────────────────────────────────────────────────
  const subTotal = selectedServices.reduce((s, i) => s + i.price * i.quantity, 0);
  const totalAmount = Math.max(subTotal + surcharge - discount, 0);

  // ── Customer lookup ───────────────────────────────────────────────────────
  const handleCheckCustomer = async () => {
    if (!customerPhone.trim()) { toast.warning("Nhập số điện thoại khách hàng"); return; }
    setCheckingCustomer(true);
    setCustomerName(""); setCustomerPoints(null); setIsNewCustomer(false);
    try {
      const res = await authFetch(`${API_BASE}/customers?phone=${customerPhone.trim()}`);
      if (res.ok) {
        const d = await res.json();
        setCustomerName(d.name); setCustomerPoints(d.points);
        setIsNewCustomer(false);
        toast.success(`Đã tìm thấy: ${d.name}`);
      } else {
        setIsNewCustomer(true);
        setCustomerName(""); setCustomerPoints(0);
        toast.info("Khách hàng mới — nhập tên để lưu thông tin");
      }
    } catch { toast.error("Lỗi kết nối"); }
    finally { setCheckingCustomer(false); }
  };

  // ── Service list management ───────────────────────────────────────────────
  const addService = (srv: { name: string; price: number }) => {
    setSelectedServices(prev => {
      const idx = prev.findIndex(i => i.name === srv.name);
      if (idx > -1) {
        const copy = [...prev]; copy[idx].quantity += 1; return copy;
      }
      return [...prev, { name: srv.name, price: srv.price, quantity: 1 }];
    });
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
      const copy = [...prev];
      copy[idx].quantity = qty;
      return copy;
    });
  };

  const removeService = (idx: number) =>
    setSelectedServices(prev => prev.filter((_, i) => i !== idx));

  const addCustom = () => {
    if (!customServiceName.trim() || !customServicePrice) { toast.warning("Nhập tên và giá dịch vụ"); return; }
    const price = Number(customServicePrice);
    if (isNaN(price) || price <= 0) { toast.warning("Giá không hợp lệ"); return; }
    addService({ name: customServiceName.trim(), price });
    setCustomServiceName(""); setCustomServicePrice("");
  };

  // ── Build invoice payload ─────────────────────────────────────────────────
  // totalAmount is deliberately NOT sent — the server recomputes it from the
  // line items so the till can never post a figure that does not add up.
  const buildPayload = useCallback(() => ({
    employeeId: selectedEmployee,
    customerPhone: customerPhone.trim(),
    customerName: customerName.trim(),
    services: selectedServices,
    discount,
    surcharge,
    surchargeNote,
    paymentMethod,
    bankAccountId: paymentMethod === "bank" ? selectedBankId || null : null,
    note: invoiceNote,
  }), [selectedEmployee, customerPhone, customerName, selectedServices, discount, surcharge, surchargeNote, paymentMethod, selectedBankId, invoiceNote]);

  /** Adopt whatever the server stored, so the QR amount and the receipt agree. */
  const syncFromServer = (inv: any) => {
    if (Array.isArray(inv.services)) {
      setSelectedServices(inv.services.map((s: any) => ({
        name: s.name, price: s.price, quantity: s.quantity || 1,
      })));
    }
    setDiscount(inv.discount || 0);
    setSurcharge(inv.surcharge || 0);
  };

  // ── Save/Update draft ─────────────────────────────────────────────────────
  const handleSaveDraft = async () => {
    if (!selectedEmployee) { toast.warning("Chọn thợ làm dịch vụ"); return; }
    if (selectedServices.length === 0) { toast.warning("Thêm ít nhất 1 dịch vụ"); return; }
    // Customer validation removed (loyalty disabled)

    setLoading(true);
    try {
      let res, data;
      if (invoiceId) {
        // Update existing draft
        res = await authFetch(`${API_BASE}/invoices/${invoiceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
      } else {
        // Create new draft
        res = await authFetch(`${API_BASE}/invoices`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
      }
      data = await res.json();
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
      // ── LOYALTY POINTS DISABLED (tạm tắt thông báo tích điểm) ──────────────
      // toast.success(`✅ Thanh toán thành công! ${data.pointsEarned > 0 ? `+${data.pointsEarned} điểm tích lũy` : ""}`);
      // The sale went through but the loyalty credit did not — the till needs
      // to fix it manually. Toast a persistent warning so it is not missed.
      // if (data.pointsWarning) toast.warning(data.pointsWarning, { duration: 10000 });
      setShowPayModal(false);
      // Navigate to dashboard after 1.5s
      setTimeout(() => navigate("/employee/dashboard"), 1500);
    } catch (err: any) {
      toast.error(err.message || "Lỗi xác nhận thanh toán");
    } finally { setLoading(false); }
  };

  // ── Edit (go back from payment modal) ────────────────────────────────────
  const handleEditInvoice = () => {
    setShowPayModal(false);
    setInvoiceStatus("draft");
    toast.info("Đang chỉnh sửa hóa đơn...");
  };

  // ── QR generation ─────────────────────────────────────────────────────────
  const getSelectedBank = () => bankAccounts.find(b => b._id === selectedBankId);

  const getQRUrl = () => {
    const bank = getSelectedBank();
    if (!bank) return "";
    // If admin uploaded a static QR, use it (data URL)
    if (bank.qrImageBase64 && bank.qrImageBase64.startsWith("data:")) {
      return bank.qrImageBase64;
    }
    const desc = encodeURIComponent(`Embeauty Nails ${invoiceNumber || ""}`);
    return `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNumber}-print.jpg?amount=${totalAmount}&addInfo=${desc}&accountName=${encodeURIComponent(bank.accountHolder)}`;
  };

  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  const getCategoryLabel = (catKey: string) => {
    const found = dbCategories.find(c => c.key === catKey);
    if (found) return `${found.icon} ${found.name}`;
    return catKey;
  };

  const filteredServices = activeCategory === "all"
    ? dbServices
    : dbServices.filter(s => s.category === activeCategory);

  const categories = ["all", ...Array.from(new Set([...dbCategories.map(c => c.key), ...dbServices.map(s => s.category)]))];

  return (
    <div className="min-h-screen bg-[#F4EFEB]/40 pb-28">

      {/* ── Fixed Header ── */}
      <div
        className="bg-[#9E5E6F] text-white px-5 flex items-center justify-between shadow-lg fixed top-0 left-0 right-0 z-30"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)", paddingBottom: "12px" }}
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

      <div style={{ paddingTop: "calc(env(safe-area-inset-top) + 57px)" }}>

        {/* ── Staff Selector (avatar chips) ── */}
        <div className="bg-white border-b border-stone-100 px-4 py-3">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2.5">Thợ thực hiện *</p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar pb-0.5">
            {employees.map((emp) => {
              const isSelected = selectedEmployee === emp._id;
              const initials = emp.name.split(" ").slice(-2).map((w: string) => w[0]).join("").toUpperCase();
              return (
                <button
                  key={emp._id}
                  onClick={() => setSelectedEmployee(emp._id)}
                  className={`flex flex-col items-center gap-1.5 shrink-0 transition-all duration-200 ${
                    isSelected ? "scale-105" : "opacity-50"
                  }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm transition-all ${
                    isSelected
                      ? "bg-[#9E5E6F] text-white shadow-md shadow-[#9E5E6F]/30"
                      : "bg-stone-100 text-stone-500"
                  }`}>
                    {initials}
                  </div>
                  <span className={`text-[10px] font-semibold max-w-[56px] truncate text-center ${
                    isSelected ? "text-[#9E5E6F]" : "text-stone-400"
                  }`}>
                    {emp.name.split(" ").pop()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Category Tabs ── */}
        <div className="bg-white border-b border-stone-100 px-3 py-2.5 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${
                activeCategory === cat
                  ? "bg-[#9E5E6F] border-[#9E5E6F] text-white"
                  : "bg-stone-50 border-stone-200 text-stone-500"
              }`}
            >
              {cat === "all" ? "🔖 Tất cả" : getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* ── Service Grid ── */}
        <div className="px-4 pt-3 pb-2">
          {filteredServices.length === 0 ? (
            <p className="text-center text-xs text-stone-400 py-10 italic">Chưa có dịch vụ trong danh mục này</p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {filteredServices.map(srv => {
                const isInCart = selectedServices.some(s => s.name === srv.name);
                return (
                  <button
                    key={srv._id}
                    onClick={() => addService(srv)}
                    className={`p-3 border rounded-2xl text-left flex flex-col gap-1.5 active:scale-95 transition shadow-sm ${
                      isInCart ? "bg-[#F9ECEF] border-[#9E5E6F]/40" : "bg-white border-stone-200"
                    }`}
                  >
                    <span className="text-[10px] text-stone-400">{getCategoryLabel(srv.category)}</span>
                    <span className="text-[11px] font-semibold text-stone-800 line-clamp-2 leading-snug">{srv.name}</span>
                    <span className="text-[#9E5E6F] font-bold font-serif text-sm mt-auto">{formatPrice(srv.price)}</span>
                    {isInCart && (
                      <span className="text-[9px] font-bold text-[#9E5E6F] bg-[#9E5E6F]/10 rounded-full px-1.5 py-0.5 w-fit">
                        ✓ Đã thêm
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Custom Service Adder ── */}
        <div className="mx-4 mb-3 bg-white rounded-2xl p-3.5 border border-stone-200 shadow-sm">
          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">+ Dịch vụ tùy chỉnh</p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Tên dịch vụ..."
              value={customServiceName}
              onChange={e => setCustomServiceName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustom()}
              className="flex-[2] px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
            />
            <input
              type="number"
              placeholder="Giá (đ)"
              value={customServicePrice}
              onChange={e => setCustomServicePrice(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addCustom()}
              className="flex-1 min-w-0 px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
            />
            <button
              onClick={addCustom}
              className="p-2.5 bg-[#9E5E6F]/10 hover:bg-[#9E5E6F]/20 border border-[#9E5E6F]/20 text-[#9E5E6F] rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Selected Services Cart ── */}
        {selectedServices.length > 0 && (
          <div className="mx-4 mb-4 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
            {/* Cart header */}
            <div className="px-4 py-2.5 bg-[#F9ECEF]/70 border-b border-stone-100 flex items-center justify-between">
              <p className="text-[10px] font-bold text-[#9E5E6F] uppercase tracking-wider">
                🛍️ Giỏ dịch vụ ({selectedServices.length})
              </p>
              <p className="text-[10px] text-stone-500">
                Dịch vụ: <span className="font-bold text-stone-700">{formatPrice(subTotal)}</span>
              </p>
            </div>

            {/* Items */}
            <div className="divide-y divide-stone-50">
              {selectedServices.map((srv, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-stone-800 truncate">{srv.name}</p>
                    <p className="text-[10px] text-stone-400 font-serif">
                      {formatPrice(srv.price)} × {editingQtyIdx === idx ? (editingQtyVal || "?") : srv.quantity}
                      {" = "}<span className="text-[#9E5E6F] font-bold">{formatPrice(srv.price * srv.quantity)}</span>
                    </p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-0.5 bg-stone-50 border border-stone-200 rounded-xl p-1 shrink-0">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg active:scale-90 transition"
                    >
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
                        setEditingQtyIdx(null);
                        setEditingQtyVal("");
                      }}
                      className="w-10 text-center font-bold text-stone-800 text-xs bg-white rounded-lg border border-stone-200 focus:border-[#9E5E6F] focus:outline-none py-1"
                    />
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className="p-1.5 text-stone-500 hover:text-stone-800 rounded-lg active:scale-90 transition"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeService(idx)}
                    className="p-1.5 text-stone-300 hover:text-red-500 transition shrink-0 active:scale-90"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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

        {/* ── CUSTOMER SECTION DISABLED (loyalty tạm tắt) ──
        <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
          ... customer phone lookup + new customer form ...
        </div>
        */}

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
              <p className="text-[10px] text-stone-400">
                {selectedServices.length} dịch vụ{invoiceStatus === "draft" ? " · Bản nháp" : ""}
              </p>
              <p className="text-xl font-extrabold text-[#9E5E6F] font-serif leading-none">{formatPrice(totalAmount)}</p>
            </>
          )}
        </div>
        <button
          onClick={handleSaveDraft}
          disabled={loading || selectedServices.length === 0}
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
        <div className="fixed inset-0 bg-stone-900/65 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl w-full max-w-sm border border-stone-100 shadow-2xl overflow-hidden">
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
                {selectedServices.map((s, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="text-stone-600">{s.name} × {s.quantity}</span>
                    <span className="font-semibold">{formatPrice(s.price * s.quantity)}</span>
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
                    {m === "cash" ? "💵 Tiền mặt" : "📱 Chuyển khoản"}
                  </button>
                ))}
              </div>

              {/* QR for bank */}
              {paymentMethod === "bank" && (
                <div className="animate-fade-in space-y-3">
                  <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {bankAccounts.map(bank => (
                      <button
                        key={bank._id}
                        onClick={() => setSelectedBankId(bank._id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${
                          selectedBankId === bank._id ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-stone-50 border-stone-200 text-stone-600"
                        }`}
                      >
                        {bank.displayName}
                      </button>
                    ))}
                  </div>
                  {selectedBankId && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-white border-2 border-stone-100 rounded-2xl p-3 shadow-inner">
                        <img src={getQRUrl()} alt="VietQR" className="w-52 h-52 object-contain rounded-lg" />
                      </div>
                      <div className="text-center text-[10px] text-stone-500">
                        <p className="font-bold text-stone-700">{getSelectedBank()?.displayName}</p>
                        <p>STK: <span className="font-mono font-bold">{getSelectedBank()?.accountNumber}</span></p>
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
