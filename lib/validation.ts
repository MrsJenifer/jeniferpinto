import { z } from "zod";
export const contentTypes=["profile","project","skill","experience","education","certification","achievement","article","testimonial","site_settings"] as const;
export const contentTypeSchema=z.enum(contentTypes);
export const contentUpsertSchema=z.object({
  id:z.string().uuid().optional(),
  content_type:contentTypeSchema,
  slug:z.string().trim().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,"Use lowercase letters, numbers, and hyphens for the slug."),
  data:z.record(z.string(),z.unknown()).refine(value => { try { return JSON.stringify(value).length <= 100_000; } catch { return false; } }, "Content data must be a JSON object under 100 KB."),
  is_published:z.boolean().default(false),
  sort_order:z.number().int().min(0).max(100000).default(0)
});
export const contactSchema=z.object({name:z.string().trim().min(2).max(100),email:z.email().max(254),category:z.enum(["Recruiter enquiry","Project discussion","Other"]).default("Recruiter enquiry"),message:z.string().trim().min(10).max(4000),website:z.string().max(0).optional().default("")});
