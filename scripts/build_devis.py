from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, PageBreak, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "devis-galatee.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

BLACK = colors.HexColor("#11110F")
INK = colors.HexColor("#F4F3ED")
MUTED = colors.HexColor("#B7B6AD")
LINE = colors.HexColor("#55554D")
PALE = colors.HexColor("#292923")

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("GalateeSans", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("GalateeSans-Bold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("GalateeSerif", str(FONT_DIR / "georgia.ttf")))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName="GalateeSans-Bold", fontSize=8, leading=10, textColor=MUTED, spaceAfter=5))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="GalateeSerif", fontSize=42, leading=43, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name="Lead", parent=styles["Normal"], fontName="GalateeSans", fontSize=11, leading=16, textColor=MUTED, spaceAfter=7))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], fontName="GalateeSerif", fontSize=24, leading=27, textColor=INK, spaceBefore=5, spaceAfter=9))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9.2, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="CellTitle", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=9, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="HeaderCell", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.5, leading=11, textColor=colors.white))
styles.add(ParagraphStyle(name="Cell", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.2, leading=11.5, textColor=INK))
styles.add(ParagraphStyle(name="Price", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=9, leading=12, textColor=INK, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="BulletCustom", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.7, leading=12.5, leftIndent=11, firstLineIndent=-8, textColor=INK, spaceAfter=2))
styles.add(ParagraphStyle(name="MetaLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=3))
styles.add(ParagraphStyle(name="MetaValue", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="FinalTotal", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=18, leading=20, textColor=INK, alignment=TA_RIGHT))


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items):
    return [p(f"- {item}", "BulletCustom") for item in items]


def heading(number, title):
    return [p(f"{number}  |  {title.upper()}", "Kicker"), p(title, "Section")]


def priced_row(title, details, amount):
    return [p(title, "CellTitle"), p(details, "Cell"), p(amount, "Price")]


def footer(canvas, doc):
    canvas.saveState()
    width, _ = A4
    canvas.setFillColor(BLACK)
    canvas.rect(0, 0, width, A4[1], fill=1, stroke=0)
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont("GalateeSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "GALATEE  /  DEVIS DE CREATION DIGITALE")
    canvas.drawRightString(width - 18 * mm, 9 * mm, f"{doc.page:02d}")
    canvas.restoreState()


doc = SimpleDocTemplate(
    str(OUTPUT), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
    topMargin=17 * mm, bottomMargin=21 * mm, title="Devis Galatee",
    author="Galatee",
)

story = []
story += [Spacer(1, 22 * mm), p("DEVIS", "Kicker"), Spacer(1, 6 * mm), p("Galatee", "CoverTitle"), Spacer(1, 20 * mm)]

meta = Table([
    [p("CLIENT", "MetaLabel"), p("PRESTATAIRES", "MetaLabel")],
    [p("Restaurant Galatee<br/>Hydra, Alger", "MetaValue"), p("Équipe projet dédiée", "MetaValue")],
], colWidths=[85 * mm, 85 * mm])
meta.setStyle(TableStyle([
    ("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE),
    ("LINEBELOW", (0, -1), (-1, -1), 0.6, LINE),
    ("TOPPADDING", (0, 0), (-1, 0), 7),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
    ("TOPPADDING", (0, 1), (-1, 1), 8),
    ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story += [meta]
story.append(PageBreak())

story += heading("01", "Frontend et interface publique")
story += [p("Conception d'une expérience cohérente avec l'identité de Galatee, optimisée pour une consultation rapide sur mobile et une présentation éditoriale sur desktop.", "Body")]
story += bullets([
    "Site public avec les pages Accueil, Menu, détail des plats, Réservation, Informations et Contact.",
    "Interface pensée pour les parcours mobiles et desktop, avec des compositions adaptées à chaque format.",
    "Menu de la semaine avec catégories, prix, images, descriptions courtes et descriptions détaillées.",
    "Parcours de réservation avec choix de date, service, nombre de personnes et type de table.",
    "Création de compte et connexion sans mot de passe par code temporaire envoyé par email.",
    "Espace client avec coordonnées enregistrées, réservations en cours et historique.",
    "Animations, états de survol, transitions et retours visuels sur les actions principales.",
    "Interface accessible et compatible avec les tailles d'écran courantes.",
])
story += [Spacer(1, 7 * mm)] + heading("02", "Backend, API et back-office")
story += [p("Mise en place du système métier central qui relie le site public, les demandes de réservation et l'outil de gestion du restaurant.", "Body")]
story += bullets([
    "API REST structurée pour le menu, les réservations, les disponibilités, les comptes et les statistiques.",
    "Gestion des demandes avec statuts en attente, confirmée, annulée et archivée.",
    "Gestion des capacités par type de table et par créneau horaire.",
    "Base de disponibilités administrable : jours de service, horaires, intervalle des créneaux et capacités Normal/VIP, avec recalcul automatique des créneaux proposés au public.",
    "Blocage automatique d'un créneau lors de la confirmation et prévention du surbooking.",
    "Filtres du back-office par date, heure, nombre de personnes, type de table et statut.",
    "Gestion des plats : titre, prix, catégorie, image, description courte et description longue.",
    "Import d'images par sélection de fichier ou glisser-déposer, publication et archivage.",
    "Statistiques d'usage : visites du menu, clics vers la réservation et demandes initiées ou envoyées.",
])

story.append(PageBreak())
story += heading("03", "Sécurité et authentification")
story += [p("Protection des données clients et des opérations du restaurant, avec une attention particulière portée aux accès privés et aux flux de réservation.", "Body")]
story += bullets([
    "Chiffrement des données sensibles au repos et pendant leur transmission.",
    "HTTPS obligatoire avec certificat TLS valide.",
    "Validation stricte, normalisation et nettoyage des entrées utilisateur.",
    "Requêtes paramétrées via Prisma ORM afin de prévenir les injections SQL.",
    "Rate limiting, notamment sur les codes email et les endpoints publics.",
    "Authentification des routes privées et sessions sécurisées avec cookies HttpOnly, Secure et SameSite.",
    "Contrôle des fichiers importés : type MIME, extension, poids et emplacement de stockage.",
    "CORS limité aux domaines autorisés, en-têtes HTTP de sécurité et secrets isolés.",
    "Sauvegardes, journalisation des opérations sensibles et protection contre les doubles réservations.",
])
story += [Spacer(1, 7 * mm)] + heading("04", "SEO technique et local")
story += [p("Optimisation de la présence de Galatee pour les recherches locales et les moteurs de recherche.", "Body")]
story += bullets([
    "Balise title : définit le titre affiché dans les résultats Google pour chaque page.",
    "Meta description : résume la page sous son titre pour aider l'utilisateur à choisir le bon résultat.",
    "Balises H1/H2 : organisent les titres et permettent à Google de comprendre la hiérarchie du contenu.",
    "Sitemap.xml : indique à Google quelles pages publiques existent et peuvent être explorées.",
    "Robots.txt : guide l'exploration du site et écarte les espaces privés comme le compte et le back-office.",
    "Données structurées Schema.org / JSON-LD : décrivent le restaurant, son adresse, ses horaires, son menu et son contact.",
    "URLs canoniques : indiquent la version officielle d'une page pour éviter les doublons.",
    "Open Graph : contrôle l'aperçu du site lorsqu'une page est partagée sur les réseaux sociaux.",
    "Optimisation locale autour de Hydra, Alger et de la spécialité pâtes fraîches.",
    "Optimisation des images, du poids des pages et des performances mobiles.",
])
story += [Spacer(1, 7 * mm)] + heading("05", "Architecture technique cible")
stack = Table([
    [p("COUCHE", "HeaderCell"), p("CHOIX PROPOSÉ", "HeaderCell"), p("RÔLE", "HeaderCell")],
    [p("Frontend", "CellTitle"), p("Next.js + TypeScript + Tailwind CSS + shadcn/ui + Lucide", "Cell"), p("Site public, espace client et interface de gestion.", "Cell")],
    [p("Backend", "CellTitle"), p("NestJS + TypeScript + API REST", "Cell"), p("Logique métier, réservations, disponibilité et authentification.", "Cell")],
    [p("Données", "CellTitle"), p("PostgreSQL + Prisma ORM", "Cell"), p("Données fiables, structurées et évolutives.", "Cell")],
    [p("Email et fichiers", "CellTitle"), p("Brevo + stockage compatible S3", "Cell"), p("Codes de connexion et images du menu.", "Cell")],
    [p("Mise en ligne", "CellTitle"), p("Frontend et API séparés, variables secrètes et sauvegardes.", "Cell"), p("Disponibilité, maintenance et évolutivité.", "Cell")],
], colWidths=[30 * mm, 82 * mm, 58 * mm], repeatRows=1)
stack.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), PALE),
    ("LINEBELOW", (0, 1), (-1, -1), 0.45, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story += [stack]

story.append(PageBreak())
story += heading("06", "Déploiement, livraison et maintenance")
story += bullets([
    "Configuration de l'environnement de production, de PostgreSQL et des variables secrètes.",
    "Déploiement du site public et de l'API, puis vérification des routes, images et formulaires.",
    "Configuration du service email transactionnel et vérification du parcours de connexion.",
    "Tests finaux du menu, des disponibilités, des réservations, du compte client et du back-office.",
    "Documentation courte et transmission des accès et consignes de mise en service.",
    "30 jours de maintenance corrective après livraison : correction des bugs liés aux fonctionnalités prévues, vérification des emails et assistance de prise en main.",
])
story += [Spacer(1, 8 * mm), p("FRAIS EXTERNES", "Kicker")]
external = Table([
    [p("FRAIS EXTERNES", "CellTitle"), p("Nom de domaine, hébergement, PostgreSQL, stockage d'images et Brevo ne sont pas inclus dans le montant du projet.", "Cell")],
], colWidths=[42 * mm, 128 * mm])
external.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (0, 0), PALE),
    ("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE),
    ("LINEBELOW", (0, 0), (-1, -1), 0.45, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story += [external, Spacer(1, 20 * mm)]

story += [p("RÉCAPITULATIF FINANCIER", "Kicker")]
recap = Table([
    [p("PRESTATION", "CellTitle"), p("MONTANT", "CellTitle")],
    [p("Frontend et interface publique", "Cell"), p("40 000 DA", "Price")],
    [p("Backend, API et back-office", "Cell"), p("60 000 DA", "Price")],
    [p("Sécurité et authentification", "Cell"), p("20 000 DA", "Price")],
    [p("SEO technique et local", "Cell"), p("15 000 DA", "Price")],
    [p("Déploiement et mise en production", "Cell"), p("20 000 DA", "Price")],
], colWidths=[132 * mm, 38 * mm])
recap.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), PALE),
    ("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE),
    ("LINEBELOW", (0, 0), (-1, -1), 0.45, LINE),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story += [recap, Spacer(1, 10 * mm)]

total = Table([[p("TOTAL DU PROJET", "CellTitle"), p("155 000 DA", "FinalTotal")]], colWidths=[105 * mm, 65 * mm])
total.setStyle(TableStyle([
    ("LINEABOVE", (0, 0), (-1, 0), 1, LINE),
    ("TOPPADDING", (0, 0), (-1, 0), 11),
    ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
    ("LEFTPADDING", (0, 0), (-1, 0), 0),
    ("RIGHTPADDING", (0, 0), (-1, 0), 0),
    ("VALIGN", (0, 0), (-1, 0), "TOP"),
]))
story += [total, Spacer(1, 8 * mm), p("Merci pour votre confiance.", "Lead")]

doc.build(story, onFirstPage=footer, onLaterPages=footer)
print(OUTPUT)
