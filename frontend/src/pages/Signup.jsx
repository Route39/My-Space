import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Clock, Check, X, Building2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import api, { apiErr } from "@/lib/api";
import { slugify } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Signup() {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ company_name: "", slug: "", admin_name: "", admin_email: "", password: "" });
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const setCompany = (v) => {
    setForm((f) => ({ ...f, company_name: v, slug: slugTouched ? f.slug : slugify(v) }));
  };

  useEffect(() => {
    const s = form.slug.trim();
    if (!s) { setSlugState(null); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/onboarding/slug-available/${s}`);
        setSlugState(data);
      } catch (e) { setSlugState(null); }
    }, 350);
    return () => clearTimeout(t);
  }, [form.slug]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post("/onboarding/signup", form);
      await setSession(data.token);
      navigate("/");
    } catch (err) {
      setError(apiErr(err.response?.data?.detail) || "Could not create workspace");
    }
    setBusy(false);
  };

  const canSubmit = form.company_name && form.slug && form.admin_name && form.admin_email && form.password.length >= 6 && slugState?.available;

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col lg:flex-row">
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden p-14 flex-col justify-between">
        <div className="flex items-center gap-2 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center"><Clock className="w-6 h-6 text-white" /></div>
          <span className="font-heading font-bold text-2xl text-white">Attendy</span>
        </div>
        <div className="relative z-10">
          <h1 className="font-heading text-4xl font-bold text-white leading-tight tracking-tight">Start your company workspace in minutes.</h1>
          <p className="text-slate-300 mt-6 text-lg max-w-md">Attendance, tasks, leave and payroll — one simple app for your whole team.</p>
          <div className="mt-8 space-y-2 text-slate-200 text-sm">
            {["Your own isolated workspace", "Invite your whole team", "Free to set up"].map((t) => (
              <div key={t} className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> {t}</div>
            ))}
          </div>
        </div>
        <div className="text-slate-400 text-sm relative z-10">© 2026 Attendy</div>
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-500/20 blur-2xl" />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-heading text-2xl font-bold text-slate-900">Create your workspace</h2>
          <p className="text-slate-500 text-sm mt-1 mb-6">Set up your company on Attendy.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-slate-700">Company name</Label>
              <Input data-testid="signup-company" value={form.company_name} onChange={(e) => setCompany(e.target.value)} placeholder="ABC Technologies" className="mt-1.5 rounded-xl h-11" required />
            </div>
            <div>
              <Label className="text-slate-700">Workspace address</Label>
              <div className="flex items-center gap-1 mt-1.5">
                <Input data-testid="signup-slug" value={form.slug} onChange={(e) => { setSlugTouched(true); setForm({ ...form, slug: e.target.value.toLowerCase() }); }} placeholder="abc" className="rounded-xl h-11" required />
                <span className="text-sm text-slate-400 shrink-0">.attendy.in</span>
              </div>
              {slugState && (
                <p data-testid="slug-status" className={`text-xs mt-1 flex items-center gap-1 ${slugState.available ? "text-emerald-600" : "text-red-500"}`}>
                  {slugState.available ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}{slugState.reason}
                </p>
              )}
            </div>
            <div>
              <Label className="text-slate-700">Your name</Label>
              <Input data-testid="signup-name" value={form.admin_name} onChange={(e) => setForm({ ...form, admin_name: e.target.value })} placeholder="Jane Doe" className="mt-1.5 rounded-xl h-11" required />
            </div>
            <div>
              <Label className="text-slate-700">Work email</Label>
              <Input data-testid="signup-email" type="email" value={form.admin_email} onChange={(e) => setForm({ ...form, admin_email: e.target.value })} placeholder="jane@abc.com" className="mt-1.5 rounded-xl h-11" required />
            </div>
            <div>
              <Label className="text-slate-700">Password</Label>
              <Input data-testid="signup-password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" className="mt-1.5 rounded-xl h-11" required />
            </div>
            {error && <p data-testid="signup-error" className="text-sm text-red-600">{error}</p>}
            <Button type="submit" data-testid="signup-submit" disabled={busy || !canSubmit} className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-medium">{busy ? "Creating…" : "Create workspace"}</Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">Already have a workspace? <Link to="/login" className="font-medium text-emerald-600">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
