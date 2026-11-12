-- parte-1-estrutura.sql — cole no SQL Editor e clique em Run. Rode as partes em ordem (1, 2, 3, 4).
create table if not exists public.concursos (
  id              text primary key,
  nome            text not null,
  orgao           text not null,
  banca           text not null,
  cargo           text not null,
  codigo_cargo    text,
  vagas           integer,
  vagas_ac        integer,
  vagas_pcd       integer,
  salario         numeric(10,2),
  carga_horaria   text,
  escolaridade    text,
  taxa_inscricao  numeric(10,2),
  prova_inicio    timestamptz,
  portao_abre     timestamptz,
  portao_fecha    timestamptz,
  duracao_min     integer,
  total_questoes  integer not null,
  alternativas    integer not null,
  pontuacao_total numeric(6,2) not null,
  nota_minima     numeric(6,2) not null,
  link_oficial    text,
  regras          jsonb not null default '{}'::jsonb,
  criado_em       timestamptz not null default now()
);

create table if not exists public.blocos_prova (
  id            text primary key,
  concurso_id   text not null references public.concursos(id) on delete cascade,
  nome          text not null,
  num_questoes  integer not null check (num_questoes > 0),
  valor_questao numeric(6,2) not null check (valor_questao > 0),
  ordem         integer not null
);

create table if not exists public.disciplinas (
  id          text primary key,
  concurso_id text not null references public.concursos(id) on delete cascade,
  bloco_id    text not null references public.blocos_prova(id) on delete cascade,
  nome        text not null,
  sigla       text not null,
  cor         text not null default 'blue',
  ordem       integer not null
);

create table if not exists public.topicos (
  id            text primary key,
  disciplina_id text not null references public.disciplinas(id) on delete cascade,
  parent_id     text references public.topicos(id) on delete cascade,
  numero        text not null,
  titulo        text not null,
  referencia    text,
  link          text,
  ordem         integer not null
);
create index if not exists topicos_disciplina_idx on public.topicos (disciplina_id);
create index if not exists topicos_parent_idx on public.topicos (parent_id);

create table if not exists public.etapas_concurso (
  id          text primary key,
  concurso_id text not null references public.concursos(id) on delete cascade,
  titulo      text not null,
  descricao   text,
  categoria   text not null,
  data_inicio date,
  data_fim    date,
  acao        boolean not null default false,
  ordem       integer not null
);
create index if not exists etapas_concurso_idx on public.etapas_concurso (concurso_id);

create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  nome          text,
  concurso_id   text references public.concursos(id) on delete set null default 'saquarema-ace-2026',
  preferencias  jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.progresso_topico (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  topico_id     text not null references public.topicos(id) on delete cascade,
  status        text not null default 'nao_iniciado'
                check (status in ('nao_iniciado', 'estudando', 'revisando', 'dominado')),
  anotacao      text,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, topico_id)
);

create table if not exists public.etapas_usuario (
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  etapa_id      text not null references public.etapas_concurso(id) on delete cascade,
  concluida     boolean not null default true,
  atualizado_em timestamptz not null default now(),
  primary key (user_id, etapa_id)
);

create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

drop trigger if exists perfis_atualizado_em on public.perfis;
create trigger perfis_atualizado_em before update on public.perfis
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists progresso_atualizado_em on public.progresso_topico;
create trigger progresso_atualizado_em before update on public.progresso_topico
  for each row execute function public.tocar_atualizado_em();

drop trigger if exists etapas_usuario_atualizado_em on public.etapas_usuario;
create trigger etapas_usuario_atualizado_em before update on public.etapas_usuario
  for each row execute function public.tocar_atualizado_em();

create or replace function public.criar_perfil_novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'nome'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil_novo_usuario();

alter table public.concursos        enable row level security;
alter table public.blocos_prova     enable row level security;
alter table public.disciplinas      enable row level security;
alter table public.topicos          enable row level security;
alter table public.etapas_concurso  enable row level security;
alter table public.perfis           enable row level security;
alter table public.progresso_topico enable row level security;
alter table public.etapas_usuario   enable row level security;

drop policy if exists "leitura logada" on public.concursos;
create policy "leitura logada" on public.concursos for select to authenticated using (true);
drop policy if exists "leitura logada" on public.blocos_prova;
create policy "leitura logada" on public.blocos_prova for select to authenticated using (true);
drop policy if exists "leitura logada" on public.disciplinas;
create policy "leitura logada" on public.disciplinas for select to authenticated using (true);
drop policy if exists "leitura logada" on public.topicos;
create policy "leitura logada" on public.topicos for select to authenticated using (true);
drop policy if exists "leitura logada" on public.etapas_concurso;
create policy "leitura logada" on public.etapas_concurso for select to authenticated using (true);

drop policy if exists "dono le" on public.perfis;
create policy "dono le" on public.perfis for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "dono altera" on public.perfis;
create policy "dono altera" on public.perfis for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "dono cria" on public.perfis;
create policy "dono cria" on public.perfis for insert to authenticated with check ((select auth.uid()) = id);

drop policy if exists "dono gerencia" on public.progresso_topico;
create policy "dono gerencia" on public.progresso_topico for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.etapas_usuario;
create policy "dono gerencia" on public.etapas_usuario for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant usage on schema public to authenticated;
grant select on public.concursos, public.blocos_prova, public.disciplinas,
                public.topicos, public.etapas_concurso to authenticated;
grant select, insert, update on public.perfis to authenticated;
grant select, insert, update, delete on public.progresso_topico, public.etapas_usuario to authenticated;
