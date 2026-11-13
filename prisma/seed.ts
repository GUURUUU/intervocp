/**
 * Seed script for IntervOCP — realistic fictional demo data.
 *
 * Creates: 12 users across all roles, 8 skills, 40 equipment items, 60 parts,
 * ~150 interventions over the last ~5 months with varied statuses, full
 * status history, assignments, parts usage with stock movements, ratings,
 * comments, incidents, availability blocks, recent location pings and a few
 * unread notifications.
 *
 * Deterministic: uses a seeded PRNG so repeated seeds produce identical data.
 *
 * Run: npm run db:seed
 */

import { PrismaClient, Role, Status, InterventionType, Priority, AvailabilityType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Deterministic PRNG (mulberry32)
// ---------------------------------------------------------------------------

function mulberry32(seed: number) {
  return function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20261113);

/** Random integer in [min, max] inclusive. */
function randInt(min: number, max: number): number {
  return Math.floor(rnd() * (max - min + 1)) + min;
}

/** Pick a random element. */
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

/** Pick with weights (values must be unique-ish keys). */
function weighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [value, w] of entries) {
    r -= w;
    if (r <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------------------
// Static fictional data
// ---------------------------------------------------------------------------

const PASSWORD = "Demo1234!";

const USERS: { name: string; email: string; role: Role; phone: string }[] = [
  { name: "Nadia Benali", email: "admin@intervocp.demo", role: "ADMIN", phone: "+212 523 401 001" },
  { name: "Youssef El Amrani", email: "dispatcher1@intervocp.demo", role: "DISPATCHER", phone: "+212 523 401 002" },
  { name: "Salma Idrissi", email: "dispatcher2@intervocp.demo", role: "DISPATCHER", phone: "+212 523 401 003" },
  { name: "Karim Ouazzani", email: "tech1@intervocp.demo", role: "TECHNICIAN", phone: "+212 661 100 101" },
  { name: "Hicham Berrada", email: "tech2@intervocp.demo", role: "TECHNICIAN", phone: "+212 661 100 102" },
  { name: "Fatima Zahra Belkacem", email: "tech3@intervocp.demo", role: "TECHNICIAN", phone: "+212 661 100 103" },
  { name: "Omar Chraibi", email: "tech4@intervocp.demo", role: "TECHNICIAN", phone: "+212 661 100 104" },
  { name: "Rachid Naciri", email: "tech5@intervocp.demo", role: "TECHNICIAN", phone: "+212 661 100 105" },
  { name: "Meryem Alaoui", email: "client1@intervocp.demo", role: "CLIENT", phone: "+212 523 401 901" },
  { name: "Anas Tazi", email: "client2@intervocp.demo", role: "CLIENT", phone: "+212 523 401 902" },
  { name: "Laila Bennis", email: "client3@intervocp.demo", role: "CLIENT", phone: "+212 523 401 903" },
  { name: "Hassan El Fassi", email: "manager@intervocp.demo", role: "MANAGER", phone: "+212 523 401 500" },
];

const SKILLS = [
  "Électricité industrielle",
  "Mécanique",
  "Automatisme",
  "Réseaux & Télécom",
  "Hydraulique",
  "CVC",
  "Soudure",
  "Instrumentation",
];

// Which skill each technician masters (index into SKILLS) + level 1..5.
const TECH_SKILLS: Record<string, { skill: number; level: number }[]> = {
  "tech1@intervocp.demo": [
    { skill: 0, level: 5 }, // Électricité
    { skill: 2, level: 3 }, // Automatisme
    { skill: 7, level: 2 }, // Instrumentation
  ],
  "tech2@intervocp.demo": [
    { skill: 1, level: 5 }, // Mécanique
    { skill: 4, level: 4 }, // Hydraulique
    { skill: 6, level: 3 }, // Soudure
  ],
  "tech3@intervocp.demo": [
    { skill: 3, level: 5 }, // Réseaux
    { skill: 2, level: 4 }, // Automatisme
  ],
  "tech4@intervocp.demo": [
    { skill: 5, level: 4 }, // CVC
    { skill: 1, level: 3 }, // Mécanique
    { skill: 0, level: 2 }, // Électricité
  ],
  "tech5@intervocp.demo": [
    { skill: 7, level: 5 }, // Instrumentation
    { skill: 4, level: 3 }, // Hydraulique
    { skill: 2, level: 2 }, // Automatisme
    { skill: 6, level: 2 }, // Soudure
  ],
};

const EQUIPMENT_CATEGORIES = [
  "CONVOYAGE",
  "BROYAGE",
  "HYDRAULIQUE",
  "ELECTRIQUE",
  "INFORMATIQUE",
  "RESEAU",
  "CLIMATISATION",
  "SECURITE",
] as const;

const EQUIPMENT_NAMES = [
  "Convoyeur à bande",
  "Moteur électrique",
  "Pompe centrifuge",
  "Vérin hydraulique",
  "Compresseur d'air",
  "Onduleur",
  "Serveur rack",
  "Switch réseau",
  "Climatiseur split",
  "Détecteur incendie",
  "Réducteur",
  "Broyeur à marteaux",
  "Crible vibrant",
  "Groupe électrogène",
  "Armoire électrique",
  "Variateur de fréquence",
  "Imprimante multifonction",
  "Caméra de surveillance",
  "Badge reader",
  "Échangeur thermique",
] as const;

const EQUIPMENT_LOCATIONS = [
  "Zone Flottation - Bâtiment 1",
  "Zone Flottation - Bâtiment 2",
  "Zone Broyage - Atelier A",
  "Zone Broyage - Atelier B",
  "Atelier central",
  "Salle serveurs",
  "Laboratoire",
  "Bureau central",
  "Station de pompage N1",
  "Station de pompage N2",
  "Magasin pièces",
  "Zone administrative",
] as const;

const PART_NAMES: { name: string; cost: number }[] = [
  { name: "Roulement à billes 6205", cost: 120 },
  { name: "Courroie trapézoïdale A-45", cost: 85 },
  { name: "Filtre à huile hydraulique", cost: 210 },
  { name: "Joint torique NBR 40x3", cost: 15 },
  { name: "Câble H07RN-F 3x2.5 (m)", cost: 22 },
  { name: "Fusible 32A", cost: 18 },
  { name: "Capteur inductif M18", cost: 340 },
  { name: "Contacteur 40A", cost: 280 },
  { name: "Disjoncteur magnétothermique 63A", cost: 410 },
  { name: "Roulement à rouleaux 22216", cost: 890 },
  { name: "Courroie crantée HTD 8M", cost: 150 },
  { name: "Manchette hydraulique 80mm", cost: 260 },
  { name: "Filtre à air compresseur", cost: 320 },
  { name: "Brosse charbon moteur", cost: 45 },
  { name: "Relais thermique 25A", cost: 190 },
  { name: "Carter de protection", cost: 520 },
  { name: "Flexible hydraulique 1m", cost: 240 },
  { name: "Huile hydraulique ISO 46 (L)", cost: 38 },
  { name: "Graisse EP2 (kg)", cost: 42 },
  { name: "Vanne 3 voies DN50", cost: 780 },
  { name: "Pressostat", cost: 350 },
  { name: "Thermocouple type K", cost: 160 },
  { name: "Clim hydroélectrique", cost: 95 },
  { name: "Bande transporteuse EP400 (m)", cost: 1150 },
  { name: "Galet de soutien Ø89", cost: 175 },
  { name: "Tambour moteur 320mm", cost: 2300 },
  { name: "Racleur de bande", cost: 210 },
  { name: "Plaque d'usure Hardox (kg)", cost: 310 },
  { name: "Clavette prisme 10x8", cost: 25 },
  { name: "Cartouche filtrante réseau", cost: 140 },
  { name: "Cable UTP Cat6 (m)", cost: 12 },
  { name: "RJ45 connecteur", cost: 6 },
  { name: "Baie 19\" 12U", cost: 1900 },
  { name: "Onduleur batterie 12V 7Ah", cost: 290 },
  { name: "Disque dur SSD 480Go", cost: 850 },
  { name: "Barrette RAM 16Go", cost: 920 },
  { name: "Clavier industriel", cost: 240 },
  { name: "Écran 24 pouces", cost: 1350 },
  { name: "Lampe LED atelier", cost: 160 },
  { name: "Projecteur halogène", cost: 230 },
  { name: "Détecteur de fumée", cost: 280 },
  { name: "Extincteur CO2 5kg", cost: 720 },
  { name: "Collier de serrage inox", cost: 4 },
  { name: "Vis M8x40 inox (x10)", cost: 9 },
  { name: "Ampoule halogène", cost: 30 },
  { name: "Kit de réparation fuite", cost: 180 },
  { name: "Sonde PT100", cost: 240 },
  { name: "Electrovanne 24V", cost: 460 },
  { name: "Ventilateur extracteur", cost: 540 },
  { name: "Grille ventilation", cost: 90 },
  { name: "Thermostat d'ambiance", cost: 380 },
  { name: "Filtre G4 climatiseur", cost: 110 },
  { name: "Pompe condensats", cost: 610 },
  { name: "Carte électronique convoyeur", cost: 2100 },
  { name: "Rail DIN", cost: 28 },
  { name: "Cosses à sertir (x50)", cost: 35 },
  { name: "Gaine souple Ø25 (m)", cost: 20 },
  { name: "Batterie caméra", cost: 130 },
  { name: "Antenne WiFi extérieure", cost: 480 },
];

const TITLE_POOLS: Record<InterventionType, string[]> = {
  CORRECTIVE: [
    "Panne du convoyeur principal",
    "Fuite hydraulique sur vérin",
    "Courroie usée à remplacer",
    "Moteur bloqué - surchauffe",
    "Éclairage défaillant en zone de production",
    "Imprimante hors service",
    "Prise électrique défectueuse",
    "Alarme réseau intermittente",
    "Vibration anormale sur réducteur",
    "Serveur ne répond plus",
    "Fuite d'eau sur split clim",
    "Variateur en défaut",
    "Climatiseur ne refroidit plus",
    "Caméra hors ligne",
    "Capteur de niveau incohérent",
  ],
  PREVENTIVE: [
    "Maintenance préventive trimestrielle",
    "Graissage et contrôle ligne de convoyage",
    "Contrôle des roulements du broyeur",
    "Remplacement des filtres CVC",
    "Vérification annuelle armoires électriques",
    "Test des détecteurs incendie",
    "Sauvegarde et mise à jour des serveurs",
    "Inspection des pompes de la station N1",
    "Contrôle périodique onduleur",
    "Nettoyage des filtres réseau",
  ],
  URGENT: [
    "Arrêt de production - zone broyage",
    "Fuite importante station N2",
    "Alarme incendie déclenchée",
    "Court-circuit armoire électrique",
    "Chute de tension réseau",
    "Panne totale climatisation salle serveurs",
  ],
};

const DESCRIPTION_TEMPLATES = [
  "Équipement signalé en défaut par l'opérateur de zone. Une vérification complète est nécessaire.",
  "Le client signale un dysfonctionnement impactant la production. Merci d'intervenir dans les meilleurs délais.",
  "Demande issue du rond de maintenance. Contrôler et remettre en conformité.",
  "Anomalie détectée lors de la ronde quotidienne. Diagnostic puis remise en état.",
  "Dysfonctionnement signalé par le bureau des procédés, impact sur la chaîne possible.",
];

const COMMENT_POOL = [
  "Pris en charge, diagnostic en cours.",
  "Pièce commandée, arrivée prévue demain.",
  "Intervention réalisée, équipement remis en service.",
  "Merci de préciser la localisation exacte.",
  "Besoin d'un renfort sur cette intervention.",
  "Tests effectués après réparation, tout est conforme.",
  "Le client confirme le retour à la normale.",
  "Zone sécurisée, travail peut démarrer.",
];

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log("🌱 Seeding IntervOCP database...");

  // Wipe in FK-safe order
  await prisma.report.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.locationPing.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.partUsage.deleteMany();
  await prisma.part.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.statusHistory.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.availability.deleteMany();
  await prisma.technicianSkill.deleteMany();
  await prisma.skill.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = bcrypt.hashSync(PASSWORD, 10);

  // --- Users ---------------------------------------------------------------
  const users: Record<string, { id: string; name: string; role: Role }> = {};
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: {
        name: u.name,
        email: u.email,
        passwordHash,
        role: u.role,
        phone: u.phone,
        active: true,
      },
    });
    users[u.email] = { id: created.id, name: created.name, role: created.role };
  }
  console.log(`  ✓ ${Object.keys(users).length} users`);

  // --- Skills & technician skills -------------------------------------------
  const skillIds: string[] = [];
  for (const name of SKILLS) {
    const s = await prisma.skill.create({ data: { name } });
    skillIds.push(s.id);
  }

  const techEmails = ["tech1@intervocp.demo", "tech2@intervocp.demo", "tech3@intervocp.demo", "tech4@intervocp.demo", "tech5@intervocp.demo"];
  for (const email of techEmails) {
    const tech = users[email];
    const defs = TECH_SKILLS[email];
    for (const def of defs) {
      await prisma.technicianSkill.create({
        data: { technicianId: tech.id, skillId: skillIds[def.skill], level: def.level },
      });
    }
  }
  console.log(`  ✓ ${SKILLS.length} skills + technician skill levels`);

  // --- Availability: next 21 days, WORK 08:00-17:00 on weekdays, some leave --
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (const email of techEmails) {
    const tech = users[email];
    for (let d = 0; d < 21; d++) {
      const day = new Date(today);
      day.setDate(today.getDate() + d);
      const dow = day.getDay(); // 0 = Sunday, 6 = Saturday
      if (dow === 0 || dow === 6) continue;

      // Two technicians on leave one day in the next two weeks
      const onLeave =
        (email === "tech2@intervocp.demo" && d === 4) ||
        (email === "tech4@intervocp.demo" && d === 9);

      const start = new Date(day);
      start.setHours(8, 0, 0, 0);
      const end = new Date(day);
      end.setHours(17, 0, 0, 0);

      await prisma.availability.create({
        data: {
          technicianId: tech.id,
          start,
          end,
          type: onLeave ? "LEAVE" : "WORK",
        },
      });
    }
  }
  console.log("  ✓ availability (21 days per technician)");

  // --- Equipment (40 items) ---------------------------------------------------
  const equipmentIds: string[] = [];
  for (let i = 1; i <= 40; i++) {
    const name = pick(EQUIPMENT_NAMES);
    const cat = pick(EQUIPMENT_CATEGORIES);
    const loc = pick(EQUIPMENT_LOCATIONS);
    const eq = await prisma.equipment.create({
      data: {
        name: `${name} ${String(i).padStart(2, "0")}`,
        location: loc,
        category: cat,
        serialNumber: `EQ-${String(i).padStart(3, "0")}-${randInt(1000, 9999)}`,
      },
    });
    equipmentIds.push(eq.id);
  }
  console.log(`  ✓ 40 equipment items`);

  // --- Parts (60) --------------------------------------------------------------
  const partIds: string[] = [];
  for (let i = 0; i < PART_NAMES.length; i++) {
    const p = PART_NAMES[i];
    const initialQty = randInt(2, 60);
    const part = await prisma.part.create({
      data: {
        reference: `PIECE-${String(i + 1).padStart(4, "0")}`,
        name: p.name,
        quantity: initialQty,
        minThreshold: randInt(3, 10),
        unitCost: p.cost,
        location: `Magasin central - Étagère ${String.fromCharCode(65 + (i % 6))}${1 + (i % 8)}`,
      },
    });
    partIds.push(part.id);
    await prisma.stockMovement.create({
      data: { partId: part.id, delta: initialQty, reason: "SEED" },
    });
  }
  console.log(`  ✓ 60 parts with initial stock movements`);

  // --- Interventions (~150) ----------------------------------------------------
  const clientEmails = ["client1@intervocp.demo", "client2@intervocp.demo", "client3@intervocp.demo"];
  const dispatcherEmails = ["dispatcher1@intervocp.demo", "dispatcher2@intervocp.demo"];

  const statusWeights: Record<Status, number> = {
    NOUVELLE: 8,
    PLANIFIEE: 10,
    EN_COURS: 6,
    EN_ATTENTE_PIECES: 5,
    TERMINEE: 8,
    CLOTUREE: 58,
    ANNULEE: 5,
  };

  const typeWeights: Record<InterventionType, number> = {
    CORRECTIVE: 60,
    PREVENTIVE: 30,
    URGENT: 10,
  };

  const priorityWeights: Record<Priority, number> = {
    LOW: 20,
    MEDIUM: 40,
    HIGH: 25,
    CRITICAL: 15,
  };

  const satisfactionWeights: Record<string, number> = {
    "5": 40, "4": 35, "3": 15, "2": 6, "1": 4,
  };

  let refCounter = 1;
  const N_INTERVENTIONS = 150;

  for (let i = 0; i < N_INTERVENTIONS; i++) {
    const type = weighted(typeWeights);
    const priority = weighted(priorityWeights);
    const status = weighted(statusWeights);

    // Creation date spread over the last ~5 months (older = more likely closed)
    const ageBias = status === "CLOTUREE" || status === "ANNULEE" ? randInt(20, 150) : status === "TERMINEE" || status === "EN_ATTENTE_PIECES" ? randInt(5, 40) : randInt(0, 15);
    const createdAt = new Date(today);
    createdAt.setDate(today.getDate() - ageBias);
    createdAt.setHours(randInt(7, 16), randInt(0, 59), 0, 0);

    // Planned slot: usually 1-5 days after creation
    const plannedStart = new Date(createdAt);
    plannedStart.setDate(createdAt.getDate() + randInt(1, 5));
    plannedStart.setHours(randInt(8, 14), 0, 0, 0);
    const plannedEnd = new Date(plannedStart);
    plannedEnd.setHours(plannedStart.getHours() + randInt(1, 5));

    const requesterEmail = type === "PREVENTIVE" ? pick(dispatcherEmails) : pick(clientEmails);
    const equipmentId = pick(equipmentIds);
    const requiredSkillId = rnd() < 0.8 ? pick(skillIds) : null;

    // Coordinates: small random offset around the fictional site near Khouribga
    const latitude = 32.8805 + (rnd() - 0.5) * 0.02;
    const longitude = 6.9135 + (rnd() - 0.5) * 0.025;

    let actualStart: Date | null = null;
    let actualEnd: Date | null = null;
    let closedAt: Date | null = null;

    if (["EN_COURS", "EN_ATTENTE_PIECES", "TERMINEE", "CLOTUREE"].includes(status)) {
      actualStart = new Date(plannedStart);
      // Some delays vs. planned start
      actualStart.setMinutes(actualStart.getMinutes() + randInt(-20, 90));
      if (["TERMINEE", "CLOTUREE"].includes(status)) {
        actualEnd = new Date(actualStart);
        actualEnd.setHours(actualStart.getHours() + randInt(1, 6));
        if (status === "CLOTUREE") {
          closedAt = new Date(actualEnd);
          closedAt.setDate(actualEnd.getDate() + randInt(1, 4));
          closedAt.setHours(randInt(9, 17));
        }
      }
    }

    const title = pick(TITLE_POOLS[type]);
    const description = pick(DESCRIPTION_TEMPLATES);

    const intervention = await prisma.intervention.create({
      data: {
        reference: `INT-2026-${String(refCounter).padStart(4, "0")}`,
        title,
        description,
        type,
        priority,
        status,
        requesterId: users[requesterEmail].id,
        equipmentId,
        locationText: pick(EQUIPMENT_LOCATIONS),
        latitude,
        longitude,
        requiredSkillId,
        plannedStart: status === "NOUVELLE" ? null : plannedStart,
        plannedEnd: status === "NOUVELLE" ? null : plannedEnd,
        actualStart,
        actualEnd,
        createdAt,
        closedAt,
        satisfactionRating: status === "CLOTUREE" ? parseInt(weighted(satisfactionWeights), 10) : null,
        satisfactionComment:
          status === "CLOTUREE" && rnd() < 0.4
            ? pick(["Très satisfait de l'intervention.", "Rapide et professionnel.", "Intervention conforme à la demande.", "Un peu long mais résultat correct.", "Équipe très réactive."])
            : null,
      },
    });
    refCounter++;

    // --- Status history (path from NOUVELLE to current status) ---------------
    const historyEntries: { from: Status | null; to: Status; at: Date; comment?: string }[] = [];
    historyEntries.push({ from: null, to: "NOUVELLE", at: createdAt });

    const flow: Record<string, Status> = {
      PLANIFIEE: "PLANIFIEE",
      EN_COURS: "EN_COURS",
      EN_ATTENTE_PIECES: "EN_ATTENTE_PIECES",
      TERMINEE: "TERMINEE",
      CLOTUREE: "CLOTUREE",
    };

    let cursor: Date = new Date(createdAt);
    if (status === "ANNULEE") {
      cursor = new Date(cursor.getTime() + 1000 * 60 * randInt(30, 600));
      historyEntries.push({ from: "NOUVELLE", to: "ANNULEE", at: cursor, comment: "Demande annulée par le client." });
    } else if (status !== "NOUVELLE") {
      const target = flow[status];
      const steps: Status[] = [];
      // Build valid transition path
      if (target === "PLANIFIEE") steps.push("PLANIFIEE");
      if (target === "EN_COURS") steps.push("PLANIFIEE", "EN_COURS");
      if (target === "EN_ATTENTE_PIECES") steps.push("PLANIFIEE", "EN_COURS", "EN_ATTENTE_PIECES");
      if (target === "TERMINEE") steps.push("PLANIFIEE", "EN_COURS", "TERMINEE");
      if (target === "CLOTUREE") steps.push("PLANIFIEE", "EN_COURS", "TERMINEE", "CLOTUREE");

      let prev: Status | null = "NOUVELLE";
      for (const step of steps) {
        cursor = new Date(cursor.getTime() + 1000 * 60 * 60 * randInt(2, 30));
        if (cursor > now) cursor = new Date(now);
        historyEntries.push({ from: prev, to: step, at: cursor });
        prev = step;
      }
    }

    for (const h of historyEntries) {
      await prisma.statusHistory.create({
        data: {
          interventionId: intervention.id,
          fromStatus: h.from,
          toStatus: h.to,
          changedBy:
            h.to === "NOUVELLE" ? users[requesterEmail].id : users[pick(dispatcherEmails)].id,
          changedAt: h.at,
          comment: h.comment,
        },
      });
    }

    // --- Assignment (not for NOUVELLE / ANNULEE) ------------------------------
    if (status !== "NOUVELLE" && status !== "ANNULEE") {
      const techEmail = pick(techEmails);
      await prisma.assignment.create({
        data: {
          interventionId: intervention.id,
          technicianId: users[techEmail].id,
          assignedBy: users[pick(dispatcherEmails)].id,
          assignedAt: new Date(createdAt.getTime() + 1000 * 60 * randInt(20, 300)),
        },
      });
    }

    // --- Comments -------------------------------------------------------------
    const nComments = randInt(0, 3);
    for (let c = 0; c < nComments; c++) {
      const authorEmail =
        rnd() < 0.5 ? requesterEmail : rnd() < 0.5 ? pick(techEmails) : pick(dispatcherEmails);
      await prisma.comment.create({
        data: {
          interventionId: intervention.id,
          authorId: users[authorEmail].id,
          message: pick(COMMENT_POOL),
          createdAt: new Date(createdAt.getTime() + 1000 * 60 * 60 * (c + 1) * randInt(1, 6)),
        },
      });
    }

    // --- Part usages (for finished work) --------------------------------------
    if (["TERMINEE", "CLOTUREE"].includes(status) && actualEnd) {
      const nUsages = randInt(0, 4);
      const usedPartIds = new Set<string>();
      for (let u = 0; u < nUsages; u++) {
        const partId = pick(partIds);
        if (usedPartIds.has(partId)) continue;
        usedPartIds.add(partId);
        const qty = randInt(1, 4);
        const techEmail = pick(techEmails);
        await prisma.partUsage.create({
          data: {
            interventionId: intervention.id,
            partId,
            quantity: qty,
            usedBy: users[techEmail].id,
            usedAt: actualEnd,
          },
        });
        await prisma.stockMovement.create({
          data: { partId, delta: -qty, reason: "USAGE" },
        });
        await prisma.part.update({
          where: { id: partId },
          data: { quantity: { decrement: qty } },
        });
      }
    }

    // --- Incidents -------------------------------------------------------------
    if (rnd() < 0.05) {
      await prisma.incident.create({
        data: {
          interventionId: intervention.id,
          description: pick([
            "Accès à la zone impossible, zone condamnée par la sécurité.",
            "Équipement sous tension, nécessite une consignation.",
            "Pièce manquante en magasin, commande nécessaire.",
            "Client absent sur site au moment du passage.",
            "Retard dû à un conflit de planning.",
          ]),
          severity: pick(["LOW", "MEDIUM", "HIGH"]),
          reportedAt: actualStart ?? createdAt,
        },
      });
    }
  }
  console.log(`  ✓ ${N_INTERVENTIONS} interventions with history, assignments, usage`);

  // --- Location pings (recent, around the site) --------------------------------
  for (const email of techEmails) {
    const tech = users[email];
    const nPings = randInt(3, 6);
    for (let p = 0; p < nPings; p++) {
      const at = new Date(now.getTime() - randInt(2, 90) * 60 * 1000);
      await prisma.locationPing.create({
        data: {
          technicianId: tech.id,
          latitude: 32.8805 + (rnd() - 0.5) * 0.015,
          longitude: 6.9135 + (rnd() - 0.5) * 0.02,
          timestamp: at,
        },
      });
    }
  }
  console.log("  ✓ location pings");

  // --- Unread notifications ------------------------------------------------------
  const notifTargets = [
    "admin@intervocp.demo",
    "dispatcher1@intervocp.demo",
    "dispatcher2@intervocp.demo",
    "tech1@intervocp.demo",
    "tech2@intervocp.demo",
    "manager@intervocp.demo",
  ];
  for (const email of notifTargets) {
    for (let n = 0; n < randInt(1, 3); n++) {
      await prisma.notification.create({
        data: {
          userId: users[email].id,
          message: pick([
            "Nouvelle demande d'intervention créée.",
            "Une intervention vous a été assignée.",
            "Une intervention est passée en EN_COURS.",
            "Incident signalé sur une intervention.",
            "Seuil de stock bas atteint pour une pièce.",
          ]),
          read: false,
        },
      });
    }
  }
  console.log("  ✓ notifications");

  console.log("✅ Seed complete.");
  console.log(`   Demo password for every account: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
