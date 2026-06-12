import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocFromServer,
  runTransaction
} from "firebase/firestore";
import { Document, DocumentStatus, DocumentPriority, DocumentCategory } from "../types";
import { formatThaiDate } from "../utils/academicYear";
import firebaseConfig from "../../firebase-applet-config.json";

// Check if valid Firebase configuration is present
export const isFirebaseConfigured =
  firebaseConfig &&
  firebaseConfig.apiKey &&
  firebaseConfig.apiKey !== "";

let app: any = null;
export let db: any = null;
let auth: any = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(app);
    console.log("Firebase initialized successfully with credentials:", firebaseConfig.projectId);

    // Test connection as requested in the Firebase skill instructions
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration: Client is offline.");
        }
      }
    };
    testConnection();
  } catch (err) {
    console.error("Failed to initialize Firebase SDK:", err);
  }
} else {
  console.log("Using Mock/Local Database mode. Configure Firebase in the UI for persistent deployment storage.");
}

// Error handling structures as mandated by firebase-integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const currentAuth = auth;
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentAuth?.currentUser?.uid || "mock-uid",
      email: currentAuth?.currentUser?.email || "mock-user@bu.ac.th",
      emailVerified: currentAuth?.currentUser?.emailVerified || true,
      isAnonymous: currentAuth?.currentUser?.isAnonymous || false,
      tenantId: currentAuth?.currentUser?.tenantId || null,
      providerInfo: currentAuth?.currentUser?.providerData?.map((provider: any) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [{ providerId: "google.com", email: "mock-user@bu.ac.th" }]
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ----------------------------------------------------
// LOCALSTORAGE FALLBACK MOCK DATABASE DRIVER (FOR SANDBOXED PREVIEWS)
// ----------------------------------------------------
const MOCK_STORAGE_KEY_DOCS = "bu_docs_data";
const MOCK_STORAGE_KEY_ADMINS = "bu_admins_data";

// Pre-populate mock database with some elegant realistic Bangkok University documents
const INITIAL_MOCK_DOCUMENTS: Document[] = [
  {
    id: "doc-1",
    title: "ขออนุมัติจัดโครงการสัมมนาหลักสูตรและพัฒนานวัตกรรม ประจำปีการศึกษา 2568",
    number: "วพ. 021/2568",
    sender: "สาขาวิชาหลักสูตรและการสอน",
    receiver: "รองอธิการบดีสายวิจัยและพัฒนานวัตกรรมการศึกษา (รอง วพ.)",
    receiveDate: "2026-05-15",
    dueDate: "2026-06-15",
    academicYear: 2568,
    status: "อยู่ระหว่างพิจารณา",
    priority: DocumentPriority.URGENT,
    category: DocumentCategory.INBOX,
    notes: "รอเอกสารเพิ่มเติมจากภาควิชา เพื่อตรวจสอบรายชื่อผู้ยื่นเสนอ",
    createdAt: "2026-05-15T08:00:00.000Z",
    updatedAt: "2026-05-15T08:00:00.000Z",
    vopId: "วพ. 001/2568",
    receivedDate: "2026-05-15",
    bookNumber: "วพ. 021/2568",
    department: "สาขาวิชาหลักสูตรและการสอน",
    docType: "paper"
  },
  {
    id: "doc-2",
    title: "แบบคำขอสอบป้องกันวิทยานิพนธ์ ของนักศึกษาระดับบัณฑิตศึกษาเสนอ รอง วพ.",
    number: "วพ. 114/2568",
    sender: "ฝ่ายวิชาการสายวิจัยและพัฒนานวัตกรรมการศึกษา",
    receiver: "ผู้รักษาการแทนหัวหน้าสำนักงาน",
    receiveDate: "2026-05-10",
    dueDate: "2026-05-24",
    academicYear: 2568,
    status: "อยู่ระหว่างพิจารณา",
    priority: DocumentPriority.VERY_URGENT,
    category: DocumentCategory.INBOX,
    notes: "เลยกำหนดพิจารณา รอดำเนินการด่วน",
    createdAt: "2026-05-10T09:30:00.000Z",
    updatedAt: "2026-05-10T09:30:00.000Z",
    vopId: "วพ. 002/2568",
    receivedDate: "2026-05-10",
    bookNumber: "วพ. 114/2568",
    department: "ฝ่ายวิชาการสายวิจัยและพัฒนานวัตกรรมการศึกษา",
    docType: "e-mail"
  },
  {
    id: "doc-3",
    title: "รายงานการตอบรับตีพิมพ์บทความวิจัยระดับชาติและนานาชาติ",
    number: "วพ. 090/2568",
    sender: "กองบรรณาธิการวารสาร ม.กรุงเทพ",
    receiver: "นักศึกษาสายงานวิจัยนวัตกรรม",
    receiveDate: "2026-05-25",
    dueDate: "2026-06-25",
    academicYear: 2568,
    status: "อยู่ระหว่างพิจารณา",
    priority: DocumentPriority.NORMAL,
    category: DocumentCategory.INBOX,
    createdAt: "2026-05-25T10:15:00.000Z",
    updatedAt: "2026-05-25T10:15:00.000Z",
    vopId: "วพ. 003/2568",
    receivedDate: "2026-05-25",
    bookNumber: "วพ. 090/2568",
    department: "กองบรรณาธิการวารสาร ม.กรุงเทพ",
    docType: "paper"
  },
  {
    id: "doc-4",
    title: "แจ้งกำหนดการลงทะเบียนเรียนสิทธิ์เรียนระดับบัณฑิตศึกษา ภาคฤดูร้อน/2568",
    number: "วพ. 203/2568",
    sender: "รองอธิการบดีสายวิจัยและพัฒนานวัตกรรมการศึกษา (รอง วพ.)",
    receiver: "หน่วยงานทะเบียน มหาวิทยาลัยกรุงเทพ",
    receiveDate: "2026-05-20",
    academicYear: 2568,
    status: "อนุมัติ",
    priority: DocumentPriority.NORMAL,
    category: DocumentCategory.OUTBOX,
    notes: "จัดส่งเอกสารนำส่งเรียบร้อยแล้ว",
    createdAt: "2026-05-20T11:00:00.000Z",
    updatedAt: "2026-05-20T11:00:00.000Z",
    vopId: "วพ. 004/2568",
    receivedDate: "2026-05-20",
    bookNumber: "วพ. 203/2568",
    department: "ฝ่ายบริการสายวิจัยและพัฒนานวัตกรรมการศึกษา",
    docType: "e-mail"
  }
];

const INITIAL_MOCK_ADMINS = ["kittiwat.p@bu.ac.th", "admin.test@bu.ac.th"];

// Initialize localStorage if not set
if (typeof window !== "undefined") {
  if (!localStorage.getItem(MOCK_STORAGE_KEY_DOCS)) {
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(INITIAL_MOCK_DOCUMENTS));
  }
  if (!localStorage.getItem(MOCK_STORAGE_KEY_ADMINS)) {
    localStorage.setItem(MOCK_STORAGE_KEY_ADMINS, JSON.stringify(INITIAL_MOCK_ADMINS));
  }
}

