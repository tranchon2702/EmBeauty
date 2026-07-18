import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, Calendar, TrendingUp, UserCheck, AlertCircle, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";

interface InvoiceBrief {
  _id: string;
  invoiceNumber: string;
  customerPhone: string;
  totalAmount: number;
  paymentMethod: string;
  pointsEarned: number;
  employeeId: {
    _id: string;
    name: string;
  };
  createdAt: string;
}

interface EmployeeStat {
  name: string;
  amount: number;
  invoiceCount: number;
}

interface StatsData {
  totalRevenue: number;
  cashRevenue: number;
  bankRevenue: number;
  invoiceCount: number;
  employeeStats: EmployeeStat[];
}

const EmployeeStats = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<StatsData>({
    totalRevenue: 0,
    cashRevenue: 0,
    bankRevenue: 0,
    invoiceCount: 0,
    employeeStats: []
  });
  const [invoices, setInvoices] = useState<InvoiceBrief[]>([]);
  const [loading, setLoading] = useState(true);

  // Authenticate session
  useEffect(() => {
    const rawSession = localStorage.getItem("embeauty_session");
    if (!rawSession) {
      toast.error("Vui lòng đăng nhập trước");
      navigate("/noi-bo");
    }
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch stats
        const statsRes = await fetch(`${API_BASE}/invoices/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setStats(statsData);
        }

        // 2. Fetch all invoices
        const invoicesRes = await fetch(`${API_BASE}/invoices`);
        if (invoicesRes.ok) {
          const invoicesData = await invoicesRes.json();
          setInvoices(invoicesData);
        }
      } catch (err) {
        toast.error("Lỗi tải thông tin thống kê");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatPrice = (price: number) => {
    return price.toLocaleString("vi-VN") + "đ";
  };

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')} - ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      {/* Header */}
      <div className="bg-[#9E5E6F] text-white py-4 px-6 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <Link to="/employee/dashboard" className="p-2 hover:bg-white/10 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-serif text-lg font-bold">Thống Kê Báo Cáo</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Totals & Leaderboard */}
        <div className="lg:col-span-1 space-y-6">
          {/* Revenue Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-5">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Doanh Thu Trong Ngày</h2>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] text-stone-400 block font-medium">TỔNG DOANH THU</span>
                <span className="text-2xl font-extrabold text-[#9E5E6F] font-serif">{formatPrice(stats.totalRevenue)}</span>
              </div>

              {/* Progress split bar */}
              <div className="space-y-2">
                <div className="w-full bg-stone-100 h-2.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-[#9E5E6F] h-full"
                    style={{ width: `${stats.totalRevenue > 0 ? (stats.bankRevenue / stats.totalRevenue) * 100 : 0}%` }}
                    title="Chuyển khoản"
                  ></div>
                  <div
                    className="bg-[#E5B2C0] h-full"
                    style={{ width: `${stats.totalRevenue > 0 ? (stats.cashRevenue / stats.totalRevenue) * 100 : 0}%` }}
                    title="Tiền mặt"
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#9E5E6F]"></span>
                    CK: {formatPrice(stats.bankRevenue)}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#E5B2C0]"></span>
                    Tiền mặt: {formatPrice(stats.cashRevenue)}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-600">
                <span>Số lượng hóa đơn:</span>
                <strong className="text-stone-800">{stats.invoiceCount} đơn</strong>
              </div>
            </div>
          </div>

          {/* Employee Performance Leaderboard */}
          <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-4">
            <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">Doanh Số Theo Nhân Viên</h2>

            {stats.employeeStats.length === 0 ? (
              <p className="text-xs text-stone-400 italic py-4 text-center">Chưa ghi nhận doanh số cho thợ hôm nay</p>
            ) : (
              <div className="space-y-4">
                {stats.employeeStats
                  .sort((a, b) => b.amount - a.amount)
                  .map((emp, idx) => {
                    const maxAmount = Math.max(...stats.employeeStats.map(e => e.amount), 1);
                    const widthPercent = (emp.amount / maxAmount) * 100;
                    return (
                      <div key={idx} className="space-y-1 text-xs">
                        <div className="flex justify-between font-semibold text-stone-750">
                          <span className="flex items-center gap-1.5">
                            <span className="font-bold text-[#9E5E6F] font-serif">{idx + 1}.</span>
                            {emp.name}
                          </span>
                          <span className="font-bold font-serif">{formatPrice(emp.amount)}</span>
                        </div>
                        <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-[#9E5E6F] h-full rounded-full transition-all duration-300"
                            style={{ width: `${widthPercent}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-400">
                          <span>{emp.invoiceCount} khách phục vụ</span>
                          <span>Tỷ lệ: {Math.round(widthPercent)}%</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Invoices Log */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl p-6 border border-stone-200/60 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 mb-6">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#9E5E6F]" />
                <h2 className="font-serif font-bold text-stone-900 text-base">Nhật Ký Hóa Đơn Bán Hàng</h2>
              </div>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9E5E6F] mx-auto"></div>
                <p className="text-xs text-stone-400 mt-2">Đang tải nhật ký đơn hàng...</p>
              </div>
            ) : invoices.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                <AlertCircle className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                <p className="text-sm font-semibold">Chưa lập hóa đơn nào</p>
                <p className="text-xs mt-1">Các hóa đơn sau khi lập cho khách sẽ hiển thị ở đây.</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-100 max-h-[500px] overflow-y-auto pr-1">
                {invoices.map((inv) => (
                  <div key={inv._id} className="py-3.5 flex items-center justify-between gap-4 text-xs animate-fade-in">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-800">{inv.invoiceNumber}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-500 uppercase font-bold tracking-wider">
                          {inv.paymentMethod === "bank" ? "CK" : "Tiền mặt"}
                        </span>
                      </div>
                      <div className="text-[10px] text-stone-400 flex flex-wrap gap-x-3">
                        <span>Thời gian: {formatDate(inv.createdAt)}</span>
                        <span>Khách: {inv.customerPhone || "Vãng lai"}</span>
                        <span>Thợ: <strong className="text-stone-600 font-semibold">{inv.employeeId?.name || "Khác"}</strong></span>
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-1">
                      <span className="font-bold text-stone-800 font-serif text-sm block">{formatPrice(inv.totalAmount)}</span>
                      {inv.pointsEarned > 0 && (
                        <span className="text-[10px] text-[#9E5E6F] font-semibold bg-[#F9ECEF] px-2 py-0.5 rounded-full">
                          +{inv.pointsEarned} điểm
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
    </div>
  );
};

export default EmployeeStats;
