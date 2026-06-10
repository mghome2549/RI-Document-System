import { useState } from "react";
import {
  LayoutDashboard,
  Inbox,
  FolderMinus,
  ShieldCheck,
  User,
  GraduationCap,
  LogOut,
  Archive,
  Menu,
  X,
  Plus
} from "lucide-react";
import { getAcademicYearsRange } from "../utils/academicYear";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  selectedYear: number | "all";
  setSelectedYear: (year: number | "all") => void;
  userEmail: string;
  userName: string;
  userRole: "admin" | "viewer";
  currentAcademicYear: number;
  onSignOut: () => void;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  selectedYear,
  setSelectedYear,
  userEmail,
  userName,
  userRole,
  currentAcademicYear,
  onSignOut
}: SidebarProps) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const yearsRange = getAcademicYearsRange(currentAcademicYear, 5); // Returns current year and previous 4 years

  const navItems = userRole === "admin"
    ? [
        { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { id: "ledger", label: "จัดการเอกสาร (Documents)", icon: Inbox },
        { id: "users", label: "Settings / จัดการระบบ", icon: ShieldCheck }
      ]
    : [
        { id: "ledger", label: "จัดการเอกสาร (Documents)", icon: Inbox }
      ];

  const handleNavClick = (tabId: string) => {
    setActiveTab(tabId);
    setIsMobileOpen(false);
  };

  const SidebarContent = () => (
    <div id="sidebar-container" className="h-full flex flex-col bg-[#003366] text-white font-sans border-r border-blue-900/50 shadow-md">
      {/* Brand Header */}
      <div className="p-4 border-b border-blue-900/50 bg-[#002244] flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-inner shrink-0">
            <div className="text-[#003366] font-black text-lg tracking-tighter">วพ.</div>
          </div>
          <div className="min-w-0">
            <h1 className="text-[11px] font-bold leading-tight text-white tracking-wide truncate" title="สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)">สายวิจัยและพัฒนานวัตกรรมการศึกษา</h1>
            <p className="text-[9px] text-[#FFCC00] font-bold leading-none mt-0.5 truncate uppercase">วพ. (RI Division)</p>
            <p className="text-[8.5px] text-blue-200 font-medium tracking-tight">มหาวิทยาลัยกรุงเทพ</p>
          </div>
        </div>
      </div>

      {/* Main Navigation Tab Items */}
      <nav id="sidebar-nav" className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
        <div className="text-[10px] uppercase font-bold text-blue-300 mb-2 px-2.5 tracking-wider opacity-85">
          Navigation
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full h-9 px-3 flex items-center gap-3 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                isActive
                  ? "bg-white/10 text-white shadow-sm font-bold border-l-3 border-[#FFCC00]"
                  : "text-blue-100/90 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={15} className={isActive ? "text-[#FFCC00]" : "text-blue-200"} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Dynamic Multi-Year Archive Selector */}
        <div className="pt-4 border-t border-blue-900/50 mt-3">
          <div className="px-2.5 pb-2 text-[10px] text-blue-300 font-bold uppercase tracking-wider flex items-center gap-1.5 opacity-85">
            <Archive size={11} className="text-[#FFCC00]" />
            <span>ค้นหาย้อนหลังตามปีการศึกษา</span>
          </div>
          
          <div className="px-2.5">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="w-full h-8.5 bg-[#002244] text-white border border-blue-900/50 text-xs rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-[#FFCC00] cursor-pointer"
            >
              <option value="all">แสดงทุกปีการศึกษา (ทั้งหมด)</option>
              {yearsRange.map((yr) => (
                <option key={yr} value={yr}>
                  ปีการศึกษา {yr}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-blue-200/70 mt-1 pb-1 leading-normal font-light">
              เลือกปีการศึกษาเพื่อกรองเอกสารเข้าและออก
            </p>
          </div>
        </div>
      </nav>

      {/* Prominent Academic Year Engine Widget using Golden Yellow */}
      <div className="p-3.5 border-t border-blue-900/50 bg-[#002244]/50">
        <div className="bg-[#FFCC00] text-[#003366] rounded-lg p-3 shadow-md border border-yellow-400">
          <div className="text-sm font-black leading-none">ปีการศึกษา {selectedYear}</div>
          <div className="text-[10px] opacity-90 font-semibold mt-1">
            (1 ส.ค. {selectedYear === "all" ? currentAcademicYear - 1 : parseInt(String(selectedYear)) - 1} - 31 ก.ค. {selectedYear})
          </div>
        </div>
      </div>

      {/* User Information Widget & Logout */}
      <div className="p-3.5 bg-[#002244] border-t border-blue-900/50 space-y-3">
        <div className="flex items-center gap-2.5 py-1">
          <div className="p-2 bg-[#003366] rounded-md text-blue-200 border border-blue-900/55">
            <User size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white truncate">{userName}</div>
            <div className="text-[9px] font-mono text-blue-200/70 truncate">{userEmail}</div>
            
            {/* User Access Badge */}
            <div className="mt-1 flex items-center">
              {userRole === "admin" ? (
                <span className="text-[8px] font-bold text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase tracking-widest">
                  ผู้ดูแลระบบ (Admin)
                </span>
              ) : (
                <span className="text-[8px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">
                  ผู้ใช้งานทั่วไป (Viewer)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Sign Out Action */}
        <button
          onClick={onSignOut}
          className="w-full h-8 flex items-center justify-center gap-1.5 text-xs text-rose-300 hover:text-white bg-rose-500/15 hover:bg-rose-500/25 rounded-md border border-rose-500/20 transition-all cursor-pointer active:scale-98"
        >
          <LogOut size={13} />
          <span>ออกจากระบบ</span>
        </button>

        {/* System Version */}
        <div className="text-center pt-1 text-[9px] text-blue-300/40 font-mono tracking-wider">
          RI Document System v1.0
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar (hidden on mobile) */}
      <div className="hidden lg:block w-64 h-screen shrink-0 sticky top-0">
        <SidebarContent />
      </div>

      {/* Mobile Top Header (Navbar) */}
      <div className="lg:hidden h-14 bg-slate-950 text-slate-100 flex items-center justify-between px-4 sticky top-0 z-50 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <GraduationCap size={18} className="text-blue-500" />
          <span className="text-xs font-bold uppercase tracking-wider">RI Document System</span>
          <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
            {currentAcademicYear}
          </span>
        </div>
        <button
          onClick={() => setIsMobileOpen(true)}
          className="p-1.5 hover:bg-slate-900 rounded-lg text-slate-300 cursor-pointer"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* Mobile Sidebar overlay */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileOpen(false)} />
          <div className="relative w-64 h-full flex flex-col z-10 animate-slideRight">
            <button
              onClick={() => setIsMobileOpen(false)}
              className="absolute top-4 right-[-44px] p-2 bg-slate-950 text-slate-300 rounded-r-lg hover:text-white border-y border-r border-slate-800 cursor-pointer"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}
    </>
  );
}
