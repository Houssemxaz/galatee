from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "pdf"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
styles.add(ParagraphStyle(name="CoverTitle", parent=styles["Title"], fontName="GalateeSerif", fontSize=38, leading=40, textColor=INK, spaceAfter=9))
styles.add(ParagraphStyle(name="Lead", parent=styles["Normal"], fontName="GalateeSans", fontSize=10.5, leading=15, textColor=MUTED, spaceAfter=7))
styles.add(ParagraphStyle(name="Section", parent=styles["Heading1"], fontName="GalateeSerif", fontSize=23, leading=26, textColor=INK, spaceBefore=5, spaceAfter=9))
styles.add(ParagraphStyle(name="Body", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9, leading=13.3, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8, leading=11, textColor=MUTED))
styles.add(ParagraphStyle(name="CellTitle", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.8, leading=11.5, textColor=INK))
styles.add(ParagraphStyle(name="HeaderCell", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.2, leading=10.5, textColor=colors.white))
styles.add(ParagraphStyle(name="Cell", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8, leading=10.8, textColor=INK))
styles.add(ParagraphStyle(name="Price", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=8.8, leading=11.5, textColor=INK, alignment=TA_RIGHT))
styles.add(ParagraphStyle(name="BulletCustom", parent=styles["BodyText"], fontName="GalateeSans", fontSize=8.5, leading=11.8, leftIndent=11, firstLineIndent=-8, textColor=INK, spaceAfter=2))
styles.add(ParagraphStyle(name="MetaLabel", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=7.5, leading=10, textColor=MUTED, spaceAfter=3))
styles.add(ParagraphStyle(name="MetaValue", parent=styles["BodyText"], fontName="GalateeSans", fontSize=9, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="FinalTotal", parent=styles["BodyText"], fontName="GalateeSans-Bold", fontSize=18, leading=20, textColor=INK, alignment=TA_RIGHT))


def p(text, style="Body"):
    return Paragraph(text, styles[style])


def bullets(items):
    return [p(f"- {item}", "BulletCustom") for item in items]


def heading(number, title):
    return [p(f"{number}  |  {title.upper()}", "Kicker"), p(title, "Section")]


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


def meta_block():
    table = Table([
        [p("CLIENT", "MetaLabel"), p("STATUT DU DOCUMENT", "MetaLabel")],
        [p("Restaurant Galatee<br/>Hydra, Alger", "MetaValue"), p("Projet de commande en ligne<br/>Périmètre à valider", "MetaValue")],
    ], colWidths=[85 * mm, 85 * mm])
    table.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, LINE),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("TOPPADDING", (0, 1), (-1, 1), 8),
        ("BOTTOMPADDING", (0, 1), (-1, 1), 10),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def simple_table(rows, widths, repeat_rows=0):
    table = Table(rows, colWidths=widths, repeatRows=repeat_rows)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, LINE),
        ("LINEBELOW", (0, 1), (-1, -1), 0.45, LINE),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return table


def finance_block():
    recap = simple_table([
        [p("PRESTATION", "HeaderCell"), p("MONTANT", "HeaderCell")],
        [p("Frontend du site et parcours de commande", "Cell"), p("75 000 DA", "Price")],
        [p("Backend, API, base de données et back-office", "Cell"), p("100 000 DA", "Price")],
        [p("Sécurité et authentification", "Cell"), p("20 000 DA", "Price")],
        [p("SEO technique, local et AISEO", "Cell"), p("15 000 DA", "Price")],
        [p("Déploiement et mise en production", "Cell"), p("10 000 DA", "Price")],
    ], [132 * mm, 38 * mm])
    total = Table([[p("TOTAL DU PROJET", "CellTitle"), p("220 000 DA", "FinalTotal")]], colWidths=[105 * mm, 65 * mm])
    total.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 1, LINE),
        ("TOPPADDING", (0, 0), (-1, 0), 11),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 5),
        ("LEFTPADDING", (0, 0), (-1, 0), 0),
        ("RIGHTPADDING", (0, 0), (-1, 0), 0),
        ("VALIGN", (0, 0), (-1, 0), "TOP"),
    ]))
    option = Table([[p("OPTION SÉPARÉE  /  CHATBOT RAG VOCAL", "CellTitle"), p("60 000 DA", "Price")]], colWidths=[132 * mm, 38 * mm])
    option.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), PALE),
        ("LINEBELOW", (0, 0), (-1, 0), 0.45, LINE),
        ("TOPPADDING", (0, 0), (-1, 0), 7),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 7),
        ("LEFTPADDING", (0, 0), (-1, 0), 7),
        ("RIGHTPADDING", (0, 0), (-1, 0), 7),
    ]))
    return recap, option, total


