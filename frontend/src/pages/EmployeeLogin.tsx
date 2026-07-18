import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ChevronRight, RotateCcw, Scissors, Delete } from "lucide-react";
import { toast } from "sonner";
import { API_BASE } from "../config";

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

  // Check if already logged in
  useEffect(() => {
    const existing = localStorage.getItem("embeauty_session");
    if (existing) {
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
    setSelectedEmp(null);
    setPin("");
  };

  const handlePinInput = (digit: string) => {
    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        // Auto-submit when 4 digits entered
        setTimeout(() => submitLogin(newPin), 100);
      }
    }
  };

  const handlePinDelete = () => setPin(p => p.slice(0, -1));

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

      localStorage.setItem("embeauty_session", JSON.stringify(data));
      toast.success(`Chào mừng, ${data.name}! 👋`);
      navigate("/employee/dashboard");
    } catch {
      toast.error("Lỗi kết nối máy chủ");
      setPin("");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F9ECEF] via-[#FDFBF7] to-[#F0EAE5] flex flex-col items-center justify-center p-4">
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
        {!selectedEmp && (
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

        {/* ── Step 2: PIN Entry ── */}
        {selectedEmp && (
          <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-100 overflow-hidden">
            <div className="px-5 pt-5 pb-4 border-b border-stone-100 flex items-center gap-3">
              <button onClick={handleBack} className="p-1.5 hover:bg-stone-100 rounded-full transition text-stone-500">
                <ArrowLeft className="w-4 h-4" />
              </button>

              {/* Employee preview */}
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
            </div>

            <div className="px-5 py-6 space-y-6">
              {/* PIN indicator dots */}
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-4 font-semibold">Nhập mã PIN 4 chữ số</p>
                <div className="flex justify-center gap-4">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${pin.length > i
                        ? "bg-[#9E5E6F] border-[#9E5E6F] scale-110"
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
                    className={`h-14 rounded-2xl text-lg font-bold transition-colors duration-150 active:scale-95 ${key === "" ? "invisible" : key === "⌫"
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
  );
};

export default EmployeeLogin;
