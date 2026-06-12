import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./db";

export interface Professor {
  id: string; // Row identifier (e.g. index or random ID)
  name: string; // ชื่อ-นามสกุล
  personalId?: string; // รหัสบุคลากร
  position?: string; // ตำแหน่ง
  department: string; // หน่วยงาน
  email: string; // อีเมล์
  phone?: string; // โทรศัพท์
}

const LOCAL_STORAGE_KEY_PROFS = "bu_professors_list";
const LOCAL_STORAGE_KEY_GAS_URL = "bu_gas_webapp_url_professors";

// Default pre-populated list of professors, matching historical mock actions
const DEFAULT_PROFESSORS: Professor[] = [
  {
    id: "prof-1",
    name: "ดร.พณพงศ์ สงสุทธะวัลย์",
    personalId: "10203040",
    position: "อาจารย์ประจำ",
    department: "สายวิจัยและพัฒนานวัตกรรมการศึกษา",
    email: "kittiwat.p@bu.ac.th",
    phone: "02-123-4567"
  },
  {
    id: "prof-2",
    name: "อ.กิตติวัฒน์ โพธิ์งามบวรชัย",
    personalId: "10203041",
    position: "อาจารย์ประจำ",
    department: "สายวิจัยและพัฒนานวัตกรรมการศึกษา",
    email: "kittiwat.p@bu.ac.th",
    phone: "02-123-4568"
  },
  {
    id: "prof-3",
    name: "ดร.เกรียงศักดิ์ วาระสิทธิชัย",
    personalId: "10203042",
    position: "อาจารย์ประจำ",
    department: "คณะเทคโนโลยีสารสนเทศและนวัตกรรม",
    email: "kriangsak.w@bu.ac.th",
    phone: "02-123-4569"
  },
  {
    id: "prof-4",
    name: "ผศ.ดร.จิรศักดิ์ ปัญญา",
    personalId: "10203043",
    position: "ผู้ช่วยศาสตราจารย์",
    department: "คณะวิศวกรรมศาสตร์",
    email: "jirasak.p@bu.ac.th",
    phone: "02-123-4570"
  },
  {
    id: "prof-5",
    name: "อ.ภัสราภรณ์ วีรนาท",
    personalId: "10203044",
    position: "อาจารย์ประจำ",
    department: "คณะบัญชี",
    email: "passaraporn.w@bu.ac.th",
    phone: "02-123-4571"
  }
];

// Fallback Apps Script Web App URL if user hasn't set their own yet
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbxP1Ud9Imk3zI4fkxsi2Srxtn7NY2Dj1s77JP6m3EK_pdUv72az4R-w6FkciIizbk07/exec";

/**
 * Get configured Google Apps Script URL from LocalStorage or Firestore
 */
export async function getGoogleAppsScriptUrl(): Promise<string> {
  const envUrl = import.meta.env.VITE_APP_SCRIPT_URL;
  if (envUrl && envUrl.trim() !== "") {
    return envUrl.trim();
  }

  if (isFirebaseConfigured && db) {
    try {
      const configRef = doc(db, "system_settings", "google_sheets_config");
      const configSnap = await getDoc(configRef);
      if (configSnap.exists() && configSnap.data().gasUrl) {
        return configSnap.data().gasUrl;
      }
    } catch (err) {
      console.error("Error loading GAS URL from Firestore:", err);
    }
  }
  
  const localUrl = localStorage.getItem(LOCAL_STORAGE_KEY_GAS_URL);
  return localUrl || DEFAULT_GAS_URL;
}

/**
 * Save Google Apps Script webapp URL to Firestore and LocalStorage
 */
