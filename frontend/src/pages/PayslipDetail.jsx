import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, Save } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common";
import { money } from "@/lib/format";

const employeeFields = [
  ["designation", "Designation"],
  ["department", "Department"],
  ["joining_date", "Joining Date"],
  ["location", "Location"],
  ["business_unit", "Business Unit"],
  ["pan_number", "PAN Number"],
  ["bank_name", "Bank Name"],
  ["bank_account", "Bank Account"],
  ["ifsc", "IFSC"],
  ["pf_number", "PF Number"],
  ["esi_number", "ESI Number"],
];

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [active, setActive] = useState(null);
  const [employee, setEmployee] = useState({});
  const [payroll, setPayroll] = useState({});
  const [company, setCompany] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get(`/payslip/${id}`);
        setActive(data);
        setEmployee(data.employee || {});
        setPayroll(data.payroll || {});
        setCompany(data.company || {});
      } catch (e) {
        toast.error("Failed to load payslip");
      }
    };

    load();
  }, [id]);

  const updatePayroll = (field, value) => {
    setPayroll((prev) => ({
      ...prev,
      [field]: value === "" ? 0 : Number(value),
    }));
  };

  const updateEmployee = (field, value) => {
    setEmployee((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const netSalary = useMemo(() => {
    const salary = Number(payroll.salary || 0);
    const overtime = Number(payroll.overtime || 0);
    const incentive = Number(payroll.incentive || 0);
    const extraDuty = Number(payroll.extra_duty || 0);
    const lop = Number(payroll.lop || 0);
    const deduction = Number(payroll.deduction || 0);
    const pf = Number(payroll.pf || 0);
    const esi = Number(payroll.esi || 0);
    const mess = Number(payroll.mess || 0);
    const advance = Number(payroll.advance || 0);

    return Math.max(
      0,
      salary +
        overtime +
        incentive +
        extraDuty -
        lop -
        deduction -
        pf -
        esi -
        mess -
        advance
    );
  }, [payroll]);

  const savePayslip = async () => {
    setSaving(true);

    try {
      const { data } = await api.put(`/payroll/${id}/adjust`, {
        incentive: Number(payroll.incentive || 0),
        deduction: Number(payroll.deduction || 0),
        extra_duty: Number(payroll.extra_duty || 0),
        pf: Number(payroll.pf || 0),
        esi: Number(payroll.esi || 0),
        mess: Number(payroll.mess || 0),
        advance: Number(payroll.advance || 0),
        leave_balance: Number(payroll.leave_balance || 0),
        employee,
      });

      setPayroll((prev) => ({
        ...prev,
        ...data,
        net: data.net ?? netSalary,
      }));

      toast.success("Payslip saved successfully");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save payslip");
    }

    setSaving(false);
  };

  const downloadPdf = () => {
    const doc = new jsPDF();

    doc.setFillColor(16, 185, 129);
    doc.rect(0, 0, 210, 28, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.setFont(undefined, "bold");
    doc.text(company?.name || "Company", 14, 18);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(15);
    doc.text("PAYSLIP", 14, 42);

    doc.setFontSize(10);
    doc.setFont(undefined, "normal");
    doc.text(`Pay Period: ${payroll.month || ""}`, 14, 49);

    doc.setFont(undefined, "bold");
    doc.text(employee.name || "", 14, 64);

    doc.setFont(undefined, "normal");
    doc.text(`Employee Code: ${employee.employee_code || ""}`, 14, 71);
    doc.text(`Designation: ${employee.designation || ""}`, 14, 78);
    doc.text(`Department: ${employee.department || ""}`, 14, 85);

    doc.line(14, 92, 196, 92);

    doc.setFont(undefined, "bold");
    doc.text("Earnings", 14, 103);
    doc.text("Deductions", 110, 103);

    doc.setFont(undefined, "normal");

    const earnings = [
      ["Basic Salary", payroll.salary],
      ["Overtime", payroll.overtime],
      ["Incentive", payroll.incentive],
      ["Extra Duty", payroll.extra_duty],
    ];

    const deductions = [
      ["LOP", payroll.lop],
      ["Other Deduction", payroll.deduction],
      ["PF", payroll.pf],
      ["ESI", payroll.esi],
      ["Mess", payroll.mess],
      ["Advance", payroll.advance],
    ];

    earnings.forEach(([label, value], index) => {
      doc.text(label, 14, 113 + index * 7);
      doc.text(`Rs. ${Number(value || 0).toLocaleString("en-IN")}`, 92, 113 + index * 7, {
        align: "right",
      });
    });

    deductions.forEach(([label, value], index) => {
      doc.text(label, 110, 113 + index * 7);
      doc.text(`Rs. ${Number(value || 0).toLocaleString("en-IN")}`, 196, 113 + index * 7, {
        align: "right",
      });
    });

    doc.line(14, 151, 196, 151);

    doc.setFont(undefined, "bold");
    doc.setFontSize(14);
    doc.text(`Net Salary: Rs. ${netSalary.toLocaleString("en-IN")}`, 14, 164);

    doc.setFontSize(9);
    doc.setFont(undefined, "normal");
    doc.text("This is a system-generated payslip from Attendy.", 14, 184);

    doc.save(`payslip-${employee.employee_code || id}-${payroll.month || ""}.pdf`);
  };

  if (!active) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">Loading payslip...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/payroll")}
          className="rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Payslip
        </Button>

        <div className="flex gap-2">
          <Button
            onClick={savePayslip}
            disabled={saving}
            className="rounded-xl bg-emerald-600 hover:bg-emerald-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>

          <Button
            onClick={downloadPdf}
            className="rounded-xl bg-slate-900 hover:bg-slate-800"
          >
            <Download className="w-4 h-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      <div className="rounded-2xl overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="bg-emerald-600 text-white p-4 sm:p-7">
          <div className="flex items-start justify-between gap-3 sm:gap-5">
            <div>
              <p className="text-xl sm:text-2xl font-bold">{company?.name || "Company"}</p>
              <p className="text-sm text-emerald-100 mt-1">
                {company?.address || ""}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs uppercase tracking-widest text-emerald-100">
                Payslip
              </p>
              <p className="font-semibold mt-1">
                {payroll.month || ""}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div>
              <p className="text-xl font-bold text-slate-900">
                {employee.name}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {employee.employee_code}
              </p>
            </div>
            <StatusBadge status={payroll.status} />
          </div>

          <section>
            <h2 className="font-semibold text-slate-800 mb-4">
              Employee Details
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {employeeFields.map(([field, label]) => (
                <div key={field}>
                  <label className="text-xs font-medium text-slate-500 block mb-1.5">
                    {label}
                  </label>
                  <Input
                    value={employee[field] ?? ""}
                    onChange={(e) => updateEmployee(field, e.target.value)}
                    className="rounded-xl"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-semibold text-slate-800 mb-4">
              Salary Details
            </h2>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <MoneyInput label="Basic Salary" value={payroll.salary} disabled />
              <MoneyInput
                label="Overtime"
                value={payroll.overtime}
                disabled
              />
              <MoneyInput
                label="Incentive"
                value={payroll.incentive}
                onChange={(v) => updatePayroll("incentive", v)}
              />
              <MoneyInput
                label="Extra Duty"
                value={payroll.extra_duty}
                onChange={(v) => updatePayroll("extra_duty", v)}
              />
              <MoneyInput label="LOP" value={payroll.lop} disabled />
              <MoneyInput
                label="Other Deduction"
                value={payroll.deduction}
                onChange={(v) => updatePayroll("deduction", v)}
              />
              <MoneyInput
                label="PF"
                value={payroll.pf}
                onChange={(v) => updatePayroll("pf", v)}
              />
              <MoneyInput
                label="ESI"
                value={payroll.esi}
                onChange={(v) => updatePayroll("esi", v)}
              />
              <MoneyInput
                label="Mess"
                value={payroll.mess}
                onChange={(v) => updatePayroll("mess", v)}
              />
              <MoneyInput
                label="Advance"
                value={payroll.advance}
                onChange={(v) => updatePayroll("advance", v)}
              />
            </div>
          </section>

          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Net Salary</p>
              <p className="text-3xl font-bold text-emerald-600 mt-1">
                {money(netSalary)}
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-slate-400">Calculated live</p>
              <p className="text-sm font-medium text-slate-700 mt-1">
                Earnings − Deductions
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-6 flex items-end justify-between">
            <p className="text-xs text-slate-400 max-w-md">
              This is a system-generated payslip from Attendy and does not
              require a physical signature.
            </p>

            <div className="text-center">
              <div className="w-40 border-t border-slate-300 pt-1">
                <p className="text-xs text-slate-400">
                  Authorised Signatory
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MoneyInput({ label, value, onChange, disabled }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-500 block mb-1.5">
        {label}
      </label>
      <Input
        type="number"
        value={value ?? 0}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="rounded-xl"
      />
    </div>
  );
}
