import { expect } from "@playwright/test";

export const ADMIN_TOKEN = "e2e-admin-token";
export const DRIVER_PHONE = "+213555000001";
export const DRIVER_PIN = "1234";

export async function getDish(request) {
  const response = await request.get("/api/menu");
  expect(response.ok()).toBeTruthy();
  const payload = await response.json();
  expect(payload.menu?.length).toBeGreaterThan(0);
  return payload.menu[0];
}

export function orderBody(productId, overrides = {}) {
  return {
    firstName: "E2E",
    lastName: "Client",
    phone: "+213555123456",
    email: "e2e@example.com",
    deliveryMode: "delivery",
    communeId: "hydra",
    deliveryAddress: "12 rue des Oliviers, Hydra",
    items: [{ productId, quantity: 1 }],
    ...overrides,
  };
}

export async function createOrder(request, productId) {
  const response = await request.post("/api/orders", { data: orderBody(productId) });
  expect(response.status()).toBe(201);
  const payload = await response.json();
  expect(payload.order?.id).toBeTruthy();
  return payload.order;
}

export async function updateOrderStatus(request, orderId, status) {
  const response = await request.patch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
    headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
    data: { status },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).order;
}

export async function createConfirmedOrder(request, productId) {
  const order = await createOrder(request, productId);
  await updateOrderStatus(request, order.id, "confirmed");
  return order;
}
