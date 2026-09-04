export const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL
  || (import.meta.env.DEV ? "http://localhost:5000" : undefined);

export const apiUrl = (path) => `${API_URL}${path}`;

export const assetUrl = (path) => {
  if (!path || /^https?:\/\//i.test(path)) return path;
  return `${API_URL}${path}`;
};
