import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { db, auth, isFirebaseConfigured } from "../services/db";
import { collection, query, where, getDocs } from "firebase/firestore";
import { Document, DocumentStatus, DocumentPriority, DocumentCategory } from "../types";
import { formatThaiDate, isReceivedMoreThan5DaysAgo, getAcademicYearsRange, formatRiRefNo } from "../utils/academicYear";
import { AlertTriangle, Clock, ShieldAlert, CheckCircle2, FileText, Layers, CalendarDays, ExternalLink, Mail, File } from "lucide-react";

interface DashboardProps {
  documents: Document[];
  selectedYear: number | "all";
  setSelectedYear: (year: number | "all") => void;
  currentYear: number;
  setActiveTab: (tab: any) => void;
  setSelectedDoc?: (doc: Document) => void;
}

export default function Dashboard({
  documents,
  selectedYear,
  setSelectedYear,
  currentYear,
  setActiveTab
}: DashboardProps) {
  // Report Ref and Dialog visibility
  const reportRef = useRef<HTMLDivElement>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);

  // Years range range calculation for the local dropdown
  const yearsRange = getAcademicYearsRange(currentYear, 5);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportCombineExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);

    try {
      let inboxList: Document[] = [];
      let outboxList: Document[] = [];

      if (isFirebaseConfigured && db && auth?.currentUser) {
        try {
          const selectedYrNum = selectedYear === "all" ? null : Number(selectedYear);
          
          let inboxQuery;
          let outboxQuery1;
          let outboxQuery2;

          if (selectedYrNum !== null) {
            inboxQuery = query(collection(db, "documents"), where("academicYear", "==", selectedYrNum));
            outboxQuery1 = query(collection(db, "outgoing_documents"), where("academicYear", "==", selectedYrNum));
            outboxQuery2 = query(collection(db, "outgoingDocuments"), where("academicYear", "==", selectedYrNum));
          } else {
            inboxQuery = collection(db, "documents");
            outboxQuery1 = collection(db, "outgoing_documents");
            outboxQuery2 = collection(db, "outgoingDocuments");
          }

          const [inboxSnap, outboxSnap1, outboxSnap2] = await Promise.all([
            getDocs(inboxQuery),
            getDocs(outboxQuery1).catch(() => null),
            getDocs(outboxQuery2).catch(() => null)
          ]);

          inboxSnap.forEach((d) => {
            const data = d.data() as any;
            const docItem = { id: d.id, ...data } as Document;
            if (docItem.category === DocumentCategory.INBOX || !docItem.category) {
              inboxList.push(docItem);
            } else if (docItem.category === DocumentCategory.OUTBOX) {
              outboxList.push(docItem);
            }
          });

          if (outboxSnap1) {
            outboxSnap1.forEach((d) => {
              outboxList.push({ id: d.id, ...(d.data() as any) } as Document);
            });
          }

          if (outboxSnap2) {
            outboxSnap2.forEach((d) => {
              outboxList.push({ id: d.id, ...(d.data() as any) } as Document);
            });
          }
        } catch (err) {
          console.error("Firebase fetch failed, falling back to local list:", err);
          inboxList = documents.filter(d => d.category === DocumentCategory.INBOX);
          outboxList = documents.filter(d => d.category === DocumentCategory.OUTBOX);
          if (selectedYear !== "all") {
            inboxList = inboxList.filter(d => d.academicYear === selectedYear);
            outboxList = outboxList.filter(d => d.academicYear === selectedYear);
          }
        }
      } else {
        // Fallback to offline / local state
        inboxList = documents.filter(d => d.category === DocumentCategory.INBOX);
        outboxList = documents.filter(d => d.category === DocumentCategory.OUTBOX);
        if (selectedYear !== "all") {
          inboxList = inboxList.filter(d => d.academicYear === selectedYear);
          outboxList = outboxList.filter(d => d.academicYear === selectedYear);
        }
      }

      // Deduplicate by ID just in case
      const seenInbox = new Set();
      inboxList = inboxList.filter((item) => {
        if (!item.id) return true;
        if (seenInbox.has(item.id)) return false;
        seenInbox.add(item.id);
        return true;
      });

      const seenOutbox = new Set();
      outboxList = outboxList.filter((item) => {
        if (!item.id) return true;
        if (seenOutbox.has(item.id)) return false;
        seenOutbox.add(item.id);
        return true;
      });

      // Construct Workbook
      const wb = XLSX.utils.book_new();

      // Headers config matching the 11 columns in exact sequence
      const headers = [
        "1. เลขที่ วพ.",
        "2. วันที่รับ",
        "3. เลขที่หนังสือ",
        "4. ผู้ส่ง",
        "5. หน่วยงาน",
        "6. เรื่อง",
        "7. ประเภทเอกสาร",
        "8. สถานะพิจารณา",
        "9. วันที่ส่งออก",
        "10. ผู้รับ",
        "11. หน่วยงานออก"
      ];

      // 1. INITIALIZE AN AGGREGATION MAP OBJECT
      const rowMap: Record<string, any> = {};

      const isLegacyInstitutional = (name?: string) => {
        if (!name) return false;
        const n = name.trim();
        return n.includes("รองอธิการบดี") || n.includes("รอง วพ.") || n.includes("สายวิจัยและพัฒนา");
      };

      // 2. PROCESS INCOMING DATA STREAM (INBOX)
      inboxList.forEach((item: any) => {
        const formattedRefNo = formatRiRefNo(item.riRefNo || item.vopId || item.number, item.academicYear);
        const riRefNo = formattedRefNo || item.riRefNo || '';
        const receiveDate = item.receiveDate || item.receivedDate || '';
        const docNumber = item.docNumber || item.bookNumber || item.number || '';
        const sender = item.sender || '';
        const department = item.department || '';
        
        // Map 6th column: subject + detail
        const subjectBase = item.subject || item.title || item.notes || '';
        const vpDetail = item.vpRouting?.detail ? `\nรายละเอียดการพิจารณา: ${item.vpRouting.detail}` : '';
        const subject = `${subjectBase}${vpDetail}`;

        // Map 7th column: vpRouting.docType
        const docType = item.vpRouting?.docType || item.docType || '';

        // Map 8th column: vpRouting.status
        const vpStatus = item.vpRouting?.status || item.status || 'อยู่ระหว่างพิจารณา';

        // Outgoing parameters default to empty, will be merged
        const sendDate = item.sendDate || '';
        const receiver = item.receiver && !isLegacyInstitutional(item.receiver) ? item.receiver : '';
        const outgoingDepartment = item.outgoingDepartment || '';

        const key = riRefNo ? riRefNo : (item.id || Math.random().toString());

        rowMap[key] = [
          riRefNo,
          receiveDate,
          docNumber,
          sender,
          department,
          subject,
          docType,
          vpStatus,
          sendDate,
          receiver,
          outgoingDepartment
        ];
      });

      // 3. CONSOLIDATE AND ZIP OUTGOING DATA STREAM (OUTBOX)
      outboxList.forEach((item: any) => {
        const formattedRefNo = formatRiRefNo(item.riRefNo || item.vopId || item.number, item.academicYear);
        const riRefNo = formattedRefNo || item.riRefNo || '';
        
        const rawReceiver = item.receiver || item.receiverName || '';
        const receiver = isLegacyInstitutional(rawReceiver) ? '' : rawReceiver;
        const outgoingDepartment = item.outgoingDepartment || item.receiverDepartment || item.department || '';
        const sendDate = item.sendDate || item.dispatchDate || '';

        const key = riRefNo ? riRefNo : (item.id || Math.random().toString());

        if (rowMap[key]) {
          // Mutate the existing array slot by filling in outgoing data attributes (Column 9, 10 and 11)
          rowMap[key][8] = sendDate || rowMap[key][8] || '';
          
          const fallbackReceiver = rowMap[key][9] && !isLegacyInstitutional(rowMap[key][9]) ? rowMap[key][9] : '';
          rowMap[key][9] = receiver || fallbackReceiver;
          rowMap[key][10] = outgoingDepartment || rowMap[key][10] || '';
        } else {
          // Create a new clean 11-column array row
          rowMap[key] = [
            riRefNo,
            item.receiveDate || item.dispatchDate || '',
            item.bookNumber || item.number || '',
            item.sender || '',
            item.department || '',
            item.subject || item.title || item.notes || '',
            item.vpRouting?.docType || item.docType || '',
            item.vpRouting?.status || item.status || 'อยู่ระหว่างพิจารณา',
            sendDate,
            receiver,
            outgoingDepartment
          ];
        }
      });

      // 4. GENERATE AND CLEANUP FILE
      const finalizedRows = Object.values(rowMap);

      // Sort logically by RI Ref No.
      finalizedRows.sort((a, b) => {
        const refA = String(a[0] || "");
        const refB = String(b[0] || "");
        
        const matchA = refA.match(/วพ\.\s*(\d+)\/(\d+)/);
        const matchB = refB.match(/วพ\.\s*(\d+)\/(\d+)/);
        
        if (matchA && matchB) {
          const numA = parseInt(matchA[1], 10);
          const yearA = parseInt(matchA[2], 10);
          const numB = parseInt(matchB[1], 10);
          const yearB = parseInt(matchB[2], 10);
          
          if (yearA !== yearB) {
            return yearA - yearB;
          }
          return numA - numB;
        }
        
        return refA.localeCompare(refB, 'th', { numeric: true, sensitivity: 'base' });
      });

      // Write array directly into a single sheet named "รายงานสารบรรณรวม"
      const wsData = [headers, ...finalizedRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "รายงานสารบรรณรวม");

      // Trigger download
      XLSX.writeFile(wb, `รายงานสารบรรณรวม_วพ_${selectedYear}.xlsx`);
    } catch (error) {
      console.error("Export to Excel failed:", error);
      alert("เกิดข้อผิดพลาดในการส่งออกรายงาน Excel กรุณาลองใหม่อีกครั้ง");
    } finally {
      setIsExporting(false);
    }
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleDownloadPdf = () => {
    // Open the new premium Executive Print selector dialog
    setShowReportDialog(true);
  };

  const handlePrintVector = () => {
    setShowReportDialog(false);
    // Let the browser transition render, then trigger the OS print engine
    setTimeout(() => {
      window.print();
    }, 250);
  };

  const handleExportHtml2Pdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    setShowReportDialog(false);

    try {
      // 1. [หน่วงเวลาให้กราฟนิ่ง (Delay for Animation)]: delay 800ms for stable render of charts and animations
      await new Promise((resolve) => setTimeout(resolve, 800));

      // 2. [แก้ปัญหาการดึง Element]: ใช้ useRef
      const element = reportRef.current;
      if (!element) {
        throw new Error("ไม่พบองค์ประกอบรายงาน Infographic");
      }

      const canvas = await html2canvas(element, {
        scale: 2.2, // extra crisp high density quality
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
        allowTaint: true,
        width: 794,
        height: 1123,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
      const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

      pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`รายงานสรุปสถิติ_วพ_ประจำปีศึกษา_${selectedYear === "all" ? "ทั้งหมด" : selectedYear}.pdf`);
    } catch (error) {
      console.error("PDF export failed:", error);
      alert("เกิดข้อผิดพลาดในการส่งออกรายงาน PDF สำรอง กรุณาเลือกวิธี 'พิมพ์ออกเป็น PDF/บันทึกผ่านเบราว์เซอร์' แทนเพื่อความเสถียรสูงสุด");
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Filter documents based on year selection
  const filteredDocs = selectedYear === "all" 
    ? documents 
    : documents.filter(d => d.academicYear === selectedYear);

  const total = filteredDocs.length;

  const inboxDocs = filteredDocs.filter(d => d.category === DocumentCategory.INBOX);
  const outboxDocs = filteredDocs.filter(d => d.category === DocumentCategory.OUTBOX);

  // Helper to calculate days pending/stuck
  const getDaysPending = (receiveDateStr?: string) => {
    if (!receiveDateStr) return 0;
    const receivedDate = new Date(receiveDateStr);
    if (isNaN(receivedDate.getTime())) return 0;
    
    // Create Date object representing today (at midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Set received date to midnight for pure day calculations
    const received = new Date(receivedDate);
    received.setHours(0, 0, 0, 0);
    
    const diffTime = today.getTime() - received.getTime();
    if (diffTime <= 0) return 0;
    
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper to check if a document is completed
  const isDocCompleted = (doc: Document) => {
    if (doc.category === DocumentCategory.INBOX) {
      return doc.status !== "อยู่ระหว่างพิจารณา";
    }
    return doc.status === "ดำเนินการแล้ว/ส่งออกแล้ว" || doc.status === DocumentStatus.COMPLETED;
  };

  // Completed status count: includes "อนุมัติ", "ดำเนินการแล้ว/ส่งออกแล้ว", and DocumentStatus.COMPLETED
  const completed = filteredDocs.filter(isDocCompleted).length;

  const completedInbox = inboxDocs.filter(isDocCompleted).length;

  const completedOutbox = outboxDocs.filter(isDocCompleted).length;

  // Count unique incoming documents where status is "พิจารณาแล้ว" or "อนุมัติ"
  const incomingApprovedCount = inboxDocs.filter(d => d.status === "พิจารณาแล้ว" || d.status === "อนุมัติ").length;

  const inboxPendingCount = inboxDocs.filter(d => d.status === "อยู่ระหว่างพิจารณา").length;

  // Computed SLA delayed incoming count: Pending and received > 5 calendar days ago
  const slaDelayedCount = inboxDocs.filter(d => {
    if (d.status !== "อยู่ระหว่างพิจารณา") return false;
    const baseDateStr = d.receiveDate || d.receivedDate || d.createdAt;
    if (!baseDateStr) return false;
    const baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) return false;
    const diffTime = new Date().getTime() - baseDate.getTime();
    return diffTime > 5 * 24 * 60 * 60 * 1000;
  }).length;

  const successRate = inboxDocs.length > 0
    ? Math.round((incomingApprovedCount / inboxDocs.length) * 100)
    : 0;

  // Overdue/Late status count: LATE status or INBOX that are not approved and received > 5 days ago
  const late = filteredDocs.filter(d => {
    if (d.status === DocumentStatus.LATE || d.status === "ล่าช้า") return true;
    if (d.category === DocumentCategory.INBOX) {
      const isApproved = isDocCompleted(d);
      const recDate = d.receivedDate || d.receiveDate;
      return !isApproved && isReceivedMoreThan5DaysAgo(recDate);
    }
    return false;
  }).length;

  const lateInbox = inboxDocs.filter(d => {
    if (d.status === DocumentStatus.LATE || d.status === "ล่าช้า") return true;
    const isApproved = isDocCompleted(d);
    const recDate = d.receivedDate || d.receiveDate;
    return !isApproved && isReceivedMoreThan5DaysAgo(recDate);
  }).length;

  const lateOutbox = outboxDocs.filter(d => d.status === DocumentStatus.LATE || d.status === "ล่าช้า").length;

  // Pending status count: not completed and not late
  const pending = filteredDocs.filter(d => {
    const isCompleted = isDocCompleted(d);
    if (isCompleted) return false;
    
    const isLate = d.status === DocumentStatus.LATE || d.status === "ล่าช้า" || (d.category === DocumentCategory.INBOX && isReceivedMoreThan5DaysAgo(d.receivedDate || d.receiveDate));
    return !isLate;
  }).length;

  const pendingInbox = inboxDocs.filter(d => {
    const isCompleted = isDocCompleted(d);
    if (isCompleted) return false;
    
    const isLate = d.status === DocumentStatus.LATE || d.status === "ล่าช้า" || isReceivedMoreThan5DaysAgo(d.receivedDate || d.receiveDate);
    return !isLate;
  }).length;

  const pendingOutbox = outboxDocs.filter(d => d.status === DocumentStatus.PENDING).length;

  // 1. Chart Data calculation: ประเภทเอกสารเข้า (Inbox Delivery Channels Only)
  const inboxDocsForChart = filteredDocs.filter(d => d.category === DocumentCategory.INBOX);
  const chartTotal = inboxDocsForChart.length;
  const emailCount = inboxDocsForChart.filter(d => d.docType === "e-mail" || d.docType === "อีเมล").length;
  const paperCount = chartTotal - emailCount;

  // 2. Chart Data calculation: สถิติตามหน่วยงาน (Department Distribution) - สรุปเฉพาะเอกสารเข้า
  const departmentCounts: { [key: string]: number } = {};
  inboxDocs.forEach(d => {
    const dept = d.receiverDepartment || d.department || d.sender || "ไม่ต้องการระบุ";
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  });

  const sortedDepartments = Object.entries(departmentCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const topDepartments = sortedDepartments.slice(0, 5);
  const otherDepartmentsCount = sortedDepartments.slice(5).reduce((acc, curr) => acc + curr.count, 0);
  if (otherDepartmentsCount > 0) {
    topDepartments.push({ name: "หน่วยงานอื่นๆ", count: otherDepartmentsCount });
  }

  // Most urgent critical action documents (Pending or Late Inbox documents ordered by priority)
  const criticalDocs = filteredDocs
    .filter(d => {
      if (d.category !== DocumentCategory.INBOX) return false;
      const activeStatus = d.vpRouting?.status || d.status || "อยู่ระหว่างพิจารณา";
      return activeStatus === "อยู่ระหว่างพิจารณา";
    })
    .sort((a, b) => {
      const dateA = a.receivedDate || a.receiveDate || "";
      const dateB = b.receivedDate || b.receiveDate || "";
      return dateA.localeCompare(dateB);
    })
    .slice(0, 10);

  const getPriorityBadgeColors = (priority: any) => {
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
        return "bg-amber-50 text-amber-700 border-amber-200 font-sans font-bold";
      default:
        return "bg-slate-50 text-slate-700 border-slate-200 font-sans font-semibold";
    }
  };

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

  const getStatusBadgeColors = (status: any, doc?: Document) => {
    const statusVal = doc ? (doc.status || "อยู่ระหว่างพิจารณา") : (status || "อยู่ระหว่างพิจารณา");
    const recDate = doc ? (doc.receivedDate || doc.receiveDate) : "";
    const isLate = statusVal === DocumentStatus.LATE || (doc && doc.category === DocumentCategory.INBOX && isReceivedMoreThan5DaysAgo(recDate));
    if (isLate && statusVal === "อยู่ระหว่างพิจารณา") {
      return "bg-rose-50 text-rose-700 border-rose-200 animate-pulse font-bold";
    }

    if (statusVal === "อยู่ระหว่างพิจารณา") {
      return "bg-amber-50 text-amber-800 border-amber-200 font-bold";
    }
    if (statusVal === "ดำเนินการแล้ว/ส่งออกแล้ว") {
      return "bg-slate-50 text-slate-500 border-slate-200 bg-opacity-50 font-bold";
    }
    if (statusVal === "อนุมัติ" || statusVal === "approved" || statusVal === "normal" || statusVal === DocumentPriority.NORMAL || statusVal === DocumentStatus.COMPLETED) {
      return "bg-emerald-50 text-emerald-800 border-emerald-200 font-bold";
    }
    if (statusVal === "ลงนามแล้ว" || statusVal === "urgent" || statusVal === DocumentPriority.URGENT) {
      return "bg-indigo-50 text-indigo-800 border-indigo-200 font-bold";
    }
    if (statusVal === "พิจารณาแล้ว" || statusVal === "very_urgent" || statusVal === DocumentPriority.VERY_URGENT) {
      return "bg-teal-50 text-teal-800 border-teal-200 font-bold";
    }
    return "bg-slate-50 text-slate-800 border-slate-200 font-bold";
  };

  const getStatusLabel = (doc: Document) => {
    const statusVal = doc.status || "อยู่ระหว่างพิจารณา";
    if (statusVal === "approved" || statusVal === DocumentStatus.COMPLETED) {
      return "พิจารณาแล้ว";
    }
    if (statusVal === "normal" || statusVal === DocumentPriority.NORMAL) {
      return "อนุมัติ";
    }
    if (statusVal === "urgent" || statusVal === DocumentPriority.URGENT) {
      return "ลงนามแล้ว";
    }
    if (statusVal === "very_urgent" || statusVal === DocumentPriority.VERY_URGENT) {
      return "พิจารณาแล้ว";
    }
    const recDate = doc.receivedDate || doc.receiveDate;
    const isLate = statusVal === DocumentStatus.LATE || (doc.category === DocumentCategory.INBOX && isReceivedMoreThan5DaysAgo(recDate));
    if (isLate && statusVal === "อยู่ระหว่างพิจารณา") {
      return "เกินกำหนดพิจารณา";
    }
    return statusVal;
  };

  return (
    <div id="dashboard-view" className="space-y-6 font-sans">
      {/* View Header with Academic Year Dropdown selection */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-[#003366] tracking-tight">สรุปสถิติบริการข้อมูลเอกสาร (Executive Dashboard)</h2>
          <p className="text-xs text-slate-500 font-light mt-0.5">
            สรุปข้อมูลสถิติและแผนภูมิการวิเคราะห์ภาระงานของสายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ
          </p>
        </div>
        
        {/* Quick action buttons & Academic Year selector */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick Actions group */}
          <div className="flex flex-row gap-2 items-center">
            <button
              onClick={() => setActiveTab("ledger")}
              className="h-9 px-4 py-2 bg-[#0F2942] hover:bg-[#153452] text-white font-medium text-sm rounded-lg border border-amber-400/30 shadow-sm flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-98 cursor-pointer"
            >
              <span className="text-amber-400 font-extrabold text-[#D4AF37]">📋</span>
              <span className="tracking-wide">จัดการเอกสาร (Documents)</span>
            </button>
            <button
              onClick={handleExportCombineExcel}
              disabled={isExporting}
              className={`h-9 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-98 cursor-pointer ${
                isExporting ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              <FileText size={16} />
              <span>{isExporting ? "Exporting..." : "Export to Excel"}</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExportingPdf}
              className={`h-9 px-4 py-2 bg-[#003366] hover:bg-[#002244] text-white text-sm font-medium rounded-lg border border-amber-400/20 shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-98 cursor-pointer ${
                isExportingPdf ? "opacity-75 cursor-not-allowed" : ""
              }`}
            >
              <span className="text-amber-400 font-extrabold text-[#D4AF37]">📊</span>
              <span>{isExportingPdf ? "Generating PDF..." : "Report"}</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

          {/* Academic selector group */}
          <div className="flex items-center gap-2.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <CalendarDays size={14} className="text-[#003366]" />
              <span>ปีการศึกษา:</span>
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value === "all" ? "all" : parseInt(e.target.value))}
              className="h-9 bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold rounded-lg px-2.5 focus:outline-none focus:ring-1 focus:ring-[#003366] cursor-pointer"
            >
              <option value="all">แสดงทั้งหมด (ทุกปีการศึกษา)</option>
              {yearsRange.map((yr) => (
                <option key={yr} value={yr}>
                  ปีการศึกษา {yr}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics Block - Elegant 5-Card Flex Layout */}
      <div className="flex flex-row gap-3 w-full items-stretch justify-between overflow-x-auto pb-2">
        {/* KPI 1: เอกสารเข้าทั้งหมด */}
        <div className="bg-gradient-to-br from-indigo-50/80 to-purple-50/50 border border-indigo-100 shadow-sm flex-1 min-w-[150px] md:min-w-0 h-full p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 font-sans">
          <div className="flex items-start justify-between w-full">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest block truncate">เอกสารเข้าทั้งหมด</span>
              <span className="text-lg md:text-xl font-bold font-mono text-indigo-900 mt-1 block">{inboxDocs.length} <span className="text-xs font-bold text-indigo-700/60 font-sans">รายการ</span></span>
            </div>
            <span className="p-1.5 bg-indigo-100/80 text-indigo-700 border border-indigo-200/50 rounded-xl shrink-0 ml-1.5 shadow-sm font-bold">
              <Layers size={14} />
            </span>
          </div>
          {/* Delivery type breakdown */}
          <div className="mt-4 pt-1.5 border-t border-indigo-100/50 text-[10px] font-extrabold text-indigo-700/80 truncate">
            อีเมล: {emailCount} | กระดาษ: {paperCount}
          </div>
        </div>

        {/* KPI 2: อยู่ระหว่างพิจารณา */}
        <div className="bg-gradient-to-br from-amber-50/80 to-orange-50/50 border border-amber-100 shadow-sm flex-1 min-w-[150px] md:min-w-0 h-full p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 font-sans">
          <div className="flex items-start justify-between w-full">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-amber-600 uppercase tracking-widest block truncate overflow-hidden">อยู่ระหว่างพิจารณา</span>
              <span className="text-lg md:text-xl font-bold font-mono text-[#78350F] mt-1 block">{inboxPendingCount} <span className="text-xs font-bold text-amber-700/60">รายการ</span></span>
            </div>
            <span className="p-1.5 bg-amber-100/80 text-amber-700 border border-amber-200/50 rounded-xl shrink-0 ml-1.5 shadow-sm">
              <Clock size={14} />
            </span>
          </div>
          <div className="mt-4 pt-1.5 border-t border-transparent text-[10px] font-extrabold text-transparent select-none">
            spacer
          </div>
        </div>

        {/* KPI 3: พิจารณาแล้ว */}
        <div className="bg-gradient-to-br from-emerald-50/80 to-green-50/50 border border-emerald-100 shadow-sm flex-1 min-w-[150px] md:min-w-0 h-full p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 font-sans">
          <div className="flex items-start justify-between w-full">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest block truncate overflow-hidden">พิจารณาแล้ว</span>
              <span className="text-lg md:text-xl font-bold font-mono text-emerald-900 mt-1 block">{incomingApprovedCount} <span className="text-xs font-bold text-emerald-700/60 font-sans">รายการ</span></span>
            </div>
            <span className="p-1.5 bg-emerald-100/80 text-emerald-700 border border-emerald-200/50 rounded-xl shrink-0 ml-1.5 shadow-sm">
              <CheckCircle2 size={14} />
            </span>
          </div>
          <div className="mt-4 pt-1.5 border-t border-transparent text-[10px] font-extrabold text-transparent select-none">
            spacer
          </div>
        </div>

        {/* KPI 4: ส่งมอบ/เสร็จสิ้น */}
        <div className="bg-gradient-to-br from-violet-50/80 to-blue-50/50 border border-violet-100 shadow-sm flex-1 min-w-[150px] md:min-w-0 h-full p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 font-sans">
          <div className="flex items-start justify-between w-full">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-violet-600 uppercase tracking-widest block truncate overflow-hidden font-sans">ส่งมอบ/เสร็จสิ้น</span>
              <span className="text-lg md:text-xl font-bold font-mono text-[#4C1D95] mt-1 block">{outboxDocs.length} <span className="text-xs font-bold text-violet-700/60 font-sans">รายการ</span></span>
            </div>
            <span className="p-1.5 bg-violet-100/80 text-violet-700 border border-violet-200/50 rounded-xl shrink-0 ml-1.5 shadow-sm font-bold">
              <FileText size={14} />
            </span>
          </div>
          <div className="mt-4 pt-1.5 border-t border-transparent text-[10px] font-extrabold text-transparent select-none">
            spacer
          </div>
        </div>

        {/* KPI 5: ล่าช้าเกิน 5 วัน */}
        <div className="bg-gradient-to-br from-rose-50 to-red-100 border border-red-200 shadow-sm flex-1 min-w-[150px] md:min-w-0 h-full p-4 rounded-2xl flex flex-col justify-between hover:scale-[1.02] transition-all duration-300 font-sans">
          <div className="flex items-start justify-between w-full">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-extrabold text-rose-600 uppercase tracking-widest block truncate overflow-hidden">ล่าช้าเกิน 5 วัน</span>
              <span className="text-lg md:text-xl font-bold font-mono text-rose-950 mt-1 block">
                {slaDelayedCount} <span className="text-xs font-bold text-rose-800/60 font-sans">รายการ</span>
              </span>
            </div>
            <span className="p-1.5 bg-rose-100/80 text-[#9F1239] border border-rose-200 rounded-xl shrink-0 ml-1.5 shadow-sm">
              <ShieldAlert size={14} className={slaDelayedCount > 0 ? "animate-pulse" : ""} />
            </span>
          </div>
          <div className="mt-4 pt-1.5 border-t border-transparent text-[10px] font-extrabold text-transparent select-none">
            spacer
          </div>
        </div>
      </div>

      {/* Charts Section: ประเภทเอกสาร และ สถิติตามหน่วยงาน */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: สัดส่วนเอกสารเข้า-ออกตาม ประเภทเอกสาร (e-mail vs เอกสารกระดาษ) */}
        <div id="chart-doc-type" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">ช่องทางการส่งเอกสารเข้า (Inbox Channels)</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">สัดส่วนเอกสารเข้าเฉพาะประเภทเอกสารเข้าจริง (อีเมลและเอกสารกระดาษพิจารณาจริง)</p>
          </div>

          {chartTotal > 0 ? (
            <div className="space-y-5 my-3">
              {/* Bar Chart 1: E-mail Channel */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#003366]">
                    <Mail size={13} className="text-[#003366]/70" />
                    <span>ช่องทางอีเมล (Inbox)</span>
                  </span>
                  <span className="font-mono text-slate-700">
                    {emailCount} ฉบับ ({chartTotal > 0 ? Math.round((emailCount / chartTotal) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-6.5 rounded-lg overflow-hidden flex">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-1000 ease-out font-mono text-[10px] text-white flex items-center justify-end pr-2.5 font-bold"
                    style={{ width: `${chartTotal > 0 ? (emailCount / chartTotal) * 100 : 0}%` }}
                  >
                    {emailCount > 0 && `${chartTotal > 0 ? Math.round((emailCount / chartTotal) * 100) : 0}%`}
                  </div>
                </div>
              </div>

              {/* Bar Chart 2: Paper Channel */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="flex items-center gap-1.5 text-[#003366]">
                    <File size={13} className="text-[#003366]/70" />
                    <span>เอกสารกระดาษ / แฟ้มเสนอ (Inbox)</span>
                  </span>
                  <span className="font-mono text-slate-700">
                    {paperCount} ฉบับ ({chartTotal > 0 ? Math.round((paperCount / chartTotal) * 100) : 0}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-6.5 rounded-lg overflow-hidden flex">
                  <div 
                    className="bg-pink-600 h-full transition-all duration-1000 ease-out font-mono text-[10px] text-white flex items-center justify-end pr-2.5 font-bold"
                    style={{ width: `${chartTotal > 0 ? (paperCount / chartTotal) * 100 : 0}%` }}
                  >
                    {paperCount > 0 && `${chartTotal > 0 ? Math.round((paperCount / chartTotal) * 100) : 0}%`}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-400 font-medium">ไม่มีข้อมูลปีการศึกษานี้สำหรับแยกประเภทช่องทาง</div>
          )}

          <div className="border-t border-slate-100 pt-3.5 mt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold font-sans">
            <span>คำนวณสถิติจากประเภทเอกสารในระบบเพื่อติดตามประสิทธิภาพการลดขยะกระดาษ</span>
            <span className="bg-[#003366]/5 text-[#003366] px-1.5 py-0.5 rounded">คำนวณอัตโนมัติ</span>
          </div>
        </div>

        {/* Chart 2: สรุปสถิติตามหน่วยงานปลายทาง/เจ้าของเรื่อง */}
        <div id="chart-department" className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">ปริมาณงานแยกตามหน่วยงานเจ้าของเรื่อง</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">สรุปสัดส่วนภาระงานตามหน่วยงานหรือคณะต่างๆ ที่เสนอเข้ามา</p>
          </div>

          {total > 0 && topDepartments.length > 0 ? (
            <div className="space-y-3.5 my-1">
              {topDepartments.map((dept, idx) => {
                const percentage = Math.round((dept.count / total) * 100);
                // Colors rotation
                const colors = ["bg-[#003366]", "bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-sky-500", "bg-slate-400"];
                const barColor = colors[idx % colors.length];

                return (
                  <div key={dept.name} className="space-y-1">
                    <div className="flex justify-between items-center text-[11px] font-bold text-slate-700">
                      <span className="truncate max-w-[220px]">{dept.name}</span>
                      <span className="font-mono text-slate-500 shrink-0 select-none ml-2">
                        {dept.count} รายการ ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-5.5 rounded-md overflow-hidden flex">
                      <div 
                        className={`${barColor} h-full transition-all duration-1000 ease-out font-mono text-[9px] text-white flex items-center justify-end pr-2 font-bold`}
                        style={{ width: `${percentage}%` }}
                      >
                        {percentage > 0 && `${percentage}%`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-10 text-xs text-slate-400 font-medium">ไม่มีข้อมูลหน่วยงานของปีการศึกษานี้</div>
          )}

          <div className="border-t border-slate-100 pt-3.5 mt-2 flex items-center justify-between text-[10px] text-slate-400 font-semibold font-sans">
            <span>สำรวจปริมาณงานเพื่อประกอบการบริหารบุคลากรสายวิจัยและพัฒนานวัตกรรมการศึกษาตามสัดส่วนงานจริง</span>
            <span className="bg-[#003366]/5 text-[#003366] px-1.5 py-0.5 rounded">ระบบวิเคราะห์</span>
          </div>
        </div>
      </div>

      {/* Visual Progress Ratios & Critical Overdue list row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document Completion Progress */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#003366] uppercase tracking-wider">สัดส่วนอัตราความสำเร็จการดำเนินงาน</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 block">ร้อยละของเอกสารที่ดำเนินงานแล้วเสร็จสิ้น</p>
          </div>
          
          <div className="py-6 flex flex-col items-center justify-center">
            {inboxDocs.length > 0 ? (
              <>
                <div className="relative flex items-center justify-center h-28 w-28">
                  {/* Base Circle */}
                  <div className="absolute inset-0 rounded-full border-8 border-slate-100"></div>
                  {/* Dynamic Progress Indicator */}
                  <div 
                    className="absolute inset-0 rounded-full border-8 border-[#003366] border-t-transparent border-r-transparent transition-all duration-1000"
                    style={{ transform: `rotate(${(successRate / 100) * 360}deg)` }}
                  ></div>
                  <div className="z-10 text-center">
                    <span className="text-2xl font-black font-mono text-[#003366]">
                      {successRate}%
                    </span>
                    <span className="text-[9px] block text-slate-400 font-medium">สำเร็จ</span>
                  </div>
                </div>
                <div className="mt-4 text-xs font-semibold text-slate-700">
                  {incomingApprovedCount} จาก {inboxDocs.length} รายการเสร็จสิ้น
                </div>
              </>
            ) : (
              <div className="text-slate-400 text-xs py-10 font-medium text-center">
                ไม่มีข้อมูลที่ตรงกับปีการศึกษาที่เลือก
              </div>
            )}
          </div>
          
          <div id="ratios-breakdown" className="border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">เสร็จสิ้น</span>
              <span className="text-[#003366] font-mono text-xs">{incomingApprovedCount}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">อยู่ระหว่างทำ</span>
              <span className="text-amber-600 font-mono text-xs">{inboxPendingCount}</span>
            </div>
            <div>
              <span className="text-slate-400 block mb-0.5 font-medium">ล่าช้าเกิน 5 วัน</span>
              <span className="text-rose-600 font-mono text-xs">{slaDelayedCount}</span>
            </div>
          </div>
        </div>

        {/* Critical Overdue Document alerts list */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-800 tracking-tight flex items-center gap-2 uppercase tracking-wider">
                <ShieldAlert size={15} className="text-rose-500" />
                <span className="text-[#003366]">เอกสารติดตามเร่งด่วน</span>
              </h3>
              <button 
                onClick={() => setActiveTab("ledger")}
                className="text-[10px] text-blue-600 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>ดูสมุดบันทึกคุมเอกสารรวมทั้งหมด</span>
                <ExternalLink size={10} />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              เอกสารเข้าที่อยู่ในสถานะรอตรวจสอบ ด่วนที่สุด หรือ เกินกว่ากำหนดพิจารณา
            </p>
          </div>

          <div className="mt-4 space-y-3 inline-block w-full align-middle font-sans">
            {criticalDocs.length > 0 ? (
              <div className="space-y-3">
                {criticalDocs.map((doc) => (
                  <div key={doc.id} className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-150 shadow-sm flex items-center justify-between gap-4 group transition-all duration-200">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-bold font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200/50">
                          {formatRiRefNo(doc.riRefNo || doc.vopId || doc.number, doc.academicYear)}
                        </span>
                        <span className={`text-[9px] px-2 py-0.5 rounded border font-extrabold tracking-wide uppercase ${getStatusBadgeColors(doc.status, doc)}`}>
                          {getStatusLabel(doc)}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-[#0F2942] truncate group-hover:text-blue-700 transition-colors leading-snug">
                        {doc.title}
                      </h4>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 font-medium flex-wrap">
                        <span className="truncate">ยื่นเรื่องโดย: {doc.sender}</span>
                        <span>•</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100/50">
                            {doc.dueDate ? `กำหนด: ${formatThaiDate(doc.dueDate)}` : `รับเมื่อ: ${formatThaiDate(doc.receivedDate || doc.receiveDate || "")}`}
                          </span>
                          {(() => {
                            const days = getDaysPending(doc.receivedDate || doc.receiveDate);
                            return (
                              <span className="text-rose-700 font-extrabold bg-rose-100/80 px-1.5 py-0.5 rounded border border-rose-300">
                                [ ค้างอยู่ {days} วัน ]
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2 border border-dashed border-slate-200 rounded-xl my-4">
                <CheckCircle2 size={32} className="text-emerald-500" />
                <span className="font-bold text-slate-700">ไม่มีเอกสารวิกฤตในขณะนี้</span>
                <span>เอกสารนำเข้าทั้งหมดได้รับการจัดการหรือปิดงานเรียบร้อยแล้ว</span>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-medium font-sans">
            <span>เรียงตามระยะเวลาค้างดำเนินการ จากเก่าที่สุดไปใหม่ที่สุด (FIFO)</span>
            <span className="font-mono text-[9px]">อัปเดตแบบ Realtime</span>
          </div>
        </div>
      </div>

      {/* 📊 A4 Executive Infographic Report Container rendered off-screen */}
      {(() => {
        const ratedDocsList = filteredDocs.filter((d) => typeof d.serviceRating === "number" && d.serviceRating > 0);
        const totalRatingsCount = ratedDocsList.length;
        const averageRatingScore = totalRatingsCount > 0
          ? (ratedDocsList.reduce((acc, curr) => acc + (curr.serviceRating || 0), 0) / totalRatingsCount).toFixed(2)
          : "0.00";

        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        ratedDocsList.forEach((d) => {
          const r = d.serviceRating as 1 | 2 | 3 | 4 | 5;
          if (ratingDistribution[r] !== undefined) {
            ratingDistribution[r]++;
          }
        });

        return (
          <>
            <div 
              id="executive-infographic-container"
              ref={reportRef}
              style={{ 
                width: "794px", 
                height: "1123px", 
                position: "fixed", 
                left: "0px", 
                top: "0px",
                zIndex: -9999,
                pointerEvents: "none",
                backgroundColor: "#ffffff"
              }}
              className="p-8 flex flex-col justify-between font-sans text-slate-800"
            >
              <div className="space-y-6">
                {/* Header Block with Navy theme */}
                <div className="border-b-4 border-[#003366] pb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">🏫</span>
                      <span className="text-xs font-extrabold text-[#003366]/80 uppercase tracking-wider font-sans">
                        สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) • มหาวิทยาลัยกรุงเทพ
                      </span>
                    </div>
                    <h1 className="text-xl font-extrabold text-[#003366] leading-tight">
                      รายงานสรุปสถิติผลการดำเนินงาน ระบบแจ้งผลการพิจารณาเอกสาร วพ.
                    </h1>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Executive Operations & Satisfaction Rating Summary Report
                    </p>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <div className="bg-[#003366]/5 px-3 py-1.5 rounded-lg border border-[#003366]/15">
                      <p className="text-[10px] font-bold text-slate-500 leading-none">ประจำปีการศึกษา</p>
                      <p className="text-base font-black text-[#003366] mt-1 font-mono">
                        {selectedYear === "all" ? "ทุกปีการศึกษา" : `ปีการศึกษา ${selectedYear}`}
                      </p>
                    </div>
                    <div className="text-[9px] text-slate-400 font-bold mt-1.5 font-mono">
                      วันที่ส่งออก: {formatThaiDate(new Date().toISOString())}
                    </div>
                  </div>
                </div>

                {/* Quick Core Executive Summary Text block */}
                <div className="bg-[#003366]/5 p-3.5 rounded-xl border border-[#003366]/10 text-xs leading-relaxed text-[#071D33] font-medium leading-relaxed">
                  <strong>บทสรุปผู้บริหาร:</strong> ในปีการศึกษา {selectedYear === "all" ? "ทั้งหมด" : selectedYear} ระบบได้อำนวยความสะดวกในการบริหารจัดการและคุมเอกสารเข้า-ออก คิดเป็นสัดส่วนความสำเร็จสำเร็จสะสม {successRate}% โดยสถิติที่สำคัญมีโครงสร้างดังแสดงในรายงานสรุปภาพรวมฉบับนี้
                </div>

                {/* Core KPI Cards Block */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">เอกสารเสนอพิจารณารวม</span>
                    <span className="text-xl font-bold font-mono text-[#003366] block mt-1">{inboxDocs.length}</span>
                    <span className="text-[9px] text-[#003366]/60 font-bold">รายการเอกสารเข้า</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">อนุมัติ / แล้วเสร็จ</span>
                    <span className="text-xl font-bold font-mono text-emerald-700 block mt-1">{incomingApprovedCount}</span>
                    <span className="text-[9px] text-emerald-600 font-bold">อัตราสัดส่วน {successRate}%</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">อยู่ระหว่างดำเนินการ</span>
                    <span className="text-xl font-bold font-mono text-amber-600 block mt-1">{inboxPendingCount}</span>
                    <span className="text-[9px] text-amber-500 font-bold">อยู่ระหว่างตรวจเอกสาร</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-center">
                    <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider block">ค้างเกินกำหนด (SLA)</span>
                    <span className="text-xl font-bold font-mono text-rose-700 block mt-1">{slaDelayedCount}</span>
                    <span className="text-[9px] text-rose-500 font-bold">เกินกำหนด 5 วัน</span>
                  </div>
                </div>

                {/* Insights charts section (2 column layout) */}
                <div className="grid grid-cols-2 gap-6 pt-2">
                  {/* Delivery channels */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#003366] uppercase tracking-wider mb-0.5">ช่องทางส่งมอบเอกสารราชการ</h3>
                      <p className="text-[10px] text-slate-400 mb-3 font-semibold">สรุปตามประเภทโครงสร้างนำเสนอเข้าหลัก (Inbox Volume)</p>
                    </div>
                    
                    <div className="space-y-4 my-2">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-600">
                          <span>ช่องทางอีเมล (Inbox-Email)</span>
                          <span className="font-mono">{emailCount} รายการ ({chartTotal > 0 ? Math.round((emailCount / chartTotal) * 100) : 0}%)</span>
                        </div>
                        <div className="w-full bg-slate-150 h-5 rounded-md overflow-hidden">
                          <div className="bg-[#003366] h-full" style={{ width: `${chartTotal > 0 ? (emailCount / chartTotal) * 100 : 0}%` }} />
                        </div>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10.5px] font-bold text-slate-600">
                          <span>เอกสารกระดาษ / แฟ้มเสนอ (Paper & Files)</span>
                          <span className="font-mono">{paperCount} รายการ ({chartTotal > 0 ? Math.round((paperCount / chartTotal) * 100) : 0}%)</span>
                        </div>
                        <div className="w-full bg-slate-150 h-5 rounded-md overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: `${chartTotal > 0 ? (paperCount / chartTotal) * 100 : 0}%` }} />
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-[9px] text-slate-400 mt-2 font-bold select-none">• การนำส่งทางอิเล็กทรอนิกส์ช่วยร่นระยะดำเนินการได้กว่า 50%</p>
                  </div>

                  {/* Department stats */}
                  <div className="bg-white p-4 rounded-xl border border-slate-200/80 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#003366] uppercase tracking-wider mb-0.5">ภาระงานสูงสุด 5 ลำดับแรก</h3>
                      <p className="text-[10px] text-slate-400 mb-3 font-semibold">ปริมาณคุมเอกสารจำแนกตามสัดส่วนหน่วยงานต้นสังกัด</p>
                    </div>

                    {topDepartments.length > 0 ? (
                      <div className="space-y-2 my-1">
                        {topDepartments.slice(0, 5).map((dept, idx) => {
                          const percentage = total > 0 ? Math.round((dept.count / total) * 100) : 0;
                          const colors = ["bg-[#003366]", "bg-[#1E3A8A]", "bg-[#3B82F6]", "bg-[#60A5FA]", "bg-[#93C5FD]"];
                          return (
                            <div key={dept.name} className="space-y-0.5">
                              <div className="flex justify-between items-center text-[9px] font-bold text-slate-600">
                                <span className="truncate max-w-[150px]">{dept.name}</span>
                                <span className="font-mono">{dept.count} รายการ ({percentage}%)</span>
                              </div>
                              <div className="w-full bg-slate-150 h-4 rounded-md overflow-hidden">
                                <div className={`${colors[idx % colors.length]} h-full`} style={{ width: `${percentage}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-[10px] text-slate-400 py-6 font-medium">ไม่มีข้อมูลหน่วยงานเสนอเล่ม</div>
                    )}
                  </div>
                </div>

                {/* ⭐️ Customer/Professor Satisfaction Ratings Level Column */}
                <div className="bg-white p-4.5 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-3 border-b border-slate-150 pb-2">
                    <div>
                      <h3 className="text-xs font-extrabold text-[#003366] uppercase tracking-wider">
                        ผลประเมินความพึงพอใจการให้บริการ (วพ. Service Rating Score)
                      </h3>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5 font-sans">
                        ความพึงพอใจโดยภาพรวมของอาจารย์และนักวิจัยผู้ขอความอนุเคราะห์บริการ
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[9px] text-slate-400 font-bold font-sans">คะแนนเฉลี่ยสุทธิ</p>
                        <p className="text-lg font-black text-[#003366] font-mono leading-none mt-0.5">
                          {averageRatingScore} <span className="text-xs font-bold text-slate-400 font-sans">/ 5.00</span>
                        </p>
                      </div>
                      <div className="flex text-amber-400 text-base">
                        {"★".repeat(Math.round(parseFloat(averageRatingScore)))}{"☆".repeat(5 - Math.round(parseFloat(averageRatingScore)))}
                      </div>
                    </div>
                  </div>

                  {/* Satisfaction 1 to 5 distribution from left to right */}
                  <div className="grid grid-cols-5 gap-3.5 pt-1.5">
                    {[
                      { val: 1, label: "ปรับปรุง (1)", emoji: "🤬", color: "bg-red-500", text: "ปรับปรุง" },
                      { val: 2, label: "พอใช้ (2)", emoji: "🙁", color: "bg-orange-400", text: "พอใช้" },
                      { val: 3, label: "ปานกลาง (3)", emoji: "😐", color: "bg-amber-400", text: "ปานกลาง" },
                      { val: 4, label: "ดี (4)", emoji: "😊", color: "bg-emerald-500", text: "ดี" },
                      { val: 5, label: "ดีเยี่ยม (5)", emoji: "🤩", color: "bg-[#003366]", text: "ดีเยี่ยม" }
                    ].map((item) => {
                      const count = ratingDistribution[item.val as 1|2|3|4|5] || 0;
                      const percentage = totalRatingsCount > 0 ? Math.round((count / totalRatingsCount) * 100) : 0;
                      return (
                        <div key={item.val} className="bg-slate-50 p-2.5 rounded-lg border border-slate-150 text-center flex flex-col justify-between">
                          <div>
                            <span className="text-lg block mb-0.5">{item.emoji}</span>
                            <span className="text-[9px] font-extrabold text-[#003366] block leading-tight">{item.label}</span>
                          </div>
                          <div className="mt-2.5">
                            <span className="text-xs font-black text-slate-700 font-mono block leading-none">{count} <span className="text-[8px] font-bold text-slate-400">ครั้ง</span></span>
                            {/* mini progress bar */}
                            <div className="w-full bg-slate-200 h-1 rounded-full mt-1.5 overflow-hidden">
                              <div className={`${item.color} h-full`} style={{ width: `${percentage}%` }} />
                            </div>
                            <span className="text-[8px] text-slate-400 font-bold block mt-1 font-mono">{percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-bold mt-3.5">
                    <span>จำนวนผู้ตอบแบบสำรวจความพึงพอใจทั้งหมดสะสม: {totalRatingsCount} คณาจารย์</span>
                    <span>เกณฑ์เป้าหมายดัชนีชี้วัดองค์กร (KPI): ≥ 4.50 คะแนนดาว</span>
                  </div>
                </div>
              </div>

              {/* Footer Executive Stamp area */}
              <div className="border-t border-slate-200 pt-4 flex items-end justify-between text-[10px] text-slate-500">
                <div>
                  <p className="font-extrabold text-slate-600 block">สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) มหาวิทยาลัยกรุงเทพ</p>
                  <p className="text-[8px] text-slate-400 mt-1 font-semibold leading-none">
                    ระบบสารบรรณและคุมเอกสารอิเล็กทรอนิกส์ • พัฒนาด้วยเทคโนโลยีคลาวด์และ Google Workspace API
                  </p>
                </div>
                
                <div className="text-center w-[200px]">
                  <p className="text-[9px] font-bold text-slate-400 mb-9 leading-none">ผู้ประเมินรับเสนอรายงานและตรวจรับรองความถูกต้อง</p>
                  <div className="border-b border-slate-300 w-[160px] mx-auto mb-1.5" />
                  <p className="text-[9.5px] font-extrabold text-slate-700 leading-none">
                    ( ............................................................ )
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold mt-1.5 leading-none">
                    รองอธิการบดีสายวิจัยและพัฒนานวัตกรรมการศึกษา
                  </p>
                </div>
              </div>
            </div>

            {/* 📊 Premium Report Helper Dialog/Modal */}
            {showReportDialog && (
              <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 font-sans animate-fadeIn">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden text-slate-800 p-6 space-y-6 relative">
                  <div className="flex items-start gap-3">
                    <div className="p-3 bg-[#003366]/10 text-[#003366] rounded-xl text-xl shrink-0">
                      📊
                    </div>
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">ตัวช่วยจัดพิมพ์รายงาน วพ. (Report Wizard)</h3>
                      <p className="text-xs text-slate-500 mt-0.5">โปรดเลือกวิธีการส่งออกรายงานสรุปภาพรวมผู้บริหารแบบ 1 หน้ากระดาษ A4</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {/* Method 1: Print Vector PDF (Highly Recommended) */}
                    <button
                      onClick={handlePrintVector}
                      className="w-full p-4 bg-[#003366]/5 hover:bg-[#003366]/10 text-[#003366] rounded-xl border border-[#003366]/15 hover:border-[#003366]/30 text-left transition-all flex items-start gap-3.5 active:scale-[0.98] cursor-pointer group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform shrink-0">🖨️</span>
                      <div className="flex-1">
                        <span className="text-xs font-black block text-slate-900">บันทึกเป็น PDF ผ่านเบราว์เซอร์ (Vector Line - แนะนำสุงสุด)</span>
                        <span className="text-[10px] text-slate-500 block mt-1 leading-normal font-medium">ใช้วิธีเรียก Print ของเบราว์เซอร์โดยตรง ตัวอักษรภาษาไทยคมเฉียบแบบเวกเตอร์แท้ 100% ไม่เบลอ ไม่ต้องลงโปรแกรมเพิ่ม</span>
                      </div>
                    </button>

                    {/* Method 2: Image Canvas PDF Generation (Fallback) */}
                    <button
                      onClick={handleExportHtml2Pdf}
                      disabled={isExportingPdf}
                      className="w-full p-4 bg-amber-50 hover:bg-amber-100/80 text-amber-900 rounded-xl border border-amber-200/60 hover:border-amber-300 text-left transition-all flex items-start gap-3.5 active:scale-[0.98] cursor-pointer disabled:opacity-50 group"
                    >
                      <span className="text-2xl group-hover:scale-110 transition-transform shrink-0">🖼️</span>
                      <div className="flex-1">
                        <span className="text-xs font-black block text-amber-950">ดาวน์โหลดด้วยกราฟิกจำลอง (AI Canvas Image PDF - สำรอง)</span>
                        <span className="text-[10px] text-slate-500 block mt-1 leading-normal font-medium">รอระบบหน่วงเวลา 800ms เพื่อประมวลผลแอนิเมชันของแผนภูมิจนหยุดนิ่ง แล้วถ่ายภาพสัญลักษณ์อัดแน่นลงเอกสาร PDF</span>
                      </div>
                    </button>
                  </div>

                  <div className="flex justify-end gap-2.5 border-t border-slate-100 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowReportDialog(false)}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs rounded-lg transition active:scale-95 cursor-pointer"
                    >
                      ปิดหน้าต่าง
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
