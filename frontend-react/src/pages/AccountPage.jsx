import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Gift, LogOut, Mail, MapPin, Phone, Sparkles, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Reveal from "@/components/Reveal";
import ShineCTA from "@/components/ShineCTA";
import SEO from "@/components/SEO";
import { Link004 } from "@/components/ui/skiper-ui/skiper40";
import { fetchCustomerOrders } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";

function errorMessage(error) {
  if (error?.code === "AUTH_CODE_TOO_SOON") return "Un code vient déjà d'être envoyé. Patientez une minute avant de recommencer.";
  if (error?.code === "AUTH_ACCOUNT_EXISTS") return "Un compte existe déjà avec cet email. Connectez-vous plutôt.";
  if (error?.code === "AUTH_INVALID_CREDENTIALS") return "Email ou mot de passe incorrect.";
  if (error?.code === "AUTH_RESIDENCE_REQUIRED") return "Indiquez votre commune de résidence.";
  if (error?.code === "AUTH_PASSWORD_INVALID") return "Le mot de passe doit contenir au moins 8 caractères.";
  if (error?.code === "AUTH_EMAIL_NOT_CONFIGURED") return "La connexion par email sera bientôt disponible. Contactez directement le restaurant.";
  return error?.message || "Une erreur est survenue. Réessayez dans un instant.";
}

const SUBMIT_LABELS = {
  signup: "Créer mon compte",
  login: "Se connecter",
  forgot: "Envoyer le code",
  reset: "Réinitialiser le mot de passe",
};