export async function saveGoogleAppsScriptUrl(url: string): Promise<void> {
  const cleanUrl = url.trim();
  localStorage.setItem(LOCAL_STORAGE_KEY_GAS_URL, cleanUrl);
  
  if (isFirebaseConfigured && db) {
    try {
      const configRef = doc(db, "system_settings", "google_sheets_config");
      await setDoc(configRef, { gasUrl: cleanUrl, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      console.error("Error saving GAS URL to Firestore:", err);
    }
  }
}

/**
 * Fetch all professors from Google Sheet (via Apps Script) with fallback to Firestore/LocalStorage
 */
export async function fetchProfessors(): Promise<Professor[]> {
  const gasUrl = await getGoogleAppsScriptUrl();
  
  if (gasUrl && gasUrl !== "") {
    try {
      // Fetch from Google Apps Script with specific query params
      const fetchUrl = `${gasUrl}?action=GET_PROFS`;
      console.log("Fetching professor list from Google Apps Script:", fetchUrl);
      
      const response = await fetch(fetchUrl);
      if (response.ok) {
        const result = await response.json();
        if (result && result.status === "success" && Array.isArray(result.data)) {
          // Sync with LocalStorage and return
          const profList: Professor[] = result.data.map((item: any, idx: number) => ({
            id: item.id || `prof-${idx + 1}`,
            name: item.name || item["ชื่อ-นามสกุล"] || "",
            personalId: item.personalId || item["รหัสบุคลากร"] || "",
            position: item.position || item["ตำแหน่ง"] || "",
            department: item.department || item["หน่วยงาน"] || "",
            email: item.email || item["อีเมล"] || item["อีเมล์"] || "",
            phone: item.phone || item["โทรศัพท์"] || ""
          }));
          
          if (profList.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(profList));
            return profList;
          }
        }
      }
    } catch (err) {
      console.warn("GAS connection failed. Falling back to internal persistence. Error:", err);
    }
  }

  // Fallback 1: Firestore
  if (isFirebaseConfigured && db) {
    try {
      const profsCol = collection(db, "professors");
      const querySnap = await getDocs(profsCol);
      if (!querySnap.empty) {
        const profList: Professor[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          profList.push({
            id: docSnap.id,
            name: data.name || "",
            personalId: data.personalId || "",
            position: data.position || "",
            department: data.department || "",
            email: data.email || "",
            phone: data.phone || ""
          });
        });
        localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(profList));
        return profList;
      }
    } catch (err) {
      console.error("Error fetching professors from Firestore:", err);
    }
  }

  // Fallback 2: LocalStorage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (err) {
      console.error("Error parsing stored professors", err);
    }
  }

  // Fallback 3: Defaults
  localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(DEFAULT_PROFESSORS));
  return DEFAULT_PROFESSORS;
}

/**
 * Add or update a professor in the system (syncing Google Sheets, Firestore, LocalStorage)
 */
export async function saveProfessor(professor: Omit<Professor, "id"> & { id?: string }): Promise<Professor> {
  const isEditing = !!professor.id;
  const targetId = professor.id || `prof-${Date.now()}`;
  const cleanProf: Professor = {
    id: targetId,
    name: professor.name.trim(),
    personalId: professor.personalId?.trim() || "",
    position: professor.position?.trim() || "",
    department: professor.department.trim(),
    email: professor.email.trim(),
    phone: professor.phone?.trim() || ""
  };

  // 1. Sync LocalStorage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  let currentList: Professor[] = stored ? JSON.parse(stored) : [...DEFAULT_PROFESSORS];
  
  if (isEditing) {
    currentList = currentList.map((p) => p.id === targetId ? cleanProf : p);
  } else {
    currentList.push(cleanProf);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(currentList));

  // 2. Sync Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "professors", targetId);
      await setDoc(docRef, {
        name: cleanProf.name,
        personalId: cleanProf.personalId,
        position: cleanProf.position,
        department: cleanProf.department,
        email: cleanProf.email,
        phone: cleanProf.phone,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving professor to Firestore:", err);
    }
  }

  // 3. Sync Google Sheets (Google Apps Script POST)
  const gasUrl = await getGoogleAppsScriptUrl();
  if (gasUrl && gasUrl !== "") {
    try {
      console.log(`Sending ${isEditing ? 'EDIT_PROF' : 'ADD_PROF'} payload to GAS:`, gasUrl, cleanProf);
      const payload = {
        action: isEditing ? "EDIT_PROF" : "ADD_PROF",
        professor: cleanProf
      };

      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Error saving professor to Google Sheets:", err);
    }
  }

  return cleanProf;
}

