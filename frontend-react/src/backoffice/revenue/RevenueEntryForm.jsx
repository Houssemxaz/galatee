import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, apiMessage } from "../api";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function RevenueEntryForm({ onSaved }) {
  const [form, setForm] = useState({ date: today(), amount: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const { revenue } = await apiRequest("/admin/revenue", {
        method: "PUT",
        body: JSON.stringify({ date: form.date, amount: form.amount, note: form.note }),
      });
      setForm({ date: today(), amount: "", note: "" });
      onSaved(revenue);
    } catch (submitError) {
      setError(apiMessage(submitError, "La saisie n'a pas pu être enregistrée."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="bo-form bo-inline-form" onSubmit={submit}>
      <div className="bo-field-group">
        <Label htmlFor="rev-date">Date</Label>
        <Input id="rev-date" type="date" value={form.date} onChange={(event) => update("date", event.target.value)} required />
      </div>
      <div className="bo-field-group">
        <Label htmlFor="rev-amount">Montant (DZD)</Label>
        <Input id="rev-amount" inputMode="decimal" placeholder="12500" value={form.amount} onChange={(event) => update("amount", event.target.value)} required />
      </div>
      <div className="bo-field-group bo-field-grow">
        <Label htmlFor="rev-note">Note</Label>
        <Input id="rev-note" placeholder="Optionnel" value={form.note} onChange={(event) => update("note", event.target.value)} />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</Button>
      {error && <p className="bo-form-error" role="alert">{error}</p>}
    </form>
  );
}
