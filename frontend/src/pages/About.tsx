import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Clock, MapPin, Phone, ChevronRight, Sparkles } from "lucide-react";
import { API_BASE } from "../config";

interface ServiceItem {
  _id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
}

interface CategoryItem {
  _id: string;
  key: string;
  name: string;
  icon: string;
}

interface SalonSettings {
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  salonHours: string;
  googleMapsUrl: string;
}

const About = () => {
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("");
  const tabBarRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<SalonSettings>({
    salonName: "EM Beauty",
    salonPhone: "035 836 7919",
    salonAddress: "64 Linh Trung, Linh Xuân, TP.HCM",
    salonHours: "08:00 - 20:30",
    googleMapsUrl: "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9"
  });

  useEffect(() => {
    // 1. Fetch categories + services. `activeOnly` keeps paused services off
    //    the public price list without deleting them.
    const fetchCatalogue = async () => {
      try {
        const [catRes, srvRes] = await Promise.all([
          fetch(`${API_BASE}/categories`),
          fetch(`${API_BASE}/services?activeOnly=true`),
        ]);
        if (catRes.ok) {
          const cats: CategoryItem[] = await catRes.json();
          setCategories(cats);
          if (cats.length > 0) setActiveTab(cats[0].key);
        }
        if (srvRes.ok) setServices(await srvRes.json());
      } catch (err) {
        console.error("Lỗi lấy bảng giá:", err);
      } finally {
        setLoading(false);
      }
    };

    // 2. Fetch settings
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_BASE}/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings({
            salonName: data.salonName || "EM Beauty",
            salonPhone: data.salonPhone || "035 836 7919",
            salonAddress: data.salonAddress || "64 Linh Trung, Linh Xuân, TP.HCM",
            salonHours: data.salonHours || "08:00 - 20:30",
            googleMapsUrl: data.googleMapsUrl || "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9"
          });
        }
      } catch (err) {
        console.error("Lỗi lấy cài đặt tiệm:", err);
      }
    };

    fetchCatalogue();
    fetchSettings();
  }, []);

  // Intersection observer to auto-update active tab while scrolling
  useEffect(() => {
    if (loading || categories.length === 0) return;
    const observers: IntersectionObserver[] = [];
    categories.forEach(({ key }) => {
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
  }, [loading, categories]);

  const scrollToSection = (key: string) => {
    setActiveTab(key);
    const el = document.getElementById(`section-${key}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const getServices = (cat: string) => services.filter(s => s.category === cat);
  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  // An empty category would render as a dead tab, so only list the ones that
  // actually have something to sell.
  const visibleCategories = categories.filter(cat => getServices(cat.key).length > 0);

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
        <p className="text-sm text-white/75 italic relative z-10">{settings.salonName}</p>

        {/* Contact strip */}
        <div className="mt-5 flex flex-wrap justify-center gap-3 text-[11px] relative z-10">
          <a href={settings.googleMapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full px-3 py-1.5 transition">
            <MapPin className="w-3.5 h-3.5" /> {settings.salonAddress}
          </a>
          <a href={`tel:${settings.salonPhone}`}
            className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-full px-3 py-1.5 transition">
            <Phone className="w-3.5 h-3.5" /> {settings.salonPhone}
          </a>
          <div className="flex items-center gap-1.5 bg-white/15 rounded-full px-3 py-1.5">
            <Clock className="w-3.5 h-3.5" /> {settings.salonHours}
          </div>
        </div>
      </div>

      {/* ── Sticky Tab Bar ── */}
      <div ref={tabBarRef} className="sticky top-0 z-20 bg-[#FDFBF7]/95 backdrop-blur-md border-b border-stone-200/60 shadow-sm">
        <div className="flex overflow-x-auto px-3 py-2.5 gap-2" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {visibleCategories.map(cat => (
            <button
              key={cat.key}
              onClick={() => scrollToSection(cat.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold border transition-colors duration-150 ${activeTab === cat.key
                ? "bg-[#9E5E6F] border-[#9E5E6F] text-white shadow-md shadow-[#9E5E6F]/25"
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-300"
                }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.name}</span>
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
        ) : visibleCategories.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm font-semibold text-stone-500">Bảng giá đang được cập nhật</p>
            <p className="text-xs text-stone-400 mt-1">Nhắn Zalo để được báo giá nhanh nhất nhé!</p>
          </div>
        ) : (
          visibleCategories.map((cat) => {
            const catServices = getServices(cat.key);
            return (
              <section
                key={cat.key}
                id={`section-${cat.key}`}
                className="bg-white rounded-3xl border border-stone-250/70 shadow-sm overflow-hidden"
              >
                {/* Section Header */}
                <div className="px-5 pt-5 pb-4 border-b border-stone-100 bg-[#FDFBF7]/50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat.icon}</span>
                    <div>
                      <h3 className="font-serif font-bold text-stone-900 text-base">{cat.name}</h3>
                      <p className="text-[10px] text-stone-400 mt-0.5">{catServices.length} dịch vụ</p>
                    </div>
                  </div>
                </div>

                {/* Service Items List */}
                {catServices.length === 0 ? (
                  <div className="py-8 text-center text-stone-400 text-xs">
                    Không có dịch vụ nào trong danh mục này.
                  </div>
                ) : (
                  <div className="divide-y divide-stone-100">
                    {catServices.map((srv) => (
                      <div key={srv._id} className="p-5 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <h4 className="font-bold text-stone-850 text-[13px] leading-snug">{srv.name}</h4>
                          {srv.description && (
                            <p className="text-[10.5px] text-stone-500 leading-relaxed pt-0.5">{srv.description}</p>
                          )}
                        </div>
                        <span className="font-sans font-bold text-[#9E5E6F] text-[13px] tracking-wide shrink-0 tabular-nums pt-0.5">
                          {formatPrice(srv.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Zalo CTA at bottom of each section */}
                <div className="px-5 py-3 bg-stone-50/50 border-t border-stone-100">
                  <a
                    href="https://zalo.me/0358367919"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] font-bold text-[#9E5E6F] hover:text-[#763A48] flex items-center gap-1 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    Đặt lịch dịch vụ {cat.name}
                    <ChevronRight className="w-3 h-3" />
                  </a>
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* ── Floating Zalo Button ── */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-xs px-4 z-30">
        <a
          href="https://zalo.me/0358367919"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 py-3.5 bg-[#9E5E6F] hover:bg-[#8D5060] active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-[#9E5E6F]/35 transition text-sm w-full"
        >
          <CalendarIcon /> Đặt Lịch Ngay
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
