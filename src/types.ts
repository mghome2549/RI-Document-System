/**
 * Type declarations for the วพ. BU Document Tracking System
 */

export enum DocumentStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  LATE = "late"
}

export enum DocumentPriority {
  NORMAL = "normal",
  URGENT = "urgent",
  VERY_URGENT = "very_urgent"
}

export enum DocumentCategory {
  INBOX = "inbox",    // เอกสารเข้า
  OUTBOX = "outbox"   // เอกสารออก
}

export interface VpRouting {
  docType?: 'e-mail' | 'เอกสาร' | string;
  submitDate?: string;
  status?: 'อยู่ระหว่างพิจารณา' | 'อนุมัติ' | 'ลงนามแล้ว' | 'พิจารณาแล้ว' | string;
  detail?: string;
}

export interface Document {
  id: string;
  title: string;
  number: string;       // เลขที่หนังสือ (e.g., วพ 123/2568)
  sender: string;       // หน่วยงานต้นทาง
  receiver: string;     // หน่วยงานปลายทาง
  receiveDate: string;  // วันที่รับ/ออกหนังสือ (YYYY-MM-DD)
  dueDate?: string;     // วันครบกำหนด (YYYY-MM-DD) - For Inbox follow-up
  academicYear: number; // ปีการศึกษา (Thai BE)
  status: any;          // Support both enum DocumentStatus and string ('อยู่ระหว่างพิจารณา', 'อนุมัติ', etc.)
  priority: DocumentPriority | string;
  category: DocumentCategory;
  notes?: string;
  attachmentUrl?: string; // Optional URL for uploaded files
  createdAt: string;
  updatedAt: string;

  // New fields requested by prompt 2:
  vopId?: string;       // เลขที่ วพ. (e.g., วพ.001/2569)
  receivedDate?: string; // วันที่รับ
  bookNumber?: string;  // เลขที่หนังสือ
  department?: string;  // หน่วยงาน
  docType?: 'e-mail' | 'paper' | string; //ประเภท
  executiveDate?: string; // วันที่เสนอผู้บริหาร (เมื่อสถานะเป็นอนุมัติ)

  // Prompt 3 specific attributes:
  dispatchDate?: string;      // วันที่ส่งเอกสาร
  receiverName?: string;      // ชื่อผู้รับเอกสาร
  receiverDepartment?: string;// หน่วยงานผู้รับ
  exportNotes?: string;       // หมายเหตุการส่งออก
  originalDocId?: string;     // ID ของเอกสารเข้าต้นทาง (ถ้ามี)
  originalDocVopId?: string;  // เลขที่ วพ. ของเอกสารเข้าต้นทาง (ถ้ามี)
  driveLink?: string;         // ลิงก์เอกสารต้นฉบับ (Google Drive)
  submittedDate?: string;     // วันที่เสนอผู้บริหาร (วันที่เชื่อมโยง)
  runningNumber?: number;     // เลขรันหัวเรื่องยื่นรายปี (1, 2, 3...)
  riRefNo?: string;           // เลขที่อ้างอิง วพ. (e.g. วพ. 008/2568)
  serviceRating?: number;     // คะแนนประเมินความพึงพอใจการให้บริการ (1-5)

  // Embedded Object Data Schema for Zone 2:
  vpRouting?: VpRouting;

  // Additional fields for Unified Single-Row Horizontal Ledger Layout:
  senderOutside?: string;
  senderInside?: string;
  sendDate?: string;
  outgoingDepartment?: string;
  note?: string;
  docNumber?: string;
  subject?: string;
  lastUpdatedBy?: string;
  lastUpdatedAt?: string;
  recipientEmail?: string;
  pdfAttachmentName?: string;
}

export interface UserRoleInfo {
  email: string | null;
  role: "admin" | "viewer" | "unauthorized";
  displayName?: string;
}

export interface AdminConfig {
  adminEmails: string[];
  updatedAt: string;
}
