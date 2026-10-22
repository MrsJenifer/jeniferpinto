import { allDemo } from "./demo-content";
import { isSupabaseConfigured } from "./config";
import { createClient } from "./supabase/server";
import type { ContentItem, ContentType } from "./types";

export async function getContent(type?: ContentType, options: { publishedOnly?: boolean; limit?: number } = {}): Promise<ContentItem[]> {
  if (!isSupabaseConfigured()) return allDemo(type).filter(x=>options.publishedOnly===false || x.is_published).slice(0,options.limit);
  try {
    const supabase=await createClient();
    let query=supabase.from("content_items").select("id,content_type,slug,data,is_published,sort_order,created_at,updated_at").order("sort_order",{ascending:true});
    if(type) query=query.eq("content_type",type);
    if(options.publishedOnly!==false) query=query.eq("is_published",true);
    if(options.limit) query=query.limit(options.limit);
    const {data,error}=await query;
    if(error) throw error;
    return (data||[]) as ContentItem[];
  } catch(error) {
    console.error("content.fetch.failed", { type, message: error instanceof Error ? error.message : "unknown" });
    return [];
  }
}
export async function getContentBySlug(type: ContentType, slug: string): Promise<ContentItem | undefined> {
  const all=await getContent(type,{publishedOnly:true});
  return all.find(x=>x.slug===slug);
}
