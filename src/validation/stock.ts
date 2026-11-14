import { z } from "zod";

/** Part catalogue entry (create / update). */
export const partSchema = z.object({
  reference: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  minThreshold: z.coerce.number().int().min(0).max(100_000).default(5),
  unitCost: z.coerce.number().min(0).max(10_000_000).default(0),
  location: z.string().trim().max(120).optional().nullable(),
});

/** Partial update (metadata only). */
export const partUpdateSchema = partSchema.partial().extend({
  quantity: z.undefined().optional(),
});

/** Stock-in operation. */
export const restockSchema = z.object({
  quantity: z.coerce.number().int().min(1).max(100_000),
  note: z.string().trim().max(200).optional(),
});

/** Parts used on an intervention (auto stock-out). */
export const partUsageSchema = z.object({
  interventionId: z.string().cuid(),
  partId: z.string().cuid(),
  quantity: z.coerce.number().int().min(1).max(1_000),
});

export type PartInput = z.infer<typeof partSchema>;
export type PartUpdateInput = z.infer<typeof partUpdateSchema>;
export type RestockInput = z.infer<typeof restockSchema>;
export type PartUsageInput = z.infer<typeof partUsageSchema>;
