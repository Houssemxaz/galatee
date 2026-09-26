import { useState } from "react";
import { Bike, ArrowRight } from "lucide-react";
import { driverLogin } from "./api";

export default function DriverLoginPage({ onLoggedIn }) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await driverLogin({ phone, pin });
      onLoggedIn();
    } catch (err) {
      setError(err.message || "Impossible de se connecter.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pbg-drv-login">
      <div className="pbg-drv-login-brand">
        <span className="pbg-drv-login-icon" aria-hidden="true"><Bike size={28} strokeWidth={1.6} /></span>
        <p className="pbg-drv-login-eyebrow">Pasta by Galatée</p>
        <h1>Espace livreur</h1>
        <p className="pbg-drv-login-hint">Connectez-vous avec le téléphone et le code fournis par le restaurant.</p>
      </div>

      <form className="pbg-drv-login-form" onSubmit={submit}>
        <label>
          <span>Téléphone</span>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+213555000000"
            required
          />
        </label>
        <label>
          <span>Code PIN</span>
          <input
            type="password"
            inputMode="numeric"
            pattern="[0-9]{4,8}"
            maxLength={8}
            autoComplete="current-password"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="••••"
            required
          />
        </label>
        {error && <p className="pbg-drv-alert pbg-drv-alert-error" role="alert">{error}</p>}
        <button type="submit" className="pbg-drv-btn pbg-drv-btn-primary" disabled={submitting || pin.length < 4}>
          <span>{submitting ? "Connexion…" : "Se connecter"}</span>
          {!submitting && <ArrowRight size={18} strokeWidth={2} />}
        </button>
      </form>

      <p className="pbg-drv-login-footnote">Code oublié ? Demandez au patron de le réinitialiser.</p>
    </div>
  );
}
