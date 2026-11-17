# Analyse des besoins — IntervOCP

> Projet de stage : plateforme de gestion des interventions techniques pour le
> service IT du site OCP de Khouribga. Document traduit en exigences
> fonctionnelles (RF) et non fonctionnelles (RNF), chacune mappée sur
> l'implémentation livrée.

## 1. Contexte

Le service IT de Khouribga reçoit des demandes d'intervention (pannes,
préventif, urgences) provenant des services utilisateurs. Aujourd'hui le suivi
se fait par e-mail et tableur : perte de traçabilité, affectations à l'aveugle,
retards invisibles, stocks non coordonnés. L'objectif est une application web
unique couvrant **le cycle de vie complet** : demande → planification →
exécution → clôture → évaluation → reporting.

## 2. Acteurs et profils

| Acteur | Rôle applicatif | Portée |
|---|---|---|
| Employé OCP | `CLIENT` | Créer / suivre / évaluer **ses** demandes |
| Technicien | `TECHNICIAN` | Demandes visibles, exécution, pièces, incidents |
| Répartiteur | `DISPATCHER` | Orchestration : planning, affectations, stock |
| Responsable | `MANAGER` | Supervision : KPIs, rapports, exports |
| Administrateur | `ADMIN` | Tout + comptes, référentiels, suppressions |

## 3. Exigences fonctionnelles

### Module 1 — Authentification & RBAC (RF-01..04)

- **RF-01** Connexion par email/mot de passe (bcrypt), session JWT httpOnly.
- **RF-02** Redirection automatique vers `/login` si non authentifié.
- **RF-03** Masquage UI **et** contrôle serveur par rôle (défense en profondeur).
- **RF-04** Comptes de démonstration pour les 5 profils.
- **RF-04b** Après connexion, chaque compte est routé automatiquement vers
  le tableau de bord de son rôle (aucune sélection manuelle), et les pages
  hors périmètre le renvoient sur ce même tableau de bord.

### Module 2 — Demandes (RF-05..11)

- **RF-05** Création par le client : titre, description, type (corrective /
  préventive / urgente), priorité (4 niveaux), équipement, compétence
  souhaitée, localisation. Référence lisible `INT-<année>-<numéro>`.
- **RF-06** Liste filtrable (statut, type, priorité) + recherche + pagination.
- **RF-07** Fiche détail : informations, historique de statuts, commentaires,
  pièces jointes (upload image/pdf/txt), incidents, pièces consommées,
  satisfaction.
- **RF-08** Machine à états stricte (voir `docs/uml/activity-lifecycle.png`) :
  NOUVELLE → PLANIFIEE → EN_COURS → (EN_ATTENTE_PIECES ⇄) → TERMINEE →
  CLOTUREE ; ANNULEE depuis tout statut ouvert ; transitions interdites
  rejetées en 409.
