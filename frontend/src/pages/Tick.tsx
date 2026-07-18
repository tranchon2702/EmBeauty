import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, Award, Sparkles, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";

interface CustomerData {
  name: string;
  phone: string;
  points: number;
}

const Tick = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) {
      toast.warning("Vui lòng nhập số điện thoại");
      return;
    }

    setLoading(true);
    setSearched(true);
    setCustomer(null);

    try {
      const res = await fetch(`${API_BASE}/customers?phone=${phone.trim()}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("Không tìm thấy thông tin số điện thoại này");
        } else {
          toast.error("Đã xảy ra lỗi khi tìm kiếm");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCustomer(data);
      toast.success("Đã tìm thấy thông tin tích điểm!");
    } catch (err) {
      toast.error("Lỗi kết nối máy chủ");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Determine Rank based on points
  const getRankInfo = (points: number) => {
    if (points >= 200) return { name: "Kim Cương (Diamond)", color: "text-[#9E5E6F] bg-[#F9ECEF]", next: "Max Rank" };
    if (points >= 100) return { name: "Vàng (Gold)", color: "text-[#D4AF37] bg-yellow-50", next: 200 - points + " điểm đến Kim Cương" };
    if (points >= 50) return { name: "Bạc (Silver)", color: "text-[#C0C0C0] bg-stone-50", next: 100 - points + " điểm đến Vàng" };
    return { name: "Thành Viên Mới (Bronze)", color: "text-[#CD7F32] bg-amber-50/50", next: 50 - points + " điểm đến Bạc" };
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
      {/* Background decorations */}

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-100 p-6 border border-stone-100 relative overflow-hidden">
        {/* Header navigation */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="p-2 hover:bg-stone-50 rounded-full transition text-stone-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-serif font-semibold text-lg text-stone-800">Thành Viên Tích Điểm</span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-serif text-[#9E5E6F] font-bold mb-1">Tra Cứu Tích Điểm</h2>
          <p className="text-xs text-stone-400">Nhập số điện thoại để kiểm tra điểm thành viên của bạn</p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <input
              type="tel"
              placeholder="Nhập số điện thoại (ví dụ: 0901234567)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full pl-11 pr-24 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-sm"
            />
            <Search className="w-5 h-5 text-stone-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-[#9E5E6F] hover:bg-[#8D5060] disabled:bg-stone-300 text-white rounded-xl text-xs font-medium transition duration-200"
            >
              {loading ? "Đang quét..." : "Tra Cứu"}
            </button>
          </div>
        </form>

        {/* Results Container */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9E5E6F]"></div>
            <p className="text-xs text-stone-400 mt-3 font-medium">Đang tìm dữ liệu trên đám mây...</p>
          </div>
        )}

        {!loading && customer && (
          <div className="bg-[#FDFBF7] border border-stone-200/60 rounded-2xl p-6 relative overflow-hidden animate-fade-in">
            {/* Visual Point Badge */}
            <div className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 bg-white border border-[#9E5E6F]/20 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-[#9E5E6F]" />
              <span className="text-xs font-semibold text-[#9E5E6F]">Active</span>
            </div>

            <div className="flex items-center gap-3.5 mb-6">
              <div className="p-3 bg-[#F9ECEF] rounded-2xl text-[#9E5E6F]">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-stone-800 text-base">{customer.name}</h3>
                <p className="text-xs text-stone-400 font-medium">{customer.phone}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-xs text-stone-400 block mb-1">Số điểm tích lũy hiện tại:</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold text-[#9E5E6F] font-serif">{customer.points}</span>
                  <span className="text-xs text-[#9E5E6F] font-semibold">điểm</span>
                </div>
              </div>

              {/* Rank Info */}
              <div className="border-t border-stone-200/50 pt-4">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-stone-400">Hạng thẻ:</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${getRankInfo(customer.points).color}`}>
                    {getRankInfo(customer.points).name}
                  </span>
                </div>
                <div className="w-full bg-stone-150 rounded-full h-1.5 mb-1.5 overflow-hidden">
                  <div
                    className="bg-[#9E5E6F] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min((customer.points / 200) * 100, 100)}%` }}
                  ></div>
                </div>
                <span className="text-[10px] text-stone-400 font-medium block">
                  {getRankInfo(customer.points).next}
                </span>
              </div>
            </div>
          </div>
        )}

        {!loading && searched && !customer && (
          <div className="border border-dashed border-stone-200 rounded-2xl p-8 text-center animate-fade-in bg-stone-50/50">
            <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-stone-700">Chưa có thông tin tích điểm</p>
            <p className="text-xs text-stone-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Bạn vui lòng thực hiện dịch vụ tại tiệm để được nhân viên hỗ trợ đăng ký và tích điểm thành viên!
            </p>
            <Link
              to="/booking"
              className="inline-block mt-4 px-4 py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl text-xs font-semibold shadow-sm transition"
            >
              Đặt lịch làm đẹp ngay
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Tick;
