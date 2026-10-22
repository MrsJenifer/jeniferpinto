import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL; const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if(!url||!key) return NextResponse.next({request});
  let response=NextResponse.next({request});
  const supabase=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookiesToSet){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
  if(request.nextUrl.pathname.startsWith("/admin") || request.nextUrl.pathname.startsWith("/api/admin")) {
    // Refresh/validate the Supabase session. Authorisation is enforced again in each server route/page.
    await supabase.auth.getClaims().catch(()=>null);
  }
  return response;
}
export const config={matcher:["/admin/:path*","/api/admin/:path*"]};
