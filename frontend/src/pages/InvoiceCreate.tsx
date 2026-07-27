import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Phone, Search, Trash2, Plus, Minus, QrCode,
  CheckCircle2, Edit3, Receipt, StickyNote, BadgePlus
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch } from "../config";
import { StyledSelect } from "../components/StyledSelect";

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
        toast.success(`Khách hàng: ${d.name} — ${d.points} điểm`);
      } else {
        setIsNewCustomer(true);
        setCustomerName(""); setCustomerPoints(0);
        toast.info("Khách hàng mới — nhập tên để đăng ký thành viên");
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
    if (isNewCustomer && customerPhone && !customerName.trim()) {
      toast.warning("Nhập tên khách hàng mới để đăng ký tích điểm");
      return;
    }

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
    <div className="min-h-screen bg-[#FDFBF7] pb-20">
      {/* ── Header ── */}
      <div className="bg-[#9E5E6F] text-white py-4 px-5 flex items-center justify-between shadow-lg sticky top-0 z-30">
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

      <div className="max-w-5xl mx-auto px-4 mt-5 grid grid-cols-1 lg:grid-cols-5 gap-5">

        {/* ══ LEFT: Service picker ══════════════════════════════════════════ */}
        <div className="lg:col-span-3 space-y-4">

          {/* Customer lookup */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
            <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2.5">Khách Hàng Tích Điểm</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  placeholder="Số điện thoại khách..."
                  value={customerPhone}
                  onChange={e => {
                    const newPhone = e.target.value.replace(/\D/g, "");
                    setCustomerPhone(newPhone);
                    if (customerName || customerPoints !== null || isNewCustomer) {
                      setCustomerName("");
                      setCustomerPoints(null);
                      setIsNewCustomer(false);
                    }
                  }}
                  onKeyDown={e => e.key === "Enter" && handleCheckCustomer()}
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#9E5E6F]/30"
                />
              </div>
              <button
                onClick={handleCheckCustomer}
                disabled={checkingCustomer}
                className="px-3 py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition disabled:opacity-60"
              >
                <Search className="w-3.5 h-3.5" /> Tra cứu
              </button>
            </div>
            {/* KH cũ — hiện info */}
            {customerName && !isNewCustomer && (
              <div className="mt-2.5 flex items-center justify-between bg-[#F9ECEF] rounded-xl px-3 py-2 text-xs animate-fade-in">
                <div>
                  <p className="text-[10px] text-stone-400">Thành viên</p>
                  <p className="font-bold text-stone-800">{customerName}</p>
                </div>
                {customerPoints !== null && (
                  <div className="text-right">
                    <p className="text-[10px] text-stone-400">Điểm hiện tại</p>
                    <p className="font-bold text-[#9E5E6F] font-serif text-sm">{customerPoints} điểm</p>
                  </div>
                )}
              </div>
            )}

            {/* KH mới — form nhập tên */}
            {isNewCustomer && (
              <div className="mt-2.5 space-y-2 animate-fade-in">
                <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2">
                  <BadgePlus className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-emerald-700">Khách hàng mới</p>
                    <p className="text-[10px] text-emerald-600">Nhập tên để đăng ký thành viên tích điểm</p>
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Tên khách hàng (VD: Nguyễn Thị Lan)"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400/30 placeholder:text-stone-300"
                />
              </div>
            )}
          </div>

          {/* Service grid with category filter */}
          <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
            <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${activeCategory === cat
                    ? "bg-[#9E5E6F] border-[#9E5E6F] text-white"
                    : "bg-stone-50 border-stone-200 text-stone-500 hover:border-stone-300"
                    }`}
                >
                  {cat === "all" ? "🔖 Tất cả" : getCategoryLabel(cat)}
                </button>
              ))}
            </div>

            {filteredServices.length === 0 ? (
              <p className="text-center text-xs text-stone-400 py-6 italic">Chưa có dịch vụ trong danh mục này</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {filteredServices.map(srv => (
                  <button
                    key={srv._id}
                    onClick={() => addService(srv)}
                    className="p-3 bg-stone-50 border border-stone-150 hover:bg-[#F9ECEF] hover:border-[#9E5E6F]/30 rounded-xl transition text-left flex flex-col gap-1 group"
                  >
                    <span className="text-[10px] text-stone-400 font-semibold">
                      {getCategoryLabel(srv.category)}
                    </span>
                    <span className="text-[11px] font-semibold text-stone-750 line-clamp-2 leading-snug group-hover:text-[#9E5E6F] transition">
                      {srv.name}
                    </span>
                    <span className="text-[#9E5E6F] font-bold font-serif text-xs mt-auto">
                      {formatPrice(srv.price)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Custom service */}
            <div className="border-t border-stone-100 mt-3 pt-3">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Thêm dịch vụ / phụ thu tùy chỉnh</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tên dịch vụ..."
                  value={customServiceName}
                  onChange={e => setCustomServiceName(e.target.value)}
                  className="flex-[2] px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
                <input
                  type="number"
                  placeholder="Giá (đ)"
                  value={customServicePrice}
                  onChange={e => setCustomServicePrice(e.target.value)}
                  className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none"
                />
                <button
                  onClick={addCustom}
                  className="p-2.5 bg-[#9E5E6F]/10 hover:bg-[#9E5E6F]/20 border border-[#9E5E6F]/20 text-[#9E5E6F] rounded-xl transition"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ══ RIGHT: Invoice summary ═══════════════════════════════════════ */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm space-y-4">

            {/* Staff selector */}
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">Thợ thực hiện *</p>
              <StyledSelect
                value={selectedEmployee}
                onChange={setSelectedEmployee}
                placeholder="-- Chọn Thợ --"
                size="md"
                options={employees.map(e => ({
                  value: e._id,
                  label: `${e.name}${e.role === "admin" ? " (Quản lý)" : ""}`,
                  icon: e.role === "admin" ? "👑" : "💇",
                }))}
              />
            </div>

            {/* Selected services list */}
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Dịch vụ đã chọn</p>
              {selectedServices.length === 0 ? (
                <div className="py-5 text-center bg-stone-50 rounded-xl border border-dashed border-stone-200">
                  <Receipt className="w-6 h-6 text-stone-300 mx-auto mb-1" />
                  <p className="text-[10px] text-stone-400">Chọn dịch vụ từ bảng bên</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-0.5">
                  {selectedServices.map((srv, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-[#FDFBF7] border border-stone-150 rounded-xl px-2.5 py-2 text-[11px]">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-stone-800 truncate">{srv.name}</p>
                        <p className="text-stone-400 font-serif">{formatPrice(srv.price)} × {srv.quantity} = <span className="text-[#9E5E6F] font-bold">{formatPrice(srv.price * srv.quantity)}</span></p>
                      </div>
                      <div className="flex items-center gap-0.5 bg-white border border-stone-200 rounded-lg p-0.5 shrink-0">
                        <button onClick={() => updateQty(idx, -1)} className="p-1 hover:bg-stone-50 text-stone-500 rounded transition"><Minus className="w-3 h-3" /></button>
                        <input
                          type="number"
                          min={1}
                          value={srv.quantity}
                          onChange={e => setExactQty(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-9 text-center font-bold text-stone-800 text-xs bg-stone-50 rounded border border-stone-200 focus:border-[#9E5E6F] focus:outline-none py-0.5"
                        />
                        <button onClick={() => updateQty(idx, 1)} className="p-1 hover:bg-stone-50 text-stone-500 rounded transition"><Plus className="w-3 h-3" /></button>
                      </div>
                      <button onClick={() => removeService(idx)} className="p-1 text-stone-300 hover:text-red-500 transition shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Surcharge + Discount + Note */}
            <div className="space-y-2.5 pt-3 border-t border-stone-100 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-stone-500 shrink-0">Dịch vụ:</span>
                <span className="font-bold text-stone-750 font-serif">{formatPrice(subTotal)}</span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <label className="text-stone-500 shrink-0">Phụ thu:</label>
                <input
                  type="number" min={0}
                  value={surcharge || ""}
                  placeholder="0đ"
                  onChange={e => setSurcharge(Number(e.target.value))}
                  className="w-28 text-right bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                />
              </div>

              {surcharge > 0 && (
                <div className="flex items-center gap-2">
                  <StickyNote className="w-3 h-3 text-stone-400 shrink-0" />
                  <input
                    type="text"
                    placeholder="Lý do phụ thu (vẽ nhũ, đính đá...)"
                    value={surchargeNote}
                    onChange={e => setSurchargeNote(e.target.value)}
                    className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                  />
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <label className="text-stone-500 shrink-0">Giảm giá:</label>
                <input
                  type="number" min={0}
                  value={discount || ""}
                  placeholder="0đ"
                  onChange={e => setDiscount(Number(e.target.value))}
                  className="w-28 text-right bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
                />
              </div>

              <div className="flex items-center gap-2">
                <StickyNote className="w-3 h-3 text-stone-400 shrink-0" />
                <input
                  type="text"
                  placeholder="Ghi chú hóa đơn..."
                  value={invoiceNote}
                  onChange={e => setInvoiceNote(e.target.value)}
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[10px] focus:outline-none"
                />
              </div>

              {/* Total */}
              <div className="flex items-baseline justify-between pt-2 border-t border-stone-150">
                <span className="font-bold text-stone-800 text-sm">Tổng thanh toán:</span>
                <span className="text-2xl font-extrabold text-[#9E5E6F] font-serif leading-none">{formatPrice(totalAmount)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div>
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Hình thức thanh toán</p>
              <div className="flex gap-2">
                {(["cash", "bank"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${paymentMethod === m ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-white border-stone-200 text-stone-600 hover:bg-stone-50"}`}
                  >
                    {m === "cash" ? "💵 Tiền mặt" : "📱 Chuyển khoản"}
                  </button>
                ))}
              </div>
            </div>

            {/* Bank selector (when bank payment selected) */}
            {paymentMethod === "bank" && bankAccounts.length > 0 && (
              <div className="animate-fade-in">
                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1.5">Chọn tài khoản QR *</p>
                <div className="space-y-1.5">
                  {bankAccounts.map(bank => (
                    <button
                      key={bank._id}
                      onClick={() => setSelectedBankId(bank._id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition ${selectedBankId === bank._id ? "bg-[#F9ECEF] border-[#9E5E6F]/40" : "bg-stone-50 border-stone-200 hover:bg-stone-100"}`}
                    >
                      <div className={`w-2 h-2 rounded-full shrink-0 ${selectedBankId === bank._id ? "bg-[#9E5E6F]" : "bg-stone-300"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-800">{bank.displayName}</p>
                        <p className="text-[10px] text-stone-400">{bank.accountNumber} — {bank.accountHolder}</p>
                      </div>
                      {selectedBankId === bank._id && <QrCode className="w-4 h-4 text-[#9E5E6F] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create / Update invoice button */}
            <button
              onClick={handleSaveDraft}
              disabled={loading || selectedServices.length === 0}
              className={`w-full py-3 ${paymentMethod === "cash" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#9E5E6F] hover:bg-[#8D5060]"} disabled:bg-stone-300 text-white font-bold rounded-xl text-xs transition uppercase tracking-wider flex items-center justify-center gap-2 shadow-md`}
            >
              {loading ? "Đang xử lý..." : (
                <>
                  {paymentMethod === "cash" ? (
                    <><CheckCircle2 className="w-4 h-4" /> {invoiceStatus === "draft" ? "Cập nhật & Thanh toán" : "Lưu & Thanh toán tiền mặt"}</>
                  ) : (
                    <><QrCode className="w-4 h-4" /> {invoiceStatus === "draft" ? "Cập nhật & Chọn QR" : "Tạo hóa đơn & Chọn QR"}</>
                  )}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ══ Payment / QR Modal ══════════════════════════════════════════════ */}
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

              {/* Payment method tabs within modal */}
              <div className="flex gap-2">
                {(["cash", "bank"] as const).map(m => (
                  <button
                    key={m}
                    onClick={() => setPaymentMethod(m)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition ${paymentMethod === m ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-stone-50 border-stone-200 text-stone-600"}`}
                  >
                    {m === "cash" ? "💵 Tiền mặt" : "📱 Chuyển khoản"}
                  </button>
                ))}
              </div>

              {/* QR display for bank */}
              {paymentMethod === "bank" && (
                <div className="animate-fade-in space-y-3">
                  {/* Bank selector */}
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {bankAccounts.map(bank => (
                      <button
                        key={bank._id}
                        onClick={() => setSelectedBankId(bank._id)}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold border transition ${selectedBankId === bank._id ? "bg-[#9E5E6F] border-[#9E5E6F] text-white" : "bg-stone-50 border-stone-200 text-stone-600"}`}
                      >
                        {bank.displayName}
                      </button>
                    ))}
                  </div>

                  {/* QR image */}
                  {selectedBankId && (
                    <div className="flex flex-col items-center gap-2">
                      <div className="bg-white border-2 border-stone-100 rounded-2xl p-3 shadow-inner">
                        <img
                          src={getQRUrl()}
                          alt="VietQR"
                          className="w-52 h-52 object-contain rounded-lg"
                        />
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
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center text-xs text-green-700 font-semibold animate-fade-in">
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
