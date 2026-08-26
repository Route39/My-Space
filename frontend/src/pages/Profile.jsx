import { useNavigate } from "react-router-dom";
import { LogOut, Mail, Phone, Building2, Calendar, MapPin } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Avatar, StatusBadge } from "@/components/common";
import { Button } from "@/components/ui/button";
import { money, dateStr } from "@/lib/format";

export default function Profile() {
  const { user, employee, logout } = useAuth();
  const navigate = useNavigate();
  const roleLabel = { admin: "Admin", team_leader: "Team Leader", staff: "Staff" }[user.role];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">My Profile</h1>

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
    </div>
  );
}

const Info = ({ icon: Icon, text }) => (
  <div className="flex items-center gap-2 text-slate-600"><Icon className="w-4 h-4 text-slate-400" /> {text || "—"}</div>
);
