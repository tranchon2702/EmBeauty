import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  icon?: string;        // emoji or text icon
  sublabel?: string;    // secondary text
  color?: string;       // dot color class like "bg-emerald-500"
}

interface StyledSelectProps {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  size?: "sm" | "md";
  className?: string;
  dropdownWidth?: string;
}

export const StyledSelect: React.FC<StyledSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = "Chọn...",
  size = "sm",
  className = "",
  dropdownWidth,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active into view when opened
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector("[data-active='true']");
      if (active) active.scrollIntoView({ block: "nearest" });
    }
  }, [open]);

  const py = size === "sm" ? "py-1.5" : "py-2";
  const textSize = size === "sm" ? "text-xs" : "text-xs";

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full ${py} pl-3 pr-8 bg-stone-50 border border-stone-200 rounded-xl text-left ${textSize} font-semibold text-stone-800 hover:bg-stone-100/80 focus:outline-none focus:ring-1 focus:ring-[#9E5E6F] transition-all duration-150 relative group`}
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.color && <span className={`w-2 h-2 rounded-full ${selected.color} shrink-0`} />}
          {selected?.icon && <span className="shrink-0">{selected.icon}</span>}
          <span className={selected ? "text-stone-800" : "text-stone-400"}>
            {selected ? selected.label : placeholder}
          </span>
        </span>
        <ChevronDown className={`w-3.5 h-3.5 text-stone-400 absolute right-2.5 top-1/2 -translate-y-1/2 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 left-0 mt-1.5 bg-white border border-stone-200/80 rounded-2xl shadow-xl shadow-stone-200/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
          style={{ width: dropdownWidth || "100%", minWidth: "100%" }}
        >
          <div ref={listRef} className="max-h-56 overflow-y-auto py-1">
            {options.map(opt => {
              const isActive = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  data-active={isActive}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full px-3 ${py} text-left ${textSize} flex items-center gap-2.5 transition-colors duration-100 ${
                    isActive
                      ? "bg-[#F9ECEF] text-[#9E5E6F] font-bold"
                      : "text-stone-700 hover:bg-stone-50 font-medium"
                  }`}
                >
                  {opt.color && <span className={`w-2 h-2 rounded-full ${opt.color} shrink-0`} />}
                  {opt.icon && <span className="shrink-0 text-sm">{opt.icon}</span>}
                  <div className="flex-1 min-w-0 truncate">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[10px] text-stone-400 ml-1.5">{opt.sublabel}</span>
                    )}
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-[#9E5E6F] shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
