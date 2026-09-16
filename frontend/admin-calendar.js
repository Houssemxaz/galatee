(function () {
  "use strict";

  const MONTHS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
  const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const HELP_TEXT = "Saisie : JJ/MM/AAAA ou AAAA-MM-JJ · année sur 4 chiffres";
  let openCalendar = null;

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function todayIso() {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function parseIso(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
    return date;
  }

  function toIso(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatDate(date) {
    return date ? `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}` : "aucune date";
  }

  function monthStart(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function makeButton(className, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.setAttribute("aria-label", label);
    return button;
  }

  function labelFor(input) {
    const label = input.closest("label");
    return label?.querySelector(":scope > span")?.textContent.trim() || "Date";
  }

  function isAllowed(input, iso) {
    if (!iso) return false;
    if (input.min && iso < input.min) return false;
    if (input.max && iso > input.max) return false;
    return /^\d{4}-/.test(iso);
  }

  function enhance(input) {
    if (input.dataset.calendarEnhanced === "true") return;
    input.dataset.calendarEnhanced = "true";
    input.classList.add("calendar-input");
    input.setAttribute("inputmode", "numeric");
    input.setAttribute("autocomplete", "off");
    input.setAttribute("aria-keyshortcuts", "Alt+ArrowDown");

    const field = document.createElement("div");
    field.className = "calendar-field";
    input.parentNode.insertBefore(field, input);
    field.append(input);

    const trigger = makeButton("calendar-trigger", `Ouvrir le calendrier : ${labelFor(input)}`);
    trigger.setAttribute("aria-haspopup", "dialog");
    trigger.setAttribute("aria-expanded", "false");
    trigger.innerHTML = '<span class="calendar-glyph" aria-hidden="true"></span>';
    field.append(trigger);

    const helpId = `${input.id || "date"}-format-help`;
    const help = document.createElement("span");
    help.id = helpId;
    help.className = "calendar-format-help";
    help.textContent = HELP_TEXT;
    input.closest("label")?.append(help);
    input.setAttribute("aria-describedby", helpId);

    const popover = document.createElement("div");
    popover.className = "calendar-popover";
    popover.setAttribute("role", "dialog");
    popover.setAttribute("aria-label", `Calendrier : ${labelFor(input)}`);
    popover.hidden = true;
    field.append(popover);

    let viewMonth = monthStart(parseIso(input.value) || new Date());

    function positionPopover() {
      if (popover.hidden) return;
      const anchor = field.getBoundingClientRect();
      const popup = popover.getBoundingClientRect();
      const margin = 12;
      const maxLeft = Math.max(margin, window.innerWidth - popup.width - margin);
      let left = Math.min(Math.max(margin, anchor.left), maxLeft);
      let top = anchor.bottom + 4;
      if (top + popup.height > window.innerHeight - margin) top = anchor.top - popup.height - 4;
      const maxTop = Math.max(margin, window.innerHeight - popup.height - margin);
      top = Math.min(Math.max(margin, top), maxTop);
      popover.style.left = `${Math.round(left)}px`;
      popover.style.top = `${Math.round(top)}px`;
    }

    function close(restoreFocus) {
      popover.hidden = true;
      trigger.setAttribute("aria-expanded", "false");
      field.classList.remove("is-open");
      popover.classList.remove("is-floating");
      popover.style.removeProperty("left");
      popover.style.removeProperty("top");
      window.removeEventListener("resize", positionPopover);
      window.removeEventListener("scroll", positionPopover, true);
      if (openCalendar === api) openCalendar = null;
      if (restoreFocus) trigger.focus();
    }

    function setDate(date) {
      const iso = toIso(date);
      if (!isAllowed(input, iso)) return;
      input.value = iso;
      input.setCustomValidity("");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      viewMonth = monthStart(date);
      render();
      close(true);
    }

    function setView(month) {
      if (month.getFullYear() < 1000 || month.getFullYear() > 9999) return;
      viewMonth = monthStart(month);
      render();
      const selected = parseIso(input.value) || new Date();
      const focusTarget = popover.querySelector(`[data-calendar-day="${toIso(selected)}"]:not([disabled])`) || popover.querySelector(".calendar-day:not([disabled])");
      focusTarget?.focus({ preventScroll: true });
    }

    function moveDay(iso, amount) {
      const date = parseIso(iso);
      if (!date) return;
      date.setDate(date.getDate() + amount);
      setView(monthStart(date));
      const next = popover.querySelector(`[data-calendar-day="${toIso(date)}"]:not([disabled])`);
      next?.focus();
    }

    function render() {
      const selected = parseIso(input.value);
      const monthName = `${MONTHS[viewMonth.getMonth()]} ${viewMonth.getFullYear()}`;
      popover.innerHTML = "";

      const header = document.createElement("div");
      header.className = "calendar-header";
      const previous = makeButton("calendar-nav calendar-nav-previous", "Mois précédent");
      const next = makeButton("calendar-nav calendar-nav-next", "Mois suivant");
      const caption = document.createElement("strong");
      caption.className = "calendar-caption";
      caption.textContent = monthName;
      previous.innerHTML = '<span class="calendar-chevron calendar-chevron-previous" aria-hidden="true"></span>';
      next.innerHTML = '<span class="calendar-chevron calendar-chevron-next" aria-hidden="true"></span>';
      previous.addEventListener("click", (event) => { event.stopPropagation(); setView(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1)); });
      next.addEventListener("click", (event) => { event.stopPropagation(); setView(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1)); });
      header.append(previous, caption, next);
      popover.append(header);

      const grid = document.createElement("div");
      grid.className = "calendar-grid";
      grid.setAttribute("role", "grid");
      grid.setAttribute("aria-label", monthName);
      WEEKDAYS.forEach((weekday) => {
        const heading = document.createElement("span");
        heading.className = "calendar-weekday";
        heading.setAttribute("role", "columnheader");
        heading.textContent = weekday;
        grid.append(heading);
      });

      const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
      const mondayOffset = (first.getDay() + 6) % 7;
      const cursor = new Date(first);
      cursor.setDate(cursor.getDate() - mondayOffset);
      for (let index = 0; index < 42; index += 1) {
        const day = new Date(cursor);
        day.setDate(cursor.getDate() + index);
        const iso = toIso(day);
        const dayButton = makeButton("calendar-day", formatDate(day));
        dayButton.dataset.calendarDay = iso;
        dayButton.setAttribute("role", "gridcell");
        dayButton.textContent = day.getDate();
        if (day.getMonth() !== viewMonth.getMonth()) dayButton.classList.add("is-outside");
        if (iso === todayIso()) dayButton.classList.add("is-today");
        if (selected && iso === toIso(selected)) {
          dayButton.classList.add("is-selected");
          dayButton.setAttribute("aria-selected", "true");
        } else {
          dayButton.setAttribute("aria-selected", "false");
        }
        if (!isAllowed(input, iso)) dayButton.disabled = true;
        dayButton.tabIndex = selected && iso === toIso(selected) && !dayButton.disabled ? 0 : -1;
        dayButton.addEventListener("click", () => setDate(day));
        dayButton.addEventListener("keydown", (event) => {
          const currentIso = dayButton.dataset.calendarDay;
          if (event.key === "ArrowLeft") { event.preventDefault(); moveDay(currentIso, -1); }
          if (event.key === "ArrowRight") { event.preventDefault(); moveDay(currentIso, 1); }
          if (event.key === "ArrowUp") { event.preventDefault(); moveDay(currentIso, -7); }
          if (event.key === "ArrowDown") { event.preventDefault(); moveDay(currentIso, 7); }
          if (event.key === "Home") { event.preventDefault(); moveDay(currentIso, -((parseIso(currentIso).getDay() + 6) % 7)); }
          if (event.key === "End") { event.preventDefault(); moveDay(currentIso, 6 - ((parseIso(currentIso).getDay() + 6) % 7)); }
          if (event.key === "PageUp") { event.preventDefault(); setView(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + (event.shiftKey ? -12 : -1), 1)); }
          if (event.key === "PageDown") { event.preventDefault(); setView(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + (event.shiftKey ? 12 : 1), 1)); }
        });
        grid.append(dayButton);
      }
      popover.append(grid);

      const footer = document.createElement("div");
      footer.className = "calendar-footer";
      const today = makeButton("calendar-footer-button", "Aujourd'hui");
      today.textContent = "Aujourd'hui";
      today.addEventListener("click", () => setDate(new Date()));
      if (!isAllowed(input, todayIso())) today.disabled = true;
      footer.append(today);
      if (!input.required) {
        const clear = makeButton("calendar-footer-button calendar-clear", "Effacer la date");
        clear.textContent = "Effacer";
        clear.addEventListener("click", () => {
          input.value = "";
          input.setCustomValidity("");
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
          render();
          close(true);
        });
        footer.append(clear);
      }
      popover.append(footer);
    }

    function open() {
      if (openCalendar && openCalendar !== api) openCalendar.close(false);
      viewMonth = monthStart(parseIso(input.value) || new Date());
      render();
      popover.hidden = false;
      trigger.setAttribute("aria-expanded", "true");
      field.classList.add("is-open");
      openCalendar = api;
      popover.classList.add("is-floating");
      positionPopover();
      window.addEventListener("resize", positionPopover);
      window.addEventListener("scroll", positionPopover, true);
      const focusTarget = popover.querySelector(`[data-calendar-day="${input.value}"]:not([disabled])`) || popover.querySelector(".calendar-day:not([disabled])");
      window.setTimeout(() => focusTarget?.focus({ preventScroll: true }), 0);
    }

    function validateInput() {
      if (!input.value || parseIso(input.value)) input.setCustomValidity("");
      else input.setCustomValidity("Saisissez une date avec une année sur 4 chiffres.");
      if (input.value) viewMonth = monthStart(parseIso(input.value) || viewMonth);
      if (!popover.hidden) render();
    }

    const api = { close };
    trigger.addEventListener("click", () => (popover.hidden ? open() : close(true)));
    input.addEventListener("click", (event) => { event.preventDefault(); open(); });
    input.addEventListener("change", validateInput);
    input.addEventListener("input", validateInput);
    input.addEventListener("keydown", (event) => {
      if (event.altKey && event.key === "ArrowDown") { event.preventDefault(); open(); }
      if (event.key === "Escape" && !popover.hidden) { event.preventDefault(); close(false); }
    });
    render();
  }

  document.querySelectorAll('input[type="date"]').forEach(enhance);
  document.addEventListener("click", (event) => {
    if (openCalendar && !event.target.closest(".calendar-field")) openCalendar.close(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openCalendar) openCalendar.close(true);
  });
})();
