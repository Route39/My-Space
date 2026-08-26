// Resolves the active tenant from the hostname for the *.attendy.in model.
// Dev/preview hosts (localhost, IPs, *.preview.emergentagent.com) have no tenant
// and fall back to the shared demo workspace behaviour.
const RESERVED = new Set([
  "www", "app", "admin", "api", "support", "billing", "help", "status", "mail",
  "assets", "cdn", "static", "platform", "dashboard", "login", "signup",
  "onboarding", "super", "root", "system", "attendy",
]);

export function getTenantSlug() {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  const parts = host.split(".");
  if (host.endsWith("attendy.in") && parts.length >= 3) {
    const slug = parts[0].toLowerCase();
    if (!RESERVED.has(slug)) return slug;
  }
  return null;
}

export function slugify(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}
