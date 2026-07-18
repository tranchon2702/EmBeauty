import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Phone, ChevronRight, Sparkles } from "lucide-react";
import { API_BASE } from "../config";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  category: "nails" | "eyelashes" | "washing" | "makeup";
  duration: number;
  description?: string;
}

type Category = "nails" | "eyelashes" | "washing" | "makeup";

const CATEGORIES: { key: Category; label: string; emoji: string; title: string; subtitle: string }[] = [
  { key: "nails",      label: "Nails",       emoji: "💅", title: "Chăm Sóc Móng Cao Cấp",   subtitle: "Gel, Acrylic, Móng nghệ thuật" },
  { key: "eyelashes",  label: "Nối Mi",      emoji: "✨", title: "Nối Mi Thiết Kế",          subtitle: "Classic, Volume, Uốn mi Collagen" },
  { key: "washing",    label: "Gội Đầu",     emoji: "🧴", title: "Gội Đầu & Massage",        subtitle: "Thảo dược, Dưỡng sinh, Keratin" },
  { key: "makeup",     label: "Makeup",      emoji: "💄", title: "Trang Điểm Chuyên Nghiệp", subtitle: "Cô dâu, Sự kiện, Phun thẩm mỹ" },
];

const About = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Category>("nails");
  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_BASE}/services`);
        if (res.ok) setServices(await res.json());
      } catch (err) {
        console.error("Lỗi lấy dịch vụ:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, []);

  // Intersection observer to auto-update active tab while scrolling
  useEffect(() => {
    if (loading) return;
    const observers: IntersectionObserver[] = [];
    CATEGORIES.forEach(({ key }) => {
      const el = document.getElementById(`section-${key}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveTab(key); },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });
    return () => observers.forEach(o => o.disconnect());
  }, [loading]);

  const scrollToSection = (key: Category) => {
    setActiveTab(key);
    const el = document.getElementById(`section-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getServices = (cat: Category) => services.filter(s => s.category === cat);
  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-24">

      {/* ── Hero Banner ── */}
      <div className="relative bg-gradient-to-b from-[#9E5E6F] to-[#B07080] text-white px-4 pt-14 pb-8 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-2 left-8 text-5xl">💅</div>
          <div className="absolute top-4 right-6 text-4xl">✨</div>
          <div className="absolute bottom-3 left-1/3 text-3xl">💄</div>
        </div>

        <Link to="/" className="absolute left-4 top-4 p-2 bg-white/20 hover:bg-white/30 rounded-full transition">
          <ArrowLeft className="w-5 h-5 text-white" />
        </Link>

        <h1 className="font-serif text-2xl font-bold mb-1 relative z-10">Bảng Giá Dịch Vụ</h1>
        <p className="text-sm text-white/75 italic relative z-10">EM Beauty Nails &amp; Makeup</p>

        {/* Contact strip */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-[11px] relative z-10">
          <a href="https://maps.app.goo.gl/DruZXXTrtSVBj6LW9" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full px-3 py-1.5 transition">
            <MapPin className="w-3.5 h-3.5" /> 64 Linh Trung, Linh Xuân, TP.HCM
          </a>
          <a href="tel:0358367919"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full px-3 py-1.5 transition">
            <Phone className="w-3.5 h-3.5" /> 035 836 7919
          </a>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" /> 08:00 – 20:30
          </div>
        </div>
      </div>

      {/* ── Sticky Tab Bar ── */}
      <div ref={tabBarRef} className="sticky top-0 z-20 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-200/60 shadow-sm">
        <div className="flex overflow-x-auto px-3 py-2.5 gap-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => scrollToSection(cat.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border transition-colors duration-150 ${activeTab === cat.key
                ? "bg-[#9E5E6F] border-[#9E5E6F] text-white shadow-md shadow-[#9E5E6F]/25"
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
            >
              <span>{cat.emoji}</span>
              <span>{cat.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Service Content ── */}
      <div className="max-w-2xl mx-auto px-4 mt-5 space-y-6 pb-6">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#9E5E6F] mx-auto" />
            <p className="text-xs text-stone-400 mt-3">Đang tải bảng giá...</p>
          </div>
        ) : (
          CATEGORIES.map((cat) => {
            const catServices = getServices(cat.key);
            return (
              <section
                key={cat.key}
                id={`section-${cat.key}`}
                className="scroll-mt-20 bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden"
              >
                {/* Section header */}
                <div className="bg-gradient-to-r from-[#F9ECEF] to-white px-5 py-4 border-b border-stone-100">
                  <div className="flex items-center gap-3">
                    <div className="text-2xl">{cat.emoji}</div>
                    <div>
                      <h2 className="font-serif font-bold text-[#763A48] text-base leading-tight">{cat.title}</h2>
                      <p className="text-[10px] text-stone-400 mt-0.5">{cat.subtitle}</p>
                    </div>
                  </div>
                </div>

                {/* Services list */}
                {catServices.length === 0 ? (
                  <div className="px-5 py-6 text-center text-xs text-stone-400 italic">
                    Chưa có dịch vụ trong danh mục này
                  </div>
                ) : (
                  <div className="divide-y divide-stone-50">
                    {catServices.map((item, idx) => (
                      <div
                        key={item._id}
                        className="px-5 py-3.5 flex items-center justify-between gap-3 hover:bg-stone-50/60 transition"
                      >
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-stone-800 leading-snug">{item.name}</h3>
                          {item.description && (
                            <p className="text-[10px] text-stone-400 mt-0.5 italic">{item.description}</p>
                          )}
                          <p className="text-[10px] text-stone-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> {item.duration} phút
                          </p>
                        </div>
                        <span className="text-sm font-bold text-[#9E5E6F] font-serif shrink-0 whitespace-nowrap">
                          {formatPrice(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Book CTA at bottom of each section */}
                <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100">
                  {/*
                  <Link
                    to="/booking"
                    className="text-[11px] font-bold text-[#9E5E6F] hover:text-[#763A48] flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Đặt lịch dịch vụ {cat.label}
                    <ChevronRight className="w-3 h-3" />
                  </Link>
                  */}
                  <a
                    href="https://zalo.me/0358367919"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#9E5E6F] hover:text-[#763A48] flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Đặt lịch dịch vụ {cat.label} qua Zalo
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* ── Floating Booking Button ── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-xs px-4 z-30">
        {/*
        <Link
          to="/booking"
          className="flex items-center justify-center gap-2 py-3.5 bg-[#9E5E6F] hover:bg-[#8D5060] active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-[#9E5E6F]/35 transition text-sm w-full"
        >
          <CalendarIcon /> Đặt Lịch Ngay
        </Link>
        */}
        <a
          href="https://zalo.me/0358367919"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3.5 bg-[#9E5E6F] hover:bg-[#8D5060] active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-[#9E5E6F]/35 transition text-sm w-full"
        >
          <CalendarIcon /> Đặt Lịch Qua Zalo
        </a>
      </div>
    </div>
  );
};

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export default About;
