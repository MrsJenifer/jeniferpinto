-- Jenifer Pinto Finance Portfolio — initial schema
-- Apply in a new Supabase project. Review all policies before production use.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','administrator','editor')) default 'editor',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true); $$;

create table if not exists public.content_items (
  id uuid primary key default gen_random_uuid(),
  content_type text not null check (content_type in ('profile','project','skill','experience','education','certification','achievement','article','testimonial','site_settings')),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  is_published boolean not null default false,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(content_type, slug)
);
create index if not exists content_items_public_order_idx on public.content_items(content_type, is_published, sort_order);
create index if not exists content_items_data_gin_idx on public.content_items using gin(data);

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  original_name text not null check (length(original_name) <= 255),
  storage_path text not null unique,
  public_url text,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 52428800),
  alt_text text check (alt_text is null or length(alt_text) <= 250),
  created_at timestamptz not null default now()
);

create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_drive')),
  encrypted_tokens text not null,
  account_email text,
  scopes text[] not null default '{}',
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, provider)
);

create or replace function public.has_admin_role(allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admin_users a where a.user_id = auth.uid() and a.is_active = true and a.role = any(allowed_roles)); $$;

create table if not exists public.contact_enquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 100),
  email text not null check (length(email) <= 254),
  category text not null check (category in ('Recruiter enquiry','Project discussion','Other')),
  message text not null check (length(message) between 10 and 4000),
  status text not null default 'new' check (status in ('new','in_progress','responded','archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_item_id uuid references public.content_items(id) on delete set null,
  snapshot jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  outcome text not null default 'success',
  request_id text,
  created_at timestamptz not null default now()
);
create index if not exists audit_events_created_at_idx on public.audit_events(created_at desc);

alter table public.admin_users enable row level security;
alter table public.content_items enable row level security;
alter table public.media_assets enable row level security;
alter table public.contact_enquiries enable row level security;
alter table public.content_versions enable row level security;
alter table public.audit_events enable row level security;
alter table public.integration_connections enable row level security;

-- Public visitors may only read published content. Draft access is owner/admin-only.
drop policy if exists "Public can read published content" on public.content_items;
create policy "Public can read published content" on public.content_items for select using (is_published = true);
drop policy if exists "Admins can read all content" on public.content_items;
create policy "Admins can read all content" on public.content_items for select to authenticated using (public.is_active_admin());
drop policy if exists "Admins can insert content" on public.content_items;
create policy "Admins can insert content" on public.content_items for insert to authenticated with check (public.is_active_admin());
drop policy if exists "Admins can update content" on public.content_items;
create policy "Admins can update content" on public.content_items for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());
drop policy if exists "Admins can delete content" on public.content_items;
create policy "Admins can delete content" on public.content_items for delete to authenticated using (public.is_active_admin());

-- Admins can inspect only their own admin row; administrators cannot self-grant roles through table policies.
drop policy if exists "Users can read own admin role" on public.admin_users;
create policy "Users can read own admin role" on public.admin_users for select to authenticated using (user_id = auth.uid());
drop policy if exists "Admins can read media assets" on public.media_assets;
create policy "Admins can read media assets" on public.media_assets for select to authenticated using (public.is_active_admin());
drop policy if exists "Admins can insert their own media assets" on public.media_assets;
create policy "Admins can insert their own media assets" on public.media_assets for insert to authenticated with check (public.is_active_admin() and owner_id = auth.uid());
drop policy if exists "Admins can delete media assets" on public.media_assets;
create policy "Admins can delete media assets" on public.media_assets for delete to authenticated using (public.is_active_admin());

