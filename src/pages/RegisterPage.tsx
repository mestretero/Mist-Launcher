import { useState } from "react";
import { useAuthStore } from "../stores/authStore";

export function RegisterPage({ onSwitch }: { onSwitch: () => void }) {
  const { register } = useAuthStore();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(email, username, password);
    } catch (err: any) {
      setError(err.message || "Kayıt başarısız");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950">
      <div className="w-full max-w-sm p-8 bg-gray-900 rounded-2xl border border-gray-800">
        <h1 className="text-2xl font-bold text-indigo-400 mb-1">Stealike</h1>
        <p className="text-gray-500 text-sm mb-6">Yeni hesap oluştur</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text" placeholder="Kullanıcı adı" value={username}
            onChange={(e) => setUsername(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="email" placeholder="Email" value={email}
            onChange={(e) => setEmail(e.target.value)} required
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password" placeholder="Şifre (min 8 karakter)" value={password}
            onChange={(e) => setPassword(e.target.value)} required minLength={8}
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white font-medium text-sm disabled:opacity-50"
          >
            {loading ? "Kayıt olunuyor..." : "Kayıt Ol"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">
          Zaten hesabın var mı?{" "}
          <button onClick={onSwitch} className="text-indigo-400 hover:underline">Giriş yap</button>
        </p>
      </div>
    </div>
  );
}
