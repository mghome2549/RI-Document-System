import React, { useState, useEffect, useRef } from "react";
import { User, ClipboardList, Mail, GraduationCap } from "lucide-react";
import { Professor } from "../services/professors";

interface AutocompleteInputProps {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (professor: Professor) => void;
  professors: Professor[];
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export default function AutocompleteInput({
  id,
  label,
  value,
  onChange,
  onSelect,
  professors,
  placeholder = "เริ่มพิมพ์ชื่อผู้ส่งเพื่อค้นหารายการอัตโนมัติ...",
  required = false,
  className = ""
}: AutocompleteInputProps) {
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

  // Filter professors based on user input
  useEffect(() => {
    if (!value || value.trim() === "") {
      setFilteredProfs([]);
      return;
    }

    const queryText = value.toLowerCase().replace(/[\s\.\-]+/g, "");
    const matches = professors.filter((prof) => {
      // Robust Thai string matching ignoring spaces and specific acronym dots
      const name = prof.name.toLowerCase().replace(/[\s\.\-]+/g, "");
      const dept = prof.department.toLowerCase().replace(/[\s\.\-]+/g, "");
      const email = prof.email.toLowerCase().replace(/[\s\.\-]+/g, "");
      
      return (
        name.includes(queryText) ||
        dept.includes(queryText) ||
        email.includes(queryText)
      );
    });

    setFilteredProfs(matches.slice(0, 5)); // Limit to top 5 results for sleek density layout
  }, [value, professors]);

  // Handle keyboard navigations
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
    onSelect(prof);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative flex flex-col ${className}`} id={`autocomplete-wrapper-${id}`}>
      <label htmlFor={id} className="block text-[10px] font-bold text-slate-500 mb-1 flex items-center gap-1.5 select-none">
        <User size={11} className="text-slate-400" />
        <span>{label}</span>
        {required && <span className="text-rose-500">*</span>}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full text-xs h-9 pl-3 pr-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white text-slate-800 font-medium transition-shadow shadow-sm placeholder:text-slate-400"
        />
        
        {/* Helper Visual Indicator */}
        <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-350">
          <ClipboardList size={14} className="opacity-60" />
        </div>
      </div>

      {/* Autocomplete Dropdown Panel */}
      {isOpen && filteredProfs.length > 0 && (
        <div 
          className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white border border-slate-150 rounded-xl shadow-xl overflow-hidden divide-y divide-slate-100 max-h-56 overflow-y-auto animate-fadeIn"
          id={`autocomplete-dropdown-${id}`}
        >
          <div className="bg-blue-50/50 px-3 py-1.5 text-[9px] font-bold text-blue-900 flex justify-between items-center select-none">
            <span>🔍 แนะนำรายชื่อตรงกับการค้นหา</span>
            <span className="text-[8.5px] text-blue-600/75">กด Enter เพื่อตอบรับ</span>
          </div>
          
          {filteredProfs.map((prof, index) => {
            const isActive = index === activeIndex;
            return (
              <button
                key={prof.id}
                type="button"
                onClick={() => handleSelect(prof)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left p-3 flex flex-col gap-1 transition-all border-none ${
                  isActive ? "bg-indigo-50/70" : "bg-white hover:bg-slate-50/60"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <GraduationCap size={13} className="text-indigo-805 text-indigo-900 shrink-0" />
                  <span className="text-xs font-bold text-slate-850 text-slate-800">{prof.name}</span>
                </div>
                
                <div className="flex flex-col gap-0.5 pl-4.5 pl-5 text-[10px] text-slate-500 font-medium leading-tight">
                  <span className="truncate">🏢 สังกัด: {prof.department}</span>
                  <span className="truncate flex items-center gap-1 mt-0.5">
                    <Mail size={10} className="text-slate-400" />
                    <span className="font-mono text-[9px]">{prof.email}</span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
