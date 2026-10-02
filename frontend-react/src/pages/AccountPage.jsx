import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, Check, Gift, LogOut, Mail, MapPin, Phone, Sparkles, UserPlus,
  UtensilsCrossed, ClipboardList, ShoppingBag, HeartHandshake, Repeat2, Utensils,
  Calendar, User, ShieldCheck,
} from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Reveal from "@/components/Reveal";
import ShineCTA from "@/components/ShineCTA";
import SEO from "@/components/SEO";
import { Link004 } from "@/components/ui/skiper-ui/skiper40";
import { fetchCustomerOrders } from "@/lib/api";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useCart } from "@/context/CartContext";

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

function MemberBadge({ account, loyalty, orders }) {
  const memberSince = account.createdAt
    ? new Date(account.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;
  const qualifyingOrders = loyalty?.qualifyingOrders ?? orders.length;
  const reward = loyalty?.rewardAvailable;
  const remaining = loyalty?.ordersToNextReward ?? 0;

  return (
    <div className={`pbg-member-badge ${reward ? "is-reward" : ""}`}>
      <div className="pbg-member-badge-glow" aria-hidden="true" />

      <div className="pbg-member-badge-head">
        <span className="pbg-member-badge-stamp" aria-hidden="true">
          <Gift size={22} strokeWidth={1.5} />
        </span>
        <div>
          <p className="pbg-member-badge-eyebrow">Carte membre</p>
          <h2 className="pbg-member-badge-name">{account.firstName}</h2>
        </div>
      </div>

      {memberSince && (
        <p className="pbg-member-badge-since">
          <Calendar size={12} strokeWidth={2} />
          <span>Membre depuis {memberSince}</span>
        </p>
      )}

      <div className="pbg-member-badge-stats">
        <div>
          <span>Commandes</span>
          <strong>{qualifyingOrders}</strong>
        </div>
        <i />
        <div>
          <span>Fidélité</span>
          <strong>
            {reward
              ? "Débloquée"
              : remaining === 0
                ? "—"
                : `${remaining} restants`}
          </strong>
        </div>
      </div>

      <p className="pbg-member-badge-signature">Pasta. Music. Memories.</p>
    </div>
  );
}

function StampPreview({ loyalty }) {
  if (!loyalty?.settings?.active) return null;
  const threshold = loyalty.settings.threshold || 10;
  const reward = loyalty.rewardAvailable;
  const progress = reward ? threshold : Math.min(threshold, loyalty.progressInCycle || 0);
  const remaining = Math.max(0, threshold - progress);
  const stamps = Array.from({ length: threshold }, (_, i) => i < progress);

  return (
    <article className={`pbg-aside-card pbg-aside-stamps ${reward ? "is-reward" : ""}`}>
      <div className="pbg-aside-head">
        <span className="pbg-aside-icon-round" aria-hidden="true">
          {reward ? <Gift size={16} strokeWidth={1.7} /> : <Sparkles size={16} strokeWidth={1.7} />}
        </span>
        <div>
          <p className="pbg-aside-eyebrow">Programme fidélité</p>
          <h3 className="pbg-aside-title">
            {reward
              ? "Récompense débloquée"
              : progress === 0
                ? "Chaque plat compte"
                : `${remaining} plat${remaining > 1 ? "s" : ""} avant la promo`}
          </h3>
        </div>
      </div>
      <div className="pbg-aside-stamps-grid" role="img" aria-label={`${progress} sur ${threshold}`}>
        {stamps.map((filled, i) => (
          <span key={i} className={`pbg-aside-stamp ${filled ? "is-filled" : ""}`}>
            <Utensils size={11} strokeWidth={2} />
          </span>
        ))}
      </div>
      <div className="pbg-aside-stamps-foot">
        <span><strong>{progress}</strong> / {threshold}</span>
        <Link to="/compte/commandes" className="pbg-aside-inline-link">
          Voir <ArrowUpRight size={12} strokeWidth={2} />
        </Link>
      </div>
    </article>
  );
}

function LastOrderCard({ order, onReorder }) {
  if (!order) return null;
  const items = order.items || [];
  const preview = items.slice(0, 2).map((it) => `${it.quantity}× ${it.title}`).join(" · ");
  const extra = items.length > 2 ? ` +${items.length - 2}` : "";
  const dateLabel = new Date(order.createdAt).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long",
  });

  return (
    <article className="pbg-aside-card pbg-aside-last-order">
      <div className="pbg-aside-head">
        <span className="pbg-aside-icon-round" aria-hidden="true">
          <ClipboardList size={16} strokeWidth={1.7} />
        </span>
        <div>
          <p className="pbg-aside-eyebrow">Dernière commande</p>
          <h3 className="pbg-aside-title">
            {order.deliveryMode === "delivery" ? "Livraison" : "Retrait chez Galatée"}
          </h3>
        </div>
      </div>
      <p className="pbg-aside-last-order-date">{dateLabel}</p>
      <p className="pbg-aside-last-order-items">{preview}{extra}</p>
      <button
        type="button"
        className="pbg-aside-reorder"
        onClick={() => onReorder(order)}
        disabled={items.length === 0}
      >
        <Repeat2 size={13} strokeWidth={2} />
        <span>Commander la même chose</span>
      </button>
    </article>
  );
}

