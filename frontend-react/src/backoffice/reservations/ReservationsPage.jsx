import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, X, RotateCw, Filter, Phone, Mail, MessageSquare, Utensils } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import BoDateInput from "../shared/BoDateInput.jsx";
import { apiRequest, apiMessage } from "../api";

const STATUS_META = {
  requested: { label: "En attente", tone: "warn" },
  confirmed: { label: "Confirmée", tone: "ok" },
  cancelled: { label: "Annulée", tone: "muted" },
  completed: { label: "Terminée", tone: "info" },
};

const STATUS_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "requested", label: "En attente" },
  { value: "confirmed", label: "Confirmées" },
  { value: "cancelled", label: "Annulées" },
  { value: "completed", label: "Terminées" },
];

const TABLE_FILTERS = [
  { value: "all", label: "Toutes" },
  { value: "normal", label: "Normal" },
  { value: "vip", label: "VIP" },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextServiceISO() {
  const d = new Date();
  // Service Mer-Sam (3-6). Find next matching day.
  for (let i = 1; i <= 7; i += 1) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() >= 3 && d.getDay() <= 6) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  return tomorrowISO();
}

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y.slice(2)}`;
}

function formatTime(hhmm) {
  return hhmm || "—";
}

function displayName(r) {
  const first = r.firstName || r.guestName?.split(" ")[0] || "";
  const last = r.lastName || r.guestName?.split(" ").slice(1).join(" ") || "";
  return `${first} ${last}`.trim() || "Anonyme";
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: "muted" };
  return <span className={`bo-status bo-status-${meta.tone}`}>{meta.label}</span>;
}

function KpiCard({ label, value, hint, tone = "default" }) {
  return (
    <div className={`bo-kpi bo-kpi-${tone}`}>
      <p className="bo-kpi-label">{label}</p>
      <p className="bo-kpi-value">{value}</p>
      {hint && <p className="bo-kpi-hint">{hint}</p>}
    </div>
  );
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState([]);
  const [state, setState] = useState("idle");
  const [alert, setAlert] = useState(null);
  const [dateFilter, setDateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [actionId, setActionId] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    setAlert(null);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const payload = await apiRequest(`/admin/reservations${params.toString() ? `?${params}` : ""}`);
      setReservations(payload.reservations || []);
      setState("ready");
    } catch (error) {
      setState("error");
      setAlert({ kind: "error", message: apiMessage(error, "Impossible de charger les réservations.") });
    }
  }, [dateFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 30s when tab is visible — keeps admin in sync with public reservations
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const filtered = useMemo(() => {
    return reservations.filter((r) => {
      if (tableFilter !== "all" && r.tableType !== tableFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${displayName(r)} ${r.phone || ""} ${r.email || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reservations, tableFilter, search]);

  const kpis = useMemo(() => {
    const source = reservations;
    const today = source.filter((r) => r.date === todayISO());
    const requested = source.filter((r) => r.status === "requested").length;
    const confirmed = source.filter((r) => r.status === "confirmed").length;
    const cancelled = source.filter((r) => r.status === "cancelled").length;
    return { today: today.length, requested, confirmed, cancelled };
  }, [reservations]);

  async function updateStatus(reservation, status) {
    setActionId(`${reservation.id}:${status}`);
    try {
      const payload = await apiRequest(`/admin/reservations/${encodeURIComponent(reservation.id)}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const updated = payload.reservation || { ...reservation, status };
      setReservations((current) => current.map((r) => (r.id === updated.id ? updated : r)));
      if (detail?.id === updated.id) setDetail(updated);
      setAlert({ kind: "success", message: `Réservation ${STATUS_META[status]?.label?.toLowerCase() || status}.` });
    } catch (error) {
      setAlert({ kind: "error", message: apiMessage(error, "Changement de statut refusé.") });
    } finally {
      setActionId(null);
    }
  }

  function resetFilters() {
    setDateFilter("");
    setStatusFilter("all");
    setTableFilter("all");
    setSearch("");
  }

  return (
    <div className="bo-page">
      <section className="bo-kpis" aria-label="Indicateurs">
        <KpiCard label="Aujourd'hui" value={kpis.today} hint="Réservations du jour" />
        <KpiCard label="En attente" value={kpis.requested} hint="À traiter" tone={kpis.requested > 0 ? "warn" : "default"} />
        <KpiCard label="Confirmées" value={kpis.confirmed} hint="Sur la période" tone="ok" />
        <KpiCard label="Annulées" value={kpis.cancelled} hint="Sur la période" />
      </section>

      <section className="bo-filters" aria-label="Filtres">
        <div className="bo-filter-group">
          <label className="bo-filter-label">Date</label>
          <div className="bo-filter-row">
            <BoDateInput value={dateFilter} onChange={setDateFilter} />
            <div className="bo-chip-group bo-chip-group-tight">
              <button type="button" className={`bo-chip ${dateFilter === todayISO() ? "is-active" : ""}`} onClick={() => setDateFilter(todayISO())}>Aujourd'hui</button>
              <button type="button" className={`bo-chip ${dateFilter === tomorrowISO() ? "is-active" : ""}`} onClick={() => setDateFilter(tomorrowISO())}>Demain</button>
              <button type="button" className={`bo-chip ${dateFilter === nextServiceISO() ? "is-active" : ""}`} onClick={() => setDateFilter(nextServiceISO())}>Prochain service</button>
              <button type="button" className={`bo-chip ${!dateFilter ? "is-active" : ""}`} onClick={() => setDateFilter("")}>Toutes</button>
            </div>
          </div>
        </div>
        <div className="bo-filter-group">
          <label className="bo-filter-label">Statut</label>
          <div className="bo-chip-group">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`bo-chip ${statusFilter === s.value ? "is-active" : ""}`}
                onClick={() => setStatusFilter(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bo-filter-group">
          <label className="bo-filter-label">Table</label>
          <div className="bo-chip-group">
            {TABLE_FILTERS.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`bo-chip ${tableFilter === t.value ? "is-active" : ""}`}
                onClick={() => setTableFilter(t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="bo-filter-group bo-filter-search">
          <label className="bo-filter-label">Recherche</label>
          <Input placeholder="Nom, téléphone, email…" value={search} onChange={(e) => setSearch(e.target.value)} className="bo-filter-input" />
        </div>
        <div className="bo-filter-actions">
          <Button variant="outline" size="sm" onClick={resetFilters} className="bo-filter-reset">
            <Filter size={14} strokeWidth={1.7} /> Réinitialiser
          </Button>
          <Button variant="outline" size="sm" onClick={load} className="bo-filter-refresh" aria-label="Rafraîchir">
            <RotateCw size={14} strokeWidth={1.7} />
          </Button>
        </div>
      </section>

      {alert && (
        <p className={`bo-inline-alert bo-inline-alert-${alert.kind}`} role="status">{alert.message}</p>
      )}

      <section className="bo-table-wrap">
        {state === "loading" && <p className="bo-empty">Chargement des réservations…</p>}
        {state === "error" && <p className="bo-empty">Impossible de charger. Vérifie ta connexion.</p>}
        {state === "ready" && filtered.length === 0 && (
          <p className="bo-empty">Aucune réservation ne correspond aux filtres.</p>
        )}
        {state === "ready" && filtered.length > 0 && (
          <Table className="bo-table">
            <TableHeader>
              <TableRow>
                <TableHead>Date · Heure</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Party · Table</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="bo-th-actions">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id} className="bo-tr" onClick={() => setDetail(r)}>
                  <TableCell className="bo-td-date">
                    <span className="bo-td-date-day">{formatDate(r.date)}</span>
                    <span className="bo-td-date-time">{formatTime(r.time)}</span>
                  </TableCell>
                  <TableCell className="bo-td-name">
                    <span className="bo-td-name-line">{displayName(r)}</span>
                    {r.specialRequest && (
                      <span className="bo-td-special" title={r.specialRequest}>
                        <MessageSquare size={11} strokeWidth={1.7} /> Note
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="bo-td-party">
                    <span className="bo-td-party-num">{r.partySize}</span>
                    <span className={`bo-tag bo-tag-${r.tableType === "vip" ? "vip" : "normal"}`}>{r.tableType === "vip" ? "VIP" : "Normal"}</span>
                  </TableCell>
                  <TableCell className="bo-td-contact">
                    {r.phone && <span className="bo-td-contact-line">{r.phone}</span>}
                    {r.email && <span className="bo-td-contact-sub">{r.email}</span>}
                  </TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="bo-td-actions" onClick={(e) => e.stopPropagation()}>
                    {r.status === "requested" && (
                      <>
                        <Button size="sm" className="bo-action-confirm" onClick={() => updateStatus(r, "confirmed")} disabled={actionId === `${r.id}:confirmed`}>
                          <Check size={14} strokeWidth={2} /> Confirmer
                        </Button>
                        <Button size="sm" variant="ghost" className="bo-action-cancel" onClick={() => updateStatus(r, "cancelled")} disabled={actionId === `${r.id}:cancelled`}>
                          <X size={14} strokeWidth={2} /> Refuser
                        </Button>
                      </>
                    )}
                    {r.status === "confirmed" && (
                      <>
                        <Button size="sm" variant="ghost" className="bo-action-complete" onClick={() => updateStatus(r, "completed")} disabled={actionId === `${r.id}:completed`}>
                          <Utensils size={14} strokeWidth={2} /> Terminer
                        </Button>
                        <Button size="sm" variant="ghost" className="bo-action-cancel" onClick={() => updateStatus(r, "cancelled")} disabled={actionId === `${r.id}:cancelled`}>
                          <X size={14} strokeWidth={2} /> Annuler
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="bo-dialog">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="bo-dialog-title">{displayName(detail)}</DialogTitle>
                <DialogDescription className="bo-dialog-desc">
                  Réservation du {formatDate(detail.date)} à {formatTime(detail.time)} — {detail.partySize} couvert{detail.partySize > 1 ? "s" : ""} · {detail.tableType === "vip" ? "Table VIP" : "Table normale"}
                </DialogDescription>
              </DialogHeader>
              <div className="bo-dialog-body">
                <div className="bo-dialog-row">
                  <StatusBadge status={detail.status} />
                </div>
                {detail.phone && (
                  <div className="bo-dialog-line"><Phone size={14} strokeWidth={1.7} /> <a href={`tel:${detail.phone}`}>{detail.phone}</a></div>
                )}
                {detail.email && (
                  <div className="bo-dialog-line"><Mail size={14} strokeWidth={1.7} /> <a href={`mailto:${detail.email}`}>{detail.email}</a></div>
                )}
                {detail.specialRequest && (
                  <div className="bo-dialog-note">
                    <span className="bo-dialog-note-label"><MessageSquare size={13} strokeWidth={1.7} /> Demande spéciale</span>
                    <p>{detail.specialRequest}</p>
                  </div>
                )}
                <div className="bo-dialog-actions">
                  {detail.status === "requested" && (
                    <>
                      <Button className="bo-action-confirm" onClick={() => updateStatus(detail, "confirmed")}>
                        <Check size={14} strokeWidth={2} /> Confirmer
                      </Button>
                      <Button variant="outline" onClick={() => updateStatus(detail, "cancelled")}>Refuser</Button>
                    </>
                  )}
                  {detail.status === "confirmed" && (
                    <>
                      <Button variant="outline" onClick={() => updateStatus(detail, "completed")}>Marquer terminée</Button>
                      <Button variant="outline" onClick={() => updateStatus(detail, "cancelled")}>Annuler</Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
