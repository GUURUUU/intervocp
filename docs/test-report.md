# Rapport de tests — IntervOCP

Date d'exécution : 14/11/2026 · Environnement : Windows, Node 22, Chrome headless (Playwright).

## Synthèse

| Suite | Commande | Résultat |
|---|---|---|
| Type-check (TypeScript strict) | `npm run type-check` | ✅ 0 erreur |
| Lint (ESLint 9 flat config) | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Tests unitaires (Vitest 5) | `npm test` | ✅ **40/40** |
| Tests E2E (Playwright, Chromium) | `npm run e2e` | ✅ **22/22** |

## 1. Tests unitaires — Vitest (40 tests)

Logique pure extraite pour être testée sans base de données :

| Fichier | Sujet | Tests |
|---|---|---|
| `tests/suggestion-scoring.test.ts` | Algorithme de suggestion : chevauchements, compétence, disponibilité (couvert/bloqué/inconnu), charge, distance, score total pondéré | 17 |
| `tests/status-transitions.test.ts` | Machine à états : chemins valides, interdits, retours arrière, statuts terminaux, auto-transition | 7 |
| `tests/geo.test.ts` | Haversine : zéro, symétrie, ~111 km/degré lat, monotone, grandes distances | 5 |
| `tests/format.test.ts` | formatMad, formatDuration, formatDate/DateTime (indépendants du fuseau) | 11 |

Points vérifiés en particulier :

- les **pondérations de suggestion** somment à 1 et produisent le classement
  attendu (candidat parfait > candidat médiocre) ;
- le **chevauchement de créneaux** rejette les bornes se touchant
  (pas de double-réservation au contact des bornes) ;
- les **statuts terminaux** (CLOTUREE, ANNULEE) ne laissent aucune sortie ;
- `formatMad` gère les séparateurs de milliers locale-dépendants (point ou
  espace insécable) — couvert par une regex tolérante.

## 2. Tests E2E — Playwright (22 tests)

Exécutés contre le serveur de dev Next.js, base PostgreSQL de démo, un worker
séquentiel. Sessions par rôle pré-établies dans `e2e/auth.setup.ts`
(storageState).

| Spéc | Sujet | Tests |
|---|---|---|
| `login.spec.ts` | Refus de mauvais identifiants, connexion admin, redirection anonyme | 3 |
| `dashboard.spec.ts` | KPIs + 4 graphiques Recharts (admin), page Administration (9 comptes, 5 stats) | 2 |
| `requests.spec.ts` | Liste, fiche détail + bouton PDF, endpoint PDF (%PDF- valide), création via dialogue | 4 |
| `dispatcher.spec.ts` | Dialogue de suggestion (scores affichés), planning hebdo | 2 |
| `planning.spec.ts` | Grille de la semaine + navigation entre semaines | 2 |
| `tracking.spec.ts` | Carte Leaflet + marqueurs, colonnes kanban, simulateur | 3 |
| `stock.spec.ts` | Catalogue + valorisation, recherche insensible, dialogue réapprovisionnement | 3 |
| `reports.spec.ts` | KPIs + export CSV téléchargé (BOM, en-têtes, lignes), KPIs scopés client sans export | 3 |

Anomalies détectées **et corrigées** pendant la campagne E2E :

1. Recherche de pièces **sensible à la casse** ("ampoule" ne trouvait pas
   "Ampoule halogène") → `mode: "insensitive"` ajouté sur `Part.name` et
   `Part.reference` (régression couverte par `stock.spec`).

## 3. Qualité statique

- TypeScript `strict` sans aucune erreur (`tsc --noEmit`).
- ESLint 9 (config flat `eslint-config-next`) : 0 erreur / 0 warning.
- Conventions : UI en français, code en anglais.

## 4. Captures d'écran (générées par `docs/scripts/screenshots.ts`)

`docs/screenshots/` — 13 vues : login, dashboard/requests/planning/tracking/
stock/reports/administration (admin), dialogue de suggestion (répartiteur),
dashboard + kanban (technicien), dashboard (client), rapports (responsable).

## 5. Limites des tests

- Les E2E s'appuient sur le jeu de données de démonstration (seed) ;
  le test de création ajoute une demande "Test E2E" — sans impact.
- Le temps réel (SSE) est vérifié implicitement (marqueurs, kanban) mais pas
  de façon déterministe multi-clients.
- Pas de test de charge (hors périmètre stage).
