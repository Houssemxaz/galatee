import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  dateToIso, parseIsoDate, formatDateDisplay, formatDateDraft, parseDateDraft,
  isSelectableDate, startOfMonth, formatMonthLabel, formatLongDate, getTomorrow, getNextServiceDate,
} from "@/lib/dates";
import { API_BASE, trackEvent } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

function Field({ label, name, value, onChange, type = "text", ...props }) {
  return (
    <div className="field-group">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} value={value} onChange={(event) => onChange(name, event.target.value)} {...props} />
    </div>
  );
}

function SelectField({ id, label, value, onChange, options, icon, placeholder, disabled = false }) {
  return (
    <div className="field-group">
      <Label htmlFor={id}>{label}</Label>
      <Select name={id} value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} className="select-field">
          {icon}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateCalendar({ value, min, onChange, onClear, popoverRef, style }) {
  const minDate = parseIsoDate(min);
  const selectedDate = parseIsoDate(value);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate || minDate || new Date()));
  const days = useMemo(() => {
    const firstDay = startOfMonth(viewMonth);
    const offset = (firstDay.getDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => new Date(viewMonth.getFullYear(), viewMonth.getMonth(), index - offset + 1));
  }, [viewMonth]);
  const today = dateToIso(new Date());
  const monthLabel = formatMonthLabel(viewMonth);
  const previousMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
  const nextMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  const previousDisabled = minDate && previousMonth < startOfMonth(minDate);
  useEffect(() => {
    const focusTarget = popoverRef.current?.querySelector('[data-date-day][tabindex="0"]');
    focusTarget?.focus();
  }, [viewMonth, popoverRef]);
  function focusDay(date) {
    const iso = dateToIso(date);
    if (date.getMonth() !== viewMonth.getMonth()) setViewMonth(startOfMonth(date));
    window.setTimeout(() => popoverRef.current?.querySelector(`[data-date-key="${iso}"]`)?.focus(), 0);
  }
  function onDayKeyDown(event, date) {
    const moves = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (moves[event.key]) { event.preventDefault(); const target = new Date(date); target.setDate(target.getDate() + moves[event.key]); focusDay(target); }
    if (event.key === "Home" || event.key === "End") { event.preventDefault(); const target = new Date(date); target.setDate(target.getDate() + (event.key === "Home" ? -((target.getDay() + 6) % 7) : 6 - ((target.getDay() + 6) % 7))); focusDay(target); }
  }
  return createPortal((
    <div ref={popoverRef} style={style} className="date-calendar" role="dialog" aria-modal="false" aria-labelledby="date-calendar-title" onMouseDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <div className="date-calendar-header">
        <button type="button" className="date-calendar-nav" onClick={() => setViewMonth(previousMonth)} disabled={previousDisabled} aria-label="Mois précédent"><ChevronLeft size={18} strokeWidth={1.5} /></button>
        <div>
          <p className="date-calendar-kicker">Choisir une date</p>
          <h3 id="date-calendar-title" aria-live="polite">{monthLabel}</h3>
        </div>
        <button type="button" className="date-calendar-nav" onClick={() => setViewMonth(nextMonth)} aria-label="Mois suivant"><ChevronRight size={18} strokeWidth={1.5} /></button>
      </div>
      <div className="date-calendar-weekdays" aria-hidden="true">
        {["Lu", "Ma", "Me", "Je", "Ve", "Sa", "Di"].map((day) => <span key={day}>{day}</span>)}
      </div>
      <div className="date-calendar-grid" role="grid" aria-label={`Jours de ${monthLabel}`}>
        {days.map((date) => {
          const iso = dateToIso(date);
          const disabled = Boolean(min && iso < min);
          const selected = iso === value;
          const outside = date.getMonth() !== viewMonth.getMonth();
          return (
            <button key={iso} type="button" data-date-day="true" data-date-key={iso}
              className={`date-calendar-day ${outside ? "is-outside" : ""} ${selected ? "is-selected" : ""} ${iso === today ? "is-today" : ""}`}
              onClick={() => !disabled && onChange(iso)} onKeyDown={(event) => onDayKeyDown(event, date)}
              disabled={disabled} aria-current={iso === today ? "date" : undefined} aria-pressed={selected}
              aria-label={formatLongDate(iso)} tabIndex={selected ? 0 : -1}>
              {date.getDate()}
            </button>
          );
        })}
      </div>
      <div className="date-calendar-footer">
        <button type="button" className="date-calendar-text-button" onClick={() => onChange(today)} disabled={Boolean(min && today < min)}>Aujourd'hui</button>
        <button type="button" className="date-calendar-text-button" onClick={onClear}>Effacer</button>
      </div>
    </div>
  ), document.body);
}