export function CustomerAccessForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { createAccount, login, requestPasswordReset, confirmPasswordReset } = useCustomerAuth();
  const rawMode = searchParams.get("mode");
  const mode = ["signup", "forgot", "reset"].includes(rawMode) ? rawMode : "login";
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", residenceCommune: "", password: "", passwordConfirm: "", code: "" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, password: "", passwordConfirm: "", code: "" }));
    setError("");
    // Keep the neutral confirmation visible on the reset screen after the switch
    // from "forgot"; clear it everywhere else so a stale message never lingers.
    if (mode !== "reset") setInfo("");
  }, [mode]);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function switchMode(nextMode) {
    setSearchParams({ mode: nextMode });
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    if ((mode === "signup" || mode === "reset") && form.password !== form.passwordConfirm) {
      setError("Les mots de passe ne correspondent pas."); return;
    }
    setSubmitting(true);
    try {
      if (mode === "signup") { await createAccount(form); navigate("/compte", { replace: true }); }
      else if (mode === "login") { await login({ email: form.email, password: form.password }); navigate("/compte", { replace: true }); }
      else if (mode === "forgot") {
        // Enumeration protection: same 202 whether or not the email matches.
        try { await requestPasswordReset({ email: form.email }); } catch { /* intentionally silent */ }
        setInfo("Si un compte correspond à cette adresse, un code de réinitialisation a été envoyé. Vérifiez votre boîte mail.");
        setSearchParams({ mode: "reset" });
      }
      else if (mode === "reset") {
        await confirmPasswordReset({ email: form.email, code: form.code, newPassword: form.password });
        navigate("/compte", { replace: true });
      }
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  const isRecoveryMode = mode === "forgot" || mode === "reset";
  const showsIdentity = mode === "signup";
  const showsEmail = true;
  const showsCode = mode === "reset";
  const showsPassword = mode === "signup" || mode === "login" || mode === "reset";
  const showsPasswordConfirm = mode === "signup" || mode === "reset";
  const passwordLabel = mode === "reset" ? "Nouveau mot de passe" : "Mot de passe";
  const passwordConfirmLabel = mode === "reset" ? "Confirmer le nouveau mot de passe" : "Confirmer le mot de passe";

  return (
    <div className="account-access-panel">
      <header className="account-access-head">
        <p className="account-access-eyebrow">Espace client</p>
        <h1 className="account-access-headline">Votre espace.</h1>
      </header>

      <div className="account-access-promo">
        <span className="account-access-promo-icon" aria-hidden="true">🎁</span>
        <p><b>10 commandes = 1 récompense.</b> Votre compte démarre le compteur.</p>
      </div>

      {!isRecoveryMode && (
        <div className="account-mode-tabs" role="tablist" aria-label="Mode d'accès">
          <button
            role="tab"
            type="button"
            aria-selected={mode === "login"}
            className={`account-mode-tab ${mode === "login" ? "is-active" : ""}`}
            onClick={() => switchMode("login")}
          >
            <Check size={14} strokeWidth={2.2} />
            <span>Se connecter</span>
          </button>
          <button
            role="tab"
            type="button"
            aria-selected={mode === "signup"}
            className={`account-mode-tab ${mode === "signup" ? "is-active" : ""}`}
            onClick={() => switchMode("signup")}
          >
            <UserPlus size={14} strokeWidth={2} />
            <span>Créer un compte</span>
          </button>
        </div>
      )}

      {isRecoveryMode && (
        <p className="account-recovery-eyebrow">
          {mode === "forgot" ? "01 · Mot de passe oublié" : "02 · Nouveau mot de passe"}
        </p>
      )}

      <form className="account-form" onSubmit={submit}>
        {showsIdentity && (
          <div className="account-form-row">
            <div className="account-field">
              <Label htmlFor="account-first-name">Prénom</Label>
              <Input id="account-first-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" required />
            </div>
            <div className="account-field">
              <Label htmlFor="account-last-name">Nom</Label>
              <Input id="account-last-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" required />
            </div>
          </div>
        )}
        {showsIdentity && (
          <div className="account-form-row">
            <div className="account-field">
              <Label htmlFor="account-phone">Téléphone</Label>
              <Input id="account-phone" type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" required />
            </div>
            <div className="account-field">
              <Label htmlFor="account-residence">Commune de résidence</Label>
              <Input id="account-residence" value={form.residenceCommune} onChange={(event) => update("residenceCommune", event.target.value)} autoComplete="address-level2" required />
            </div>
          </div>
        )}
        {showsEmail && (
          <div className="account-field">
            <Label htmlFor="account-email">Email</Label>
            <Input id="account-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required />
          </div>
        )}
        {showsCode && (
          <div className="account-field">
            <Label htmlFor="account-code">Code reçu par email</Label>
            <Input id="account-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={form.code} onChange={(event) => update("code", event.target.value.replace(/\D/g, ""))} autoComplete="one-time-code" required />
          </div>
        )}
        {showsPassword && (
          <div className="account-field">
            <Label htmlFor="account-password">{passwordLabel}</Label>
            <Input id="account-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} required />
          </div>
        )}
        {showsPasswordConfirm && (
          <div className="account-field">
            <Label htmlFor="account-password-confirm">{passwordConfirmLabel}</Label>
            <Input id="account-password-confirm" type="password" value={form.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value)} autoComplete="new-password" minLength={8} required />
          </div>
        )}
        {info && <p className="account-form-notice" role="status">{info}</p>}
        {error && <p className="account-form-error" role="alert">{error}</p>}

        <ShineCTA className="pbg-btn pbg-btn-primary account-submit" type="submit" disabled={submitting}>
          <span>{submitting ? "En cours…" : SUBMIT_LABELS[mode]}</span>
          {mode === "login" || mode === "reset" ? <Check size={16} /> : <ArrowUpRight size={16} />}
        </ShineCTA>

        {mode === "login" && (
          <p className="account-switch">
            <button type="button" onClick={() => switchMode("forgot")} className="account-switch-link">Mot de passe oublié ?</button>
          </p>
        )}
        {(mode === "login" || mode === "signup") && (
          <p className="account-switch">
            {mode === "signup" ? "Vous avez déjà un compte ?" : "Première visite ?"}
            {" "}
            <Link004 as="button" type="button" onClick={() => switchMode(mode === "signup" ? "login" : "signup")} className="account-switch-link">
              {mode === "signup" ? "Se connecter" : "Créer un compte"}
            </Link004>
          </p>
        )}
        {isRecoveryMode && (
          <p className="account-switch">
            Vous vous en souvenez ?{" "}
            <button type="button" onClick={() => switchMode("login")} className="account-switch-link">Revenir à la connexion</button>
          </p>
        )}
      </form>
    </div>
  );
}

