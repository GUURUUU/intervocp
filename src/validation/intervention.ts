import { z } from "zod";
import { InterventionType, Priority } from "@prisma/client";

/** Create / update an intervention request. */
export const interventionCreateSchema = z.object({
  title: z.string().trim().min(3, "Titre trop court").max(150),
  description: z.string().trim().min(5, "Description trop courte").max(4000),
  type: z.enum(["CORRECTIVE", "PREVENTIVE", "URGENT"]).default("CORRECTIVE"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  equipmentId: z.string().cuid().nullish(),
  locationText: z.string().trim().max(200).nullish(),
  latitude: z.number().min(-90).max(90).nullish(),
  longitude: z.number().min(-180).max(180).nullish(),
  requiredSkillId: z.string().cuid().nullish(),
  plannedStart: z.coerce.date().nullish(),
  plannedEnd: z.coerce.date().nullish(),
});

export const interventionUpdateSchema = interventionCreateSchema.partial();

/** Filters for the request list. */
export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z
    .enum([
      "NOUVELLE",
      "PLANIFIEE",
      "EN_COURS",
      "EN_ATTENTE_PIECES",
      "TERMINEE",
      "CLOTUREE",
      "ANNULEE",
    ])
    .optional(),
  type: z.enum(["CORRECTIVE", "PREVENTIVE", "URGENT"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  requesterId: z.string().cuid().optional(),
  equipmentId: z.string().cuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Status change. */
export const statusChangeSchema = z.object({
  toStatus: z.enum([
    "NOUVELLE",
    "PLANIFIEE",
    "EN_COURS",
    "EN_ATTENTE_PIECES",
    "TERMINEE",
    "CLOTUREE",
    "ANNULEE",
  ]),
  comment: z.string().trim().max(500).optional(),
});

/** Client satisfaction rating at closing. */
export const satisfactionSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

/** Assignment. */
export const assignSchema = z.object({
  interventionId: z.string().cuid(),
  technicianId: z.string().cuid(),
  plannedStart: z.coerce.date().optional(),
  plannedEnd: z.coerce.date().optional(),
});

/** Calendar range query. */
export const calendarQuerySchema = z.object({
  start: z.coerce.date(),
  end: z.coerce.date(),
});

/** Technician suggestion query. */
export const suggestQuerySchema = z.object({
  interventionId: z.string().cuid(),
  plannedStart: z.coerce.date(),
  plannedEnd: z.coerce.date(),
});

export type InterventionCreateInput = z.infer<typeof interventionCreateSchema>;
export type InterventionUpdateInput = z.infer<typeof interventionUpdateSchema>;

export const INTERVENTION_TYPES = ["CORRECTIVE", "PREVENTIVE", "URGENT"] as const;
export const INTERVENTION_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
export type { InterventionType, Priority };