- **RF-09** Droits de transition par rôle (le client ne peut qu'annuler, le
  technicien piloter l'exécution, le bureau tout).
- **RF-10** Commentaires par intervention avec auteur et horodatage.
- **RF-11** Évaluation (note 1-5 + commentaire) par le demandeur à la clôture.

### Module 3 — Planification & affectation (RF-12..15)

- **RF-12** Grille hebdomadaire techniciens × créneaux (semaine courante,
  navigation précédent/suivant), demandes à planifier listées à part.
- **RF-13** **Suggestion intelligente** : classement des techniciens pour un
  créneau = 40 % compétence + 25 % disponibilité + 20 % charge + 15 % distance
  géographique, avec inéligibilité explicite (congé, double-réservation) et raisons
  lisibles pour le répartiteur.
- **RF-14** Affectation manuelle avec contrôle anti double-réservation (409).
- **RF-15** Fenêtres de disponibilité WORK/LEAVE/BUSY prises en compte.

### Module 4 — Suivi des interventions (RF-16..19)

- **RF-16** Circuit visuel par demande : Demande → Planifiée → En cours →
  Terminée → Clôturée, avec l'horodatage de chaque étape franchie.
- **RF-17** Vue « où en est chaque demande » : technicien affecté, priorité,
  statut courant, temps écoulé dans l'étape et filtres par étape.
- **RF-18** Aucune géolocalisation : le suivi porte sur l'avancement métier,
  pas sur la position physique des techniciens.
- **RF-19** Kanban de statuts avec glisser-déposer respectant la machine à
  états et les droits (SSE : rafraîchissement multi-clients instantané).

### Module 5 — Stock (RF-20..23)

- **RF-20** Catalogue de pièces : recherche insensible à la casse, filtre
  "stock bas", valorisation totale en MAD.
- **RF-21** Création / édition de pièces (ADMIN), référence unique (409).
- **RF-22** Réapprovisionnement avec mouvement journalisé + alerte si sous
  seuil (notification + événement `stock.low`).
- **RF-23** Déclaration de consommation par l'intervention : décrément +
  mouvement atomiques, 409 si stock insuffisant.

### Module 6 — Rapports & pilotage (RF-24..27)

- **RF-24** Dashboard par rôle : KPIs (volume, délai moyen de résolution,
  taux de retard, satisfaction, coût pièces du mois) + 4 graphiques Recharts.
- **RF-25** Charge par technicien (actives / terminées / heures).
- **RF-26** Export CSV des interventions (bureau) — séparateur `;`, BOM UTF-8
  pour Excel, dates ISO.
- **RF-27** Rapport PDF par intervention (demandeur / affecté / bureau) :
  informations, historique, pièces, incidents, commentaires, évaluation.

### Module 7 — Administration (RF-28..29)

- **RF-28** Vue d'ensemble comptes internes (compétences, état) + parc +
  référentiels.
- **RF-29** Notifications in-app ciblées (centre de notifications + badge).

## 4. Exigences non fonctionnelles

| ID | Exigence | Implémentation |
|---|---|---|
| RNF-01 | Sécurité : sessions httpOnly, bcrypt, contrôle serveur partout | Auth.js v5 + `requireSession(roles)` dans chaque route |
| RNF-02 | Performance perçue : mises à jour temps réel sans recharger | SSE ciblé + refetch automatique |
| RNF-03 | Ergonomie FR soignée, thème "liquid glass" light cohérent | Design system custom (glass-panel, shaders, 3D) |
| RNF-04 | Données cohérentes : opérations multi-écritures atomiques | Transactions Prisma + 409 métier |
| RNF-05 | Maintenabilité : logique métier centralisée, typée, testée | Services + Zod + Vitest (unit) + Playwright (E2E) |
| RNF-06 | Démo reproductible : seed réaliste | `prisma/seed.ts` |
| RNF-07 | Livrables documentaires complets | `docs/` : exigences, UML (PNG), BDD, architecture, API, tests |

## 5. Traçabilité implémentation ↔ exigences

| Module | Pages / composants | Services | Tests |
|---|---|---|---|
| Auth | `/login`, middleware RBAC | `auth/`, `rbac.ts` | E2E login.spec |
| Tableaux de bord | `/dashboard` — une vue par rôle | `dashboard.ts` | E2E dashboard.spec + vérif. des 5 rôles |
| Demandes | `/requests`, fiche détail | `requests.ts` | E2E requests.spec |
| Planning | `/planning`, SuggestDialog | `planning.ts`, `suggestion-scoring.ts` | Vitest scoring + E2E dispatcher |
| Suivi | `/tracking`, circuit + Kanban | `tracking.ts`, `events.ts` | E2E tracking.spec |
| Stock | `/stock`, fiche détail (pièces) | `stock.ts` | E2E stock.spec |
| Rapports | `/reports`, PDF | `reports.ts` | E2E reports.spec + PDF |
| Admin | `/admin` | — | E2E dashboard.spec |
