import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Calendar, TrendingUp, UserCheck, AlertCircle,
  ShoppingBag, Filter, RefreshCw, Banknote, CreditCard, Lock, Trash2, XCircle
} from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch } from "../config";
import { StyledSelect } from "../components/StyledSelect";
import { PaymentAccountLogo } from "../components/PaymentAccountLogo";
import { vnToday, vnDaysAgo, vnWeekStart, vnMonthStart, formatDayMonth, formatVnDateTime } from "../lib/date";
import { InvoiceBreakdown } from "../components/InvoiceBreakdown";

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  customerPhone: string;
  customerName: string;
  totalAmount: number;
  subTotal?: number;
  surcharge?: number;
  surchargeNote?: string;
  discount?: number;
  discountType?: "amount" | "percent";
  discountValue?: number;
  note?: string;
  paymentMethod: string;
  pointsEarned: number;
  status: string;
  services: Array<{
    name: string;
    catalogPrice?: number | null;
    price: number;
    quantity: number;
    employeeId?: { _id: string; name: string; avatar?: string } | null;
  }>;
  employeeId: {
    _id: string;
    name: string;
    avatar?: string;
  };
  employeeIds?: Array<{
    _id: string;
    name: string;
    avatar?: string;
  }>;
  createdAt: string;
  paidAt: string | null;
  bankAccountId?: {
    accountType?: "bank" | "momo";
    bankId?: string;
    bankName?: string;
    displayName?: string;
  } | null;
}

interface Employee {
  _id: string;
  name: string;
  avatar?: string;
}

/** Aggregated in MongoDB — see GET /api/invoices/stats/summary. */
interface SummaryData {
  totalRevenue: number;
  cashRevenue: number;
  bankRevenue: number;
  serviceRevenue: number;
  serviceCount: number;
  totalPoints: number;
  paidCount: number;
  avgTicket: number;
  draftCount: number;
  cancelledCount: number;
  scope: "all" | "self";
  employeeStats: Array<{
    id: string; name: string; avatar: string;
    amount: number; cash: number; bank: number; count: number;
  }>;
  serviceStats: Array<{ name: string; count: number; revenue: number }>;
}

const EMPTY_SUMMARY: SummaryData = {
  totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, serviceRevenue: 0, serviceCount: 0, totalPoints: 0,
  paidCount: 0, avgTicket: 0, draftCount: 0, cancelledCount: 0,
  scope: "self", employeeStats: [], serviceStats: [],
};

type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Hôm nay" },
  { key: "yesterday", label: "Hôm qua" },
  { key: "week", label: "Tuần này" },
  { key: "month", label: "Tháng này" },
  { key: "custom", label: "Tùy chọn" },
];

