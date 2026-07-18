import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar, Clock, User, Phone, Clipboard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";

const TIME_SLOTS = [
  "08:00", "09:00", "10:00", "11:00", "12:00", "13:00", 
  "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
];

interface ServiceItem {
  _id: string;
  name: string;
  category: string;
  duration: number;
}

const Booking = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    date: "",
    time: "",
    note: ""
  });
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const res = await fetch(`${API_BASE}/services`);
        if (res.ok) {
          const data = await res.json();
          setServices(data);
        }
      } catch (err) {
        console.error("Lỗi nạp dịch vụ:", err);
      }
    };
    fetchServices();
  }, []);

  const toggleService = (srvName: string) => {
    if (selectedServices.includes(srvName)) {
      setSelectedServices(selectedServices.filter(s => s !== srvName));
    } else {
      setSelectedServices([...selectedServices, srvName]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, phone, date, time } = formData;

    if (!name.trim() || !phone.trim() || !date || !time) {
      toast.warning("Vui lòng điền đầy đủ Tên, Số điện thoại, Ngày và Giờ đặt lịch");
      return;
    }

    if (selectedServices.length === 0) {
      toast.warning("Vui lòng chọn ít nhất 1 dịch vụ");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/bookings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          services: selectedServices,
          date,
          time,
          note: formData.note
        })
      });

      const data = await res.json();

      if (!res.ok) {
        // Overlap/capacity conflict reported by server
        toast.error(data.message || "Không thể đặt lịch ở thời gian này");
        setLoading(false);
        return;
      }

      toast.success("Đặt lịch thành công! Cửa hàng sẽ liên hệ xác nhận sớm nhất.");
      navigate("/");
    } catch (err) {
      toast.error("Đã xảy ra lỗi khi đặt lịch, vui lòng gọi hotline 035 836 7919");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getMinDateString = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">

      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl shadow-stone-100 p-6 border border-border z-10">
        {/* Navigation Bar */}
        <div className="flex items-center gap-3 mb-6">
          <Link to="/" className="p-2 hover:bg-stone-50 rounded-full transition text-stone-600">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <span className="font-serif font-semibold text-lg text-stone-900">Đặt Lịch Hẹn Hò</span>
        </div>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-serif text-[#9E5E6F] font-bold mb-1">Hẹn Lịch Làm Đẹp</h2>
          <p className="text-xs text-stone-400">Điền thông tin — em sẽ liên hệ xác nhận cho bạn sớm nhất! 🌸</p>
          <div className="flex justify-center flex-wrap gap-2 mt-2">
            <span className="text-[10px] text-stone-400 flex items-center gap-1">
              <svg className="w-3 h-3 text-[#9E5E6F]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              64 Linh Trung, Linh Xuân, TP.HCM
            </span>
            <span className="text-[10px] text-stone-400 flex items-center gap-1">
              <svg className="w-3 h-3 text-[#9E5E6F]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 11a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.06 0h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 7.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21 15z"/></svg>
              035 836 7919
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Name */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Họ tên của bạn *</label>
            <div className="relative">
              <input
                type="text"
                name="name"
                required
                placeholder="Nhập họ tên đầy đủ"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-xs"
              />
              <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Customer Phone */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Số điện thoại liên hệ *</label>
            <div className="relative">
              <input
                type="tel"
                name="phone"
                required
                placeholder="Nhập số điện thoại nhận xác nhận"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-xs"
              />
              <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Date Picker */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Chọn ngày hẹn *</label>
            <div className="relative">
              <input
                type="date"
                name="date"
                required
                min={getMinDateString()}
                value={formData.date}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-xs"
              />
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Time Picker */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Chọn giờ hẹn *</label>
            <div className="relative">
              <select
                name="time"
                required
                value={formData.time}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-xs appearance-none font-semibold"
              >
                <option value="">-- Chọn khung giờ hẹn --</option>
                {TIME_SLOTS.map((slot, idx) => (
                  <option key={idx} value={slot}>{slot}</option>
                ))}
              </select>
              <Clock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Multi-select Services */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1.5">Chọn dịch vụ làm đẹp *</label>
            <div className="max-h-36 overflow-y-auto border border-stone-200 rounded-xl p-3 bg-stone-50/50 space-y-2">
              {services.map((srv) => {
                const isSelected = selectedServices.includes(srv.name);
                return (
                  <label key={srv._id} className="flex items-center justify-between gap-2.5 text-xs text-stone-750 cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleService(srv.name)}
                        className="rounded border-stone-300 text-[#9E5E6F] focus:ring-[#9E5E6F] w-4 h-4"
                      />
                      <span className="font-medium">{srv.name}</span>
                    </div>
                    <span className="text-[10px] text-stone-400 font-semibold italic shrink-0">({srv.duration}p)</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Ghi chú thêm (Không bắt buộc)</label>
            <div className="relative">
              <textarea
                name="note"
                rows={2}
                placeholder="Yêu cầu thợ làm, lưu ý..."
                value={formData.note}
                onChange={handleInputChange}
                className="w-full pl-10 pr-4 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#9E5E6F] focus:border-transparent text-xs"
              />
              <Clipboard className="w-4 h-4 text-stone-400 absolute left-3 top-4" />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#9E5E6F] hover:bg-[#8D5060] disabled:bg-stone-300 text-white font-semibold rounded-xl text-xs shadow-sm transition duration-200 transform active:scale-95"
          >
            {loading ? "Đang gửi đăng ký..." : "Gửi thông tin đặt lịch"}
            <Sparkles className="w-4 h-4 text-white/90" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Booking;
