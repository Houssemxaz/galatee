export const API_BASE = String(import.meta.env.VITE_API_BASE || window.GALATEE_API_BASE || "/api").replace(/\/+$/, "");
const TOKEN_KEY = "galatee.adminToken";

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  const normalized = token.trim();
  if (normalized) sessionStorage.setItem(TOKEN_KEY, normalized);
  else sessionStorage.removeItem(TOKEN_KEY);
}

function authHeaders(extra) {
  const headers = new Headers(extra || {});
  headers.set("Accept", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return headers;
}

async function parsePayload(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function throwIfError(response, payload) {
  if (response.ok) return;
  const error = new Error(payload?.error?.message || "Erreur API");
  error.status = response.status;
  error.code = payload?.error?.code;
  throw error;
}

export async function apiRequest(path, options = {}) {
  const headers = authHeaders(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const payload = await parsePayload(response);
  await throwIfError(response, payload);
  return payload;
}

export async function apiUpload(path, formData) {
  const headers = authHeaders();
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers, body: formData });
  const payload = await parsePayload(response);
  await throwIfError(response, payload);
  return payload;
}

export function apiMessage(error, fallback = "Une erreur est survenue.") {
  if (!error) return fallback;
  if (error.status === 401) return "Session admin refusée. Vérifiez le token.";
  if (error.status === 409) return error.message || "Conflit: cette action entre en collision avec un autre état.";
  return error.message || fallback;
}
