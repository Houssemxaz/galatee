import { useCallback, useEffect, useState } from "react";
import { Ban, Check, Clock3, Pencil, Plus, RotateCw, Save, Trash2, Unlock } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import BoDateInput from "../shared/BoDateInput.jsx";
import { apiRequest, apiMessage } from "../api";

const TABLE_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "normal", label: "Normal" },
  { value: "vip", label: "VIP" },
];

const TIME_SLOTS = ["19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30"];
const SCHEDULE_INTERVALS = [15, 30, 45, 60];

function minutesFromTimeValue(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + minutes;
}

function timeFromMinutesValue(minutes) {
  const normalized = Math.max(0, Math.min(1439, minutes));
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function scheduleTimeOptions(interval) {
  const step = Number(interval) || 30;
  return Array.from({ length: Math.floor(1439 / step) + 1 }, (_, index) => timeFromMinutesValue(index * step));
}

function alignScheduleTime(value, interval) {
  return timeFromMinutesValue(Math.round(minutesFromTimeValue(value) / Number(interval || 30)) * Number(interval || 30));
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function stateMeta(slot) {
  if (slot.blocked) return { tone: "muted", label: "Bloqué" };
  if (slot.state === "full" || slot.remainingCovers === 0) return { tone: "warn", label: "Complet" };
  if (slot.remainingCovers <= 2) return { tone: "info", label: "Presque complet" };
  return { tone: "ok", label: "Disponible" };
}

const WEEKDAYS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function ScheduleEditor() {
  const [draft, setDraft] = useState(null);
  const [state, setState] = useState("loading");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState(null);

  const loadSettings = useCallback(async () => {
    setState("loading");
    try {
      const payload = await apiRequest("/admin/availability-settings");
      const interval = payload.settings.slotIntervalMinutes;
      setDraft({
        ...payload.settings,
        activeDays: payload.settings.activeDays || [],
        startTime: alignScheduleTime(payload.settings.startTime, interval),
        endTime: alignScheduleTime(payload.settings.endTime, interval),
      });
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger le planning.") });
    }
  }, []);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function changeDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeInterval(value) {
    setDraft((current) => ({
      ...current,
      slotIntervalMinutes: value,
      startTime: alignScheduleTime(current.startTime, value),
      endTime: alignScheduleTime(current.endTime, value),
    }));
  }

  function toggleDay(day) {
    setDraft((current) => ({
      ...current,
      activeDays: current.activeDays.includes(day)
        ? current.activeDays.filter((entry) => entry !== day)
        : [...current.activeDays, day].sort((a, b) => a - b),
    }));
  }

  async function saveSettings() {
    setBusy(true);
    setAlert(null);
    try {
      const payload = await apiRequest("/admin/availability-settings", {
        method: "PUT",
        body: JSON.stringify({
          ...draft,
          slotIntervalMinutes: Number(draft.slotIntervalMinutes),
          normalTableCount: Number(draft.normalTableCount),
          normalTableCapacity: Number(draft.normalTableCapacity),
          vipTableCount: Number(draft.vipTableCount),
          vipTableCapacity: Number(draft.vipTableCapacity),
        }),
      });
      setDraft(payload.settings);
      setAlert({ kind: "success", message: "Planning général enregistré." });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Enregistrement impossible.") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bo-schedule-panel" aria-labelledby="weekly-schedule-title">
      <div className="bo-schedule-heading">
        <div>
          <p className="bo-eyebrow">Planning récurrent</p>
          <h2 id="weekly-schedule-title">Horaires et capacité</h2>
          <p className="bo-schedule-intro">Ces réglages alimentent les créneaux proposés sur le site.</p>
        </div>
        <Clock3 size={22} strokeWidth={1.5} aria-hidden="true" />
      </div>
      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement du planning…</p>}
      {state === "error" && <p className="bo-empty">Le planning n’a pas pu être chargé.</p>}
      {state === "ready" && draft && (
        <div className="bo-global-schedule">
          <div className="bo-global-schedule-top">
            <label className="bo-schedule-switch"><input type="checkbox" checked={draft.active} onChange={(event) => changeDraft("active", event.target.checked)} /><span className="bo-schedule-switch-control" aria-hidden="true"><Check size={13} strokeWidth={2.5} /></span><span>Planning actif</span></label>
            <div className="bo-day-picker" aria-label="Jours ouverts">
              {WEEKDAYS.map((day, index) => <button type="button" className={`bo-day-chip ${draft.activeDays.includes(index) ? "is-active" : ""}`} key={day} onClick={() => toggleDay(index)}>{day.slice(0, 3)}</button>)}
            </div>
          </div>
          <div className="bo-schedule-fields bo-global-fields">
            <label className="bo-schedule-field"><span>De</span><select className="bo-native-select" value={draft.startTime} onChange={(event) => changeDraft("startTime", event.target.value)}>{scheduleTimeOptions(draft.slotIntervalMinutes).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
            <label className="bo-schedule-field"><span>À</span><select className="bo-native-select" value={draft.endTime} onChange={(event) => changeDraft("endTime", event.target.value)}>{scheduleTimeOptions(draft.slotIntervalMinutes).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
            <label className="bo-schedule-field"><span>Intervalle</span><select className="bo-native-select" value={draft.slotIntervalMinutes} onChange={(event) => changeInterval(event.target.value)}>{SCHEDULE_INTERVALS.map((interval) => <option key={interval} value={interval}>{interval} min</option>)}</select></label>
            <label className="bo-schedule-field"><span>Tables N.</span><input type="number" min="0" max="100" value={draft.normalTableCount} onChange={(event) => changeDraft("normalTableCount", event.target.value)} /></label>
            <label className="bo-schedule-field"><span>Places N.</span><input type="number" min="1" max="50" value={draft.normalTableCapacity} onChange={(event) => changeDraft("normalTableCapacity", event.target.value)} /></label>
            <label className="bo-schedule-field"><span>Tables VIP</span><input type="number" min="0" max="100" value={draft.vipTableCount} onChange={(event) => changeDraft("vipTableCount", event.target.value)} /></label>
            <label className="bo-schedule-field"><span>Places VIP</span><input type="number" min="1" max="50" value={draft.vipTableCapacity} onChange={(event) => changeDraft("vipTableCapacity", event.target.value)} /></label>
          </div>
          <div className="bo-global-schedule-footer"><span className="bo-schedule-summary">{draft.normalTableCount} tables normales · {draft.vipTableCount} tables VIP</span><Button className="bo-schedule-save" size="sm" onClick={saveSettings} disabled={busy}><Save size={14} strokeWidth={1.8} /> {busy ? "Enregistrement…" : "Enregistrer le planning"}</Button></div>
        </div>
      )}
    </section>
  );
}

function emptyEvent() {
  const date = todayISO();
  return {
    name: "",
    dateFrom: date,
    dateTo: date,
    startTime: "19:00",
    endTime: "21:30",
    slotIntervalMinutes: "30",
    normalTableCount: "1",
    normalTableCapacity: "18",
    vipTableCount: "1",
    vipTableCapacity: "4",
    active: true,
  };
}

function eventDraft(event) {
  const interval = event.slotIntervalMinutes;
  return {
    name: event.name,
    dateFrom: event.dateFrom,
    dateTo: event.dateTo,
    startTime: alignScheduleTime(event.startTime, interval),
    endTime: alignScheduleTime(event.endTime, interval),
    slotIntervalMinutes: String(interval),
    normalTableCount: String(event.normalTableCount),
    normalTableCapacity: String(event.normalTableCapacity),
    vipTableCount: String(event.vipTableCount),
    vipTableCapacity: String(event.vipTableCapacity),
    active: event.active,
  };
}

function SpecialEventsEditor() {
  const [events, setEvents] = useState([]);
  const [state, setState] = useState("loading");
  const [alert, setAlert] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyEvent);
  const [busy, setBusy] = useState(null);

  const loadEvents = useCallback(async () => {
    setState("loading");
    try {
      const payload = await apiRequest("/admin/availability-events");
      setEvents(payload.events || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les événements.") });
    }
  }, []);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  function openCreate() {
    setEditingId(null);
    setDraft(emptyEvent());
    setAlert(null);
    setShowDialog(true);
  }

  function openEdit(event) {
    setEditingId(event.id);
    setDraft(eventDraft(event));
    setAlert(null);
    setShowDialog(true);
  }

  function changeDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function changeInterval(value) {
    setDraft((current) => ({
      ...current,
      slotIntervalMinutes: value,
      startTime: alignScheduleTime(current.startTime, value),
      endTime: alignScheduleTime(current.endTime, value),
    }));
  }

  async function saveEvent(event) {
    event.preventDefault();
    setBusy("save");
    setAlert(null);
    try {
      const payload = {
        ...draft,
        slotIntervalMinutes: Number(draft.slotIntervalMinutes),
        normalTableCount: Number(draft.normalTableCount),
        normalTableCapacity: Number(draft.normalTableCapacity),
        vipTableCount: Number(draft.vipTableCount),
        vipTableCapacity: Number(draft.vipTableCapacity),
      };
      await apiRequest(editingId ? `/admin/availability-events/${encodeURIComponent(editingId)}` : "/admin/availability-events", {
        method: editingId ? "PATCH" : "POST",
        body: JSON.stringify(payload),
      });
      setShowDialog(false);
      setAlert({ kind: "success", message: editingId ? "Événement mis à jour." : "Événement spécial créé." });
      await loadEvents();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Enregistrement impossible.") });
    } finally {
      setBusy(null);
    }
  }

  async function removeEvent(event) {
    if (!window.confirm(`Supprimer l'événement « ${event.name} » ?`)) return;
    setBusy(event.id);
    try {
      await apiRequest(`/admin/availability-events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
      setAlert({ kind: "success", message: "Événement supprimé." });
      await loadEvents();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Suppression impossible.") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="bo-schedule-panel bo-events-panel" aria-labelledby="special-events-title">
      <div className="bo-schedule-heading">
        <div>
          <p className="bo-eyebrow">Exceptions au planning</p>
          <h2 id="special-events-title">Événements spéciaux</h2>
          <p className="bo-schedule-intro">Une période spéciale remplace automatiquement le planning général aux dates indiquées.</p>
        </div>
        <Button size="sm" onClick={openCreate}><Plus size={15} strokeWidth={1.8} /> Nouvel événement</Button>
      </div>
      {alert && <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>}
      {state === "loading" && <p className="bo-empty">Chargement des événements…</p>}
      {state === "error" && <p className="bo-empty">Les événements n’ont pas pu être chargés.</p>}
      {state === "ready" && events.length === 0 && <p className="bo-empty">Aucun événement spécial configuré.</p>}
      {state === "ready" && events.length > 0 && (
        <div className="bo-event-list">
          {events.map((event) => (
            <article className={`bo-event-item ${event.active ? "" : "is-inactive"}`} key={event.id}>
              <div className="bo-event-main">
                <div className="bo-event-title-row">
                  <h3>{event.name}</h3>
                  <span className={`bo-status bo-status-${event.active ? "ok" : "muted"}`}>{event.active ? "Actif" : "Inactif"}</span>
                </div>
                <p className="bo-event-date">{formatDate(event.dateFrom)}{event.dateTo !== event.dateFrom ? ` → ${formatDate(event.dateTo)}` : ""} · {event.startTime}–{event.endTime}</p>
                <p className="bo-event-capacity">Normal : {event.normalTableCount} table{event.normalTableCount > 1 ? "s" : ""} × {event.normalTableCapacity} places · VIP : {event.vipTableCount} × {event.vipTableCapacity}</p>
              </div>
              <div className="bo-event-actions">
                <Button variant="outline" size="sm" onClick={() => openEdit(event)}><Pencil size={14} strokeWidth={1.8} /> Modifier</Button>
                <Button variant="ghost" size="sm" className="bo-action-block" onClick={() => removeEvent(event)} disabled={busy === event.id}><Trash2 size={14} strokeWidth={1.8} /> Supprimer</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="bo-dialog bo-event-dialog">
          <DialogHeader><DialogTitle className="bo-dialog-title">{editingId ? "Modifier l’événement" : "Créer un événement spécial"}</DialogTitle></DialogHeader>
          <form className="bo-dialog-form" onSubmit={saveEvent}>
            <label className="bo-field"><span>Nom de l’événement</span><Input value={draft.name} onChange={(event) => changeDraft("name", event.target.value)} placeholder="Ex. Dîner de fin d'année" required /></label>
            <div className="bo-event-form-grid">
              <label className="bo-field"><span>Du</span><BoDateInput value={draft.dateFrom} onChange={(value) => changeDraft("dateFrom", value || draft.dateFrom)} clearable={false} /></label>
              <label className="bo-field"><span>Au</span><BoDateInput value={draft.dateTo} onChange={(value) => changeDraft("dateTo", value || draft.dateTo)} clearable={false} /></label>
              <label className="bo-field"><span>Ouverture</span><select className="bo-native-select" value={draft.startTime} onChange={(event) => changeDraft("startTime", event.target.value)} required>{scheduleTimeOptions(draft.slotIntervalMinutes).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
              <label className="bo-field"><span>Fermeture</span><select className="bo-native-select" value={draft.endTime} onChange={(event) => changeDraft("endTime", event.target.value)} required>{scheduleTimeOptions(draft.slotIntervalMinutes).map((time) => <option key={time} value={time}>{time}</option>)}</select></label>
              <label className="bo-field"><span>Intervalle</span><select className="bo-native-select" value={draft.slotIntervalMinutes} onChange={(event) => changeInterval(event.target.value)}>{SCHEDULE_INTERVALS.map((interval) => <option key={interval} value={interval}>{interval} min</option>)}</select></label>
              <label className="bo-schedule-switch bo-event-active"><input type="checkbox" checked={draft.active} onChange={(event) => changeDraft("active", event.target.checked)} /><span className="bo-schedule-switch-control" aria-hidden="true"><Check size={13} strokeWidth={2.5} /></span><span>Événement actif</span></label>
            </div>
            <div className="bo-event-capacity-grid">
              <fieldset><legend>Tables normales</legend><label className="bo-field"><span>Nombre de tables</span><input className="bo-native-input" type="number" min="0" max="500" value={draft.normalTableCount} onChange={(event) => changeDraft("normalTableCount", event.target.value)} required /></label><label className="bo-field"><span>Places par table</span><input className="bo-native-input" type="number" min="1" max="500" value={draft.normalTableCapacity} onChange={(event) => changeDraft("normalTableCapacity", event.target.value)} required /></label></fieldset>
              <fieldset><legend>Tables VIP</legend><label className="bo-field"><span>Nombre de tables</span><input className="bo-native-input" type="number" min="0" max="500" value={draft.vipTableCount} onChange={(event) => changeDraft("vipTableCount", event.target.value)} required /></label><label className="bo-field"><span>Places par table</span><input className="bo-native-input" type="number" min="1" max="500" value={draft.vipTableCapacity} onChange={(event) => changeDraft("vipTableCapacity", event.target.value)} required /></label></fieldset>
            </div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setShowDialog(false)}>Annuler</Button><Button type="submit" disabled={busy === "save"}><Save size={14} strokeWidth={1.8} /> {busy === "save" ? "Enregistrement…" : "Enregistrer"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}

export default function AvailabilityPage() {
  const [date, setDate] = useState(todayISO());
  const [tableType, setTableType] = useState("all");
  // partySize fixed to 2 for admin view — filter shows all slots regardless
  const partySize = 2;
  const [slots, setSlots] = useState([]);
  const [blockedList, setBlockedList] = useState([]);
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);
  const [showBlock, setShowBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({ date: todayISO(), time: "19:30", tableType: "normal", reason: "" });
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    setAlert(null);
    try {
      const params = new URLSearchParams({ date, partySize: String(partySize), tableType });
      const [avail, blocked] = await Promise.all([
        apiRequest(`/admin/availability?${params}`),
        apiRequest(`/admin/blocked-time-slots?date=${date}`),
      ]);
      setSlots(avail.timeSlots || []);
      setBlockedList(blocked.blockedTimeSlots || blocked.blocked || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les disponibilités.") });
    }
  }, [date, partySize, tableType]);

  useEffect(() => { load(); }, [load]);

  const slotRows = slots.flatMap((slot) => Object.entries(slot.types || {}).map(([currentTableType, details]) => ({
    ...details,
    time: slot.time,
    tableType: currentTableType,
  })));

  async function toggleBlock(slot) {
    setBusy(slot.time + slot.tableType);
    try {
      const existingBlock = blockedList.find((block) => (
        block.date === date && block.time === slot.time
        && (block.tableType === slot.tableType || block.tableType === null)
      ));
      if (slot.blocked && existingBlock) {
        await apiRequest(`/admin/blocked-time-slots/${encodeURIComponent(existingBlock.id)}`, { method: "DELETE" });
        setAlert({ kind: "success", message: `Créneau ${slot.time} rouvert.` });
      } else {
        await apiRequest("/admin/blocked-time-slots", {
          method: "POST",
          body: JSON.stringify({ date, time: slot.time, tableType: slot.tableType, reason: "Bloqué manuellement" }),
        });
        setAlert({ kind: "success", message: `Créneau ${slot.time} bloqué.` });
      }
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Action refusée.") });
    } finally {
      setBusy(null);
    }
  }

  async function createBlock(e) {
    e.preventDefault();
    setBusy("form");
    try {
      await apiRequest("/admin/blocked-time-slots", {
        method: "POST",
        body: JSON.stringify(blockForm),
      });
      setAlert({ kind: "success", message: "Créneau bloqué." });
      setShowBlock(false);
      setBlockForm({ ...blockForm, reason: "" });
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Blocage refusé.") });
    } finally {
      setBusy(null);
    }
  }

  async function removeBlock(block) {
    setBusy(block.id);
    try {
      await apiRequest(`/admin/blocked-time-slots/${encodeURIComponent(block.id)}`, { method: "DELETE" });
      setAlert({ kind: "success", message: "Créneau rouvert." });
      await load();
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Suppression refusée.") });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="bo-page">
      <ScheduleEditor />
      <SpecialEventsEditor />
      <section className="bo-filters" aria-label="Filtres disponibilités">
        <div className="bo-filter-group">
          <label className="bo-filter-label">Date</label>
          <BoDateInput value={date} onChange={(v) => setDate(v || todayISO())} clearable={false} />
        </div>
        <div className="bo-filter-group">
          <label className="bo-filter-label">Type de table</label>
          <div className="bo-chip-group">
            {TABLE_FILTERS.map((t) => (
              <button
                key={t.value} type="button"
                className={`bo-chip ${tableType === t.value ? "is-active" : ""}`}
                onClick={() => setTableType(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bo-filter-actions">
          <Button variant="outline" size="sm" onClick={() => setShowBlock(true)}>
            <Plus size={14} strokeWidth={1.7} /> Bloquer un créneau
          </Button>
          <Button variant="outline" size="sm" onClick={load} aria-label="Rafraîchir">
            <RotateCw size={14} strokeWidth={1.7} />
          </Button>
        </div>
      </section>

      {alert && (
        <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>
      )}

      <section className="bo-table-wrap">
        <div className="bo-table-heading">
          <h2 className="bo-table-title">Créneaux — {formatDate(date)}</h2>
          <span className="bo-table-count">{slotRows.length} créneau{slotRows.length > 1 ? "x" : ""}</span>
        </div>
        {state === "loading" && <p className="bo-empty">Chargement…</p>}
        {state === "ready" && slotRows.length === 0 && <p className="bo-empty">Aucun créneau pour cette date.</p>}
        {state === "ready" && slotRows.length > 0 && (
          <Table className="bo-table">
            <TableHeader>
              <TableRow>
                <TableHead>Heure</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Capacité</TableHead>
                <TableHead>Confirmés</TableHead>
                <TableHead>Restants</TableHead>
                <TableHead>État</TableHead>
                <TableHead className="bo-th-actions">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slotRows.map((slot, idx) => {
                const st = stateMeta(slot);
                const key = `${slot.time}-${slot.tableType}-${idx}`;
                return (
                  <TableRow key={key} className="bo-tr">
                    <TableCell className="bo-td-time">{slot.time}</TableCell>
                    <TableCell>
                      <span className={`bo-tag bo-tag-${slot.tableType === "vip" ? "vip" : "normal"}`}>
                        {slot.tableType === "vip" ? "VIP" : "Normal"}
                      </span>
                    </TableCell>
                    <TableCell className="bo-td-num">{slot.capacity ?? "—"}</TableCell>
                    <TableCell className="bo-td-num">{slot.confirmedCovers ?? 0}</TableCell>
                    <TableCell className="bo-td-num">{slot.remainingCovers ?? "—"}</TableCell>
                    <TableCell><span className={`bo-status bo-status-${st.tone}`}>{st.label}</span></TableCell>
                    <TableCell className="bo-td-actions">
                      {slot.blocked ? (
                        <Button size="sm" variant="ghost" className="bo-action-unblock"
                          onClick={() => toggleBlock(slot)} disabled={busy === slot.time + slot.tableType}>
                          <Unlock size={13} strokeWidth={2} /> Débloquer
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" className="bo-action-block"
                          onClick={() => toggleBlock(slot)} disabled={busy === slot.time + slot.tableType}>
                          <Ban size={13} strokeWidth={2} /> Bloquer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      {blockedList.length > 0 && (
        <section className="bo-table-wrap">
          <div className="bo-table-heading">
            <h2 className="bo-table-title">Créneaux bloqués manuellement</h2>
            <span className="bo-table-count">{blockedList.length}</span>
          </div>
          <Table className="bo-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date · Heure</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Raison</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead className="bo-th-actions">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blockedList.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="bo-td-date">
                    <span className="bo-td-date-day">{formatDate(b.date)}</span>
                    <span className="bo-td-date-time">{b.time}</span>
                  </TableCell>
                  <TableCell><span className={`bo-tag bo-tag-${b.tableType === "vip" ? "vip" : "normal"}`}>{b.tableType === "vip" ? "VIP" : "Normal"}</span></TableCell>
                  <TableCell>{b.reason || "—"}</TableCell>
                  <TableCell><span className="bo-status bo-status-muted">{b.reservationId ? "Auto" : "Manuel"}</span></TableCell>
                  <TableCell className="bo-td-actions">
                    {!b.reservationId && (
                      <Button size="sm" variant="ghost" className="bo-action-unblock"
                        onClick={() => removeBlock(b)} disabled={busy === b.id}>
                        <Unlock size={13} strokeWidth={2} /> Débloquer
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <Dialog open={showBlock} onOpenChange={setShowBlock}>
        <DialogContent className="bo-dialog">
          <DialogHeader>
            <DialogTitle className="bo-dialog-title">Bloquer un créneau</DialogTitle>
          </DialogHeader>
          <form className="bo-dialog-form" onSubmit={createBlock}>
            <label className="bo-field">
              <span>Date</span>
              <BoDateInput value={blockForm.date} onChange={(v) => setBlockForm({ ...blockForm, date: v || todayISO() })} clearable={false} />
            </label>
            <label className="bo-field">
              <span>Créneau</span>
              <select
                className="bo-native-select"
                value={blockForm.time}
                onChange={(e) => setBlockForm({ ...blockForm, time: e.target.value })}
                required
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>{slot}</option>
                ))}
              </select>
            </label>
            <label className="bo-field">
              <span>Type de table</span>
              <div className="bo-chip-group">
                {TABLE_FILTERS.filter((t) => t.value !== "all").map((t) => (
                  <button key={t.value} type="button"
                    className={`bo-chip ${blockForm.tableType === t.value ? "is-active" : ""}`}
                    onClick={() => setBlockForm({ ...blockForm, tableType: t.value })}>
                    {t.label}
                  </button>
                ))}
              </div>
            </label>
            <label className="bo-field">
              <span>Raison (optionnel)</span>
              <Input value={blockForm.reason} onChange={(e) => setBlockForm({ ...blockForm, reason: e.target.value })} placeholder="Ex. Privatisation, jour férié…" />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowBlock(false)}>Annuler</Button>
              <Button type="submit" disabled={busy === "form"}>Bloquer le créneau</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
