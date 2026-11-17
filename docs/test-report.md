# Rapport de tests — IntervOCP

Dernière exécution : 17/11/2026 · Windows, Node 24, TypeScript 5.9.

## Synthèse

| Suite | Commande | Résultat |
|---|---|---|
| Type-check (TypeScript strict) | `npm run type-check` | ✅ 0 erreur |
| Lint (ESLint 9 flat config) | `npm run lint` | ✅ 0 erreur, 0 avertissement |
| Build de production | `npm run build` | ✅ succès (toutes les routes compilées) |
| Tests unitaires (Vitest 5) | `npm test` | ✅ **40/40** |
| Tests E2E (Playwright) | `npm run e2e` | ✅ **27/27** |
| Lint PHP (projet de gestion PHP) | `php -l` | ✅ 22/22 fichiers sans erreur |

> Note honnête : les E2E tournent en `next dev` contre la base PostgreSQL de
> démonstration (Docker), réinitialisée avec `npm run db:seed` avant la passe.
> Les 3 échecs initiaux étaient des attentes obsolètes (ancien tableau de bord
> unique, en-tête dupliqué) : specs mises à jour et `h2` de la coque remplacé
> par un `p` pour ne garder qu'un seul `h1` par page.

## 1. Tests unitaires — Vitest (40 tests)

| Fichier | Sujet | Tests |
|---|---|---|
| `tests/suggestion-scoring.test.ts` | Suggestion : chevauchements, compétence, disponibilité, charge, distance, score pondéré | 22 |
| `tests/status-transitions.test.ts` | Machine à états : chemins valides, interdits, statuts terminaux | 7 |
| `tests/geo.test.ts` | Haversine : zéro, symétrie, ~111 km/degré, monotonie | 5 |
| `tests/format.test.ts` | formatMad, formatDuration, formatDate/DateTime | 6 |

## 2. Tests E2E — Playwright (27 tests)

Sessions par rôle pré-établies (`e2e/auth.setup.ts`), un worker séquentiel.

| Spéc | Sujet | Tests |
|---|---|---|
| `login.spec.ts` | Refus de mauvais identifiants, connexion admin routée vers son espace, redirection anonyme | 3 |
| `dashboard.spec.ts` | Un tableau de bord par rôle (admin, répartiteur, technicien, client, responsable), contrôle d'accès client, page Administration | 7 |
| `requests.spec.ts` | Liste, fiche + PDF, création via dialogue | 4 |
| `dispatcher.spec.ts` | Suggestion de techniciens, planning hebdo | 2 |
| `planning.spec.ts` | Grille de la semaine + navigation | 2 |
| `tracking.spec.ts` | Étapes du circuit, colonnes kanban, filtre par étape (sans GPS) | 3 |
| `stock.spec.ts` | Catalogue, valorisation, recherche, réapprovisionnement | 3 |
| `reports.spec.ts` | KPIs, export CSV, scope client | 3 |

## 3. Qualité statique

- `tsc --noEmit` : 0 erreur.
- ESLint : 0 erreur / 0 avertissement (les skills installés sous `.agents/`
  sont exclus du lint, ce sont des bundles tiers).
- Conventions : UI en français, code en anglais.

## 4. Vérifications de sécurité effectuées

- Rate-limit de connexion : 5 échecs / 15 min → blocage 15 min, compteur
  remis à zéro après succès (`src/lib/auth/rate-limit.ts`).
- En-têtes vérifiés dans `next.config.ts` (CSP, `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS).
- Les 24 routes API restent protégées par `requireSession` / RBAC ; les règles
  métier (visibilité, transitions, notation) sont dans les services.

## 5. Limites connues

- Le rate-limit est en mémoire : il protège un processus Node unique. Pour un
  déploiement multi-instances, le déplacer vers Redis.
- Pas de test de charge.