// ----------------------------------------------------
// DATABASE EXPOSED SERVICES
// ----------------------------------------------------

export async function fetchDocuments(year?: number | "all"): Promise<Document[]> {
  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      let q;
      if (year && year !== "all") {
        const numericYear = typeof year === "string" ? parseInt(year) : year;
        q = query(collection(db, "documents"), where("academicYear", "==", numericYear));
      } else {
        q = collection(db, "documents");
      }
      const querySnapshot = await getDocs(q);
      const docs: Document[] = [];
      querySnapshot.forEach((doc) => {
        docs.push({ id: doc.id, ...(doc.data() as any) } as Document);
      });
      return docs;
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, "documents");
      return [];
    }
  } else {
    // LocalStorage Fallback
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    let docsList: Document[] = stored ? JSON.parse(stored) : [];
    // Dynamic recalculate status from 'pending' to 'late' if past dueDate
    const todayStr = new Date().toISOString().split('T')[0];
    docsList = docsList.map(doc => {
      if (doc.status === DocumentStatus.PENDING && doc.dueDate && doc.dueDate < todayStr) {
        return { ...doc, status: DocumentStatus.LATE, updatedAt: new Date().toISOString() };
      }
      return doc;
    });
    if (year && year !== "all") {
      const numericYear = typeof year === "string" ? parseInt(year) : year;
      return docsList.filter((d) => d.academicYear === numericYear);
    }
    return docsList;
  }
}

