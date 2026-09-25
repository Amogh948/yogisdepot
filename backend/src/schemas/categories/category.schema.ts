import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().optional(),
  image: z.string().optional(),
  parentId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const categoryUpdateSchema = categorySchema.partial();
