import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ChevronRight, RotateCcw, Scissors, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { API_BASE, setTokens, clearSession, getSession } from "../config";

interface EmployeeBrief {
  _id: string;
  name: string;
  role: string;
  avatar?: string;
  bio?: string;
}

const EmployeeLogin = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeBrief[]>([]);
  const [selectedEmp, setSelectedEmp] = useState<EmployeeBrief | null>(null);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  // ── Forced PIN change state ──
  const [mustChangePin, setMustChangePin] = useState(false);
  const [changePinUser, setChangePinUser] = useState<{ _id: string; name: string } | null>(null);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [changePinStep, setChangePinStep] = useState<"new" | "confirm">("new");

  // Check if already logged in
  useEffect(() => {
    const session = getSession();
    if (session && !session.mustChangePin) {
      navigate("/employee/dashboard");
      return;
    }
    fetchEmployees();
  }, [navigate]);

  const fetchEmployees = async () => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE}/employees/list`);
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch {
      toast.error("Không thể kết nối máy chủ");
    } finally {
      setFetching(false);
    }
  };

  const handleSelectEmployee = (emp: EmployeeBrief) => {
    setSelectedEmp(emp);
    setPin("");
  };

  const handleBack = () => {
    if (mustChangePin) {
      setMustChangePin(false);
      setChangePinUser(null);
      setNewPin("");
      setConfirmPin("");
      setChangePinStep("new");
      clearSession();
      return;
    }
    setSelectedEmp(null);
    setPin("");
  };

  const handlePinInput = (digit: string) => {
    if (mustChangePin) {
      if (changePinStep === "new") {
        if (newPin.length < 4) {
          const val = newPin + digit;
          setNewPin(val);
          if (val.length === 4) {
            setTimeout(() => setChangePinStep("confirm"), 200);
          }
        }
      } else {
        if (confirmPin.length < 4) {
          const val = confirmPin + digit;
          setConfirmPin(val);
          if (val.length === 4) {
            setTimeout(() => submitChangePin(val), 200);
          }
        }
      }
      return;
    }

    if (pin.length < 4) {
      const newPinVal = pin + digit;
      setPin(newPinVal);
      if (newPinVal.length === 4) {
        setTimeout(() => submitLogin(newPinVal), 100);
      }
    }
  };

  const handlePinDelete = () => {
    if (mustChangePin) {
      if (changePinStep === "confirm") {
        if (confirmPin.length > 0) {
          setConfirmPin(p => p.slice(0, -1));
        } else {
          setChangePinStep("new");
        }
      } else {
        setNewPin(p => p.slice(0, -1));
      }
      return;
    }
    setPin(p => p.slice(0, -1));
  };

  const submitLogin = async (pinValue: string) => {
    if (!selectedEmp || !pinValue || pinValue.length < 4) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/employees/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmp._id, pin: pinValue }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Mã PIN không đúng");
        setPin("");
        setLoading(false);
        return;
      }

      // Store tokens
      setTokens(data.accessToken, data.refreshToken);
      localStorage.setItem("embeauty_session", JSON.stringify(data.user));

      // Check if must change PIN
      if (data.user.mustChangePin) {
        setMustChangePin(true);
        setChangePinUser({ _id: data.user._id, name: data.user.name });
        setPin("");
        setNewPin("");
        setConfirmPin("");
        setChangePinStep("new");
        toast.info("Bạn cần đặt mã PIN mới cho riêng mình 🔐");
        setLoading(false);
        return;
      }

      toast.success(`Chào mừng, ${data.user.name}! 👋`);
      navigate("/employee/dashboard");
    } catch {
      toast.error("Lỗi kết nối máy chủ");
      setPin("");
    } finally {
      setLoading(false);
    }
  };

  const submitChangePin = async (confirmValue: string) => {
    if (!changePinUser) return;

    if (newPin !== confirmValue) {
      toast.error("Mã PIN xác nhận không khớp. Thử lại nhé!");
      setConfirmPin("");
      setChangePinStep("new");
      setNewPin("");
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("embeauty_token");
      const res = await fetch(`${API_BASE}/employees/${changePinUser._id}/change-pin`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ newPin }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Lỗi đổi PIN");
        setNewPin("");
        setConfirmPin("");
        setChangePinStep("new");
        setLoading(false);
        return;
      }

      // Update session to remove mustChangePin
      const session = getSession();
      if (session) {
        session.mustChangePin = false;
        localStorage.setItem("embeauty_session", JSON.stringify(session));
      }

      toast.success("Đổi mã PIN thành công! 🎉");
      setMustChangePin(false);
      navigate("/employee/dashboard");
    } catch {
      toast.error("Lỗi kết nối máy chủ");
    } finally {
      setLoading(false);
    }
  };

  const getAvatarInitials = (name: string) => {
    return name
      .split(" ")
      .map(w => w[0])
      .slice(-2)
      .join("")
      .toUpperCase();
  };

  const PASTEL_COLORS = [
    "bg-rose-100 text-rose-600",
    "bg-pink-100 text-pink-600",
    "bg-purple-100 text-purple-600",
    "bg-indigo-100 text-indigo-600",
    "bg-sky-100 text-sky-600",
    "bg-teal-100 text-teal-600",
  ];

  // Current PIN display
  const currentPinValue = mustChangePin
    ? (changePinStep === "new" ? newPin : confirmPin)
    : pin;

  const pinLabel = mustChangePin
    ? (changePinStep === "new" ? "Nhập mã PIN mới (4 số)" : "Xác nhận lại mã PIN mới")
    : "Nhập mã PIN 4 chữ số";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9ECEF] via-[#FDFBF7] to-[#F0EAE5] flex flex-col items-center justify-center"
      style={{ paddingTop: "env(safe-area-inset-top,0px)", paddingBottom: "env(safe-area-inset-bottom,0px)", padding: "env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)" }}
    >
      <div className="flex flex-col items-center justify-center flex-1 w-full p-4">
      {/* Logo / Brand */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/25">
          <Scissors className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-serif text-xl font-bold text-stone-800">EM Beauty Nội Bộ</h1>
        <p className="text-xs text-stone-400 mt-1">Hệ thống quản lý tiệm EM Beauty</p>
      </div>

      <div className="w-full max-w-sm">
        {/* ── Step 1: Select Employee ── */}
        {!selectedEmp && !mustChangePin && (
          <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
            <div className="px-5 pt-5 pb-3 border-b border-stone-100">
              <p className="text-xs font-bold text-stone-400 uppercase tracking-wider">Chọn tài khoản nhân viên</p>
            </div>

            {fetching ? (
              <div className="py-12 text-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-[#9E5E6F] mx-auto mb-3"></div>
                <p className="text-xs text-stone-400">Đang nạp danh sách...</p>
              </div>
            ) : employees.length === 0 ? (
              <div className="py-10 text-center px-6">
                <p className="text-sm text-stone-500 mb-3">Chưa có tài khoản nhân viên</p>
                <button onClick={fetchEmployees} className="text-xs text-[#9E5E6F] font-semibold flex items-center gap-1 mx-auto">
                  <RotateCcw className="w-3.5 h-3.5" /> Thử lại
                </button>
              </div>
            ) : (
              <div className="divide-y divide-stone-50">
                {employees.map((emp, idx) => (
                  <button
                    key={emp._id}
                    onClick={() => handleSelectEmployee(emp)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#F9ECEF] transition text-left group"
                  >
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-2xl overflow-hidden shrink-0">
                      {emp.avatar ? (
                        <img src={emp.avatar} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${PASTEL_COLORS[idx % PASTEL_COLORS.length]}`}>
                          {getAvatarInitials(emp.name)}
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-stone-800">{emp.name}</p>
                      <p className="text-[10px] text-stone-400 flex items-center gap-1">
                        {emp.role === "admin" ? (
                          <><ShieldCheck className="w-3 h-3 text-purple-500" /> Quản trị viên</>
                        ) : "Nhân viên"}
                        {emp.bio && <span className="text-stone-300">•</span>}
                        {emp.bio && <span className="truncate">{emp.bio}</span>}
                      </p>
                    </div>

                    <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-[#9E5E6F] transition shrink-0" />
                  </button>
                ))}
              </div>
            )}

            <div className="px-5 py-3 border-t border-stone-100">
              <Link to="/" className="text-[10px] text-stone-400 hover:text-[#9E5E6F] flex items-center gap-1 transition">
                <ArrowLeft className="w-3 h-3" /> Về trang khách hàng
              </Link>
            </div>
          </div>
        )}

        {/* ── Step 2: PIN Entry / Forced PIN Change ── */}
        {(selectedEmp || mustChangePin) && (
          <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-stone-100 flex items-center gap-3">
              <button onClick={handleBack} className="p-1.5 hover:bg-stone-100 rounded-full transition text-stone-500">
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Employee preview */}
              {mustChangePin && changePinUser ? (
                <>
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <KeyRound className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 text-sm">{changePinUser.name}</p>
                    <p className="text-[10px] text-amber-600 font-semibold">🔐 Đặt mã PIN mới</p>
                  </div>
                </>
              ) : selectedEmp && (
                <>
                  <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                    {selectedEmp.avatar ? (
                      <img src={selectedEmp.avatar} alt={selectedEmp.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-[#F9ECEF] flex items-center justify-center font-bold text-sm text-[#9E5E6F]">
                        {getAvatarInitials(selectedEmp.name)}
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-stone-800 text-sm">{selectedEmp.name}</p>
                    <p className="text-[10px] text-stone-400">{selectedEmp.role === "admin" ? "Quản trị viên" : "Nhân viên"}</p>
                  </div>
                </>
              )}
            </div>

            <div className="px-5 py-6 space-y-6">
              {/* Forced change info banner */}
              {mustChangePin && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3 text-center">
                  <p className="text-[11px] text-amber-700 font-semibold">
                    Admin đã đặt lại PIN cho bạn. Hãy tạo mã PIN riêng để bảo mật tài khoản.
                  </p>
                </div>
              )}

              {/* PIN indicator dots */}
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-4 font-semibold">{pinLabel}</p>

                {/* Step indicators for forced change */}
                {mustChangePin && (
                  <div className="flex items-center justify-center gap-2 mb-4">
                    <div className={`h-1 w-8 rounded-full transition-all ${changePinStep === "new" ? "bg-amber-500" : "bg-emerald-500"}`} />
                    <div className={`h-1 w-8 rounded-full transition-all ${changePinStep === "confirm" ? "bg-amber-500" : "bg-stone-200"}`} />
                  </div>
                )}

                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${currentPinValue.length > i
                        ? mustChangePin
                          ? "bg-amber-500 border-amber-500 scale-110"
                          : "bg-[#9E5E6F] border-[#9E5E6F] scale-110"
                        : "bg-white border-stone-300"
                        }`}
                    />
                  ))}
                </div>
                {loading && (
                  <p className="text-[10px] text-stone-400 mt-2">Đang xác thực...</p>
                )}
              </div>

              {/* PIN Numpad */}
              <div className="grid grid-cols-3 gap-3">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((key, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (key === "⌫") handlePinDelete();
                      else if (key !== "") handlePinInput(key);
                    }}
                    disabled={loading || key === ""}
                    className={`numpad-btn ${key === "" ? "invisible" : key === "⌫"
                      ? "bg-stone-100 text-stone-500 hover:bg-stone-200"
                      : "bg-stone-50 text-stone-800 hover:bg-[#F9ECEF] hover:text-[#9E5E6F] border border-stone-150 shadow-sm"
                    } disabled:opacity-50`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
