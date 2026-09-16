const API_BASE = window.GALATEE_API_BASE || "/api";
const TOKEN_KEY = "galatee.adminToken";
const STATUSES = ["requested", "confirmed", "cancelled", "completed"];

const elements = {
  alert: document.querySelector("[data-alert]"),
  authForm: document.querySelector("[data-auth-form]"),
  tokenInput: document.querySelector("[data-token-input]"),
  clearToken: document.querySelector("[data-clear-token]"),
  authStatus: document.querySelector("[data-auth-status]"),
  reservationDate: document.querySelector("[data-reservation-date]"),
  reservationStatus: document.querySelector("[data-reservation-status]"),
  reservationList: document.querySelector("[data-reservations-list]"),
  refreshReservations: document.querySelector("[data-refresh-reservations]"),
  resetReservationFilters: document.querySelector("[data-reset-reservation-filters]"),
  statTotal: document.querySelector("[data-stat-total]"),
  statRequested: document.querySelector("[data-stat-requested]"),
  statConfirmed: document.querySelector("[data-stat-confirmed]"),
  statCovers: document.querySelector("[data-stat-covers]"),
  availabilityDate: document.querySelector("[data-availability-date]"),
  availabilityTableType: document.querySelector("[data-availability-table-type]"),
  availabilityTime: document.querySelector("[data-availability-time]"),
  availabilityPartySize: document.querySelector("[data-availability-party-size]"),
  availabilitySummary: document.querySelector("[data-availability-summary]"),
  availabilityList: document.querySelector("[data-availability-list]"),
  refreshAvailability: document.querySelector("[data-refresh-availability]"),
  resetAvailabilityFilters: document.querySelector("[data-reset-availability-filters]"),
  blockedForm: document.querySelector("[data-blocked-form]"),
  blockedDate: document.querySelector("[data-blocked-date]"),
  blockedFilter: document.querySelector("[data-blocked-filter]"),
  blockedList: document.querySelector("[data-blocked-list]"),
  blockedCount: document.querySelector("[data-blocked-count]"),
  refreshBlocked: document.querySelector("[data-refresh-blocked]"),
};

let reservations = [];
let blockedTimeSlots = [];

const AVAILABILITY_STATE_LABELS = {
  available: "Disponible",
  blocked: "Bloque",
  full: "Complet",
};

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || "";
}

function setToken(token) {
  const normalized = token.trim();
  if (normalized) sessionStorage.setItem(TOKEN_KEY, normalized);
  else sessionStorage.removeItem(TOKEN_KEY);
  elements.tokenInput.value = normalized;
  renderAuthStatus();
}

function renderAuthStatus() {
  elements.authStatus.textContent = getToken() ? "Token de session actif" : "Mode local sans token";
  elements.authStatus.dataset.active = getToken() ? "true" : "false";
}

function setAlert(message, kind = "error") {
  if (!message) {
    elements.alert.hidden = true;
    elements.alert.textContent = "";
    elements.alert.removeAttribute("data-kind");
    return;
  }
  elements.alert.textContent = message;
  elements.alert.dataset.kind = kind;
  elements.alert.hidden = false;
}

function apiMessage(error, fallback = "Une erreur API est survenue.") {
  if (error.status === 401) return "Acces refuse. Verifiez le token admin de cette session.";
  if (error.status === 409) return error.message || "Conflit: cette action n'est plus disponible.";
  return error.message || fallback;
}

async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (options.body) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  let payload = null;
  try { payload = await response.json(); } catch (error) { payload = null; }
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Erreur API");
    error.status = response.status;
    error.code = payload?.error?.code;
    throw error;
  }
  return payload;
}

