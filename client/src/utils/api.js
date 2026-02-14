const rawBase = process.env.REACT_APP_API_URL || process.env.REACT_APP_API_BASE_URL || process.env.VITE_API_URL || "";

const normalizeBase = (base) => {
  if (!base) return "";
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export const API_BASE = normalizeBase(rawBase);

export const apiUrl = (path) => {
  if (!API_BASE) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
};
