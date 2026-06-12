import { useState, useEffect, useTransition } from "react";
import { Document, UserRoleInfo, DocumentCategory, DocumentStatus, DocumentPriority } from "./types";
import { getAcademicYear } from "./utils/academicYear";
import {
  fetchDocuments,
  saveDocument,
  updateDocument,
  saveNewInboxDocumentWithTransaction,
  saveOutgoingDocumentWithTransaction,
  deleteDocument,
  fetchAdminEmails,
  saveAdminEmails,
  signOutUser,
  auth,
  fetchDocumentByIdPublic,
  submitDocumentRatingPublic
} from "./services/db";
import { onAuthStateChanged } from "firebase/auth";
import AuthScreen from "./components/AuthScreen";
import Sidebar from "./components/Sidebar";
import Dashboard from "./components/Dashboard";
import IncomingDocuments from "./components/IncomingDocuments";
import UserManagement from "./components/UserManagement";
import { GraduationCap, Bell, Shield, LogOut, CheckCircle, ShieldAlert } from "lucide-react";

export default function App() {
  // Navigation & session state
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [userRole, setUserRole] = useState<"admin" | "viewer">("viewer");
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [authLoading, setAuthLoading] = useState(true);
  const [showTimeoutAlert, setShowTimeoutAlert] = useState(false);

  // Public rating flow states
  const [ratingDocId, setRatingDocId] = useState<string | null>(null);
  const [ratingLoadedDoc, setRatingLoadedDoc] = useState<Document | null>(null);
  const [ratingValueToSubmit, setRatingValueToSubmit] = useState<number | null>(null);
  const [ratingSubmitting, setRatingSubmitting] = useState<boolean>(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState<boolean>(false);

  // Dynamic Academic Year Engine calculations
  const [currentAcademicYear, setCurrentAcademicYear] = useState<number>(() => {
    const currentYearBE = new Date().getFullYear() + 543;
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth >= 8 ? currentYearBE : currentYearBE - 1;
  });
  const [selectedYear, setSelectedYear] = useState<number | "all">(() => {
    const currentYearBE = new Date().getFullYear() + 543;
    const currentMonth = new Date().getMonth() + 1;
    return currentMonth >= 8 ? currentYearBE : currentYearBE - 1;
  }); // Defaults to current Thai BE academic year

  // Database business states
  const [documents, setDocuments] = useState<Document[]>([]);
  const [adminEmails, setAdminEmails] = useState<string[]>(["kittiwat.p@bu.ac.th"]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSignOutPending, startSignOut] = useTransition();
  const [forwardDoc, setForwardDoc] = useState<Document | null>(null);

  // 1. Calculate and lock current Thai Academic Year on boot
  useEffect(() => {
    const today = new Date();
    const ay = getAcademicYear(today);
    setCurrentAcademicYear(ay);
    setSelectedYear(ay); // Default global view to current Academic Year
  }, []);

  // 2. Intercept URL public rating action (?action=rate&docId=xxx&rating=5)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    const docId = params.get("docId");
    const ratingArg = params.get("rating");

    if (action === "rate" && docId && ratingArg) {
      setRatingDocId(docId);
      const val = parseInt(ratingArg, 10);
      if (val >= 1 && val <= 5) {
        setRatingValueToSubmit(val);
      } else {
        setRatingValueToSubmit(5); // default fallback
      }
    }
  }, []);

  // 3. Fetch document details for public rating
  useEffect(() => {
    if (ratingDocId) {
      const getRatedDocument = async () => {
        try {
          const docItem = await fetchDocumentByIdPublic(ratingDocId);
          if (docItem) {
            setRatingLoadedDoc(docItem);
          } else {
            setRatingError("ไม่พบข้อมูลเอกสารในระบบ หรือรหัสเอกสารไม่ถูกต้อง");
          }
        } catch (err) {
          console.error("Failed to load document for rating:", err);
          setRatingError("เกิดข้อผิดพลาดในการโหลดข้อมูลเอกสาร");
        }
      };
      getRatedDocument();
    }
  }, [ratingDocId]);

  const handlePublicRatingSubmit = async (val: number) => {
    if (!ratingDocId) return;
    setRatingSubmitting(true);
    setRatingError(null);
    try {
      await submitDocumentRatingPublic(ratingDocId, val);
      setRatingValueToSubmit(val);
      setRatingSuccess(true);
      // Synchronize in state if already loaded
      setDocuments(prev => prev.map(d => d.id === ratingDocId ? { ...d, serviceRating: val, updatedAt: new Date().toISOString() } : d));
    } catch (err) {
      console.error("Public rating submit error:", err);
      setRatingError("เกิดข้อผิดพลาดในการบันทึกคะแนนความพึงพอใจ");
    } finally {
      setRatingSubmitting(false);
    }
  };

  // 4. Auto-submit rating if we have a valid rating code on load
  useEffect(() => {
    if (ratingDocId && ratingValueToSubmit && !ratingSuccess && !ratingSubmitting && !ratingError) {
      handlePublicRatingSubmit(ratingValueToSubmit);
    }
  }, [ratingDocId, ratingValueToSubmit]);

  // Helper to normalize document references for robust matching
  const normalizeRef = (str?: string): string => {
    if (!str) return "";
    return str.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
  };

  // Helper to normalize the decision/consideration value to clean Thai labels
  const normalizeDecision = (val: any): string => {
    if (!val) return "อยู่ระหว่างพิจารณา";
    const s = String(val).trim().toLowerCase();
    if (s === "normal" || s === "อนุมัติ") return "อนุมัติ";
    if (s === "urgent" || s === "ลงนามแล้ว") return "ลงนามแล้ว";
    if (s === "very_urgent" || s === "พิจารณาแล้ว" || s === "approved" || s === "completed") return "พิจารณาแล้ว";
    return val;
  };

  // Helper to synchronize linked document statuses on load
  const syncOnLoad = (allDocs: Document[]): { synced: Document[], changed: Document[] } => {
    const list = allDocs.map(d => ({ ...d }));
    const changed: Document[] = [];
    
    // Create lookup map of Outbox documents
    const outboxDocs = list.filter(d => d.category === DocumentCategory.OUTBOX);
    
    for (const outDoc of outboxDocs) {
      if (!outDoc.priority) continue;
      
      const inboxDoc = list.find(d => 
        d.category === DocumentCategory.INBOX && 
        (d.id === outDoc.originalDocId || 
         (outDoc.originalDocVopId && d.vopId && normalizeRef(d.vopId) === normalizeRef(outDoc.originalDocVopId)) ||
         (outDoc.originalDocVopId && d.number && normalizeRef(d.number) === normalizeRef(outDoc.originalDocVopId)))
      );
      
      if (inboxDoc) {
        const normOutPriority = normalizeDecision(outDoc.priority);
        const normInboxStatus = normalizeDecision(inboxDoc.status);
        if (normInboxStatus !== normOutPriority || inboxDoc.status !== normOutPriority || outDoc.priority !== normOutPriority) {
          inboxDoc.status = normOutPriority;
          inboxDoc.updatedAt = new Date().toISOString();
          changed.push(inboxDoc);
          
          outDoc.priority = normOutPriority;
          outDoc.updatedAt = new Date().toISOString();
          changed.push(outDoc);
        }
      }
    }
    
    return { synced: list, changed };
  };

  const processAndSetDocs = async (rawDocs: Document[]) => {
    const { synced, changed } = syncOnLoad(rawDocs);
    setDocuments(synced);
    // Remove duplicates to prevent saving twice if both Inbox and Outbox of a pair were updated
    const uniqueChanged = changed.filter((item, index, self) =>
      self.findIndex(t => t.id === item.id) === index
    );
    for (const d of uniqueChanged) {
      try {
        await saveDocument(d);
      } catch (err) {
        console.error("Error autosaving synced document on load:", err);
      }
    }
  };

  // Helper to sync modified document bi-directionally
  const runSyncOrchestrator = (allDocs: Document[], modifiedDoc: Document): { updatedDocs: Document[], docsToSave: Document[] } => {
    const docsToSave: Document[] = [];
    
    // Normalize modified field values to clean Thai labels on save
    if (modifiedDoc.category === DocumentCategory.OUTBOX && modifiedDoc.priority) {
      modifiedDoc.priority = normalizeDecision(modifiedDoc.priority);
    } else if (modifiedDoc.category === DocumentCategory.INBOX && modifiedDoc.status) {
      const normInbox = normalizeDecision(modifiedDoc.status);
      if (normInbox !== "ดำเนินการแล้ว/ส่งออกแล้ว") {
        modifiedDoc.status = normInbox;
      }
    }

    const updatedDocs = allDocs.map(d => {
      if (d.id === modifiedDoc.id) {
        return modifiedDoc;
      }
      return { ...d };
    });

    if (modifiedDoc.category === DocumentCategory.OUTBOX) {
      // Outbox updated -> Update the linked Inbox Doc status to represent this decision
      const outboxDoc = modifiedDoc;
      const linkedInbox = updatedDocs.find(d => 
        d.category === DocumentCategory.INBOX && 
        (d.id === outboxDoc.originalDocId || 
         (outboxDoc.originalDocVopId && d.vopId && normalizeRef(d.vopId) === normalizeRef(outboxDoc.originalDocVopId)) ||
         (outboxDoc.originalDocVopId && d.number && normalizeRef(d.number) === normalizeRef(outboxDoc.originalDocVopId)))
      );

      if (linkedInbox) {
        const decision = normalizeDecision(outboxDoc.priority || "อนุมัติ");
        // Don't override if Inbox is fully dispatched, but keep "การพิจารณา" value aligned
        if (linkedInbox.status !== decision && linkedInbox.status !== "ดำเนินการแล้ว/ส่งออกแล้ว") {
          linkedInbox.status = decision;
          linkedInbox.updatedAt = new Date().toISOString();
          docsToSave.push(linkedInbox);
        }
      }
    } else if (modifiedDoc.category === DocumentCategory.INBOX) {
      // Inbox updated -> Update the linked Outbox Doc priority (decision flag)
      const inboxDoc = modifiedDoc;
      const linkedOutbox = updatedDocs.find(d => 
        d.category === DocumentCategory.OUTBOX && 
        (d.originalDocId === inboxDoc.id || 
         (d.originalDocVopId && inboxDoc.vopId && normalizeRef(d.originalDocVopId) === normalizeRef(inboxDoc.vopId)) ||
         (d.originalDocVopId && inboxDoc.number && normalizeRef(d.originalDocVopId) === normalizeRef(inboxDoc.number)))
      );

      if (linkedOutbox) {
        const decision = normalizeDecision(inboxDoc.status || "อยู่ระหว่างพิจารณา");
        if (linkedOutbox.priority !== decision) {
          linkedOutbox.priority = decision;
          linkedOutbox.updatedAt = new Date().toISOString();
          docsToSave.push(linkedOutbox);
        }
      }
    }

    return { updatedDocs, docsToSave };
  };

  // 2. Fetch Administrators directory first
  const loadAdmins = async () => {
    try {
      const emails = await fetchAdminEmails();
      setAdminEmails(emails);
      return emails;
    } catch (err) {
      console.error("Failed to load admin emails directory:", err);
      return ["kittiwat.p@bu.ac.th"];
    }
  };

  // 3. Fetch all Document records and sync categories
  const loadDocuments = async () => {
    setIsLoading(true);
    try {
      const docs = await fetchDocuments(selectedYear);
      await processAndSetDocs(docs);
    } catch (err) {
      console.error("Failed to load document records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger loadDocuments on boot or change of selectedYear
  useEffect(() => {
    if (!authLoading) {
      loadDocuments();
    }
  }, [selectedYear, authLoading]);

  // Listen to persistent authentication state automatically to restore session on reload
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      loadAdmins();
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const email = user.email || "";
        const displayName = user.displayName || email.split("@")[0] || "ผู้ใช้สถาบัน";
        if (email.toLowerCase().endsWith("@bu.ac.th")) {
          setUserEmail(email);
          setUserName(displayName);
          try {
            const emails = await fetchAdminEmails();
            setAdminEmails(emails);
          } catch (err) {
            console.error("Failed to restore authenticated database state:", err);
          }
        } else {
          setUserEmail(null);
          setUserName("");
          await signOutUser();
        }
      } else {
        loadAdmins();
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 4. Role Assignment Logic: Runs whenever logged-in email or adminEmails list updates
  useEffect(() => {
    if (userEmail) {
      const lowerEmail = userEmail.toLowerCase();
      const backupOwner = (typeof window !== "undefined" ? localStorage.getItem("bu_primary_owner_email") : null) || "kittiwat.p@bu.ac.th";
      // Primary owner backup check or check in registered emails list
      if (lowerEmail === backupOwner.toLowerCase() || adminEmails.map(e => e.toLowerCase()).includes(lowerEmail)) {
        setUserRole("admin");
      } else {
        setUserRole("viewer");
        // Non-admin viewers are restricted to ledger tab only
        setActiveTab("ledger");
      }
    }
  }, [userEmail, adminEmails]);

  // 5. Inactivity Secure Session Idle Timer (60-minute threshold for development comfort)
  useEffect(() => {
    if (!userEmail) return;

    let timeoutId: NodeJS.Timeout;

    const handleInactivityLogout = () => {
      setShowTimeoutAlert(true);
      handleSignOut(true);
    };

    const resetIdleTimer = () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // 60 minutes = 3,600,000 ms (Extended for active development)
      timeoutId = setTimeout(handleInactivityLogout, 3600000);
    };

    // Initialize timer on load
    resetIdleTimer();

    // Interaction events to listen to
    const activeEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];

    activeEvents.forEach((event) => {
      window.addEventListener(event, resetIdleTimer, { passive: true });
    });

    // Cleanup listeners and pending timeout
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      activeEvents.forEach((event) => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [userEmail]);

  // Auth helper
  const handleSignIn = (email: string, name: string) => {
    setUserEmail(email);
    setUserName(name);
    setShowTimeoutAlert(false);
    // Reload databases on successful auth
    loadAdmins();
    loadDocuments();
  };

  const handleSignOut = (isIdle: boolean = false) => {
    if (!isIdle) {
      setShowTimeoutAlert(false);
    }
    startSignOut(async () => {
      try {
        await signOutUser();
        setUserEmail(null);
        setUserName("");
        setUserRole("viewer");
        setActiveTab("dashboard");
      } catch (err) {
        console.error("Failed to logout cleanly:", err);
      }
    });
  };

  const handleAppError = (err: any, fallbackMessage: string) => {
    console.error(fallbackMessage, err);
    const errString = err instanceof Error ? err.message : String(err);
    if (
      errString.toLowerCase().includes("permission-denied") ||
      errString.toLowerCase().includes("permission_denied") ||
      errString.includes("insufficient permissions") ||
      errString.includes("สิทธิ์")
    ) {
      alert("คุณไม่มีสิทธิ์ในการดำเนินการนี้ เฉพาะผู้ดูแลระบบเท่านั้น");
    } else {
      alert(fallbackMessage);
    }
  };

  // Document Database Actions
  const handleAddDocument = async (newDoc: Document) => {
    try {
      let docToSave = newDoc;
      if (newDoc.category === DocumentCategory.INBOX) {
        docToSave = await saveNewInboxDocumentWithTransaction(newDoc);
      } else if (newDoc.category === DocumentCategory.OUTBOX) {
        docToSave = await saveOutgoingDocumentWithTransaction(newDoc);
      } else {
        await saveDocument(newDoc);
      }

      setDocuments(prev => {
        const { updatedDocs, docsToSave } = runSyncOrchestrator([docToSave, ...prev], docToSave);
        // Persist secondary synced documents
        for (const sDoc of docsToSave) {
          saveDocument(sDoc).catch(e => console.error("Error saving synced doc:", e));
        }
        return updatedDocs;
      });
    } catch (err: any) {
      handleAppError(err, "เกิดข้อผิดพลาดในการบันทึกเอกสาร");
      throw err;
    }
  };

  const handleEditDocument = async (editedDoc: Document) => {
    try {
      let docToSave = editedDoc;
      if (editedDoc.category === DocumentCategory.OUTBOX) {
        docToSave = await saveOutgoingDocumentWithTransaction(editedDoc);
      } else {
        await updateDocument(editedDoc);
      }

      setDocuments(prev => {
        const { updatedDocs, docsToSave } = runSyncOrchestrator(prev, editedDoc);
        // Persist secondary synced documents
        for (const sDoc of docsToSave) {
          saveDocument(sDoc).catch(e => console.error("Error saving synced doc:", e));
        }
        return updatedDocs;
      });
    } catch (err) {
      handleAppError(err, "เกิดข้อผิดพลาดในการแก้ไขเอกสาร");
      throw err;
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      handleAppError(err, "เกิดข้อผิดพลาดในการลบเอกสาร");
    }
  };

  // User Management Admin list changes
  const handleAddAdminEmail = async (email: string) => {
    const original = [...adminEmails];
    const updated = [...adminEmails, email.toLowerCase().trim()];
    setAdminEmails(updated);
    try {
      await saveAdminEmails(updated);
    } catch (err) {
      setAdminEmails(original);
      handleAppError(err, "เกิดข้อผิดพลาดในการแต่งตั้งแอดมิน");
    }
  };

  const handleRemoveAdminEmail = async (email: string) => {
    const original = [...adminEmails];
    const updated = adminEmails.filter(e => e.toLowerCase().trim() !== email.toLowerCase().trim());
    setAdminEmails(updated);
    try {
      await saveAdminEmails(updated);
    } catch (err) {
      setAdminEmails(original);
      handleAppError(err, "เกิดข้อผิดพลาดในการถอนสิทธิ์แอดมิน");
    }
  };

  // Render Public Rating interface if action=rate query exists
  if (ratingDocId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#071329] p-4 font-sans text-[#cbd5e1]">
        <div className="w-full max-w-md bg-white border border-slate-100 rounded-3xl shadow-2xl p-6 text-slate-800 text-center space-y-6 relative overflow-hidden animate-slideUp">
          
          {/* Header Banner */}
          <div className="p-4 bg-emerald-600 text-white rounded-2xl flex flex-col items-center justify-center space-y-1">
            <span className="text-3xl">😄</span>
            <h3 className="text-sm font-bold tracking-tight">แบบประเมินความพึงพอใจการให้บริการ</h3>
            <p className="text-[10px] text-emerald-100 font-light">สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)</p>
          </div>

          {ratingError ? (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-xs font-semibold border border-red-100 space-y-2">
              <p>❌ {ratingError}</p>
              <button 
                onClick={() => setRatingDocId(null)}
                className="mt-2 text-[10px] bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg transition"
              >
                เข้าสู่ระบบหลัก
              </button>
            </div>
          ) : !ratingLoadedDoc ? (
            <div className="py-6 flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs text-slate-500 font-semibold">กำลังตรวจสอบข้อมูลเอกสาร...</span>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Document Info Card */}
              <div className="text-left bg-slate-50 border border-slate-100 rounded-xl p-4 text-xs space-y-1.5 shadow-inner">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">เรื่อง / ชื่อโครงการ:</span>
                  <span className="font-bold text-slate-800 leading-normal">{ratingLoadedDoc.subject || ratingLoadedDoc.title}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 mt-1.5">
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">เลขที่อ้างอิง วพ.:</span>
                    <span className="font-semibold text-slate-700 font-mono text-[10.5px]">
                      {ratingLoadedDoc.riRefNo || ratingLoadedDoc.number || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400 font-bold block uppercase">หน่วยงานต้นทาง:</span>
                    <span className="font-semibold text-slate-700">{ratingLoadedDoc.sender || "-"}</span>
                  </div>
                </div>
              </div>

              {/* Status Section */}
              <div className="space-y-3">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-50/50 border border-amber-200">
                  {ratingSubmitting ? (
                    <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                      <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทบันทึกคะแนน...</span>
                    </div>
                  ) : ratingSuccess ? (
                    <div className="text-center space-y-1">
                      <span className="text-2xl block animate-bounce">✨</span>
                      <p className="text-xs font-bold text-emerald-800">✓ บันทึกความพึงพอใจเรียบร้อยแล้ว!</p>
                      <p className="text-[11px] text-slate-500 font-medium">คุณประเมินระดับ: <span className="font-extrabold text-amber-600 text-sm">{"⭐".repeat(ratingValueToSubmit || 5)}</span></p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 font-medium animate-pulse">ระบบกำลังประมวลผลการส่งคะแนน...</p>
                  )}
                </div>

                {/* Rating Button Matrix for Interactive Feedback Edit */}
                <div className="space-y-2 mt-2">
                  <p className="text-[10.5px] text-slate-500 font-bold">ท่านสามารถคลิกเปลี่ยนระดับคะแนนดาวที่ต้องการได้ที่นี่:</p>
                  <div className="flex justify-center gap-1.5 sm:gap-2.5 py-1">
                    {[
                      { val: 5, emoji: "😄", text: "ดีเยี่ยม" },
                      { val: 4, emoji: "🙂", text: "ดี" },
                      { val: 3, emoji: "😐", text: "ปานกลาง" },
                      { val: 2, emoji: "🙁", text: "พอใช้" },
                      { val: 1, emoji: "😞", text: "ปรับปรุง" }
                    ].map((opt) => {
                      const isSelected = ratingValueToSubmit === opt.val;
                      return (
                        <button
                          key={opt.val}
                          type="button"
                          disabled={ratingSubmitting}
                          onClick={() => handlePublicRatingSubmit(opt.val)}
                          className={`flex flex-col items-center p-2 rounded-xl border transition-all duration-200 w-14 cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50 ${
                            isSelected
                              ? "bg-amber-100 border-amber-400 text-amber-950 shadow-sm font-bold scale-105"
                              : "bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600"
                          }`}
                        >
                          <span className="text-lg mb-0.5">{opt.emoji}</span>
                          <span className={`text-[8.5px] ${isSelected ? "text-amber-800 font-bold" : "text-slate-400"}`}>
                            {opt.text}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Thank you note */}
              <div className="pt-2 border-t border-slate-100 text-slate-400 text-[10px] leading-relaxed">
                สายงานวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.) ขอขอบพระคุณเป็นอย่างสูงสำหรับข้อมูลประเมินความพึงพอใจ เพื่อนำมาปรับปรุงคุณภาพการให้บริการของหน่วยงานในโอกาสต่อไป
              </div>
            </div>
          )}

          {/* Bottom redirection button */}
          <div className="pt-1">
            <button
              onClick={() => {
                setRatingDocId(null);
                const cleanUrl = window.location.href.split('?')[0];
                window.history.replaceState({}, document.title, cleanUrl);
              }}
              className="text-[10.5px] text-[#003366] hover:underline font-bold transition flex items-center justify-center gap-1 mx-auto"
            >
              🚪 ไปที่หน้าล็อกอินหลัก (สำหรับแอดมิน)
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div id="auth-loading-screen" className="min-h-screen flex flex-col items-center justify-center bg-[#071329] text-white font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-amber-400 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs text-slate-400 font-semibold tracking-wider uppercase animate-pulse">กำลังตรวจสอบสิทธิ์การเข้าใช้งาน...</span>
        </div>
      </div>
    );
  }

  // Render Login overlay if not identified
  if (!userEmail) {
    return <AuthScreen onSignIn={handleSignIn} showTimeoutAlert={showTimeoutAlert} />;
  }

  // If Viewer role (non-admin) is cut, deny access to the entire application other than authorized admins
  if (userRole !== "admin") {
    return (
      <div id="unauthorized-access-screen" className="min-h-screen bg-[#071329] text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900/60 border border-slate-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center space-y-6 animate-fadeIn">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-full animate-bounce">
            <ShieldAlert size={48} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-100 tracking-tight">ไม่พบสิทธิ์การเข้าใช้งานระบบ</h2>
            <p className="text-xs text-[#FFCC00] font-black uppercase font-mono tracking-wider">
              {userEmail}
            </p>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-semibold">
            เนื่องจากระบบสารสนเทศ วพ. BU ฉบับนี้เป็นระบบเก็บข้อมูลเอกสารและประเมินผลภายในหน่วยงาน ไม่เปิดบริการแก่ส่วนบุคคลทั่วไป บัญชีของคุณจึงไม่มีสิทธิ์เข้าถึงข้อมูล
          </p>
          <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-[10px] text-slate-400 font-semibold leading-normal font-sans">
            หากท่านมีความประสงค์จะอัปเดตหรือขอสิทธิ์การเขียนและจัดการ กรุณาติดต่อ อ.กิตติวัฒน์ หรือ ผู้ดูแลระบบหลัก (Primary Owner) ปัจจุบัน เพื่อทำการแต่งตั้งสิทธิ์บัญชีของท่านในภายหลัง
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full h-10 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs transition-all active:scale-95 shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>ออกจากระบบ / สลับบัญชีอื่น</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div id="app-root-container" className="min-h-screen bg-slate-50 flex flex-col lg:flex-row font-sans text-slate-800">
      
      {/* 1. Left Responsive Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedYear={selectedYear}
        setSelectedYear={setSelectedYear}
        userEmail={userEmail}
        userName={userName}
        userRole={userRole}
        currentAcademicYear={currentAcademicYear}
        onSignOut={handleSignOut}
      />

      {/* 2. Main Workspace Content block */}
      <main id="main-content" className="flex-1 flex flex-col min-w-0">
        
        {/* Dynamic Header */}
        <header className="h-16 border-b border-slate-200 bg-white px-6 shrink-0 flex items-center justify-between shadow-sm sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider hidden sm:block">
              สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)
            </span>
            <span className="text-slate-200 hidden sm:block">|</span>
            {userRole === "admin" ? (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.2 py-0.8 rounded-full border border-emerald-100 uppercase tracking-widest flex items-center gap-1">
                <Shield size={10} />
                <span>แอดมินสแกนแล้ว (Read-Write Mode)</span>
              </span>
            ) : (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2.2 py-0.8 rounded-full border border-amber-100 uppercase tracking-widest flex items-center gap-1">
                <span>ผู้เข้าชมทั่วไป (Viewer Mode - อ่านเท่านั้น)</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-4 text-xs">
            {/* Quick Status indicators */}
            <div className="hidden md:flex items-center gap-2 text-slate-500 font-semibold bg-slate-100 rounded-lg p-1 px-2.5">
              <span>ปีการศึกษาใช้งาน:</span>
              <span className="text-indigo-950 font-bold font-mono">
                {selectedYear === "all" ? "ทั้งหมด" : `พ.ศ. ${selectedYear}`}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600 hidden md:inline">สวัสดี, {userName}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            </div>
          </div>
        </header>

        {/* Dynamic Component Router Workspace */}
        <div id="content-workspace" className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
          
          {/* Main workspace loader block */}
          {isLoading && (
            <div className="w-full bg-slate-100 border text-slate-600 text-xs px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
              <span>กำลังดึงข้อมูลอัปเดตจากเครื่องบริการ...</span>
            </div>
          )}

          {/* Context Tab Router */}
          {activeTab === "dashboard" && (
            <Dashboard
              documents={documents}
              selectedYear={selectedYear}
              setSelectedYear={setSelectedYear}
              currentYear={currentAcademicYear}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === "ledger" && (
            <IncomingDocuments
              documents={documents}
              onAddDoc={handleAddDocument}
              onEditDoc={handleEditDocument}
              onDeleteDoc={handleDeleteDocument}
              userRole={userRole}
              selectedFilterYear={selectedYear}
              setSelectedFilterYear={setSelectedYear}
            />
          )}

          {activeTab === "users" && (
            <UserManagement
              adminEmails={adminEmails}
              currentUserEmail={userEmail}
              userRole={userRole}
              onAddAdmin={handleAddAdminEmail}
              onRemoveAdmin={handleRemoveAdminEmail}
              onSimulateUser={handleSignIn}
            />
          )}

        </div>
      </main>
    </div>
  );
}
