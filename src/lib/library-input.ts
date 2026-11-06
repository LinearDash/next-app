import { z } from "zod";
import { idSchema, mediaTypeSchema } from "./catalog.ts";
import { statuses, tags } from "./taste.ts";

export const identitySchema = z.object({ mediaType: mediaTypeSchema, id: idSchema });
export const entryInputSchema = identitySchema.extend({
  intent: z.enum(["save", "remove", "dismiss", "restore"]),
});
export const changesSchema = z.object({
  status: z.enum(statuses),
  reaction: z
    .enum(["", "1", "2", "3", "4", "5"])
    .transform((value) => (value === "" ? null : Number(value))),
  tags: z
    .array(z.enum(tags))
    .max(4)
    .refine((values) => new Set(values).size === values.length),
});
export const entrySchema = z.object({
  tmdb_id: z.number().int().positive().max(2147483647),
  media_type: mediaTypeSchema,
  status: z.enum(statuses),
  reaction: z.number().int().min(1).max(5).nullable(),
  tags: z.array(z.enum(tags)).max(4),
});
export const dismissalSchema = entrySchema.pick({ tmdb_id: true, media_type: true });
export const libraryFiltersSchema = z.object({
  view: z.enum(["entries", "dismissed"]).default("entries"),
  type: z.enum(["all", "movie", "tv"]).default("all"),
  status: z.enum(["all", ...statuses]).default("all"),
  reaction: z.enum(["all", "unrated", "1", "2", "3", "4", "5"]).default("all"),
  page: z
    .string()
    .regex(/^[1-9]\d{0,4}$/)
    .default("1")
    .transform(Number)
    .pipe(z.number().max(10000)),
  // Selected title for the side editor, e.g. "movie-42".
  edit: z
    .string()
    .regex(/^(movie|tv)-[1-9]\d{0,9}$/)
    .optional(),
});
export const preferencesSchema = z
  .array(
    z
      .string()
      .regex(/^[1-9]\d{0,5}$/)
      .transform(Number),
  )
  .max(30)
  .refine((values) => new Set(values).size === values.length);

export function scalar(form: FormData, name: string) {
  const values = form.getAll(name);
  return values.length === 1 && typeof values[0] === "string" ? values[0] : undefined;
}