/**
 * Bulk import multiple professors from CSV data arrays (using GAS and Firestore) with Upsert strategy
 */
export async function importProfessorsCsv(professorsList: Omit<Professor, "id">[]): Promise<{ upsertedCount: number; insertedCount: number }> {
  // 1. Fetch current list to identify matches
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  let currentList: Professor[] = stored ? JSON.parse(stored) : [...DEFAULT_PROFESSORS];

  const updatedDocs: Professor[] = [];
  let upsertedCount = 0;
  let insertedCount = 0;

  for (let idx = 0; idx < professorsList.length; idx++) {
    const rawP = professorsList[idx];
    const existingIndex = currentList.findIndex(
      (p) =>
        (p.email && p.email.trim().toLowerCase() === rawP.email.trim().toLowerCase()) ||
        (p.personalId && rawP.personalId && p.personalId.trim() === rawP.personalId.trim())
    );

    if (existingIndex !== -1) {
      // Upsert: Overwrite matching record
      const match = currentList[existingIndex];
      const updatedProf: Professor = {
        id: match.id,
        name: rawP.name.trim(),
        personalId: rawP.personalId?.trim() || match.personalId || "",
        position: rawP.position?.trim() || match.position || "",
        department: rawP.department?.trim() || match.department || "",
        email: rawP.email?.trim() || match.email || "",
        phone: rawP.phone?.trim() || match.phone || ""
      };
      currentList[existingIndex] = updatedProf;
      updatedDocs.push(updatedProf);
      upsertedCount++;
    } else {
      // Insert: New record
      const newId = `prof-${Date.now()}-${idx}`;
      const newProf: Professor = {
        id: newId,
        name: rawP.name.trim(),
        personalId: rawP.personalId?.trim() || "",
        position: rawP.position?.trim() || "",
        department: rawP.department?.trim() || "",
        email: rawP.email?.trim() || "",
        phone: rawP.phone?.trim() || ""
      };
      currentList.push(newProf);
      updatedDocs.push(newProf);
      insertedCount++;
    }
  }

  localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(currentList));

  // 2. Sync to Firestore
  if (isFirebaseConfigured && db) {
    try {
      for (const p of updatedDocs) {
        const docRef = doc(db, "professors", p.id);
        await setDoc(docRef, {
          name: p.name,
          personalId: p.personalId,
          position: p.position,
          department: p.department,
          email: p.email,
          phone: p.phone,
          updatedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error("Error syncing imported CSV professors to Firestore:", err);
    }
  }

  // 3. Sync to Google Sheets (POST call)
  const gasUrl = await getGoogleAppsScriptUrl();
  if (gasUrl && gasUrl !== "") {
    try {
      console.log(`Sending CSV Batch IMPORT_PROFS to GAS:`, gasUrl, updatedDocs.length);
      const payload = {
        action: "IMPORT_PROFS",
        records: updatedDocs
      };

      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Error communicating CSV Import to Google Apps Script:", err);
    }
  }

  return { upsertedCount, insertedCount };
}

/**
 * Delete a professor from the system (syncing Google Sheets, Firestore, LocalStorage)
 */
export async function deleteProfessor(id: string): Promise<void> {
  // 1. Sync LocalStorage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  if (stored) {
    let currentList: Professor[] = JSON.parse(stored);
    currentList = currentList.filter((p) => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(currentList));
  }

  // 2. Sync Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "professors", id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting professor from Firestore:", err);
    }
  }

  // 3. Sync Google Sheets (Google Apps Script POST)
  const gasUrl = await getGoogleAppsScriptUrl();
  if (gasUrl && gasUrl !== "") {
    try {
      console.log(`Sending DELETE_PROF payload to GAS:`, gasUrl, id);
      const payload = {
        action: "DELETE_PROF",
        id: id
      };

      await fetch(gasUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain"
        },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error("Error communicating deleteProfessor to Google Apps Script:", err);
    }
  }
}
