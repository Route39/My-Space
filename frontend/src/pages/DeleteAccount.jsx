import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Trash2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { getTenantSlug } from "@/lib/tenant";
import { apiErr } from "@/lib/api";

// ---- Edit these values to match your business before publishing ----
const APP_NAME = "MySpace";
const COMPANY_NAME = "Attendy Technologies Pvt Ltd";
const SUPPORT_EMAIL = "support@route39.in";
// --------------------------------------------------------------------

// Plain axios instance on purpose: it must not reuse (or react to a 401 by clearing) whatever session
// may already be stored in this browser. Credentials typed on this page decide which account is deleted.
const publicApi = axios.create({ baseURL: `${process.env.REACT_APP_BACKEND_URL}/api`, timeout: 20000 });

export default function DeleteAccount() {
  const { user, logout } = useAuth();
  const [username, setUsername] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!confirm) { setError("Please tick the confirmation box."); return; }
    setBusy(true);
    try {
      const slug = getTenantSlug();
      const { data: login } = await publicApi.post("/auth/login", {
        username: username.trim(), password, tenant_slug: slug || undefined,
      });
      const { data } = await publicApi.post(
        "/users/me/delete", { password },
        { headers: { Authorization: `Bearer ${login.token}` } }
      );
      // If the deleted account is the one currently signed in on this device, sign it out.
      if (user && data?.id === user.id) logout();
      setDone(true);
    } catch (err) {
      setError(err.response ? apiErr(err.response.data?.detail) : "Network error. Please check your connection and try again.");
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Clock className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="font-heading font-bold text-lg text-slate-900 leading-none">{APP_NAME}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Attendance · Work · Payroll</p>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Delete your account</h1>
          <p className="text-slate-500 text-sm mt-1">{APP_NAME} by {COMPANY_NAME}</p>
        </div>

        {done ? (
          <div className="rounded-2xl bg-white border border-emerald-200 p-6 space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 font-semibold">
              <CheckCircle2 className="w-5 h-5" /> Your account has been deleted
            </div>
            <p className="text-sm text-slate-600">Your account and the associated data described below have been permanently removed.</p>
            <Link to="/login" className="inline-block text-sm text-emerald-600 underline">Go to sign in</Link>
          </div>
        ) : (
          <>
            <div className="rounded-2xl bg-white border border-slate-200 p-5 space-y-3 text-sm text-slate-600">
              <p className="font-semibold text-slate-900">How to delete your account</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Enter the mobile number or email and password you use to sign in.</li>
                <li>Tick the confirmation box and tap <strong>Delete my account</strong>.</li>
              </ol>
              <p>You can also delete it inside the app: <strong>My Profile → Delete My Account</strong>.</p>
              <p className="font-semibold text-slate-900 pt-1">What is deleted</p>
              <p>
                Your login, employee profile, attendance records (including check-in locations), leave records and
                balances, payroll records and notifications are permanently deleted. Messages, task comments or
                announcements you posted in shared areas of the app may remain as part of the company's records.
              </p>
              <p>
                Admins: if you are the only admin, appoint another admin first (or contact us) so the app is not left
                without one.
              </p>
            </div>

            <form onSubmit={onSubmit} className="rounded-2xl bg-white border border-red-200 p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Mobile number or email</label>
                <input required type="text" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400 transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Password</label>
                <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-red-400 transition-colors" />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-600 cursor-pointer">
                <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-1" />
                <span>I understand this is permanent and cannot be undone.</span>
              </label>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{error}</span>
                </div>
              )}

              <button type="submit" disabled={busy}
                className="w-full py-3 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-colors">
                <Trash2 className="w-4 h-4" /> {busy ? "Deleting…" : "Delete my account"}
              </button>
            </form>

            <p className="text-xs text-slate-400">
              Forgot your password or need help? Email{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">{SUPPORT_EMAIL}</a>.
            </p>
          </>
        )}

        <div className="pt-4 border-t border-slate-200 text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/privacy-policy" className="hover:text-slate-600">Privacy Policy</Link>
          <Link to="/terms-and-conditions" className="hover:text-slate-600">Terms &amp; Conditions</Link>
          <Link to="/login" className="hover:text-slate-600">Sign in</Link>
        </div>
      </main>
    </div>
  );
}
