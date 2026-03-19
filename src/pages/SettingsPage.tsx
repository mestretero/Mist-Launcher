import { useState } from "react";
import { useAuthStore } from "../stores/authStore";
import { api } from "../lib/api";

export function SettingsPage() {
  const { user } = useAuthStore();
  const [studentEmail, setStudentEmail] = useState("");
  const [studentStatus, setStudentStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [studentError, setStudentError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleVerifyStudent = async () => {
    setStudentStatus("loading");
    setStudentError("");
    try {
      await api.auth.verifyStudent(studentEmail);
      setStudentStatus("success");
    } catch (err: any) {
      setStudentError(err.message || "Doğrulama başarısız");
      setStudentStatus("error");
    }
  };

  const copyReferralCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">Ayarlar</h1>

      {/* Profile */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">Profil</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Kullanıcı adı</span>
            <span>{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Email</span>
            <span>{user?.email}</span>
          </div>
        </div>
      </section>

      {/* Student Discount */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4 mb-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">🎓 Öğrenci İndirimi</h2>
        {user?.isStudent || studentStatus === "success" ? (
          <div className="flex items-center gap-2">
            <span className="text-green-400 text-sm">✓ Öğrenci indirimi aktif</span>
            <span className="text-xs bg-green-600 text-white px-2 py-0.5 rounded">-%10</span>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-3">
              .edu.tr uzantılı email adresinle doğrulama yaparak %10 öğrenci indirimi kazanabilirsin.
            </p>
            <div className="flex gap-2">
              <input
                type="email" placeholder="ogrenci@universite.edu.tr"
                value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-xs focus:outline-none focus:border-indigo-500"
              />
              <button onClick={handleVerifyStudent} disabled={studentStatus === "loading" || !studentEmail.endsWith(".edu.tr")}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-medium disabled:opacity-50">
                {studentStatus === "loading" ? "..." : "Doğrula"}
              </button>
            </div>
            {studentError && <p className="text-red-400 text-xs mt-2">{studentError}</p>}
          </div>
        )}
      </section>

      {/* Referral Code */}
      <section className="bg-gray-900 rounded-xl border border-gray-800 p-4">
        <h2 className="font-medium text-sm text-gray-400 mb-3">🔗 Referans Kodum</h2>
        <p className="text-xs text-gray-400 mb-3">
          Kodunu arkadaşlarınla paylaş. Onlar %5 indirim alsın, sen %1 cüzdan kredisi kazan.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-indigo-400 text-sm font-mono">
            {user?.referralCode || "—"}
          </code>
          <button onClick={copyReferralCode}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-white text-xs">
            {copied ? "✓ Kopyalandı" : "Kopyala"}
          </button>
        </div>
      </section>
    </div>
  );
}