export async function saveDocument(document: Document): Promise<void> {
  const cleanDocument = Object.fromEntries(
    Object.entries(document).filter(([_, val]) => val !== undefined)
  ) as Document;

  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "documents", cleanDocument.id);
      await setDoc(docRef, cleanDocument);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `documents/${cleanDocument.id}`);
    }
  } else {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    const docsList: Document[] = stored ? JSON.parse(stored) : [];
    const index = docsList.findIndex((d) => d.id === cleanDocument.id);

    if (index >= 0) {
      docsList[index] = cleanDocument;
    } else {
      docsList.push(cleanDocument);
    }
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
  }
}

export async function updateDocument(document: Document): Promise<void> {
  const cleanDocument = Object.fromEntries(
    Object.entries(document).filter(([_, val]) => val !== undefined)
  ) as Document;

  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "documents", cleanDocument.id);
      await updateDoc(docRef, cleanDocument as any);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `documents/${cleanDocument.id}`);
    }
  } else {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    const docsList: Document[] = stored ? JSON.parse(stored) : [];
    const index = docsList.findIndex((d) => d.id === cleanDocument.id);

    if (index >= 0) {
      docsList[index] = cleanDocument;
    } else {
      docsList.push(cleanDocument);
    }
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
  }
}

export async function fetchDocumentByIdPublic(id: string): Promise<Document | null> {
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "documents", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as Document;
      }
      return null;
    } catch (err) {
      console.error("fetchDocumentByIdPublic failed:", err);
    }
  }
  
  const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
  const docsList: Document[] = stored ? JSON.parse(stored) : [];
  const found = docsList.find(d => d.id === id);
  return found || null;
}

export async function submitDocumentRatingPublic(id: string, ratingValue: number): Promise<void> {
  const updatedAt = new Date().toISOString();
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "documents", id);
      await updateDoc(docRef, {
        serviceRating: ratingValue,
        updatedAt: updatedAt
      });
      return;
    } catch (err) {
      console.error("submitDocumentRatingPublic failed:", err);
    }
  }

  const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
  const docsList: Document[] = stored ? JSON.parse(stored) : [];
  const index = docsList.findIndex(d => d.id === id);
  if (index >= 0) {
    docsList[index] = {
      ...docsList[index],
      serviceRating: ratingValue,
      updatedAt: updatedAt
    };
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
  }
}

