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

const EmployeeDashboard = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<StatsData>({ totalRevenue: 0, cashRevenue: 0, bankRevenue: 0, invoiceCount: 0 });
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [dbServices, setDbServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Walk-in booking blocking states
  const [showWalkinModal, setShowWalkinModal] = useState(false);
  const [walkinName, setWalkinName] = useState("Khách vãng lai");
  const [walkinPhone, setWalkinPhone] = useState("0000000000");
  const [walkinDate, setWalkinDate] = useState(new Date().toISOString().split("T")[0]);
  const [walkinTime, setWalkinTime] = useState("");
  const [walkinServices, setWalkinServices] = useState<string[]>([]);
  const [walkinNote, setWalkinNote] = useState("Khách ngoài / Walk-in");
  const [submittingWalkin, setSubmittingWalkin] = useState(false);
  const [bookingView, setBookingView] = useState<"list" | "calendar">("calendar");

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

      // 2. Fetch bookings
      const bookingsRes = await fetch(`${API_BASE}/bookings`);
      if (bookingsRes.ok) {
        const bookingsData = await bookingsRes.json();
        setBookings(bookingsData);
      }

      // 3. Fetch services list for Walk-in checklist
      const srvRes = await fetch(`${API_BASE}/services`);
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        setDbServices(srvData);
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

  const updateBookingStatus = async (id: string, newStatus: string) => {
    try {
      const res = await fetch(`${API_BASE}/bookings/${id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) {
        throw new Error("Lỗi cập nhật trạng thái");
      }

      toast.success(`Đã cập nhật trạng thái thành công`);
      // Update local state
      setBookings(bookings.map(b => b._id === id ? { ...b, status: newStatus as any } : b));
      fetchData(); // refresh stats in case total changes
    } catch (err) {
      toast.error("Không thể cập nhật trạng thái");
      console.error(err);
    }
  };

  // Submit walk-in reservation blocking
  const handleCreateWalkin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walkinTime) {
      toast.warning("Vui lòng chọn giờ hẹn cho khách vãng lai");
      return;
    }
    if (walkinServices.length === 0) {
      toast.warning("Vui lòng chọn ít nhất 1 dịch vụ");
      return;
    }

    setSubmittingWalkin(true);
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: walkinName.trim(),
          phone: walkinPhone.trim(),
          services: walkinServices,
          date: walkinDate,
          time: walkinTime,
          note: walkinNote.trim(),
          status: "confirmed" // walk-ins are auto-confirmed to lock the slot
        })
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Không thể khóa lịch. Trùng thời gian hoặc vượt giới hạn!");
        setSubmittingWalkin(false);
        return;
      }

      toast.success("Đã khóa lịch hẹn thành công!");
      setShowWalkinModal(false);
      
      // Reset walk-in form
      setWalkinName("Khách vãng lai");
      setWalkinPhone("0000000000");
      setWalkinTime("");
      setWalkinServices([]);
      setWalkinNote("Khách ngoài / Walk-in");
      
      fetchData(); // refresh dashboard bookings
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setSubmittingWalkin(false);
    }
  };

  const toggleWalkinService = (srvName: string) => {
    if (walkinServices.includes(srvName)) {
      setWalkinServices(walkinServices.filter(s => s !== srvName));
    } else {
      setWalkinServices([...walkinServices, srvName]);
    }
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

        {/* Right Side: Bookings Panel */}
        <div className="md:col-span-3">

          {/* View Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setBookingView("calendar")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 ${
                bookingView === "calendar"
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-white text-stone-500 border-stone-200 hover:border-stone-300"
              }`}
            >
              <CalendarRange className="w-3.5 h-3.5" /> Lịch theo ngày
            </button>
            <button
              onClick={() => setBookingView("list")}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border transition-colors duration-150 ${
                bookingView === "list"
                  ? "bg-primary text-white border-primary shadow-md shadow-primary/20"
                  : "bg-white text-stone-500 border-stone-200 hover:border-stone-300"
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" /> Tất cả
            </button>
          </div>

          {/* Calendar View */}
          {bookingView === "calendar" && (
            <BookingCalendar
              onUpdateStatus={updateBookingStatus}
              onCreateWalkin={() => setShowWalkinModal(true)}
            />
          )}

          {/* List View */}
          {bookingView === "list" && (
          <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                <h2 className="font-serif font-bold text-stone-900 text-base">Tất Cả Lịch Hẹn</h2>
                <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{bookings.length}</span>
              </div>
              <button onClick={fetchData} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors duration-150">
                <RefreshCw className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
                <p className="text-xs text-stone-400 mt-2">Đang tải lịch hẹn...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-semibold">Chưa có lịch đặt hẹn nào</p>
                <p className="text-xs mt-1">Lịch hẹn khách tự đặt trên website sẽ xuất hiện ở đây.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div key={booking._id} className="border border-stone-200/70 hover:border-stone-300 rounded-2xl p-4 transition-colors duration-150 bg-background/40 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800 text-sm">{booking.name}</span>
                        <span className="text-stone-400 text-xs">({booking.phone})</span>
                        {booking.phone === "0000000000" && (
                          <span className="px-2 py-0.5 rounded bg-stone-100 text-[9px] text-stone-500 font-bold uppercase tracking-wider">Vãng lai</span>
                        )}
                      </div>
                      <div className="text-xs text-stone-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>Lịch: <strong className="text-stone-700">{formatDate(booking.date)}</strong> lúc <strong className="text-stone-700">{booking.time}</strong></span>
                        <span>Trạng thái: <strong className="text-primary">{booking.status}</strong></span>
                      </div>
                      {booking.services.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {booking.services.map((s, i) => (
                            <span key={i} className="text-[10px] bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 font-medium text-stone-600">{s}</span>
                          ))}
                        </div>
                      )}
                      {booking.note && <p className="text-[10px] text-stone-400 italic">Ghi chú: {booking.note}</p>}
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      {booking.status === "pending" && (
                        <>
                          <button onClick={() => updateBookingStatus(booking._id, "confirmed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-semibold transition-colors duration-150">
                            <CheckCircle className="w-3.5 h-3.5" /> Xác Nhận
                          </button>
                          <button onClick={() => updateBookingStatus(booking._id, "cancelled")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-colors duration-150">
                            <XCircle className="w-3.5 h-3.5" /> Hủy
                          </button>
                        </>
                      )}
                      {booking.status === "confirmed" && (
                        <>
                          <button onClick={() => updateBookingStatus(booking._id, "completed")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 rounded-xl text-xs font-semibold transition-colors duration-150">
                            <CheckCircle className="w-3.5 h-3.5" /> Hoàn Thành
                          </button>
                          <button onClick={() => updateBookingStatus(booking._id, "cancelled")}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-xl text-xs font-semibold transition-colors duration-150">
                            <XCircle className="w-3.5 h-3.5" /> Hủy
                          </button>
                        </>
                      )}
                      {booking.status === "completed" && (
                        <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-1 font-bold">✓ Hoàn tất</span>
                      )}
                      {booking.status === "cancelled" && (
                        <span className="text-[10px] text-stone-400 bg-stone-50 border border-stone-200 rounded-full px-2.5 py-1 font-bold">✕ Đã hủy</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* Walk-in slot block modal */}
      {showWalkinModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-stone-100 shadow-2xl relative">
            <h3 className="font-serif font-bold text-stone-900 text-base mb-1 flex items-center gap-1.5">
              <CalendarDays className="w-5 h-5 text-[#9E5E6F]" />
              Khóa Lịch Khách Ngoài / Khách Vãng Lai
            </h3>
            <p className="text-[10px] text-stone-400 mb-4">
              Nhập lịch hẹn để hệ thống tự động khóa chỗ, tránh khách online đặt đè lên.
            </p>

            <form onSubmit={handleCreateWalkin} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Tên hiển thị</label>
                  <input
                    type="text"
                    value={walkinName}
                    onChange={(e) => setWalkinName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Số điện thoại</label>
                  <input
                    type="tel"
                    value={walkinPhone}
                    onChange={(e) => setWalkinPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Ngày khóa *</label>
                  <input
                    type="date"
                    required
                    value={walkinDate}
                    onChange={(e) => setWalkinDate(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-medium"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Khung giờ khóa *</label>
                  <select
                    value={walkinTime}
                    required
                    onChange={(e) => setWalkinTime(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold"
                  >
                    <option value="">-- Chọn giờ --</option>
                    {TIME_SLOTS.map((slot, idx) => (
                      <option key={idx} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Service list checklist */}
              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">Dịch vụ chiếm chỗ *</label>
                <div className="max-h-24 overflow-y-auto border border-stone-200 rounded-xl p-2.5 bg-stone-50 space-y-1.5">
                  {dbServices.map((srv) => (
                    <label key={srv._id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={walkinServices.includes(srv.name)}
                        onChange={() => toggleWalkinService(srv.name)}
                        className="rounded border-stone-350 text-[#9E5E6F] focus:ring-[#9E5E6F] w-3.5 h-3.5"
                      />
                      <span>{srv.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Ghi chú khóa lịch</label>
                <textarea
                  rows={1.5}
                  value={walkinNote}
                  onChange={(e) => setWalkinNote(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowWalkinModal(false)}
                  className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl font-semibold transition"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={submittingWalkin}
                  className="flex-1 py-2.5 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-semibold transition flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Xác nhận khóa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