function formatDate(date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(date, time) {
  return `${formatDate(date)} · ${time}`;
}

function reservationFirstName(reservation) {
  return reservation.firstName || reservation.guestName?.split(" ")[0] || "Prenom non renseigne";
}

function reservationLastName(reservation) {
  return reservation.lastName || reservation.guestName?.split(" ").slice(1).join(" ") || "";
}

function reservationDisplayName(reservation) {
  return `${reservationFirstName(reservation)} ${reservationLastName(reservation)}`.trim();
}

function reservationPhone(reservation) {
  return reservation.phone || reservation.guestPhone || "Telephone non renseigne";
}

function reservationEmail(reservation) {
  return reservation.email || reservation.guestEmail || "Email non renseigne";
}

function statusLabel(status) {
  const labels = {
    requested: "Demande en attente",
    confirmed: "Confirmee",
    cancelled: "Annulee",
    completed: "Terminee",
  };
  return labels[status] || status.charAt(0).toUpperCase() + status.slice(1);
}

function statusActionLabel(status) {
  const labels = {
    requested: "Demande en attente",
    confirmed: "Confirmer",
    cancelled: "Annuler",
    completed: "Marquer terminee",
  };
  return labels[status] || statusLabel(status);
}

function statusBadge(status) {
  const badge = document.createElement("span");
  badge.className = `status-badge status-${status}`;
  badge.textContent = statusLabel(status);
  return badge;
}

function renderReservationStats() {
  elements.statTotal.textContent = reservations.length;
  elements.statRequested.textContent = reservations.filter((reservation) => reservation.status === "requested").length;
  elements.statConfirmed.textContent = reservations.filter((reservation) => reservation.status === "confirmed").length;
  elements.statCovers.textContent = reservations
    .filter((reservation) => reservation.status === "confirmed")
    .reduce((total, reservation) => total + Number(reservation.partySize || 0), 0);
}

function makeCell(className = "") {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  return cell;
}

function availabilityTypeLabel(tableType) {
  if (tableType === "vip") return "VIP";
  if (tableType === "normal") return "Normal";
  return tableType || "Tous";
}

function availabilityState(value, row) {
  const normalized = String(value || "").toLowerCase();
  if (["blocked", "bloque", "unavailable"].includes(normalized) || row.blocked === true || row.isBlocked === true) return "blocked";
  if (["full", "complete", "complet"].includes(normalized)) return "full";
  if (row.available === false) return "full";
  const remaining = Number(row.remainingCovers ?? row.remaining ?? row.placesRestantes);
  if (Number.isFinite(remaining) && remaining <= 0) return "full";
  return "available";
}

function normalizeAvailabilityRow(row, tableType, timeOverride) {
  const capacity = Number(row.capacityCovers ?? row.capacity ?? row.totalCapacity ?? 0);
  const confirmedCovers = Number(row.confirmedCovers ?? row.confirmed ?? row.confirmedPartySize ?? 0);
  const remainingRaw = row.remainingCovers ?? row.remaining ?? row.placesRestantes;
  const remainingCovers = Number(remainingRaw ?? Math.max(capacity - confirmedCovers, 0));
  return {
    time: row.time || timeOverride || "-",
    tableType: tableType || row.tableType || row.type || "all",
    capacity,
    confirmedCovers,
    remainingCovers,
    state: availabilityState(row.status || row.state, { ...row, remainingCovers }),
  };
}

function normalizeAvailability(payload) {
  const source = payload?.availability || payload?.slots || payload?.timeSlots || payload?.rows;
  if (!Array.isArray(source)) return [];
  return source.flatMap((row) => {
    const nestedTypes = row.tableTypes || row.types || row.byTableType;
    if (!nestedTypes || typeof nestedTypes !== "object" || Array.isArray(nestedTypes)) {
      return [normalizeAvailabilityRow(row)];
    }
    return Object.entries(nestedTypes).map(([tableType, details]) => normalizeAvailabilityRow(details || {}, tableType, row.time));
  });
}

function renderAvailabilityState(message, state = "empty") {
  elements.availabilityList.innerHTML = "";
  elements.availabilityList.setAttribute("aria-busy", state === "loading" ? "true" : "false");
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 6;
  const stateElement = document.createElement("div");
  stateElement.className = `state state-${state}`;
  stateElement.textContent = message;
  cell.append(stateElement);
  row.append(cell);
  elements.availabilityList.append(row);
  elements.availabilitySummary.textContent = message;
}

function renderAvailability(payload) {
  const rows = normalizeAvailability(payload);
  if (!rows.length) {
    renderAvailabilityState("Aucune disponibilite pour ces filtres.");
    return;
  }

  elements.availabilityList.innerHTML = "";
  elements.availabilityList.setAttribute("aria-busy", "false");
  elements.availabilitySummary.textContent = `${rows.length} disponibilite${rows.length > 1 ? "s" : ""} pour la selection.`;
  rows.forEach((row) => {
    const tableRow = document.createElement("tr");
    const timeCell = makeCell();
    timeCell.className = "availability-time-cell";
    timeCell.textContent = row.time;
    const typeCell = makeCell();
    typeCell.textContent = availabilityTypeLabel(row.tableType);
    const capacityCell = makeCell();
    capacityCell.textContent = row.capacity;
    const confirmedCell = makeCell();
    confirmedCell.textContent = row.confirmedCovers;
    const remainingCell = makeCell();
    remainingCell.textContent = row.remainingCovers;
    const stateCell = makeCell();
    const state = document.createElement("span");
    state.className = `availability-state availability-state-${row.state}`;
    state.textContent = AVAILABILITY_STATE_LABELS[row.state] || row.state;
    stateCell.append(state);
    tableRow.append(timeCell, typeCell, capacityCell, confirmedCell, remainingCell, stateCell);
    elements.availabilityList.append(tableRow);
  });
}

async function loadAvailability() {
  renderAvailabilityState("Chargement des disponibilites...", "loading");
  const params = new URLSearchParams({
    date: elements.availabilityDate.value,
    partySize: elements.availabilityPartySize.value,
    tableType: elements.availabilityTableType.value,
  });
  if (elements.availabilityTime.value) params.set("time", elements.availabilityTime.value);
  try {
    const payload = await apiRequest(`/admin/availability?${params}`);
    setAlert("");
    renderAvailability(payload);
  } catch (error) {
    renderAvailabilityState(apiMessage(error, "Impossible de charger les disponibilites."), "error");
    setAlert(apiMessage(error, "Impossible de charger les disponibilites."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
  }
}

function renderReservationsState(message, state = "empty") {
  elements.reservationList.innerHTML = "";
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 7;
  const stateElement = document.createElement("div");
  stateElement.className = `state state-${state}`;
  stateElement.textContent = message;
  cell.append(stateElement);
  row.append(cell);
  elements.reservationList.append(row);
}

function renderReservations() {
  renderReservationStats();
  if (!reservations.length) {
    renderReservationsState("Aucune Reservation ne correspond aux filtres.");
    return;
  }

  elements.reservationList.innerHTML = "";
  reservations.forEach((reservation) => {
    const row = document.createElement("tr");
    const dateCell = makeCell();
    const date = document.createElement("strong");
    date.className = "reservation-date";
    date.textContent = formatDate(reservation.date);
    const time = document.createElement("span");
    time.className = "reservation-time";
    time.textContent = reservation.time;
    dateCell.append(date, time);

    const guestCell = makeCell();
    const firstName = document.createElement("div");
    firstName.className = "guest-name";
    firstName.textContent = reservationFirstName(reservation);
    const lastName = document.createElement("div");
    lastName.className = "guest-last-name";
    lastName.textContent = reservationLastName(reservation);
    guestCell.append(firstName, lastName);

    const partyCell = makeCell();
    const party = document.createElement("span");
    party.className = "party-size";
    party.textContent = reservation.partySize;
    partyCell.append(party);
    const tableType = document.createElement("span");
    tableType.className = `table-type table-type-${String(reservation.tableType || "Normal").toLowerCase()}`;
    tableType.textContent = reservation.tableType || "Normal";
    partyCell.append(tableType);

    const contactCell = makeCell();
    const contact = document.createElement("div");
    contact.className = "contact-stack";
    const email = document.createElement("span");
    email.textContent = reservationEmail(reservation);
    const phone = document.createElement("span");
    phone.textContent = reservationPhone(reservation);
    contact.append(phone, email);
    contactCell.append(contact);

    const requestCell = makeCell();
    const request = document.createElement("p");
    request.className = "special-request";
    request.textContent = reservation.specialRequest || "Aucune demande speciale";
    requestCell.append(request);

    const statusCell = makeCell();
    statusCell.append(statusBadge(reservation.status));

    const actionCell = makeCell();
    const action = document.createElement("div");
    action.className = "action-stack";
    const select = document.createElement("select");
    const statusControlId = `reservation-status-${reservation.id}`;
    select.id = statusControlId;
    select.name = "reservationStatus";
    select.setAttribute("aria-label", `Nouveau statut pour ${reservationDisplayName(reservation)}`);
    STATUSES.forEach((status) => {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = statusActionLabel(status);
      option.selected = status === reservation.status;
      select.append(option);
    });
    const save = document.createElement("button");
    save.type = "button";
    const isPending = reservation.status === "requested";
    save.className = isPending ? "confirm-action" : "";
    save.title = isPending ? "Confirmer la demande" : "Enregistrer le statut";
    save.setAttribute("aria-label", isPending ? `Confirmer la demande de ${reservationDisplayName(reservation)}` : `Enregistrer le statut de ${reservationDisplayName(reservation)}`);
    save.textContent = isPending ? "Confirmer" : "↗";
    save.addEventListener("click", () => updateReservationStatus(reservation, isPending ? "confirmed" : select.value, save));
    action.append(select, save);
    actionCell.append(action);

    row.append(dateCell, guestCell, partyCell, contactCell, requestCell, statusCell, actionCell);
    elements.reservationList.append(row);
  });
}

async function loadReservations() {
  renderReservationsState("Chargement des Reservations...", "loading");
  const params = new URLSearchParams();
  if (elements.reservationDate.value) params.set("date", elements.reservationDate.value);
  if (elements.reservationStatus.value) params.set("status", elements.reservationStatus.value);

  try {
    const payload = await apiRequest(`/admin/reservations${params.toString() ? `?${params}` : ""}`);
    reservations = Array.isArray(payload.reservations) ? payload.reservations : [];
    setAlert("");
    renderReservations();
  } catch (error) {
    reservations = [];
    renderReservationStats();
    renderReservationsState(apiMessage(error, "Impossible de charger les Reservations."), "error");
    setAlert(apiMessage(error, "Impossible de charger les Reservations."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
  }
}

async function updateReservationStatus(reservation, status, button) {
  if (status === reservation.status) return;
  button.disabled = true;
  try {
    const payload = await apiRequest(`/admin/reservations/${encodeURIComponent(reservation.id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    const updated = payload.reservation;
    reservations = reservations.map((item) => item.id === updated.id ? updated : item);
    setAlert(`Reservation de ${reservationDisplayName(updated)} mise a jour: ${statusLabel(updated.status)}.`, "success");
    renderReservations();
  } catch (error) {
    setAlert(apiMessage(error, "Le statut n'a pas pu etre modifie."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
    button.disabled = false;
  }
}

function renderBlockedState(message, state = "empty") {
  elements.blockedList.innerHTML = "";
  const stateElement = document.createElement("div");
  stateElement.className = `state state-${state}`;
  stateElement.textContent = message;
  elements.blockedList.append(stateElement);
}

function renderBlockedTimeSlots() {
  elements.blockedCount.textContent = blockedTimeSlots.length;
  if (!blockedTimeSlots.length) {
    renderBlockedState("Aucun creneau bloque pour cette selection.");
    return;
  }

  elements.blockedList.innerHTML = "";
  blockedTimeSlots.forEach((blockedTimeSlot) => {
    const item = document.createElement("div");
    item.className = "blocked-item";
    const copy = document.createElement("div");
    const heading = document.createElement("div");
    heading.innerHTML = `<span class="blocked-date">${formatDate(blockedTimeSlot.date)}</span><span class="blocked-time">${blockedTimeSlot.time}</span>`;
    const reason = document.createElement("div");
    reason.className = "blocked-reason";
    reason.textContent = blockedTimeSlot.reason || "Sans motif precise";
    copy.append(heading, reason);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "remove-block";
    remove.textContent = "Supprimer";
    remove.addEventListener("click", () => removeBlockedTimeSlot(blockedTimeSlot, remove));
    item.append(copy, remove);
    elements.blockedList.append(item);
  });
}

async function loadBlockedTimeSlots() {
  renderBlockedState("Chargement des blocages...", "loading");
  const params = new URLSearchParams();
  if (elements.blockedFilter.value) params.set("date", elements.blockedFilter.value);
  try {
    const payload = await apiRequest(`/admin/blocked-time-slots${params.toString() ? `?${params}` : ""}`);
    blockedTimeSlots = Array.isArray(payload.blockedTimeSlots) ? payload.blockedTimeSlots : [];
    setAlert("");
    renderBlockedTimeSlots();
  } catch (error) {
    blockedTimeSlots = [];
    elements.blockedCount.textContent = "0";
    renderBlockedState(apiMessage(error, "Impossible de charger les blocages."), "error");
    setAlert(apiMessage(error, "Impossible de charger les blocages."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
  }
}

async function createBlockedTimeSlot(event) {
  event.preventDefault();
  const submit = elements.blockedForm.querySelector("button[type='submit']");
  const formData = new FormData(elements.blockedForm);
  submit.disabled = true;
  try {
    await apiRequest("/admin/blocked-time-slots", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    elements.blockedForm.reset();
    elements.blockedDate.value = new Date().toISOString().slice(0, 10);
    setAlert("Time Slot bloque pour le service.", "success");
    await loadBlockedTimeSlots();
  } catch (error) {
    setAlert(apiMessage(error, "Le Time Slot n'a pas pu etre bloque."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
  } finally {
    submit.disabled = false;
  }
}

async function removeBlockedTimeSlot(blockedTimeSlot, button) {
  button.disabled = true;
  try {
    await apiRequest(`/admin/blocked-time-slots/${encodeURIComponent(blockedTimeSlot.id)}`, { method: "DELETE" });
    setAlert(`Blocage du ${formatDate(blockedTimeSlot.date)} a ${blockedTimeSlot.time} supprime.`, "success");
    await loadBlockedTimeSlots();
  } catch (error) {
    setAlert(apiMessage(error, "Le blocage n'a pas pu etre supprime."), error.status === 401 ? "auth" : error.status === 409 ? "conflict" : "error");
    button.disabled = false;
  }
}

elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  setToken(elements.tokenInput.value);
  setAlert(getToken() ? "Token conserve dans cette session." : "Mode local sans token.", "success");
  loadReservations();
  loadBlockedTimeSlots();
});
elements.clearToken.addEventListener("click", () => {
  setToken("");
  setAlert("Token efface de cette session.", "success");
  loadReservations();
  loadBlockedTimeSlots();
});
elements.reservationDate.addEventListener("change", loadReservations);
elements.reservationStatus.addEventListener("change", loadReservations);
elements.resetReservationFilters.addEventListener("click", () => {
  elements.reservationDate.value = "";
  elements.reservationStatus.value = "";
  loadReservations();
});
elements.refreshReservations.addEventListener("click", loadReservations);
elements.availabilityDate.addEventListener("change", loadAvailability);
elements.availabilityTableType.addEventListener("change", loadAvailability);
elements.availabilityTime.addEventListener("change", loadAvailability);
elements.availabilityPartySize.addEventListener("change", loadAvailability);
elements.refreshAvailability.addEventListener("click", loadAvailability);
elements.resetAvailabilityFilters.addEventListener("click", () => {
  elements.availabilityDate.value = new Date().toISOString().slice(0, 10);
  elements.availabilityTableType.value = "all";
  elements.availabilityTime.value = "";
  elements.availabilityPartySize.value = "2";
  loadAvailability();
});
elements.blockedFilter.addEventListener("change", loadBlockedTimeSlots);
elements.refreshBlocked.addEventListener("click", loadBlockedTimeSlots);
elements.blockedForm.addEventListener("submit", createBlockedTimeSlot);

elements.tokenInput.value = getToken();
elements.blockedDate.value = new Date().toISOString().slice(0, 10);
elements.availabilityDate.value = new Date().toISOString().slice(0, 10);
renderAuthStatus();
loadReservations();
loadBlockedTimeSlots();
loadAvailability();
