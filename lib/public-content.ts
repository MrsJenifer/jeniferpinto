import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { allDemo } from "./demo-content";
import { isSupabaseConfigured } from "./config";
import type { ContentItem, ContentType } from "./types";

export async function getPublicContent(
  type?: ContentType,
  options: { limit?: number } = {},
): Promise<ContentItem[]> {
  const demoFallback = () =>
    allDemo(type)
      .filter((item) => item.is_published)
      .slice(0, options.limit);

  if (!isSupabaseConfigured()) return demoFallback();

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!url || !key) return demoFallback();

    const supabase = createSupabaseClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    let query = supabase
      .from("content_items")
      .select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at")
      .eq("is_published", true)
      .order("sort_order", { ascending: true });

    if (type) query = query.eq("content_type", type);
    if (options.limit) query = query.limit(options.limit);

    const { data, error } = await query;
    if (error) throw error;

    return (data ?? []) as ContentItem[];
  } catch (error) {
    console.error("public-content.fetch.failed", {
      type,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return demoFallback();
  }
}

export async function getPublicContentBySlug(
  type: ContentType,
  slug: string,
): Promise<ContentItem | undefined> {
  const items = await getPublicContent(type);
  return items.find((item) => item.slug === slug);
}
