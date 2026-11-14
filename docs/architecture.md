# Architecture technique — IntervOCP

## Vue d'ensemble

Application web **Next.js 15 (App Router)** en TypeScript, React 19, rendue en
pleine avec un backend intégré (Route Handlers + Server Actions). Tout tient
dans un seul déploiement : pas d'API séparée, pas de microservices — le contexte
stage impose la simplicité opérationnelle.

```
┌──────────────────────────────────────────────────────────────┐
│                      Navigateur (PWA-ready)                   │
│  React 19 · Tailwind 4 · Leaflet · Recharts · react-three-fiber│
└───────────────▲──────────────────────────────▲───────────────┘
        fetch/REST │                       SSE │
┌───────────────┴──────────────────────────────┴───────────────┐
│                    Next.js 15 (App Router)                    │
│  • Pages (App Router, RSC)          src/app/(app)/**          │
│  • Route Handlers /api/**           src/app/api/**            │
│  • Server Actions (login)           src/app/login/actions.ts  │
│  • Services métier                  src/server/services/**    │
│  • Auth Auth.js v5 (JWT cookie)     src/lib/auth/**           │
│  • Event bus interne                src/lib/events.ts         │
└──────────────────────────────┬───────────────────────────────┘
                               │ Prisma ORM
                    ┌──────────┴──────────┐
                    │  PostgreSQL 16      │
                    │  (Docker, volume    │
                    │   persistant)       │
                    └─────────────────────┘
```

## Choix techniques

| Domaine | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 15 + React 19 | SSR/RSC, API intégrée, écosystème mature |
| Langage | TypeScript strict | Fiabilité, autocomplétion Prisma |
| UI | Tailwind CSS 4 + shadcn/ui (Radix) | Rapide, accessible, thème glass light custom |
| 3D / design | three.js + @react-three/fiber + @shadergradient/react | Identité visuelle « liquid glass » (icône équipement 3D, fond shader) |
| ORM | Prisma 6 | Typage end-to-end, migrations, SQL brut possible (`$queryRaw`) |
| BDD | PostgreSQL 16 | `DISTINCT ON`, `contains insensitive`, JSON-ready |
| Auth | Auth.js v5 (next-auth beta) credentials + JWT httpOnly | Simple, RBAC côté serveur |
| Temps réel | SSE (EventSource) + event bus en mémoire | Suffisant en mono-instance, zéro dépendance externe |
| Cartes | Leaflet + react-leaflet (tiles OSM) | Léger, open source |
| Graphiques | Recharts 3 | Charts déclaratifs React 19 |
| PDF | @react-pdf/renderer (`renderToBuffer`) | Génération serveur sans navigateur |
| Tests | Vitest 5 (unit) + Playwright (E2E) | Rapide / fidèle au navigateur réel |

## Organisation du code

```
src/
├── app/
│   ├── (app)/               # pages authentifiées (shell + sidebar)
│   │   ├── dashboard/       # KPIs Recharts + gradient shader
│   │   ├── requests/        # liste + fiche détail dynamique
│   │   ├── planning/        # grille hebdomadaire + DnD
│   │   ├── tracking/        # carte live + kanban statuts
│   │   ├── stock/           # catalogue + réapprovisionnement
│   │   ├── reports/         # rapports + export CSV
│   │   └── admin/           # vue d'ensemble comptes/parc
│   ├── api/                 # route handlers (voir api.md)
│   ├── login/               # page publique + Server Action
│   └── layout.tsx, globals.css
├── components/              # composants client (glass UI)
├── hooks/                   # use-event-stream (SSE)
├── lib/                     # prisma, auth, events, format, geo…
├── server/services/         # logique métier (requests, planning,
│                            # stock, tracking, reports, suggestion-scoring)
└── validation/              # schémas Zod par domaine
```

**Principes :**

1. **Les Route Handlers ne contiennent aucune logique** — ils authentifient
   (`requireSession([...roles])`), valident le corps (Zod) puis délèguent à un
   service. Réponses homogènes via `handleRoute` (erreurs métier `ApiError`
   → code HTTP + message FR).
2. **RBAC systématique** : chaque service reprend `user = { id, role }` et
   filtre les données par rôle (CLIENT → ses demandes, TECHNICIAN → affecté,
   rôles internes → global).
3. **Temps réel ciblé** : l'event bus publie `intervention.status`,
   `intervention.assigned`, `comment.created`, `incident.created`,
   `location.ping`, `stock.low`… avec une liste de destinataires (rôles +
   users). Le hook `useEventStream` refetch automatiquement.
4. **Transactions Prisma** partout où plusieurs écritures doivent être
   atomiques : référence annuelle, affectation + historique, consommation
   pièce + décrément stock + mouvement.
5. **Scoring pur** : le module `suggestion-scoring.ts` ne fait aucune I/O —
   il est couvert par des tests unitaires Vitest.

## Sécurité

- Sessions JWT signées (Auth.js), cookie `httpOnly` `Secure` en prod.
- Vérification du rôle dans **chaque** endpoint (défense en profondeur avec le
  masquage UI).
- Uploads limités (types image/pdf/txt, taille), servis via route authentifiée.
- Hash bcrypt (coût 10) ; comptes de démo préremplis uniquement.

## Limites connues (volontaires, contexte démo)

- L'event bus et le simulateur de pings vivent en mémoire : mono-instance.
- Tiles OSM et CDN kroki : nécessitent Internet.
- Pas de files d'attente ni de cache distribué (inutile à cette échelle).
