import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

// ---- Edit these values to match your business before publishing ----
const APP_NAME = "MySpace";
const COMPANY_NAME = "Attendy Technologies Pvt Ltd";
const SUPPORT_EMAIL = "support@route39.in";
const LAST_UPDATED = "October 27, 2026";
// --------------------------------------------------------------------

const Section = ({ title, children }) => (
  <section className="space-y-2">
    <h2 className="font-heading text-xl font-semibold text-slate-900">{title}</h2>
    <div className="text-slate-600 text-[15px] leading-relaxed space-y-2">{children}</div>
  </section>
);

const List = ({ items }) => (
  <ul className="list-disc pl-5 space-y-1">
    {items.map((i) => <li key={i}>{i}</li>)}
  </ul>
);

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Clock className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <p className="font-heading font-bold text-lg text-slate-900 leading-none">{APP_NAME}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Attendance · Work · Payroll</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-7">
        <div>
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. About this policy">
          <p>
            This Privacy Policy explains how {COMPANY_NAME} ("we", "us") collects, uses and protects personal
            information when you use the {APP_NAME} workplace management app and website (the "Service"), which
            includes attendance, leave, tasks, payroll and team communication tools for our team members.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>Depending on how you use the Service, we process:</p>
          <List items={[
            "Account details: name, email address, mobile number and a password (stored only in encrypted/hashed form).",
            "Work profile: employee code, designation, department, work location, joining date, work mode and profile photo.",
            "Attendance data: check-in and check-out times, hours worked and status (for example late or on leave).",
            "Location data: your device's precise location at the moment you tap Check In (see section 3).",
            "Leave data: leave requests, balances and approval status.",
            "Payroll data: salary details and payslips prepared by us.",
            "Content you create: tasks, comments, chat messages, files and announcements.",
            "Notifications sent to you inside the Service.",
            "Basic technical data needed to keep you signed in, such as an authentication token stored on your device or browser.",
          ]} />
        </Section>

        <Section title="3. Location data">
          <p>
            Where office geofencing is enabled for your account, the Service asks for your device location only
            when you tap <strong>Check In</strong>. It is used to confirm that you are within your office area and to record
            which office you checked in at. We do not track your location in the background and we do not collect
            it while you are not checking in.
          </p>
          <p>
            The coordinates, accuracy and distance from the office recorded at check-in are saved with that
            day's attendance record. You can deny location permission in your device or browser settings, but you
            may then be unable to check in where location verification is required.
          </p>
          <p>
            When administrators set up office locations, the addresses they enter may be sent to an address lookup
            (geocoding) service to find map coordinates.
          </p>
        </Section>

        <Section title="4. How we use information">
          <List items={[
            "To provide the Service: sign-in, attendance, leave, tasks, payroll and messaging.",
            "To verify attendance against our office locations.",
            "To send in-app notifications such as leave decisions, task assignments and payslips.",
            "To secure the Service, prevent misuse and fix problems.",
            "To meet legal obligations.",
          ]} />
          <p>We do not sell your personal information and we do not use it for advertising.</p>
        </Section>

        <Section title="5. Who can see your information">
          <List items={[
            "Authorised personnel: administrators, team leaders and other authorised people at the company can see your profile, attendance, leave and (for authorised roles) payroll information, according to their role.",
            "Service providers who host our servers and databases and operate the address lookup service, only as needed to run the Service.",
            "Authorities or other parties where we are legally required to disclose information.",
          ]} />
        </Section>

        <Section title="6. Data retention and deletion">
          <p>
            We keep your information while your account is active. You can delete your account at any time from
            <strong> My Profile → Delete My Account</strong> inside the app, or on our{" "}
            <Link to="/delete-account" className="text-emerald-600 underline">account deletion page</Link>, which
            works even if you no longer have the app installed.
          </p>
          <p>
            When you delete your account we permanently delete your login, employee profile, attendance records
            (including recorded check-in locations), leave records and balances, payroll records and notifications.
            Content you posted in shared areas of the app (for example chat messages, task comments or
            announcements) may remain as part of the company's records. Authorised administrators
            may also remove staff accounts and their records at any time.
          </p>
        </Section>

        <Section title="7. Security">
          <p>
            We use industry-standard measures such as encrypted connections (HTTPS), hashed passwords and
            role-based access control. No method of transmission or storage is completely secure, so we cannot
            guarantee absolute security.
          </p>
        </Section>

        <Section title="8. Your choices and rights">
          <List items={[
            "View and update your profile details in the app (My Profile → Edit Profile).",
            "Allow or deny location permission in your device or browser settings.",
            "Delete your account and associated data (see section 6).",
            `Contact us at ${SUPPORT_EMAIL} to ask about, correct or delete your information.`,
          ]} />
        </Section>

        <Section title="9. Children">
          <p>The Service is intended for working adults and is not directed to children under 18.</p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            We may update this policy from time to time. The "Last updated" date above shows the latest version.
            Significant changes will be communicated in the Service.
          </p>
        </Section>

        <Section title="11. Contact us">
          <p>
            {COMPANY_NAME} — <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">{SUPPORT_EMAIL}</a>
          </p>
        </Section>

        <div className="pt-4 border-t border-slate-200 text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/terms-and-conditions" className="hover:text-slate-600">Terms &amp; Conditions</Link>
          <Link to="/delete-account" className="hover:text-slate-600">Delete account</Link>
          <Link to="/login" className="hover:text-slate-600">Sign in</Link>
        </div>
      </main>
    </div>
  );
}
