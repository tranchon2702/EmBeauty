import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, UserPlus, Save, Edit2, Trash, RefreshCw, Scissors, Landmark, Percent, Camera, MessageSquare, Plus, X, KeyRound, Tags, Gift, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, authFetch, getSession } from "../config";
import { compressAvatar, compressQRImage, getBase64SizeKB } from "../lib/imageUtils";
import { BankSelect } from "../components/BankSelect";
import { PaymentAccountLogo } from "../components/PaymentAccountLogo";
import { matchesVietnameseSearch } from "../lib/search";

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
  category: string;
  description?: string;
  isActive?: boolean;
  showOnMenu?: boolean;
  showInInvoice?: boolean;
}

interface Category {
  _id: string;
  key: string;
  name: string;
  icon: string;
  order: number;
}

interface BankAccount {
  _id: string;
  accountType?: "bank" | "momo";
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  displayName: string;
  qrImageBase64?: string;
}

interface BankFormState {
  accountType: "bank" | "momo";
  bankId: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  displayName: string;
  qrImageBase64: string;
}

interface RankSettings {
  silverMinPoints: number;
  goldMinPoints: number;
  diamondMinPoints: number;
  bronzeBenefits: string[];
  silverBenefits: string[];
  goldBenefits: string[];
  diamondBenefits: string[];
}

interface SettingsData {
  pointRewardRate: number;
  salonName: string;
  salonPhone: string;
  salonAddress: string;
  salonHours: string;
  googleMapsUrl: string;
  facebookUrl: string;
  welcomeMessages: string[];
  rankSettings: RankSettings;
}

const DEFAULT_RANK_SETTINGS: RankSettings = {
  silverMinPoints: 50,
  goldMinPoints: 100,
  diamondMinPoints: 200,
  bronzeBenefits: [],
  silverBenefits: [],
  goldBenefits: [],
  diamondBenefits: [],
};

/** The four loyalty tiers, in the order they are displayed to the customer. */
const RANK_TIERS = [
  { key: "bronze", label: "Đồng", icon: "🥉", tone: "bg-[#F4EAE0] border-[#E3D2C1] text-[#8D6E52]" },
  { key: "silver", label: "Bạc", icon: "🥈", tone: "bg-slate-50 border-slate-200 text-slate-700" },
  { key: "gold", label: "Vàng", icon: "🥇", tone: "bg-amber-50 border-amber-200 text-amber-800" },
  { key: "diamond", label: "Kim Cương", icon: "💎", tone: "bg-cyan-50 border-cyan-200 text-cyan-800" },
] as const;

type RankTierKey = typeof RANK_TIERS[number]["key"];

const benefitsKey = (tier: RankTierKey) => `${tier}Benefits` as keyof RankSettings;

const EMPTY_BANK_FORM: BankFormState = {
  accountType: "bank",
  bankId: "mbbank",
  bankName: "MB Bank",
  accountNumber: "",
  accountHolder: "",
  displayName: "",
  qrImageBase64: "",
};

// Bank options are now handled by BankSelect component (full list in vietnamBanks.ts)

const EmployeeManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"staff" | "services" | "categories" | "banks" | "settings">("staff");
  const [loading, setLoading] = useState(true);
  const avatarFileRef = useRef<HTMLInputElement>(null);
  const qrFileRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [settings, setSettings] = useState<SettingsData>({
    pointRewardRate: 10,
    salonName: "EM Beauty Nails & Makeup",
    salonPhone: "035 836 7919",
    salonAddress: "64 Linh Trung, Linh Xuân, TP.HCM",
    salonHours: "08:00 - 20:30",
    googleMapsUrl: "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
    facebookUrl: "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
    welcomeMessages: [],
    rankSettings: DEFAULT_RANK_SETTINGS,
  });
  const [newVibe, setNewVibe] = useState("");
  const [newBenefit, setNewBenefit] = useState<Record<string, string>>({});

  // Employee form
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({ name: "", phone: "", pin: "", role: "staff", bio: "", avatar: "" });

  // Service form
  const [editingSrvId, setEditingSrvId] = useState<string | null>(null);
  const [srvForm, setSrvForm] = useState({ name: "", price: "", category: "", description: "", isActive: true, showOnMenu: true, showInInvoice: true });

  // Category form
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState({ name: "", icon: "✨" });

  // Bank form
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
  const [bankForm, setBankForm] = useState<BankFormState>({ ...EMPTY_BANK_FORM });

  // Reset PIN modal
  const [resetPinEmpId, setResetPinEmpId] = useState<string | null>(null);
  const [resetPinName, setResetPinName] = useState("");
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetPinLoading, setResetPinLoading] = useState(false);


  useEffect(() => {
    const s = getSession();
    if (!s) { navigate("/staff"); return; }
    if (s.role !== "admin") {
      toast.error("Chỉ quản trị viên mới có quyền truy cập");
      navigate("/employee/dashboard");
    }
  }, [navigate]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, srvRes, catRes, bankRes, settRes] = await Promise.all([
        authFetch(`${API_BASE}/employees`),
        authFetch(`${API_BASE}/services`),
        authFetch(`${API_BASE}/categories`),
        authFetch(`${API_BASE}/bank-accounts`),
        authFetch(`${API_BASE}/settings`),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
      if (srvRes.ok) setServices(await srvRes.json());
      if (catRes.ok) {
        const cats: Category[] = await catRes.json();
        setCategories(cats);
        // Keep the service form pointing at a category that actually exists.
        setSrvForm(f => (f.category || cats.length === 0 ? f : { ...f, category: cats[0].key }));
      }
      if (bankRes.ok) setBankAccounts(await bankRes.json());
      if (settRes.ok) {
        const s = await settRes.json();
        setSettings({
          pointRewardRate: s.pointRewardRate ?? 10,
          salonName: s.salonName || "EM Beauty Nails & Makeup",
          salonPhone: s.salonPhone || "035 836 7919",
          salonAddress: s.salonAddress || "64 Linh Trung, Linh Xuân, TP.HCM",
          salonHours: s.salonHours || "08:00 - 20:30",
          googleMapsUrl: s.googleMapsUrl || "https://maps.app.goo.gl/DruZXXTrtSVBj6LW9",
          facebookUrl: s.facebookUrl || "https://www.facebook.com/thai.ngoc.quynh.nhu?locale=vi_VN",
          welcomeMessages: s.welcomeMessages || [],
          // Must be hydrated from the server: leaving it out made the form fall
          // back to defaults and silently overwrite the saved tiers on save.
          rankSettings: { ...DEFAULT_RANK_SETTINGS, ...(s.rankSettings || {}) },
        });
      }
    } catch { toast.error("Lỗi tải dữ liệu"); }
    finally { setLoading(false); }
  };

  // ── Rank settings helpers ─────────────────────────────────────────────────
  const patchRank = (patch: Partial<RankSettings>) =>
    setSettings(s => ({ ...s, rankSettings: { ...s.rankSettings, ...patch } }));

  const addBenefit = (tier: RankTierKey) => {
    const text = (newBenefit[tier] || "").trim();
    if (!text) return;
    const key = benefitsKey(tier);
    patchRank({ [key]: [...(settings.rankSettings[key] as string[]), text] } as Partial<RankSettings>);
    setNewBenefit(b => ({ ...b, [tier]: "" }));
  };

  const removeBenefit = (tier: RankTierKey, index: number) => {
    const key = benefitsKey(tier);
    const list = settings.rankSettings[key] as string[];
    patchRank({ [key]: list.filter((_, i) => i !== index) } as Partial<RankSettings>);
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
    // PIN only required for new employees
    if (!empForm.name || !empForm.phone) { toast.warning("Điền đủ Tên và SĐT"); return; }
    if (!editingEmpId && !empForm.pin) { toast.warning("Mã PIN là bắt buộc khi tạo nhân viên mới"); return; }
    try {
      const url = editingEmpId ? `${API_BASE}/employees/${editingEmpId}` : `${API_BASE}/employees`;
      const method = editingEmpId ? "PUT" : "POST";
      // When editing, don't send PIN (it's hashed and managed via reset-pin)
      const payload = editingEmpId
        ? { name: empForm.name, phone: empForm.phone, role: empForm.role, bio: empForm.bio, avatar: empForm.avatar }
        : empForm;
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
    setEmpForm({ name: emp.name, phone: emp.phone, pin: "", role: emp.role, bio: emp.bio || "", avatar: emp.avatar || "" });
  };

  const handleDeleteEmp = async (id: string) => {
    if (!confirm("Vô hiệu hóa nhân viên này?")) return;
    await authFetch(`${API_BASE}/employees/${id}`, { method: "DELETE" });
    toast.success("Đã vô hiệu hóa nhân viên");
    fetchAll();
  };

  // ── Reset PIN (admin) ─────────────────────────────────────────────────────
  const handleResetPin = async () => {
    if (!resetPinEmpId || !resetPinValue || resetPinValue.length !== 4) {
      toast.warning("Mã PIN mới phải là 4 chữ số");
      return;
    }
    setResetPinLoading(true);
    try {
      const res = await authFetch(`${API_BASE}/employees/${resetPinEmpId}/reset-pin`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPin: resetPinValue }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setResetPinEmpId(null);
      setResetPinName("");
      setResetPinValue("");
    } catch (err: any) {
      toast.error(err.message || "Lỗi đặt lại PIN");
    } finally {
      setResetPinLoading(false);
    }
  };

  // ── Service CRUD ──────────────────────────────────────────────────────────
  const blankSrvForm = () => ({
    name: "", price: "", category: categories[0]?.key || "", description: "",
    isActive: true, showOnMenu: true, showInInvoice: true,
  });

  const handleSrvSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvForm.name.trim()) { toast.warning("Nhập tên dịch vụ"); return; }
    if (srvForm.price === "" || Number(srvForm.price) < 0) { toast.warning("Đơn giá phải là số không âm"); return; }
    if (!srvForm.category) { toast.warning("Chọn danh mục cho dịch vụ"); return; }
    try {
      const url = editingSrvId ? `${API_BASE}/services/${editingSrvId}` : `${API_BASE}/services`;
      const res = await authFetch(url, {
        method: editingSrvId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...srvForm, price: Number(srvForm.price) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editingSrvId ? "Cập nhật dịch vụ thành công" : "Thêm dịch vụ mới");
      setSrvForm(blankSrvForm());
      setEditingSrvId(null);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi lưu dịch vụ"); }
  };

  const handleEditSrv = (s: Service) => {
    setEditingSrvId(s._id);
    setSrvForm({
      name: s.name,
      price: String(s.price),
      category: s.category,
      description: s.description || "",
      isActive: s.isActive !== false,
      showOnMenu: s.showOnMenu !== false,
      showInInvoice: s.showInInvoice !== false,
    });
  };

  const handleDeleteSrv = async (id: string) => {
    if (!confirm("Xóa hẳn dịch vụ này? Nếu chỉ muốn tạm ngừng bán, hãy dùng nút Ẩn.")) return;
    await authFetch(`${API_BASE}/services/${id}`, { method: "DELETE" });
    toast.success("Đã xóa dịch vụ");
    fetchAll();
  };

  /** Pause a service instead of deleting it — history and reports stay intact. */
  const handleToggleSrvActive = async (s: Service) => {
    const next = s.isActive === false;
    try {
      const res = await authFetch(`${API_BASE}/services/${s._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      if (!res.ok) throw new Error((await res.json()).message);
      toast.success(next ? `Đã hiện lại "${s.name}"` : `Đã tạm ẩn "${s.name}"`);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi cập nhật dịch vụ"); }
  };

  // ── Category CRUD ─────────────────────────────────────────────────────────
  const handleCatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catForm.name.trim()) { toast.warning("Nhập tên danh mục"); return; }
    try {
      const url = editingCatId ? `${API_BASE}/categories/${editingCatId}` : `${API_BASE}/categories`;
      const res = await authFetch(url, {
        method: editingCatId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catForm.name.trim(), icon: catForm.icon || "✨" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editingCatId ? "Đã cập nhật danh mục" : "Đã thêm danh mục");
      setCatForm({ name: "", icon: "✨" });
      setEditingCatId(null);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi lưu danh mục"); }
  };

  const handleDeleteCat = async (cat: Category) => {
    if (!confirm(`Xóa danh mục "${cat.name}"?`)) return;
    try {
      const res = await authFetch(`${API_BASE}/categories/${cat._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Đã xóa danh mục");
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi xóa danh mục"); }
  };

  // ── Bank CRUD ─────────────────────────────────────────────────────────────
  const handleBankSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankForm.accountNumber || !bankForm.accountHolder || !bankForm.displayName) {
      toast.warning("Điền đủ thông tin tài khoản");
      return;
    }
    if (bankForm.accountType === "momo" && !bankForm.qrImageBase64) {
      toast.warning("Ví MoMo cần tải ảnh mã QR nhận tiền");
      return;
    }
    try {
      const url = editingBankId ? `${API_BASE}/bank-accounts/${editingBankId}` : `${API_BASE}/bank-accounts`;
      const method = editingBankId ? "PUT" : "POST";
      const res = await authFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bankForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(editingBankId ? "Cập nhật tài khoản thành công" : "Thêm tài khoản thành công");
      setBankForm({ ...EMPTY_BANK_FORM });
      setEditingBankId(null);
      fetchAll();
    } catch (err: any) { toast.error(err.message || "Lỗi lưu tài khoản thanh toán"); }
  };

  const handleEditBank = (b: BankAccount) => {
    setEditingBankId(b._id);
    setBankForm({
      accountType: b.accountType === "momo" ? "momo" : "bank",
      bankId: b.bankId, bankName: b.bankName, accountNumber: b.accountNumber,
      accountHolder: b.accountHolder, displayName: b.displayName, qrImageBase64: b.qrImageBase64 || ""
    });
  };

  const handleDeleteBank = async (id: string) => {
    if (!confirm("Xóa tài khoản này?")) return;
    await authFetch(`${API_BASE}/bank-accounts/${id}`, { method: "DELETE" });
    toast.success("Đã xóa tài khoản");
    fetchAll();
  };

  // ── Settings save ─────────────────────────────────────────────────────────
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_BASE}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      // Adopt what the server actually stored, so the form never drifts.
      setSettings(s => ({ ...s, rankSettings: { ...DEFAULT_RANK_SETTINGS, ...(data.rankSettings || {}) } }));
      toast.success("Lưu cấu hình thành công!");
    } catch (err: any) { toast.error(err.message || "Lỗi lưu cấu hình"); }
  };

  const formatPrice = (p: number) => p.toLocaleString("vi-VN") + "đ";

  const TABS = [
    { key: "staff", label: "👤 Nhân Viên" },
    { key: "services", label: "💅 Dịch Vụ" },
    { key: "categories", label: "🏷️ Danh Mục" },
    { key: "banks", label: "💳 Thanh Toán QR" },
    { key: "settings", label: "⚙️ Cấu Hình" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#FDFBF7] overscroll-contain" style={{ paddingBottom: "env(safe-area-inset-bottom,0px)" }}>
      {/* Header */}
      <div
        className="bg-[#9E5E6F] text-white px-5 flex items-center justify-between shadow-md sticky top-0 z-20"
        style={{ paddingTop: "calc(env(safe-area-inset-top,0px) + 12px)", paddingBottom: "12px" }}
      >
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
                          <button onClick={() => handleEditEmp(emp)} className="p-1.5 hover:bg-white text-[#9E5E6F] rounded-lg transition" title="Chỉnh sửa">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setResetPinEmpId(emp._id); setResetPinName(emp.name); setResetPinValue(""); }}
                            className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-lg transition"
                            title="Đặt lại PIN"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {emp.status === "active" && (
                            <button onClick={() => handleDeleteEmp(emp._id)} className="p-1.5 hover:bg-white text-red-400 rounded-lg transition" title="Vô hiệu hóa">
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
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Đơn giá (đ) *</label>
                      <input type="number" required min={0} placeholder="120000" value={srvForm.price}
                        onChange={e => setSrvForm(f => ({ ...f, price: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                      <p className="text-[9px] text-stone-300 mt-1">Có thể đặt 0đ cho dịch vụ tặng kèm / khuyến mãi</p>
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Danh mục *</label>
                      {categories.length === 0 ? (
                        <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                          Chưa có danh mục nào — hãy tạo ở tab “Danh Mục” trước.
                        </p>
                      ) : (
                        <select value={srvForm.category} onChange={e => setSrvForm(f => ({ ...f, category: e.target.value }))}
                          className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none">
                          {categories.map(c => (
                            <option key={c._id} value={c.key}>{c.icon} {c.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Mô tả ngắn</label>
                      <input type="text" placeholder="Mô tả thêm (tùy chọn)" value={srvForm.description}
                        onChange={e => setSrvForm(f => ({ ...f, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>
                    {/* Visibility toggles */}
                    <div className="space-y-2 pt-1">
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Hiển thị</p>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setSrvForm(f => ({ ...f, isActive: !f.isActive }))}
                          aria-pressed={srvForm.isActive}
                          aria-label="Bật hoặc tắt dịch vụ ở mọi nơi"
                          className={`relative w-10 h-5 rounded-full transition shrink-0 ${srvForm.isActive ? "bg-emerald-500" : "bg-stone-300"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${srvForm.isActive ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                        <span className="text-[10px] font-bold text-stone-500">
                          {srvForm.isActive ? "✅ Đang hoạt động" : "⛔ Tạm ngừng (ẩn mọi nơi)"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setSrvForm(f => ({ ...f, showOnMenu: !f.showOnMenu }))}
                          aria-pressed={srvForm.showOnMenu}
                          aria-label="Hiển thị dịch vụ trên menu khách"
                          className={`relative w-10 h-5 rounded-full transition shrink-0 ${srvForm.showOnMenu ? "bg-blue-500" : "bg-stone-300"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${srvForm.showOnMenu ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                        <span className="text-[10px] text-stone-500">
                          <span className="font-bold">📋 Menu khách</span> — hiện trên bảng giá công khai
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button"
                          onClick={() => setSrvForm(f => ({ ...f, showInInvoice: !f.showInInvoice }))}
                          aria-pressed={srvForm.showInInvoice}
                          aria-label="Hiển thị dịch vụ khi lập hóa đơn"
                          className={`relative w-10 h-5 rounded-full transition shrink-0 ${srvForm.showInInvoice ? "bg-violet-500" : "bg-stone-300"}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${srvForm.showInInvoice ? "left-[22px]" : "left-0.5"}`} />
                        </button>
                        <span className="text-[10px] text-stone-500">
                          <span className="font-bold">🧾 Lập hóa đơn</span> — hiện khi nhân viên tạo bill
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      {editingSrvId && (
                        <button type="button" onClick={() => { setEditingSrvId(null); setSrvForm(blankSrvForm()); }}
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
                  categories={categories}
                  onEdit={handleEditSrv}
                  onDelete={handleDeleteSrv}
                  onToggleActive={handleToggleSrvActive}
                  formatPrice={formatPrice}
                />
              </div>
            )}

            {/* ── Tab: Categories ── */}
            {activeTab === "categories" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Form */}
                <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm h-fit">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    {editingCatId ? "Cập nhật danh mục" : "Thêm danh mục mới"}
                  </h2>
                  <form onSubmit={handleCatSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên danh mục *</label>
                      <input type="text" required placeholder="Ví dụ: Chăm sóc da"
                        value={catForm.name}
                        onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Biểu tượng</label>
                      <div className="flex gap-2 items-center">
                        <input type="text" maxLength={4} value={catForm.icon}
                          onChange={e => setCatForm(f => ({ ...f, icon: e.target.value }))}
                          className="w-16 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-center text-base focus:outline-none" />
                        <div className="flex flex-wrap gap-1">
                          {["💅", "✨", "🧴", "💄", "🌸", "💆", "🧖", "👣"].map(emoji => (
                            <button key={emoji} type="button"
                              onClick={() => setCatForm(f => ({ ...f, icon: emoji }))}
                              className="w-7 h-7 rounded-lg bg-stone-50 hover:bg-[#F9ECEF] border border-stone-200 text-sm transition">
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-stone-400 bg-stone-50 rounded-xl p-2.5 leading-relaxed">
                      Danh mục hiển thị trên bảng giá khách xem và màn hình lập hóa đơn.
                      Không thể xóa danh mục đang có dịch vụ.
                    </p>
                    <div className="flex gap-2 pt-1">
                      {editingCatId && (
                        <button type="button"
                          onClick={() => { setEditingCatId(null); setCatForm({ name: "", icon: "✨" }); }}
                          className="flex-1 py-2 bg-stone-100 text-stone-600 rounded-xl font-bold">Hủy</button>
                      )}
                      <button type="submit" className="flex-grow py-2 bg-[#9E5E6F] hover:bg-[#8D5060] text-white rounded-xl font-bold transition flex items-center justify-center gap-1">
                        <Save className="w-3.5 h-3.5" /> Lưu danh mục
                      </button>
                    </div>
                  </form>
                </div>

                {/* Category list */}
                <div className="md:col-span-3 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">
                    Danh mục dịch vụ <span className="text-[#9E5E6F] font-extrabold ml-1">{categories.length}</span>
                  </h2>
                  {categories.length === 0 ? (
                    <p className="text-xs text-stone-400 italic py-8 text-center">Chưa có danh mục nào</p>
                  ) : (
                    <div className="space-y-2">
                      {categories.map(cat => {
                        const count = services.filter(s => s.category === cat.key).length;
                        return (
                          <div key={cat._id} className="flex items-center gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                            <span className="text-xl shrink-0">{cat.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-stone-800">{cat.name}</p>
                              <p className="text-[10px] text-stone-400 font-mono">{cat.key} • {count} dịch vụ</p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => { setEditingCatId(cat._id); setCatForm({ name: cat.name, icon: cat.icon }); }}
                                className="p-1.5 text-[#9E5E6F] hover:bg-white rounded-lg transition" title="Sửa">
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteCat(cat)}
                                disabled={count > 0}
                                title={count > 0 ? `Còn ${count} dịch vụ trong danh mục này` : "Xóa"}
                                className="p-1.5 text-red-400 hover:bg-white rounded-lg transition disabled:opacity-25 disabled:cursor-not-allowed">
                                <Trash className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* ── Tab: Bank Accounts ── */}
            {activeTab === "banks" && (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
                {/* Form */}
                <div className="md:col-span-2 bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm h-fit">
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                    <Landmark className="w-3.5 h-3.5 text-[#9E5E6F]" />
                    {editingBankId ? "Cập nhật tài khoản" : "Thêm tài khoản thanh toán"}
                  </h2>
                  <form onSubmit={handleBankSubmit} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1.5">Loại tài khoản *</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setBankForm({ ...EMPTY_BANK_FORM })}
                          className={`min-h-12 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                            bankForm.accountType === "bank"
                              ? "bg-[#F9ECEF] border-[#9E5E6F] text-[#9E5E6F]"
                              : "bg-stone-50 border-stone-200 text-stone-500"
                          }`}
                        >
                          <Landmark className="w-4 h-4" /> Ngân hàng
                        </button>
                        <button
                          type="button"
                          onClick={() => setBankForm({
                            ...EMPTY_BANK_FORM,
                            accountType: "momo",
                            bankId: "momo",
                            bankName: "MoMo",
                            displayName: "Ví MoMo",
                          })}
                          className={`min-h-12 rounded-xl border flex items-center justify-center gap-2 font-bold transition ${
                            bankForm.accountType === "momo"
                              ? "bg-[#FCE6F2] border-[#A50064] text-[#A50064]"
                              : "bg-stone-50 border-stone-200 text-stone-500"
                          }`}
                        >
                          <PaymentAccountLogo accountType="momo" bankId="momo" name="MoMo" className="w-8 h-8" />
                          Ví MoMo
                        </button>
                      </div>
                    </div>
                    {bankForm.accountType === "bank" ? (
                      <div>
                        <label className="text-[10px] text-stone-400 font-bold block mb-1">Ngân hàng</label>
                        <BankSelect
                          value={bankForm.bankId}
                          onChange={(id, name) => setBankForm(f => ({ ...f, bankId: id, bankName: name }))}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-[#F1B4D2] bg-[#FFF5FA] p-3 flex items-center gap-3">
                        <PaymentAccountLogo accountType="momo" bankId="momo" name="MoMo" className="w-11 h-11" />
                        <div>
                          <p className="font-bold text-[#A50064]">Ví MoMo</p>
                          <p className="text-[10px] text-stone-500">Nhập số điện thoại và tải QR nhận tiền của ví.</p>
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">
                        {bankForm.accountType === "momo" ? "Số điện thoại Ví MoMo *" : "Số tài khoản *"}
                      </label>
                      <input type="text" required placeholder={bankForm.accountType === "momo" ? "0901234567" : "0358367919"} value={bankForm.accountNumber}
                        onChange={e => setBankForm(f => ({ ...f, accountNumber: e.target.value.replace(/\D/g, "") }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-mono font-bold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">
                        {bankForm.accountType === "momo" ? "Tên chủ Ví MoMo *" : "Chủ tài khoản (VIẾT HOA, không dấu) *"}
                      </label>
                      <input type="text" required placeholder="THAI NGOC QUYNH NHU" value={bankForm.accountHolder}
                        onChange={e => setBankForm(f => ({ ...f, accountHolder: e.target.value.toUpperCase() }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl font-bold focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">Tên gợi nhớ hiển thị *</label>
                      <input type="text" required placeholder={bankForm.accountType === "momo" ? "Ví MoMo (Quỳnh Như)" : "MB Bank (Quỳnh Như)"} value={bankForm.displayName}
                        onChange={e => setBankForm(f => ({ ...f, displayName: e.target.value }))}
                        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl focus:outline-none" />
                    </div>

                    {/* Static QR upload */}
                    <div className="border-t border-stone-100 pt-3">
                      <label className="text-[10px] text-stone-400 font-bold block mb-1">
                        Ảnh mã QR {bankForm.accountType === "momo" ? "*" : "tĩnh (tùy chọn)"}
                        <span className="text-stone-300 font-normal">
                          {bankForm.accountType === "momo" ? " — Bắt buộc với Ví MoMo" : " — Nếu có, sẽ dùng thay VietQR tự động"}
                        </span>
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
                        <button type="button" onClick={() => { setEditingBankId(null); setBankForm({ ...EMPTY_BANK_FORM }); }}
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
                  <h2 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-4">Tài khoản thanh toán đã khai báo</h2>
                  <div className="space-y-3">
                    {bankAccounts.map(b => (
                      <div key={b._id} className="flex items-start gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
                        <PaymentAccountLogo
                          accountType={b.accountType === "momo" ? "momo" : "bank"}
                          bankId={b.bankId}
                          name={b.bankName}
                          className="w-12 h-12"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-[#9E5E6F]">{b.displayName}</p>
                          <p className="text-[10px] text-stone-600 font-semibold">
                            {b.accountType === "momo" ? "Ví điện tử MoMo" : b.bankName}
                          </p>
                          <p className="text-[10px] text-stone-400 font-mono">
                            {b.accountType === "momo" ? "SĐT" : "STK"}: {b.accountNumber}
                          </p>
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

                  {/* ── LOYALTY POINTS DISABLED (tạm tắt) ──
                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm">
                    <h2 ...> <Percent /> Tích điểm thành viên </h2>
                    ... (point reward rate input) ...
                  </div>

                  <div className="bg-white rounded-2xl p-5 border border-stone-200/60 shadow-sm space-y-4">
                    <h2 ...> <Gift /> Hạng thẻ thành viên </h2>
                    ... (rank tiers thresholds + benefits) ...
                  </div>
                  ── END LOYALTY DISABLED ── */}

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
      {/* ── Reset PIN Modal ── */}
      {resetPinEmpId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 shadow-2xl border border-stone-100 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">Đặt Lại PIN</h3>
              </div>
              <button onClick={() => { setResetPinEmpId(null); setResetPinName(""); setResetPinValue(""); }} className="p-1 hover:bg-stone-100 rounded-full transition">
                <X className="w-4 h-4 text-stone-400" />
              </button>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
              <p className="text-[11px] text-amber-700 font-semibold">
                Đặt mã PIN mới cho <strong>{resetPinName}</strong>. Nhân viên sẽ phải đổi PIN riêng khi đăng nhập lần sau.
              </p>
            </div>

            {/* PIN dots */}
            <div className="flex justify-center gap-4">
              {[0, 1, 2, 3].map(i => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${resetPinValue.length > i
                    ? "bg-amber-500 border-amber-500 scale-110"
                    : "bg-white border-stone-300"
                  }`}
                />
              ))}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (key === "⌫") setResetPinValue(v => v.slice(0, -1));
                    else if (key !== "" && resetPinValue.length < 4) setResetPinValue(v => v + key);
                  }}
                  disabled={resetPinLoading || key === ""}
                  className={`h-12 rounded-xl text-base font-bold transition active:scale-95 ${key === "" ? "invisible" : key === "⌫"
                    ? "bg-stone-100 text-stone-500 hover:bg-stone-200"
                    : "bg-stone-50 text-stone-800 hover:bg-amber-50 hover:text-amber-700 border border-stone-150"
                  } disabled:opacity-50`}
                >
                  {key}
                </button>
              ))}
            </div>

            <button
              onClick={handleResetPin}
              disabled={resetPinValue.length !== 4 || resetPinLoading}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:bg-stone-200 disabled:text-stone-400 text-white font-bold text-sm rounded-2xl transition"
            >
              {resetPinLoading ? "Đang xử lý..." : "Xác nhận đặt lại PIN"}
            </button>
          </div>
        </div>
      )}
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
  services: Service[];
  categories: Category[];
  onEdit: (s: Service) => void;
  onDelete: (id: string) => void;
  onToggleActive: (s: Service) => void;
  formatPrice: (p: number) => string;
}

const ServiceListPanel = ({
  services, categories, onEdit, onDelete, onToggleActive, formatPrice,
}: ServiceListPanelProps) => {
  const [catFilter, setCatFilter] = React.useState<string>("all");
  const [search, setSearch] = React.useState("");

  // Tabs follow whatever categories the admin has defined.
  const tabs = [
    { key: "all", label: "Tất cả", emoji: "🔖" },
    ...categories.map(c => ({ key: c.key, label: c.name, emoji: c.icon })),
  ];
  const iconFor = (key: string) => categories.find(c => c.key === key)?.icon || "🏷️";

  const filtered = services.filter(s => {
    const matchCat = catFilter === "all" || s.category === catFilter;
    const category = categories.find(item => item.key === s.category);
    const matchSearch = matchesVietnameseSearch(search, s.name, s.description, category?.name);
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
          {tabs.map(tab => {
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
              <div
                key={s._id}
                className={`flex items-center gap-3 px-5 py-3 hover:bg-stone-50/70 transition group ${s.isActive === false ? "opacity-55" : ""}`}
              >
                {/* Category badge */}
                <span className="shrink-0 text-[13px] w-7 h-7 flex items-center justify-center rounded-lg border bg-stone-50 border-stone-100">
                  {iconFor(s.category)}
                </span>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate flex items-center gap-1.5">
                    {s.name}
                    {s.isActive === false && (
                      <span className="shrink-0 text-[8px] font-bold uppercase bg-stone-200 text-stone-600 px-1.5 py-0.5 rounded">
                        Đang ẩn
                      </span>
                    )}
                  </p>
                  {s.description && <p className="text-[10px] text-stone-400 truncate">{s.description}</p>}
                  <div className="flex flex-wrap gap-1 mt-1">
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${s.showOnMenu !== false ? "bg-blue-50 text-blue-600" : "bg-stone-100 text-stone-400 line-through"}`}>
                      Menu khách
                    </span>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${s.showInInvoice !== false ? "bg-violet-50 text-violet-600" : "bg-stone-100 text-stone-400 line-through"}`}>
                      Lập hóa đơn
                    </span>
                  </div>
                </div>

                {/* Price */}
                <span className="text-xs font-bold text-primary font-sans tabular-nums shrink-0 whitespace-nowrap">
                  {formatPrice(s.price)}
                </span>

                {/* Actions — always visible, not hover-only (touch users need access) */}
                <div className="flex gap-0.5 shrink-0">
                  <button
                    onClick={() => onToggleActive(s)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors duration-150"
                    title={s.isActive === false ? "Bật lại dịch vụ ở mọi nơi" : "Tạm ngừng dịch vụ ở mọi nơi"}
                  >
                    {s.isActive === false ? <EyeOff className="w-[13px] h-[13px]" /> : <Eye className="w-[13px] h-[13px]" />}
                  </button>
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
