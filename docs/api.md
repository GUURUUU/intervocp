# API — IntervOCP

Tous les endpoints sont sous `/api`, authentifiés par cookie de session
Auth.js (`httpOnly`). Les réponses d'erreur sont normalisées :

```json
{ "error": "Message en français", "status": 403 }
```

Rôles : `ADMIN`, `DISPATCHER`, `TECHNICIAN`, `CLIENT`, `MANAGER`.
« Bureau » = ADMIN + DISPATCHER (+ MANAGER selon l'endpoint).

## Demandes d'intervention

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/requests` | GET | tous (scopé par rôle) | Liste paginée + filtres (statut, type, priorité, recherche, lowStock n/a) |
| `/api/requests` | POST | CLIENT, ADMIN, DISPATCHER | Création (référence `INT-AAAA-NNNN` générée en transaction) |
| `/api/requests/[id]` | GET | demandeur, affecté, bureau | Fiche complète (historique, commentaires, pièces, incidents, affectations) |
| `/api/requests/[id]` | PUT | selon machine à états | Changement de statut (`{ toStatus, comment }`) — 409 si transition interdite |
| `/api/requests/[id]` | PATCH | bureau | Édition (titre, description, priorité, équipement…) |
| `/api/requests/[id]` | DELETE | ADMIN | Suppression |
| `/api/requests/[id]/attachments` | POST | demandeur, affecté, bureau | Upload multipart (image/pdf/txt) |
| `/api/requests/[id]/report` | GET | demandeur, affecté, bureau | **Rapport PDF** (`application/pdf`) |

## Planification

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/planning/calendar` | GET | bureau | Grille hebdo (techniciens × créneaux) |
| `/api/planning/suggest` | GET | ADMIN, DISPATCHER | Techniciens classés pour un créneau (score + raisons) |
| `/api/planning/assign` | POST | ADMIN, DISPATCHER | Affectation avec contrôle anti double-réservation (409 si conflit) |

## Suivi des interventions

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/tracking/kanban` | GET | hors CLIENT | Demandes scopées avec statut, priorité, affectation et horodatages d'étapes (création, planification, début, fin, clôture) |
| `/api/stream` | GET | tous | **SSE** : `intervention.status`, `intervention.assigned`, `comment.created`, `incident.created`, `stock.low`, `notification`, `heartbeat` |

## Stock

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/parts` | GET | ADMIN, DISPATCHER, TECHNICIAN, MANAGER | Catalogue (`?search=`, `?lowOnly=1`), compte de pièces en alerte |
| `/api/parts` | POST | ADMIN | Création de pièce (référence unique, 409 si doublon) |
| `/api/parts/[id]` | PATCH | ADMIN | Mise à jour des métadonnées |
| `/api/parts/[id]/restock` | POST | ADMIN, DISPATCHER | Réapprovisionnement (mouvement RESTOCK + notification si seuil) |
| `/api/part-usages` | POST | TECHNICIAN affecté, bureau | Consommation (409 si stock insuffisant), décrément + mouvement atomiques |

## Rapports

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/reports/kpis` | GET | tous (scopé) | KPIs : statuts, types, priorités, délais, retards, satisfaction, coûts pièces, charge techniciens |
| `/api/reports/export` | GET | ADMIN, DISPATCHER, MANAGER | Export CSV (`;`, BOM UTF-8) des interventions |

## Socle

| Endpoint | Méthode | Rôles | Description |
|---|---|---|---|
| `/api/auth/[...nextauth]` | * | public | Auth.js (credentials + JWT) |
| `/api/comments` | POST | participants de l'intervention | Ajouter un commentaire |
| `/api/incidents` | POST | TECHNICIAN affecté, bureau | Signaler un incident |
| `/api/notifications` | GET / POST | tous | Lister / marquer lues + diffusion ciblée |
| `/api/equipment`, `/api/skills` | GET | tous | Référentiels (formulaires, filtres) |
| `/api/attachments/[id]/file` | GET | authentifié | Téléchargement d'une pièce jointe |

## Conventions

- Validation : **Zod** côté serveur (`src/validation/*`), messages FR.
- Codes HTTP : 400 (validation), 401 (non connecté), 403 (rôle), 404 (introuvable),
  409 (conflit métier : doublon, créneau occupé, stock insuffisant, transition interdite).
- Chaque écriture métier publie un événement temps réel ciblé (voir `/api/stream`).
