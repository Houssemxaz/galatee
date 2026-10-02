import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Reveal from "@/components/Reveal";
import SEO from "@/components/SEO";

/**
 * Layout partagé pour les sous-pages /compte/*.
 * variant contrôle le fond (bordeaux / tomato / ink / ember).
 */
export default function AccountSectionLayout({
  variant,
  seo,
  eyebrow,
  index,
  title,
  titleEm,
  lede,
  children,
}) {
  return (
    <div className={`page page-account-section pbg-page pbg-account-section pbg-account-section-${variant}`}>
      <SEO title={seo.title} description={seo.description} path={seo.path} noIndex />

      <section className="pbg-page-header pbg-account-section-header" data-page-number={index}>
        <div className="pbg-page-shell">
          <Reveal>
            <Link to="/compte" className="pbg-account-section-back">
              <ArrowLeft size={14} strokeWidth={1.8} />
              <span>Mon compte</span>
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <p className="pbg-page-mark">
              <span>{index}</span><i /><em>{eyebrow}</em>
            </p>
          </Reveal>
          <Reveal delay={160}>
            <h1 className="pbg-page-title pbg-account-section-title">
              {title}
              {titleEm ? (<><br /><em>{titleEm}</em></>) : null}
            </h1>
          </Reveal>
          {lede ? (
            <Reveal delay={240}>
              <p className="pbg-page-lede pbg-account-section-lede">{lede}</p>
            </Reveal>
          ) : null}
        </div>
      </section>

      <section className="pbg-page-shell pbg-account-section-body">
        {children}
      </section>
    </div>
  );
}
