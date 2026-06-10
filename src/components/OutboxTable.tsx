import { useState, useEffect, FormEvent } from "react";
import { Document, DocumentStatus, DocumentPriority, DocumentCategory } from "../types";
import { getAcademicYear, formatThaiDate, formatRiRefNo } from "../utils/academicYear";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  X,
  Calendar,
  Layers,
  Info,
  ExternalLink,
  Send,
  Link
} from "lucide-react";
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from "../services/db";
import { doc, getDoc, setDoc } from "firebase/firestore";

interface OutboxTableProps {
  documents: Document[];
  onAddDoc: (doc: Document) => void;
  onEditDoc: (doc: Document) => void;
  onDeleteDoc: (id: string) => void;
  userRole: "admin" | "viewer";
  selectedFilterYear: number | "all";
  refreshDocs?: () => Promise<void>;
  forwardDoc?: Document | null;
  clearForwardDoc?: () => void;
}

export default function OutboxTable({
  documents,
  onAddDoc,
  onEditDoc,
  onDeleteDoc,
  userRole,
  selectedFilterYear,
  refreshDocs,
  forwardDoc,
  clearForwardDoc
}: OutboxTableProps) {
  const isAdmin = userRole === "admin";

  // Outbox documents selection
  const outboxDocs = documents.filter(
    (d) => d.category === DocumentCategory.OUTBOX || d.status === "ดำเนินการแล้ว/ส่งออกแล้ว"
  );

  // List search & filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  // Add/Edit modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formSender, setFormSender] = useState("สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ");
  const [formReceiver, setFormReceiver] = useState("");
  const [formReceiverDepartment, setFormReceiverDepartment] = useState("");
  const [formReceiveDate, setFormReceiveDate] = useState(""); // This is public dispatch date
  const [formPriority, setFormPriority] = useState<DocumentPriority>(DocumentPriority.NORMAL);
  const [formStatus, setFormStatus] = useState<DocumentStatus>(DocumentStatus.COMPLETED);
  const [formNotes, setFormNotes] = useState("");
  const [formAcademicYear, setFormAcademicYear] = useState<number>(2568);
  const [formOriginalDocId, setFormOriginalDocId] = useState("");
  const [formRefBookNumber, setFormRefBookNumber] = useState("");
  const [viewingRefDoc, setViewingRefDoc] = useState<Document | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizeRef = (str?: string): string => {
    if (!str) return "";
    return str.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
  };

  const normalizeDecision = (val: any): string => {
    if (!val) return "อยู่ระหว่างพิจารณา";
    const s = String(val).trim().toLowerCase();
    if (s === "normal" || s === "อนุมัติ") return "อนุมัติ";
    if (s === "urgent" || s === "ลงนามแล้ว") return "ลงนามแล้ว";
    if (s === "very_urgent" || s === "พิจารณาแล้ว" || s === "approved" || s === "completed") return "พิจารณาแล้ว";
    return val;
  };

  // List of incoming documents for linkage
  const incomingApprovedDocs = documents.filter(
    (d) => d.category === DocumentCategory.INBOX
  );

  // Academic year indicator that updates reactively to formReceiveDate
  useEffect(() => {
    if (formReceiveDate) {
      const selectedDate = new Date(formReceiveDate);
      if (!isNaN(selectedDate.getTime())) {
        const yr = getAcademicYear(selectedDate);
        setFormAcademicYear(yr);
      }
    } else {
      setFormAcademicYear(getAcademicYear(new Date()));
    }
  }, [formReceiveDate]);

  // Pipeline Forward Action Trigger Effect
  useEffect(() => {
    if (forwardDoc) {
      handleOpenAddWithIncoming(forwardDoc);
      if (clearForwardDoc) {
        clearForwardDoc();
      }
    }
  }, [forwardDoc, clearForwardDoc]);

  // Open modal for Adding with pre-populated Incoming document data
  const handleOpenAddWithIncoming = (incoming: Document) => {
    setEditingDoc(null);
    setFormTitle(incoming.title || "");
    const docNum = incoming.riRefNo || formatRiRefNo(incoming.vopId || incoming.number, incoming.academicYear);
    setFormNumber(docNum);
    setFormSender("สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ");
    setFormReceiver(incoming.sender || "");
    setFormReceiverDepartment(incoming.department || "");
    const today = new Date().toISOString().split("T")[0];
    setFormReceiveDate(today);
    setFormPriority(DocumentPriority.NORMAL);
    setFormStatus(DocumentStatus.COMPLETED); // Outbox usually defaults to Completed upon dispatch
    setFormNotes("");
    setFormOriginalDocId(incoming.id);
    setFormRefBookNumber(docNum);
    setFormAcademicYear(incoming.academicYear);
    setSubmitError(null);
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // Open modal for Adding
  const handleOpenAdd = () => {
    setEditingDoc(null);
    setFormTitle("");
    setFormNumber("");
    setFormSender("สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ");
    setFormReceiver("");
    setFormReceiverDepartment("");
    const today = new Date().toISOString().split("T")[0];
    setFormReceiveDate(today);
    setFormPriority(DocumentPriority.NORMAL);
    setFormStatus(DocumentStatus.COMPLETED); // Outbox usually defaults to Completed upon dispatch
    setFormNotes("");
    setFormOriginalDocId("");
    setFormRefBookNumber("");
    setSubmitError(null);
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // Open modal for Editing
  const handleOpenEdit = (doc: Document) => {
    setEditingDoc(doc);
    setFormTitle(doc.title || "");
    const docNum = doc.riRefNo || doc.vopId || doc.bookNumber || doc.number || "";
    setFormNumber(docNum);
    setFormSender(doc.sender || "");
    setFormReceiver(doc.receiverName || doc.receiver || "");
    setFormReceiverDepartment(doc.receiverDepartment || doc.department || "");
    setFormReceiveDate(doc.dispatchDate || doc.receiveDate || "");
    setFormPriority(doc.priority || DocumentPriority.NORMAL);
    setFormStatus(doc.status === "ดำเนินการแล้ว/ส่งออกแล้ว" ? DocumentStatus.COMPLETED : (doc.status as DocumentStatus || DocumentStatus.COMPLETED));
    setFormNotes(doc.exportNotes || doc.notes || "");
    setFormAcademicYear(doc.academicYear || 2568);
    setFormOriginalDocId(doc.originalDocId || "");
    setFormRefBookNumber(doc.originalDocVopId || docNum);
    setSubmitError(null);
    setIsSubmitting(false);
    setIsModalOpen(true);
  };

  // Submit handler
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setIsSubmitting(true);

    const normalizeRefLocal = (str?: string): string => {
      if (!str) return "";
      return str.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
    };

    // 1. Disable Strict Validation / Force Save & Sanitize fields
    const rawTitle = String(formTitle || "").trim();
    const finalNumber = String(formRefBookNumber || "").trim() || String(formNumber || "").trim();
    
    const cleanTitle = rawTitle || "เอกสารนำส่งพิจารณา";
    const cleanNumber = finalNumber || `outbox-num-${Date.now()}`;
    const cleanSender = String(formSender || "").trim() || "สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ";
    const cleanReceiver = String(formReceiver || "").trim() || "ผู้รับปลายทาง";
    const cleanReceiverDepartment = String(formReceiverDepartment || "").trim();
    const cleanNotes = String(formNotes || "").trim();
    const cleanReceiveDate = String(formReceiveDate || new Date().toISOString().split("T")[0]);
    const cleanRefBookNumber = String(formRefBookNumber || "").trim();
    const cleanAcademicYear = Number(formAcademicYear) || 2568;
    const selectedYear = selectedFilterYear !== "all" ? selectedFilterYear : cleanAcademicYear;
    const cleanStatus = formStatus || DocumentStatus.COMPLETED;
    const cleanPriority = formPriority || DocumentPriority.NORMAL;

    // 2. REPAIR DOCUMENT REFERENCE ID MATCHING (NO MORE STRING MISMATCH)
    let finalIncomingDocId = String(formOriginalDocId || "").trim();
    if (finalIncomingDocId) {
      // Look up and track exact alphanumeric Firestore ID string from local documents array to avoid passing formatted text strings
      const matched = documents.find(d => 
        d.id === finalIncomingDocId || 
        d.vopId === finalIncomingDocId || 
        d.number === finalIncomingDocId ||
        (d.vopId && normalizeRefLocal(d.vopId) === normalizeRefLocal(finalIncomingDocId)) ||
        (d.number && normalizeRefLocal(d.number) === normalizeRefLocal(finalIncomingDocId))
      );
      if (matched) {
        finalIncomingDocId = matched.id;
      }
    }

    try {
      // Assemble the Outgoing Document payload
      let payload: Document;
      if (editingDoc?.category === DocumentCategory.INBOX) {
        // Dispatched Inbox document
        payload = {
          ...editingDoc,
          status: "ดำเนินการแล้ว/ส่งออกแล้ว",
          dispatchDate: cleanReceiveDate,
          receiverName: cleanReceiver,
          receiverDepartment: cleanReceiverDepartment || "บัณฑิตวิทยาลัย",
          exportNotes: cleanNotes,
          originalDocId: finalIncomingDocId || undefined,
          originalDocVopId: cleanRefBookNumber || undefined,
          updatedAt: new Date().toISOString()
        };
      } else {
        // Pure outbox document
        payload = {
          id: editingDoc ? editingDoc.id : `outbox-${Date.now()}`,
          title: cleanTitle,
          number: cleanNumber,
          sender: cleanSender,
          receiver: cleanReceiver,
          receiverDepartment: cleanReceiverDepartment || undefined,
          department: cleanReceiverDepartment || undefined,
          receiveDate: cleanReceiveDate,
          academicYear: selectedYear,
          status: cleanStatus,
          priority: cleanPriority,
          category: DocumentCategory.OUTBOX,
          notes: cleanNotes || undefined,
          createdAt: editingDoc ? editingDoc.createdAt : new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          originalDocId: finalIncomingDocId || undefined,
          originalDocVopId: cleanRefBookNumber || undefined
        };
      }

      // Step A: Attempt to save Outgoing Document entry to Firestore first and await database confirmation
      if (editingDoc) {
        await onEditDoc(payload);
      } else {
        await onAddDoc(payload);
      }

      // Step B: Trigger separate isolated update of the related Inline Incoming status
      if (finalIncomingDocId) {
        try {
          if (isFirebaseConfigured && db && auth?.currentUser) {
            const incomingRef = doc(db, "documents", finalIncomingDocId);
            const incomingSnap = await getDoc(incomingRef);
            if (incomingSnap.exists()) {
              const incomingData = incomingSnap.data() as Document;
              
              // Assemble notes update cleanly
              let finalIncomingNotes = incomingData.notes || "";
              if (cleanNotes) {
                const displayDate = formatThaiDate(cleanReceiveDate);
                const logEntry = `\n[บันทึกส่งออกเมื่อ ${displayDate}]: ${cleanNotes}`;
                if (!finalIncomingNotes.includes(logEntry)) {
                  finalIncomingNotes = finalIncomingNotes ? `${finalIncomingNotes}${logEntry}` : logEntry.trim();
                }
              }

              // Determine whether we mark "อนุมัติ"
              const isApproved = cleanPriority === "อนุมัติ" || cleanPriority === "approved" || cleanStatus === "completed" || cleanStatus === "ดำเนินการแล้ว/ส่งออกแล้ว" || cleanStatus === "จัดส่งสำเร็จ";
              const updatedIncoming: Partial<Document> = {
                ...incomingData,
                notes: finalIncomingNotes || undefined,
                updatedAt: new Date().toISOString()
              };

              if (isApproved) {
                updatedIncoming.status = "อนุมัติ";
                updatedIncoming.executiveDate = incomingData.executiveDate || cleanReceiveDate;
                updatedIncoming.submittedDate = incomingData.submittedDate || cleanReceiveDate;
              }

              const cleanIncoming = Object.fromEntries(
                Object.entries(updatedIncoming).filter(([_, val]) => val !== undefined)
              );

              // Perform isolated setDoc to avoid blocking/rolling back Step A in case of failure
              await setDoc(incomingRef, cleanIncoming);
            }
          }
        } catch (secondaryErr) {
          console.error("Step B (Secondary update status to linked incoming) warning/failure caught silently:", secondaryErr);
        }
      }

      // Step C: Force update/refresh the local tables reactively so the table views update immediately
      if (refreshDocs) {
        await refreshDocs();
      }

      // Step D: Only after database validation, close the form modal and clear state
      setIsModalOpen(false);

      // Trigger success toast
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4500);

      // Clear form states safely
      setFormTitle("");
      setFormNumber("");
      setFormSender("สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ");
      setFormReceiver("");
      setFormReceiverDepartment("");
      setFormNotes("");
      setFormOriginalDocId("");
      setFormRefBookNumber("");
      setSubmitError(null);
    } catch (err: any) {
      console.error("Save operation complete failure: ", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      let readableError = errMsg;
      try {
        if (errMsg.startsWith('{') && errMsg.endsWith('}')) {
          const parsed = JSON.parse(errMsg);
          if (parsed && parsed.error) {
            readableError = parsed.error;
          }
        }
      } catch (jsonErr) {}

      const finalMsg = `เกิดข้อผิดพลาดในการบันทึก: ${readableError}`;
      setSubmitError(finalMsg);

      // Step A Complete Failure: Diagnostic popup displaying raw error string
      alert(`ความล้มเหลวในการบันทึกแบบระบบ (System-wide Diagnostics):\n${errMsg}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter application
  const filteredDocs = outboxDocs.filter((doc) => {
    // 1. Year filter
    if (selectedFilterYear !== "all" && doc.academicYear !== selectedFilterYear) {
      return false;
    }
    // 2. Status filter
    if (statusFilter !== "all") {
      const mappedStatus = doc.status === "ดำเนินการแล้ว/ส่งออกแล้ว" ? DocumentStatus.COMPLETED : doc.status;
      if (mappedStatus !== statusFilter) {
        return false;
      }
    }
    // 3. Priority filter
    if (priorityFilter !== "all" && getPriorityLabel(doc.priority) !== priorityFilter) {
      return false;
    }
    // 4. Search matching (title, number, receiver, notes)
    if (searchTerm.trim() !== "") {
      const s = searchTerm.toLowerCase();
      const formattedNum = formatRiRefNo(doc.riRefNo || doc.vopId || doc.number, doc.academicYear);
      const numToSearch = doc.riRefNo || doc.vopId || doc.bookNumber || doc.number || "";
      const receiverName = doc.receiverName || doc.receiver || "";
      const notes = doc.exportNotes || doc.notes || "";
      return (
        doc.title.toLowerCase().includes(s) ||
        numToSearch.toLowerCase().includes(s) ||
        formattedNum.toLowerCase().includes(s) ||
        receiverName.toLowerCase().includes(s) ||
        notes.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const getPriorityLabel = (priority: any) => {
    switch (priority) {
      case "อนุมัติ": return "อนุมัติ";
      case "ลงนามแล้ว": return "ลงนามแล้ว";
      case "พิจารณาแล้ว": return "พิจารณาแล้ว";
      case DocumentPriority.VERY_URGENT:
      case "very_urgent":
        return "พิจารณาแล้ว";
      case DocumentPriority.URGENT:
      case "urgent":
        return "ลงนามแล้ว";
      case DocumentPriority.NORMAL:
      case "normal":
        return "อนุมัติ";
      default:
        return priority || "อนุมัติ";
    }
  };

  const getPriorityBadgeClass = (priority: any) => {
    switch (priority) {
      case "อนุมัติ":
      case DocumentPriority.NORMAL:
      case "normal":
        return "bg-emerald-50 text-emerald-700 border-emerald-200 font-sans font-bold";
      case "ลงนามแล้ว":
      case DocumentPriority.URGENT:
      case "urgent":
        return "bg-indigo-50 text-indigo-700 border-indigo-200 font-sans font-bold";
      case "พิจารณาแล้ว":
      case DocumentPriority.VERY_URGENT:
      case "very_urgent":
        return "bg-teal-50 text-teal-700 border-teal-200 font-sans font-bold";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 font-sans font-medium";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    if (status === "ดำเนินการแล้ว/ส่งออกแล้ว") {
      return "bg-blue-50 text-blue-800 border-blue-200";
    }
    switch (status) {
      case DocumentStatus.COMPLETED:
        return "bg-emerald-50 text-emerald-800 border-emerald-200";
      default:
        return "bg-amber-50 text-amber-800 border-amber-200";
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === "ดำเนินการแล้ว/ส่งออกแล้ว") return "ส่งออกแล้ว (Dispatched)";
    switch (status) {
      case DocumentStatus.COMPLETED: return "จัดส่งสำเร็จ";
      default: return "รอการจัดส่ง";
    }
  };

  return (
    <div id="outbox-tracker" className="space-y-4 font-sans">
      {/* Table Title and Actions bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Outgoing Documents (เอกสารออก)</h2>
          <p className="text-xs text-slate-500 font-light mt-0.5">
            ติดตามประวัติและเลขอ้างอิงของเอกสารนำส่งภายนอก คำร้อง และหนังสือโต้ตอบของสายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)
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
              เพิ่มเอกสารออก (Outgoing Document)
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
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
              <Search size={15} />
            </span>
            <input
              type="text"
              placeholder="ค้นหา ชื่อนามเรื่อง, เลขที่หนังสือ, หน่วยงานปลายทาง..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-10 pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#003366]"
            />
          </div>

          {/* Status filter selection */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 bg-slate-50 text-slate-600 border border-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
            >
              <option value="all">กรองตามสถานะ: ทั้งหมด</option>
              <option value={DocumentStatus.COMPLETED}>จัดส่งสำเร็จ</option>
              <option value={DocumentStatus.PENDING}>รอการจัดส่ง</option>
            </select>
          </div>

          {/* Priority filter selection */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full h-10 bg-slate-50 text-slate-600 border border-slate-200 text-xs rounded-lg px-3 focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
            >
              <option value="all">กรองการพิจารณา: ทั้งหมด</option>
              <option value="อนุมัติ">อนุมัติ</option>
              <option value="ลงนามแล้ว">ลงนามแล้ว</option>
              <option value="พิจารณาแล้ว">พิจารณาแล้ว</option>
              <option value="อื่นๆ โปรดระบุ">อื่นๆ โปรดระบุ</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Interface */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-50 text-[10px] text-slate-500 uppercase tracking-wider font-bold border-b border-slate-200">
              <tr>
                <th colSpan={1} className="px-4 py-3.5">RI Ref No. (อ้างอิงเอกสารเข้า)</th>
                <th colSpan={1} className="px-4 py-3.5">การพิจารณา</th>
                <th colSpan={1} className="px-4 py-3.5">เรื่อง / หน่วยงานผู้รับปลายทาง</th>
                <th colSpan={1} className="px-4 py-3.5">วันที่ออกส่งหนังสือ</th>
                <th colSpan={1} className="px-4 py-3.5">สถานะ</th>
                {isAdmin && <th colSpan={1} className="px-4 py-3.5 text-center">จัดการ</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-sans">
              {filteredDocs.length > 0 ? (
                filteredDocs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">
                        {formatRiRefNo(doc.riRefNo, doc.academicYear)}
                      </div>
                      <div className="text-[10px] text-indigo-700 font-semibold mt-0.5">ปีการศึกษา {doc.academicYear}</div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${getPriorityBadgeClass(doc.priority || DocumentPriority.NORMAL)}`}>
                        {getPriorityLabel(doc.priority || DocumentPriority.NORMAL)}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 max-w-sm">
                      <div className="font-semibold text-[#003366] line-clamp-1">{doc.title}</div>
                      <div className="text-[10px] text-slate-500 mt-1 flex flex-col gap-0.5 font-medium">
                        <div>
                          <span>ผู้รับปลายทาง:</span>{" "}
                          <span className="font-bold text-slate-700">
                            {doc.category === DocumentCategory.INBOX ? (doc.receiverName || doc.receiver) : doc.receiver}
                          </span>
                        </div>
                        {(doc.receiverDepartment || doc.department) && (
                          <div>
                            <span>หน่วยงานผู้รับ:</span>{" "}
                            <span className="font-semibold text-slate-600">{doc.receiverDepartment || doc.department}</span>
                          </div>
                        )}
                        {doc.category === DocumentCategory.INBOX && (
                          <div className="text-[9.5px] text-slate-400">
                            (ยกยอดรับมาจากทะเบียนเอกสารเข้า เลขยื่น {doc.bookNumber || doc.number || "-"})
                          </div>
                        )}
                      </div>
                      {(doc.exportNotes || doc.notes) && (
                        <div className="text-[10px] text-indigo-600/95 italic mt-1 line-clamp-1">
                          โน้ตนำส่ง: {doc.exportNotes || doc.notes}
                        </div>
                      )}
                      {doc.originalDocVopId && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              const originalDoc = documents.find(d => 
                                d.id === doc.originalDocId || 
                                (doc.originalDocVopId && d.vopId && normalizeRef(d.vopId) === normalizeRef(doc.originalDocVopId)) ||
                                (doc.originalDocVopId && d.number && normalizeRef(d.number) === normalizeRef(doc.originalDocVopId))
                              );
                              if (originalDoc) {
                                setViewingRefDoc(originalDoc);
                              } else {
                                alert(`ไม่พบไฟล์ข้อมูลต้นเรื่องฉบับเต็มของ ${doc.originalDocVopId} ในหน้าต่างปัจจุบัน`);
                              }
                            }}
                            className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-[#003366] px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer border border-indigo-200"
                          >
                            <Link size={10} className="shrink-0" />
                            <span>ตอบรับเอกสารเข้า: {doc.originalDocVopId}</span>
                            <ExternalLink size={8} className="shrink-0 opacity-75" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-slate-600 font-medium">
                      {formatThaiDate(doc.category === DocumentCategory.INBOX ? (doc.dispatchDate || doc.receiveDate) : doc.receiveDate)}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-[10px] rounded-full font-bold border ${getStatusBadgeClass(doc.status)}`}>
                        {getStatusLabel(doc.status)}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleOpenEdit(doc)}
                            className="p-1.5 bg-slate-100 text-slate-600 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition-all cursor-pointer"
                            title="แก้ไขข้อมูลนำส่ง"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`คุณต้องการลบรายงานตัวส่งเอกสารออก ${formatRiRefNo(doc.riRefNo, doc.academicYear)} นี้ใช่หรือไม่?`)) {
                                onDeleteDoc(doc.id);
                              }
                            }}
                            className="p-1.5 bg-rose-50 text-rose-600 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all cursor-pointer"
                            title="ลบข้อมูลนำส่ง"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="text-center py-10 text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Send size={32} className="text-slate-300" />
                      <span className="font-semibold">ไม่พบข้อมูลเอกสารออก</span>
                      <span className="text-[11px] text-slate-400">ลองเปลี่ยนแปลงค่าตัวคัดกรอง หรือกดเพิ่มเอกสารใหม่</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Table Footer Stats counts */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex justify-between items-center text-[10px] text-slate-500 font-semibold">
          <span>แสดง {filteredDocs.length} จาก {outboxDocs.length} เอกสารออกทั้งหมด</span>
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            จัดส่งเสร็จแล้ว {outboxDocs.filter(d => d.status === DocumentStatus.COMPLETED).length} รายการ
          </span>
        </div>
      </div>

      {/* REACTIVE ADD & EDIT MODAL */}
      {isModalOpen && (
        <div id="outbox-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-zoomIn border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="bg-indigo-950 p-5 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-sm tracking-tight text-white">
                  {editingDoc ? "แก้ไขข้อมูลเอกสารนำส่งภายนอก" : "บันทึกส่งเอกสารออก"}
                </h3>
                <p className="text-[10px] text-indigo-200 font-light mt-0.5 font-sans">สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs font-semibold flex-1">
              {/* Error Box display */}
              {submitError && (
                <div role="alert" className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-sans font-semibold rounded-xl space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="w-1.5 h-1.5 bg-rose-600 rounded-full animate-ping shrink-0"></span>
                    <span>พบข้อผิดพลาด:</span>
                  </div>
                  <div className="text-[11px] leading-relaxed">{submitError}</div>
                </div>
              )}

              {/* Reference Incoming Section */}
              {!editingDoc || editingDoc.category !== DocumentCategory.INBOX ? (
                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/60 space-y-2.5 mb-2 shadow-inner">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-indigo-600"></div>
                    <span className="text-[#003366] font-bold text-xs uppercase tracking-wide">เชื่อมโยงอ้างอิงเอกสารเข้า (Reference Lineage)</span>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        เลือกเอกสารเข้าที่พิจารณาแล้ว
                      </label>
                      <select
                        value={formOriginalDocId}
                        onChange={(e) => {
                          const selectedId = e.target.value;
                          setFormOriginalDocId(selectedId);
                          if (selectedId) {
                            const docFound = incomingApprovedDocs.find(d => d.id === selectedId);
                            if (docFound) {
                              setFormTitle(docFound.title || "");
                              const matchedRefNo = docFound.riRefNo || docFound.vopId || docFound.number || "";
                              setFormRefBookNumber(matchedRefNo);
                              setFormNumber(matchedRefNo);
                              setFormPriority(docFound.status ? normalizeDecision(docFound.status) : DocumentPriority.NORMAL);
                              // Auto-fill recipient fields with sender and department from incoming document with deep null/undefined safeguards
                              setFormReceiver(docFound.sender || "");
                              setFormReceiverDepartment(docFound.department || "");
                            }
                          } else {
                            setFormOriginalDocId("");
                            setFormTitle("");
                            setFormRefBookNumber("");
                            setFormNumber("");
                            setFormReceiver("");
                            setFormReceiverDepartment("");
                          }
                        }}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                      >
                        <option value="">-- ดึงรายชื่อเรื่อง/เลขที่ วพ. อัตโนมัติ --</option>
                        {incomingApprovedDocs.map((incoming) => (
                          <option key={incoming.id} value={incoming.id}>
                            {formatRiRefNo(incoming.riRefNo || incoming.vopId || incoming.number, incoming.academicYear)} : {incoming.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 font-bold mb-1">
                        เลขที่หนังสืออ้างอิง
                      </label>
                      <input
                        type="text"
                        placeholder="เช่น วพ. 001/2568 (ดึงข้อมูลอัตโนมัติ)"
                        value={formRefBookNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormRefBookNumber(val);
                          setFormNumber(val);
                        }}
                        className="w-full h-10 px-3 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-light block leading-normal">
                    * ระบบจะแสดงเฉพาะเอกสารเข้าสถานะ <strong className="text-emerald-700">"พิจารณาแล้ว"</strong> เท่านั้น เพื่อนำมาดึงชื่อเรื่องและเชื่อมข้อมูลอย่างเป็นระบบ
                  </span>
                </div>
              ) : null}
              {/* Main Subject / Name */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">ชื่อเรื่อง/ชื่อหนังสือส่งออก <span className="text-rose-500">*</span></label>
                <input
                  required
                  type="text"
                  placeholder="e.g. รายงานขอใบรับรองสิทธิการพิจารณาวิทยานิพนธ์บัณฑิตศึกษา..."
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Number and Sender Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">เลขทะเบียนส่งออก / เลขที่หนังสือ <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="text"
                    placeholder="เช่น วพ. 203/2568"
                    value={formNumber}
                    onChange={(e) => setFormNumber(e.target.value)}
                    readOnly={!!formOriginalDocId}
                    disabled={!!formOriginalDocId}
                    className={`w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700 ${formOriginalDocId ? 'bg-slate-100 cursor-not-allowed font-bold text-slate-500' : ''}`}
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">หน่วยงานต้นทาง <span className="text-rose-500">*</span></label>
                  <input
                    required
                    type="text"
                    value={formSender}
                    onChange={(e) => setFormSender(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 text-slate-700"
                  />
                </div>
              </div>

              {/* Receiver & Department Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-700 font-bold text-xs">ผู้รับปลายทาง <span className="text-rose-500">*</span></label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormReceiver("อ.สุธิศา");
                        setFormReceiverDepartment("ผช.หน.บช.");
                      }}
                      className="text-[10px] text-amber-700 hover:text-amber-900 font-semibold bg-amber-50 hover:bg-amber-100 px-2 py-0.5 rounded border border-amber-200 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>✨ กรอกด่วนพิเศษ</span>
                    </button>
                  </div>
                  <input
                    required
                    type="text"
                    placeholder="e.g. อ.สุธิศา"
                    value={formReceiver}
                    onChange={(e) => setFormReceiver(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormReceiver("อ.สุธิศา")}
                      className="text-[10px] text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      + อ.สุธิศา
                    </button>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-slate-700 font-bold text-xs">หน่วยงาน</label>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. ผช.หน.บช."
                    value={formReceiverDepartment}
                    onChange={(e) => setFormReceiverDepartment(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <div className="flex gap-1.5 mt-1">
                    <button
                      type="button"
                      onClick={() => setFormReceiverDepartment("ผช.หน.บช.")}
                      className="text-[10px] text-slate-500 hover:text-indigo-600 bg-slate-100 hover:bg-indigo-50 px-2 py-0.5 rounded cursor-pointer transition-colors"
                    >
                      + ผช.หน.บช.
                    </button>
                  </div>
                </div>
              </div>

              {/* Dates & Academic Year Reactive Field */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-150">
                <div>
                  <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1">
                    <Calendar size={13} className="text-slate-500" />
                    <span>วันที่ส่ง/จัดทำ</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={formReceiveDate}
                    onChange={(e) => setFormReceiveDate(e.target.value)}
                    className="w-full h-10 px-3 border border-slate-200 bg-white rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  />
                </div>
                
                {/* Dynamically calculated field displaying calculated Th BE year */}
                <div>
                  <label className="block text-indigo-900 font-bold mb-1 flex items-center gap-1">
                    <Layers size={13} className="text-indigo-600 font-bold" />
                    <span>คำนวณปีการศึกษา (Thai BE)</span>
                  </label>
                  <div className="w-full h-10 px-3 border border-indigo-200 bg-indigo-50 text-indigo-900 font-bold rounded-lg text-xs flex items-center">
                    พ.ศ. {formAcademicYear}
                  </div>
                </div>
              </div>

              {/* Urgency & Dispatch status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">การพิจารณา</label>
                  <select
                    value={
                      ["อนุมัติ", "ลงนามแล้ว", "พิจารณาแล้ว"].includes(formPriority)
                        ? formPriority
                        : (formPriority ? "อื่นๆ โปรดระบุ" : "อนุมัติ")
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "อื่นๆ โปรดระบุ") {
                        setFormPriority("");
                      } else {
                        setFormPriority(val);
                      }
                    }}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700 font-sans font-semibold"
                  >
                    <option value="อนุมัติ">อนุมัติ</option>
                    <option value="ลงนามแล้ว">ลงนามแล้ว</option>
                    <option value="พิจารณาแล้ว">พิจารณาแล้ว</option>
                    <option value="อื่นๆ โปรดระบุ">อื่นๆ โปรดระบุ</option>
                  </select>

                  {!["อนุมัติ", "ลงนามแล้ว", "พิจารณาแล้ว"].includes(formPriority) && (
                    <div className="mt-2 text-xs">
                      <label className="block text-slate-500 font-bold mb-1">โปรดระบุรายละเอียดการพิจารณา <span className="text-rose-500">*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="ระบุการพิจารณาอื่นๆ..."
                        value={formPriority === "อื่นๆ โปรดระบุ" ? "" : formPriority}
                        onChange={(e) => setFormPriority(e.target.value)}
                        className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">สถานะดำเนินการนำส่ง</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as DocumentStatus)}
                    className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer text-slate-700"
                  >
                    <option value={DocumentStatus.COMPLETED}>จัดส่งสำเร็จ (Dispatched)</option>
                    <option value={DocumentStatus.PENDING}>รอการจัดส่ง</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-slate-700 font-bold mb-1">หมายเหตุการส่ง / รายละเอียดอ้างอิง</label>
                <textarea
                  placeholder="ระบุโน้ตสำคัญเกี่ยวกับการดำเนินการ เช่น ลิงก์เก็บสำเนาเอกสารนำส่ง..."
                  rows={2}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-3 border border-slate-200 rounded-lg text-xs font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                ></textarea>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 border border-slate-200 hover:bg-slate-50 text-slate-600 font-medium rounded-lg cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-10 px-5 bg-indigo-950 hover:bg-slate-900 border border-indigo-950 text-white font-bold rounded-lg cursor-pointer transition-all active:scale-98 disabled:opacity-50"
                >
                  {isSubmitting ? "กำลังบันทึก..." : (editingDoc ? "บันทึกการปรับปรุง" : "บันทึกนำส่งออก")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reference Document Details Popup Modal */}
      {viewingRefDoc && (
        <div id="view-ref-modal" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden border border-slate-200 flex flex-col animate-zoomIn text-xs">
            <div className="bg-[#003366] p-4 text-white flex justify-between items-center">
              <div>
                <span className="text-[9px] text-[#FFCC00] font-bold block tracking-wider uppercase">ต้นเรื่องเอกสารเข้าที่อ้างอิง</span>
                <h4 className="font-bold text-sm text-white font-mono mt-0.5">{formatRiRefNo(viewingRefDoc.riRefNo || viewingRefDoc.vopId || viewingRefDoc.number, viewingRefDoc.academicYear)}</h4>
              </div>
              <button onClick={() => setViewingRefDoc(null)} className="p-1 hover:bg-white/10 rounded-lg cursor-pointer text-white">
                <X size={16} />
              </button>
            </div>
            
            <div className="p-5 space-y-3.5 max-h-[70vh] overflow-y-auto">
              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">ชื่อเรื่อง / รายละเอียด</span>
                <p className="text-slate-800 font-bold text-xs mt-0.5">{viewingRefDoc.title}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">วันที่รับต้นเรื่อง</span>
                  <p className="text-slate-700 font-semibold mt-0.5">{formatThaiDate(viewingRefDoc.receivedDate || viewingRefDoc.receiveDate)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">ปีการศึกษา</span>
                  <p className="text-slate-700 font-semibold mt-0.5">ปีการศึกษา {viewingRefDoc.academicYear}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 col-span-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">หน่วยงานต้นทาง</span>
                  <p className="text-slate-700 font-semibold mt-0.5">{viewingRefDoc.department || viewingRefDoc.sender}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">ประเภทเอกสาร</span>
                  <p className="text-slate-700 font-semibold mt-0.5">{viewingRefDoc.docType === "e-mail" ? "อีเมล (e-mail)" : "เอกสารกระดาษ"}</p>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 block uppercase">สถานะต้นเรื่อง</span>
                <span className="inline-block px-1.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[10px] font-semibold mt-1">
                  พิจารณาแล้ว
                </span>
              </div>

              {viewingRefDoc.notes && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 italic text-slate-600 mt-1">
                  <strong>หมายเหตุเดิม:</strong> {viewingRefDoc.notes}
                </div>
              )}
            </div>

            <div className="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewingRefDoc(null)}
                className="h-8.5 px-3.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition-all cursor-pointer active:scale-98"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {showSuccessToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-emerald-600 shadow-xl border border-emerald-500/30 text-white px-5 py-3 rounded-xl flex items-center gap-3 animate-bounce">
          <span className="w-2 h-2 rounded-full bg-white shrink-0 animate-pulse"></span>
          <span className="font-bold text-xs font-sans">บันทึกเอกสารส่งออกและอัปเดตสถานะสำเร็จ</span>
        </div>
      )}
    </div>
  );
}
