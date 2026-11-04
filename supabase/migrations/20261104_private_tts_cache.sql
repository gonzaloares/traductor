-- Persistent private audio cache for on-demand neural pronunciation.
-- Only the PIN-protected parole-api function uses the service-role key to access it.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('parole-audio', 'parole-audio', false, 4194304, array['audio/mpeg'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
