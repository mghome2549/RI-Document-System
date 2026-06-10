import { useState, useEffect, FormEvent } from "react";
import { Document, DocumentStatus, DocumentPriority, DocumentCategory } from "../types";
import { getAcademicYear, formatThaiDate, isReceivedMoreThan5DaysAgo, formatRiRefNo } from "../utils/academicYear";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  FileText,
  X,
  Calendar,
  Layers,
  Info,
  CheckCircle,
  Clock,
  Inbox,
  Send,
  ExternalLink
} from "lucide-react";

interface InboxTableProps {
  documents: Document[];
  onAddDoc: (doc: Document) => void;
  onEditDoc: (doc: Document) => void;
  onDeleteDoc: (id: string) => void;
  userRole: "admin" | "viewer";
  selectedFilterYear: number | "all";
  setSelectedFilterYear?: (year: number | "all") => void;
  onForwardDoc?: (doc: Document) => void;
}

export default function InboxTable({
  documents,
  onAddDoc,
  onEditDoc,
  onDeleteDoc,
  userRole,
  selectedFilterYear,
  setSelectedFilterYear,
  onForwardDoc
}: InboxTableProps) {
  const isAdmin = userRole === "admin";

  // Filter only inbox documents overall
  const inboxDocs = documents.filter((d) => d.category === DocumentCategory.INBOX);

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Add/Edit modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);

  // Prompt 2 - Document entry form states
  const [formTitle, setFormTitle] = useState("");
  const [formBookNumber, setFormBookNumber] = useState("");
  const [formSender, setFormSender] = useState("");
  const [formDepartment, setFormDepartment] = useState("");
  const [formDocType, setFormDocType] = useState<"e-mail" | "paper">("e-mail");
  const [formReceivedDate, setFormReceivedDate] = useState("");
  const [formStatus, setFormStatus] = useState<string>("อยู่ระหว่างพิจารณา");
  const [formExecutiveDate, setFormExecutiveDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDriveLink, setFormDriveLink] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState<number>(2568);

  const [duplicateWarning, setDuplicateWarning] = useState(false);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);

  useEffect(() => {
    if (!formBookNumber.trim() || !isModalOpen) {
      setDuplicateWarning(false);
      setConfirmDuplicate(false);
      return;
    }
    const normInput = formBookNumber.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
    if (!normInput) {
      setDuplicateWarning(false);
      setConfirmDuplicate(false);
      return;
    }

    const hasDup = documents.some((d) => {
      if (d.academicYear !== formAcademicYear) return false;
      if (d.category !== DocumentCategory.INBOX) return false;
      if (editingDoc && d.id === editingDoc.id) return false;
      const normExisting = (d.bookNumber || d.number || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
      return normExisting === normInput;
    });

    setDuplicateWarning(hasDup);
    if (!hasDup) {
      setConfirmDuplicate(false);
    }
  }, [formBookNumber, formAcademicYear, documents, isModalOpen, editingDoc]);

  // Prompt 3 - Export states
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [docToExport, setDocToExport] = useState<Document | null>(null);
  const [formExportDispatchDate, setFormExportDispatchDate] = useState("");
  const [formExportReceiverName, setFormExportReceiverName] = useState("");
  const [formExportReceiverDepartment, setFormExportReceiverDepartment] = useState("");
  const [formExportNotes, setFormExportNotes] = useState("");

  const handleOpenExport = (doc: Document) => {
    setDocToExport(doc);
    const today = new Date().toISOString().split("T")[0];
    setFormExportDispatchDate(today);
    setFormExportReceiverName("");
    setFormExportReceiverDepartment("");
    setFormExportNotes("");
    setIsExportModalOpen(true);
  };

  const handleExportSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!docToExport) return;
    if (!formExportDispatchDate || !formExportReceiverName.trim() || !formExportReceiverDepartment.trim()) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    // Validation: dispatch date must not be before received date
    const rDateStr = docToExport.receivedDate || docToExport.receiveDate || "";
    const rDate = new Date(rDateStr);
    rDate.setHours(0, 0, 0, 0);
    const dDate = new Date(formExportDispatchDate);
    dDate.setHours(0, 0, 0, 0);

    if (dDate < rDate) {
      alert(`วันที่ส่งออกห้ามย้อนหลังไปก่อนวันที่รับเอกสาร (${formatThaiDate(rDateStr)})`);
      return;
    }

    const payload: Document = {
      ...docToExport,
      status: "ดำเนินการแล้ว/ส่งออกแล้ว",
      dispatchDate: formExportDispatchDate,
      receiverName: formExportReceiverName.trim(),
      receiverDepartment: formExportReceiverDepartment.trim(),
      exportNotes: formExportNotes.trim(),
      updatedAt: new Date().toISOString()
    };

    onEditDoc(payload);
    setIsExportModalOpen(false);
  };


  // Auto-ID generator based on counting records of the current selected academic year
  const generateVopId = (yearForId: number): string => {
    // Filter inbox documents that are in this academic year
    const inboxInYear = documents.filter(
      (d) => d.category === DocumentCategory.INBOX && d.academicYear === yearForId
    );
    // Sequence starts back at 001 if none exist.
    // e.g. Count + 1
    const nextNum = inboxInYear.length + 1;
    const paddedNum = String(nextNum).padStart(3, "0");
    return `วพ. ${paddedNum}/${yearForId}`;
  };

  // Re-calculate academic year automatically when the received date changes
  useEffect(() => {
    if (formReceivedDate) {
      const selectedDate = new Date(formReceivedDate);
      if (!isNaN(selectedDate.getTime())) {
        const yr = getAcademicYear(selectedDate);
        setFormAcademicYear(yr);
      }
    } else {
      setFormAcademicYear(getAcademicYear(new Date()));
    }
  }, [formReceivedDate]);

  // Handle open add modal
  const handleOpenAdd = () => {
    setEditingDoc(null);
    setFormTitle("");
    setFormBookNumber("");
    setFormSender("");
    setFormDepartment("");
    setFormDocType("e-mail");
    const today = new Date().toISOString().split("T")[0];
    setFormReceivedDate(today);
    setFormStatus("อยู่ระหว่างพิจารณา");
    setFormExecutiveDate("");
    setFormNotes("");
    setFormDriveLink("");
    setDuplicateWarning(false);
    setConfirmDuplicate(false);
    setIsModalOpen(true);
  };

  // Handle open edit modal
  const handleOpenEdit = (doc: Document) => {
    setEditingDoc(doc);
    setFormTitle(doc.title);
    setFormBookNumber(doc.bookNumber || doc.number);
    setFormSender(doc.sender);
    setFormDepartment(doc.department || "");
    setFormDocType((doc.docType as "e-mail" | "paper") || "e-mail");
    setFormReceivedDate(doc.receivedDate || doc.receiveDate);
    setFormStatus(doc.status || "อยู่ระหว่างพิจารณา");
    setFormExecutiveDate(doc.executiveDate || "");
    setFormNotes(doc.notes || "");
    setFormDriveLink(doc.driveLink || "");
    setFormAcademicYear(doc.academicYear);
    setDuplicateWarning(false);
    setConfirmDuplicate(false);
    setIsModalOpen(true);
  };

  const handleEditIncoming = (item: Document) => {
    handleOpenEdit(item);
  };

  const handleForwardToOutbox = (item: Document) => {
    if (onForwardDoc) {
      onForwardDoc(item);
    }
  };

  // Submit new logic mapping
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formSender.trim() || !formReceivedDate) {
      alert("กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน");
      return;
    }

    if (duplicateWarning && !confirmDuplicate) {
      alert("คำเตือน: เลขที่หนังสือนี้มีการลงทะเบียนไว้แล้วในปีการศึกษานี้ กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    // Determine vopId: if editing, keep original. If new, generate sequential.
    const selectedYear = selectedFilterYear !== "all" ? selectedFilterYear : formAcademicYear;
    let finalVopId = "";
    if (editingDoc) {
      finalVopId = editingDoc.vopId || editingDoc.number || generateVopId(selectedYear);
    } else {
      finalVopId = generateVopId(selectedYear);
    }

    const payload: Document = {
      id: editingDoc ? editingDoc.id : `inbox-${Date.now()}`,
      title: formTitle.trim(),
      number: formBookNumber.trim(), // for backward compatibility
      sender: formSender.trim(),
      receiver: editingDoc ? editingDoc.receiver : "รองอธิการบดีสายวิจัยและพัฒนานวัตกรรมการศึกษา (รอง วพ.)",
      receiveDate: formReceivedDate, // for backward compatibility
      academicYear: selectedYear,
      status: editingDoc ? (editingDoc.status || "อยู่ระหว่างพิจารณา") : formStatus,
      priority: editingDoc ? editingDoc.priority : DocumentPriority.NORMAL,
      category: DocumentCategory.INBOX,
      notes: formNotes.trim() || undefined,
      driveLink: formDriveLink.trim() || undefined,
      createdAt: editingDoc ? editingDoc.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),

      // Prompt 2 specific attributes
      vopId: finalVopId,
      bookNumber: formBookNumber.trim(),
      receivedDate: formReceivedDate,
      department: formDepartment.trim() || undefined,
      docType: formDocType,
      executiveDate: (editingDoc ? (editingDoc.status || "อยู่ระหว่างพิจารณา") : formStatus) !== "อยู่ระหว่างพิจารณา" && formExecutiveDate ? formExecutiveDate : undefined
    };

    if (editingDoc) {
      onEditDoc(payload);
    } else {
      onAddDoc(payload);
    }
    setIsModalOpen(false);
  };

  // Compute SLA failure checks dynamically for table rows
  const isDocLate = (doc: Document) => {
    const isApproved = doc.status !== "อยู่ระหว่างพิจารณา";
    const recDate = doc.receivedDate || doc.receiveDate;
    return !isApproved && isReceivedMoreThan5DaysAgo(recDate);
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "อยู่ระหว่างพิจารณา") {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (status === "ดำเนินการแล้ว/ส่งออกแล้ว") {
      return "bg-slate-50 text-slate-500 border-slate-200 bg-opacity-50";
    }
    if (status === "อนุมัติ" || status === "approved" || status === "normal" || status === DocumentPriority.NORMAL || status === DocumentStatus.COMPLETED) {
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
    if (status === "ลงนามแล้ว" || status === "urgent" || status === DocumentPriority.URGENT) {
      return "bg-indigo-50 text-indigo-800 border-indigo-200";
    }
    if (status === "พิจารณาแล้ว" || status === "very_urgent" || status === DocumentPriority.VERY_URGENT) {
      return "bg-teal-50 text-teal-800 border-teal-200";
    }
    return "bg-slate-50 text-slate-800 border-slate-200";
  };

  const getStatusLabel = (status: string) => {
    if (status === "approved" || status === DocumentStatus.COMPLETED) {
      return "พิจารณาแล้ว";
    }
    if (status === "normal" || status === DocumentPriority.NORMAL) {
      return "อนุมัติ";
    }
    if (status === "urgent" || status === DocumentPriority.URGENT) {
      return "ลงนามแล้ว";
    }
    if (status === "very_urgent" || status === DocumentPriority.VERY_URGENT) {
      return "พิจารณาแล้ว";
    }
    return status;
  };

  // Filters application
  const filteredDocs = inboxDocs.filter((doc) => {
    // 1. Year filter
    if (selectedFilterYear !== "all" && doc.academicYear !== selectedFilterYear) {
      return false;
    }
    // 2. Status filter
    if (statusFilter !== "all") {
      if (statusFilter === "late") {
        if (!isDocLate(doc)) return false;
      } else {
        if (getStatusLabel(doc.status) !== statusFilter) return false;
      }
    }
    // 3. Search matching
    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      const formattedVopId = formatRiRefNo(doc.vopId || doc.number, doc.academicYear);
      const matchVop = (doc.vopId || "").toLowerCase().includes(s) || formattedVopId.toLowerCase().includes(s);
      const matchTitle = (doc.title || "").toLowerCase().includes(s);
      const matchNum = (doc.bookNumber || doc.number || "").toLowerCase().includes(s);
      const matchSend = (doc.sender || "").toLowerCase().includes(s);
      const matchDept = (doc.department || "").toLowerCase().includes(s);
      return matchVop || matchTitle || matchNum || matchSend || matchDept;
    }
    return true;
  });

  return (
    <div id="inbox-tracker" className="space-y-4 font-sans text-slate-800">
      {/* Table Title and Actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#003366] tracking-tight">Incoming Documents (เอกสารเข้า)</h2>
          <p className="text-xs text-slate-500 font-semibold mt-1">
            Documents for Vice President of RI (การพิจารณา: พิจารณาแล้ว / อยู่ระหว่างพิจารณา)
          </p>
        </div>

        {/* Actions Button container */}
        <div className="flex items-center gap-2.5 flex-wrap self-start sm:self-auto">
          {isAdmin ? (
            <button
              onClick={handleOpenAdd}
              className="h-10 px-4 bg-[#003366] hover:bg-[#002244] text-white font-bold text-xs rounded-lg shadow-sm border border-[#003366] hover:border-[#002244] flex items-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Plus size={16} />
              เพิ่มเอกสารเข้า (Inbox)
            </button>
          ) : (
            <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-1.5 font-semibold">
              <Info size={12} className="shrink-0 text-amber-600" />
              <span>โหมด View-Only</span>
            </div>
          )}
        </div>
      </div>

      {/* Filter and Search Utility Board */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Bar */}
          <div className="relative md:col-span-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="ค้นหา RI Ref No., ผู้ส่ง, หน่วยงาน..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#003366]"
            />
          </div>

          {/* Status filter selection */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
            >
              <option value="all">กรองตามการพิจารณา: ทั้งหมด</option>
              <option value="อยู่ระหว่างพิจารณา">อยู่ระหว่างพิจารณา</option>
              <option value="อนุมัติ">อนุมัติ</option>
              <option value="ลงนามแล้ว">ลงนามแล้ว</option>
              <option value="พิจารณาแล้ว">พิจารณาแล้ว</option>
              <option value="ดำเนินการแล้ว/ส่งออกแล้ว">ดำเนินการแล้ว/ส่งออกแล้ว</option>
              <option value="late">เกินเวลาพิจารณา (Late {`>`} 5 วัน)</option>
            </select>
          </div>

          {/* Academic Year filter selection (The Handover Archive requirement) */}
          <div>
            <select
              value={selectedFilterYear}
              onChange={(e) => setSelectedFilterYear?.(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="w-full h-10 bg-slate-50 text-slate-600 border border-slate-200 text-xs font-bold rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
            >
              <option value="all">กรองปีการศึกษา: ทั้งหมด (All)</option>
              {[2568, 2567, 2566, 2565, 2564].filter((yr) => yr < 2564 || yr > 2567).map((yr) => (
                <option key={yr} value={yr}>
                  ปีการศึกษา {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Interface */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto overflow-y-hidden">
          <table className="w-full text-left text-xs text-slate-700 font-sans">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5 whitespace-nowrap">RI Ref No.</th>
                <th className="px-4 py-3.5 whitespace-nowrap">วันที่รับ</th>
                <th className="px-4 py-3.5 whitespace-nowrap">เลขที่หนังสือ</th>
                <th className="px-4 py-3.5">ผู้ส่ง (หน่วยงาน)</th>
                <th className="px-4 py-3.5">รายละเอียด</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ประเภท</th>
                <th className="px-4 py-3.5 whitespace-nowrap">การพิจารณา</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase font-sans tracking-wider">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => {
                  const lateRow = isDocLate(doc);
                  return (
                    <tr 
                      key={doc.id} 
                      onClick={() => isAdmin && handleOpenEdit(doc)}
                      className={`transition-colors border-b border-slate-100 ${
                        lateRow ? "bg-red-50 hover:bg-red-100/60" : "hover:bg-slate-50/70"
                      } ${isAdmin ? "cursor-pointer" : ""}`}
                    >
                      {/* Column 1: เลขที่ วพ. */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-[#003366]">{formatRiRefNo(doc.vopId || doc.number, doc.academicYear)}</div>
                        <div className="text-[9px] text-[#003366]/60 font-semibold mt-0.5">ปีการศึกษา {doc.academicYear}</div>
                      </td>
                      
                      {/* Column 2: วันที่รับ */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                        {formatThaiDate(doc.receivedDate || doc.receiveDate)}
                      </td>
                      
                      {/* Column 3: เลขที่หนังสือ */}
                      <td className="px-4 py-3.5 whitespace-nowrap font-semibold text-slate-700">
                        {doc.bookNumber || doc.number || <span className="text-slate-400 font-normal italic">-</span>}
                      </td>
                      
                      {/* Column 4: ผู้ส่ง */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-800">{doc.sender}</div>
                        {doc.department && (
                          <div className="text-[10px] text-slate-500 mt-0.5">หน่วยงานเจ้าของเรื่อง: {doc.department}</div>
                        )}
                      </td>
                      
                      {/* Column 5: รายละเอียด */}
                      <td className="px-4 py-3.5 font-medium text-slate-700 max-w-xs">
                        <div className="flex items-start flex-wrap gap-1.5 mb-1">
                          <span className="line-clamp-2" title={doc.title}>{doc.title}</span>
                          {doc.driveLink && (
                            <a
                              href={doc.driveLink}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-900 border border-blue-200 rounded text-[10px] font-bold cursor-pointer transition-colors shrink-0 font-sans"
                            >
                              <ExternalLink size={10} />
                              <span>เปิดไฟล์</span>
                            </a>
                          )}
                        </div>
                        {doc.notes && (
                          <div className="text-[10.5px] italic text-[#003366] mt-1.5 font-semibold">
                            โน้ตเพิ่มเติม: {doc.notes}
                          </div>
                        )}
                      </td>
                      
                      {/* Column 6: ประเภท */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${
                          (doc.docType || "paper") === "e-mail" 
                            ? "bg-blue-50 text-blue-700 border-blue-200" 
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}>
                          {doc.docType || "paper"}
                        </span>
                      </td>
                      
                      {/* Column 7: สถานะ */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`px-2 py-0.5 text-[10px] rounded font-bold border ${getStatusBadgeClass(doc.status)}`}>
                            {getStatusLabel(doc.status)}
                          </span>
                          
                          {/* SLA Notification Badge */}
                          {lateRow && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded font-extrabold bg-red-100 text-red-700 border border-red-300 uppercase animate-pulse flex items-center gap-0.5">
                              <AlertTriangle size={8} />
                              <span>Late (เกิน 5 วัน)</span>
                            </span>
                          )}

                          {/* Export status Details */}
                          {doc.status === "ดำเนินการแล้ว/ส่งออกแล้ว" && doc.receiverName && (
                            <div className="text-[9px] text-[#003366] mt-0.5 font-bold flex flex-col">
                              <span>ส่งถึง: {doc.receiverName}</span>
                              {doc.dispatchDate && (
                                <span className="text-slate-400 font-normal">({formatThaiDate(doc.dispatchDate)})</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      
                      {/* Column 8: จัดการ */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button 
                          onClick={() => handleEditIncoming(doc)} 
                          className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition flex items-center justify-center h-8 w-8" 
                          title="แก้ไขข้อมูล"
                        >
                          ✏️
                        </button>
                        <button 
                          onClick={() => handleForwardToOutbox(doc)} 
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg transition"
                        >
                          📄 ส่งเอกสารออก
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              if (confirm(`คุณต้องการลบเอกสารเลขที่ ${formatRiRefNo(doc.vopId || doc.number, doc.academicYear)} นี้ใช่หรือไม่?`)) {
                                onDeleteDoc(doc.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                            title="ลบเอกสาร"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText size={32} className="text-slate-300" />
                      <span className="font-semibold">ไม่พบข้อมูลเอกสารเข้า</span>
                      <span className="text-[11px] text-slate-400">ลองเปลี่ยนแปลงค่าตัวคัดกรอง หรือกดเพิ่มเอกสารใหม่</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer Stats counts */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-col sm:flex-row justify-between items-center text-[10px] text-slate-500 font-semibold gap-2">
          <span>แสดง {filteredDocs.length} จาก {inboxDocs.length} เอกสารเข้าทั้งหมด</span>
          <span className="flex items-center gap-3 text-slate-500 text-[10px]">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>{inboxDocs.filter(d => d.status !== "อยู่ระหว่างพิจารณา").length} พิจารณาแล้ว/อนุมัติ</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span>{inboxDocs.filter(d => d.status === "อยู่ระหว่างพิจารณา" && !isDocLate(d)).length} อยู่ระหว่างพิจารณา</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
              <span>{inboxDocs.filter(d => isDocLate(d)).length} เกินเวลาพิจารณา</span>
            </span>
          </span>
        </div>
      </div>

      {/* REACTIVE ADD & EDIT OVERLAYS */}
      {isModalOpen && (
        <div id="inbox-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoomIn border border-slate-200 flex flex-col max-h-[95vh]">
            {/* Modal Header */}
            <div className="bg-[#003366] p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white">
                  {editingDoc ? `แก้ไขเอกสาร RI Ref No.: ${formatRiRefNo(editingDoc.vopId || editingDoc.number, editingDoc.academicYear)}` : "เพิ่มเอกสารใหม่"}
                </h3>
                <p className="text-[10px] text-indigo-100 font-light mt-0.5">สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ. BU)</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer text-white">
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-semibold flex-1">
              
              {/* Automatic Generated VOP ID Preview */}
              <div className="p-3.5 bg-[#003366]/5 border border-[#003366]/20 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-[#003366]/70 uppercase font-bold tracking-wider block">เลขที่เอกสาร RI Ref No. (Auto ID)</span>
                  <span className="text-sm font-black text-[#003366] font-mono mt-0.5 block">
                    {editingDoc ? formatRiRefNo(editingDoc.vopId || editingDoc.number, editingDoc.academicYear) : formatRiRefNo(generateVopId(formAcademicYear), formAcademicYear)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-bold">ปีการศึกษาคำนวณ</span>
                  <span className="text-xs font-bold text-indigo-950 font-mono">พ.ศ. {formAcademicYear}</span>
                </div>
              </div>

              {/* Immutability Constraint: RI Ref No. Input (Locked as readOnly & disabled for Relational Safety) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  เลขทะเบียนคุมเอกสารเข้า RI Ref No. (Locked)
                </label>
                <input
                  type="text"
                  readOnly={true}
                  disabled={true}
                  value={editingDoc ? formatRiRefNo(editingDoc.vopId || editingDoc.number, editingDoc.academicYear) : formatRiRefNo(generateVopId(formAcademicYear), formAcademicYear)}
                  className="w-full h-10 px-3 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-[#003366] cursor-not-allowed font-mono"
                />
              </div>

              {/* Title / Description */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  รายละเอียด / ชื่อหนังสือ <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  placeholder="เช่น ขออนุมัติสอบเค้าโครงวิทยานิพนธ์, ขอเปิดวิชาเรียนเพิ่มเติม..."
                  rows={2}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>

              {/* Book Number & Sender Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    เลขที่หนังสือ
                  </label>
                  <input
                    type="text"
                    placeholder="เช่น ศธ 0551/103"
                    value={formBookNumber}
                    onChange={(e) => setFormBookNumber(e.target.value)}
                    className={`w-full h-10 px-3 border rounded-lg text-xs font-medium focus:outline-none focus:ring-1 ${
                      duplicateWarning
                        ? "border-rose-400 focus:ring-rose-500 bg-rose-50/20"
                        : "border-slate-200 focus:ring-[#003366]"
                    }`}
                  />
                  {duplicateWarning && (
                    <div className="mt-1.5 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[10px] text-rose-800 leading-relaxed font-semibold animate-fadeIn">
                      <div className="flex items-start gap-1">
                        <AlertTriangle size={12} className="text-rose-500 mt-0.5 shrink-0" />
                        <div>
                          <span>คำเตือน: เลขที่หนังสือนี้มีการลงทะเบียนไว้แล้วในปีการศึกษานี้ กรุณาตรวจสอบอีกครั้ง</span>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 bg-white/70 p-1.5 rounded border border-rose-100">
                        <input
                          type="checkbox"
                          id="confirmDuplicate"
                          checked={confirmDuplicate}
                          onChange={(e) => setConfirmDuplicate(e.target.checked)}
                          className="w-3.5 h-3.5 text-rose-600 border-rose-300 rounded focus:ring-rose-500 cursor-pointer"
                        />
                        <label htmlFor="confirmDuplicate" className="text-rose-900 cursor-pointer text-[9.5px]">
                          ยืนยันว่าเป็นเอกสารคนละฉบับและสามารถบันทึกซ้ำได้
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">
                    ผู้ส่ง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="เช่น นักศึกษา, อาจารย์ผู้ประสานงาน"
                    value={formSender}
                    onChange={(e) => setFormSender(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                  />
                </div>
              </div>

              {/* Department & Doc Type Dropdown */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">หน่วยงานเจ้าของเรื่อง</label>
                  <input
                    type="text"
                    placeholder="เช่น หลักสูตรนานาชาติ, ฝ่ายทะเบียน"
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">ประเภทเอกสาร</label>
                  <select
                    value={formDocType}
                    onChange={(e) => setFormDocType(e.target.value as "e-mail" | "paper")}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer text-slate-700"
                  >
                    <option value="e-mail">e-mail</option>
                    <option value="paper">paper</option>
                  </select>
                </div>
              </div>

               {/* Received Date & Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-slate-500" />
                    <span>วันที่รับเอกสาร <span className="text-rose-500">*</span></span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formReceivedDate}
                    onChange={(e) => setFormReceivedDate(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
                  />
                </div>
                
                <div>
                  <label className="block text-slate-700 font-bold mb-1">การพิจารณา</label>
                  {editingDoc ? (
                    <div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold border ${getStatusBadgeClass(formStatus)}`}>
                          {formStatus || "อยู่ระหว่างพิจารณา"}
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-600 font-semibold mt-1.5 block leading-normal">
                        * สถานะจะถูกเปลี่ยนเป็นอนุมัติโดยอัตโนมัติ เมื่อมีการบันทึกเอกสารส่งออกในระบบเท่านั้น
                      </span>
                    </div>
                  ) : (
                    <>
                      <select
                        value={
                          ["อยู่ระหว่างพิจารณา", "อนุมัติ", "ลงนามแล้ว", "พิจารณาแล้ว"].includes(formStatus)
                            ? formStatus
                            : (formStatus ? "อื่นๆ โปรดระบุ" : "อยู่ระหว่างพิจารณา")
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "อื่นๆ โปรดระบุ") {
                            setFormStatus("");
                          } else {
                            setFormStatus(val);
                          }
                        }}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer text-slate-700 font-sans font-semibold"
                      >
                        <option value="อยู่ระหว่างพิจารณา">อยู่ระหว่างพิจารณา</option>
                        <option value="อนุมัติ">อนุมัติ</option>
                        <option value="ลงนามแล้ว">ลงนามแล้ว</option>
                        <option value="พิจารณาแล้ว">พิจารณาแล้ว</option>
                        <option value="อื่นๆ โปรดระบุ">อื่นๆ โปรดระบุ</option>
                      </select>

                      {!["อยู่ระหว่างพิจารณา", "อนุมัติ", "ลงนามแล้ว", "พิจารณาแล้ว"].includes(formStatus) && (
                        <div className="mt-2 text-xs">
                          <label className="block text-slate-500 font-bold mb-1">โปรดระบุรายละเอียดสถานะเพิ่มเติม <span className="text-rose-500">*</span></label>
                          <input
                            type="text"
                            required
                            placeholder="ระบุสถานะอื่นๆ เช่น ส่งคืนต้นเรื่อง..."
                            value={formStatus === "อย่างอื่น โปรดระบุ" || formStatus === "อื่นๆ โปรดระบุ" ? "" : formStatus}
                            onChange={(e) => setFormStatus(e.target.value)}
                            className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#003366] text-slate-700 bg-white"
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Optional Date to Executive if status is processed */}
              {formStatus !== "อยู่ระหว่างพิจารณา" && (
                <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-200 animate-fadeIn">
                  <label className="block text-emerald-800 font-bold mb-1 flex items-center gap-1">
                    <CheckCircle size={13} className="text-emerald-600" />
                    <span>วันที่เสนอผู้บริหาร / วันที่พิจารณาอนุมัติ</span>
                  </label>
                  <input
                    type="date"
                    value={formExecutiveDate}
                    onChange={(e) => setFormExecutiveDate(e.target.value)}
                    className="w-full h-10 px-3 border border-emerald-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer text-slate-800"
                  />
                  <span className="text-[10px] text-emerald-700/80 font-medium mt-1 block">
                    * ระบุเมื่อเปลี่ยนสถานะเป็นได้รับการพิจารณาแล้วเสร็จสมบูรณ์
                  </span>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">หมายเหตุเพิ่มเติม</label>
                <input
                  type="text"
                  placeholder="ระบุคำอธิบายสั้นๆ หรือจุดสังเกต..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>

              {/* Google Drive Link */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">ลิงก์เอกสารต้นฉบับ (Google Drive)</label>
                <input
                  type="text"
                  placeholder="วางลิงก์เอกสารจาก Google Drive เพื่อใช้เปิดดูภายหลัง..."
                  value={formDriveLink}
                  onChange={(e) => setFormDriveLink(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 bg-[#003366] hover:bg-[#002244] border border-[#003366] hover:border-[#002244] text-white font-bold rounded-lg cursor-pointer transition-all active:scale-98"
                >
                  {editingDoc ? "บันทึกการแก้ไข" : "บันทึกเอกสาร"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPORT/DISPATCH MODAL - PROMPT 3 */}
      {isExportModalOpen && docToExport && (
        <div id="export-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoomIn border border-slate-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="bg-[#003366] p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-2">
                  <Send size={15} />
                  <span>บันทึกส่งเอกสารออก (เลขที่ วพ.: {formatRiRefNo(docToExport.vopId || docToExport.number, docToExport.academicYear)})</span>
                </h3>
                <p className="text-[10px] text-blue-100 font-light mt-0.5 font-sans">
                  บันทึกรายละเอียดนำส่งและปรับเปลี่ยนสถานะเอกสารเสร็จสิ้นในระบบ
                </p>
              </div>
              <button onClick={() => setIsExportModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer text-white">
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleExportSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-semibold flex-1">
              
              <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                <span className="text-[10px] text-[#003366] uppercase font-bold tracking-wider block">เรื่องเอกสารที่นำส่งออก</span>
                <span className="text-xs font-bold text-slate-800 block">
                  {docToExport.title}
                </span>
                <div className="text-[10px] text-slate-500 font-medium">
                  วันที่รับกระดาษ/เมล: {formatThaiDate(docToExport.receivedDate || docToExport.receiveDate)}
                </div>
              </div>

              {/* วันที่ส่งเอกสาร (Default เป็นวันนี้) */}
              <div>
                <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                  <Calendar size={13} className="text-slate-500" />
                  <span>วันที่ส่งเอกสารออก <span className="text-rose-500">*</span></span>
                </label>
                <input
                  required
                  type="date"
                  value={formExportDispatchDate}
                  onChange={(e) => setFormExportDispatchDate(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer text-slate-800"
                />
              </div>

              {/* ชื่อผู้รับเอกสาร */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  ผู้รับ/หน่วยงานปลายทาง <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="ระบุคุณครู เจ้าหน้าที่ หรือผู้ลงนามลงทะเบียนรับ"
                  value={formExportReceiverName}
                  onChange={(e) => setFormExportReceiverName(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
                />
              </div>

              {/* หน่วยงานผู้รับ */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">
                  หน่วยงานผู้รับ <span className="text-rose-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="ระบุภาควิชา หรือสำนักงาน คณะปลายทาง"
                  value={formExportReceiverDepartment}
                  onChange={(e) => setFormExportReceiverDepartment(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366] text-slate-800"
                />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">หมายเหตุเพิ่มเติมเกี่ยวกับการนำส่ง</label>
                <textarea
                  placeholder="เช่น มอบตัวผ่านทางผู้ประสานงานหลักสูตรแล้ว, ลงนามรับสมุดลงชื่อ..."
                  rows={2}
                  value={formExportNotes}
                  onChange={(e) => setFormExportNotes(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366] text-slate-800"
                />
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="h-10 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 bg-[#003366] hover:bg-[#002244] border border-[#003366] text-white font-bold rounded-lg cursor-pointer transition-all active:scale-98"
                >
                  บันทึกส่งออก (Dispatch)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
