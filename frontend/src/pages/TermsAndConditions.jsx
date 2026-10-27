import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

// ---- Edit these values to match your business before publishing ----
const APP_NAME = "MySpace";
const COMPANY_NAME = "Attendy Technologies Pvt Ltd";
const SUPPORT_EMAIL = "support@route39.in";
const GOVERNING_LAW = "India";
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

export default function TermsAndConditions() {
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
          <h1 className="font-heading text-3xl font-bold text-slate-900 tracking-tight">Terms &amp; Conditions</h1>
          <p className="text-sm text-slate-400 mt-1">Last updated: {LAST_UPDATED}</p>
        </div>

        <Section title="1. Acceptance of these terms">
          <p>
            These Terms &amp; Conditions ("Terms") govern your use of the {APP_NAME} workplace management app and
            website (the "Service") provided by {COMPANY_NAME} ("we", "us"). By signing in or using the Service you
            agree to these Terms. If you do not agree, please do not use the Service.
          </p>
        </Section>

        <Section title="2. Your account">
          <List items={[
            "Accounts are created for you by us or our authorised administrators. You must be at least 18 years old.",
            "Keep your password confidential and do not share your account. You are responsible for activity under your account.",
            "Give accurate information and keep your profile up to date.",
            "Tell us promptly if you believe your account has been accessed without permission.",
          ]} />
        </Section>

        <Section title="3. Administrators and company policies">
          <p>
            The Service is used by {COMPANY_NAME} to manage attendance, leave, tasks and payroll for its team.
            Authorised administrators decide how the Service is used, such as office locations, shifts, leave rules and
            payroll information, and can view and manage staff records according to their role. Employment
            decisions, salary and attendance policies are set by the company and are applied through the Service.
          </p>
        </Section>

        <Section title="4. Attendance and location">
          <List items={[
            "Check-in may require your device location to confirm you are at an approved office. Location is requested only when you check in.",
            "You must check in and out honestly. Do not use fake-location apps, spoofing tools or any other method to give a false location or time, and do not check in on behalf of someone else.",
            "Location accuracy depends on your device, GPS signal and network. We do not guarantee that a check-in will always succeed.",
            "Attendance records may be used by us for attendance, leave and payroll purposes.",
          ]} />
          <p>
            See our{" "}
            <Link to="/privacy-policy" className="text-emerald-600 underline">Privacy Policy</Link>{" "}
            for how location and other personal data are handled.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to:</p>
          <List items={[
            "use the Service for anything unlawful, harmful, abusive, harassing or discriminatory;",
            "access another person's account or data without permission, or attempt to bypass security or access controls;",
            "upload malware, or interfere with or overload the Service;",
            "copy, reverse engineer or resell the Service, except as the law allows;",
            "post content that you do not have the right to share, or that infringes others' rights.",
          ]} />
        </Section>

        <Section title="6. Content you add">
          <p>
            You keep ownership of the content you add (such as tasks, comments, messages and files). You give us
            permission to store, process and display it as needed to run the Service. You are
            responsible for the content you post.
          </p>
        </Section>

        <Section title="7. Availability and changes">
          <p>
            We work to keep the Service available but do not promise it will be uninterrupted or error-free. We may
            update, improve or remove features, or suspend access for maintenance or security reasons.
          </p>
        </Section>

        <Section title="8. Suspension, termination and account deletion">
          <p>
            You may stop using the Service at any time and can delete your account from{" "}
            <strong>My Profile → Delete My Account</strong> or on the{" "}
            <Link to="/delete-account" className="text-emerald-600 underline">account deletion page</Link>. Authorised
            administrators may also deactivate or remove your account. We may suspend or end access if these Terms are
            broken or the Service is misused.
          </p>
        </Section>

        <Section title="9. Intellectual property">
          <p>
            The Service, including its design, software and branding, belongs to {COMPANY_NAME} or its licensors.
            These Terms give you a limited, non-exclusive, non-transferable right to use the Service for your work
            with {COMPANY_NAME}.
          </p>
        </Section>

        <Section title="10. Disclaimers and limits of liability">
          <p>
            The Service is provided "as is" and "as available". To the extent permitted by law, {COMPANY_NAME} is not
            liable for indirect or consequential losses, or for losses caused by events outside our reasonable
            control, including device, network or GPS problems. Nothing in these Terms limits liability that cannot
            be limited by law.
          </p>
        </Section>

        <Section title="11. Governing law">
          <p>These Terms are governed by the laws of {GOVERNING_LAW}.</p>
        </Section>

        <Section title="12. Changes to these terms">
          <p>
            We may update these Terms from time to time. The "Last updated" date shows the latest version. If you
            continue to use the Service after a change, you accept the updated Terms.
          </p>
        </Section>

        <Section title="13. Contact us">
          <p>
            {COMPANY_NAME} — <a href={`mailto:${SUPPORT_EMAIL}`} className="text-emerald-600 underline">{SUPPORT_EMAIL}</a>
          </p>
        </Section>

        <div className="pt-4 border-t border-slate-200 text-sm text-slate-400 flex flex-wrap gap-x-4 gap-y-1">
          <Link to="/privacy-policy" className="hover:text-slate-600">Privacy Policy</Link>
          <Link to="/delete-account" className="hover:text-slate-600">Delete account</Link>
          <Link to="/login" className="hover:text-slate-600">Sign in</Link>
        </div>
      </main>
    </div>
  );
}
