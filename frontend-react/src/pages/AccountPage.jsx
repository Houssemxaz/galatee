import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Clock3, LogOut, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Reveal from "@/components/Reveal";
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

export function CustomerAccessForm() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { createAccount, login } = useCustomerAuth();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", email: "", residenceCommune: "", password: "", passwordConfirm: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm((current) => ({ ...current, password: "", passwordConfirm: "" }));
    setError("");
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
    if (mode === "signup" && form.password !== form.passwordConfirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    try {
      if (mode === "signup") await createAccount(form);
      else await login({ email: form.email, password: form.password });
      navigate("/compte", { replace: true });
    } catch (submitError) {
      setError(errorMessage(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="account-access-panel">
      <form className="account-form" onSubmit={submit}>
        <div className="account-form-progress"><span className="is-active">{mode === "signup" ? "01 · Créer votre compte" : "01 · Se connecter"}</span></div>
        {mode === "signup" && <div className="account-form-row"><div className="account-field"><Label htmlFor="account-first-name">Prénom</Label><Input id="account-first-name" value={form.firstName} onChange={(event) => update("firstName", event.target.value)} autoComplete="given-name" required /></div><div className="account-field"><Label htmlFor="account-last-name">Nom</Label><Input id="account-last-name" value={form.lastName} onChange={(event) => update("lastName", event.target.value)} autoComplete="family-name" required /></div></div>}
        {mode === "signup" && <div className="account-field"><Label htmlFor="account-phone">Téléphone</Label><Input id="account-phone" type="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="tel" required /></div>}
        {mode === "signup" && <div className="account-field"><Label htmlFor="account-residence">Commune de résidence</Label><Input id="account-residence" value={form.residenceCommune} onChange={(event) => update("residenceCommune", event.target.value)} autoComplete="address-level2" required /></div>}
        <div className="account-field"><Label htmlFor="account-email">Email</Label><Input id="account-email" type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" required /></div>
        <div className="account-field"><Label htmlFor="account-password">Mot de passe</Label><Input id="account-password" type="password" value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={8} required /></div>
        {mode === "signup" && <div className="account-field"><Label htmlFor="account-password-confirm">Confirmer le mot de passe</Label><Input id="account-password-confirm" type="password" value={form.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value)} autoComplete="new-password" minLength={8} required /></div>}
        {error && <p className="account-form-error" role="alert">{error}</p>}
        <Button className="action-button action-button-full account-submit" type="submit" disabled={submitting}><span>{submitting ? "Connexion en cours" : mode === "signup" ? "Créer mon compte" : "Se connecter"}</span>{mode === "signup" ? <ArrowUpRight size={16} /> : <Check size={16} />}</Button>
        <p className="account-switch">{mode === "signup" ? "Vous avez déjà un compte ?" : "Première visite ?"} <button type="button" onClick={() => switchMode(mode === "signup" ? "login" : "signup")}>{mode === "signup" ? "Se connecter" : "Créer un compte"}</button></p>
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

function OrderRow({ order }) {
  const itemSummary = order.items?.map((item) => `${item.quantity} × ${item.title}`).join(", ");
  return (
    <article className="account-reservation-row">
      <div className="account-reservation-date"><span>{new Date(order.createdAt).toLocaleDateString("fr-FR")}</span></div>
      <div className="account-reservation-main"><h3>{order.deliveryMode === "delivery" ? `Livraison · ${order.communeName}` : "Retrait chez Galatee"}</h3><p>{itemSummary}</p></div>
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
      <div className="page page-account pbg-page pbg-page-cream">
        <section className="pbg-page-header">
          <div className="pbg-page-shell">
            <p className="pbg-page-kicker"><span>L'espace Galatee</span></p>
            <h1 className="pbg-page-title">{mode === "signup" ? <>Gardons votre<br /><em>soirée en mémoire.</em></> : <>Retrouver<br /><em>votre table.</em></>}</h1>
            <p className="pbg-page-lede">Créez un accès personnel pour retrouver vos commandes et préremplir vos prochaines commandes.</p>
            <div className="mobile-intro-facts" aria-hidden="true"><span><small>Compte</small><strong>Facultatif</strong></span><span><small>Demandes</small><strong>Retrouvées</strong></span><span><small>Coordonnées</small><strong>Conservées</strong></span></div>
            <div className="mobile-screen-guide" aria-hidden="true"><span>01 / 03</span><i /><span>Votre accès commence ici</span></div>
          </div>
        </section>
        <section className="page-shell account-access-layout">
          <Reveal className="account-side-panel">
            <div className="reservation-emblem" aria-hidden="true">G</div>
            <p className="account-side-tag">L'espace Galatee</p>
            <ul className="account-side-list">
              <li><span><UserRound size={13} strokeWidth={1.7} /></span><b>Coordonnées</b><em> conservées</em></li>
              <li><span><Clock3 size={13} strokeWidth={1.7} /></span><b>Commandes</b><em> en cours</em></li>
              <li><span><Mail size={13} strokeWidth={1.7} /></span><b>Historique</b><em> conservé</em></li>
            </ul>
            <Link className="text-link account-side-alt" to="/commande">Commander sans compte <ArrowUpRight size={13} /></Link>
          </Reveal>
          <Reveal delay={100}>
            <CustomerAccessForm />
          </Reveal>
        </section>
      </div>
    );
  }

  return (
    <div className="page page-account pbg-page pbg-page-cream page-account-member">
      <section className="pbg-page-header">
        <div className="pbg-page-shell">
          <p className="pbg-page-kicker"><span>Votre espace Galatee</span></p>
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
          {loyalty?.settings?.active && <div className="account-loyalty-card"><div className="account-loyalty-heading"><span>Programme fidélité</span><strong>{loyalty.qualifyingOrders} commande{loyalty.qualifyingOrders > 1 ? "s" : ""}</strong></div><p>{loyalty.rewardAvailable ? loyalty.rewardAvailable.title : `${loyalty.ordersToNextReward} commande${loyalty.ordersToNextReward > 1 ? "s" : ""} avant votre récompense`}</p><div className="account-loyalty-track" aria-hidden="true"><span style={{ width: `${loyalty.rewardAvailable ? 100 : Math.min(100, (loyalty.progressInCycle / loyalty.settings.threshold) * 100)}%` }} /></div></div>}
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
    </div>
  );
}