-- Anonymous form submissions are intentionally limited to INSERT. Add CAPTCHA and edge-level rate limiting before production.
drop policy if exists "Anyone can submit contact enquiry" on public.contact_enquiries;
create policy "Anyone can submit contact enquiry" on public.contact_enquiries for insert to anon, authenticated with check (status = 'new' and length(name) between 2 and 100 and length(email) between 3 and 254 and length(message) between 10 and 4000);
drop policy if exists "Admins can read contact enquiries" on public.contact_enquiries;
create policy "Admins can read contact enquiries" on public.contact_enquiries for select to authenticated using (public.is_active_admin());
drop policy if exists "Admins can update contact enquiries" on public.contact_enquiries;
create policy "Admins can update contact enquiries" on public.contact_enquiries for update to authenticated using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists "Owners manage Drive integration" on public.integration_connections;
create policy "Owners manage Drive integration" on public.integration_connections for all to authenticated
using (public.has_admin_role(array['owner','administrator']) and user_id = auth.uid())
with check (public.has_admin_role(array['owner','administrator']) and user_id = auth.uid());

create policy "Admins can read content versions" on public.content_versions for select to authenticated using (public.is_active_admin());
create policy "Admins can write content versions" on public.content_versions for insert to authenticated with check (public.is_active_admin());
create policy "Admins can read audit events" on public.audit_events for select to authenticated using (public.is_active_admin());
create policy "Admins can write audit events" on public.audit_events for insert to authenticated with check (public.is_active_admin());

-- Storage bucket: assets are public only because portfolio assets are published assets. Never place private files here.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('portfolio-assets','portfolio-assets',true,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "Active admins upload portfolio assets" on storage.objects;
create policy "Active admins upload portfolio assets" on storage.objects for insert to authenticated with check (bucket_id='portfolio-assets' and public.is_active_admin() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Active admins update own portfolio assets" on storage.objects;
create policy "Active admins update own portfolio assets" on storage.objects for update to authenticated using (bucket_id='portfolio-assets' and public.is_active_admin() and (storage.foldername(name))[1]=auth.uid()::text) with check (bucket_id='portfolio-assets' and public.is_active_admin() and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists "Active admins delete own portfolio assets" on storage.objects;
create policy "Active admins delete own portfolio assets" on storage.objects for delete to authenticated using (bucket_id='portfolio-assets' and public.is_active_admin() and (storage.foldername(name))[1]=auth.uid()::text);

-- Seed only clearly labelled editable starter content. Remove/replace before final launch.
insert into public.content_items(content_type,slug,data,is_published,sort_order) values
('profile','jenifer-pinto','{"name":"Jenifer Pinto","headline":"MBA Finance | Financial Analysis | Business Insights","intro":"I am building a career at the intersection of finance, analytical thinking, and business decision-making. This portfolio brings together academic work, finance projects, and professional development.","career_goal":"Corporate Finance · Financial Analysis · FP&A"}'::jsonb,true,0),
('project','financial-planning-forecast','{"title":"Financial Planning & Forecasting Model","category":"Budgeting & Forecasting","summary":"An educational model framework for revenue, operating costs, assumptions, and scenarios.","description":"Replace this starter content with the real model, data sources, and results before presenting it as completed work.","tools":["Excel","Scenario Analysis","Financial Modelling"],"difficulty":"Intermediate","featured":true,"limitations":"Educational placeholder. Not actual company results or investment advice.","deliverables":[]}'::jsonb,true,1),
('skill','financial-modelling','{"name":"Financial Modelling","description":"Build traceable models from documented assumptions.","category":"Finance & Analytics"}'::jsonb,true,1),
('skill','financial-statement-analysis','{"name":"Financial Statement Analysis","description":"Interpret profitability, liquidity, leverage, and efficiency.","category":"Finance & Analytics"}'::jsonb,true,2),
('site_settings','site-copy','{"title":"Portfolio site settings","site_title":"Jenifer Pinto | MBA Finance Portfolio","site_description":"A professional portfolio of finance projects, financial analysis, education, and skills by Jenifer Pinto.","home_hero_title":"Turning financial data into clear decisions.","home_selected_title":"Finance projects with purpose.","home_selected_intro":"Structured case studies designed to show the approach, assumptions, analysis, and business implications—not just the final chart.","home_about_title":"Curious about the story behind the numbers.","home_skills_title":"Finance fundamentals, made practical.","home_steps_title":"How the work gets done.","home_cta_title":"Let’s talk about finance and opportunities.","footer_tagline":"Finance · Analysis · Business Insight"}'::jsonb,true,0)
on conflict(content_type,slug) do nothing;
