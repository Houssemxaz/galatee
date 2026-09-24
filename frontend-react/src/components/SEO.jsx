import { Helmet } from "react-helmet-async";

const SITE_URL = "https://galatee.dz";
const DEFAULT_IMAGE = `${SITE_URL}/assets/brand/box-pomodoro-steam-960.webp`;

/**
 * SEO — dynamic <head> per route.
 * Sets: <title>, description, canonical, Open Graph, Twitter Card.
 * Pass optional `jsonLd` for per-page structured data.
 */
export default function SEO({
  title,
  description,
  path = "/",
  image = DEFAULT_IMAGE,
  imageAlt,
  type = "website",
  jsonLd,
  noIndex = false,
}) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title
    ? `${title} · Pasta by Galatée`
    : "Pasta by Galatée — Pâtes fraîches à Hydra, Alger · Livraison";
  const desc = description || "Pâtes fraîches faites maison, livraison ou retrait du mercredi au samedi soir. Trattoria italienne à Hydra, Alger.";

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />
      {noIndex && <meta name="robots" content="noindex,nofollow" />}

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Pasta by Galatée" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:image" content={image} />
      {imageAlt && <meta property="og:image:alt" content={imageAlt} />}
      <meta property="og:locale" content="fr_DZ" />

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
