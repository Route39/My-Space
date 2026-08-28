import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { apiErr } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Login() {
  const { login, tenant } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const accent = tenant?.brand_color || "#059669";
  const brandName = tenant?.name || "Attendy";

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(username, password);
      navigate("/");
    } catch (err) {
      setError(apiErr(err.response?.data?.detail) || "Login failed");
    }
    setBusy(false);
  };

  const quick = (em) => { setEmail(em); setPassword(em === "support@route39.in" ? "admin123" : "password123"); };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden p-14 flex-col justify-between" style={{ backgroundColor: accent }}>
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center overflow-hidden">
            {tenant?.logo ? <img src={tenant.logo} alt={brandName} className="w-full h-full object-cover" /> : <Clock className="w-6 h-6 text-white" />}
          </div>
          <span className="font-heading font-bold text-2xl text-white">{brandName}</span>
        </div>
        <div className="relative z-10">
          <h1 className="font-heading text-5xl font-bold text-white leading-tight tracking-tight">Attendance.<br />Work.<br />Payroll.</h1>
          <p className="text-white/90 mt-6 text-lg max-w-md">{tenant ? `Sign in to your ${brandName} workspace.` : "The simplest way to manage your team. Open it in 5 seconds and know exactly what to do."}</p>
        </div>
        <div className="text-white/70 text-sm relative z-10">© 2026 Attendy</div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-white/10" />
        <div className="absolute top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ backgroundColor: accent }}>
              {tenant?.logo ? <img src={tenant.logo} alt={brandName} className="w-full h-full object-cover" /> : <Clock className="w-6 h-6 text-white" />}
            </div>
            <span className="font-heading font-bold text-2xl text-slate-900">{brandName}</span>
          </div>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">{tenant ? `Sign in to ${brandName}.` : "Sign in to continue to your workspace."}</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="username" className="text-slate-700">Username / Phone</Label>
              <Input id="username" data-testid="login-email" type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Enter your username or phone" className="mt-1.5 rounded-xl h-11" required />
            </div>
            <div>
              <Label htmlFor="password" className="text-slate-700">Password</Label>
              <div className="relative mt-1.5">
                <Input id="password" data-testid="login-password" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="rounded-xl h-11 pr-10" required />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
              </div>
            </div>
            {error && <p data-testid="login-error" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" data-testid="login-submit" disabled={busy} style={{ backgroundColor: accent }} className="w-full h-11 rounded-xl hover:opacity-90 font-medium text-white">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>

        </div>
      </div>
    </div>
  );
}
