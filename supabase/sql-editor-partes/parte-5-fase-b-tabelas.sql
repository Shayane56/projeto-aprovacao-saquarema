-- parte-5-fase-b-tabelas.sql — cole no SQL Editor e clique em Run. Rode as partes em ordem.
create table if not exists public.textos_apoio (
  id        text primary key default gen_random_uuid()::text,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titulo    text,
  conteudo  text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.questoes (
  id              text primary key default gen_random_uuid()::text,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id     text not null default 'saquarema-ace-2026' references public.concursos(id) on delete cascade,
  disciplina_id   text not null references public.disciplinas(id) on delete cascade,
  topico_id       text references public.topicos(id) on delete set null,
  texto_id        text references public.textos_apoio(id) on delete set null,
  enunciado       text not null,
  alternativas    jsonb not null check (jsonb_typeof(alternativas) = 'array' and jsonb_array_length(alternativas) between 2 and 5),
  gabarito        smallint check (gabarito between 0 and 4),
  anulada         boolean not null default false,
  explicacao      text,
  origem          text not null default 'manual' check (origem in ('autoral', 'importada', 'manual', 'ia')),
  fonte           text,
  numero_original integer,
  dificuldade     smallint check (dificuldade between 1 and 3),
  hash            text not null,
  criado_em       timestamptz not null default now(),
  constraint questoes_usuario_hash_unico unique (user_id, hash)
);
create index if not exists questoes_usuario_idx on public.questoes (user_id, disciplina_id);

create table if not exists public.simulados (
  id            text primary key default gen_random_uuid()::text,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  concurso_id   text not null default 'saquarema-ace-2026' references public.concursos(id) on delete cascade,
  tipo          text not null check (tipo in ('completo', 'rapido')),
  status        text not null default 'em_andamento' check (status in ('em_andamento', 'finalizado')),
  duracao_seg   integer not null check (duracao_seg > 0),
  iniciado_em   timestamptz not null default now(),
  finalizado_em timestamptz,
  resultado     jsonb
);
create index if not exists simulados_usuario_idx on public.simulados (user_id, iniciado_em desc);

create table if not exists public.simulado_questoes (
  simulado_id   text not null references public.simulados(id) on delete cascade,
  ordem         smallint not null,
  questao_id    text not null references public.questoes(id) on delete cascade,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  escolha       smallint check (escolha between 0 and 4),
  marcada       boolean not null default false,
  respondida_em timestamptz,
  primary key (simulado_id, ordem)
);

create table if not exists public.respostas (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id    text not null references public.questoes(id) on delete cascade,
  escolha       smallint check (escolha between 0 and 4),
  correta       boolean not null default false,
  tempo_seg     integer,
  origem        text not null check (origem in ('treino', 'simulado', 'erros')),
  simulado_id   text references public.simulados(id) on delete cascade,
  respondida_em timestamptz not null default now()
);
create index if not exists respostas_usuario_idx on public.respostas (user_id, questao_id);

create table if not exists public.caderno_erros (
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  questao_id       text not null references public.questoes(id) on delete cascade,
  ultima_escolha   smallint,
  vezes_errada     integer not null default 1,
  acertos_seguidos integer not null default 0,
  resolvido        boolean not null default false,
  motivo           text check (motivo in ('nao_sabia', 'confundi', 'desatencao', 'interpretacao', 'chute', 'tempo')),
  anotacao         text,
  ultimo_erro_em   timestamptz not null default now(),
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  primary key (user_id, questao_id)
);

create or replace function public.corrigir_resposta()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_gabarito smallint;
  v_anulada  boolean;
begin
  select q.gabarito, q.anulada into v_gabarito, v_anulada
  from public.questoes q where q.id = new.questao_id;
  new.correta := coalesce(v_anulada, false) or (new.escolha is not null and new.escolha = v_gabarito);
  return new;
end;
$$;

drop trigger if exists respostas_corrigir on public.respostas;
create trigger respostas_corrigir before insert on public.respostas
  for each row execute function public.corrigir_resposta();

create or replace function public.atualizar_caderno_erros()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.correta then
    insert into public.caderno_erros (user_id, questao_id, ultima_escolha, vezes_errada, ultimo_erro_em)
    values (new.user_id, new.questao_id, new.escolha, 1, new.respondida_em)
    on conflict (user_id, questao_id) do update
      set vezes_errada = public.caderno_erros.vezes_errada + 1,
          ultima_escolha = excluded.ultima_escolha,
          ultimo_erro_em = excluded.ultimo_erro_em,
          acertos_seguidos = 0,
          resolvido = false;
  else
    update public.caderno_erros
       set acertos_seguidos = acertos_seguidos + 1,
           resolvido = resolvido or acertos_seguidos + 1 >= 2
     where user_id = new.user_id and questao_id = new.questao_id;
  end if;
  return new;
end;
$$;

drop trigger if exists respostas_caderno on public.respostas;
create trigger respostas_caderno after insert on public.respostas
  for each row execute function public.atualizar_caderno_erros();

drop trigger if exists caderno_atualizado_em on public.caderno_erros;
create trigger caderno_atualizado_em before update on public.caderno_erros
  for each row execute function public.tocar_atualizado_em();
