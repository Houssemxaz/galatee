import { useState } from "react";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, apiMessage } from "../api";

export default function RevenueEntriesTable({ entries, onChanged }) {
  const [editingDate, setEditingDate] = useState(null);
  const [draft, setDraft] = useState({ amount: "", note: "" });
  const [busyDate, setBusyDate] = useState(null);
  const [error, setError] = useState("");

  function startEdit(entry) {
    setEditingDate(entry.date);
    setDraft({ amount: entry.amount, note: entry.note || "" });
  }

  async function saveEdit(entry) {
    setBusyDate(entry.date);
    setError("");
    try {
      const { revenue } = await apiRequest("/admin/revenue", {
        method: "PUT",
        body: JSON.stringify({ date: entry.date, amount: draft.amount, note: draft.note }),
      });
      onChanged(revenue);
      setEditingDate(null);
    } catch (saveError) {
      setError(apiMessage(saveError, "La modification a échoué."));
    } finally {
      setBusyDate(null);
    }
  }

  async function remove(entry) {
    setBusyDate(entry.date);
    setError("");
    try {
      await apiRequest(`/admin/revenue/${encodeURIComponent(entry.date)}`, { method: "DELETE" });
      onChanged({ date: entry.date, deleted: true });
    } catch (removeError) {
      setError(apiMessage(removeError, "La suppression a échoué."));
    } finally {
      setBusyDate(null);
    }
  }

  if (!entries.length) {
    return <p className="bo-empty">Aucune saisie pour cette période.</p>;
  }

  return (
    <div className="bo-table-wrap">
      {error && <p className="bo-form-error" role="alert">{error}</p>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Montant</TableHead>
            <TableHead>Note</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => {
            const editing = editingDate === entry.date;
            const busy = busyDate === entry.date;
            return (
              <TableRow key={entry.date}>
                <TableCell>{entry.date}</TableCell>
                <TableCell>
                  {editing ? (
                    <Input value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: event.target.value }))} className="bo-inline-input" />
                  ) : (
                    `${entry.amount} ${entry.currency}`
                  )}
                </TableCell>
                <TableCell>
                  {editing ? (
                    <Input value={draft.note} onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} className="bo-inline-input" />
                  ) : (
                    entry.note || "—"
                  )}
                </TableCell>
                <TableCell>
                  <div className="bo-row-actions">
                    {editing ? (
                      <>
                        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => saveEdit(entry)}>Enregistrer</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setEditingDate(null)}>Annuler</Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(entry)}>Modifier</Button>
                        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => remove(entry)}>Supprimer</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
