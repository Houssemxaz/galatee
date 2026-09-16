import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, MapPin, UsersRound } from "lucide-react";
import { Link } from "react-router-dom";
import Reveal from "@/components/Reveal";
import { fetchPastaLoverClub } from "@/lib/api";

export default function PastaLoverClubPage() {
  const [content, setContent] = useState(null);
  const [state, setState] = useState("loading");
  useEffect(() => { fetchPastaLoverClub().then((payload) => { setContent(payload); setState("ready"); }).catch(() => setState("error")); }, []);
  if (state === "loading") return <div className="page pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">Chargement du club…</div></div>;
  if (state === "error" || !content) return <div className="page pbg-page pbg-page-cream"><div className="pbg-page-shell pbg-dish-status">Le club n'est pas disponible pour le moment.</div></div>;
  const { settings, events } = content;
  return <div className="page page-club pbg-page pbg-page-cream">
    <section className="pbg-page-header"><div className="pbg-page-shell"><p className="pbg-page-kicker"><span><UsersRound size={14} /> La communauté Galatee</span></p><h1 className="pbg-page-title">Pasta Lover<br /><em>Club.</em></h1><p className="pbg-page-lede">{settings.intro}</p></div></section>
    <section className="pbg-page-shell club-layout"><Reveal className="club-manifesto"><p className="account-side-tag">Le cercle</p><h2>{settings.title}</h2><div className="club-benefits">{settings.benefits.split("\n").filter(Boolean).map((benefit) => <p key={benefit}>{benefit}</p>)}</div><Link className="text-link" to="/contact">Parler à l'équipe <ArrowUpRight size={14} /></Link></Reveal><Reveal className="club-events" delay={100}><div className="account-section-heading"><div><p className="account-side-tag">Les rendez-vous</p><h2>À l'agenda.</h2></div></div>{events.length ? <div className="club-event-list">{events.map((event) => <article className="club-event" key={event.id}><div><p className="club-event-date"><CalendarDays size={13} /> {event.eventDate || "Bientôt"}</p><h3>{event.title}</h3><p>{event.description}</p></div>{event.location && <span><MapPin size={13} /> {event.location}</span>}</article>)}</div> : <p className="account-empty">Les prochains rendez-vous seront annoncés ici.</p>}</Reveal></section>
  </div>;
}