export async function saveNewInboxDocumentWithTransaction(document: Document): Promise<Document> {
  const cleanDocument = Object.fromEntries(
    Object.entries(document).filter(([_, val]) => val !== undefined)
  ) as Document;

  if (isFirebaseConfigured && db && auth?.currentUser) {
    let lastError: any = null;
    let initialCount: number | null = null;
    const selectedYear = cleanDocument.academicYear;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const finalDoc = await runTransaction(db, async (transaction) => {
          const counterRef = doc(db, "counters", `incoming_${selectedYear}`);
          const counterSnap = await transaction.get(counterRef);
          
          let currentCounter = 0;
          if (counterSnap.exists()) {
            currentCounter = counterSnap.data().counter || 0;
          } else {
            if (initialCount === null) {
              throw { code: "pre-fetch-counter" };
            }
            currentCounter = initialCount;
          }

          const nextCalculatedValue = currentCounter + 1;
          const paddedNumber = nextCalculatedValue.toString().padStart(3, "0");
          const riRefNoValue = `วพ. ${paddedNumber}/${selectedYear}`;
          const formattedId = `${nextCalculatedValue}/${selectedYear}`;
          
          const docWithVopId: Document = {
            ...cleanDocument,
            runningNumber: nextCalculatedValue,
            vopId: riRefNoValue,
            riRefNo: riRefNoValue,
            number: formattedId
          };

          const docRef = doc(db, "documents", docWithVopId.id);
          
          transaction.set(counterRef, {
            counter: nextCalculatedValue,
            updatedAt: new Date().toISOString()
          });
          transaction.set(docRef, docWithVopId);
          
          return docWithVopId;
        });

        return finalDoc;
      } catch (err: any) {
        if (err && err.code === "pre-fetch-counter") {
          try {
            const queryDocs = await getDocs(collection(db, "documents"));
            let count = 0;
            queryDocs.forEach((d) => {
              const data = d.data() as Document;
              if (data.category === DocumentCategory.INBOX && data.academicYear === selectedYear) {
                count++;
              }
            });
            initialCount = count;
          } catch (fetchErr) {
            console.error("Failed to fetch initial count:", fetchErr);
            initialCount = 0;
          }
          attempt--;
          continue;
        }

        console.warn(`Transaction attempt ${attempt} failed:`, err);
        lastError = err;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    throw new Error("ระบบกำลังจัดคิวออกเลข วพ. กรุณากดบันทึกอีกครั้ง");
  } else {
    // LocalStorage fallback mock transaction atomic simulation
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    const docsList: Document[] = stored ? JSON.parse(stored) : [];
    const selectedYear = cleanDocument.academicYear;
    
    const inboxInYear = docsList.filter(
      (d) => d.category === DocumentCategory.INBOX && d.academicYear === selectedYear
    );
    const nextCalculatedValue = inboxInYear.length + 1;
    const paddedNumber = nextCalculatedValue.toString().padStart(3, "0");
    const riRefNoValue = `วพ. ${paddedNumber}/${selectedYear}`;
    const formattedId = `${nextCalculatedValue}/${selectedYear}`;
    
    const finalDoc: Document = {
      ...cleanDocument,
      runningNumber: nextCalculatedValue,
      vopId: riRefNoValue,
      riRefNo: riRefNoValue,
      number: formattedId
    };
    
    docsList.push(finalDoc);
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
    return finalDoc;
  }
}

