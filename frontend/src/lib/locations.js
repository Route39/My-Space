export const DEFAULT_LOCATIONS = ["Bangalore", "Coimbatore", "Tirupur", "Chennai"];

// Merge default cities + locations added in Settings (objects with .name) + any extra names (e.g. an employee's current value)
export const locationOptions = (...extra) => {
  const out = [];
  const add = (v) => {
    const name = typeof v === "string" ? v : v?.name;
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  DEFAULT_LOCATIONS.forEach(add);
  extra.forEach((x) => (Array.isArray(x) ? x.forEach(add) : add(x)));
  return out;
};
