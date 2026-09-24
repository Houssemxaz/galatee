import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock3, LogOut, Mail, MapPin, Phone, UserRound, UserPlus } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Reveal from "@/components/Reveal";
import GlowCard from "@/components/GlowCard";
import ShineCTA from "@/components/ShineCTA";
import SEO from "@/components/SEO";
import { Link004 } from "@/components/ui/skiper-ui/skiper40";
import { fetchCustomerOrders } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import useCountUp from "@/hooks/useCountUp";

const ORDER_STATUS_LABELS = {
  pending: "À confirmer",
  confirmed: "Confirmée",
  cancelled: "Annulée",
  preparing: "En préparation",
  ready: "Prête",
  delivered: "Livrée",
  withdrawn: "Retirée",
  completed: "Terminée",
};

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

function AccountStats({ upcoming, total, deliveries }) {
  const upCount = useCountUp(upcoming, { duration: 900, delay: 120 });
  const totalCount = useCountUp(total, { duration: 900, delay: 220 });
  const delivCount = useCountUp(deliveries, { duration: 900, delay: 320 });
  return (
    <div className="account-profile-stats" aria-hidden="true">
      <div><span>En cours</span><strong>{upCount}</strong></div>
      <div><span>Total</span><strong>{totalCount}</strong></div>
      <div><span>Livraisons</span><strong>{delivCount}</strong></div>
    </div>
  );
}

function OrdersSummary({ upcoming, delivered, total }) {
  const upCount = useCountUp(upcoming, { duration: 900, delay: 100 });
  const delivCount = useCountUp(delivered, { duration: 900, delay: 200 });
  const totalCount = useCountUp(total, { duration: 900, delay: 300 });
  return (
    <div className="account-orders-summary">
      <div><span>En cours</span><strong>{upCount}</strong></div>
      <i />
      <div><span>Livrées</span><strong>{delivCount}</strong></div>
      <i />
      <div><span>Total</span><strong>{totalCount}</strong></div>
    </div>
  );
}

const ORDER_STEPS = [
  { key: "pending", label: "Reçue" },
  { key: "confirmed", label: "Confirmée" },
  { key: "preparing", label: "En prépa" },
  { key: "ready", label: "Prête" },
  { key: "delivered", label: "Livrée" },
];
const DELIVERED_KEYS = new Set(["delivered", "withdrawn", "completed"]);