def build_technical():
    output = OUTPUT_DIR / "devis-galatee-technique-provisoire.pdf"
    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=17 * mm, bottomMargin=21 * mm, title="Devis Galatee - Technique provisoire", author="Galatee")
    story = [Spacer(1, 18 * mm), p("DEVIS TECHNIQUE PROVISOIRE", "Kicker"), Spacer(1, 5 * mm), p("Galatee", "CoverTitle"), p("Plateforme de commande en ligne, fidélité et pilotage digital", "Lead"), Spacer(1, 13 * mm), meta_block(), Spacer(1, 11 * mm)]
    story += [p("Ce document est provisoire : les règles de livraison par commune, les paramètres WhatsApp, le périmètre exact des statistiques et les choix d'hébergement seront validés avec le restaurant avant la version finale.", "Body"), PageBreak()]

    story += heading("01", "Frontend et interface publique")
    story += [p("Conception du site public et du parcours de commande, avec une expérience claire sur mobile et une présentation éditoriale sur desktop.", "Body")]
    story += bullets([
        "Pages publiques : Accueil, Menu, détail d'un plat, commande, Informations et Contact.",
        "Catalogue administrable affichant titre, description, prix, catégorie, disponibilité et image.",
        "Panier avec ajout, suppression, modification des quantités et récapitulatif avant envoi.",
        "Choix entre retrait sur place et livraison à l'adresse du client dans la wilaya d'Alger.",
        "Paiement prévu à la livraison ou au retrait, sans paiement en ligne dans ce périmètre.",
        "Création de compte facultative et connexion sans mot de passe par code temporaire envoyé par email.",
        "Préremplissage des informations connues, historique des commandes et suivi de la commande en cours.",
        "États de chargement, erreurs, confirmation, annulation et validation adaptés au parcours mobile.",
        "Animations, survols, transitions, clavier, contraste et zones tactiles conformes aux usages courants.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("02", "Backend, API et back-office")
    story += [p("Mise en place du coeur métier qui reçoit les commandes, conserve les informations clients et donne au restaurant un outil de traitement quotidien.", "Body")]
    story += bullets([
        "API REST structurée pour le menu, le panier, les commandes, les comptes, les promotions et les statistiques.",
        "Base PostgreSQL avec modèles séparés pour clients, plats, commandes, lignes de commande, paiements, promotions et événements analytiques.",
        "Création d'une commande en statut en attente, puis traitement par l'employé après appel téléphonique.",
        "Actions backoffice : confirmer, annuler, marquer comme payée, préparer et terminer une commande.",
        "Notification d'une nouvelle commande dans le backoffice et via l'automatisation WhatsApp prévue pour l'employé.",
        "Gestion de la livraison à Alger avec adresse et commune ; module de tarifs par commune prévu comme évolution configurable.",
        "Fiches clients persistantes avec coordonnées, consentement de contact, historique et commandes en cours.",
        "Compteur de fidélité basé sur les commandes effectivement payées, avec remise déclenchée après dix achats.",
        "Gestion d'un code promotionnel ou d'une remise attribuée au client, avec état utilisé et date d'expiration si nécessaire.",
        "Gestion des plats : création, modification, publication, archivage, prix, description et import d'image par sélection ou glisser-déposer.",
        "Statistiques : visites, visiteurs, consultations du menu, paniers, commandes commencées, commandes confirmées, commandes annulées, conversion et chiffre d'affaires.",
        "Filtres par période avec vues jour, semaine, mois et année, et agrégation basée sur les commandes confirmées selon la règle validée.",
    ])

    story.append(PageBreak())
    story += heading("03", "Sécurité et authentification")
    story += [p("Protection des comptes, des données clients et des opérations du restaurant.", "Body")]
    story += bullets([
        "HTTPS obligatoire avec certificat TLS valide pour le site et l'API.",
        "Validation, normalisation et nettoyage des données de chaque formulaire et de chaque requête.",
        "Requêtes paramétrées via Prisma ORM afin de prévenir les injections SQL.",
        "Codes de connexion à durée courte, usage unique et limitation des tentatives.",
        "Sessions sécurisées avec cookies HttpOnly, Secure et SameSite lorsque le domaine le permet.",
        "Authentification et contrôle des permissions sur les routes privées du backoffice.",
        "Rate limiting sur la connexion, les commandes, les notifications et les endpoints publics sensibles.",
        "Contrôle des images importées : type, extension, taille et stockage hors des fichiers exécutables.",
        "CORS limité aux domaines autorisés, secrets dans les variables d'environnement et journaux sans données sensibles.",
        "Traçabilité des changements de statut et protection contre les doubles traitements d'une commande.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("04", "SEO technique et local")
    story += [p("Optimisation de la visibilité de Galatee dans les recherches locales et de la compréhension du contenu par les moteurs de recherche et les assistants IA.", "Body")]
    story += bullets([
        "Balises title, meta description et titres H1/H2 pour identifier clairement chaque page.",
        "Sitemap.xml pour déclarer aux moteurs de recherche les pages publiques disponibles.",
        "Robots.txt pour guider l'exploration et exclure les espaces privés comme le compte et le backoffice.",
        "Données structurées Schema.org / JSON-LD pour décrire le restaurant, l'adresse, les horaires et le menu.",
        "URLs canoniques et redirections propres pour éviter les doublons d'indexation.",
        "Open Graph pour contrôler l'aperçu des pages partagées sur les réseaux sociaux.",
        "Optimisation locale autour de Hydra, Alger et de la spécialité pâtes fraîches.",
        "AISEO : structure et formulation du contenu pour faciliter sa compréhension par les moteurs de recherche et les assistants basés sur l'IA.",
        "Optimisation du poids des pages, des images et des performances mobiles.",
    ])

    story.append(PageBreak())
    story += heading("05", "Architecture technique cible")
    story += [p("Stack proposée pour une version finale évolutive. Le choix définitif pourra être ajusté après validation des contraintes d'exploitation du restaurant.", "Body")]
    stack = simple_table([
        [p("COUCHE", "HeaderCell"), p("CHOIX PROPOSÉ", "HeaderCell"), p("RÔLE", "HeaderCell")],
        [p("Frontend", "CellTitle"), p("Next.js + TypeScript + Tailwind CSS + shadcn/ui + Lucide", "Cell"), p("Site public, commande et espace client.", "Cell")],
        [p("Backoffice", "CellTitle"), p("Next.js + TypeScript, interface privée", "Cell"), p("Traitement des commandes, menu, clients et statistiques.", "Cell")],
        [p("Backend", "CellTitle"), p("NestJS + TypeScript + API REST", "Cell"), p("Logique métier, comptes, commandes et notifications.", "Cell")],
        [p("Données", "CellTitle"), p("PostgreSQL + Prisma ORM", "Cell"), p("Données structurées et évolutives.", "Cell")],
        [p("Email / WhatsApp", "CellTitle"), p("Service transactionnel et API WhatsApp Business", "Cell"), p("Codes email et notification de l'employé.", "Cell")],
        [p("Fichiers", "CellTitle"), p("Stockage objet compatible S3", "Cell"), p("Images du menu avec contrôle des accès.", "Cell")],
    ], [30 * mm, 82 * mm, 58 * mm], repeat_rows=1)
    story += [stack, Spacer(1, 7 * mm), p("OPTION NON COMPRISE DANS LE TOTAL", "Kicker")]
    story += bullets([
        "Chatbot RAG vocal : base de connaissances contrôlée sur le menu, les horaires, l'adresse, les allergènes et les règles de commande.",
        "Réponses en français, arabe, darija et anglais, sans création de commande ni modification des données.",
        "Mode vocal pour parler et écouter la réponse, selon le service vocal retenu.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("06", "Déploiement, livraison et maintenance")
    story += bullets([
        "Configuration de l'environnement de production, de PostgreSQL, du stockage des images et des variables secrètes.",
        "Déploiement séparé du site public, de l'API et du backoffice avec accès HTTPS.",
        "Configuration du service email et préparation de l'intégration WhatsApp Business pour les notifications employé.",
        "Tests de bout en bout : création de compte, commande, appel de confirmation, paiement, fidélité, menu et statistiques.",
        "Documentation courte, transmission des accès et procédure de sauvegarde/restauration.",
        "Les communes, règles et tarifs de livraison seront ajoutés après validation du fonctionnement réel avec le restaurant.",
    ])
    story += [PageBreak(), p("FRAIS EXTERNES", "Kicker"), p("Nom de domaine, hébergement, base PostgreSQL, stockage d'images, service email, API WhatsApp Business et éventuels services vocaux ou IA ne sont pas inclus dans le montant du projet.", "Body"), Spacer(1, 5 * mm), p("RÉCAPITULATIF FINANCIER", "Kicker")]
    recap, option, total = finance_block()
    story += [recap, Spacer(1, 5 * mm), option, Spacer(1, 7 * mm), total]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output


def build_functional():
    output = OUTPUT_DIR / "devis-galatee-fonctionnel.pdf"
    doc = SimpleDocTemplate(str(output), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=17 * mm, bottomMargin=21 * mm, title="Devis Galatee - Fonctionnel", author="Galatee")
    story = [Spacer(1, 18 * mm), p("DEVIS FONCTIONNEL", "Kicker"), Spacer(1, 5 * mm), p("Galatee", "CoverTitle"), p("Site de commande en ligne et outil de gestion du restaurant", "Lead"), Spacer(1, 13 * mm), meta_block(), Spacer(1, 11 * mm), p("Cette proposition présente les fonctionnalités prévues. Les détails de livraison, de communication WhatsApp et de statistiques pourront être précisés avec le restaurant avant le lancement définitif.", "Body"), PageBreak()]

    story += heading("01", "Frontend et interface publique")
    story += [p("Le site permet aux clients de découvrir la carte et de commander facilement depuis leur téléphone ou leur ordinateur.", "Body")]
    story += bullets([
        "Une page d'accueil claire qui présente Galatee et conduit naturellement vers la carte.",
        "Une carte avec les plats, leurs photos, leurs descriptions et leurs prix.",
        "Un panier simple pour choisir les plats et modifier les quantités.",
        "Le choix entre retirer la commande sur place ou se faire livrer à Alger.",
        "Un formulaire de commande avec les coordonnées et l'adresse de livraison.",
        "Le paiement est prévu au moment de la livraison ou du retrait.",
        "Un compte facultatif pour ne pas ressaisir ses informations à chaque commande.",
        "Un espace personnel avec les commandes en cours et l'historique des commandes.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("02", "Backend, API et back-office")
    story += [p("Le logiciel du restaurant centralise les commandes et donne à l'équipe une vue claire de ce qu'elle doit traiter.", "Body")]
    story += bullets([
        "Chaque nouvelle commande apparaît dans le logiciel dès son envoi.",
        "L'employé reçoit une notification et appelle le client pour confirmer ou annuler la commande.",
        "Le logiciel suit les étapes : en attente, confirmée, annulée, payée, en préparation et terminée.",
        "Les informations des clients sont conservées avec leur historique de commandes.",
        "Après dix commandes payées, le client peut recevoir une réduction.",
        "Le restaurant peut gérer les plats, les prix, les descriptions, les photos et leur publication.",
        "La livraison commence par une adresse dans la wilaya d'Alger ; les communes et les tarifs pourront être ajoutés ensuite.",
        "Le tableau de bord présente les visites, les consultations de la carte, les paniers, les commandes et leur évolution.",
        "Le chiffre d'affaires en ligne est calculé à partir des commandes validées selon la règle choisie avec le restaurant.",
    ])

    story.append(PageBreak())
    story += heading("03", "Sécurité et authentification")
    story += [p("Les données des clients et les commandes sont protégées afin que seules les personnes autorisées puissent accéder au logiciel.", "Body")]
    story += bullets([
        "Les échanges entre le site et le logiciel sont protégés par HTTPS.",
        "Les informations saisies dans les formulaires sont contrôlées avant d'être enregistrées.",
        "Les accès au logiciel sont protégés et les actions importantes sont limitées aux personnes autorisées.",
        "Les codes de connexion envoyés par email sont temporaires et utilisables une seule fois.",
        "Les demandes répétées et les fichiers importés sont contrôlés pour éviter les abus.",
        "Les données sensibles ne sont pas exposées dans les pages publiques ni dans les journaux techniques.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("04", "SEO technique et local")
    story += [p("Le SEO aide les clients à trouver Galatee lorsqu'ils recherchent un restaurant de pâtes fraîches à Hydra ou à Alger.", "Body")]
    story += bullets([
        "Title : le titre affiché par Google pour chaque page.",
        "Meta description : un court résumé qui donne envie d'ouvrir le résultat.",
        "H1 et H2 : des titres organisés pour rendre le contenu compréhensible.",
        "Sitemap.xml : une liste des pages publiques que Google peut découvrir.",
        "Robots.txt : des indications pour éviter l'exploration des espaces privés.",
        "Données structurées : des informations lisibles par Google sur le restaurant, les horaires et le menu.",
        "SEO local : mise en avant de Hydra, Alger, de l'adresse, des horaires et de l'activité du restaurant.",
        "AISEO : rédaction et organisation du contenu pour qu'il soit mieux compris par les moteurs de recherche et les assistants IA.",
        "Pages et images allégées pour un chargement rapide sur mobile.",
    ])

    story.append(PageBreak())
    story += heading("05", "Architecture technique cible")
    story += [p("Le projet est organisé pour pouvoir évoluer avec le restaurant : le site, le logiciel de gestion et les données sont reliés mais séparés pour rester fiables.", "Body")]
    story += bullets([
        "Le site public accueille les clients et présente la carte.",
        "Le logiciel interne reçoit les commandes et aide l'équipe à les traiter.",
        "Une base de données conserve les clients, les plats, les commandes, les paiements, les réductions et les statistiques.",
        "Les informations de livraison sont prévues pour Alger, avec une évolution future par commune et par tarif.",
        "Les services d'email et de WhatsApp servent à envoyer les codes et les notifications utiles.",
    ])

    story += [Spacer(1, 5 * mm)] + heading("06", "Déploiement, livraison et maintenance")
    story += bullets([
        "Mise en ligne du site et installation de l'outil de gestion.",
        "Configuration des emails de connexion et des notifications de nouvelles commandes.",
        "Vérification du parcours complet : compte, commande, appel client, confirmation, paiement et fidélité.",
        "Vérification du menu, des images, des statistiques et de l'affichage sur mobile et ordinateur.",
        "Transmission d'une documentation simple pour l'utilisation quotidienne.",
    ])
    story += [Spacer(1, 5 * mm), p("FRAIS EXTERNES", "Kicker"), p("Le nom de domaine, l'hébergement, le stockage des images, le service email, WhatsApp Business et les éventuels services vocaux ou IA sont facturés séparément.", "Body"), Spacer(1, 5 * mm), p("RÉCAPITULATIF FINANCIER", "Kicker")]
    recap, option, total = finance_block()
    story += [recap, Spacer(1, 5 * mm), option, Spacer(1, 7 * mm), total]
    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    return output


if __name__ == "__main__":
    for path in (build_technical(), build_functional()):
        print(path)