export async function saveOutgoingDocumentWithTransaction(outgoingDoc: Document): Promise<Document> {
  let cleanOutgoing = Object.fromEntries(
    Object.entries(outgoingDoc).filter(([_, val]) => val !== undefined)
  ) as unknown as Document;

  if (isFirebaseConfigured && db && auth?.currentUser) {
    const selectedYear = cleanOutgoing.academicYear;
    const isBoundToIncoming = !!cleanOutgoing.originalDocId;

    if (isBoundToIncoming) {
      // BYPASS AUTORUN COUNTER
      try {
        const incomingParentRefNo = cleanOutgoing.riRefNo || cleanOutgoing.number || "";
        cleanOutgoing.riRefNo = incomingParentRefNo;
        if (!cleanOutgoing.number) {
          cleanOutgoing.number = incomingParentRefNo;
        }

        // Generate dynamic protection token or keep existing ID if editing
        const isEditing = cleanOutgoing.id && !cleanOutgoing.id.startsWith("outbox-num-") && !cleanOutgoing.id.startsWith("outbox-");
        const finalDocId = isEditing ? cleanOutgoing.id : `${incomingParentRefNo}_out_${Date.now()}`;
        cleanOutgoing.id = finalDocId;

        await runTransaction(db, async (transaction) => {
          // Write to documents for standard app-listings compatibility
          const docRefMain = doc(db, "documents", finalDocId);
          // Write to outgoing_documents for Spark protection rule
          const docRefOutgoing = doc(db, "outgoing_documents", finalDocId);

          transaction.set(docRefMain, cleanOutgoing);
          transaction.set(docRefOutgoing, cleanOutgoing);
        });
      } catch (err: any) {
        console.error("Error saving bound outgoing document with transaction:", err);
        handleFirestoreError(err, OperationType.WRITE, `outgoing_documents/${cleanOutgoing.id}`);
        throw err;
      }
    } else {
      if (cleanOutgoing.runningNumber === undefined) {
        let lastError: any = null;
        let initialCount: number | null = null;

        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const finalDoc = await runTransaction(db, async (transaction) => {
              const counterRef = doc(db, "counters", `outgoing_${selectedYear}`);
              const counterSnap = await transaction.get(counterRef);
              
              let currentCounter = 0;
              if (counterSnap.exists()) {
                currentCounter = counterSnap.data().counter || 0;
              } else {
                if (initialCount === null) {
                  throw { code: "pre-fetch-counter" };
                }
                currentCounter = initialCount;
              }

              const nextCalculatedValue = currentCounter + 1;
              const paddedNumber = nextCalculatedValue.toString().padStart(3, "0");
              const riRefNoValue = `วพ. ${paddedNumber}/${selectedYear}`;
              const formattedId = `${nextCalculatedValue}/${selectedYear}`;
              
              const docWithOutgoingId: Document = {
                ...cleanOutgoing,
                runningNumber: nextCalculatedValue,
                riRefNo: riRefNoValue,
                number: formattedId
              };

              const docRef = doc(db, "documents", docWithOutgoingId.id);
              const docRefOutgoing = doc(db, "outgoing_documents", docWithOutgoingId.id);
              
              transaction.set(counterRef, {
                counter: nextCalculatedValue,
                updatedAt: new Date().toISOString()
              });
              transaction.set(docRef, docWithOutgoingId);
              transaction.set(docRefOutgoing, docWithOutgoingId);
              
              return docWithOutgoingId;
            });

            cleanOutgoing = finalDoc;
            break;
          } catch (err: any) {
            if (err && err.code === "pre-fetch-counter") {
              try {
                const queryDocs = await getDocs(collection(db, "documents"));
                let count = 0;
                queryDocs.forEach((d) => {
                  const data = d.data() as Document;
                  if (data.category === DocumentCategory.OUTBOX && data.academicYear === selectedYear) {
                    count++;
                  }
                });
                initialCount = count;
              } catch (fetchErr) {
                console.error("Failed to fetch initial count:", fetchErr);
                initialCount = 0;
              }
              attempt--;
              continue;
            }

            console.warn(`Transaction attempt ${attempt} failed:`, err);
            lastError = err;
            await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
          }
        }
      } else {
        // Just update directly
        try {
          const outgoingRef = doc(db, "documents", cleanOutgoing.id);
          const outRef2 = doc(db, "outgoing_documents", cleanOutgoing.id);
          await setDoc(outgoingRef, cleanOutgoing);
          await setDoc(outRef2, cleanOutgoing);
        } catch (saveErr) {
          console.error("Error writing outgoing document directly:", saveErr);
          handleFirestoreError(saveErr, OperationType.WRITE, `documents/${cleanOutgoing.id}`);
          throw saveErr;
        }
      }
    }

    // 2. Wrap secondary operation (updating the status of the linked Incoming document) in its own isolated block
    try {
      // Resolve incomingDocId BEFORE starting the transaction
      let incomingDocId = cleanOutgoing.originalDocId;

      const isNativeId = (id?: string) => {
        if (!id) return false;
        return /^[a-zA-Z0-9_-]+$/.test(id);
      };

      if (incomingDocId && !isNativeId(incomingDocId)) {
        const valToMatch = incomingDocId.split(":")[0].trim();
        const querySnapshot = await getDocs(collection(db, "documents"));
        const match = querySnapshot.docs.find(d => {
          const data = d.data();
          if (data.category !== DocumentCategory.INBOX) return false;
          const cleanRefVopId = valToMatch.replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          const dataVopIdClean = (data.vopId || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          const dataNumberClean = (data.number || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          return dataVopIdClean === cleanRefVopId || dataNumberClean === cleanRefVopId;
        });
        if (match) {
          incomingDocId = match.id;
        } else {
          incomingDocId = undefined;
        }
      }

      if (!incomingDocId && cleanOutgoing.originalDocVopId) {
        const querySnapshot = await getDocs(collection(db, "documents"));
        const match = querySnapshot.docs.find(d => {
          const data = d.data();
          if (data.category !== DocumentCategory.INBOX) return false;
          
          const cleanRefVopId = (cleanOutgoing.originalDocVopId || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          const dataVopIdClean = (data.vopId || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          const dataNumberClean = (data.number || "").replace(/[\s\-\/\.]+/g, "").toLowerCase().trim();
          
          return dataVopIdClean === cleanRefVopId || dataNumberClean === cleanRefVopId;
        });
        if (match) {
          incomingDocId = match.id;
        }
      }

      if (incomingDocId) {
        await runTransaction(db, async (transaction) => {
          const incomingRef = doc(db, "documents", incomingDocId!);
          const incomingSnap = await transaction.get(incomingRef);
          if (incomingSnap.exists()) {
            const incomingData = incomingSnap.data() as Document;
            
            // Check if status/consideration is "อนุมัติ" or status is Completed
            const outPriority = cleanOutgoing.priority;
            const outStatus = cleanOutgoing.status;
            
            const isApproved = outPriority === "อนุมัติ" || outPriority === "approved" || outStatus === "completed" || outStatus === "ดำเนินการแล้ว/ส่งออกแล้ว" || outStatus === "จัดส่งสำเร็จ";

            // Append outgoing notes to incoming notes in a specific format
            let finalNotes = incomingData.notes || "";
            if (cleanOutgoing.notes) {
              const displayDate = formatThaiDate(cleanOutgoing.receiveDate);
              const logEntry = `\n[บันทึกส่งออกเมื่อ ${displayDate}]: ${cleanOutgoing.notes}`;
              if (!finalNotes.includes(logEntry)) {
                finalNotes = finalNotes ? `${finalNotes}${logEntry}` : logEntry.trim();
              }
            }

            const dateVal = cleanOutgoing.receiveDate || new Date().toISOString().split('T')[0];
            const updatedIncoming: Partial<Document> = {
              ...incomingData,
              notes: finalNotes || undefined,
              updatedAt: new Date().toISOString()
            };

            if (isApproved) {
              updatedIncoming.status = "อนุมัติ";
              updatedIncoming.executiveDate = incomingData.executiveDate || dateVal;
              updatedIncoming.submittedDate = incomingData.submittedDate || dateVal;
            }
            
            // Clean undefined
            const cleanIncoming = Object.fromEntries(
              Object.entries(updatedIncoming).filter(([_, val]) => val !== undefined)
            ) as unknown as Document;

            transaction.set(incomingRef, cleanIncoming);
          }
        });
      }
    } catch (secondaryErr) {
      console.warn("Secondary operation (linked incoming update) failed, but outgoing was successfully saved:", secondaryErr);
    }

    return cleanOutgoing;
  } else {
    // LocalStorage Fallback Simulation
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    const docsList: Document[] = stored ? JSON.parse(stored) : [];
    
    const selectedYear = cleanOutgoing.academicYear;
    const isBoundToIncoming = !!cleanOutgoing.originalDocId;

    if (isBoundToIncoming) {
      const incomingParentRefNo = cleanOutgoing.riRefNo || cleanOutgoing.number || "";
      cleanOutgoing.riRefNo = incomingParentRefNo;
      if (!cleanOutgoing.number) {
        cleanOutgoing.number = incomingParentRefNo;
      }
      const isEditing = cleanOutgoing.id && !cleanOutgoing.id.startsWith("outbox-num-") && !cleanOutgoing.id.startsWith("outbox-");
      const finalDocId = isEditing ? cleanOutgoing.id : `${incomingParentRefNo}_out_${Date.now()}`;
      cleanOutgoing.id = finalDocId;
    } else {
      if (cleanOutgoing.runningNumber === undefined) {
        const outboxInYear = docsList.filter(
          (d) => d.category === DocumentCategory.OUTBOX && d.academicYear === selectedYear
        );
        const nextCalculatedValue = outboxInYear.length + 1;
        const paddedNumber = nextCalculatedValue.toString().padStart(3, "0");
        const riRefNoValue = `วพ. ${paddedNumber}/${selectedYear}`;
        const formattedId = `${nextCalculatedValue}/${selectedYear}`;
        
        cleanOutgoing = {
          ...cleanOutgoing,
          runningNumber: nextCalculatedValue,
          riRefNo: riRefNoValue,
          number: formattedId
        };
      }
    }

    // Update or insert outgoing
    const idx = docsList.findIndex(d => d.id === cleanOutgoing.id);
    if (idx >= 0) {
      docsList[idx] = cleanOutgoing;
    } else {
      docsList.push(cleanOutgoing);
    }

    // Now look for linked incoming
    let incomingDocId = cleanOutgoing.originalDocId;
    if (!incomingDocId && cleanOutgoing.originalDocVopId) {
      const match = docsList.find(d => 
        d.category === DocumentCategory.INBOX && 
        (d.vopId === cleanOutgoing.originalDocVopId || d.number === cleanOutgoing.originalDocVopId)
      );
      if (match) {
        incomingDocId = match.id;
      }
    }

    if (incomingDocId) {
      const incIdx = docsList.findIndex(d => d.id === incomingDocId);
      if (incIdx >= 0) {
        const incomingData = docsList[incIdx];
        const outPriority = cleanOutgoing.priority;
        const outStatus = cleanOutgoing.status;
        const isApproved = outPriority === "อนุมัติ" || outPriority === "approved" || outStatus === "completed" || outStatus === "ดำเนินการแล้ว/ส่งออกแล้ว" || outStatus === "จัดส่งสำเร็จ";
        
        // Append outgoing notes to incoming notes in a specific format
        let finalNotes = incomingData.notes || "";
        if (cleanOutgoing.notes) {
          const displayDate = formatThaiDate(cleanOutgoing.receiveDate);
          const logEntry = `\n[บันทึกส่งออกเมื่อ ${displayDate}]: ${cleanOutgoing.notes}`;
          if (!finalNotes.includes(logEntry)) {
            finalNotes = finalNotes ? `${finalNotes}${logEntry}` : logEntry.trim();
          }
        }

        const dateVal = cleanOutgoing.receiveDate || new Date().toISOString().split('T')[0];
        const updatedIncoming: Document = {
          ...incomingData,
          notes: finalNotes || undefined,
          updatedAt: new Date().toISOString()
        };

        if (isApproved) {
          updatedIncoming.status = "อนุมัติ";
          updatedIncoming.executiveDate = incomingData.executiveDate || dateVal;
          updatedIncoming.submittedDate = incomingData.submittedDate || dateVal;
        }

        docsList[incIdx] = updatedIncoming;
      }
    }
    
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
    return cleanOutgoing;
  }
}

export async function deleteDocument(id: string): Promise<void> {
  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "documents", id);
      await deleteDoc(docRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `documents/${id}`);
    }
  } else {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_DOCS);
    let docsList: Document[] = stored ? JSON.parse(stored) : [];
    docsList = docsList.filter((d) => d.id !== id);
    localStorage.setItem(MOCK_STORAGE_KEY_DOCS, JSON.stringify(docsList));
  }
}

