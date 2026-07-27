import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarRange, MapPin, Facebook, Receipt,
  Phone, Clock, Star, ChevronRight
} from "lucide-react";
import { API_BASE } from "../config";

const DEFAULT_VIBES = [
  "Cảm ơn bạn đã ghé thăm EM Beauty ✨",
  "Móng đẹp là vũ khí — em lo hết cho bạn nha",
  "Nails chuẩn · Mi cong · Makeup xịn · Bạn xinh",
  "Vào đây thì phải ra về xinh hơn lúc đến 💕",
  "Hôm nay bạn muốn biến hình kiểu gì?",
  "Vẻ đẹp hoàn hảo từ ngón tay đến khuôn mặt",
  "EM Beauty — nơi mỗi chi tiết đều được chăm chút",
];

interface SalonSettings {
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  salonHours: string;
  googleMapsUrl: string;
  facebookUrl: string;
  welcomeMessages: string[];
}

const Index = () => {
  const [settings, setSettings] = useState<SalonSettings>({
    salonName: "EM Beauty",
    salonPhone: "035 836 7919",
    salonAddress: "64 Linh Trung, Linh Xuân, TP.HCM",
    salonHours: "08:00 - 20:30",
    googleMapsUrl: "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
    facebookUrl: "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
    welcomeMessages: DEFAULT_VIBES
  });
  
  const [vibeIdx, setVibeIdx] = useState(0);
  const [fade, setFade] = useState(true);

  // Fetch welcome messages and salon info from CMS settings
  useEffect(() => {
    fetch(`${API_BASE}/settings`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setSettings({
            salonName: data.salonName || "EM Beauty",
            salonPhone: data.salonPhone || "035 836 7919",
            salonAddress: data.salonAddress || "64 Linh Trung, Linh Xuân, TP.HCM",
            salonHours: data.salonHours || "08:00 - 20:30",
            googleMapsUrl: data.googleMapsUrl || "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
            facebookUrl: data.facebookUrl || "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
            welcomeMessages: data.welcomeMessages?.length > 0 ? data.welcomeMessages : DEFAULT_VIBES
          });
        }
      })
      .catch(() => {}); // fallback to default silently
  }, []);

  // Set initial random vibe idx based on the loaded vibes array
  useEffect(() => {
    setVibeIdx(Math.floor(Math.random() * settings.welcomeMessages.length));
  }, [settings.welcomeMessages]);

  // Rotate vibes
  useEffect(() => {
    if (settings.welcomeMessages.length === 0) return;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setVibeIdx(i => (i + 1) % settings.welcomeMessages.length);
        setFade(true);
      }, 400);
    }, 3800);
    return () => clearInterval(interval);
  }, [settings.welcomeMessages]);

  // Split address into 2 lines for 3-column contact grid display
  const addressParts = settings.salonAddress.split(",");
  const addressLine1 = addressParts[0] || "64 Linh Trung";
  const addressLine2 = addressParts[1] ? addressParts[1].trim() : "TP. Hồ Chí Minh";

  return (
    <div className="min-h-screen bg-[#F7F2EF] flex flex-col items-center pt-8 pb-14 px-4">

      {/* Card */}
      <div className="w-full max-w-[360px] bg-white rounded-3xl shadow-lg shadow-stone-200/60 border border-stone-100 overflow-hidden">

        {/* ── Header: Brand ── */}
        <div className="pt-8 pb-5 px-7 text-center">

          {/* Script logo with elegant staggered alignment */}
          <div className="font-['Great_Vibes'] text-[60px] text-primary leading-[1.05] select-none flex flex-col items-center pt-2 pb-1">
            <span className="w-full text-left pl-[18%]">
              {settings.salonName.split(/nails|makeup|&/i)[0].trim().split(" ")[0] || "EM"}
            </span>
            <span className="w-full text-right pr-[15%] mt-0">
              {settings.salonName.split(/nails|makeup|&/i)[0].trim().split(" ").slice(1).join(" ") || "Beauty"}
            </span>
          </div>

          {/* Subtitle with ruled lines */}
          <div className="flex items-center gap-2.5 mt-0.5 mb-5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-stone-200" />
            <p className="font-sans font-semibold text-stone-400 text-[9.5px] tracking-[0.28em] uppercase shrink-0">
              Nails &amp; Makeup
            </p>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-stone-200" />
          </div>

          {/* ── Contact info: balanced 3-col grid ── */}
          <div className="grid grid-cols-3 divide-x divide-stone-100 border border-stone-100 rounded-2xl overflow-hidden text-[10px]">
            <a
              href={settings.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1.5 py-3 px-1 hover:bg-accent transition-colors duration-150 group"
            >
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-stone-500 text-center leading-[1.4] group-hover:text-primary transition-colors duration-150 truncate w-full px-0.5">
                {addressLine1}<br />{addressLine2}
              </span>
            </a>
            <a
              href={`tel:${settings.salonPhone}`}
              className="flex flex-col items-center gap-1.5 py-3 px-1 hover:bg-accent transition-colors duration-150 group"
            >
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-stone-500 leading-[1.4] group-hover:text-primary transition-colors duration-150 truncate w-full text-center px-0.5">
                {settings.salonPhone}
              </span>
            </a>
            <div className="flex flex-col items-center gap-1.5 py-3 px-1">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-stone-500 text-center leading-[1.4] truncate w-full px-0.5">
                {settings.salonHours.replace(" - ", "\n")}
              </span>
            </div>
          </div>

          {/* ── Quote: elegant pull-quote ── */}
          <div className="mt-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-stone-200 to-stone-200" />
              <span className="text-stone-300 text-[10px] tracking-[0.5em]">✦ ✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-stone-200 to-stone-200" />
            </div>

            <div className="min-h-[46px] flex items-center justify-center px-1">
              <p
                className="font-serif italic text-stone-500 text-[13px] leading-relaxed text-center"
                style={{
                  opacity: fade ? 1 : 0,
                  transition: "opacity 380ms ease",
                }}
              >
                {settings.welcomeMessages[vibeIdx] || DEFAULT_VIBES[0]}
              </p>
            </div>

            <div className="flex items-center gap-3 mt-3">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-stone-200 to-stone-200" />
              <span className="text-stone-300 text-[10px] tracking-[0.5em]">✦ ✦</span>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-stone-200 to-stone-200" />
            </div>
          </div>
        </div>

        {/* ── Navigation links ── */}
        <div className="px-5 pb-6 space-y-2.5">

          {/* Temporarily redirected to Zalo instead of /booking form */}
          <a
            href="https://zalo.me/0358367919"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 w-full px-4 py-3.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white rounded-2xl shadow-md shadow-primary/20 transition-colors duration-150"
          >
            <div className="p-1.5 bg-white/15 rounded-xl shrink-0">
              <CalendarRange className="w-[17px] h-[17px] text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[13px] text-white leading-tight">Đặt Lịch</p>
              <p className="text-[10px] text-white/65 mt-0.5">Nhắn tin cho EM Beauty qua Zalo nha! 💬</p>
            </div>
            <ChevronRight className="w-4 h-4 text-white/50 shrink-0" />
          </a>

          {/* Secondary links */}
          {[
            // ── LOYALTY POINTS DISABLED (tạm tắt menu Tích Điểm Thành Viên) ──
            // {
            //   to: "/tick",
            //   icon: <Star className="w-[17px] h-[17px] text-primary" />,
            //   label: "Tích Điểm Thành Viên",
            //   sub: "Tra cứu điểm tích lũy của bạn",
            // },
            {
              to: "/about",
              icon: <Receipt className="w-[17px] h-[17px] text-primary" />,
              label: "Bảng Giá Dịch Vụ",
              sub: "Nails · Nối mi · Makeup · Gội đầu",
            },
          ].map(item => (
            <Link
              key={item.to}
              to={item.to}
              className="flex items-center gap-3.5 w-full px-4 py-3.5 bg-white hover:bg-accent active:scale-[0.98] text-stone-800 rounded-2xl border border-stone-100 transition-colors duration-150"
            >
              <div className="p-1.5 bg-accent rounded-xl shrink-0">{item.icon}</div>
              <div className="flex-1 text-left">
                <p className="font-bold text-[13px] text-stone-800 leading-tight">{item.label}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{item.sub}</p>
              </div>
            </Link>
          ))}

          {/* External links */}
          <a
            href={settings.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 w-full px-4 py-3.5 bg-white hover:bg-accent active:scale-[0.98] text-stone-800 rounded-2xl border border-stone-100 transition-colors duration-150"
          >
            <div className="p-1.5 bg-accent rounded-xl shrink-0">
              <MapPin className="w-[17px] h-[17px] text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[13px] text-stone-800 leading-tight">Chỉ Đường Đến Tiệm</p>
              <p className="text-[10px] text-stone-400 mt-0.5 truncate max-w-[220px]">{settings.salonAddress}</p>
            </div>
          </a>

          <a
            href={settings.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3.5 w-full px-4 py-3.5 bg-white hover:bg-accent active:scale-[0.98] text-stone-800 rounded-2xl border border-stone-100 transition-colors duration-150"
          >
            <div className="p-1.5 bg-accent rounded-xl shrink-0">
              <Facebook className="w-[17px] h-[17px] text-primary" />
            </div>
            <div className="flex-1 text-left">
              <p className="font-bold text-[13px] text-stone-800 leading-tight">Facebook Tiệm</p>
              <p className="text-[10px] text-stone-400 mt-0.5">Follow để xem inspo nails mới nhất!</p>
            </div>
          </a>
        </div>

        {/* Footer */}
        <div className="mx-5 pb-5 pt-4 border-t border-stone-100 flex items-center justify-center text-[10px] text-stone-300">
          <span>© 2026 {settings.salonName}</span>
        </div>
      </div>
    </div>
  );
};

export default Index;
