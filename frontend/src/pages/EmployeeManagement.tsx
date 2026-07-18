import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Save, Edit2, Trash, RefreshCw, Scissors, Landmark, Percent, Send, CheckCircle, Camera, Bot, Info, MessageSquare, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";
import { compressAvatar, compressQRImage, getBase64SizeKB } from "../lib/imageUtils";

interface Employee {
  _id: string;
  name: string;
  phone: string;
  role: string;
  pin: string;
  status: "active" | "inactive";
  avatar?: string;
  bio?: string;
}

interface Service {
  _id: string;
  name: string;
  price: number;
  category: "nails" | "eyelashes" | "washing" | "makeup";
  duration: number;
  description?: string;
}

interface BankAccount {
  _id: string;
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  displayName: string;
  qrImageBase64?: string;
}

interface SettingsData {
  pointRewardRate: number;
  telegramBotToken: string;
  telegramChatId: string;
  telegramNotificationsEnabled: boolean;
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  salonHours: string;
  googleMapsUrl: string;
  facebookUrl: string;
  welcomeMessages: string[];
}

const CATEGORY_LABEL: Record<string, string> = {
  nails: "💅 Nails",
  eyelashes: "✨ Nối Mi",
  washing: "🧴 Gội Đầu",
  makeup: "💄 Makeup",
};

