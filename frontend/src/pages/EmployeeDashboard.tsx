import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, PlusCircle, BarChart3, Settings as SettingsIcon, ClipboardList, CheckCircle, XCircle, AlertCircle, RefreshCw, CalendarCheck, CalendarDays, Plus, LayoutList, CalendarRange } from "lucide-react";
import BookingCalendar from "../components/BookingCalendar";
import { toast } from "sonner";
import { API_BASE } from "../config";

interface SessionData {
  _id: string;
  name: string;
  role: string;
}

interface StatsData {
  totalRevenue: number;
  cashRevenue: number;
  bankRevenue: number;
  invoiceCount: number;
}

interface BookingData {
  _id: string;
  name: string;
  phone: string;
  services: string[];
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
}

interface ServiceItem {
  _id: string;
  name: string;
}

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

interface InvoiceData {
  _id: string;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  services: Array<{ name: string; price: number }>;
  totalAmount: number;
  paymentMethod: "cash" | "bank";
  status: "draft" | "paid" | "cancelled";
  createdAt: string;
  employeeId: {
    name: string;
  };
}

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<StatsData>({ totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, invoiceCount: 0 });
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [loading, setLoading] = useState(true);

  // Authenticate session
  useEffect(() => {
    const rawSession = localStorage.getItem("embeauty_session");
    if (!rawSession) {
      toast.error("Vui lòng đăng nhập trước");
      navigate("/staff");
      return;
    }
    setSession(JSON.parse(rawSession));
  }, [navigate]);

  const fetchData = async () => {
    if (!localStorage.getItem("embeauty_session")) return;
    setLoading(true);
    try {
      // 1. Fetch stats
      const statsRes = await fetch(`${API_BASE}/invoices/stats/today`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // 2. Fetch today's invoices
      const todayStr = new Date().toISOString().split("T")[0];
      const invRes = await fetch(`${API_BASE}/invoices?date=${todayStr}`);
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData);
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
    localStorage.removeItem("embeauty_session");
    toast.success("Đã đăng xuất");
    navigate("/employee");
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + "đ";
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      {/* Header bar */}
      <div className="bg-[#9E5E6F] text-white py-4 px-6 flex items-center justify-between shadow-md">
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
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Doanh thu hôm nay</h2>
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
                <span className="font-bold text-stone-750">{stats.invoiceCount} đơn</span>
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

            <button
              onClick={() => setShowWalkinModal(true)}
              className="flex items-center gap-3 p-3 hover:bg-[#F9ECEF] hover:text-[#9E5E6F] text-stone-700 w-full text-left rounded-xl transition font-medium text-xs"
            >
              <CalendarCheck className="w-5 h-5 shrink-0" />
              <span>Khóa Lịch Khách Ngoài</span>
            </button>

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
              <button onClick={fetchData} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors duration-150">
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
              <div className="space-y-4">
                {invoices.map((inv) => (
                  <div key={inv._id} className="border border-stone-200/70 hover:border-stone-300 rounded-2xl p-4 transition-colors duration-150 bg-background/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-stone-700">{inv.invoiceNumber}</span>
                        {inv.status === "paid" && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full">Đã Thanh Toán</span>
                        )}
                        {inv.status === "draft" && (
                          <span className="text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full">Bản Nháp</span>
                        )}
                        {inv.status === "cancelled" && (
                          <span className="text-[9px] font-bold bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded-full">Đã Hủy</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500">
                        <span>Khách: <strong className="text-stone-700">{inv.customerName || "Khách vãng lai"}</strong> {inv.customerPhone && `(${inv.customerPhone})`}</span>
                        <span className="mx-2">•</span>
                        <span>NV: <strong className="text-stone-700">{inv.employeeId?.name || "Hệ thống"}</strong></span>
                      </div>
                      {inv.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {inv.services.map((s, i) => (
                            <span key={i} className="text-[10px] bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 font-medium text-stone-600">
                              {s.name} ({formatPrice(s.price)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-1.5 self-stretch md:self-auto justify-between md:justify-center border-t md:border-t-0 pt-3 md:pt-0 border-stone-100">
                      <span className="text-sm font-bold text-primary font-serif">{formatPrice(inv.totalAmount)}</span>
                      <span className="text-[10px] text-stone-400">
                        Thanh toán: <span className="font-bold">{inv.paymentMethod === "cash" ? "Tiền mặt" : "Chuyển khoản"}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
