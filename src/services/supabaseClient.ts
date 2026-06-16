import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

export const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== "YOUR_SUPABASE_URL" && 
  supabaseAnonKey !== "YOUR_SUPABASE_ANON_KEY";

// Initialize Supabase Client safely
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

if (!isSupabaseConfigured) {
  console.warn("Supabase is not configured yet! Head to your .env file or netlify settings to add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Falling back to local/in-memory cache.");
}

export interface DocumentLog {
  id?: string;
  vph_ref_no: string;
  doc_number: string;
  sender_name: string;
  department: string;
  subject: string;
  status: string;
  outgoing_date: string;
  receiver_name: string;
  outgoing_dept: string;
  recipient_email: string;
  rating?: number;
  email_body?: string;
}

/**
 * Save a document log and sending transaction recording:
 */
export async function saveDocumentLog(log: DocumentLog): Promise<void> {
  const targetId = log.id || `log-${Date.now()}`;
  
  // 1. Local storage logs ledger
  const LOCAL_LOGS_KEY = "bu_document_logs";
  const storedLogs = localStorage.getItem(LOCAL_LOGS_KEY);
  const logsList = storedLogs ? JSON.parse(storedLogs) : [];
  const fullLog = { ...log, id: targetId, created_at: new Date().toISOString() };
  logsList.push(fullLog);
  localStorage.setItem(LOCAL_LOGS_KEY, JSON.stringify(logsList));

  // 2. Supabase logs upload
  if (isSupabaseConfigured && supabase) {
    try {
      console.log("Saving document log to Supabase Table 'document_logs'...");
      const { error } = await supabase
        .from("document_logs")
        .insert({
          id: targetId,
          vph_ref_no: log.vph_ref_no,
          doc_number: log.doc_number,
          sender_name: log.sender_name,
          department: log.department,
          subject: log.subject,
          status: log.status,
          outgoing_date: log.outgoing_date,
          receiver_name: log.receiver_name,
          outgoing_dept: log.outgoing_dept,
          recipient_email: log.recipient_email,
          rating: log.rating || 5,
          email_body: log.email_body || ""
        });

      if (error) throw error;
      console.log("Successfully logged document and email in Supabase!");
    } catch (err) {
      console.error("Failed to save log to Supabase database document_logs table:", err);
    }
  }
}