function DateField({ id, label, value, onChange, min }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => formatDateDisplay(value));
  const [error, setError] = useState("");
  const [popoverPosition, setPopoverPosition] = useState(null);
  const inputRef = useRef(null);
  const popoverRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => { if (value) setDraft(formatDateDisplay(value)); }, [value]);
  useLayoutEffect(() => {
    if (!open) { setPopoverPosition(null); return undefined; }
    const reposition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const popover = popoverRef.current?.getBoundingClientRect();
      if (!anchor || !popover) return;
      const margin = 12; const gap = 10;
      let top = anchor.bottom + gap;
      if (top + popover.height > window.innerHeight - margin) top = anchor.top - gap - popover.height;
      top = Math.max(margin, Math.min(top, window.innerHeight - margin - popover.height));
      let left = anchor.left;
      left = Math.max(margin, Math.min(left, window.innerWidth - margin - popover.width));
      setPopoverPosition({ top, left });
    };
    const frame = window.requestAnimationFrame(reposition);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => { window.cancelAnimationFrame(frame); window.removeEventListener("resize", reposition); window.removeEventListener("scroll", reposition, true); };
  }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") { event.preventDefault(); setOpen(false); inputRef.current?.focus(); } };
    const onPointerDown = (event) => { if (!popoverRef.current?.contains(event.target) && !inputRef.current?.contains(event.target) && !triggerRef.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => { document.removeEventListener("keydown", onKeyDown); document.removeEventListener("pointerdown", onPointerDown, true); };
  }, [open]);
  function chooseDate(iso) { onChange(iso); setDraft(formatDateDisplay(iso)); setError(""); setOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }
  function clearDate() { onChange(""); setDraft(""); setError(""); setOpen(false); window.setTimeout(() => inputRef.current?.focus(), 0); }
  function handleInput(event) {
    const next = formatDateDraft(event.target.value);
    const parsed = parseDateDraft(next);
    setDraft(next);
    if (parsed && isSelectableDate(parsed, min)) { onChange(parsed); setError(""); }
    else { onChange(""); setError(next.length === 10 ? (parsed ? "Choisissez une date à partir de demain." : "Utilisez le format JJ/MM/AAAA.") : ""); }
  }
  function validateInput(event) {
    if (event?.relatedTarget && (popoverRef.current?.contains(event.relatedTarget) || triggerRef.current?.contains(event.relatedTarget))) return;
    const parsed = parseDateDraft(draft);
    if (!parsed) { setError(draft ? "Utilisez le format JJ/MM/AAAA." : "Choisissez une date."); return; }
    if (!isSelectableDate(parsed, min)) { setError("Choisissez une date à partir de demain."); return; }
    chooseDate(parsed);
  }
  return (
    <div className="field-group date-field-group">
      <Label htmlFor={id}>{label}</Label>
      <div className="date-field-shell">
        <Input ref={inputRef} id={id} name={id} type="text" inputMode="numeric" autoComplete="off"
          placeholder="JJ/MM/AAAA" value={draft} onChange={handleInput} onBlur={validateInput}
          onClick={() => setOpen(true)}
          onKeyDown={(event) => { if (event.key === "Enter" || event.key === "ArrowDown") { event.preventDefault(); setOpen(true); } }}
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}" required aria-invalid={Boolean(error)} aria-describedby={`${id}-hint ${id}-error`} />
        <button ref={triggerRef} type="button" className="date-field-trigger"
          onClick={() => setOpen((current) => !current)}
          aria-label={open ? "Fermer le calendrier" : "Ouvrir le calendrier"}
          aria-haspopup="dialog" aria-expanded={open}>
          <CalendarDays size={17} strokeWidth={1.5} />
        </button>
        {open && (
          <DateCalendar value={value} min={min} onChange={chooseDate} onClear={clearDate} popoverRef={popoverRef}
            style={{ top: `${popoverPosition?.top ?? 12}px`, left: `${popoverPosition?.left ?? 12}px` }} />
        )}
      </div>
      <p id={`${id}-hint`} className="date-field-hint">Saisie: JJ/MM/AAAA · année sur 4 chiffres</p>
      <p id={`${id}-error`} className={`date-field-error ${error ? "is-visible" : ""}`} role="alert">{error}</p>
    </div>
  );
}

