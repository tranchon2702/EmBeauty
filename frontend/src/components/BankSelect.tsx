import React, { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { VIETNAM_BANKS } from "../lib/vietnamBanks";

interface BankSelectProps {
  value: string;
  onChange: (bankId: string, bankName: string) => void;
}

export const BankSelect: React.FC<BankSelectProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedBank = VIETNAM_BANKS.find(b => b.id === value || b.code.toLowerCase() === value.toLowerCase()) || VIETNAM_BANKS[0];

  const filteredBanks = VIETNAM_BANKS.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.shortName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-left font-medium text-stone-800 flex items-center justify-between hover:bg-stone-100/80 transition focus:outline-none focus:ring-1 focus:ring-[#9E5E6F]"
      >
        <div className="flex items-center gap-2 truncate">
          <span className="bg-[#9E5E6F]/10 text-[#9E5E6F] font-bold text-[10px] px-1.5 py-0.5 rounded uppercase">
            {selectedBank.code}
          </span>
          <span className="truncate">{selectedBank.shortName}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Searchable Dropdown */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-stone-200 rounded-2xl shadow-xl overflow-hidden text-xs">
          {/* Search Box */}
          <div className="p-2 border-b border-stone-100 bg-stone-50/50 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <input
              type="text"
              autoFocus
              placeholder="Tìm ngân hàng (ví dụ: VCB, MB, Techcombank...)"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-xs text-stone-800 placeholder:text-stone-400"
            />
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-stone-50">
            {filteredBanks.length === 0 ? (
              <div className="p-3 text-center text-stone-400">Không tìm thấy ngân hàng khớp</div>
            ) : (
              filteredBanks.map(b => {
                const isSelected = b.id === selectedBank.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onChange(b.id, b.shortName);
                      setIsOpen(false);
                      setSearchTerm("");
                    }}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-[#F9ECEF]/60 transition ${
                      isSelected ? "bg-[#F9ECEF] font-bold text-[#9E5E6F]" : "text-stone-700"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="bg-stone-100 text-stone-600 font-mono font-bold text-[10px] px-1.5 py-0.5 rounded shrink-0">
                        {b.code}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold truncate">{b.shortName}</p>
                        <p className="text-[10px] text-stone-400 truncate">{b.name}</p>
                      </div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#9E5E6F] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
