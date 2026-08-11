import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, PlusCircle, BarChart3, Settings as SettingsIcon, ClipboardList, CheckCircle, XCircle, AlertCircle, RefreshCw, KeyRound, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch, clearSession, getSession } from "../config";
import { formatVnDateTime, vnToday } from "../lib/date";
import { PaymentAccountLogo } from "../components/PaymentAccountLogo";
import { InvoiceBreakdown } from "../components/InvoiceBreakdown";

interface SessionData {
  _id: string;
  name: string;
  role: string;
}

interface StatsData {
  totalRevenue: number;
  cashRevenue: number;
  bankRevenue: number;
  paidCount: number;
  /** "all" for admins, "self" when a staff member only sees their own takings. */
  scope: "all" | "self";
}

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  services: Array<{
    name: string;
    catalogPrice?: number | null;
    price: number;
    quantity?: number;
    employeeId?: { _id?: string; name: string; avatar?: string } | null;
  }>;
  subTotal?: number;
  surcharge?: number;
  surchargeNote?: string;
  discount?: number;
  discountType?: "amount" | "percent";
  discountValue?: number;
  note?: string;
  totalAmount: number;
  paymentMethod: "cash" | "bank";
  status: "draft" | "paid" | "cancelled";
  createdAt: string;
  paidAt: string | null;
  employeeId: {
    name: string;
  };
  employeeIds?: Array<{
    _id: string;
    name: string;
  }>;
  bankAccountId?: {
    accountType?: "bank" | "momo";
    bankId: string;
    bankName: string;
    displayName: string;
    accountNumber: string;
  } | null;
}

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<StatsData>({
    totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, paidCount: 0, scope: "self",
  });
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // PIN change modal
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinStep, setPinStep] = useState<"current" | "new" | "confirm">("current");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  const handleMarkPaidModal = async (inv: InvoiceData) => {
    setUpdatingStatus(true);
    setSelectedInvoice(null); // Close modal immediately to prevent double-click
    try {
      const res = await authFetch(`${API_BASE}/invoices/${inv._id}/pay`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: inv.paymentMethod || "cash" }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.message);
      toast.success(`✅ Đã thanh toán thành công ${inv.invoiceNumber}`);
      // ── LOYALTY POINTS DISABLED (tạm tắt cảnh báo tích điểm) ──────────────
      // if (d.pointsWarning) toast.warning(d.pointsWarning, { duration: 10000 });
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Lỗi thanh toán");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleCancelInvoiceModal = async (inv: InvoiceData) => {
    if (!confirm(`Bạn chắc chắn muốn hủy phiếu nháp ${inv.invoiceNumber}?`)) return;
    setUpdatingStatus(true);
    try {
      const res = await authFetch(`${API_BASE}/invoices/${inv._id}/cancel`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Lỗi hủy phiếu nháp");
      toast.success("Đã hủy phiếu nháp");
      setSelectedInvoice(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Lỗi hủy phiếu");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteInvoice = async (inv: InvoiceData) => {
    if (!confirm(`Xóa vĩnh viễn hóa đơn ${inv.invoiceNumber}? Thao tác này không thể hoàn tác.`)) return;
    setUpdatingStatus(true);
    try {
      const res = await authFetch(`${API_BASE}/invoices/${inv._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message || `Đã xóa hóa đơn ${inv.invoiceNumber}`);
      setSelectedInvoice(null);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || "Lỗi xóa hóa đơn");
    } finally {
      setUpdatingStatus(false);
    }
  };

  useEffect(() => {
    const session = getSession();
    if (!session) {
      toast.error("Vui lòng đăng nhập trước");
      navigate("/staff");
      return;
    }
    setSession(session);
  }, [navigate]);

  const fetchData = async () => {
    if (!getSession()) return;
    setLoading(true);
    try {
      // Both calls key off the same Vietnam-local day, and the server reports
      // revenue by paidAt — so this figure always matches the Thống kê page.
      const today = vnToday();

      const [statsRes, invRes] = await Promise.all([
        authFetch(`${API_BASE}/invoices/stats/summary?dateFrom=${today}&dateTo=${today}`),
        authFetch(`${API_BASE}/invoices?date=${today}`),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.items || []);
      }
    } catch (err) {
      toast.error("Lỗi đồng bộ dữ liệu");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLogout = () => {
    clearSession();
    toast.success("Đã đăng xuất");
    navigate("/staff");
  };

  // ── PIN Change handlers ──
  const resetPinModal = () => {
    setShowPinModal(false);
    setPinStep("current");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const handlePinDigit = (digit: string) => {
    if (pinStep === "current") {
      if (currentPin.length < 4) {
        const val = currentPin + digit;
        setCurrentPin(val);
        if (val.length === 4) setTimeout(() => setPinStep("new"), 200);
      }
    } else if (pinStep === "new") {
      if (newPin.length < 4) {
        const val = newPin + digit;
        setNewPin(val);
        if (val.length === 4) setTimeout(() => setPinStep("confirm"), 200);
      }
    } else {
      if (confirmPin.length < 4) {
        const val = confirmPin + digit;
        setConfirmPin(val);
        if (val.length === 4) setTimeout(() => submitPinChange(val), 200);
      }
    }
  };

  const handlePinDelete = () => {
    if (pinStep === "confirm") {
      if (confirmPin.length > 0) setConfirmPin(p => p.slice(0, -1));
      else setPinStep("new");
    } else if (pinStep === "new") {
      if (newPin.length > 0) setNewPin(p => p.slice(0, -1));
      else setPinStep("current");
    } else {
      setCurrentPin(p => p.slice(0, -1));
    }
  };

  const submitPinChange = async (confirm: string) => {
    if (newPin !== confirm) {
      toast.error("Mã PIN xác nhận không khớp!");
      setConfirmPin("");
      setNewPin("");
      setPinStep("new");
      return;
    }
    if (!session) return;
    setPinLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/employees/${session._id}/change-pin`, {
        method: "PATCH",
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message || "Đã đổi mã PIN thành công!");
      resetPinModal();
    } catch (err: any) {
      toast.error(err.message || "Lỗi đổi PIN");
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      setPinStep("current");
    } finally {
      setPinLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + "đ";
  };

  const getEmployeeNames = (invoice: InvoiceData) => {
    const names = invoice.employeeIds?.map((employee) => employee.name).filter(Boolean) || [];
    return names.length > 0 ? names.join(", ") : invoice.employeeId?.name || "Hệ thống";
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] overscroll-contain" style={{ paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      {/* Header bar */}
      <div
        className="bg-[#9E5E6F] text-white px-6 flex items-center justify-between shadow-md sticky top-0 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)", paddingBottom: "12px" }}
      >
        <div>
          <h1 className="font-serif text-xl font-bold">EM Beauty Manager</h1>
          {session && (
            <p className="text-xs text-white/80">Chào: <span className="font-bold">{session.name}</span> ({session.role === "admin" ? "Quản trị" : "Nhân viên"})</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchData} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-150" title="Làm mới">
            <RefreshCw className="w-4.5 h-4.5" />
          </button>
          <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors duration-150" title="Đăng xuất">
            <LogOut className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 mt-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Left Side: Today Stats & Navigation */}
        <div className="md:col-span-1 space-y-6">
          {/* Quick Stats Panel */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
              Doanh thu hôm nay
              {stats.scope === "self" && (
                <span className="block text-[9px] font-semibold text-stone-300 normal-case tracking-normal mt-0.5">
                  Chỉ tính các hóa đơn của bạn
                </span>
              )}
            </h2>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] text-stone-400 block font-medium">Tổng hóa đơn:</span>
                <span className="text-xl font-serif font-bold text-[#9E5E6F]">{formatPrice(stats.totalRevenue)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-100 text-[10px] text-stone-500">
                <div>
                  <span className="block font-medium">Tiền mặt:</span>
                  <span className="font-bold text-stone-700">{formatPrice(stats.cashRevenue)}</span>
                </div>
                <div>
                  <span className="block font-medium">Chuyển khoản:</span>
                  <span className="font-bold text-stone-700">{formatPrice(stats.bankRevenue)}</span>
                </div>
              </div>
              <div className="pt-2 border-t border-stone-100 text-[10px] text-stone-500">
                <span className="font-medium">Số đơn hàng: </span>
                <span className="font-bold text-stone-750">{stats.paidCount} đơn</span>
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="bg-white rounded-2xl p-3 border border-stone-200/60 shadow-sm space-y-1">
            <Link
              to="/employee/invoice/create"
              className="flex items-center gap-3 p-3 hover:bg-[#F9ECEF] hover:text-[#9E5E6F] text-stone-700 rounded-xl transition font-medium text-xs"
            >
              <PlusCircle className="w-5 h-5 shrink-0" />
              <span>Tạo Hóa Đơn Mới</span>
            </Link>

            <Link
              to="/employee/stats"
              className="flex items-center gap-3 p-3 hover:bg-[#F9ECEF] hover:text-[#9E5E6F] text-stone-700 rounded-xl transition font-medium text-xs"
            >
              <BarChart3 className="w-5 h-5 shrink-0" />
              <span>Thống Kê Doanh Thu</span>
            </Link>

            {session?.role === "admin" && (
              <Link
                to="/employee/management"
                className="flex items-center gap-3 p-3 hover:bg-[#F9ECEF] hover:text-[#9E5E6F] text-stone-700 rounded-xl transition font-medium text-xs"
              >
                <SettingsIcon className="w-5 h-5 shrink-0" />
                <span>Nhân Sự & Thiết Lập</span>
              </Link>
            )}

            <button
              onClick={() => setShowPinModal(true)}
              className="flex items-center gap-3 p-3 hover:bg-amber-50 hover:text-amber-700 text-stone-700 rounded-xl transition font-medium text-xs w-full text-left"
            >
              <KeyRound className="w-5 h-5 shrink-0" />
              <span>Đổi Mã PIN</span>
            </button>
          </div>
        </div>

        {/* Right Side: Invoices Panel */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h2 className="font-serif font-bold text-stone-900 text-base">Hóa Đơn Hôm Nay</h2>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{invoices.length}</span>
              </div>
              <button onClick={fetchData} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors duration-150" title="Làm mới">
                <RefreshCw className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-xs text-stone-400 mt-2">Đang tải danh sách hóa đơn...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-semibold">Chưa có hóa đơn nào trong hôm nay</p>
                <p className="text-xs mt-1">Bấm "Tạo Hóa Đơn Mới" ở thanh bên trái để ghi nhận doanh thu.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv._id}
                    onClick={() => setSelectedInvoice(inv)}
                    className="border border-stone-200/70 hover:border-[#9E5E6F]/40 hover:shadow-md cursor-pointer rounded-2xl p-4 transition-all duration-150 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-700">{inv.invoiceNumber}</span>
                        {inv.status === "paid" && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">Đã Thanh Toán</span>
                        )}
                        {inv.status === "draft" && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full animate-pulse">Bản Nháp (Bấm để xem & thanh toán)</span>
                        )}
                        {inv.status === "cancelled" && (
                          <span className="text-[9px] font-bold bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-full">Đã Hủy</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500">
                        <span>Khách: <strong className="text-stone-700">{inv.customerName || "Khách vãng lai"}</strong> {inv.customerPhone && `(${inv.customerPhone})`}</span>
                        <span className="mx-2">•</span>
                        <span>NV: <strong className="text-stone-700">{getEmployeeNames(inv)}</strong></span>
                      </div>
                      {inv.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {inv.services.map((s, i) => (
                            <span key={i} className="text-[10px] bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 font-medium text-stone-600">
                              {s.name} {s.quantity ? `x${s.quantity}` : ""} ({formatPrice(s.price * (s.quantity || 1))})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 self-stretch md:self-auto justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-stone-100">
                      <span className="text-sm font-bold text-[#9E5E6F] font-serif">{formatPrice(inv.totalAmount)}</span>
                      <span className="text-[10px] text-stone-400">
                        Thanh toán: <span className="font-bold">
                          {inv.paymentMethod === "cash" ? "Tiền mặt" : inv.bankAccountId?.accountType === "momo" ? "Ví MoMo" : "Chuyển khoản QR"}
                        </span>
                      </span>
                      {inv.status === "paid" && inv.paidAt && (
                        <span className="text-[10px] text-emerald-600 font-semibold">
                          Đã thu lúc {formatVnDateTime(inv.paidAt, true)}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Detail & Status Update Modal ── */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 border border-stone-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-stone-400">Chi Tiết Hóa Đơn</span>
                <h3 className="font-mono font-bold text-lg text-stone-900">{selectedInvoice.invoiceNumber}</h3>
              </div>
              <div className="flex items-center gap-2">
                {selectedInvoice.status === "paid" && (
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full">Đã Thanh Toán</span>
                )}
                {selectedInvoice.status === "draft" && (
                  <span className="text-xs font-bold bg-amber-100 text-amber-700 px-3 py-1 rounded-full">Bản Nháp</span>
                )}
                {selectedInvoice.status === "cancelled" && (
                  <span className="text-xs font-bold bg-stone-100 text-stone-600 px-3 py-1 rounded-full">Đã Hủy</span>
                )}
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="p-1 hover:bg-stone-100 text-stone-400 rounded-full transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Info rows */}
            <div className="bg-stone-50 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-stone-500">Khách hàng:</span>
                <span className="font-bold text-stone-800">{selectedInvoice.customerName || "Khách vãng lai"} {selectedInvoice.customerPhone && `(${selectedInvoice.customerPhone})`}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Hình thức thanh toán:</span>
                <span className="font-bold text-[#9E5E6F] flex items-center gap-2">
                  {selectedInvoice.paymentMethod === "cash" ? "💵 Tiền mặt" : (
                    <>
                      {selectedInvoice.bankAccountId && (
                        <PaymentAccountLogo
                          accountType={selectedInvoice.bankAccountId.accountType === "momo" ? "momo" : "bank"}
                          bankId={selectedInvoice.bankAccountId.bankId}
                          name={selectedInvoice.bankAccountId.bankName}
                          className="w-7 h-7"
                        />
                      )}
                      {selectedInvoice.bankAccountId?.accountType === "momo" ? "Ví MoMo" : "Chuyển khoản QR"}
                    </>
                  )}
                </span>
              </div>
              {selectedInvoice.status === "paid" && selectedInvoice.paidAt && (
                <div className="flex justify-between">
                  <span className="text-stone-500">Thanh toán lúc:</span>
                  <span className="font-bold text-emerald-700">{formatVnDateTime(selectedInvoice.paidAt, true)}</span>
                </div>
              )}
            </div>

            <InvoiceBreakdown invoice={selectedInvoice} />

            {/* Action buttons */}
            <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row gap-2">
              {selectedInvoice.status === "draft" && (
                <>
                  <button
                    disabled={updatingStatus}
                    onClick={() => handleMarkPaidModal(selectedInvoice)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20"
                  >
                    <CheckCircle className="w-4 h-4" /> Xác Nhận Thanh Toán
                  </button>

                  <button
                    onClick={() => {
                      const id = selectedInvoice._id;
                      setSelectedInvoice(null);
                      navigate(`/employee/invoice/create?id=${id}`);
                    }}
                    className="py-2.5 px-4 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" /> Sửa Phiếu
                  </button>

                  <button
                    disabled={updatingStatus}
                    onClick={() => handleCancelInvoiceModal(selectedInvoice)}
                    className="py-2.5 px-3 bg-stone-100 hover:bg-red-50 text-red-600 rounded-xl font-bold text-xs transition"
                  >
                    Hủy
                  </button>
                </>
              )}

              {selectedInvoice.status !== "draft" && (
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-full py-2.5 bg-stone-100 text-stone-700 rounded-xl font-bold text-xs hover:bg-stone-200 transition"
                >
                  Đóng
                </button>
              )}

              {session?.role === "admin" && (
                <button
                  disabled={updatingStatus}
                  onClick={() => handleDeleteInvoice(selectedInvoice)}
                  className="py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" /> Xóa hóa đơn
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PIN Change Modal ── */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 shadow-2xl border border-stone-100 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif font-bold text-stone-900">Đổi Mã PIN</h3>
              </div>
              <button onClick={resetPinModal} className="p-1 hover:bg-stone-100 rounded-full transition">
                <XCircle className="w-5 h-5 text-stone-400" />
              </button>
            </div>

            {/* Step indicator */}
            <div className="flex items-center gap-2">
              {[
                { step: "current" as const, label: "PIN cũ" },
                { step: "new" as const, label: "PIN mới" },
                { step: "confirm" as const, label: "Xác nhận" },
              ].map((s, i) => (
                <div key={s.step} className="flex items-center gap-2 flex-1">
                  <div className={`h-1 flex-1 rounded-full transition-all ${
                    pinStep === s.step ? "bg-amber-500" :
                    (pinStep === "new" && s.step === "current") || (pinStep === "confirm" && s.step !== "confirm") ? "bg-emerald-500" :
                    "bg-stone-200"
                  }`} />
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-500 text-center font-semibold">
              {pinStep === "current" ? "Nhập mã PIN hiện tại" : pinStep === "new" ? "Nhập mã PIN mới" : "Xác nhận mã PIN mới"}
            </p>

            {/* PIN dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map(i => {
                const val = pinStep === "current" ? currentPin : pinStep === "new" ? newPin : confirmPin;
                return (
                  <div
                    key={i}
                    className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${val.length > i
                      ? "bg-amber-500 border-amber-500 scale-110"
                      : "bg-white border-stone-300"
                    }`}
                  />
                );
              })}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === "⌫") handlePinDelete();
                    else if (key !== "") handlePinDigit(key);
                  }}
                  disabled={pinLoading || key === ""}
                  className={`h-12 rounded-xl text-base font-bold transition active:scale-95 ${key === "" ? "invisible" : key === "⌫"
                    ? "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    : "bg-stone-50 text-stone-800 hover:bg-amber-50 hover:text-amber-700 border border-stone-150"
                  } disabled:opacity-50`}
                >
                  {key}
                </button>
              ))}
            </div>

            {pinLoading && (
              <p className="text-[10px] text-stone-400 text-center">Đang xử lý...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
