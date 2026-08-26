import { useEffect, useState } from "react";
import { Download, FileText, Clock } from "lucide-react";
import jsPDF from "jspdf";
import api from "@/lib/api";
import { StatusBadge } from "@/components/common";
import { EmptyState } from "@/components/ui-bits";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/format";

export default function Payslip() {
  const [slips, setSlips] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    api.get("/payroll/me").then((r) => { setSlips(r.data); if (r.data.length) openSlip(r.data[0].id); });
  }, []);

  const openSlip = async (id) => { const { data } = await api.get(`/payslip/${id}`); setActive(data); };

  const downloadPdf = () => {
    if (!active) return;
    const { payroll: p, employee: e, company: c } = active;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont(undefined, "bold"); doc.text(c?.name || "Company", 14, 20);
    doc.setFontSize(10); doc.setFont(undefined, "normal"); doc.text(c?.address || "", 14, 27);
    doc.setFontSize(14); doc.setFont(undefined, "bold"); doc.text(`Payslip - ${p.month}`, 14, 42);
    doc.setFontSize(10); doc.setFont(undefined, "normal");
    doc.text(`Employee: ${e?.name} (${e?.employee_code})`, 14, 52);
    doc.text(`Designation: ${e?.designation} | Department: ${e?.department}`, 14, 58);
    doc.line(14, 64, 196, 64);
    doc.setFont(undefined, "bold"); doc.text("Earnings", 14, 74); doc.text("Deductions", 110, 74);
    doc.setFont(undefined, "normal");
    const y = 82;
    const earn = [["Basic Salary", p.salary], ["Overtime", p.overtime], ["Incentive", p.incentive]];
    const ded = [["LOP", p.lop], ["Deduction", p.deduction]];
    earn.forEach(([l, v], i) => { doc.text(`${l}`, 14, y + i * 7); doc.text(`Rs. ${v.toLocaleString("en-IN")}`, 90, y + i * 7, { align: "right" }); });
    ded.forEach(([l, v], i) => { doc.text(`${l}`, 110, y + i * 7); doc.text(`Rs. ${v.toLocaleString("en-IN")}`, 186, y + i * 7, { align: "right" }); });
    doc.line(14, 112, 196, 112);
    doc.setFont(undefined, "bold"); doc.setFontSize(13); doc.text(`Net Salary: Rs. ${p.net.toLocaleString("en-IN")}`, 14, 124);
    doc.setFontSize(9); doc.setFont(undefined, "normal");
    doc.text("Authorised Signatory", 150, 150); doc.line(140, 145, 196, 145);
    doc.text("This is a system-generated payslip from Attendy.", 14, 170);
    doc.save(`payslip-${e?.employee_code}-${p.month}.pdf`);
  };

  if (slips.length === 0)
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white border border-slate-200"><EmptyState icon={FileText} title="No payslips available yet" subtitle="Your payslip appears here once payroll is approved." /></div>
      </div>
    );

  return (
    <div className="grid lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Payslips</p>
        {slips.map((s) => (
          <button key={s.id} onClick={() => openSlip(s.id)} data-testid={`slip-${s.month}`}
            className={`w-full text-left rounded-xl border p-3 transition-colors ${active?.payroll?.id === s.id ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white hover:border-slate-300"}`}>
            <div className="flex items-center justify-between"><p className="font-medium text-slate-800">{new Date(s.month + "-01").toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</p><StatusBadge status={s.status} /></div>
            <p className="text-xs text-slate-400 mt-1">Net {money(s.net)}</p>
          </button>
        ))}
      </div>

      {active && (
        <div className="lg:col-span-3">
          <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden shadow-[0_10px_40px_-15px_rgba(15,23,42,0.12)]" data-testid="payslip-detail">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-500 flex items-center justify-center"><Clock className="w-6 h-6 text-white" /></div>
                <div><p className="font-heading font-bold text-lg">{active.company?.name}</p><p className="text-xs text-slate-300 max-w-xs">{active.company?.address}</p></div>
              </div>
              <div className="text-right"><p className="text-xs text-slate-400">Payslip</p><p className="font-heading font-semibold">{new Date(active.payroll.month + "-01").toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p></div>
            </div>

            <div className="p-6">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100">
                <div><p className="font-heading font-semibold text-slate-900">{active.employee?.name}</p><p className="text-xs text-slate-400">{active.employee?.designation} · {active.employee?.employee_code}</p></div>
                <StatusBadge status={active.payroll.status} />
              </div>

              <div className="grid sm:grid-cols-2 gap-8 mt-5">
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Earnings</p>
                  <Row l="Basic Salary" v={active.payroll.salary} />
                  <Row l="Overtime" v={active.payroll.overtime} plus />
                  <Row l="Incentive" v={active.payroll.incentive} plus />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">Deductions</p>
                  <Row l="LOP" v={active.payroll.lop} minus />
                  <Row l="Other Deduction" v={active.payroll.deduction} minus />
                </div>
              </div>

              <div className="mt-6 p-4 rounded-2xl bg-emerald-50 flex items-center justify-between">
                <p className="font-heading font-bold text-slate-800">Net Salary</p>
                <p className="font-heading text-2xl font-bold text-emerald-600">{money(active.payroll.net)}</p>
              </div>

              <div className="flex items-end justify-between mt-8">
                <p className="text-xs text-slate-400 max-w-[50%]">This is a system-generated payslip from Attendy and does not require a physical signature.</p>
                <div className="text-center"><div className="w-40 border-t border-slate-300 pt-1"><p className="text-xs text-slate-400">Authorised Signatory</p></div></div>
              </div>

              <Button onClick={downloadPdf} data-testid="download-payslip" className="mt-6 rounded-xl bg-slate-900 hover:bg-slate-800"><Download className="w-4 h-4 mr-2" /> Download Payslip PDF</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ l, v, plus, minus }) => (
  <div className="flex items-center justify-between py-1.5 text-sm">
    <span className="text-slate-500">{l}</span>
    <span className={`font-medium ${plus && v ? "text-emerald-600" : minus && v ? "text-red-500" : "text-slate-800"}`}>{plus && v ? "+" : minus && v ? "-" : ""}{money(v)}</span>
  </div>
);
