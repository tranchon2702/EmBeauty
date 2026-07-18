import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar, Clock, User, Phone, CheckCircle, XCircle, AlertCircle, Plus } from "lucide-react";
import { API_BASE } from "../config";
import { toast } from "sonner";

interface BookingData {
  _id: string;
  name: string;
  phone: string;
  services: string[];
  date: string;
  time: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
  note?: string;
}

const HOURS = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00",
];

const STATUS_CONFIG = {
  pending:   { label: "Chờ xác nhận", color: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50  border-amber-200" },
  confirmed: { label: "Đã xác nhận",  color: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  completed: { label: "Hoàn thành",   color: "bg-stone-400",   text: "text-stone-600",   bg: "bg-stone-50  border-stone-200" },
  cancelled: { label: "Đã hủy",       color: "bg-red-400",     text: "text-red-600",     bg: "bg-red-50    border-red-200" },
};

const formatVN = (d: Date) =>
  `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const dayLabel = (d: Date) => {
  const days = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
  return days[d.getDay()];
};

interface Props {
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onCreateWalkin: () => void;
}

const BookingCalendar: React.FC<Props> = ({ onUpdateStatus, onCreateWalkin }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<BookingData | null>(null);

  // Build week strip (7 days centered on today)
  const today = new Date();
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });

  useEffect(() => {
    fetchDay(selectedDate);
  }, [selectedDate]);

  const fetchDay = async (date: Date) => {
    setLoading(true);
    try {
      const iso = date.toISOString().split("T")[0];
      const res = await fetch(`${API_BASE}/bookings?date=${iso}`);
      if (res.ok) setBookings(await res.json());
    } catch {
      toast.error("Lỗi tải lịch hẹn");
    } finally {
      setLoading(false);
    }
  };

  const navigate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d);
  };

  const bookingsAtHour = (hour: string) =>
    bookings.filter((b) => b.time.startsWith(hour.slice(0, 2)));

  const totalActive = bookings.filter(b => !["cancelled", "completed"].includes(b.status)).length;

  return (
    <div className="bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Calendar className="w-4.5 h-4.5 text-primary" />
          <h2 className="font-serif font-bold text-stone-900 text-base">Lịch Hẹn</h2>
          {totalActive > 0 && (
            <span className="text-[10px] font-bold bg-primary text-white px-2 py-0.5 rounded-full">
              {totalActive}
            </span>
          )}
        </div>
        <button
          onClick={onCreateWalkin}
          className="flex items-center gap-1.5 text-[11px] font-bold text-primary border border-primary/30 bg-accent hover:bg-primary hover:text-white px-3 py-1.5 rounded-xl transition-colors duration-150"
        >
          <Plus className="w-3.5 h-3.5" /> Khóa slot
        </button>
      </div>

      {/* ── Week strip ── */}
      <div className="px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-1.5">
          <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors duration-150 shrink-0">
            <ChevronLeft className="w-4 h-4 text-stone-500" />
          </button>

          <div className="flex gap-1 flex-1 justify-between">
            {weekDays.map((d, i) => {
              const isSelected = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              const dayBookings = bookings; // will refetch per day click

              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(new Date(d))}
                  className={`flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl text-center transition-colors duration-150 flex-1 ${
                    isSelected
                      ? "bg-primary text-white shadow-md shadow-primary/25"
                      : isToday
                      ? "bg-accent text-primary border border-primary/20"
                      : "hover:bg-stone-50 text-stone-600"
                  }`}
                >
                  <span className="text-[9px] font-bold uppercase tracking-wide opacity-70">
                    {dayLabel(d)}
                  </span>
                  <span className="text-sm font-extrabold leading-none">{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          <button onClick={() => navigate(1)} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors duration-150 shrink-0">
            <ChevronRight className="w-4 h-4 text-stone-500" />
          </button>
        </div>

        {/* Selected date label */}
        <p className="text-center text-[10px] text-stone-400 font-semibold mt-2">
          {isSameDay(selectedDate, today) ? "Hôm nay · " : ""}{dayLabel(selectedDate)}, {formatVN(selectedDate)}
        </p>
      </div>

      {/* ── Timeline ── */}
      <div className="overflow-y-auto max-h-[480px]">
        {loading ? (
          <div className="py-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto" />
            <p className="text-xs text-stone-400 mt-2">Đang tải lịch...</p>
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {HOURS.map((hour) => {
              const slotBookings = bookingsAtHour(hour);
              const hasBookings = slotBookings.length > 0;

              return (
                <div key={hour} className={`flex gap-0 ${hasBookings ? "" : "opacity-40"}`}>
                  {/* Time label */}
                  <div className="w-14 shrink-0 flex items-start justify-end pr-3 pt-3">
                    <span className="text-[10px] font-bold text-stone-400">{hour}</span>
                  </div>

                  {/* Slot content */}
                  <div className={`flex-1 min-h-[48px] py-2 pr-4 ${hasBookings ? "border-l-2 border-primary/40" : "border-l border-stone-100"}`}>
                    {slotBookings.length === 0 ? (
                      <div className="h-6 flex items-center">
                        <span className="text-[10px] text-stone-300 ml-3">Trống</span>
                      </div>
                    ) : (
                      <div className="space-y-2 ml-3">
                        {slotBookings.map((b) => {
                          const cfg = STATUS_CONFIG[b.status];
                          return (
                            <button
                              key={b._id}
                              onClick={() => setSelected(b._id === selected?._id ? null : b)}
                              className={`w-full text-left rounded-xl border px-3 py-2.5 transition-all duration-150 ${cfg.bg} ${
                                selected?._id === b._id ? "ring-2 ring-primary/30" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`w-2 h-2 rounded-full shrink-0 ${cfg.color}`} />
                                  <span className="font-bold text-stone-800 text-xs truncate">{b.name}</span>
                                  <span className={`text-[9px] font-bold ${cfg.text} shrink-0`}>{b.time}</span>
                                </div>
                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text} border ${cfg.bg.includes("border") ? "" : "border-current/20"}`}>
                                  {cfg.label}
                                </span>
                              </div>

                              {/* Expanded detail */}
                              {selected?._id === b._id && (
                                <div className="mt-2.5 space-y-1.5 border-t border-current/10 pt-2.5">
                                  <div className="flex items-center gap-1.5 text-[10px] text-stone-600">
                                    <Phone className="w-3 h-3 text-stone-400" />
                                    <a href={`tel:${b.phone}`} className="font-semibold hover:text-primary">{b.phone}</a>
                                  </div>
                                  {b.services?.length > 0 && (
                                    <p className="text-[10px] text-stone-500 leading-snug">
                                      💅 {b.services.join(" · ")}
                                    </p>
                                  )}
                                  {b.note && (
                                    <p className="text-[10px] text-stone-400 italic">📝 {b.note}</p>
                                  )}

                                  {/* Action buttons */}
                                  {b.status === "pending" && (
                                    <div className="flex gap-2 pt-1">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onUpdateStatus(b._id, "confirmed"); setSelected(null); fetchDay(selectedDate); }}
                                        className="flex-1 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors duration-150"
                                      >
                                        <CheckCircle className="w-3 h-3" /> Xác nhận
                                      </button>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); onUpdateStatus(b._id, "cancelled"); setSelected(null); fetchDay(selectedDate); }}
                                        className="flex-1 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors duration-150"
                                      >
                                        <XCircle className="w-3 h-3" /> Hủy
                                      </button>
                                    </div>
                                  )}
                                  {b.status === "confirmed" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); onUpdateStatus(b._id, "completed"); setSelected(null); fetchDay(selectedDate); }}
                                      className="w-full py-1.5 bg-stone-500 hover:bg-stone-600 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 transition-colors duration-150"
                                    >
                                      <CheckCircle className="w-3 h-3" /> Hoàn thành
                                    </button>
                                  )}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Summary footer ── */}
      {!loading && (
        <div className="px-5 py-3 border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400">
          <span>{bookings.length} lịch hẹn</span>
          <div className="flex gap-3">
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
              const count = bookings.filter(b => b.status === key).length;
              if (!count) return null;
              return (
                <span key={key} className="flex items-center gap-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${cfg.color}`} />
                  {cfg.label}: {count}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingCalendar;
