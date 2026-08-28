import React, { useState, useEffect, useRef } from "react";
import { Mail, User, GraduationCap, X, Check } from "lucide-react";
import { Professor } from "../services/professors";

interface EmailAutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (email: string, professor?: Professor) => void;
  professors: Professor[];
  placeholder?: string;
  className?: string;
}

export default function EmailAutocompleteInput({
  id = "recipient-email-autocomplete",
  value,
  onChange,
  onSelect,
  professors,
  placeholder = "พิมพ์อีเมลหรือชื่ออาจารย์ เช่น kittiwat.p@bu.ac.th",
  className = ""
}: EmailAutocompleteInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filteredProfs, setFilteredProfs] = useState<Professor[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter professors and email matches based on user input
  useEffect(() => {
    if (!value || value.trim() === "") {
      setFilteredProfs([]);
      return;
    }

    const query = value.toLowerCase().trim().replace(/[\s\.\-]+/g, "");
    
    // Find all professors whose email, name, or department matches query
    const matches = professors.filter((prof) => {
      if (!prof.email) return false;
      const email = prof.email.toLowerCase().replace(/[\s\.\-]+/g, "");
      const name = prof.name.toLowerCase().replace(/[\s\.\-]+/g, "");
      const dept = (prof.department || "").toLowerCase().replace(/[\s\.\-]+/g, "");

      return email.includes(query) || name.includes(query) || dept.includes(query);
    });

    setFilteredProfs(matches.slice(0, 6)); // Display top 6 matching results
  }, [value, professors]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (filteredProfs.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev < filteredProfs.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIsOpen(true);
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredProfs.length - 1));
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && activeIndex < filteredProfs.length) {
        e.preventDefault();
        handleSelect(filteredProfs[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const handleSelect = (prof: Professor) => {
    if (prof.email) {
      onChange(prof.email);
      if (onSelect) {
        onSelect(prof.email, prof);
      }
    }
    setIsOpen(false);
    setActiveIndex(-1);
  };

  // Helper suggestion for typing without domain suffix (e.g. typing "kittiwat" -> suggest "kittiwat@bu.ac.th")
  const showDomainSuggestion = 
    value.trim().length >= 3 && 
    !value.includes("@") && 
    !filteredProfs.some(p => p.email.toLowerCase() === `${value.trim().toLowerCase()}@bu.ac.th`);

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`} id={`email-autocomplete-wrapper-${id}`}>
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (value.trim().length > 0) {
              setIsOpen(true);
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full text-xs h-9 pl-3 pr-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 font-sans shadow-xs transition placeholder:text-slate-400"
        />

        {/* Clear input or Mail icon */}
        {value ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              setIsOpen(false);
            }}
            className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
            title="ล้างข้อความ"
          >
            <div className="p-0.5 rounded-full hover:bg-slate-200 transition">
              <X size={13} />
            </div>
          </button>
        ) : (
          <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-400">
            <Mail size={14} className="opacity-60" />
          </div>
        )}
      </div>

      {/* Autocomplete Dropdown Menu */}
      {isOpen && (filteredProfs.length > 0 || showDomainSuggestion) && (
        <div
          className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-60 overflow-y-auto animate-fadeIn"
          id={`email-autocomplete-dropdown-${id}`}
        >
          <div className="bg-blue-50/70 px-3 py-1.5 text-[9.5px] font-bold text-blue-900 flex justify-between items-center select-none border-b border-blue-100/50">
            <span className="flex items-center gap-1">
              <Mail size={11} className="text-blue-600" />
              <span>แนะนำอีเมลอาจารย์ (คลิกเพื่อเลือกอัตโนมัติ)</span>
            </span>
            <span className="text-[8.5px] text-blue-600/75">กด ↑ ↓ และ Enter เพื่อเลือก</span>
          </div>

          {/* Quick Domain Suggestion item */}
          {showDomainSuggestion && (
            <button
              type="button"
              onClick={() => {
                const suggested = `${value.trim().toLowerCase()}@bu.ac.th`;
                onChange(suggested);
                if (onSelect) onSelect(suggested);
                setIsOpen(false);
              }}
              className="w-full text-left p-2.5 px-3 flex items-center justify-between hover:bg-blue-50 transition-all cursor-pointer bg-slate-50/50"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">@</span>
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-blue-700 font-mono">
                    {value.trim().toLowerCase()}@bu.ac.th
                  </span>
                  <span className="text-[9.5px] text-slate-500">เติม @bu.ac.th อัตโนมัติ</span>
                </div>
              </div>
              <Check size={13} className="text-blue-600" />
            </button>
          )}

          {/* Professor Matches */}
          {filteredProfs.map((prof, index) => {
            const isActive = index === activeIndex;
            const isExactSelected = value.trim().toLowerCase() === prof.email.trim().toLowerCase();

            return (
              <button
                key={prof.id || `prof-${index}`}
                type="button"
                onClick={() => handleSelect(prof)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left p-2.5 px-3 flex flex-col gap-0.5 transition-all border-none cursor-pointer ${
                  isActive
                    ? "bg-blue-50 text-blue-900"
                    : isExactSelected
                    ? "bg-emerald-50/70"
                    : "bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <GraduationCap size={13} className="text-blue-600 shrink-0" />
                    <span className="text-xs font-bold text-slate-800">{prof.name}</span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100/60">
                    {prof.email}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium pl-4.5">
                  <span className="truncate max-w-[280px]">🏢 {prof.department || "ไม่ระบุหน่วยงาน"}</span>
                  {prof.position && <span className="text-slate-400 text-[9px]">{prof.position}</span>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