const BANK_OPTIONS = [
  { id: "mbbank", name: "MB Bank" },
  { id: "vietcombank", name: "Vietcombank" },
  { id: "techcombank", name: "Techcombank" },
  { id: "bidv", name: "BIDV" },
  { id: "vietinbank", name: "Vietinbank" },
  { id: "tpbank", name: "TPBank" },
  { id: "acb", name: "ACB" },
  { id: "vpbank", name: "VPBank" },
];

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"staff" | "services" | "banks" | "settings">("staff");
  const [loading, setLoading] = useState(true);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<SettingsData>({
    pointRewardRate: 10,
    telegramBotToken: "",
    telegramChatId: "",
    telegramNotificationsEnabled: false,
    salonName: "EM Beauty Nails & Makeup",
    salonPhone: "035 836 7919",
    salonAddress: "64 Linh Trung, Linh Xuân, TP.HCM",
    salonHours: "08:00 - 20:30",
    googleMapsUrl: "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
    facebookUrl: "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
    welcomeMessages: [],
  });
  const [newVibe, setNewVibe] = useState("");

  // Employee form
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({ name: "", phone: "", pin: "", role: "staff", bio: "", avatar: "" });

  // Service form
  const [editingSrvId, setEditingSrvId] = useState<string | null>(null);
  const [srvForm, setSrvForm] = useState({ name: "", price: "", category: "nails" as Service["category"], duration: "60", description: "" });

  // Bank form
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState({ bankId: "mbbank", bankName: "MB Bank", accountNumber: "", accountHolder: "", displayName: "", qrImageBase64: "" });

  // Admin check
  useEffect(() => {
    const raw = localStorage.getItem("embeauty_session");
    if (!raw) { navigate("/staff"); return; }
    const s = JSON.parse(raw);
    if (s.role !== "admin") {
      toast.error("Chỉ quản trị viên mới có quyền truy cập");
      navigate("/employee/dashboard");
    }
  }, [navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, srvRes, bankRes, settRes] = await Promise.all([
        fetch(`${API_BASE}/employees`),
        fetch(`${API_BASE}/services`),
        fetch(`${API_BASE}/bank-accounts`),
        fetch(`${API_BASE}/settings`),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (srvRes.ok) setServices(await srvRes.json());
      if (bankRes.ok) setBankAccounts(await bankRes.json());
      if (settRes.ok) {
        const s = await settRes.json();
        setSettings({
          pointRewardRate: s.pointRewardRate || 10,
          telegramBotToken: s.telegramBotToken || "",
          telegramChatId: s.telegramChatId || "",
          telegramNotificationsEnabled: s.telegramNotificationsEnabled || false,
          salonName: s.salonName || "EM Beauty Nails & Makeup",
          salonPhone: s.salonPhone || "035 836 7919",
          salonAddress: s.salonAddress || "64 Linh Trung, Linh Xuân, TP.HCM",
          salonHours: s.salonHours || "08:00 - 20:30",
          googleMapsUrl: s.googleMapsUrl || "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
          facebookUrl: s.facebookUrl || "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
          welcomeMessages: s.welcomeMessages || [],
        });
      }
    } catch { toast.error("Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── Avatar upload ─────────────────────────────────────────────────────────
  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Ảnh quá lớn (tối đa 5MB gốc)"); return; }
    try {
      toast.info("Đang nén ảnh...");
      const compressed = await compressAvatar(file);
      const sizeKB = getBase64SizeKB(compressed);
      setEmpForm(f => ({ ...f, avatar: compressed }));
      toast.success(`Ảnh đã nén: ~${sizeKB}KB`);
    } catch { toast.error("Không thể xử lý ảnh"); }
  };

  // ── QR image upload ───────────────────────────────────────────────────────
  const handleQRFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 6 * 1024 * 1024) { toast.error("Ảnh quá lớn (tối đa 6MB gốc)"); return; }
    try {
      toast.info("Đang nén ảnh QR...");
      const compressed = await compressQRImage(file);
      const sizeKB = getBase64SizeKB(compressed);
      setBankForm(f => ({ ...f, qrImageBase64: compressed }));
      toast.success(`Ảnh QR đã nén: ~${sizeKB}KB`);
    } catch { toast.error("Không thể xử lý ảnh QR"); }
  };

  // ── Employee CRUD ─────────────────────────────────────────────────────────
  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.phone || !empForm.pin) { toast.warning("Điền đủ Tên, SĐT và PIN"); return; }
    try {
      const url = editingEmpId ? `${API_BASE}/employees/${editingEmpId}` : `${API_BASE}/employees`;
      const method = editingEmpId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empForm),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success(editingEmpId ? "Cập nhật nhân viên thành công" : "Thêm nhân viên mới thành công");
      setEmpForm({ name: "", phone: "", pin: "", role: "staff", bio: "", avatar: "" });
      setEditingEmpId(null);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi lưu nhân viên"); }
  };

  const handleEditEmp = (emp: Employee) => {
    setEditingEmpId(emp._id);
    setEmpForm({ name: emp.name, phone: emp.phone, pin: emp.pin, role: emp.role, bio: emp.bio || "", avatar: emp.avatar || "" });
  };

  const handleDeleteEmp = async (id: string) => {
    if (!confirm("Vô hiệu hóa nhân viên này?")) return;
    await fetch(`${API_BASE}/employees/${id}`, { method: "DELETE" });
    toast.success("Đã vô hiệu hóa nhân viên");
    fetchAll();
  };

  // ── Service CRUD ──────────────────────────────────────────────────────────
  const handleSrvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvForm.name || !srvForm.price || !srvForm.duration) { toast.warning("Điền đủ thông tin dịch vụ"); return; }
    try {
      const url = editingSrvId ? `${API_BASE}/services/${editingSrvId}` : `${API_BASE}/services`;
      const method = editingSrvId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...srvForm, price: Number(srvForm.price), duration: Number(srvForm.duration) }),
      });
      if (!res.ok) throw new Error();
      toast.success(editingSrvId ? "Cập nhật dịch vụ thành công" : "Thêm dịch vụ mới");
      setSrvForm({ name: "", price: "", category: "nails", duration: "60", description: "" });
      setEditingSrvId(null);
      fetchAll();
    } catch { toast.error("Lỗi lưu dịch vụ"); }
  };

  const handleEditSrv = (s: Service) => {
    setEditingSrvId(s._id);
    setSrvForm({ name: s.name, price: String(s.price), category: s.category, duration: String(s.duration), description: s.description || "" });
  };

  const handleDeleteSrv = async (id: string) => {
    if (!confirm("Xóa dịch vụ này?")) return;
    await fetch(`${API_BASE}/services/${id}`, { method: "DELETE" });
    toast.success("Đã xóa dịch vụ");
    fetchAll();
  };

  // ── Bank CRUD ─────────────────────────────────────────────────────────────
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.accountHolder || !bankForm.displayName) {
      toast.warning("Điền đủ thông tin tài khoản");
      return;
    }
    try {
      const url = editingBankId ? `${API_BASE}/bank-accounts/${editingBankId}` : `${API_BASE}/bank-accounts`;
      const method = editingBankId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      if (!res.ok) throw new Error();
      toast.success(editingBankId ? "Cập nhật tài khoản thành công" : "Thêm tài khoản thành công");
      setBankForm({ bankId: "mbbank", bankName: "MB Bank", accountNumber: "", accountHolder: "", displayName: "", qrImageBase64: "" });
      setEditingBankId(null);
      fetchAll();
    } catch { toast.error("Lỗi lưu tài khoản ngân hàng"); }
  };

  const handleEditBank = (b: BankAccount) => {
    setEditingBankId(b._id);
    setBankForm({
      bankId: b.bankId, bankName: b.bankName, accountNumber: b.accountNumber,
      accountHolder: b.accountHolder, displayName: b.displayName, qrImageBase64: b.qrImageBase64 || ""
    });
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Xóa tài khoản này?")) return;
    await fetch(`${API_BASE}/bank-accounts/${id}`, { method: "DELETE" });
    toast.success("Đã xóa tài khoản");
    fetchAll();
  };

  // ── Settings save ─────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success("Lưu cấu hình thành công!");
    } catch { toast.error("Lỗi lưu cấu hình"); }
  };

  const handleTestTelegram = async () => {
    try {
      const saveRes = await fetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!saveRes.ok) throw new Error("Lưu cấu hình thất bại");

      const res = await fetch(`${API_BASE}/settings/telegram-test`, { method: "POST" });
      const data = await res.json();
      if (data.success) toast.success(data.message);
      else toast.error(data.message);
    } catch (err: any) { toast.error(err.message || "Lỗi kiểm tra Telegram"); }
  };

  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  const TABS = [
    { key: "staff", label: "👤 Nhân Viên" },
    { key: "services", label: "💅 Dịch Vụ" },
    { key: "banks", label: "🏦 Tài Khoản QR" },
    { key: "settings", label: "⚙️ Cấu Hình" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-12">
      {/* Header */}
      <div className="bg-[#9E5E6F] text-white py-4 px-5 flex items-center justify-between shadow-md sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <Link to="/employee/dashboard" className="p-1.5 hover:bg-white/15 rounded-full transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-serif text-base font-bold">Quản Trị Cửa Hàng</h1>
        </div>
        <button onClick={fetchAll} className="p-1.5 hover:bg-white/15 rounded-full transition">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 mt-5">
        <div className="flex gap-1 bg-stone-100 rounded-2xl p-1 border border-stone-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 px-2 rounded-xl text-[10px] font-bold transition ${activeTab === tab.key ? "bg-white text-[#9E5E6F] shadow-sm" : "text-stone-500 hover:text-stone-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#9E5E6F] mx-auto mb-2"></div>
            <p className="text-xs text-stone-400">Đang tải...</p>
          </div>
        ) : (
          <div className="mt-5">

            {/* ── Tab: Employees ── */}
            {activeTab === "staff" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Form */}
                <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <UserPlus className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    {editingEmpId ? "Cập nhật nhân viên" : "Thêm nhân viên mới"}
                  </h2>
                  <form onSubmit={handleEmpSubmit} className="space-y-3 text-xs">
                    {/* Avatar preview + upload */}
                    <div className="flex flex-col items-center gap-2 pb-3 border-b border-stone-100">
                      <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-stone-100 border-2 border-stone-200">
                        {empForm.avatar ? (
                          <img src={empForm.avatar} alt="Avatar" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-stone-300">
                            <Camera className="w-6 h-6" />
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => avatarFileRef.current?.click()}
                        className="text-[10px] font-bold text-[#9E5E6F] hover:underline flex items-center gap-1">
                        <Camera className="w-3 h-3" /> Tải ảnh đại diện
                      </button>
                      <input ref={avatarFileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarFileChange} />
                    </div>

                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên nhân viên *</label>
                      <input type="text" required placeholder="Nguyễn Thị A" value={empForm.name}
                        onChange={e => setEmpForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:ring-1 focus:ring-[#9E5E6F] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Số điện thoại *</label>
                      <input type="tel" required placeholder="09xxxxxxxx" value={empForm.phone}
                        onChange={e => setEmpForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">PIN đăng nhập (4 số) *</label>
                      <input type="password" maxLength={4} required placeholder="••••" value={empForm.pin}
                        onChange={e => setEmpForm(f => ({ ...f, pin: e.target.value.replace(/\D/g, "") }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold tracking-[0.4em] focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Quyền hạn</label>
                      <select value={empForm.role} onChange={e => setEmpForm(f => ({ ...f, role: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none">
                        <option value="staff">Nhân viên</option>
                        <option value="admin">Quản lý (Admin)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Giới thiệu / Chuyên môn</label>
                      <input type="text" placeholder="Chuyên viên Nails & Mi..." value={empForm.bio}
                        onChange={e => setEmpForm(f => ({ ...f, bio: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>

                    <div className="flex gap-2 pt-1">
                      {editingEmpId && (
                        <button type="button" onClick={() => { setEditingEmpId(null); setEmpForm({ name: "", phone: "", pin: "", role: "staff", bio: "", avatar: "" }); }}
                          className="flex-1 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold transition">Hủy</button>
                      )}
                      <button type="submit" className="flex-grow py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-bold transition flex items-center justify-center gap-1">
                        <Save className="w-3.5 h-3.5" /> Lưu
                      </button>
                    </div>
                  </form>
                </div>

                {/* Employee list */}
                <div className="md:col-span-3 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Danh sách nhân viên</h2>
                  <div className="space-y-2">
                    {employees.map(emp => (
                      <div key={emp._id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100 hover:border-stone-200 transition">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-stone-200 shrink-0">
                          {emp.avatar ? (
                            <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-400 text-xs font-bold bg-[#F9ECEF] text-[#9E5E6F]">
                              {emp.name.split(" ").map(w => w[0]).slice(-2).join("").toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-bold text-stone-800">{emp.name}</p>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${emp.role === "admin" ? "bg-purple-50 text-purple-700" : "bg-stone-100 text-stone-600"}`}>
                              {emp.role === "admin" ? "Admin" : "Staff"}
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${emp.status === "active" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                              {emp.status === "active" ? "Đang làm" : "Đã nghỉ"}
                            </span>
                          </div>
                          <p className="text-[10px] text-stone-400">{emp.phone} {emp.bio && `— ${emp.bio}`}</p>
                        </div>

                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEditEmp(emp)} className="p-1.5 hover:bg-white text-[#9E5E6F] rounded-lg transition">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {emp.status === "active" && (
                            <button onClick={() => handleDeleteEmp(emp._id)} className="p-1.5 hover:bg-white text-red-400 rounded-lg transition">
                              <Trash className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Services ── */}
            {activeTab === "services" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Form */}
                <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm h-fit">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    {editingSrvId ? "Cập nhật dịch vụ" : "Thêm dịch vụ mới"}
                  </h2>
                  <form onSubmit={handleSrvSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên dịch vụ *</label>
                      <input type="text" required placeholder="Ví dụ: Sơn gel nhũ cát" value={srvForm.name}
                        onChange={e => setSrvForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Đơn giá (đ) *</label>
                        <input type="number" required placeholder="120000" value={srvForm.price}
                          onChange={e => setSrvForm(f => ({ ...f, price: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Thời gian (phút) *</label>
                        <input type="number" required placeholder="60" value={srvForm.duration}
                          onChange={e => setSrvForm(f => ({ ...f, duration: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Danh mục</label>
                      <select value={srvForm.category} onChange={e => setSrvForm(f => ({ ...f, category: e.target.value as any }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none">
                        <option value="nails">💅 Nails (Móng)</option>
                        <option value="eyelashes">✨ Nối Mi (Eyelashes)</option>
                        <option value="washing">🧴 Gội Đầu &amp; Massage</option>
                        <option value="makeup">💄 Makeup</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Mô tả ngắn</label>
                      <input type="text" placeholder="Mô tả thêm (tùy chọn)" value={srvForm.description}
                        onChange={e => setSrvForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      {editingSrvId && (
                        <button type="button" onClick={() => { setEditingSrvId(null); setSrvForm({ name: "", price: "", category: "nails", duration: "60", description: "" }); }}
                          className="flex-1 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold">Hủy</button>
                      )}
                      <button type="submit" className="flex-grow py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-bold transition flex items-center justify-center gap-1">
                        <Save className="w-3.5 h-3.5" /> Lưu
                      </button>
                    </div>
                  </form>
                </div>

                {/* Services list with filter tabs + search */}
                <ServiceListPanel
                  services={services}
                  onEdit={handleEditSrv}
                  onDelete={handleDeleteSrv}
                  formatPrice={formatPrice}
                />
              </div>
            )}


            {/* ── Tab: Bank Accounts ── */}
            {activeTab === "banks" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Form */}
                <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm h-fit">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    {editingBankId ? "Cập nhật tài khoản" : "Thêm tài khoản QR"}
                  </h2>
                  <form onSubmit={handleBankSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Ngân hàng</label>
                      <select value={bankForm.bankId}
                        onChange={e => {
                          const opt = BANK_OPTIONS.find(b => b.id === e.target.value);
                          setBankForm(f => ({ ...f, bankId: e.target.value, bankName: opt?.name || "" }));
                        }}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none">
                        {BANK_OPTIONS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Số tài khoản *</label>
                      <input type="text" required placeholder="0358367919" value={bankForm.accountNumber}
                        onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono font-bold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Chủ tài khoản (VIẾT HOA, không dấu) *</label>
                      <input type="text" required placeholder="THAI NGOC QUYNH NHU" value={bankForm.accountHolder}
                        onChange={e => setBankForm(f => ({ ...f, accountHolder: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên gợi nhớ hiển thị *</label>
                      <input type="text" required placeholder="MB Bank (Quỳnh Như)" value={bankForm.displayName}
                        onChange={e => setBankForm(f => ({ ...f, displayName: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>

                    {/* Static QR upload */}
                    <div className="border-t border-stone-100 pt-3">
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">
                        Ảnh mã QR tĩnh (tùy chọn)
                        <span className="text-stone-300 font-normal"> — Nếu có, sẽ dùng thay VietQR tự động</span>
                      </label>
                      {bankForm.qrImageBase64 && (
                        <div className="relative mb-2 w-28">
                          <img src={bankForm.qrImageBase64} alt="QR Preview" className="w-28 h-28 object-contain rounded-xl border border-stone-200" />
                          <button type="button" onClick={() => setBankForm(f => ({ ...f, qrImageBase64: "" }))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold flex items-center justify-center">✕</button>
                        </div>
                      )}
                      <button type="button" onClick={() => qrFileRef.current?.click()}
                        className="text-[10px] text-[#9E5E6F] font-bold hover:underline flex items-center gap-1">
                        <QrIconInline /> {bankForm.qrImageBase64 ? "Thay ảnh QR" : "Tải ảnh QR lên"}
                      </button>
                      <input ref={qrFileRef} type="file" accept="image/*" className="hidden" onChange={handleQRFileChange} />
                    </div>

                    <div className="flex gap-2 pt-1">
                      {editingBankId && (
                        <button type="button" onClick={() => { setEditingBankId(null); setBankForm({ bankId: "mbbank", bankName: "MB Bank", accountNumber: "", accountHolder: "", displayName: "", qrImageBase64: "" }); }}
                          className="flex-1 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold">Hủy</button>
                      )}
                      <button type="submit" className="flex-grow py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-bold transition flex items-center justify-center gap-1">
                        <Save className="w-3.5 h-3.5" /> Lưu tài khoản
                      </button>
                    </div>
                  </form>
                </div>

                {/* Bank list */}
                <div className="md:col-span-3 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Tài khoản QR đã khai báo</h2>
                  <div className="space-y-3">
                    {bankAccounts.map(b => (
                      <div key={b._id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                        {/* QR Thumbnail */}
                        {b.qrImageBase64 && (
                          <img src={b.qrImageBase64} alt="QR" className="w-12 h-12 object-contain rounded-lg border border-stone-200 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#9E5E6F]">{b.displayName}</p>
                          <p className="text-[10px] text-stone-600 font-semibold">{b.bankName}</p>
                          <p className="text-[10px] text-stone-400 font-mono">STK: {b.accountNumber}</p>
                          <p className="text-[10px] text-stone-500 font-bold">{b.accountHolder}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => handleEditBank(b)} className="p-1.5 text-[#9E5E6F] hover:bg-white rounded-lg"><Edit2 className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDeleteBank(b._id)} className="p-1.5 text-red-400 hover:bg-white rounded-lg"><Trash className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Tab: Settings ── */}
            {activeTab === "settings" && (
              <div className="max-w-2xl mx-auto space-y-5">
                <form onSubmit={handleSaveSettings} className="space-y-5">
                  {/* Salon Information CMS */}
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-4">
                    <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider flex items-center gap-1.5 border-b border-stone-100 pb-2">
                      <Landmark className="w-3.5 h-3.5 text-primary" /> Thông tin hiển thị cửa hàng
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs">
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên Tiệm (Logo chính)</label>
                        <input type="text" value={settings.salonName}
                          onChange={e => setSettings(s => ({ ...s, salonName: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Số Điện Thoại</label>
                        <input type="text" value={settings.salonPhone}
                          onChange={e => setSettings(s => ({ ...s, salonPhone: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Địa Chỉ Hiển Thị</label>
                        <input type="text" value={settings.salonAddress}
                          onChange={e => setSettings(s => ({ ...s, salonAddress: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Giờ Mở Cửa (Hiển thị)</label>
                        <input type="text" value={settings.salonHours}
                          onChange={e => setSettings(s => ({ ...s, salonHours: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Đường dẫn Google Maps (Tùy chọn)</label>
                        <input type="text" value={settings.googleMapsUrl}
                          onChange={e => setSettings(s => ({ ...s, googleMapsUrl: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Đường dẫn Fanpage Facebook</label>
                        <input type="text" value={settings.facebookUrl}
                          onChange={e => setSettings(s => ({ ...s, facebookUrl: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  {/* Loyalty Points */}
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                    <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5 text-primary" /> Tích điểm thành viên
                    </h2>
                    <div className="flex items-center gap-3 text-xs">
                      <input type="number" min={1} max={100} value={settings.pointRewardRate}
                        onChange={e => setSettings(s => ({ ...s, pointRewardRate: Number(e.target.value) }))}
                        className="w-20 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-center font-bold focus:outline-none" />
                      <p className="text-stone-500">% giá trị hóa đơn → điểm tích lũy<br /><span className="text-[10px] text-stone-400">Ví dụ: 10% → Hóa đơn 200,000đ = 20 điểm</span></p>
                    </div>
                  </div>

                  {/* Telegram */}
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                    <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <Bot className="w-3.5 h-3.5 text-[#9E5E6F]" /> Thông báo Telegram Bot
                    </h2>
                    <p className="text-[10px] text-stone-400 mb-4 flex items-start gap-1">
                      <Info className="w-3 h-3 shrink-0 mt-0.5" />
                      Tạo bot tại @BotFather trên Telegram → Lấy Token → Gửi tin nhắn cho bot → Lấy Chat ID tại api.telegram.org/bot&#123;TOKEN&#125;/getUpdates
                    </p>

                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-3">
                        <label className="text-[10px] font-bold text-stone-500 shrink-0">Kích hoạt:</label>
                        <button type="button"
                          onClick={() => setSettings(s => ({ ...s, telegramNotificationsEnabled: !s.telegramNotificationsEnabled }))}
                          className={`relative w-10 h-5 rounded-full transition ${settings.telegramNotificationsEnabled ? "bg-[#9E5E6F]" : "bg-stone-200"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${settings.telegramNotificationsEnabled ? "left-5.5" : "left-0.5"}`} />
                        </button>
                        <span className={`text-[10px] font-bold ${settings.telegramNotificationsEnabled ? "text-[#9E5E6F]" : "text-stone-400"}`}>
                          {settings.telegramNotificationsEnabled ? "Đang bật" : "Đang tắt"}
                        </span>
                      </div>

                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Bot Token</label>
                        <input type="text" placeholder="123456789:ABCdefGHIjkl..." value={settings.telegramBotToken}
                          onChange={e => setSettings(s => ({ ...s, telegramBotToken: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-[10px] focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Chat ID (của bạn hoặc nhóm)</label>
                        <input type="text" placeholder="-1001234567890" value={settings.telegramChatId}
                          onChange={e => setSettings(s => ({ ...s, telegramChatId: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono text-[10px] focus:outline-none" />
                      </div>

                      <button type="button" onClick={handleTestTelegram}
                        className="flex items-center gap-2 px-4 py-2 bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 rounded-xl font-bold text-[10px] transition">
                        <Send className="w-3.5 h-3.5" /> Gửi tin nhắn thử nghiệm
                      </button>
                    </div>
                  </div>

                  {/* Welcome Messages (Gen-Z vibes for homepage) */}
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                    <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-primary" /> Câu chào trang chủ
                    </h2>
                    <p className="text-[10px] text-stone-400 mb-4">
                      Quản lý các câu hiển thị xoay vòng trên trang khách hàng. Thêm nhiều câu thoải mái — gen-Z vibe, gần gũi, có cả emoji!
                    </p>

                    {/* Existing messages */}
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {(settings.welcomeMessages || []).length === 0 ? (
                        <p className="text-[10px] text-stone-300 text-center py-3">Chưa có câu chào nào — thêm xuống nhé!</p>
                      ) : (
                        settings.welcomeMessages.map((msg, i) => (
                          <div key={i} className="flex items-start gap-2 bg-stone-50 rounded-xl px-3 py-2.5 group">
                            <p className="flex-1 text-[11px] text-stone-700 font-serif italic leading-snug">{msg}</p>
                            <button
                              type="button"
                              onClick={() => setSettings(s => ({ ...s, welcomeMessages: s.welcomeMessages.filter((_, idx) => idx !== i) }))}
                              className="p-0.5 text-stone-300 hover:text-red-400 transition-colors duration-150 shrink-0 mt-0.5"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Add new message */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Thêm câu mới... ví dụ: Nail xong selfie thôi! 💅"
                        value={newVibe}
                        onChange={e => setNewVibe(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const trimmed = newVibe.trim();
                            if (trimmed) {
                              setSettings(s => ({ ...s, welcomeMessages: [...(s.welcomeMessages || []), trimmed] }));
                              setNewVibe("");
                            }
                          }
                        }}
                        className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-[11px] focus:outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const trimmed = newVibe.trim();
                          if (trimmed) {
                            setSettings(s => ({ ...s, welcomeMessages: [...(s.welcomeMessages || []), trimmed] }));
                            setNewVibe("");
                          }
                        }}
                        className="px-3 py-2 bg-accent hover:bg-primary hover:text-white text-primary border border-border rounded-xl text-[11px] font-bold transition-colors duration-150 shrink-0 flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <button type="submit"
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-white font-bold rounded-xl text-xs transition-colors duration-150 flex items-center justify-center gap-2 shadow-md">
                    <Save className="w-4 h-4" /> Lưu toàn bộ cấu hình
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Inline QR icon to avoid import issues
const QrIconInline = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);

// ── Service List Panel with Tab Filter + Search ────────────────────────────────
interface ServiceListPanelProps {
  services: { _id: string; name: string; price: number; category: string; duration: number; description?: string }[];
  onEdit: (s: any) => void;
  onDelete: (id: string) => void;
  formatPrice: (p: number) => string;
}

const SRV_CAT_TABS = [
  { key: "all",       label: "Tất cả",    emoji: "🔖" },
  { key: "nails",     label: "Nails",     emoji: "💅" },
  { key: "eyelashes", label: "Nối Mi",    emoji: "✨" },
  { key: "washing",   label: "Gội Đầu",  emoji: "🧴" },
  { key: "makeup",    label: "Makeup",    emoji: "💄" },
] as const;

const CAT_COLORS: Record<string, string> = {
  nails:     "bg-rose-50 text-rose-700 border-rose-100",
  eyelashes: "bg-purple-50 text-purple-700 border-purple-100",
  washing:   "bg-teal-50 text-teal-700 border-teal-100",
  makeup:    "bg-pink-50 text-pink-700 border-pink-100",
};

const ServiceListPanel = ({ services, onEdit, onDelete, formatPrice }: ServiceListPanelProps) => {
  const [catFilter, setCatFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  const filtered = services.filter(s => {
    const matchCat = catFilter === "all" || s.category === catFilter;
    const matchSearch = search.trim() === "" || s.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const countFor = (cat: string) =>
    cat === "all" ? services.length : services.filter(s => s.category === cat).length;

  return (
    <div className="md:col-span-3 bg-white rounded-2xl border border-stone-200/60 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-stone-100 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            Dịch vụ
            <span className="ml-2 text-[#9E5E6F] font-extrabold">{filtered.length}</span>
            {filtered.length !== services.length && (
              <span className="text-stone-300 font-normal">/{services.length}</span>
            )}
          </h2>
          {(search || catFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setCatFilter("all"); }}
              className="text-[10px] text-stone-400 hover:text-[#9E5E6F] font-semibold transition"
            >
              Xóa bộ lọc ✕
            </button>
          )}
        </div>

        {/* Search bar */}
        <div className="relative">
          <svg className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Tìm kiếm dịch vụ..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#9E5E6F] placeholder:text-stone-300"
          />
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {SRV_CAT_TABS.map(tab => {
            const count = countFor(tab.key);
            const active = catFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setCatFilter(tab.key)}
                className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[10px] font-bold border transition-all ${
                  active
                    ? "bg-[#9E5E6F] border-[#9E5E6F] text-white shadow-sm"
                    : "bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <span>{tab.emoji}</span>
                <span>{tab.label}</span>
                <span className={`text-[9px] px-1 rounded-full font-extrabold ${active ? "bg-white/25 text-white" : "bg-stone-200 text-stone-500"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Services list */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: "520px" }}>
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-stone-400 italic">
            {search ? `Không tìm thấy dịch vụ cho "${search}"` : "Không có dịch vụ trong danh mục này"}
          </div>
        ) : (
          <div className="divide-y divide-stone-50">
            {filtered.map(s => (
              <div key={s._id} className="flex items-center gap-3 px-5 py-3 hover:bg-stone-50/70 transition group">
                {/* Category badge */}
                <span className={`shrink-0 text-[9px] font-bold px-2 py-1 rounded-lg border ${CAT_COLORS[s.category] || "bg-stone-50 text-stone-500 border-stone-100"}`}>
                  {SRV_CAT_TABS.find(t => t.key === s.category)?.emoji || ""}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate">{s.name}</p>
                  <p className="text-[10px] text-stone-400">{s.duration} phút</p>
                </div>

                {/* Price */}
                <span className="text-xs font-bold text-primary font-sans tabular-nums shrink-0 whitespace-nowrap">
                  {formatPrice(s.price)}
                </span>

                {/* Actions — always visible, not hover-only (touch users need access) */}
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => onEdit(s)}
                    className="p-1.5 text-primary hover:bg-accent rounded-lg transition-colors duration-150"
                    title="Sửa"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => onDelete(s._id)}
                    className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors duration-150"
                    title="Xóa"
                  >
                    <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;

