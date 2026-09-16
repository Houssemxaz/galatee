document.documentElement.classList.add("js");

const form = document.querySelector("[data-reservation-form]");
const dateInput = document.querySelector("[data-date-input]");
const partyInput = document.querySelector("[data-party-input]");
const tableTypeInput = document.querySelector("select[name='tableType']");
const timeInput = document.querySelector("[data-time-input]");
const availabilityStatus = document.querySelector("[data-availability-status]");
const reservationError = document.querySelector("[data-reservation-error]");
const reservationSuccess = document.querySelector("[data-reservation-success]");
const menuToggle = document.querySelector(".menu-toggle");
const mobileMenu = document.querySelector(".mobile-menu");
const apiBase = window.GALATEE_API_BASE || null;
const serviceDays = new Set([3, 4, 5, 6]);

const demoSlots = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30"];

function getTomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function getNextServiceDate() {
  const date = new Date();
  for (let offset = 1; offset <= 7; offset += 1) {
    date.setDate(date.getDate() + 1);
    if (serviceDays.has(date.getDay())) return date.toISOString().slice(0, 10);
  }
  return getTomorrow();
}

function setAvailabilityStatus(message, state = "idle") {
  availabilityStatus.textContent = message;
  availabilityStatus.dataset.state = state;
}

function renderSlots(slots, isDemo = false) {
  timeInput.innerHTML = "";
  if (!slots.length) {
    timeInput.disabled = true;
    const emptyOption = document.createElement("option");
    emptyOption.textContent = "Aucun creneau disponible";
    emptyOption.value = "";
    timeInput.append(emptyOption);
    setAvailabilityStatus("Aucun creneau ne correspond a cette recherche. Essayez une autre date.", "empty");
    return;
  }

  const firstOption = document.createElement("option");
  firstOption.textContent = "Choisir une heure";
  firstOption.value = "";
  timeInput.append(firstOption);

  slots.forEach((slot) => {
    const option = document.createElement("option");
    option.value = slot.time || slot;
    option.textContent = slot.time ? `${slot.time} · ${slot.remainingCovers} couverts restants` : slot;
    timeInput.append(option);
  });

  timeInput.disabled = false;
  setAvailabilityStatus(isDemo ? "Creneaux indicatifs en attendant la connexion au service de disponibilite." : "Creneaux disponibles pour cette date.");
}

function renderAvailabilityError() {
  timeInput.innerHTML = "";
  const errorOption = document.createElement("option");
  errorOption.textContent = "Disponibilite indisponible";
  errorOption.value = "";
  timeInput.append(errorOption);
  timeInput.disabled = true;
  setAvailabilityStatus("Impossible de charger les creneaux. Reessayez dans un instant.", "error");
}

async function loadAvailability() {
  if (!dateInput.value) {
    timeInput.disabled = true;
    setAvailabilityStatus("Les creneaux apparaitront ici.");
    return;
  }

  timeInput.disabled = true;
  setAvailabilityStatus("Recherche des creneaux...", "loading");
  if (!apiBase) {
    renderSlots(demoSlots, true);
    return;
  }

  const endpoint = `${apiBase}/availability?date=${encodeURIComponent(dateInput.value)}&partySize=${encodeURIComponent(partyInput.value)}&tableType=${encodeURIComponent(tableTypeInput.value)}`;

  try {
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("availability-request-failed");
    const payload = await response.json();
    renderSlots(Array.isArray(payload.timeSlots) ? payload.timeSlots : []);
  } catch (error) {
    renderAvailabilityError();
  }
}

async function submitReservation(event) {
  event.preventDefault();
  reservationError.hidden = true;
  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }
  if (!apiBase) {
    reservationError.textContent = "Le service de reservation n'est pas encore connecte. Appelez le restaurant au 01 42 38 01 25 pour reserver directement.";
    reservationError.hidden = false;
    return;
  }
  const formData = new FormData(form);
  const reservation = Object.fromEntries(formData.entries());
  const submitButton = form.querySelector("[type='submit']");
  const submitLabel = submitButton.querySelector("span");
  submitButton.disabled = true;
  submitLabel.textContent = "Envoi en cours";

  let submitted = false;
  try {
    const response = await fetch(`${apiBase}/reservations`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        firstName: reservation.firstName,
        lastName: reservation.lastName,
        phone: reservation.phone,
        email: reservation.email,
        date: reservation.date,
        partySize: Number(reservation.partySize),
        tableType: reservation.tableType,
        time: reservation.time,
        specialRequest: reservation.specialRequest,
      }),
    });
    if (!response.ok) throw new Error("reservation-request-failed");
    reservationSuccess.hidden = false;
    form.classList.add("is-submitted");
    submitButton.disabled = true;
    submitLabel.textContent = "Demande envoyee";
    submitted = true;
    reservationSuccess.focus();
  } catch (error) {
    reservationError.textContent = "La demande n'a pas pu etre envoyee. Verifiez votre connexion ou contactez directement le restaurant au 01 42 38 01 25.";
    reservationError.hidden = false;
  } finally {
    if (!submitted) {
      submitButton.disabled = false;
      submitLabel.textContent = "Envoyer la demande";
    }
  }
}

function toggleMenu() {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  mobileMenu.setAttribute("aria-hidden", String(isOpen));
  document.body.classList.toggle("menu-open", !isOpen);
}

if (dateInput && partyInput) {
  dateInput.min = getTomorrow();
  dateInput.value = getNextServiceDate();
  dateInput.addEventListener("change", loadAvailability);
  partyInput.addEventListener("change", loadAvailability);
  tableTypeInput.addEventListener("change", loadAvailability);
  loadAvailability();
}

form?.addEventListener("submit", submitReservation);
menuToggle?.addEventListener("click", toggleMenu);
mobileMenu?.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  if (menuToggle.getAttribute("aria-expanded") === "true") toggleMenu();
}));

const menuCards = [...document.querySelectorAll(".menu-card")];
menuCards.forEach((card) => card.addEventListener("toggle", () => {
  if (!card.open) return;
  menuCards.forEach((otherCard) => {
    if (otherCard !== card) otherCard.open = false;
  });
}));

const menuFilters = [...document.querySelectorAll("[data-menu-filter]")];
const menuStatus = document.querySelector("[data-menu-status]");
const menuFilterLabels = {
  all: "3 plats dans le menu de la semaine.",
  fresca: "1 plat dans la categorie pasta fresca.",
  ripiena: "1 plat dans la categorie pasta ripiena.",
  vegetal: "1 plat dans la categorie vegetal.",
};

function applyMenuFilter(filter) {
  menuFilters.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.menuFilter === filter));
  });
  menuCards.forEach((card) => {
    const isVisible = filter === "all" || card.dataset.menuCategory === filter;
    if (!isVisible) card.open = false;
    card.hidden = !isVisible;
  });
  if (menuStatus) menuStatus.textContent = menuFilterLabels[filter] || menuFilterLabels.all;
}

menuFilters.forEach((button) => button.addEventListener("click", () => {
  applyMenuFilter(button.dataset.menuFilter);
}));
applyMenuFilter("all");

const revealObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("is-visible");
    observer.unobserve(entry.target);
  });
}, { threshold: 0.12 });

document.querySelectorAll(".reveal").forEach((element) => revealObserver.observe(element));