const EmployeeStats = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [stats, setStats] = useState<SummaryData>(EMPTY_SUMMARY);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);

  // Filters
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [dateFrom, setDateFrom] = useState(vnToday());
  const [dateTo, setDateTo] = useState(vnToday());
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterPayment, setFilterPayment] = useState<"all" | "cash" | "bank">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "paid" | "draft" | "cancelled">("paid");

  // Session check
  useEffect(() => {
    const raw = localStorage.getItem("embeauty_session");
    if (!raw) { toast.error("Vui lòng đăng nhập trước"); navigate("/staff"); return; }
    try {
      setIsAdmin(JSON.parse(raw).role === "admin");
    } catch {
      navigate("/staff");
    }
  }, [navigate]);

  // Apply preset dates
  useEffect(() => {
    switch (datePreset) {
      case "today": setDateFrom(vnToday()); setDateTo(vnToday()); break;
      case "yesterday": setDateFrom(vnDaysAgo(1)); setDateTo(vnDaysAgo(1)); break;
      case "week": setDateFrom(vnWeekStart()); setDateTo(vnToday()); break;
      case "month": setDateFrom(vnMonthStart()); setDateTo(vnToday()); break;
      case "custom": break; // user sets manually
    }
  }, [datePreset]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  // Headline figures come from a MongoDB aggregation rather than from the
  // invoice list: summing a truncated page would understate a busy month.
  const fetchData = async () => {
    setLoading(true);
    try {
      const shared = new URLSearchParams();
      if (dateFrom) shared.set("dateFrom", dateFrom);
      if (dateTo) shared.set("dateTo", dateTo);
      if (filterEmployee !== "all") shared.set("employeeId", filterEmployee);
      if (filterPayment !== "all") shared.set("paymentMethod", filterPayment);

      const listParams = new URLSearchParams(shared);
      if (filterStatus !== "all") listParams.set("status", filterStatus);

      const [sumRes, invRes, empRes] = await Promise.all([
        authFetch(`${API_BASE}/invoices/stats/summary?${shared.toString()}`),
        authFetch(`${API_BASE}/invoices?${listParams.toString()}`),
        authFetch(`${API_BASE}/employees/list`),
      ]);

      if (sumRes.ok) {
        const summary = await sumRes.json();
        // Keep the page usable during rolling deployments where an older API
        // may not return the newest aggregate fields yet.
        setStats({
          ...EMPTY_SUMMARY,
          ...summary,
          employeeStats: Array.isArray(summary.employeeStats) ? summary.employeeStats : [],
          serviceStats: Array.isArray(summary.serviceStats) ? summary.serviceStats : [],
        });
      }
      if (invRes.ok) {
        const data = await invRes.json();
        setInvoices(data.items || []);
        setInvoiceTotal(data.total ?? (data.items || []).length);
      }
      if (empRes.ok) setEmployees(await empRes.json());
    } catch {
      toast.error("Lỗi tải dữ liệu thống kê");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [dateFrom, dateTo, filterStatus, filterEmployee, filterPayment]);

  const formatPrice = (p: number | undefined) => (Number(p) || 0).toLocaleString("vi-VN") + "đ";
  const getEmployeeNames = (invoice: InvoiceData) => {
    const primaryName = invoice.employeeId?.name || "Khác";
    const supportNames = invoice.employeeIds
      ?.filter(employee => employee._id !== invoice.employeeId?._id && employee.name !== primaryName)
      .map(employee => employee.name)
      .filter(Boolean) || [];
    return supportNames.length > 0
      ? `${primaryName} (hỗ trợ: ${supportNames.join(", ")})`
      : primaryName;
  };

  const handleDeleteInvoice = async (invoice: InvoiceData) => {
    if (!confirm(`Xóa vĩnh viễn hóa đơn ${invoice.invoiceNumber}? Thao tác này không thể hoàn tác.`)) return;
    try {
      const res = await authFetch(`${API_BASE}/invoices/${invoice._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message || `Đã xóa hóa đơn ${invoice.invoiceNumber}`);
      await fetchData();
    } catch (error: any) {
      toast.error(error.message || "Lỗi xóa hóa đơn");
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] overscroll-contain">
      {/* ── Header ── */}
      <div
        className="bg-[#9E5E6F] text-white px-5 flex items-center justify-between shadow-md sticky top-0 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)", paddingBottom: "12px" }}
      >
        <div className="flex items-center gap-3">
          <Link to="/employee/dashboard" className="p-1.5 hover:bg-white/15 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-serif text-base font-bold">Thống Kê &amp; Báo Cáo</h1>
            <p className="text-[10px] text-white/70">
              {formatDayMonth(dateFrom)} → {formatDayMonth(dateTo)}
              {filterEmployee !== "all" && ` • ${employees.find(e => e._id === filterEmployee)?.name}`}
              {stats.scope === "self" && " • chỉ hóa đơn của bạn"}
            </p>
          </div>
        </div>
        <button onClick={fetchData} className="p-1.5 hover:bg-white/15 rounded-full transition" title="Làm mới">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="max-w-6xl mx-auto px-4 mt-5 space-y-5">

        {/* ══ FILTERS BAR ══════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-[#9E5E6F]" />
            <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Bộ lọc</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {/* Date presets */}
            <div className="col-span-2 md:col-span-2">
              <label className="text-[10px] text-stone-400 font-bold block mb-1">Khoảng thời gian</label>
              <div className="flex gap-1 flex-wrap">
                {DATE_PRESETS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setDatePreset(p.key)}
                    className={`px-2.5 py-1.5 rounded-lg font-bold border transition text-[10px] ${
                      datePreset === p.key
                        ? "bg-[#9E5E6F] border-[#9E5E6F] text-white"
                        : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex gap-2 mt-2 animate-fade-in">
                  <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none text-xs" />
                  <span className="text-stone-400 self-center">→</span>
                  <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    className="flex-1 px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg focus:outline-none text-xs" />
                </div>
              )}
            </div>

            {/* Employee filter — only meaningful for admins, since staff are
                already scoped to their own invoices by the API. */}
            <div>
              <label className="text-[10px] text-stone-400 font-bold block mb-1">Nhân viên</label>
              {stats.scope === "all" ? (
                <StyledSelect
                  value={filterEmployee}
                  onChange={setFilterEmployee}
                  options={[
                    { value: "all", label: "Tất cả thợ", icon: "👥" },
                    ...employees.map(e => ({ value: e._id, label: e.name, icon: "💇" }))
                  ]}
                />
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-[11px] font-semibold text-stone-500">
                  <Lock className="w-3 h-3 shrink-0" /> Hóa đơn của bạn
                </div>
              )}
            </div>

            {/* Payment filter */}
            <div>
              <label className="text-[10px] text-stone-400 font-bold block mb-1">Thanh toán</label>
              <StyledSelect
                value={filterPayment}
                onChange={v => setFilterPayment(v as any)}
                options={[
                  { value: "all", label: "Tất cả", icon: "💰" },
                  { value: "cash", label: "Tiền mặt", icon: "💵", color: "bg-emerald-500" },
                  { value: "bank", label: "Chuyển khoản", icon: "🏦", color: "bg-blue-500" },
                ]}
              />
            </div>

            {/* Status filter */}
            <div>
              <label className="text-[10px] text-stone-400 font-bold block mb-1">Trạng thái</label>
              <StyledSelect
                value={filterStatus}
                onChange={v => setFilterStatus(v as any)}
                options={[
                  { value: "paid", label: "Đã thanh toán", icon: "✅", color: "bg-emerald-500" },
                  { value: "all", label: "Tất cả trạng thái", icon: "📋" },
                  { value: "draft", label: "Bản nháp", icon: "📝", color: "bg-amber-500" },
                  { value: "cancelled", label: "Đã hủy", icon: "❌", color: "bg-red-500" },
                ]}
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9E5E6F] mx-auto" />
            <p className="text-xs text-stone-400 mt-2">Đang tải báo cáo...</p>
          </div>
        ) : (
          <>
            {/* ══ OVERVIEW CARDS ════════════════════════════════════════════════ */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
              {/* Total Revenue */}
              <div className="col-span-2 lg:col-span-1 bg-gradient-to-br from-[#9E5E6F] to-[#7D4050] text-white rounded-2xl p-4 shadow-md">
                <p className="text-[10px] text-white/70 font-bold uppercase">
                  {stats.scope === "self" || filterEmployee !== "all" ? "Doanh Thu Được Tính" : "Giá Trị Hóa Đơn"}
                </p>
                <p className="text-xl font-extrabold font-serif mt-1">{formatPrice(stats.totalRevenue)}</p>
                <p className="text-[10px] text-white/60 mt-1">
                  {stats.paidCount} hóa đơn đã thu
                  {(stats.scope === "self" || filterEmployee !== "all") && " · đã tách phần hỗ trợ"}
                </p>
              </div>

              {/* Exact service-line performance for the selected employee/scope */}
              <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl p-4 border border-[#E5B2C0]/50 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#9E5E6F]" />
                  <p className="text-[10px] text-stone-400 font-bold uppercase">Doanh Số Dịch Vụ</p>
                </div>
                <p className="text-lg font-extrabold text-[#9E5E6F] font-serif">{formatPrice(stats.serviceRevenue)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{stats.serviceCount} lượt dịch vụ thực hiện</p>
              </div>

              {/* Cash */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                  <p className="text-[10px] text-stone-400 font-bold uppercase">Tiền Mặt</p>
                </div>
                <p className="text-base font-extrabold text-emerald-700 font-serif">{formatPrice(stats.cashRevenue)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {stats.totalRevenue > 0 ? Math.round((stats.cashRevenue / stats.totalRevenue) * 100) : 0}% tổng
                </p>
              </div>

              {/* Bank */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                  <p className="text-[10px] text-stone-400 font-bold uppercase">Chuyển Khoản</p>
                </div>
                <p className="text-base font-extrabold text-blue-700 font-serif">{formatPrice(stats.bankRevenue)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">
                  {stats.totalRevenue > 0 ? Math.round((stats.bankRevenue / stats.totalRevenue) * 100) : 0}% tổng
                </p>
              </div>

              {/* Avg Ticket */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                  <p className="text-[10px] text-stone-400 font-bold uppercase">TB / Đơn</p>
                </div>
                <p className="text-base font-extrabold text-amber-700 font-serif">{formatPrice(stats.avgTicket)}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">Giá trung bình</p>
              </div>

              {/* Status summary */}
              <div className="bg-white rounded-2xl p-4 border border-stone-200/60 shadow-sm">
                <p className="text-[10px] text-stone-400 font-bold uppercase mb-1">Tổng Đơn</p>
                <p className="text-base font-extrabold text-stone-800 font-serif">
                  {stats.paidCount + stats.draftCount + stats.cancelledCount}
                </p>
                <div className="flex gap-2 mt-1 text-[9px] font-bold">
                  {stats.draftCount > 0 && <span className="text-amber-600">📝 {stats.draftCount} nháp</span>}
                  {stats.cancelledCount > 0 && <span className="text-red-500">❌ {stats.cancelledCount} hủy</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* ══ LEFT: Employee Breakdown ════════════════════════════════════ */}
              <div className="lg:col-span-1 space-y-5">
                {/* Employee Performance */}
                <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-4">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-[#9E5E6F]" /> Doanh Số Dịch Vụ Theo Nhân Viên
                  </h2>
                  <p className="text-[10px] text-stone-400 leading-relaxed">
                    Bill thuộc nhân viên chính; doanh số của người hỗ trợ chỉ tính đúng các dịch vụ được giao. Phần giảm tổng/phụ thu còn lại thuộc nhân viên chính.
                  </p>

                  {stats.employeeStats.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-6 text-center">Chưa có dữ liệu doanh số</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.employeeStats.map((emp, idx) => {
                        const maxAmt = Math.max(...stats.employeeStats.map(e => e.amount), 1);
                        const pct = (emp.amount / maxAmt) * 100;
                        const revPct = stats.serviceRevenue > 0 ? Math.round((emp.amount / stats.serviceRevenue) * 100) : 0;
                        return (
                          <div key={emp.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold ${
                                  idx === 0 ? "bg-amber-400 text-white" : idx === 1 ? "bg-stone-300 text-white" : "bg-stone-100 text-stone-500"
                                }`}>{idx + 1}</span>
                                {emp.avatar ? (
                                  <img src={emp.avatar} className="w-6 h-6 rounded-full object-cover border border-stone-200" alt="" />
                                ) : (
                                  <div className="w-6 h-6 rounded-full bg-[#F9ECEF] flex items-center justify-center text-[10px] font-bold text-[#9E5E6F]">
                                    {emp.name.charAt(0)}
                                  </div>
                                )}
                                <span className="font-bold text-stone-800">{emp.name}</span>
                              </div>
                              <span className="font-extrabold text-[#9E5E6F] font-serif">{formatPrice(emp.amount)}</span>
                            </div>

                            {/* Bar */}
                            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                              <div className="bg-gradient-to-r from-[#9E5E6F] to-[#E5B2C0] h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%` }} />
                            </div>

                            {/* Details */}
                            <div className="flex justify-between text-[10px] text-stone-400 px-0.5">
                              <span>{emp.count} hóa đơn • {revPct}% doanh số dịch vụ</span>
                              <span className="flex gap-2">
                                <span className="text-emerald-600">💵 {formatPrice(emp.cash)}</span>
                                <span className="text-blue-600">🏦 {formatPrice(emp.bank)}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Top Services */}
                <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-3">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[#9E5E6F]" /> Dịch Vụ Phổ Biến
                  </h2>
                  {stats.serviceStats.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-4 text-center">Chưa có dữ liệu</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {stats.serviceStats.slice(0, 15).map((srv, idx) => (
                        <div key={srv.name} className="flex items-center justify-between text-xs py-1.5 border-b border-stone-50 last:border-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] text-stone-400 font-bold w-4 text-right shrink-0">{idx + 1}</span>
                            <span className="font-semibold text-stone-750 truncate">{srv.name}</span>
                            <span className="text-[10px] text-stone-400 shrink-0">×{srv.count}</span>
                          </div>
                          <span className="font-bold text-[#9E5E6F] font-serif shrink-0 ml-2">{formatPrice(srv.revenue)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ══ RIGHT: Invoice Log ══════════════════════════════════════════ */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4.5 h-4.5 text-[#9E5E6F]" />
                      <h2 className="font-serif font-bold text-stone-900 text-sm">Nhật Ký Hóa Đơn</h2>
                      <span className="text-[10px] font-bold bg-[#9E5E6F]/10 text-[#9E5E6F] px-2 py-0.5 rounded-full">
                        {invoiceTotal > invoices.length ? `${invoices.length}/${invoiceTotal}` : invoices.length}
                      </span>
                    </div>
                  </div>

                  {/* The list is capped, but the figures above are aggregated
                      server-side — say so rather than let the numbers look wrong. */}
                  {invoiceTotal > invoices.length && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-800 leading-relaxed">
                      Nhật ký chỉ hiển thị {invoices.length} hóa đơn gần nhất trong tổng số{" "}
                      <strong>{invoiceTotal}</strong>. Các số liệu tổng ở trên đã tính đủ toàn bộ —
                      thu hẹp khoảng thời gian để xem chi tiết từng đơn.
                    </div>
                  )}

                  {invoices.length === 0 ? (
                    <div className="py-16 text-center text-stone-400">
                      <AlertCircle className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                      <p className="text-sm font-semibold">Không có hóa đơn nào</p>
                      <p className="text-xs mt-1">Thay đổi bộ lọc hoặc khoảng thời gian để xem dữ liệu khác.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-stone-100 max-h-[600px] overflow-y-auto pr-1">
                      {invoices.map(inv => (
                        <div
                          key={inv._id}
                          onClick={() => setSelectedInvoice(inv)}
                          className="py-3 flex items-start justify-between gap-3 text-xs cursor-pointer rounded-xl px-2 hover:bg-stone-50 transition"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold text-stone-800">{inv.invoiceNumber}</span>
                              {inv.status === "paid" && (
                                <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded-full">Đã TT</span>
                              )}
                              {inv.status === "draft" && (
                                <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-1.5 py-0.5 rounded-full">Nháp</span>
                              )}
                              {inv.status === "cancelled" && (
                                <span className="text-[9px] font-bold bg-red-50 text-red-500 border border-red-100 px-1.5 py-0.5 rounded-full">Hủy</span>
                              )}
                              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                inv.paymentMethod === "bank"
                                  ? "bg-blue-50 text-blue-600 border border-blue-100"
                                  : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                              }`}>
                                {inv.paymentMethod === "bank" ? "🏦 CK" : "💵 TM"}
                              </span>
                            </div>
                            <div className="text-[10px] text-stone-400 flex flex-wrap gap-x-3">
                              <span>
                                ⏰ {inv.status === "paid" && inv.paidAt ? "TT" : "Tạo"} {formatVnDateTime(inv.status === "paid" && inv.paidAt ? inv.paidAt : inv.createdAt)}
                              </span>
                              <span>👤 {inv.customerName || inv.customerPhone || "Vãng lai"}</span>
                              <span>💇 <strong className="text-stone-600">{getEmployeeNames(inv)}</strong></span>
                            </div>
                            {inv.services && inv.services.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                {inv.services.slice(0, 4).map((s, i) => (
                                  <span key={i} className="text-[9px] bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded-full">
                                    {s.name} {s.quantity > 1 ? `×${s.quantity}` : ""}
                                  </span>
                                ))}
                                {inv.services.length > 4 && (
                                  <span className="text-[9px] text-stone-400">+{inv.services.length - 4} khác</span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0 space-y-0.5">
                            <span className="font-extrabold text-stone-800 font-serif text-sm block">{formatPrice(inv.totalAmount)}</span>
                            {inv.pointsEarned > 0 && (
                              <span className="text-[9px] text-[#9E5E6F] font-semibold bg-[#F9ECEF] px-1.5 py-0.5 rounded-full">
                                +{inv.pointsEarned} pt
                              </span>
                            )}
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={(event) => { event.stopPropagation(); handleDeleteInvoice(inv); }}
                                className="ml-auto mt-1 p-1.5 rounded-lg border border-red-100 bg-red-50 text-red-600 hover:bg-red-100 transition"
                                title={`Xóa hóa đơn ${inv.invoiceNumber}`}
                                aria-label={`Xóa hóa đơn ${inv.invoiceNumber}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Chi tiết hóa đơn</p>
                <h3 className="font-mono text-base font-bold text-stone-900">{selectedInvoice.invoiceNumber}</h3>
                <p className="mt-1 text-[10px] text-stone-500">
                  {selectedInvoice.customerName || selectedInvoice.customerPhone || "Khách vãng lai"} · {formatVnDateTime(selectedInvoice.status === "paid" && selectedInvoice.paidAt ? selectedInvoice.paidAt : selectedInvoice.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2 py-1 text-[9px] font-bold ${
                  selectedInvoice.status === "paid"
                    ? "bg-emerald-100 text-emerald-700"
                    : selectedInvoice.status === "draft"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-stone-100 text-stone-600"
                }`}>
                  {selectedInvoice.status === "paid" ? "Đã thanh toán" : selectedInvoice.status === "draft" ? "Bản nháp" : "Đã hủy"}
                </span>
                <button type="button" onClick={() => setSelectedInvoice(null)} className="rounded-full p-1 text-stone-400 hover:bg-stone-100" aria-label="Đóng chi tiết hóa đơn">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-stone-50 px-3 py-2 text-[10px]">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-stone-600">
                {selectedInvoice.paymentMethod === "bank" && selectedInvoice.bankAccountId && (
                  <PaymentAccountLogo
                    accountType={selectedInvoice.bankAccountId.accountType === "momo" ? "momo" : "bank"}
                    bankId={selectedInvoice.bankAccountId.bankId}
                    name={selectedInvoice.bankAccountId.bankName || selectedInvoice.bankAccountId.displayName}
                    className="h-6 w-6"
                  />
                )}
                <span className="truncate">
                  {selectedInvoice.paymentMethod === "bank"
                    ? selectedInvoice.bankAccountId?.accountType === "momo"
                      ? `Ví MoMo${selectedInvoice.bankAccountId.displayName ? ` · ${selectedInvoice.bankAccountId.displayName}` : ""}`
                      : selectedInvoice.bankAccountId?.displayName || "Chuyển khoản QR"
                    : "Tiền mặt"}
                </span>
              </span>
              <span className="font-bold text-stone-700">{getEmployeeNames(selectedInvoice)}</span>
            </div>

            <InvoiceBreakdown invoice={selectedInvoice} />
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeStats;