function QuickShortcuts() {
  const items = [
    { to: "/menu", label: "Voir la carte", icon: UtensilsCrossed },
    { to: "/commande", label: "Nouvelle commande", icon: ShoppingBag },
    { to: "/compte/commandes", label: "Mes commandes", icon: ClipboardList },
    { to: "/pasta-lover-club", label: "Rejoindre le Club", icon: HeartHandshake },
  ];
  return (
    <article className="pbg-aside-card pbg-aside-shortcuts">
      <div className="pbg-aside-head pbg-aside-head-simple">
        <p className="pbg-aside-eyebrow">Raccourcis</p>
      </div>
      <div className="pbg-aside-shortcuts-grid">
        {items.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="pbg-aside-shortcut">
            <Icon size={17} strokeWidth={1.6} />
            <span>{label}</span>
            <ArrowUpRight size={12} strokeWidth={2} className="pbg-aside-shortcut-arrow" />
          </Link>
        ))}
      </div>
    </article>
  );
}

function LoyaltyMini({ loyalty }) {
  if (!loyalty?.settings?.active) return null;
  const threshold = loyalty.settings.threshold || 10;
  const reward = loyalty.rewardAvailable;
  // Cycle plein (X/X) quand la recompense est prete, sinon progression brute.
  const progress = reward ? threshold : (loyalty.progressInCycle || 0);
  const remaining = loyalty.ordersToNextReward || 0;
  const percent = Math.min(100, (progress / threshold) * 100);

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
  const { replace: replaceCart } = useCart();
  const navigate = useNavigate();
  const [loyalty, setLoyalty] = useState(null);
  const [orders, setOrders] = useState([]);

  useEffect(() => {
    if (!account) return undefined;
    let cancelled = false;
    fetchCustomerOrders()
      .then((payload) => {
        if (cancelled) return;
        setLoyalty(payload.loyalty || null);
        setOrders(payload.orders || []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [account]);

  const lastOrder = useMemo(() => {
    if (!orders.length) return null;
    return [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  }, [orders]);

  function reorder(order) {
    const nextCart = {};
    (order.items || []).forEach((it) => {
      const id = it.productId;
      if (!id) return;
      nextCart[id] = (nextCart[id] || 0) + (it.quantity || 1);
    });
    if (Object.keys(nextCart).length === 0) return;
    replaceCart(nextCart);
    navigate("/commande");
  }

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
          <Reveal className="pbg-account-hero-copy">
            <p className="pbg-account-eyebrow">Votre espace Galatée</p>
            <h1 className="pbg-account-title">
              Bonjour,<br /><em>{account.firstName}.</em>
            </h1>
            <p className="pbg-account-lede">
              Votre carnet est prêt. Retrouvez vos commandes, votre progression fidélité,
              et un accès rapide à la carte du jour.
            </p>
            <div className="pbg-account-hero-ctas">
              <Link to="/commande" className="pbg-btn pbg-btn-primary pbg-account-hero-cta">
                <span>Passer une commande</span>
                <ArrowUpRight size={16} strokeWidth={1.6} />
              </Link>
              <Link to="/menu" className="pbg-account-hero-secondary">
                <span>Voir la carte</span>
                <ArrowUpRight size={14} strokeWidth={1.8} />
              </Link>
            </div>
          </Reveal>

          {/* Carte "membre" decorative - desktop uniquement */}
          <Reveal className="pbg-account-hero-side" delay={120}>
            <MemberBadge account={account} loyalty={loyalty} orders={orders} />
          </Reveal>
        </div>
      </section>

      {/* Hub desktop uniquement : 4 gros cards rouges vers les sous-pages */}
      <section className="pbg-account-hub-section" aria-label="Sections du compte">
        <div className="pbg-page-shell pbg-account-hub-shell">
          <Reveal className="pbg-account-hub-card pbg-account-hub-card-bordeaux" delay={0}>
            <Link to="/compte/profil" className="pbg-account-hub-link">
              <span className="pbg-account-hub-index" aria-hidden="true">01</span>
              <span className="pbg-account-hub-icon" aria-hidden="true"><User size={22} strokeWidth={1.6} /></span>
              <div className="pbg-account-hub-body">
                <p className="pbg-account-hub-label">Coordonnées</p>
                <p className="pbg-account-hub-value">Votre carnet</p>
                <p className="pbg-account-hub-note">Email, téléphone, commune — vos infos de contact.</p>
              </div>
              <span className="pbg-account-hub-cta" aria-hidden="true">
                <span>Ouvrir</span>
                <ArrowUpRight size={16} strokeWidth={1.7} />
              </span>
            </Link>
          </Reveal>

          <Reveal className="pbg-account-hub-card pbg-account-hub-card-tomato" delay={80}>
            <Link to="/compte/fidelite" className="pbg-account-hub-link">
              <span className="pbg-account-hub-index" aria-hidden="true">02</span>
              <span className="pbg-account-hub-icon" aria-hidden="true"><Gift size={22} strokeWidth={1.6} /></span>
              <div className="pbg-account-hub-body">
                <p className="pbg-account-hub-label">Fidélité</p>
                <p className="pbg-account-hub-value">
                  {loyalty?.rewardAvailable ? "Récompense prête" : "Progression"}
                </p>
                <p className="pbg-account-hub-note">
                  {loyalty?.rewardAvailable
                    ? "Votre promo est débloquée — pensez à la mentionner."
                    : "10 commandes = 1 récompense. Suivez votre carte."}
                </p>
              </div>
              <span className="pbg-account-hub-cta" aria-hidden="true">
                <span>Ouvrir</span>
                <ArrowUpRight size={16} strokeWidth={1.7} />
              </span>
            </Link>
          </Reveal>

          <Reveal className="pbg-account-hub-card pbg-account-hub-card-ember" delay={160}>
            <Link to="/compte/commandes" className="pbg-account-hub-link">
              <span className="pbg-account-hub-index" aria-hidden="true">03</span>
              <span className="pbg-account-hub-icon" aria-hidden="true"><ClipboardList size={22} strokeWidth={1.6} /></span>
              <div className="pbg-account-hub-body">
                <p className="pbg-account-hub-label">Commandes</p>
                <p className="pbg-account-hub-value">
                  {orders.length > 0 ? `${orders.length} au total` : "Historique"}
                </p>
                <p className="pbg-account-hub-note">
                  {lastOrder
                    ? `Dernière : ${new Date(lastOrder.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long" })}`
                    : "Retrouvez toutes vos commandes ici."}
                </p>
              </div>
              <span className="pbg-account-hub-cta" aria-hidden="true">
                <span>Ouvrir</span>
                <ArrowUpRight size={16} strokeWidth={1.7} />
              </span>
            </Link>
          </Reveal>

          <Reveal className="pbg-account-hub-card pbg-account-hub-card-ink" delay={240}>
            <Link to="/compte/preferences" className="pbg-account-hub-link">
              <span className="pbg-account-hub-index" aria-hidden="true">04</span>
              <span className="pbg-account-hub-icon" aria-hidden="true"><ShieldCheck size={22} strokeWidth={1.6} /></span>
              <div className="pbg-account-hub-body">
                <p className="pbg-account-hub-label">Préférences</p>
                <p className="pbg-account-hub-value">Session & données</p>
                <p className="pbg-account-hub-note">Rester connecté, déconnexion, confidentialité.</p>
              </div>
              <span className="pbg-account-hub-cta" aria-hidden="true">
                <span>Ouvrir</span>
                <ArrowUpRight size={16} strokeWidth={1.7} />
              </span>
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="pbg-account-body">
        <div className="pbg-page-shell pbg-account-body-shell">
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