export async function fetchPrimaryOwnerEmail(): Promise<string> {
  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "admin_settings", "config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.primaryOwnerEmail) {
          localStorage.setItem("bu_primary_owner_email", data.primaryOwnerEmail);
          return data.primaryOwnerEmail;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch primary owner from firestore, using local fallback", err);
    }
  }
  const stored = localStorage.getItem("bu_primary_owner_email");
  return stored || "kittiwat.p@bu.ac.th";
}

export async function savePrimaryOwnerEmail(email: string): Promise<void> {
  const sanitized = email.trim().toLowerCase();
  localStorage.setItem("bu_primary_owner_email", sanitized);

  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "admin_settings", "config");
      await setDoc(docRef, {
        primaryOwnerEmail: sanitized,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Failed to save primary owner to firestore", err);
    }
  }
}

export async function fetchAdminEmails(): Promise<string[]> {
  const currentOwner = await fetchPrimaryOwnerEmail();
  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "admin_settings", "config");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        let admins = data.adminEmails || [currentOwner];
        if (!admins.includes(currentOwner)) {
          admins = [...admins, currentOwner];
        }
        return admins;
      } else {
        // Safe bootstrap initialization if missing
        await setDoc(docRef, {
          adminEmails: [currentOwner],
          primaryOwnerEmail: currentOwner,
          updatedAt: new Date().toISOString()
        });
        return [currentOwner];
      }
    } catch (err) {
      try {
        const stored = localStorage.getItem(MOCK_STORAGE_KEY_ADMINS);
        let list = stored ? JSON.parse(stored) : [currentOwner];
        if (!list.includes(currentOwner)) {
          list.push(currentOwner);
        }
        return list;
      } catch {
        handleFirestoreError(err, OperationType.GET, "admin_settings/config");
      }
    }
  } else {
    const stored = localStorage.getItem(MOCK_STORAGE_KEY_ADMINS);
    let list = stored ? JSON.parse(stored) : [currentOwner];
    if (!list.includes(currentOwner)) {
      list.push(currentOwner);
    }
    return list;
  }
}

