import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./db";

export interface Professor {
  id: string; // Col id
  name: string; // ชื่อ-นามสกุล
  personalId?: string; // รหัสบุคลากร (mapped to employee_id in Supabase)
  position?: string; // ตำแหน่ง
  department: string; // หน่วยงาน
  email: string; // อีเมล์
  phone?: string; // โทรศัพท์
}

const LOCAL_STORAGE_KEY_PROFS = "bu_professors_list";

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

/**
 * Fetch all professors from Supabase (or Firestore/LocalStorage fallback)
 */
export async function fetchProfessors(): Promise<Professor[]> {
  // 1. Try Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      console.log("Fetching professors from Supabase...");
      const { data, error } = await supabase
        .from("professors")
        .select("*")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      if (data && Array.isArray(data)) {
        const mappedList: Professor[] = data.map((raw: any) => ({
          id: raw.id,
          name: raw.name || "",
          personalId: raw.employee_id || raw.personalId || "",
          position: raw.position || "",
          department: raw.department || "",
          email: raw.email || "",
          phone: raw.phone || ""
        }));

        localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(mappedList));
        return mappedList;
      }
    } catch (err) {
      console.warn("Supabase fetch failed, trying Firestore or LocalStorage. Error:", err);
    }
  }

  // 2. Try Firestore fallback
  if (isFirebaseConfigured && db) {
    try {
      console.log("Fetching professors from Firestore...");
      const profsCol = collection(db, "professors");
      const querySnap = await getDocs(profsCol);
      if (!querySnap.empty) {
        const profList: Professor[] = [];
        querySnap.forEach((docSnap) => {
          const data = docSnap.data();
          profList.push({
            id: docSnap.id,
            name: data.name || "",
            personalId: data.personalId || data.employee_id || "",
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
      console.error("Firestore fetch professors failed:", err);
    }
  }

  // 3. Try LocalStorage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (err) {
      console.error("Error parsing stored professors", err);
    }
  }

  // 4. Fallback default
  localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(DEFAULT_PROFESSORS));
  return DEFAULT_PROFESSORS;
}

/**
 * Add or update a professor (sync with Supabase and legacy fallbacks - NO Apps Script / NO email dispatch)
 * [SAFE DATABASE MODE]: ห้ามติดตั้งระบบส่งเมลพ่วงหรือเชื่อม Apps Script ในฟังก์ชันนี้เด็ดขาด ป้องกันการสแปมสิทธิ์อาจารย์แบบไร้รอยต่อ
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

  // 1. Sync LocalStorage immediately
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  let currentList: Professor[] = stored ? JSON.parse(stored) : [...DEFAULT_PROFESSORS];
  if (isEditing) {
    currentList = currentList.map((p) => (p.id === targetId ? cleanProf : p));
  } else {
    currentList.push(cleanProf);
  }
  localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(currentList));

  // 2. Sync to Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      console.log(`Saving professor to Supabase database directly:`, cleanProf);
      const dbPayload = {
        id: cleanProf.id,
        name: cleanProf.name,
        employee_id: cleanProf.personalId || null,
        position: cleanProf.position || null,
        department: cleanProf.department,
        email: cleanProf.email,
        phone: cleanProf.phone || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from("professors")
        .upsert(dbPayload);

      if (error) {
        throw error;
      }
      console.log("Successfully saved professor to Supabase!");
    } catch (err) {
      console.error("Failed to save professor to Supabase:", err);
    }
  }

  // 3. Sync legacy Firestore
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
      console.error("Firestore sync professor failed:", err);
    }
  }

  return cleanProf;
}

/**
 * Bulk import multiple professors from CSV (direct database uploads with absolutely NO email alerts/Apps Script)
 * [SAFE DATABASE MODE]: ห้ามติดตั้งสคริปต์ส่งการแจ้งเตือนสิทธิ์หรืออีเมลยืนยันผลเด็ดขาดเมื่อนำเข้าไฟล์ CSV ในปริมาณมาก
 */
export async function importProfessorsCsv(professorsList: Omit<Professor, "id">[]): Promise<{ upsertedCount: number; insertedCount: number }> {
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

  // 1. Supabase bulk upsert
  if (isSupabaseConfigured && supabase) {
    try {
      console.log(`Performing bulk import of ${updatedDocs.length} professors to Supabase...`);
      const payload = updatedDocs.map((p) => ({
        id: p.id,
        name: p.name,
        employee_id: p.personalId || null,
        position: p.position || null,
        department: p.department,
        email: p.email,
        phone: p.phone || null,
        updated_at: new Date().toISOString()
      }));

      const { error } = await supabase
        .from("professors")
        .upsert(payload);

      if (error) {
        throw error;
      }
      console.log("Successfully imported batch to Supabase!");
    } catch (err) {
      console.error("Supabase bulk import professors failed:", err);
    }
  }

  // 2. Legacy Firestore sync
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
      console.error("Firestore sync import failed:", err);
    }
  }

  return { upsertedCount, insertedCount };
}

/**
 * Delete a professor (direct database delete, absolutely silent with NO email trigger / NO Google Apps Script)
 * [SAFE DATABASE MODE]: ห้ามเชื่อมการเรียก API หรือ Email เพื่อแจ้งเตือนสิทธิ์การลบอาจารย์เด็ดขาด ดำเนินการแบบเงียบๆ เท่านั้น
 */
export async function deleteProfessor(id: string): Promise<void> {
  // 1. Sync LocalStorage
  const stored = localStorage.getItem(LOCAL_STORAGE_KEY_PROFS);
  if (stored) {
    let currentList: Professor[] = JSON.parse(stored);
    currentList = currentList.filter((p) => p.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY_PROFS, JSON.stringify(currentList));
  }

  // 2. Delete from Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      console.log(`Deleting professor ${id} from Supabase...`);
      const { error } = await supabase
        .from("professors")
        .delete()
        .eq("id", id);

      if (error) {
        throw error;
      }
      console.log("Successfully deleted professor from Supabase");
    } catch (err) {
      console.error("Supabase deleteProfessor failed:", err);
    }
  }

  // 3. Delete from Firestore
  if (isFirebaseConfigured && db) {
    try {
      const docRef = doc(db, "professors", id);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Firestore delete professor failed:", err);
    }
  }
}
