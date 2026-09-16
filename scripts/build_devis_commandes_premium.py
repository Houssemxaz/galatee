from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BG = colors.HexColor("#0B0B0B")
PANEL = colors.HexColor("#141414")
PANEL_2 = colors.HexColor("#191919")
INK = colors.HexColor("#F5F5F2")
MUTED = colors.HexColor("#777777")
GRID = colors.HexColor("#242424")
OLIVE = colors.HexColor("#00D6F5")
TERRACOTTA = colors.HexColor("#FF633D")
CREAM = colors.HexColor("#FF4160")
GOLD = colors.HexColor("#FFD21A")
TEAL = colors.HexColor("#00C99E")
PURPLE = colors.HexColor("#A45BFF")
INDIGO = colors.HexColor("#7476FF")

FONT_DIR = Path("C:/Windows/Fonts")
pdfmetrics.registerFont(TTFont("GalateeSans", str(FONT_DIR / "arial.ttf")))
pdfmetrics.registerFont(TTFont("GalateeSans-Bold", str(FONT_DIR / "arialbd.ttf")))
pdfmetrics.registerFont(TTFont("GalateeSerif", str(FONT_DIR / "georgia.ttf")))

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Kicker", parent=styles["Normal"], fontName="GalateeSans-Bold", fontSize=8.4, leading=10, textColor=MUTED, spaceAfter=4, uppercase=True))
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="GalateeSans-Bold", fontSize=39, leading=41, textColor=INK, spaceAfter=8))
styles.add(ParagraphStyle(name="CoverAccent", parent=styles["Normal"], fontName="GalateeSans-Bold", fontSize=27, leading=29, textColor=TEAL, spaceAfter=7))
styles.add(ParagraphStyle(name="Lead", parent=styles["Normal"], fontName="GalateeSans", fontSize=12, leading=17, textColor=MUTED, spaceAfter=7))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], fontName="GalateeSans-Bold", fontSize=25, leading=28, textColor=INK, spaceBefore=0, spaceAfter=5))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9.7, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.8, leading=11.5, textColor=MUTED))
styles.add(ParagraphStyle(name="CardTitle", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=13, leading=16, textColor=INK))
styles.add(ParagraphStyle(name="CardTag", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=7.5, leading=9, textColor=BG))
styles.add(ParagraphStyle(name="CardLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.2, leading=10, textColor=OLIVE, spaceAfter=4))
styles.add(ParagraphStyle(name="CardLabelLight", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.2, leading=10, textColor=CREAM, spaceAfter=4))
styles.add(ParagraphStyle(name="SummaryLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.2, leading=10, textColor=OLIVE, spaceAfter=4))
styles.add(ParagraphStyle(name="CardBullet", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.6, leading=11.7, leftIndent=9, firstLineIndent=-7, textColor=INK, spaceAfter=2))
styles.add(ParagraphStyle(name="CardBulletFunctional", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9.2, leading=12.8, leftIndent=9, firstLineIndent=-7, textColor=INK, spaceAfter=3))
styles.add(ParagraphStyle(name="CardBulletDense", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.1, leading=10.4, leftIndent=9, firstLineIndent=-7, textColor=INK, spaceAfter=1))
styles.add(ParagraphStyle(name="Price", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=11, leading=13, textColor=BG, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="PriceLight", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=10, leading=12, textColor=INK, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="MetaLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=7.5, leading=9, textColor=MUTED, spaceAfter=3))
styles.add(ParagraphStyle(name="MetaValue", parent=styles["BodyText"], fontName="GalateeSans", fontSize=10, leading=13, textColor=INK))
styles.add(ParagraphStyle(name="TotalLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=10, leading=12, textColor=BG))
styles.add(ParagraphStyle(name="TotalValue", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=18, leading=21, textColor=BG, alignment=TA_RIGHT))


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullet_list(items, style="CardBullet"):
    return [p(f"- {item}", style) for item in items]


def section_heading(number, title, intro):
    return [p(f"{number}  |  {title.upper()}", "Kicker"), p(title, "Section"), p(intro, "Body")]


def page_background(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setFillColor(BG)
    canvas.rect(0, 0, width, height, fill=1, stroke=0)
    canvas.setStrokeColor(GRID)
    canvas.setLineWidth(0.35)
    for x in range(0, int(width) + 1, 18):
        canvas.line(x, 0, x, height)
    for y in range(0, int(height) + 1, 18):
        canvas.line(0, y, width, y)
    if doc.page == 1:
        canvas.setFillColor(colors.HexColor("#142019"))
        canvas.circle(width + 2 * mm, height * 0.64, 63 * mm, fill=1, stroke=0)
        canvas.setFillColor(colors.HexColor("#06121A"))
        canvas.circle(-7 * mm, 33 * mm, 43 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(TEAL)
    canvas.setLineWidth(1.2)
    canvas.line(18 * mm, height - 23 * mm, width - 18 * mm, height - 23 * mm)
    canvas.setFont("GalateeSans-Bold", 7.8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, height - 17 * mm, "GALATEE  |  OFFRE COMMERCIALE 2026")
    canvas.setFillColor(GOLD)
    canvas.drawRightString(width - 18 * mm, height - 17 * mm, f"{doc.page:02d}")
    canvas.setStrokeColor(GRID)
    canvas.line(18 * mm, 14 * mm, width - 18 * mm, 14 * mm)
    canvas.setFont("GalateeSans", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 9 * mm, "GALATEE  /  COMMANDE EN LIGNE")
    canvas.drawRightString(width - 18 * mm, 9 * mm, "DEVIS")
    canvas.restoreState()


def cover_meta(provisional):
    status = "Périmètre provisoire" if provisional else "Fonctionnalités convenues"
    table = Table([
        [p("POUR", "MetaLabel"), p("DOCUMENT", "MetaLabel")],
        [p("Restaurant Galatee<br/>Hydra, Alger", "MetaValue"), p(f"Projet de site web + logiciel<br/>{status}", "MetaValue")],
    ], colWidths=[84 * mm, 84 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LINEBEFORE", (0, 0), (0, -1), 2, GOLD),
        ("LINEABOVE", (0, 0), (-1, 0), 0.5, GRID),
        ("LINEBELOW", (0, -1), (-1, -1), 0.5, GRID),
        ("TOPPADDING", (0, 0), (-1, 0), 8),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 4),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def tag(text, color):
    box = Table([[p(text, "CardTag")]], colWidths=[30 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return box


def price_pill(text):
    box = Table([[p(text, "Price")]], colWidths=[29 * mm])
    box.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return box


def module_card(number, title, price, color, label, left_title, left_items, right_title, right_items, functional=False):
    bullet_style = "CardBulletDense" if functional and len(left_items) >= 16 else ("CardBulletFunctional" if functional else "CardBullet")
    label_style = "CardLabelLight" if color in (TERRACOTTA, TEAL) else "CardLabel"
    header = Table([
        [p(f"{number}", "Kicker"), p(title, "CardTitle"), tag(label, color)],
    ], colWidths=[12 * mm, 93 * mm, 45 * mm])
    header.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 9),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    left = [p(left_title.upper(), label_style)] + bullet_list(left_items, bullet_style)
    right = [p(right_title.upper(), label_style)] + bullet_list(right_items, bullet_style)
    body = Table([[left, right]], colWidths=[79 * mm, 79 * mm])
    body.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL),
        ("LINEBEFORE", (1, 0), (1, 0), 0.5, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    card = Table([[""], [header], [body]], colWidths=[170 * mm])
    card.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), color),
        ("BACKGROUND", (0, 1), (0, 2), PANEL),
        ("LINEBELOW", (0, 0), (-1, 0), 0.5, color),
        ("BOX", (0, 0), (-1, -1), 0.5, GRID),
        ("LEFTPADDING", (0, 0), (-1, 0), 0),
        ("RIGHTPADDING", (0, 0), (-1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, 0), 3),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 3),
        ("LEFTPADDING", (0, 1), (-1, -1), 0),
        ("RIGHTPADDING", (0, 1), (-1, -1), 0),
        ("TOPPADDING", (0, 1), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 0),
    ]))
    return card


def total_block():
    total = Table([[p("TOTAL DU PROJET", "TotalLabel"), p("210 000 DA", "TotalValue")]], colWidths=[115 * mm, 55 * mm])
    total.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), GOLD),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return total


def chatbot_detail():
    rows = [[p("BÉNÉFICES ET ROI", "CardLabelLight"), p("COÛTS EXTERNES INDICATIFS", "CardLabelLight")], [
        bullet_list([
            "Répondre 24h/24 aux questions répétitives.",
            "Guider vers le menu, la commande, la livraison et les promotions.",
            "Réduire les sollicitations de l'équipe et améliorer la conversion.",
            "Répondre en français, arabe, darija et anglais.",
        ], "CardBullet"),
        bullet_list([
            "Entre 0,50 € et 3 € maximum par mois selon le trafic et le fournisseur retenu.",
            "Estimation à confirmer selon le fournisseur, le volume de conversations et l'hébergement.",
        ], "CardBullet"),
    ]]
    table = Table(rows, colWidths=[84 * mm, 84 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PANEL_2),
        ("LINEBEFORE", (1, 0), (1, -1), 0.5, GRID),
        ("BOX", (0, 0), (-1, -1), 0.5, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 2),
        ("TOPPADDING", (0, 1), (-1, 1), 2),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 6),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def finance_summary():
    rows = [[p("PRESTATION", "SummaryLabel"), p("MONTANT", "SummaryLabel")]]
    for label, amount in [
        ("Frontend, design, UI/UX et animations", "70 000 DA"),
        ("Backend, API, base de données et back-office", "90 000 DA"),
        ("Sécurité et authentification", "25 000 DA"),
        ("SEO technique, local et AISEO", "10 000 DA"),
        ("Déploiement et mise en production", "15 000 DA"),
        ("Chatbot RAG vocal", "OFFERT"),
        ("Maintenance - 6 premiers mois", "OFFERTE"),
    ]:
        rows.append([p(label, "Body"), p(amount, "PriceLight")])
    table = Table(rows, colWidths=[125 * mm, 45 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PANEL_2),
        ("BACKGROUND", (0, 1), (-1, -1), PANEL),
        ("LINEBELOW", (0, 0), (-1, -1), 0.45, GRID),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))
    return table


TECH_MODULES = [
    ("01", "Frontend et interface publique", "70 000 DA", OLIVE, "EXPÉRIENCE CLIENT", "Fonctionnalités", [
        "Accueil, menu, détail d'un plat, commande, informations et contact.",
        "Direction visuelle alignée avec l'identité de marque : palette, typographies, composants et hiérarchie.",
        "Menu administrable avec photos, descriptions, catégories, prix et disponibilité.",
        "Panier avec quantités, suppression, récapitulatif et validation.",
        "Choix retrait sur place ou livraison à Alger avec adresse et commune.",
        "Paiement prévu à la livraison ou au retrait.",
        "Compte facultatif avec email, mot de passe et commune de résidence.",
        "Connexion, récupération de mot de passe par email, historique et préremplissage des informations.",
        "Conception desktop dédiée pour une lecture confortable sur ordinateur.",
        "Conception mobile dédiée pour une commande rapide au téléphone.",
        "Animations de hover, scroll et transitions d'état, avec accessibilité et reduced-motion.",
    ], "Stack et livrables", ["Next.js, TypeScript et composants UI réutilisables.", "Parcours de commande connecté à l'API REST.", "Formulaires validés et messages d'erreur compréhensibles.", "Optimisation des performances et des images."]),
    ("02", "Backend, API et back-office", "90 000 DA", TERRACOTTA, "SOCLE MÉTIER", "Fonctionnalités", [
        "API REST pour menu, commandes, comptes, promotions et statistiques.",
        "Base clients, plats, commandes, lignes de commande, paiements et événements.",
        "Workflow en attente, confirmée, annulée, payée, préparation et terminée, avec recherche, filtres et tri par statut et période.",
        "Notification backoffice et notification WhatsApp pour l'employé.",
        "Fiches clients avec commune de résidence, historique et compteur des commandes payées.",
        "Réduction déclenchée après dix commandes payées.",
        "Gestion de produits de type plat, menu ou offre : images, prix, descriptions, publication, archivage et import par sélection de fichier ou glisser-déposer.",
        "Rupture de stock activable pour un plat, un menu ou une offre, avec retrait automatique du panier.",
        "Page dédiée Pasta Lover Club dans le backoffice pour préparer rencontres, vêtements, casquettes et soirées ; détails à définir.",
        "Statistiques de trafic : visiteurs, sessions, pages consultées, sources et appareils.",
        "Suivi du parcours : consultations du menu, fiches produits, ajouts au panier, commandes commencées et conversion.",
        "Ventes par jour, semaine, mois et année, avec comparaison entre deux périodes.",
        "Nombre de commandes confirmées, annulées, en attente et terminées.",
        "Plat, menu ou offre le plus vendu et le moins vendu, par quantité et par chiffre d'affaires.",
        "Suivi des promotions, de la fidélité, des ruptures de stock et des périodes de forte activité.",
    ], "Stack et livrables", ["NestJS, TypeScript et API REST documentée.", "PostgreSQL et Prisma ORM.", "Backoffice privé pour commandes, clients, menu et statistiques.", "Préparation des communes et tarifs de livraison comme évolution."]),
    ("03", "Sécurité et authentification", "25 000 DA", CREAM, "PROTECTION", "Mesures prévues", [
        "HTTPS obligatoire entre le site, l'API et le backoffice.",
        "Validation et nettoyage de toutes les entrées utilisateur.",
        "Requêtes paramétrées contre les injections SQL.",
        "Mots de passe protégés par empreinte sécurisée et récupération par email avec lien temporaire.",
        "Sessions sécurisées et permissions sur les accès privés.",
        "Rate limiting sur connexion, commandes et endpoints sensibles.",
        "Contrôle des images importées et secrets isolés.",
    ], "Contrôles", ["Cookies HttpOnly, Secure et SameSite.", "CORS limité aux domaines autorisés.", "Journaux sans données sensibles.", "Traçabilité des changements de statut."]),
    ("04", "SEO technique et local", "10 000 DA", TEAL, "VISIBILITÉ", "Optimisations", [
        "Titles, meta descriptions et hiérarchie H1/H2.",
        "Sitemap.xml pour déclarer les pages publiques à Google.",
        "Robots.txt pour guider l'exploration et exclure les espaces privés.",
        "Données structurées du restaurant, de l'adresse, des horaires et du menu.",
        "SEO local autour de Hydra, Alger et des pâtes fraîches.",
        "AISEO : contenu structuré pour les moteurs et assistants IA.",
        "Pages et images optimisées pour le mobile.",
    ], "Livrables", ["URLs canoniques et Open Graph.", "Balisage local et contenu cohérent.", "Contrôle des performances et de l'indexabilité."]),
    ("05", "Architecture technique cible", "COMPRIS", OLIVE, "STRUCTURE", "Organisation", [
        "Site public, backoffice et API séparés par responsabilité.",
        "Base unique et structurée pour les clients, commandes et statistiques.",
        "Stockage sécurisé des images du menu.",
        "Services email et WhatsApp connectés par variables sécurisées.",
        "Architecture prête à accueillir les communes et tarifs de livraison.",
    ], "Choix proposés", ["Next.js + TypeScript.", "NestJS + API REST.", "PostgreSQL + Prisma.", "Stockage objet compatible S3.", "Email transactionnel + WhatsApp Business."]),
    ("06", "Déploiement et mise en service", "15 000 DA", GOLD, "MISE EN SERVICE", "Livrables", [
        "Configuration de la production, des secrets et de la base de données.",
        "Mise en ligne du site, de l'API et du backoffice en HTTPS.",
        "Configuration des emails et préparation des notifications WhatsApp.",
        "Tests de compte, commande, paiement, fidélité, menu et statistiques.",
        "Documentation et transmission des accès.",
        "Validation des règles de livraison avec le restaurant.",
    ], "Frais d'hébergement", ["Frais d'hébergement estimatifs : entre 8 € et 11 € par mois selon les services retenus."]),
    ("07", "Chatbot RAG vocal", "OFFERT", OLIVE, "ASSISTANCE CLIENT", "Fonctionnalités", [
        "Réponses aux questions fréquentes sur le menu, les horaires, l'adresse, la livraison et les promotions.",
        "Base de connaissances contrôlée pour limiter les réponses hors sujet.",
        "Réponses en français, arabe, darija et anglais.",
        "Mode vocal pour écouter la réponse et poser une question à la voix.",
        "Orientation vers la carte et la commande, sans créer ni modifier une commande.",
        "Réduction des sollicitations répétitives de l'équipe et amélioration de la disponibilité client.",
    ], "Bénéfices et conditions", ["Disponibilité 24h/24, réduction des sollicitations et meilleure conversion.", "Recherche sémantique dans les contenus validés.", "Protection contre les abus et limitation des requêtes.", "Chatbot offert dans le cadre du projet."]),
    ("08", "Maintenance et suivi", "OFFERTE (6 MOIS)", TEAL, "SUIVI", "Périmètre inclus", [
        "Mises à jour de sécurité du serveur.",
        "Mises à jour techniques nécessaires du site et du logiciel.",
        "Surveillance de l'espace disque et des ressources.",
        "Sauvegardes régulières de la base de données.",
        "Restauration en cas de problème.",
        "Correction des bugs provenant de l'application.",
        "Renouvellement et configuration SSL (HTTPS).",
        "Intervention si le site ou le back-office devient indisponible.",
        "Petites corrections nécessaires au bon fonctionnement.",
    ], "Conditions", ["Maintenance offerte pendant les six premiers mois.", "Suivi préventif et interventions nécessaires au bon fonctionnement.", "La suite de la maintenance sera définie séparément après cette période."]),
]


FUNCTIONAL_MODULES = [
    ("01", "Frontend et interface publique", "70 000 DA", OLIVE, "EXPÉRIENCE CLIENT", "Ce que le client utilise", [
        "Un site clair sur téléphone et ordinateur.", "Une carte avec photos, descriptions et prix.", "Un panier simple pour choisir les plats.", "Le choix entre retrait et livraison à Alger.", "Une commande avec adresse et paiement à la livraison.", "Un compte facultatif avec email, mot de passe et commune de résidence.", "Une connexion sécurisée, une récupération de mot de passe par email, un historique et des informations préremplies.",
        "Un design cohérent avec l'identité visuelle de Galatee.", "Une structure dédiée à l'ordinateur et une autre pensée pour le mobile.", "Des animations de hover, de scroll et de transition pour rendre l'expérience plus fluide.",
    ], "Résultat attendu", ["Commander rapidement.", "Comprendre le statut de la commande.", "Retrouver facilement ses anciennes commandes."]),
    ("02", "Backend, API et back-office", "90 000 DA", TERRACOTTA, "GESTION RESTAURANT", "Ce que l'équipe peut faire", [
        "Recevoir, rechercher, filtrer et trier les commandes dans le logiciel.", "Être avertie par WhatsApp.", "Ouvrir le détail d'une commande avec les coordonnées, les produits, les quantités, les remarques et le total, puis appeler le client pour confirmer ou annuler.", "Suivre la commande jusqu'au paiement et à la fin de préparation.", "Conserver les clients, leur commune et leur historique.", "Utiliser une interface de logiciel claire pour les commandes, les clients, le catalogue et les statistiques.", "Gérer les plats, menus et offres avec leurs prix, photos, descriptions et import par sélection de fichier ou glisser-déposer.", "Activer une rupture de stock sur chaque type de produit.", "Accorder une réduction après dix commandes payées.", "Gérer une page Pasta Lover Club dédiée aux rencontres, vêtements, casquettes et soirées ; contenu à préciser.", "Consulter le trafic : visiteurs, sessions, pages, sources et appareils utilisés.", "Suivre le parcours : menu, fiches produits, paniers, commandes commencées et conversion.", "Voir les commandes confirmées, annulées, en attente et terminées par période.", "Identifier le plat, le menu ou l'offre le plus vendu et le moins vendu.", "Comparer les ventes par jour, semaine, mois et année ainsi que l'effet des promotions.", "Repérer les heures fortes, les ruptures de stock et les clients qui progressent vers leur réduction.", "Consulter le chiffre d'affaires en ligne.",
    ], "Évolution prévue", ["Gestion détaillée des communes d'Alger.", "Tarifs de livraison configurables.", "Règles affinées avec le restaurant."]),
    ("03", "Sécurité et authentification", "25 000 DA", CREAM, "PROTECTION", "Pour le client", [
        "Connexion par email et mot de passe.", "Mot de passe protégé et récupération sécurisée par email.", "Déconnexion et expiration automatique des sessions.", "Formulaires contrôlés avant enregistrement.", "Limitation des tentatives de connexion et des requêtes abusives.", "Échanges protégés entre le site et le logiciel.",
    ], "Pour le restaurant", ["Accès privé au logiciel.", "Actions importantes limitées aux personnes autorisées.", "Protection contre les injections et les fichiers dangereux."]),
    ("04", "SEO technique et local", "10 000 DA", TEAL, "VISIBILITÉ", "Explications simples", [
        "Title : le titre affiché dans Google.", "Meta description : le résumé visible sous le résultat.", "Sitemap.xml : la liste des pages que Google peut découvrir.", "Robots.txt : les indications pour éviter les espaces privés.", "AISEO : un contenu mieux compris par Google et les assistants IA.",
    ], "Pour Galatee", ["Être trouvé pour les pâtes fraîches à Hydra et Alger.", "Partager des pages avec un aperçu propre.", "Charger rapidement sur mobile."]),
    ("05", "Architecture technique cible", "COMPRIS", OLIVE, "ORGANISATION", "Le projet comprend", [
        "Un site public pour les clients.", "Un logiciel interne pour les commandes, le menu et le Pasta Lover Club.", "Une base de données pour les clients, plats, menus, offres et commandes.", "Des services pour les emails et notifications.",
    ], "Pourquoi c'est utile", ["Les informations restent centralisées.", "Le logiciel peut évoluer avec le restaurant.", "Les futures communes et tarifs peuvent être ajoutés."]),
    ("06", "Déploiement et mise en service", "15 000 DA", GOLD, "MISE EN SERVICE", "Livraison", [
        "Mise en ligne du site et installation du logiciel.", "Configuration des emails et notifications.", "Vérification du parcours complet de commande.", "Documentation simple pour l'équipe.",
    ], "Frais d'hébergement", ["Frais d'hébergement estimatifs : entre 8 € et 11 € par mois selon les services retenus."]),
    ("07", "Chatbot RAG vocal", "OFFERT", OLIVE, "ASSISTANCE CLIENT", "Ce que le client obtient", [
        "Obtenir une réponse rapide aux questions répétitives, à toute heure.",
        "Trouver plus facilement les informations sur la carte, la livraison, les horaires et les promotions.",
        "Être accompagné en français, arabe, darija ou anglais.",
        "Utiliser la voix pour parler au chatbot et écouter sa réponse.",
        "Être orienté vers la commande sans donner au chatbot le contrôle des données métier.",
        "Améliorer la disponibilité du restaurant et réduire les appels répétitifs.",
    ], "Bénéfices et conditions", ["Meilleure conversion des visiteurs qui cherchent une information.", "Moins de temps consacré par l'équipe aux mêmes questions.", "Base de réponses mise à jour avec les contenus validés.", "Chatbot offert dans le cadre du projet."]),
    ("08", "Maintenance et suivi", "OFFERTE (6 MOIS)", TEAL, "SUIVI", "Ce qui est inclus", [
        "Mises à jour de sécurité du serveur.",
        "Mises à jour techniques nécessaires du site et du logiciel.",
        "Surveillance de l'espace disque et des ressources.",
        "Sauvegardes régulières de la base de données.",
        "Restauration en cas de problème.",
        "Correction des bugs provenant de l'application.",
        "Renouvellement et configuration SSL (HTTPS).",
        "Intervention si le site ou le back-office devient indisponible.",
        "Petites corrections nécessaires au bon fonctionnement.",
    ], "Conditions", ["Maintenance offerte pendant les six premiers mois.", "Suivi préventif et interventions nécessaires au bon fonctionnement.", "La suite de la maintenance sera définie séparément après cette période."]),
]


def build_document(output_name, technical):
    output = OUTPUT_DIR / output_name
    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=29 * mm, bottomMargin=21 * mm, title="Devis Galatee", author="Galatee")
    modules = TECH_MODULES if technical else FUNCTIONAL_MODULES
    story = [Spacer(1, 21 * mm), p("DEVIS TECHNIQUE PROVISOIRE" if technical else "DEVIS FONCTIONNEL", "Kicker"), p("Galatee", "CoverTitle"), p("Site web + logiciel.", "CoverAccent"), p("Site public, logiciel de gestion et fidélité client", "Lead"), Spacer(1, 12 * mm), cover_meta(technical), Spacer(1, 10 * mm)]
    if technical:
        story += [p("Document de cadrage à valider avec le restaurant. Les règles de livraison par commune, les paramètres WhatsApp, le périmètre exact des statistiques et l'hébergement définitif pourront modifier le détail de la version finale.", "Body")]
    else:
        story += [p("Ce document récapitule les fonctionnalités discutées et le fonctionnement prévu au quotidien.", "Body")]
    story.append(PageBreak())

    intros = [
        "Le site permet aux clients de découvrir la carte et de commander depuis leur téléphone ou leur ordinateur." if technical else "Une expérience simple pour consulter la carte et commander.",
        "Le logiciel centralise les commandes et donne à l'équipe une vue claire de ce qu'elle doit traiter." if technical else "Un outil quotidien pour recevoir, confirmer et suivre les commandes.",
        "Les comptes, les commandes et les informations clients sont protégés." if technical else "Des accès et des données protégés.",
        "Le site est préparé pour être trouvé dans les recherches locales et compris par les moteurs de recherche." if technical else "Les principaux éléments qui aident les clients à trouver Galatee.",
        "La structure proposée sépare clairement le site, le logiciel et les données." if technical else "Une organisation qui permet au projet de grandir avec le restaurant.",
        "La mise en service comprend la configuration, les tests et la transmission des accès." if technical else "La mise en service du site et du logiciel.",
        "Le chatbot RAG vocal répond aux questions validées et accompagne les clients dans leur parcours." if technical else "Un assistant vocal pour répondre aux questions fréquentes des clients.",
        "Un suivi technique est prévu pendant les six premiers mois pour maintenir le site et le logiciel en bon fonctionnement." if technical else "Une maintenance est offerte pendant les six premiers mois pour accompagner le bon fonctionnement du projet.",
    ]
    for index, module in enumerate(modules):
        story += section_heading(module[0], module[1], intros[index])
        story += [module_card(*module, functional=not technical)]
        story.append(PageBreak())

    story += [p("RÉCAPITULATIF DE L'OFFRE", "Kicker"), p("Un socle clair pour lancer la commande en ligne", "Section")]
    story += [p("Le projet principal comprend le site, le logiciel de gestion, la sécurité, la visibilité en ligne, la mise en service, la maintenance initiale et le chatbot RAG vocal.", "Body"), finance_summary(), Spacer(1, 7 * mm)]
    total = total_block()
    story += [total]
    doc.build(story, onFirstPage=page_background, onLaterPages=page_background)
    return output


if __name__ == "__main__":
    print(build_document("devis-galatee-technique-provisoire.pdf", technical=True))
    print(build_document("devis-galatee-fonctionnel.pdf", technical=False))