export default function ReservationForm() {
  const { account } = useCustomerAuth();
  const [form, setForm] = useState({
    firstName: "", lastName: "", phone: "", email: "", specialRequest: "",
    date: getNextServiceDate(), partySize: "2", tableType: "normal", time: "",
  });
  const [slots, setSlots] = useState([]);
  const [availabilityState, setAvailabilityState] = useState("idle");
  const [availabilityMessage, setAvailabilityMessage] = useState("Choisissez une date pour voir les créneaux.");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const successRef = useRef(null);
  const update = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  useEffect(() => {
    if (!account) return;
    setForm((current) => ({
      ...current,
      firstName: current.firstName || account.firstName,
      lastName: current.lastName || account.lastName,
      phone: current.phone || account.phone,
      email: current.email || account.email,
    }));
  }, [account]);
  const startedRef = useRef(false);
  function markStarted() { if (!startedRef.current) { startedRef.current = true; trackEvent("reservation_started"); } }
  useEffect(() => {
    let cancelled = false;
    async function loadAvailability() {
      if (!form.date) return;
      setAvailabilityState("loading");
      setAvailabilityMessage("Recherche des créneaux...");
      update("time", "");
      try {
        const params = new URLSearchParams({ date: form.date, partySize: form.partySize, tableType: form.tableType });
        const response = await fetch(`${API_BASE}/availability?${params}`, { headers: { Accept: "application/json" } });
        if (!response.ok) throw new Error();
        const payload = await response.json();
        if (cancelled) return;
        const nextSlots = Array.isArray(payload.timeSlots) ? payload.timeSlots : [];
        setSlots(nextSlots);
        setAvailabilityState(nextSlots.length ? "ready" : "empty");
        setAvailabilityMessage(nextSlots.length ? "Créneaux disponibles pour cette date." : "Aucun créneau disponible pour cette recherche.");
      } catch {
        if (cancelled) return;
        setSlots([]); setAvailabilityState("error");
        setAvailabilityMessage("Impossible de charger les créneaux. Réessayez dans un instant.");
      }
    }
    loadAvailability();
    return () => { cancelled = true; };
  }, [form.date, form.partySize, form.tableType]);
  async function submit(event) {
    event.preventDefault();
    setError("");
    if (!isSelectableDate(form.date, getTomorrow())) { setError("Choisissez une date valide à partir de demain."); return; }
    if (!slots.length) { setError(availabilityState === "loading" ? "Attendez le chargement des créneaux." : availabilityMessage); return; }
    if (!form.time || !slots.some((slot) => slot.time === form.time)) { setError("Choisissez un créneau disponible avant d'envoyer votre demande."); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/reservations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ ...form, partySize: Number(form.partySize) }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const submitError = new Error(payload?.error?.message || "reservation-request-failed");
        submitError.code = payload?.error?.code;
        throw submitError;
      }
      setSubmitted(true);
      trackEvent("reservation_submitted");
      window.setTimeout(() => successRef.current?.focus(), 0);
    } catch (submitError) {
      const errorMessages = {
        SERVICE_CLOSED: "Le restaurant est fermé à cette date.",
        TIME_SLOT_UNAVAILABLE: "Ce créneau n'est plus disponible pour cette table.",
        TIME_SLOT_INVALID: "Ce créneau n'est pas disponible pour cette date.",
      };
      setError(errorMessages[submitError.code] || (submitError.message === "reservation-request-failed" ? "La demande n'a pas pu être envoyée. Contactez directement le restaurant." : submitError.message));
    } finally { setSubmitting(false); }
  }
  if (submitted) {
    return (
      <div ref={successRef} className="reservation-success" tabIndex="-1" role="status" aria-live="polite">
        <span className="success-mark" aria-hidden="true"><Check size={24} /></span>
        <p className="eyebrow"><i /> Demande reçue</p>
        <h3>En attente de<br /><em>confirmation.</em></h3>
        <p>Notre équipe reviendra vers vous pour confirmer le service choisi. Aucune table n'est confirmée avant notre réponse.</p>
      </div>
    );
  }
  return (
    <form className="reservation-form" onSubmit={submit} onFocusCapture={markStarted}>
      <div className="form-header"><span>Demande de réservation</span><span>EN UNE ÉTAPE</span></div>
      <div className="form-section-heading">Vos coordonnées</div>
      <div className="form-row form-row-two">
        <Field label="Prénom" name="firstName" value={form.firstName} onChange={update} autoComplete="given-name" required />
        <Field label="Nom" name="lastName" value={form.lastName} onChange={update} autoComplete="family-name" required />
      </div>
      <Field label="Téléphone" name="phone" value={form.phone} onChange={update} type="tel" autoComplete="tel" pattern="[0-9+() .-]{7,}" required />
      <Field label={<><span>Email</span> <small>Optionnel</small></>} name="email" value={form.email} onChange={update} type="email" autoComplete="email" />
      <div className="field-group">
        <Label htmlFor="specialRequest">Demande spéciale <small>Optionnel</small></Label>
        <textarea id="specialRequest" name="specialRequest" rows="3" value={form.specialRequest} onChange={(event) => update("specialRequest", event.target.value)} placeholder="Allergie, occasion, préférence de placement..." />
      </div>
      <Separator />
      <div className="form-section-heading">Votre service</div>
      <div className="form-row form-row-two">
        <DateField id="date" label="Date" value={form.date} onChange={(value) => update("date", value)} min={getTomorrow()} />
        <SelectField id="partySize" label="Nombre de personnes" value={form.partySize} onChange={(value) => update("partySize", value)} icon={<Users size={15} />} options={["2", "3", "4", "5", "6"].map((v) => ({ value: v, label: `${v} personnes` }))} />
      </div>
      <div className="form-row form-row-two">
        <SelectField id="tableType" label="Type de table" value={form.tableType} onChange={(value) => update("tableType", value)} options={[{ value: "normal", label: "Normal" }, { value: "vip", label: "VIP" }]} />
        <SelectField id="time" label="Heure d'arrivée" value={form.time} onChange={(value) => update("time", value)} icon={<Clock3 size={15} />} placeholder={availabilityState === "loading" ? "Recherche..." : "Choisir une heure"} disabled={!slots.length} options={slots.map((slot) => ({ value: slot.time, label: `${slot.time} · ${slot.remainingCovers} couverts restants` }))} />
      </div>
      <div className={`availability-status ${availabilityState}`} role="status" aria-live="polite"><CalendarDays size={14} />{availabilityMessage}</div>
      {error && <div className="reservation-error" role="alert"><X size={15} />{error}</div>}
      <Button className="action-button action-button-full" type="submit" disabled={submitting}>
        <span>{submitting ? "Envoi en cours" : "Envoyer la demande"}</span>
        <ArrowUpRight size={16} />
      </Button>
      <p className="form-note">Votre demande sera examinée par le restaurant. La réservation n'est confirmée qu'après notre réponse.</p>
    </form>
  );
}
