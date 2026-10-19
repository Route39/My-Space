// Return purely locations added by Admin in Settings plus any extra names (e.g. employee current value, Remote)
export const locationOptions = (...extra) => {
  const out = [];
  const add = (v) => {
    const name = typeof v === "string" ? v : v?.name;
    if (name && !out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
  };
  extra.forEach((x) => (Array.isArray(x) ? x.forEach(add) : add(x)));
  if (!out.some((x) => x.toLowerCase() === "remote")) out.push("Remote");
  return out;
};
