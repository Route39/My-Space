import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import Dashboard from "@/pages/Dashboard";
import Staff from "@/pages/Staff";
import EmployeeProfile from "@/pages/EmployeeProfile";
import Attendance from "@/pages/Attendance";
import Tasks from "@/pages/Tasks";
import MySpace from "@/pages/MySpace";
import Leave from "@/pages/Leave";
import Payroll from "@/pages/Payroll";
import Payslip from "@/pages/Payslip";
import Settings from "@/pages/Settings";
import Profile from "@/pages/Profile";

function Protected({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/staff" element={<Protected roles={["admin", "team_leader"]}><Staff /></Protected>} />
      <Route path="/staff/:id" element={<Protected roles={["admin", "team_leader"]}><EmployeeProfile /></Protected>} />
      <Route path="/attendance" element={<Protected><Attendance /></Protected>} />
      <Route path="/tasks" element={<Protected><Tasks /></Protected>} />
      <Route path="/myspace" element={<Protected><MySpace /></Protected>} />
      <Route path="/leave" element={<Protected><Leave /></Protected>} />
      <Route path="/payroll" element={<Protected roles={["admin", "team_leader"]}><Payroll /></Protected>} />
      <Route path="/payslip" element={<Protected><Payslip /></Protected>} />
      <Route path="/settings" element={<Protected roles={["admin"]}><Settings /></Protected>} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </div>
  );
}
