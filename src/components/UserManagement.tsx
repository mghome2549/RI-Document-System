import React, { useState, useEffect, FormEvent, ChangeEvent } from "react";
import {
  Shield,
  Plus,
  Trash2,
  Mail,
  Info,
  UserCheck,
  AlertTriangle,
  Database,
  Code,
  GraduationCap,
  Search,
  Edit,
  Check,
  Copy,
  RefreshCw,
  FileSpreadsheet
} from "lucide-react";
import {
  Professor,
  fetchProfessors,
  saveProfessor,
  deleteProfessor,
  getGoogleAppsScriptUrl,
  saveGoogleAppsScriptUrl,
  importProfessorsCsv
} from "../services/professors";
import { GOOGLE_APPS_SCRIPT_CODE } from "../utils/gasCode";
import { fetchPrimaryOwnerEmail, transferPrimaryOwner } from "../services/db";

interface UserManagementProps {
  adminEmails: string[];
  currentUserEmail: string | null;
  userRole: "admin" | "viewer";
  onAddAdmin: (email: string) => void;
  onRemoveAdmin: (email: string) => void;
  onSimulateUser?: (email: string, name: string) => void;
}

export default function UserManagement({
  adminEmails,
  currentUserEmail,
  userRole,
  onAddAdmin,
  onRemoveAdmin,
  onSimulateUser
}: UserManagementProps) {
  const isAdmin = userRole === "admin";
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dynamic Primary Owner & Delegation States
  const [primaryOwner, setPrimaryOwner] = useState<string>("kittiwat.p@bu.ac.th");
  const [transferTargetEmail, setTransferTargetEmail] = useState<string | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Sub-tabs State for Settings Page
  const [subTab, setSubTab] = useState<"admins" | "professors" | "gas_integration">("admins");

  // Professor CRUD states
  const [professors, setProfessors] = useState<Professor[]>([]);
  const [profSearch, setProfSearch] = useState("");
  const [isProfLoading, setIsProfLoading] = useState(false);
  const [showProfModal, setShowProfModal] = useState(false);
  const [editingProf, setEditingProf] = useState<Professor | null>(null);
  const [profToDelete, setProfToDelete] = useState<Professor | null>(null);

  // Professor Input field states
  const [profName, setProfName] = useState("");
  const [profPersonalId, setProfPersonalId] = useState("");
  const [profPosition, setProfPosition] = useState("");
  const [profDept, setProfDept] = useState("");
  const [profEmail, setProfEmail] = useState("");
  const [profPhone, setProfPhone] = useState("");
  const [profError, setProfError] = useState<string | null>(null);

  // Apps Script integration state
  const [gasUrl, setGasUrl] = useState("");
  const [isTestingGas, setIsTestingGas] = useState(false);
  const [gasTestResult, setGasTestResult] = useState<{ status: "success" | "error"; message: string } | null>(null);
  const [isCodeCopied, setIsCodeCopied] = useState(false);

  // Load professors & GAS Url & Primary Owner
  useEffect(() => {
    loadProfs();
    loadGasUrl();
    loadPrimaryOwner();
  }, []);

  const loadPrimaryOwner = async () => {
    try {
      const owner = await fetchPrimaryOwnerEmail();
      setPrimaryOwner(owner);
    } catch (err) {
      console.error("Error loading primary owner email:", err);
    }
  };

  const handleTransferConfirm = async () => {
    if (!transferTargetEmail) return;
    setIsTransferring(true);
    setError(null);
    setSuccess(null);
    try {
      await transferPrimaryOwner(transferTargetEmail);
      setSuccess(`สิทธิ์ผู้ดูแลหลัก (Primary Owner) ถูกส่งมอบให้แก่ ${transferTargetEmail} เป็นที่เรียบร้อยแล้ว ระบบจะทำการรีโหลดข้อมูลสิทธิ์ในสักครู่`);
      setPrimaryOwner(transferTargetEmail);
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการส่งมอบสิทธิ์ดูแลหลัก");
    } finally {
      setIsTransferring(false);
      setTransferTargetEmail(null);
    }
  };

  const loadProfs = async () => {
    setIsProfLoading(true);
    try {
      const list = await fetchProfessors();
      setProfessors(list);
    } catch (err) {
      console.error("Error fetching professors", err);
    } finally {
      setIsProfLoading(false);
    }
  };

  const loadGasUrl = async () => {
    const url = await getGoogleAppsScriptUrl();
    setGasUrl(url);
  };

  const handleSaveGasUrl = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await saveGoogleAppsScriptUrl(gasUrl);
      setSuccess("บันทึกที่อยู่ Google Apps Script Web App URL เรียบร้อยแล้ว");
      setTimeout(() => setSuccess(null), 3000);
      loadProfs(); // Reload to try pulling from new sheet URL
    } catch (err) {
      setError("ไม่สามารถบันทึกที่อยู่ URL ได้ กรุณาลองใหม่อีกครั้ง");
    }
  };

  const testGasConnection = async () => {
    setIsTestingGas(true);
    setGasTestResult(null);
    try {
      const testUrl = `${gasUrl}?action=GET_PROFS`;
      const response = await fetch(testUrl);
      if (response.ok) {
        const json = await response.json();
        if (json.status === "success") {
          setGasTestResult({
            status: "success",
            message: `เชื่อมต่อสตรีมสำเร็จ! ตรวจพบข้อมูลอาจารย์ ${json.data?.length || 0} รายการในแผ่นงาน Google Sheets`
          });
        } else {
          setGasTestResult({
            status: "error",
            message: `เชื่อมต่อได้แต่เซิร์ฟเวอร์ปฏิเสธ: ${json.message || "ไม่มีรายละเอียด"}`
          });
        }
      } else {
        setGasTestResult({
          status: "error",
          message: `เชื่อมต่อล้มเหลว (CORS/HTTP Error): ได้รับรหัสสถานะ ${response.status}`
        });
      }
    } catch (err) {
      setGasTestResult({
        status: "error",
        message: "เกิดสายหลุดกะทันหัน หรือเกิดข้อผิดพลาด CORS: โปรดมั่นใจว่าคุณได้ตั้งค่า Deploy Web App ใน Google Apps Script เป็นสิทธิ์ 'ทุกคน (Anyone)' เรียบร้อยแล้ว"
      });
    } finally {
      setIsTestingGas(false);
    }
  };

  const handleAdminSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const email = newEmail.trim().toLowerCase();
    if (!email) {
      setError("กรุณากรอกอีเมล");
      return;
    }

    if (!email.endsWith("@bu.ac.th")) {
      setError("ระเบียบการรักษาความปลอดภัย: อนุญาตเฉพาะอีเมลโดเมนสถาบัน @bu.ac.th เท่านั้น");
      return;
    }

    if (adminEmails.includes(email)) {
      setError(`อีเมล ${email} ได้รับสิทธิ์ผู้ดูแลระบบ (Admin) อยู่แล้ว`);
      return;
    }

    onAddAdmin(email);
    setNewEmail("");
    setSuccess(`มอบสิทธิ์แอดมินให้แก่ ${email} สำเร็จเรียบร้อย`);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Professor Creation / Editing Form Handlers
  const openAddProfModal = () => {
    setEditingProf(null);
    setProfName("");
    setProfPersonalId("");
    setProfPosition("");
    setProfDept("");
    setProfEmail("");
    setProfPhone("");
    setProfError(null);
    setShowProfModal(true);
  };

  const openEditProfModal = (prof: Professor) => {
    setEditingProf(prof);
    setProfName(prof.name);
    setProfPersonalId(prof.personalId || "");
    setProfPosition(prof.position || "");
    setProfDept(prof.department);
    setProfEmail(prof.email);
    setProfPhone(prof.phone || "");
    setProfError(null);
    setShowProfModal(true);
  };

  const handleProfSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setProfError(null);

    if (!profName.trim() || !profDept.trim() || !profEmail.trim()) {
      setProfError("กรุณากรอกข้อมูลหลักให้ครบถ้วน (ชื่อ, สังกัด, อีเมล)");
      return;
    }

    if (!profEmail.trim().includes("@")) {
      setProfError("รูปแบบที่อยู่อีเมลไม่ถูกต้อง");
      return;
    }

    setIsProfLoading(true);
    try {
      const payload = {
        id: editingProf?.id,
        name: profName,
        personalId: profPersonalId,
        position: profPosition,
        department: profDept,
        email: profEmail,
        phone: profPhone
      };
      
      await saveProfessor(payload);
      setShowProfModal(false);
      setSuccess(editingProf ? "ปรับปรุงข้อมูลอาจารย์สำเร็จ!" : "ลงทะเบียนอาจารย์ท่านใหม่เรียบร้อย!");
      setTimeout(() => setSuccess(null), 3500);
      loadProfs();
    } catch (err) {
      setProfError("บันทึกรายชื่อไม่ออกเนื่องจากความผิดพลาดในการส่งข้อมูล");
    } finally {
      setIsProfLoading(false);
    }
  };

  // CSV Import handler based on custom CSV headers: [ชื่อ-นามสกุล, รหัสบุคลากร, ตำแหน่ง, หน่วยงาน, อีเมล์, โทรศัพท์]
  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProfLoading(true);
    setSuccess(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) throw new Error("ไฟล์ว่างเปล่า");

        const lines = text.split(/\r?\n/);
        if (lines.length <= 1) {
          throw new Error("ไม่พบแถวข้อมูลในไฟล์ CSV");
        }

        const parsedRecords: Omit<Professor, "id">[] = [];

        // Simple CSV parser supporting quotes and escaped characters
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const columns: string[] = [];
          let current = "";
          let inQuotes = false;
          for (let charIdx = 0; charIdx < line.length; charIdx++) {
            const char = line[charIdx];
            if (char === '"') {
              inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
              columns.push(current.trim());
              current = "";
            } else {
              current += char;
            }
          }
          columns.push(current.trim());

          if (columns.length < 4) continue; // Skip incomplete lines

          // Index maps directly to customer template: [ชื่อ-นามสกุล, รหัสบุคลากร, ตำแหน่ง, หน่วยงาน, อีเมล์, โทรศัพท์]
          const name = columns[0].replace(/^"|"$/g, "");
          const personalId = columns[1]?.replace(/^"|"$/g, "") || "";
          const position = columns[2]?.replace(/^"|"$/g, "") || "";
          const department = columns[3]?.replace(/^"|"$/g, "") || "";
          const email = columns[4]?.replace(/^"|"$/g, "") || "";
          const phone = columns[5]?.replace(/^"|"$/g, "") || "";

          if (name && department && email) {
            parsedRecords.push({
              name,
              personalId,
              position,
              department,
              email,
              phone
            });
          }
        }

        if (parsedRecords.length === 0) {
          throw new Error("ไม่พบข้อมูลอาจารย์ที่สมบูรณ์ตรงตามเงื่อนไข (ต้องการระบุอย่างน้อย: ชื่อ-นามสกุล, หน่วยงาน, อีเมล์)");
        }

        const { upsertedCount, insertedCount } = await importProfessorsCsv(parsedRecords);
        setSuccess(`นำเข้าและปรับปรุงข้อมูลอาจารย์แบบอัตโนมัติ (Upsert) สำเร็จแล้ว! (มีผู้ร่วมเพิ่มรายใหม่ ${insertedCount} ท่าน และอัปเดตข้อมูลเดิม ${upsertedCount} ท่าน) ระบบป้องกันข้อมูลซ้ำซ้อนเรียบร้อยแล้วครับ`);
        setTimeout(() => setSuccess(null), 6500);
        loadProfs();
      } catch (err: any) {
        setError(`วิเคราะห์ไฟล์ CSV ผิดพลาด: ${err.message || err}`);
      } finally {
        setIsProfLoading(false);
        e.target.value = "";
      }
    };

    reader.onerror = () => {
      setError("เกิดความล้มเหลวในการอ่านไฟล์นำเข้า");
      setIsProfLoading(false);
    };

    reader.readAsText(file, "UTF-8");
  };

  const handleProfDelete = async (id: string, name: string) => {
    if (!profToDelete) return;
    setIsProfLoading(true);
    try {
      await deleteProfessor(id);
      setSuccess(`ลบข้อมูล "${name}" เรียบร้อยแล้ว`);
      setTimeout(() => setSuccess(null), 3500);
      loadProfs();
    } catch (err) {
      setError("เกิดข้อผิดพลาดในการลบข้อมูลอาจารย์");
    } finally {
      setIsProfLoading(false);
      setProfToDelete(null);
    }
  };

  const [emailToRemove, setEmailToRemove] = useState<string | null>(null);

  const handleRemove = (email: string) => {
    setError(null);
    setSuccess(null);

    if (email === primaryOwner) {
      setError(`สิทธิ์ผู้ดูแลระบบสูงสุด (${primaryOwner}) เป็นระบบหลัก ไม่ได้รับอนุญาตให้ถอนถอน`);
      return;
    }

    setEmailToRemove(email);
  };

  const handleConfirmRemove = () => {
    if (!emailToRemove) return;
    onRemoveAdmin(emailToRemove);
    setSuccess(`ถอนสิทธิ์แอดมินของ ${emailToRemove} เรียบร้อยแล้ว`);
    setEmailToRemove(null);
    setTimeout(() => setSuccess(null), 4000);
  };

  // Filtered lists
  const filteredProfessors = professors.filter((prof) => {
    const q = profSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      prof.name.toLowerCase().includes(q) ||
      prof.department.toLowerCase().includes(q) ||
      prof.email.toLowerCase().includes(q)
    );
  });

  if (!isAdmin) {
    return (
      <div id="access-denied-container" className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg mx-auto text-center shadow-xl space-y-6 my-10 font-sans">
        <div className="w-16 h-16 bg-rose-50 border border-rose-100 rounded-full flex items-center justify-center mx-auto text-rose-600 animate-pulse">
          <Shield size={32} />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-black text-slate-900">ปฏิเสธการเข้าถึง (Access Denied)</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            ขออภัย ส่วนการตั้งค่าและบำรุงรักษาระบบ (System Configuration) นี้ สงวนสิทธิ์สำหรับอาจารย์ผู้ดูแลระบบ (Admin) เท่านั้น เนื่องจากเป็นระบบเอกสารภายในหน่วยงานเพื่อรักษาความปลอดภัยขั้นสูงสำหรับข้อมูลทั้งหมด
          </p>
        </div>
        <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-400">
          หากท่านเป็นผู้ดูแลระบบหลัก กรุณาติดต่อ อ.กิตติวัฒน์ โพธิ์งามบวรชัย เพื่อขอเปิดใช้งานสิทธิ์
        </div>
      </div>
    );
  }

  return (
    <div id="user-management-panel" className="space-y-6 font-sans pb-10">
      {/* Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Shield className="text-indigo-900" size={24} />
            <span>ตั้งค่าและบำรุงรักษาระบบ (System Configuration)</span>
          </h2>
          <p className="text-xs text-slate-500 font-light mt-0.5">
            ศูนย์กลางสิทธิ์แอดมิน ผู้ใช้งานระบบ ตารางข้อมูลอาจารย์ และโมดูลบูรณาการ Google Sheets
          </p>
        </div>
        
        <button
          onClick={loadProfs}
          title="ซิงค์ข้อมูลใหม่"
          className="self-start md:self-auto h-8 px-3 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-nowrap"
        >
          <RefreshCw size={13} className={isProfLoading ? "animate-spin text-blue-600" : ""} />
          <span>ซิงก์ฐานข้อมูลและแผ่นงาน</span>
        </button>
      </div>

      {/* Settings Navigation Sub-Tabs bar */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1.5 rounded-xl gap-1">
        <button
          onClick={() => setSubTab("admins")}
          className={`flex-1 py-2 px-3.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            subTab === "admins"
              ? "bg-indigo-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
          }`}
        >
          <UserCheck size={14} />
          <span>ตั้งค่าสิทธิ์แอดมิน ({adminEmails.length})</span>
        </button>
        <button
          onClick={() => setSubTab("professors")}
          className={`flex-1 py-2 px-3.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            subTab === "professors"
              ? "bg-indigo-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
          }`}
        >
          <Database size={14} />
          <span>ฐานข้อมูลอาจารย์ ({professors.length})</span>
        </button>
        <button
          onClick={() => setSubTab("gas_integration")}
          className={`flex-1 py-2 px-3.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            subTab === "gas_integration"
              ? "bg-indigo-950 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/70"
          }`}
        >
          <Code size={14} />
          <span>เชื่อมต่อ Google Sheets API</span>
        </button>
      </div>

      {/* Global Success / Error Alerts */}
      {success && (
        <div className="p-3 bg-emerald-50 border-l-4 border-emerald-500 rounded-xl text-xs font-bold text-emerald-800 leading-normal flex items-center gap-2 shadow-sm animate-fadeIn">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border-l-4 border-rose-500 rounded-xl text-xs font-bold text-rose-800 leading-normal flex items-start gap-2 shadow-sm animate-fadeIn">
          <AlertTriangle size={18} className="text-rose-600 shrink-0 mt-0.5" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}

      {/* TAB CONTENT: ADMIN OPERATIONS */}
      {subTab === "admins" && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <UserCheck size={14} className="text-emerald-600" />
                <span>นโยบายสิทธิ์การเข้าถึงระดับระบบ (Role-Based Access Control)</span>
              </h3>
              <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed font-semibold font-sans">
                <li>
                  <strong className="text-indigo-900">Administrator (ผู้ดูแลระบบ):</strong> มีสิทธิ์เขียน อ่าน แก้ไข และลบข้อมูลเอกสารเข้า/ออก และจัดการแต่งตั้งสิทธิ์แอดมินเพิ่มเติมได้
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-3.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 leading-normal flex gap-2.5 items-start">
              <Info size={16} className="text-indigo-600 shrink-0 mt-0.5" />
              <div className="font-semibold font-sans">
                <strong>สิทธิ์เจ้าของหลัก (Primary Owner):</strong> สิทธิ์ผู้ดูแลระบบหลักสูงสุดปัจจุบันผูกกับบัญชี 
                <code className="mx-1 bg-indigo-50 font-mono text-indigo-800 px-1 border border-indigo-100 rounded">{primaryOwner}</code> 
                ซึ่งได้รับอำนาจสูงสุดในการแต่งตั้งหรือส่งมอบสิทธิ์ดูแลระบบต่อได้ในกรณีส่งมอบงานเพื่อการรักษาเสถียรภาพและปลอดภัยขั้นสูง
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 tracking-tight">แต่งตั้งผู้ดูแลระบบคนใหม่</h3>
                  <p className="text-[10px] text-slate-400 font-light mt-0.5 font-sans">ระบุอีเมลสถาบันเพื่อมอบสิทธิ์ลงนามและปรับปรุงเอกสาร</p>
                </div>

                {isAdmin ? (
                  <form onSubmit={handleAdminSubmit} className="space-y-4 text-xs font-semibold">
                    <div>
                      <label className="block text-slate-700 font-bold mb-1.5">อีเมลบัญชีผู้ใช้ (@bu.ac.th) <span className="text-rose-500">*</span></label>
                      <div className="relative">
                        <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                          <Mail size={14} />
                        </span>
                        <input
                          required
                          type="email"
                          placeholder="e.g. jirasak.p@bu.ac.th"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full h-10 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono text-slate-800"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="w-full h-10 bg-indigo-950 hover:bg-slate-900 text-white font-bold text-xs rounded-xl border border-slate-800 shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
                    >
                      <Plus size={15} />
                      มอบสิทธิ์ผู้ดูแลระบบ (Add Admin)
                    </button>
                  </form>
                ) : (
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex gap-2 font-semibold">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
                    <div>
                      <span className="font-bold block mb-0.5 text-amber-900">ปิดการแต่งตั้งสิทธิ์</span>
                      คุณกำลังรับชมด้วยระดับบัญชี Viewer (อ่านอย่างเดียว) เฉพาะผู้ใช้ที่ได้รับการแต่งตั้งในฐานะแอดมินเท่านั้นจึงจะสามารถมอบสิทธิ์ให้ผู้อื่นได้
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-3">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col justify-between h-full">
                <div>
                  <div className="p-5 border-b border-slate-100 bg-slate-50/70">
                    <h3 className="text-sm font-bold text-slate-800">รายชื่อแอดมินทั้งหมด ({adminEmails.length})</h3>
                    <p className="text-[10px] text-slate-400 font-light mt-0.5">บัญชีรายบุคคลที่มีสิทธิ์แก้ไขข้อมูลเอกสารใน วพ. BU</p>
                  </div>

                  <div className="divide-y divide-slate-100 max-h-[350px] overflow-y-auto">
                    {adminEmails.map((email) => {
                      const isPrimaryOwner = email === primaryOwner;
                      const isYou = email === currentUserEmail;

                      return (
                        <div key={email} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-1.5 bg-indigo-50 rounded-lg text-[#003366] shrink-0 border border-indigo-100">
                              <Mail size={15} />
                            </div>
                            <div className="min-w-0">
                              <span className="text-xs font-semibold text-slate-800 font-mono block truncate">
                                {email}
                              </span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {isPrimaryOwner && (
                                  <span className="text-[8px] bg-amber-100 border border-amber-200 text-amber-800 px-1 py-0.5 rounded font-bold uppercase tracking-wider font-sans flex items-center gap-0.5">
                                    <Shield size={8} />
                                    <span>Primary Owner</span>
                                  </span>
                                )}
                                {isYou && (
                                  <span className="text-[8px] bg-blue-100 border border-blue-200 text-blue-800 px-1 py-0.5 rounded font-bold uppercase tracking-wider font-sans">
                                    คุณ (You)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {isAdmin ? (
                            <div className="flex items-center gap-2">
                              {/* If I am the primary owner and this is another admin, I can transfer ownership to them */}
                              {currentUserEmail === primaryOwner && !isPrimaryOwner && (
                                <button
                                  type="button"
                                  onClick={() => setTransferTargetEmail(email)}
                                  className="h-7 px-2 bg-indigo-50 hover:bg-indigo-100 text-[#003366] border border-indigo-150 rounded-lg text-[9px] font-bold flex items-center gap-1 transition-all active:scale-95 shrink-0"
                                  title="โอนสิทธิ์ผู้ดูแลระบบหลักสูงสุดให้บัญชีนี้ (เช่น กรณีเกษียณอายุการทำงาน)"
                                >
                                  <Shield size={10} className="text-indigo-600" />
                                  <span>โอนสิทธิ์ Owner</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={isPrimaryOwner || isYou}
                                onClick={() => handleRemove(email)}
                                className={`p-2 rounded-lg border transition-all cursor-pointer shrink-0 ${
                                  isPrimaryOwner || isYou
                                    ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                                    : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100 hover:text-rose-700"
                                }`}
                                title={isPrimaryOwner ? "ระบบหลักไม่ได้รับอนุญาตให้ถอดถอน" : isYou ? "ไม่สามารถเพิกถอนตนเองได้" : "เพิกถอนสิทธิ์"}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-bold font-sans">ผู้ได้รับแต่งตั้ง</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400 font-medium font-sans">
                  การแต่งตั้งหรือเพิกถอนสิทธิ์จะทำการบันทึกลงสู่เซิร์ฟเวอร์ Firestore `admins` โดยตรงและมีผลทันทีเมื่อมีการเข้าใช้งานใหม่
                </div>
              </div>
            </div>
          </div>

          {/* User Simulation Board console */}
          {onSimulateUser && (
            <div id="developer-sandbox-console" className="bg-[#0f172a] text-slate-100 rounded-xl p-5 border border-slate-800 space-y-4 shadow-xl select-none">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></span>
                    <h3 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-sans">Developer Sandbox & QA Permission Console</h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-light mt-0.5">
                    จำลองสวมบทบาทสมาชิกสถาบัน เพื่อทำการทดสอบดูมุมมองของหน้าเอกสารในระดับสิทธิ์ต่างกัน
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => onSimulateUser("kittiwat.p@bu.ac.th", "อ.กิตติวัฒน์ โพธิ์งามบวรชัย")}
                  className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700/60 transition-all text-left group cursor-pointer text-xs font-sans"
                >
                  <span className="block font-black text-[#FFCC00] font-mono">kittiwat.p@bu.ac.th</span>
                  <span className="block text-[10px] text-slate-400 mt-1">แอดมินเจ้าของงานประเมินผลสูงสุุด (Admin)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSimulateUser("jirasak.p@bu.ac.th", "ผศ.จิรศักดิ์ เผือกคำ")}
                  className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700/60 transition-all text-left group cursor-pointer text-xs font-sans"
                >
                  <span className="block font-black text-sky-400 font-mono">jirasak.p@bu.ac.th</span>
                  <span className="block text-[10px] text-slate-400 mt-1">อาจารย์ผู้ยื่นคำร้องทั่วไป (Viewer เท่านั้น)</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSimulateUser("test-guest@bu.ac.th", "ผู้เข้าร่วมภายนอกจำลอง")}
                  className="bg-slate-800 hover:bg-slate-700 p-3 rounded-lg border border-slate-700/60 transition-all text-left group cursor-pointer text-xs font-sans"
                >
                  <span className="block font-black text-rose-400 font-mono">guest@bu.ac.th</span>
                  <span className="block text-[10px] text-slate-400 mt-1">สุ่มไอดีหน่วยงานอื่นพิจารณา (Viewer)</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === "professors" && (
        <div className="space-y-4 animate-fadeIn">
          {/* Header Action panel */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={14} />
              </span>
              <input
                type="text"
                placeholder="ค้นหารายชื่ออาจารย์ สังกัด รหัส หรืออีเมล..."
                value={profSearch}
                onChange={(e) => setProfSearch(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 transition-all placeholder:text-slate-400 font-sans"
              />
            </div>

            {isAdmin ? (
              <div className="flex items-center gap-2">
                {/* CSV File Import Button */}
                <label className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-nowrap select-none">
                  <FileSpreadsheet size={15} />
                  <span>นำเข้าไฟล์ CSV</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvImport}
                    className="hidden"
                  />
                </label>

                <button
                  type="button"
                  onClick={openAddProfModal}
                  className="h-9 px-4.5 bg-blue-900 hover:bg-[#002244] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all text-nowrap"
                >
                  <Plus size={15} />
                  <span>เพิ่มข้อมูลอาจารย์ท่านใหม่</span>
                </button>
              </div>
            ) : (
              <div className="text-[11px] p-2 bg-slate-50 border rounded-lg text-slate-400 font-semibold select-none">
                🔒 โหมดการเข้าชม (ผู้ดูแลระบบเท่านั้นที่มีสิทธิ์แก้ไข)
              </div>
            )}
          </div>

          {/* Grid/Table List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden select-text">
            {isProfLoading ? (
              <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                <RefreshCw size={24} className="animate-spin text-blue-900" />
                <span className="text-xs font-bold font-mono">กำลังประมวลผลข้อมูลโครงสร้าง...</span>
              </div>
            ) : filteredProfessors.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-1.5 select-none font-sans">
                <GraduationCap size={32} className="mx-auto text-slate-300" />
                <div className="text-xs font-bold text-slate-800">ไม่พบข้อมูลรายชื่ออาจารย์สังกัดในระบบ</div>
                <div className="text-[10px] text-slate-400">พิมพ์ระบุคำค้นอย่างอื่น หรือลงทะเบียนชื่ออาจารย์เพิ่ม</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse font-sans">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-200 select-none">
                      <th className="py-3 px-4 font-sans">ชื่อ-นามสกุล</th>
                      <th className="py-3 px-4 font-sans">รหัสบุคลากร</th>
                      <th className="py-3 px-4 font-sans">ตำแหน่ง</th>
                      <th className="py-3 px-4 font-sans">หน่วยงาน / สังกัด</th>
                      <th className="py-3 px-4 font-mono">อีเมล์</th>
                      <th className="py-3 px-4 font-sans">เบอร์โทรศัพท์</th>
                      <th className="py-3 px-4 text-center font-sans">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredProfessors.map((prof) => (
                      <tr key={prof.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900">{prof.name}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{prof.personalId || "-"}</td>
                        <td className="py-3 px-4 font-medium text-slate-600">{prof.position || "-"}</td>
                        <td className="py-3 px-4 font-medium">{prof.department}</td>
                        <td className="py-3 px-4 font-mono text-blue-900 font-bold">{prof.email}</td>
                        <td className="py-3 px-4 font-mono text-slate-500">{prof.phone || "-"}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditProfModal(prof)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-slate-900 rounded border border-slate-100 hover:border-slate-300 cursor-pointer text-xs"
                              title="แก้ไขข้อมูลอาจารย์"
                            >
                              <Edit size={12} />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => setProfToDelete(prof)}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded border border-rose-100 hover:border-rose-200 cursor-pointer text-xs"
                                title="ลบออกจากระบบสารบรรณ"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 font-medium leading-relaxed font-sans">
              💡 รายชื่อในฐานข้อมูลด้านบนจะผูกติดกับฟอร์มกรอกเอกสารสารบรรณทั้งหมด เมื่อมีผู้พิมพ์ป้อนชื่อในช่องรับ/ส่งข้อมูล <br />
              📊 โครงสร้างคอลัมน์ของไฟล์นำเข้า (.csv) ที่รองรับ: <b className="text-emerald-700">ชื่อ-นามสกุล, รหัสบุคลากร, ตำแหน่ง, หน่วยงาน, อีเมล์, โทรศัพท์</b> (ความยาวหัวแถวอย่างน้อย 4 คอลัมน์)
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: GOOGLE APPS SCRIPT MANUAL & CREDENTIAL SETUP */}
      {subTab === "gas_integration" && (
        <div className="space-y-6 animate-fadeIn">
          {/* Web App URL configurator Form */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 tracking-tight flex items-center gap-1.5">
                <FileSpreadsheet size={16} className="text-emerald-600" />
                <span>ที่อยู่ Google Apps Script Web App URL</span>
              </h3>
              <p className="text-[10.5px] text-slate-500 font-light mt-0.5 leading-normal">
                ระบุที่อยู่ลิงก์เว็บแอปที่ได้จากการ Deploy ใน Google Apps Script เพื่อเปิดใช้งานการเซฟและดึงข้อมูลจากตาราง Google Sheets ของวิทยาลัยโดยตรงอินทิเกรตแบบเรียลไทม์
              </p>
            </div>

            <form onSubmit={handleSaveGasUrl} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1 font-mono uppercase tracking-wider">
                  Apps Script Web App Endpoint URL <span className="text-rose-500">*</span>
                </label>
                <div className="flex gap-2.5">
                  <input
                    required
                    type="url"
                    placeholder="เช่น https://script.google.com/macros/s/AKfycb.../exec"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    className="flex-1 h-9.5 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono shadow-inner text-slate-800"
                  />
                  <button
                    type="submit"
                    className="h-9.5 px-4.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-sm active:scale-95 text-nowrap"
                  >
                    บันทึกพารามิเตอร์
                  </button>
                </div>
              </div>
            </form>

            {gasUrl && (
              <div className="pt-2 flex flex-col gap-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={testGasConnection}
                    disabled={isTestingGas}
                    className="h-8 px-3 ml-0 border border-blue-200 hover:bg-blue-50 text-blue-900 rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-97 disabled:opacity-50 shrink-0"
                  >
                    <RefreshCw size={11} className={isTestingGas ? "animate-spin text-blue-600" : ""} />
                    <span>{isTestingGas ? "กำลังยืนยันสัญญาณ..." : "⚡️ คลิกเพื่อทดสอบระบบดึงข้อมูล (GET Connection Test)"}</span>
                  </button>
                  <p className="text-[10px] text-slate-400 font-medium">
                    * ตรวจสอบว่า API ในแผ่นงาน Google Sheets ปลายทางของคุณออนไลน์และสามารถผ่านกระบวนการ CORS ได้ปกติหรือไม่
                  </p>
                </div>

                {gasTestResult && (
                  <div className={`p-4 rounded-xl border text-[11px] font-semibold leading-normal animate-fadeIn ${
                    gasTestResult.status === "success"
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-rose-50 border-rose-100 text-rose-800"
                  }`}>
                    {gasTestResult.message}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Code.gs Copy Instructions Box */}
          <div className="bg-slate-900 text-slate-100 rounded-2xl overflow-hidden border border-slate-800 shadow-xl space-y-0">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3.5 select-none">
              <div>
                <h4 className="text-xs font-bold text-white tracking-widest uppercase flex items-center gap-1.5 font-mono">
                  <Code size={13} className="text-[#FFCC00]" />
                  <span>Google Apps Script Deployment Template (Code.gs)</span>
                </h4>
                <p className="text-[10px] text-slate-400 font-light mt-0.5 font-sans leading-normal font-sans">
                  คัดลอกไฟล์สคริปต์ด้านล่างนี้ และนำไปติดตั้งที่เมนู Apps Script ของสมุดงานบัญชี Google Sheets ของคุณ
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE);
                  setIsCodeCopied(true);
                  setTimeout(() => setIsCodeCopied(false), 2500);
                }}
                className={`h-8 px-3.5 rounded-lg text-xs flex items-center gap-1 font-bold cursor-pointer transition-all ${
                  isCodeCopied ? "bg-emerald-600 text-white animate-pulse" : "bg-slate-800 hover:bg-slate-700 text-[#FFCC00] hover:text-white border border-slate-700"
                }`}
              >
                {isCodeCopied ? (
                  <>
                    <Check size={13} className="text-white" />
                    <span>คัดลอกรหัสสำเร็จ!</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>📋 คัดลอกไฟล์ Code.gs</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-4 space-y-3.5 text-[11px] leading-relaxed border-b border-slate-800 bg-slate-950/40 select-none text-slate-300 font-sans">
              <strong className="text-indigo-300 font-sans text-xs block text-slate-100">ขั้นตอนเชื่อมแผนบริการกับ Google Sheets:</strong>
              <ol className="list-decimal pl-4 space-y-1 font-sans font-medium text-slate-300">
                <li>เปิด Google Sheet ปลายทางสร้างตารางสถาบันธรรมดา และทำการล้างชื่อแท็บหลักให้ตั้งตรงเป็นชื่อ <code className="bg-slate-800 px-1.5 rounded text-white border border-slate-700 font-semibold font-mono text-[9.5px]">Database</code></li>
                <li>ใส่หัวข้อแถวแรกจากซ้ายไปขวา: คอลัมน์ A เป็น `ID`, คอลัมน์ B เป็น `ชื่อ-นามสกุล`, คอลัมน์ C เป็น `หน่วยงาน`, คอลัมน์ D เป็น `อีเมล`</li>
                <li>ไปที่เมนู <strong className="text-white">ส่วนขยาย (Extensions)</strong> &gt; <strong className="text-white">Apps Script</strong></li>
                <li>ลบรหัสเริ่มต้นที่มีอยู่ออกทั้งหมด และนำรหัสสคริปต์นี้ไปปะวาง จากนั้นกดบันทึก</li>
                <li>กดเลือกใช้งานจริง (Deploy) &gt; จัดการการใช้งานใหม่ (New Deployment) เสียบโครงเป็นประเภท <strong className="text-[#FFCC00]">เว็บแอป (Web App)</strong></li>
                <li>กรอกช่อง Who has access: ให้เปลี่ยนเป็นประเภท <strong className="text-emerald-400">ทุกคน (Anyone)</strong> จากนั้นอนุญาตสิทธิ์สถาบัน</li>
                <li>คัดลอก URL ที่ได้ กลับมาบันทึกพารามิเตอร์ด้านบนหน้าเว็บแอปนี้เป็นอันเสร็จเรียบร้อย!</li>
              </ol>
            </div>

            <div className="p-4 font-mono text-[10.5px] bg-slate-950 max-h-[350px] overflow-y-auto whitespace-pre overflow-x-auto text-yellow-100 select-text leading-normal">
              {GOOGLE_APPS_SCRIPT_CODE}
            </div>
          </div>
        </div>
      )}

      {/* PROFESSOR FORM MODAL */}
      {showProfModal && (
        <div id="prof-form-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleProfSubmit}
            className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-zoomIn text-xs font-semibold"
          >
            <div className="bg-[#002244] p-4 text-white flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <GraduationCap size={18} className="text-[#FFCC00] shrink-0" />
                <div>
                  <span className="text-[8.5px] text-blue-200 font-bold block tracking-wider uppercase">การขึ้นทะเบียนนักการศึกษา</span>
                  <h4 className="font-bold text-sm text-white mt-0.5">
                    {editingProf ? "แก้ไขข้อมูลรายชื่ออาจารย์" : "ลงทะเบียนอาจารย์ท่านใหม่"}
                  </h4>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {profError && (
                <div className="p-3 bg-rose-50 border-l-3 border-rose-500 rounded text-[10.5px] text-rose-800 leading-normal font-sans">
                  ⚠️ {profError}
                </div>
              )}

              {/* Input: Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  ชื่อ-นามสกุลอาจารย์ (เต็ม) <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="เช่น ดร.พณพงศ์ สงสุทธะวัลย์"
                  value={profName}
                  onChange={(e) => setProfName(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Input: Personal ID */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  รหัสบุคลากร
                </label>
                <input
                  type="text"
                  placeholder="เช่น 108XXXXX"
                  value={profPersonalId}
                  onChange={(e) => setProfPersonalId(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                />
              </div>

              {/* Input: Position */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  ตำแหน่งวิชาการ
                </label>
                <input
                  type="text"
                  placeholder="เช่น รองศาสตราจารย์ / อาจารย์ผู้สอน"
                  value={profPosition}
                  onChange={(e) => setProfPosition(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Input: Department */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  สังกัด / สำนักงานหน่วยงาน <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="เช่น สายวิจัยและพัฒนานวัตกรรมการศึกษา"
                  value={profDept}
                  onChange={(e) => setProfDept(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Input: Email */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  อีเมลบัญชีสถาบัน (@bu.ac.th) <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="email"
                  placeholder="เช่น owner@bu.ac.th"
                  value={profEmail}
                  onChange={(e) => setProfEmail(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                />
              </div>

              {/* Input: Phone */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 font-sans">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="text"
                  placeholder="เช่น 02-350-XXXX"
                  value={profPhone}
                  onChange={(e) => setProfPhone(e.target.value)}
                  className="w-full text-xs h-9 px-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono font-semibold"
                />
              </div>
            </div>

            <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex justify-end gap-2.5 select-none">
              <button
                type="button"
                onClick={() => setShowProfModal(false)}
                className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer active:scale-98"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isProfLoading}
                className="h-9 px-4.5 bg-blue-900 hover:bg-[#002244] text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm active:scale-98 disabled:opacity-50"
              >
                {isProfLoading ? "กำลังประมวลผล..." : "บันทึกข้อมูล"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CONFIRM DELETION MODAL */}
      {emailToRemove && (
        <div id="delete-admin-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-zoomIn text-xs font-semibold">
            <div className="bg-rose-900 p-4 text-white flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-yellow-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-rose-200 font-bold block tracking-wider uppercase">ยืนยันการตั้งค่าระบบ</span>
                  <h4 className="font-bold text-sm text-white mt-0.5">เพิกถอนสิทธิ์ผู้ดูแลระบบ (Admin)</h4>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-3.5">
              <p className="text-slate-700 leading-relaxed font-semibold">
                คุณแน่ใจหรือไม่ที่จะทำการเพิกถอนสิทธิ์ผู้ดูแลระบบจากบัญชีอีเมลสถาบันนี้:
              </p>
              
              <div className="bg-slate-100 p-3 rounded-lg border border-slate-200 text-center">
                <span className="font-mono text-slate-800 font-bold break-all text-xs">
                  {emailToRemove}
                </span>
              </div>

              {emailToRemove === currentUserEmail && (
                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 text-[#b25e00] font-bold leading-normal">
                  ⚠️ คำเตือนสำคัญ: บัญชีนี้คือบัญชีปัจจุบันของคุณเอง หากยืนยันการทำรายการคุณจะถูกลดเหลือสิทธิ์ระดับ "ผู้เข้าชมทั่วไป (Viewer)" ทันที และจะไม่มีสิทธิ์จัดการหรือแก้ไขข้อมูลได้อีก!
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-normal font-light">
                * บัญชีนี้จะไม่สามารถเข้าถึงแก้ไขหรือจัดส่งเอกสารนำส่งได้อีกต่อไป แต่จะยังสามารถสแกน ค้นหา และดูเอกสารต่างๆ ในระบบได้ตามสิทธิ์ Viewer Mode ทั่วไป
              </p>
            </div>

            <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEmailToRemove(null)}
                className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer active:scale-98"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm active:scale-98"
              >
                ยืนยันเพิกถอน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM PROFESSOR DELETION MODAL */}
      {profToDelete && (
        <div id="delete-prof-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-zoomIn text-xs font-semibold">
            <div className="bg-rose-900 p-4 text-white flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-yellow-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-rose-200 font-bold block tracking-wider uppercase">ลบข้อมูลอาจารย์</span>
                  <h4 className="font-bold text-sm text-white mt-0.5">ยืนยันการลบข้อมูลอาจารย์</h4>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-3.5">
              <p className="text-slate-700 leading-relaxed font-semibold">
                คุณแน่ใจหรือไม่ที่จะลบข้อมูลของอาจารย์ท่านนี้ออกจากระบบ?
              </p>
              
              <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900 text-sm text-center">
                  {profToDelete.name}
                </div>
                {profToDelete.department && (
                  <div className="text-center text-[11px] text-slate-500 font-medium">
                    สังกัด: {profToDelete.department}
                  </div>
                )}
                {profToDelete.email && (
                  <div className="text-center text-[11.5px] text-[#003366] font-mono font-bold">
                    อีเมล: {profToDelete.email}
                  </div>
                )}
              </div>

              <p className="text-[10px] text-slate-400 leading-normal font-light">
                * การลบข้อมูลนี้จะส่งผลให้ชื่อของอาจารย์ไม่ปรากฏในฟอร์มเลือกข้อมูลใหม่ และจะพยายามลบข้อมูลซิงค์ออกจากแผ่นงาน Google Sheets
              </p>
            </div>

            <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProfToDelete(null)}
                className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer active:scale-98"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => handleProfDelete(profToDelete.id, profToDelete.name)}
                className="h-9 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm active:scale-98"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM TRANSFER PRIMARY OWNER MODAL */}
      {transferTargetEmail && (
        <div id="transfer-owner-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-md shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-zoomIn text-xs font-semibold">
            <div className="bg-indigo-950 p-4 text-white flex justify-between items-center select-none">
              <div className="flex items-center gap-2">
                <Shield size={18} className="text-amber-400 shrink-0" />
                <div>
                  <span className="text-[9px] text-indigo-300 font-bold block tracking-wider uppercase">แต่งตั้ง / ย้ายสิทธิ์ผู้ดูแลระบบหลัก</span>
                  <h4 className="font-bold text-sm text-white mt-0.5">ยืนยันการส่งมอบสิทธิ์ดูแลหลักสูงสุด (Owner Transfer)</h4>
                </div>
              </div>
            </div>
            
            <div className="p-5 space-y-4 font-sans">
              <p className="text-slate-700 leading-relaxed font-semibold">
                คุณแน่ใจหรือไม่ที่จะทำการโอนย้ายความรับผิดชอบหลัก สูงสุดของระบบประเมินเอกสารสิทธิ์ วพ. BU ให้แก่ผู้ดูแลท่านนี้?
              </p>
              
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 space-y-2">
                <div className="font-bold text-amber-800 text-xs flex items-center gap-1">
                  <AlertTriangle size={15} />
                  <span>คำเตือนเนื่องจากการเกษียณสิทธิ์หรือการส่งมอบงาน:</span>
                </div>
                <ul className="list-disc pl-4 text-[11px] text-amber-900 font-medium space-y-1">
                  <li>บัญชี <strong className="font-mono">{transferTargetEmail}</strong> จะกลายเป็นผู้ดูแลหลักสูงสุด (Primary Owner)</li>
                  <li>ระบบความปลอดภัยจะไม่สามารถเพิกถอนสิทธิ์ หรือลบสัญญาสิทธิ์ของเจ้าของหลักคนใหม่นี้ได้</li>
                  <li>สิทธิ์ของคุณจะเปลี่ยนเป็นผู้ดูแลทั่วไป (Administrator) และไม่สามารถโอนสิทธิ์กลับคืนได้ด้วยตนเอง จนกว่าเจ้าของหลักท่านใหม่จะดำเนินการคืนสิทธิ์ให้คุณ</li>
                </ul>
              </div>
            </div>

            <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex justify-end gap-2.5 font-sans">
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => setTransferTargetEmail(null)}
                className="h-9 px-4 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer active:scale-98 disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={isTransferring}
                onClick={handleTransferConfirm}
                className="h-9 px-4 bg-indigo-950 hover:bg-slate-900 border border-indigo-900 text-white rounded-lg font-bold transition-all cursor-pointer shadow-sm active:scale-98 flex items-center gap-1.5 disabled:opacity-50"
              >
                {isTransferring ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>กำลังดำเนินการ...</span>
                  </>
                ) : (
                  <>
                    <Check size={13} />
                    <span>ยืนยันและส่งมอบงาน</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
