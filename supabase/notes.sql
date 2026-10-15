-- Learning-only seed data. No credentials or auth.users foreign key are required.
begin;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid,
  title text not null,
  content text not null
);

comment on column public.notes.owner_id is 'Reserved for a later stage; intentionally has no auth.users foreign key.';
alter table public.notes enable row level security;
revoke all privileges on table public.notes from anon, authenticated;
grant select on table public.notes to service_role;

insert into public.notes (id, title, content)
values
  ('00000000-0000-4000-8000-000000000001', convert_from(decode('eab3bceca09c', 'hex'), 'UTF8'), convert_from(decode('ec8ba4ec8ab5ec9aa920eab080ec838120eab3bceca09c20eab8b0eba19d', 'hex'), 'UTF8')),
  ('00000000-0000-4000-8000-000000000002', convert_from(decode('ed8faced8ab8ed8fb4eba6acec98a4', 'hex'), 'UTF8'), convert_from(decode('ec8ba4ec8ab5ec9aa920eab080ec838120ed8faced8ab8ed8fb4eba6acec98a420eab8b0eba19d', 'hex'), 'UTF8')),
  ('00000000-0000-4000-8000-000000000003', convert_from(decode('ec9584ecb9a820eba6acecb694ec96bc', 'hex'), 'UTF8'), convert_from(decode('ec8ba4ec8ab5ec9aa920eab080ec838120eba6acecb694ec96bc20eab8b0eba19d', 'hex'), 'UTF8')),
  ('00000000-0000-4000-8000-000000000004', convert_from(decode('ed9b88eba0a820ed9689eca09520ec9e90eba38c', 'hex'), 'UTF8'), convert_from(decode('ec8ba4ec8ab5ec9aa920eab080ec838120ed9689eca09520eab8b0eba19d', 'hex'), 'UTF8'))
on conflict (id) do update set title = excluded.title, content = excluded.content;

commit;
