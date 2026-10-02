// Client API dédié à la PWA livreur. Utilise les cookies HttpOnly côté serveur
// (session distincte de la session client via cookie galatee_driver_session).
const API_BASE = String(import.meta.env.VITE_API_BASE || window.GALATEE_API_BASE || "/api").replace(/\/+$/, "");

export async function driverApi(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Une erreur est survenue.");
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return payload;
}

export function driverLogin(body) {
  return driverApi("/driver/login", { method: "POST", body: JSON.stringify(body) });
}

export function driverLogout() {
  return driverApi("/driver/logout", { method: "POST" });
}

export function fetchDriverMe() {
  return driverApi("/driver/me");
}

export function fetchDriverPool() {
  return driverApi("/driver/pool");
}

export function fetchDriverOrders() {
  return driverApi("/driver/orders");
}

export function updateDriverStatus(status) {
  return driverApi("/driver/status", { method: "PATCH", body: JSON.stringify({ status }) });
}

export function takeOrder(orderId) {
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/take`, { method: "POST" });
}

export function releaseOrder(orderId) {
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/release`, { method: "POST" });
}

export function startDelivery(orderId) {
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/start`, { method: "POST" });
}

export function deliverOrder(orderId) {
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/delivered`, { method: "POST" });
}

export function cancelOrder(orderId, reason) {
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function cancelDelivery(orderId, reason) {
  const body = JSON.stringify({ reason });
  return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/cancel-delivery`, {
    method: "POST",
    body,
  }).catch((error) => {
    // Compatibilite avec une instance backend qui n'a pas encore recharge la route dediee.
    if (error.status !== 404) throw error;
    return driverApi(`/driver/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: "POST",
      body: JSON.stringify({ reason, deliveryAttempt: true }),
    });
  });
}
