import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Mail, Phone, Building2, Calendar, MapPin, Pencil } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { money, dateStr } from "@/lib/format";
import api from "@/lib/api";
import { toast } from "sonner";


export default function Profile() {
  const { user, employee, logout, loadUser } = useAuth();
  const navigate = useNavigate();
  const roleLabel = { admin: "Admin", team_leader: "Team Leader", staff: "Staff" }[user.role];
  const [showEdit, setShowEdit] = useState(false);

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">My Profile</h1>
        <Button onClick={() => setShowEdit(true)} variant="outline" className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
          <Pencil className="w-4 h-4" /> Edit Profile
        </Button>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 p-6">
        <div className="flex items-center gap-4">
          <Avatar src={employee?.photo} name={user.name} size={72} />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-heading text-xl font-bold text-slate-900">{user.name}</h2>
              <StatusBadge status={roleLabel} />
            </div>
            <p className="text-slate-500 text-sm">{employee?.designation} {employee?.department && `· ${employee.department}`}</p>
            {employee && <p className="text-xs text-slate-400 mt-0.5">{employee.employee_code}</p>}
          </div>
        </div>

        {employee && (
          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3 mt-6 text-sm">
            <Info icon={Mail} text={user.email} />
            <Info icon={Phone} text={employee.phone} />
            <Info icon={Building2} text={employee.department} />
            <Info icon={MapPin} text={employee.location} />
            <Info icon={Calendar} text={`Joined ${dateStr(employee.joining_date)}`} />
          </div>
        )}
      </div>

      {employee && (
        <div className="rounded-2xl bg-white border border-slate-200 p-6">
          <p className="text-sm text-slate-400">Monthly Salary</p>
          <p className="font-heading text-2xl font-bold text-slate-900 mt-1">{money(employee.monthly_salary)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{employee.salary_type}</p>
        </div>
      )}

      <Button onClick={() => { logout(); navigate("/login"); }} variant="outline" className="rounded-xl border-red-200 text-red-600 hover:bg-red-50" data-testid="profile-logout">
        <LogOut className="w-4 h-4 mr-2" /> Logout
      </Button>
      
      {showEdit && (
        <EditProfileModal
          user={user}
          onClose={() => setShowEdit(false)}
          onSuccess={() => {
            setShowEdit(false);
            loadUser(); // refresh user state globally
          }}
        />
      )}
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2 text-slate-600"><Icon className="w-4 h-4 text-slate-400" /> {text || "—"}</div>
);

function EditProfileModal({ user, onClose, onSuccess }) {
  const [data, setData] = useState({ name: user.name || "", email: user.email || "", password: "" });
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { name: data.name, email: data.email };
      if (data.password) payload.password = data.password;
      await api.put("/users/me", payload);
      toast.success("Profile updated successfully");
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Update failed");
    }
    setBusy(false);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">Edit Profile</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">&times;</button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Full Name</label>
            <input required type="text" value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">Email Address</label>
            <input required type="email" value={data.email} onChange={(e) => setData({ ...data, email: e.target.value })} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5 uppercase">New Password</label>
            <input type="password" value={data.password} onChange={(e) => setData({ ...data, password: e.target.value })} placeholder="Leave blank to keep current" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:border-emerald-500 transition-colors" />
          </div>
          <div className="pt-2 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Saving..." : "Save Changes"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