export async function saveAdminEmails(emails: string[]): Promise<void> {
  const currentOwner = await fetchPrimaryOwnerEmail();
  const sanitized = Array.from(new Set(emails)).filter(e => e.endsWith("@bu.ac.th"));
  if (!sanitized.includes(currentOwner)) {
    sanitized.push(currentOwner);
  }

  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "admin_settings", "config");
      await setDoc(docRef, {
        adminEmails: sanitized,
        primaryOwnerEmail: currentOwner,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "admin_settings/config");
    }
  } else {
    localStorage.setItem(MOCK_STORAGE_KEY_ADMINS, JSON.stringify(sanitized));
  }
}

export async function transferPrimaryOwner(newOwnerEmail: string): Promise<void> {
  const sanitized = newOwnerEmail.trim().toLowerCase();
  if (!sanitized.endsWith("@bu.ac.th")) {
    throw new Error("อีเมลต้องลงท้ายด้วย @bu.ac.th เท่านั้น");
  }

  localStorage.setItem("bu_primary_owner_email", sanitized);

  // Read current admins, append the new owner if not already in list
  const storedAdmins = localStorage.getItem(MOCK_STORAGE_KEY_ADMINS);
  let admins: string[] = storedAdmins ? JSON.parse(storedAdmins) : ["kittiwat.p@bu.ac.th"];
  if (!admins.includes(sanitized)) {
    admins.push(sanitized);
  }

  if (isFirebaseConfigured && db && auth?.currentUser) {
    try {
      const docRef = doc(db, "admin_settings", "config");
      const docSnap = await getDoc(docRef);
      let firebaseAdmins = admins;
      if (docSnap.exists()) {
        const data = docSnap.data();
        firebaseAdmins = data.adminEmails || admins;
        if (!firebaseAdmins.includes(sanitized)) {
          firebaseAdmins = [...firebaseAdmins, sanitized];
        }
      }
      await setDoc(docRef, {
        adminEmails: firebaseAdmins,
        primaryOwnerEmail: sanitized,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, "admin_settings/config");
    }
  } else {
    localStorage.setItem(MOCK_STORAGE_KEY_ADMINS, JSON.stringify(admins));
  }
}

// ----------------------------------------------------
// AUTHENTICATION LOGISTICS
// ----------------------------------------------------
export { auth };

export async function loginWithGoogle(): Promise<any> {
  if (isFirebaseConfigured && auth) {
    try {
      const provider = new GoogleAuthProvider();
      // Require prompt to make account selection easier
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await signInWithPopup(auth, provider);
      return result.user;
    } catch (err) {
      console.error("Firebase Authentic Google Login failed, running sandbox fallback", err);
      throw err;
    }
  } else {
    throw new Error("Firebase Auth is offline. Please use the Sandbox credentials configured below.");
  }
}

export async function signOutUser(): Promise<void> {
  if (isFirebaseConfigured && auth) {
    await fbSignOut(auth);
  }
}
