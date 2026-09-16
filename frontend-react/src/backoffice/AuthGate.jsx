import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getToken, setToken } from "./api";

export default function AuthGate({ onTokenChange }) {
  const [draft, setDraft] = useState(getToken());
  const [saved, setSaved] = useState(Boolean(getToken()));

  function submit(event) {
    event.preventDefault();
    setToken(draft);
    setSaved(Boolean(draft.trim()));
    onTokenChange(draft.trim());
  }

  function clear() {
    setToken("");
    setDraft("");
    setSaved(false);
    onTokenChange("");
  }

  return (
    <section className="bo-auth-strip">
      <div>
        <p className="bo-eyebrow">Session</p>
        <h2>Connexion de service</h2>
        <p className="bo-auth-copy">Le token reste uniquement dans cette session de navigateur. Sans token configuré côté serveur, l'accès local reste ouvert.</p>
      </div>
      <form className="bo-auth-form" onSubmit={submit}>
        <Label htmlFor="bo-admin-token">Token admin optionnel</Label>
        <div className="bo-auth-row">
          <Input id="bo-admin-token" name="adminToken" type="password" autoComplete="off" placeholder="GALATEE_ADMIN_TOKEN" value={draft} onChange={(event) => setDraft(event.target.value)} />
          <Button type="submit">Enregistrer</Button>
          <Button type="button" variant="outline" onClick={clear}>Effacer</Button>
        </div>
        <p className="bo-auth-status">{saved ? "Token enregistré pour cette session." : "Mode local sans token."}</p>
      </form>
    </section>
  );
}
