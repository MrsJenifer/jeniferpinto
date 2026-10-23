-- Align the existing Supabase bucket and media table with the Admin upload endpoint.
-- Run once on an existing project after applying 001_initial_schema.sql.

alter table public.media_assets
  drop constraint if exists media_assets_size_bytes_check;

alter table public.media_assets
  add constraint media_assets_size_bytes_check
  check (size_bytes > 0 and size_bytes <= 52428800);

update storage.buckets
set file_size_limit = 52428800,
    allowed_mime_types = array[
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'video/mp4', 'video/webm',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    ]::text[]
where id = 'portfolio-assets';
