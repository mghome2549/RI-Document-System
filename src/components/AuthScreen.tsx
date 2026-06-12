import { useState, useTransition } from "react";
import { ShieldCheck, LogIn, AlertCircle } from "lucide-react";
import { loginWithGoogle, isFirebaseConfigured } from "../services/db";

interface AuthScreenProps {
  onSignIn: (email: string, displayName: string) => void;
  showTimeoutAlert?: boolean;
}

export default function AuthScreen({ onSignIn, showTimeoutAlert }: AuthScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleRealGoogleLogin = async () => {
    setError(null);
    try {
      const user = await loginWithGoogle();
      const email = user.email || "";
      const displayName = user.displayName || user.email?.split("@")[0] || "ผู้ใช้สถาบัน";

      // Global Access Guard: Only allow @bu.ac.th emails
      if (!email.toLowerCase().endsWith("@bu.ac.th")) {
        setError("ตามมาตรการความปลอดภัย ระบบนี้อนุญาตเฉพาะบัญชีอีเมล @bu.ac.th ของมหาวิทยาลัยกรุงเทพเท่านั้น");
        return;
      }

      onSignIn(email, displayName);
    } catch (err: any) {
      console.warn("Real Google login not initialized or blocked.", err);
      
      if (isFirebaseConfigured) {
        // Strict production mode: No automatic admin bypass on error! Showcase detailed troubleshooting instead.
        let msg = "เกิดข้อผิดพลาดในการลงชื่อใช้งานด้วยบัญชี Google ของสถาบัน ";
        if (err?.code === "auth/popup-blocked") {
          msg += "(เนื่องจากเบราว์เซอร์ของคุณบล็อกหน้าต่างป๊อปอัป กรุณาเปิดการอนุญาตป๊อปอัปสำหรับโดเมนนี้เพื่อแสดงหน้าต่างเลือกบัญชี)";
        } else if (err?.code === "auth/unauthorized-domain") {
          msg += "(เนื่องจากโดเมนเซิร์ฟเวอร์คลาวด์นี้ยังไม่ได้เปิดสิทธิ์ในการจดจำบัญชีใน Authorized Domains ของ Firebase Console แอดมินหลักจำเป็นต้องเข้าสู่ระบบคอนโซลเพื่อทำการเพิ่มโดเมนนี้เข้าสู่รายชื่อโดเมนที่ปลอดภัย)";
        } else {
          msg += `(${err?.message || "โปรดตรวจสอบการเชื่อมต่ออินเทอร์เน็ต หรือลองเข้าใหม่อีกครั้ง"})`;
        }
        setError(msg);
      } else {
        // Fallback ONLY for unconfigured/mock development environments
        console.warn("Activating evaluation secure session fallback for mock preview space...");
        onSignIn("kittiwat.p@bu.ac.th", "Kittiwat P.");
      }
    }
  };

  return (
    <div 
      id="landing-front-gate" 
      className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-tr from-[#0a192f] via-[#0d213f] to-[#112240] p-6 font-sans relative overflow-hidden"
    >
      {/* Decorative Blur Background Accents */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-900/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-900/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>

      <div className="w-full max-w-md bg-white/[0.03] backdrop-blur-md rounded-2xl p-8 border border-white/[0.08] shadow-2xl flex flex-col items-center text-center space-y-8">
        
        {/* Brand visual header */}
        <div className="space-y-3">
          <div className="inline-flex p-3.5 bg-white/5 rounded-2xl text-[#FFCC00] border border-white/10 shadow-lg">
            <ShieldCheck size={36} className="animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold tracking-[0.2em] text-[#FFCC00] uppercase block mb-1">
              ระบบติดตามเอกสาร วพ.
            </span>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">
              สายวิจัยและพัฒนานวัตกรรมการศึกษา
            </h1>

          </div>
        </div>

        {/* Action Gate button */}
        <div className="w-full space-y-4">
          {showTimeoutAlert && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-200 text-xs text-left flex gap-3 items-start animate-fadeIn animate-pulse">
              <AlertCircle size={16} className="shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5 text-white">ออกจากระบบอัตโนมัติ</span>
                ไม่มีการใช้งานหน้าจอนานเกิน 1 นาที เพื่อความปลอดภัยของข้อมูลและสิทธิ์แอดมิน ระบบจึงนำท่านกลับสู่หน้าลงชื่อเข้าใช้งาน
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-200 text-xs text-left flex gap-3 items-start animate-fadeIn">
              <AlertCircle size={16} className="shrink-0 text-rose-400 mt-0.5" />
              <div>
                <span className="font-bold block mb-0.5 text-white">การเข้าถึงถูกจำกัด</span>
                {error}
              </div>
            </div>
          )}

          <button
            onClick={() => startTransition(handleRealGoogleLogin)}
            disabled={isPending}
            className="w-full h-12 flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#FFCC00] to-[#e6b800] hover:from-[#f5c300] hover:to-[#dbb000] text-[#003366] font-extrabold text-xs tracking-wider uppercase rounded-xl shadow-lg hover:shadow-[#FFCC00]/10 transition-all active:scale-[0.98] disabled:opacity-75 cursor-pointer border border-[#FFCC00]/20"
          >
            <LogIn size={16} strokeWidth={2.5} />
            <span>{isPending ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย BU Google (@bu.ac.th)"}</span>
          </button>
        </div>

        {/* Footer citation with elite typography */}
        <div className="pt-4 border-t border-white/[0.05] w-full flex flex-col items-center gap-1 text-[10px] text-slate-500 font-medium tracking-wide">
          <span>สายวิจัยและพัฒนานวัตกรรมการศึกษา (วพ.)</span>
          <span className="font-mono text-[9px] opacity-75">RI DOCUMENT SYSTEM v1.0 • มหาวิทยาลัยกรุงเทพ</span>
        </div>
      </div>
    </div>
  );
}
