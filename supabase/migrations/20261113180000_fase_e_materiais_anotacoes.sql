-- =====================================================================
-- Projeto Aprovação Saquarema — Fase E: materiais, busca e anotações
--
-- Arquivos (PDF) ficam no Storage, no bucket privado "materiais", dentro
-- de uma pasta com o id da conta: <user_id>/<arquivo>.pdf.
-- O texto de cada página é extraído no app e guardado em materiais_paginas,
-- com índice de busca em português.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

create table if not exists public.materiais (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo        text not null,
  tipo          text not null check (tipo in ('pdf', 'link')),
  arquivo_path  text,
  url           text,
  tamanho_bytes bigint,
  paginas       integer,
  disciplina_id text references public.disciplinas(id) on delete set null,
  topico_id     text references public.topicos(id) on delete set null,
  criado_em     timestamptz not null default now(),
  constraint materiais_pdf_ou_link check (
    (tipo = 'pdf' and arquivo_path is not null) or (tipo = 'link' and url is not null)
  )
);
create index if not exists materiais_usuario_idx on public.materiais (user_id, criado_em desc);

create table if not exists public.materiais_paginas (
  material_id text not null references public.materiais(id) on delete cascade,
  pagina      integer not null check (pagina >= 1),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  texto       text not null,
  busca       tsvector generated always as (to_tsvector('portuguese', coalesce(texto, ''))) stored,
  primary key (material_id, pagina)
);
create index if not exists materiais_paginas_busca_idx on public.materiais_paginas using gin (busca);

-- Uma anotação por tópico do edital (e anotações livres, sem tópico).
create table if not exists public.anotacoes (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topico_id     text references public.topicos(id) on delete cascade,
  titulo        text,
  conteudo      text not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- NULLs são distintos: várias anotações livres, mas só uma por tópico.
  constraint anotacoes_usuario_topico_unico unique (user_id, topico_id)
);

drop trigger if exists anotacoes_atualizado_em on public.anotacoes;
create trigger anotacoes_atualizado_em before update on public.anotacoes
  for each row execute function public.tocar_atualizado_em();

-- Busca em todos os materiais da conta, com trecho destacado.
create or replace function public.buscar_materiais(p_consulta text, p_limite integer default 30)
returns table (material_id text, titulo text, pagina integer, trecho text, relevancia real)
language sql
stable
set search_path = ''
as $$
  with q as (select websearch_to_tsquery('portuguese', p_consulta) as consulta)
  select p.material_id, m.titulo, p.pagina,
         ts_headline('portuguese', p.texto, q.consulta,
                     'StartSel=[[, StopSel=]], MaxWords=28, MinWords=12, MaxFragments=1') as trecho,
         ts_rank(p.busca, q.consulta) as relevancia
  from public.materiais_paginas p
  join public.materiais m on m.id = p.material_id
  cross join q
  where p.user_id = auth.uid() and p.busca @@ q.consulta
  order by relevancia desc, m.titulo, p.pagina
  limit least(greatest(coalesce(p_limite, 30), 1), 100);
$$;

-- ---------- Segurança (RLS) --------------------------------------------

alter table public.materiais         enable row level security;
alter table public.materiais_paginas enable row level security;
alter table public.anotacoes         enable row level security;

drop policy if exists "dono gerencia" on public.materiais;
create policy "dono gerencia" on public.materiais for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.materiais_paginas;
create policy "dono gerencia" on public.materiais_paginas for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.anotacoes;
create policy "dono gerencia" on public.anotacoes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.materiais, public.materiais_paginas, public.anotacoes to authenticated;
grant execute on function public.buscar_materiais(text, integer) to authenticated;
revoke execute on function public.buscar_materiais(text, integer) from anon, public;

-- ---------- Storage: bucket privado, cada conta só acessa a própria pasta ----

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('materiais', 'materiais', false, 26214400, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "materiais: dono le" on storage.objects;
create policy "materiais: dono le" on storage.objects for select to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "materiais: dono envia" on storage.objects;
create policy "materiais: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "materiais: dono apaga" on storage.objects;
create policy "materiais: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'materiais' and (storage.foldername(name))[1] = (select auth.uid())::text);
