export type ContentType = "profile" | "project" | "skill" | "experience" | "education" | "certification" | "achievement" | "article" | "testimonial" | "site_settings";
export type ContentItem = {
  id: string; content_type: ContentType; slug: string; data: Record<string, unknown>;
  is_published: boolean; sort_order: number; created_at?: string; updated_at?: string;
};