function LoyaltyMini({ loyalty }) {
  if (!loyalty?.settings?.active) return null;
  const threshold = loyalty.settings.threshold || 10;
  const progress = loyalty.progressInCycle || 0;
  const remaining = loyalty.ordersToNextReward || 0;
  const percent = Math.min(100, (progress / threshold) * 100);
  const reward = loyalty.rewardAvailable;

  return (
    <div className={`pbg-carnet-loyalty ${reward ? "is-reward" : ""}`}>
      <div className="pbg-carnet-loyalty-head">
        <span className="pbg-carnet-loyalty-icon" aria-hidden="true">
          {reward ? <Gift size={16} strokeWidth={1.7} /> : <Sparkles size={16} strokeWidth={1.7} />}
        </span>
        <span className="pbg-carnet-loyalty-eyebrow">Programme fidélité</span>
      </div>
      <p className="pbg-carnet-loyalty-text">
        {reward
          ? reward.title
          : <>Plus que <strong>{remaining} commande{remaining > 1 ? "s" : ""}</strong> avant votre promo.</>}
      </p>
      <div className="pbg-carnet-loyalty-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <p className="pbg-carnet-loyalty-count">{progress} / {threshold} commandes</p>
    </div>
  );
}

export default function AccountPage() {
  const { account, loading, logout } = useCustomerAuth();
  const [loyalty, setLoyalty] = useState(null);

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    fetchCustomerOrders()
      .then((payload) => { if (!cancelled) setLoyalty(payload.loyalty || null); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [account]);

  if (loading) return <div className="page page-account pbg-page pbg-page-cream"><div className="pbg-page-shell account-loading">Chargement de votre espace…</div></div>;

  if (!account) {
    return (
      <div className="page page-account page-account-access">
        <SEO
          title="Espace client — Connexion ou création de compte"
          description="Connectez-vous ou créez votre compte Pasta by Galatée pour retrouver vos commandes et démarrer votre programme fidélité."
          path="/compte"
          noIndex
        />
        <section className="account-access-section">
          <div className="pbg-page-shell account-access-wrap">
            <Reveal>
              <CustomerAccessForm />
            </Reveal>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page pbg-page pbg-account-page">
      <SEO
        title="Mon espace client"
        description="Retrouvez vos coordonnées et votre programme fidélité Pasta by Galatée."
        path="/compte"
        noIndex
      />

      <section className="pbg-account-hero">
        <div className="pbg-page-shell">
          <Reveal>
            <p className="pbg-account-eyebrow">Votre espace Galatée</p>
            <h1 className="pbg-account-title">
              Bonjour,<br /><em>{account.firstName}.</em>
            </h1>
            <p className="pbg-account-lede">Votre carnet est prêt. Commandez quand vous voulez.</p>
          </Reveal>
        </div>
      </section>

      <section className="pbg-account-body">
        <div className="pbg-page-shell">
          <Reveal className="pbg-carnet-card">
            <div className="pbg-carnet-head">
              <p className="pbg-carnet-eyebrow">Votre carnet</p>
              <h2 className="pbg-carnet-name">{account.firstName} {account.lastName}</h2>
            </div>

            <ul className="pbg-carnet-contacts">
              <li>
                <span className="pbg-carnet-icon"><Mail size={15} strokeWidth={1.7} /></span>
                <div><small>Email</small><strong>{account.email}</strong></div>
              </li>
              <li>
                <span className="pbg-carnet-icon"><Phone size={15} strokeWidth={1.7} /></span>
                <div><small>Téléphone</small><strong>{account.phone}</strong></div>
              </li>
              <li>
                <span className="pbg-carnet-icon"><MapPin size={15} strokeWidth={1.7} /></span>
                <div><small>Résidence</small><strong>{account.residenceCommune || "Non renseignée"}</strong></div>
              </li>
            </ul>

            <LoyaltyMini loyalty={loyalty} />

            <div className="pbg-carnet-actions">
              <Link to="/compte/commandes" className="pbg-btn pbg-btn-primary pbg-carnet-cta">
                <span>Mes commandes</span>
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </Link>
              <Link to="/commande" className="pbg-carnet-secondary">
                <span>Nouvelle commande</span>
                <ArrowUpRight size={14} strokeWidth={1.8} />
              </Link>
            </div>

            <button type="button" className="pbg-carnet-logout" onClick={logout}>
              <LogOut size={13} strokeWidth={1.7} /> Se déconnecter
            </button>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