function OrderTimeline({ status }) {
  const isCancelled = status === "cancelled";
  const currentIndex = isCancelled
    ? -1
    : DELIVERED_KEYS.has(status)
      ? ORDER_STEPS.length - 1
      : ORDER_STEPS.findIndex((s) => s.key === status);
  return (
    <ol className={`order-timeline ${isCancelled ? "is-cancelled" : ""}`} aria-label="Progression de la commande">
      {ORDER_STEPS.map((step, i) => {
        const done = !isCancelled && i <= currentIndex;
        const active = !isCancelled && i === currentIndex;
        return (
          <li key={step.key} className={`order-timeline-step ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}>
            <span className="order-timeline-dot" aria-hidden="true" />
            <span className="order-timeline-label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderRow({ order }) {
  const itemSummary = order.items?.map((item) => `${item.quantity} × ${item.title}`).join(", ");
  return (
    <article className="account-reservation-row">
      <div className="account-reservation-date"><span>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span></div>
      <div className="account-reservation-main">
        <h3>{order.deliveryMode === "delivery" ? `Livraison · ${order.communeName}` : "Retrait chez Galatée"}</h3>
        <p>{itemSummary}</p>
        <OrderTimeline status={order.status} />
      </div>
      <span className={`account-status account-status-${order.status}`}>{ORDER_STATUS_LABELS[order.status] || order.status}</span>
    </article>
  );
}

export default function AccountPage() {
  const { account, loading, logout } = useCustomerAuth();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [orders, setOrders] = useState([]);
  const [loyalty, setLoyalty] = useState(null);
  const [orderState, setOrderState] = useState("idle");

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    setOrderState("loading");
    fetchCustomerOrders()
      .then((payload) => { if (!cancelled) { setOrders(payload.orders || []); setLoyalty(payload.loyalty || null); setOrderState("ready"); } })
      .catch(() => { if (!cancelled) setOrderState("error"); });
    return () => { cancelled = true; };
  }, [account]);

  const upcoming = useMemo(() => orders.filter((order) => !["cancelled", "completed"].includes(order.status)), [orders]);
  const past = useMemo(() => orders.filter((order) => !upcoming.includes(order)), [orders, upcoming]);

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
    <div className="page page-account pbg-page pbg-page-cream page-account-member">
      <SEO
        title="Mon espace client"
        description="Retrouvez vos commandes, votre programme fidélité et vos coordonnées Pasta by Galatée."
        path="/compte"
        noIndex
      />
      <section className="pbg-page-header">
        <div className="pbg-page-shell">
          <p className="pbg-page-kicker"><span>Votre espace Galatée</span></p>
          <h1 className="pbg-page-title">Bonjour,<br /><em>{account.firstName}.</em></h1>
          <p className="pbg-page-lede">Retrouvez vos coordonnées et le fil de vos commandes.</p>
        </div>
      </section>
      <section className="page-shell account-member-layout">
        <Reveal className="account-profile">
          <p className="account-side-tag">Votre carnet</p>
          <h2 className="account-profile-name">{account.firstName} {account.lastName}</h2>
          <AccountStats
            upcoming={upcoming.length}
            total={orders.length}
            deliveries={orders.filter((o) => o.deliveryMode === "delivery").length}
          />
          <ul className="account-profile-contacts">
            <li>
              <span className="account-contact-icon"><Mail size={14} strokeWidth={1.8} /></span>
              <div><small>Email</small><strong>{account.email}</strong></div>
            </li>
            <li>
              <span className="account-contact-icon"><Phone size={14} strokeWidth={1.8} /></span>
              <div><small>Téléphone</small><strong>{account.phone}</strong></div>
            </li>
            <li>
              <span className="account-contact-icon"><MapPin size={14} strokeWidth={1.8} /></span>
              <div><small>Résidence</small><strong>{account.residenceCommune || "Non renseignée"}</strong></div>
            </li>
          </ul>
          <p className="account-profile-note">Vos coordonnées sont proposées automatiquement lors de votre prochaine commande.</p>
          {loyalty?.settings?.active && (loyalty.rewardAvailable
            ? <GlowCard className="account-loyalty-card"><div className="account-loyalty-heading"><span>Programme fidélité</span><strong>{loyalty.qualifyingOrders} commande{loyalty.qualifyingOrders > 1 ? "s" : ""}</strong></div><p>{loyalty.rewardAvailable.title}</p><div className="account-loyalty-track" aria-hidden="true"><span style={{ width: "100%" }} /></div></GlowCard>
            : <div className="account-loyalty-card"><div className="account-loyalty-heading"><span>Programme fidélité</span><strong>{loyalty.qualifyingOrders} commande{loyalty.qualifyingOrders > 1 ? "s" : ""}</strong></div><p>{loyalty.ordersToNextReward} commande{loyalty.ordersToNextReward > 1 ? "s" : ""} avant votre récompense</p><div className="account-loyalty-track" aria-hidden="true"><span style={{ width: `${Math.min(100, (loyalty.progressInCycle / loyalty.settings.threshold) * 100)}%` }} /></div></div>
          )}
          <button type="button" className="account-logout" onClick={logout}><LogOut size={13} strokeWidth={1.7} /> Se déconnecter</button>
        </Reveal>
        <Reveal className="account-reservations" delay={100}>
          <div className="account-section-heading">
            <div>
              <p className="account-side-tag">Vos commandes</p>
              <h2 className="account-reservations-title">Le fil de vos commandes.</h2>
            </div>
            <Link className="action-button account-new-reservation" to="/commande">Nouvelle commande <ArrowUpRight size={14} /></Link>
          </div>
          {orderState === "ready" && orders.length > 0 && (
            <OrdersSummary
              upcoming={upcoming.length}
              delivered={orders.filter((o) => ["delivered", "withdrawn", "completed"].includes(o.status)).length}
              total={orders.length}
            />
          )}
          {orderState === "loading" && <p className="account-state">Chargement de vos commandes...</p>}
          {orderState === "error" && <p className="account-state account-state-error">Impossible de charger vos commandes pour le moment.</p>}
          {orderState === "ready" && !orders.length && (
            <div className="account-empty">
              <Clock3 size={22} strokeWidth={1.5} />
              <h3>Votre carnet est encore ouvert.</h3>
              <p>Votre prochaine commande à Hydra commence par un plat.</p>
              <Link className="text-link" to="/commande">Passer une commande <ArrowUpRight size={14} /></Link>
            </div>
          )}
          {upcoming.length > 0 && <div className="account-reservation-group"><p className="account-group-label">En cours</p>{upcoming.map((order) => <OrderRow key={order.id} order={order} />)}</div>}
          {past.length > 0 && <div className="account-reservation-group"><p className="account-group-label">Historique</p>{past.map((order) => <OrderRow key={order.id} order={order} />)}</div>}
        </Reveal>
      </section>

      <section className="pbg-section pbg-section-bordeaux pbg-account-club">
        <div className="pbg-page-shell">
          <div className="pbg-section-index pbg-section-index-light">
            <span>+</span><i />Pasta Lover Club
          </div>
          <h2 className="pbg-section-title pbg-section-title-light">
            Chaque plat,
            <br /><em>une récompense.</em>
          </h2>
          <p className="pbg-section-lede pbg-section-lede-light">
            Tous les 10 plats commandés, un dessert offert. Toutes les 5 commandes livrées, la prochaine livraison est offerte. Bientôt : cadeaux d'anniversaire et surprises maison.
          </p>
          <div className="pbg-account-club-actions">
            <Link to="/pasta-lover-club" className="pbg-btn pbg-btn-light">
              <span>Découvrir le club</span>
              <ArrowUpRight size={16} strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
