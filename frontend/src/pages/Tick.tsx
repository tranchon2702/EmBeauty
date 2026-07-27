import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Search, AlertCircle, Sparkles, Scissors, CheckCircle2, Gift, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";
import { RankInfo, themeFor } from "../lib/loyalty";

interface CustomerData {
  name: string;
  phone: string;
  points: number;
  totalPointsEarned: number;
  lastVisitAt: string | null;
  rank: RankInfo;
}

const ZALO_URL = "https://zalo.me/0358367919";

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
      const res = await fetch(`${API_BASE}/customers/lookup?phone=${encodeURIComponent(phone.trim())}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        toast.error(body?.message || "Lỗi tìm kiếm dữ liệu");
        setLoading(false);
        return;
      }
      const data: CustomerData = await res.json();
      setCustomer(data);
      toast.success(`Xin chào ${data.name}! Hạng ${data.rank.name} ${data.rank.icon}`);
    } catch {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const theme = themeFor(customer?.rank.key);

  const formatVisit = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Brand Header */}
        <div className="text-center">
          <div className="w-12 h-12 bg-[#9E5E6F] rounded-2xl flex items-center justify-center mx-auto mb-2 shadow-lg shadow-[#9E5E6F]/20">
            <Scissors className="w-6 h-6 text-white" />
          </div>
          <h1 className="font-serif text-xl font-bold text-stone-800 tracking-tight">EM Beauty</h1>
          <p className="text-xs text-stone-400 mt-0.5 font-medium">Thẻ thành viên &amp; điểm tích lũy</p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Link to="/" className="p-1 hover:bg-stone-50 rounded-full transition">
              <ArrowLeft className="w-4 h-4 text-stone-500" />
            </Link>
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Nhập số điện thoại</p>
          </div>

          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="w-4 h-4 text-stone-300 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                inputMode="numeric"
                placeholder="Ví dụ: 0901234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                className="w-full pl-10 pr-24 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F]/30 font-medium"
              />
              <button
                type="submit"
                disabled={loading}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 bg-[#9E5E6F] hover:bg-[#8D5060] disabled:bg-stone-300 text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                {loading ? "..." : "Tra Cứu"}
              </button>
            </div>
          </form>
        </div>

        {/* Loading Spinner */}
        {loading && (
          <div className="py-8 flex flex-col items-center">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#9E5E6F]" />
            <p className="text-xs text-stone-400 mt-2 font-medium">Đang tìm kiếm...</p>
          </div>
        )}

        {/* ══ Result: membership card ══════════════════════════════════════ */}
        {!loading && customer && (
          <div className="space-y-3 animate-fade-in">

            {/* Tier card */}
            <div className={`relative overflow-hidden rounded-3xl p-5 text-white shadow-xl bg-gradient-to-br ${theme.card}`}>
              {/* Decorative sheen */}
              <div className="absolute -top-10 -right-8 w-36 h-36 rounded-full bg-white/10 blur-xl" />
              <div className="absolute -bottom-14 -left-6 w-32 h-32 rounded-full bg-white/5 blur-xl" />

              <div className="relative flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/70">
                    Thẻ Thành Viên
                  </p>
                  <h2 className="font-serif font-bold text-xl mt-1 truncate">{customer.name}</h2>
                  <p className="text-[11px] text-white/70 font-medium tracking-wide">{customer.phone}</p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <span className="text-3xl leading-none block">{customer.rank.icon}</span>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-white/90">
                    {customer.rank.name}
                  </span>
                </div>
              </div>

              <div className="relative mt-5 flex items-end justify-between border-t border-white/20 pt-4">
                <div>
                  <p className="text-[10px] text-white/70 font-medium">Điểm khả dụng</p>
                  <p className="font-serif font-extrabold text-4xl leading-none tracking-tight">
                    {customer.points}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/70 font-medium">Tích lũy trọn đời</p>
                  <p className="font-serif font-bold text-lg leading-tight">
                    {customer.totalPointsEarned}
                  </p>
                </div>
              </div>
            </div>

            {/* Progress to next tier */}
            {customer.rank.next ? (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-bold text-stone-700">
                    <TrendingUp className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    Lên hạng {customer.rank.next.name} {customer.rank.next.icon}
                  </span>
                  <span className="text-[11px] font-bold text-[#9E5E6F]">
                    còn {customer.rank.next.pointsNeeded} điểm
                  </span>
                </div>
                <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${theme.bar}`}
                    style={{ width: `${Math.max(4, customer.rank.next.progressPercent)}%` }}
                  />
                </div>
                <p className="text-[10px] text-stone-400">
                  Đã đạt {customer.rank.next.progressPercent}% chặng đường tới mốc{" "}
                  {customer.rank.next.minPoints} điểm
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 text-center">
                <p className="text-xs font-bold text-stone-700">
                  🎉 Bạn đang ở hạng cao nhất — cảm ơn bạn rất nhiều!
                </p>
              </div>
            )}

            {/* Benefits of the current tier */}
            {customer.rank.benefits.length > 0 && (
              <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4 space-y-2.5">
                <p className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                  <Gift className="w-3.5 h-3.5 text-[#9E5E6F]" />
                  Quyền lợi hạng {customer.rank.name}
                </p>
                <ul className="space-y-2">
                  {customer.rank.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-stone-600">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                      <span className="leading-snug">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* All tiers overview */}
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm p-4">
              <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-3">
                Các hạng thẻ
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {customer.rank.allTiers.map((tier) => {
                  const reached = customer.totalPointsEarned >= tier.minPoints;
                  const isCurrent = tier.key === customer.rank.key;
                  return (
                    <div
                      key={tier.key}
                      className={`rounded-xl border px-1.5 py-2 text-center transition ${
                        isCurrent
                          ? `${themeFor(tier.key).badge} ring-2 ${themeFor(tier.key).ring}`
                          : reached
                            ? "bg-stone-50 border-stone-200 text-stone-500"
                            : "bg-white border-stone-100 text-stone-300"
                      }`}
                    >
                      <span className="block text-base leading-none">{tier.icon}</span>
                      <span className="block text-[9px] font-bold mt-1 leading-tight">{tier.name}</span>
                      <span className="block text-[9px] opacity-70">{tier.minPoints}+</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[9px] text-stone-300 text-center mt-2">
                Mốc tính theo tổng điểm tích lũy trọn đời — không bị tụt hạng khi tiêu điểm
              </p>
            </div>

            {/* How it works */}
            <div className="space-y-2 text-xs text-stone-600 bg-stone-50/70 rounded-2xl p-4 border border-stone-100">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Điểm được tự động cộng sau mỗi lần thanh toán dịch vụ tại tiệm.</p>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p>Đọc SĐT cho nhân viên khi thanh toán để tích thêm điểm.</p>
              </div>
              {customer.lastVisitAt && (
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <p>Lần ghé gần nhất: <strong>{formatVisit(customer.lastVisitAt)}</strong></p>
                </div>
              )}
            </div>

            <a
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-3.5 bg-[#9E5E6F] hover:bg-[#8D5060] active:scale-[0.98] text-white font-bold rounded-2xl shadow-lg shadow-[#9E5E6F]/25 transition text-xs w-full"
            >
              <Sparkles className="w-4 h-4" /> Đặt Lịch Làm Đẹp Qua Zalo
            </a>
          </div>
        )}

        {/* Result: Not Found */}
        {!loading && searched && !customer && (
          <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 p-6 text-center animate-fade-in space-y-4">
            <AlertCircle className="w-10 h-10 text-stone-300 mx-auto" />
            <div>
              <p className="text-sm font-bold text-stone-800">Chưa có thông tin tích điểm</p>
              <p className="text-xs text-stone-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
                Vui lòng làm dịch vụ tại tiệm và đọc số điện thoại cho nhân viên để được đăng ký thành viên tích điểm!
              </p>
            </div>

            <a
              href={ZALO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-2xl text-xs font-bold shadow-md shadow-[#9E5E6F]/20 transition"
            >
              <Sparkles className="w-4 h-4" /> Đặt Lịch Ngay Qua Zalo
            </a>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-[10px] text-stone-300 pt-2 font-medium">
          © EM Beauty Nails &amp; Makeup • Tích điểm tự động
        </p>
      </div>
    </div>
  );
};

export default Tick;
