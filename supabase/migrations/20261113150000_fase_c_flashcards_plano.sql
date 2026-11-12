-- =====================================================================
-- Projeto Aprovação Saquarema — Fase C: flashcards (FSRS) e plano de estudos
--
-- O agendamento FSRS é calculado no app (biblioteca ts-fsrs); o banco guarda
-- o estado de cada cartão e o histórico de revisões. O plano de estudos é
-- gerado no app a partir do edital, do progresso e do desempenho; o banco
-- guarda só as sessões concluídas e as preferências (perfis.preferencias).
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

create table if not exists public.flashcards (
  id               text primary key default gen_random_uuid()::text,
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  disciplina_id    text not null references public.disciplinas(id) on delete cascade,
  topico_id        text references public.topicos(id) on delete set null,
  questao_id       text references public.questoes(id) on delete set null,
  frente           text not null,
  verso            text not null,
  origem           text not null default 'manual' check (origem in ('autoral', 'manual', 'erro', 'ia')),
  suspenso         boolean not null default false,
  hash             text not null,
  -- estado FSRS
  due              timestamptz not null default now(),
  stability        double precision not null default 0,
  difficulty       double precision not null default 0,
  elapsed_days     integer not null default 0,
  scheduled_days   integer not null default 0,
  learning_steps   integer not null default 0,
  reps             integer not null default 0,
  lapses           integer not null default 0,
  state            smallint not null default 0 check (state between 0 and 3),
  last_review      timestamptz,
  criado_em        timestamptz not null default now(),
  constraint flashcards_usuario_hash_unico unique (user_id, hash)
);
create index if not exists flashcards_fila_idx on public.flashcards (user_id, due) where not suspenso;

create table if not exists public.revisoes_flashcard (
  id                bigint generated always as identity primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  flashcard_id      text not null references public.flashcards(id) on delete cascade,
  rating            smallint not null check (rating between 1 and 4),
  state             smallint not null,
  due               timestamptz not null,
  stability         double precision not null,
  difficulty        double precision not null,
  elapsed_days      integer not null,
  last_elapsed_days integer not null,
  scheduled_days    integer not null,
  learning_steps    integer not null default 0,
  review            timestamptz not null,
  duracao_ms        integer
);
create index if not exists revisoes_flashcard_usuario_idx on public.revisoes_flashcard (user_id, review);

-- Sessões do plano de estudos concluídas (o plano em si é recalculado no app).
create table if not exists public.sessoes_estudo (
  id                 text primary key default gen_random_uuid()::text,
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave              text not null,
  data               date not null,
  tipo               text not null check (tipo in ('teoria', 'questoes', 'revisao', 'flashcards', 'simulado', 'erros')),
  disciplina_id      text references public.disciplinas(id) on delete set null,
  topico_id          text references public.topicos(id) on delete set null,
  titulo             text not null,
  minutos            integer not null check (minutos >= 0),
  concluida_em       timestamptz not null default now(),
  constraint sessoes_usuario_chave_unica unique (user_id, chave)
);
create index if not exists sessoes_usuario_data_idx on public.sessoes_estudo (user_id, data);

-- Grava o novo estado do cartão e o registro da revisão numa única operação.
create or replace function public.revisar_flashcard(p_id text, p_cartao jsonb, p_log jsonb)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.flashcards set
    due = (p_cartao ->> 'due')::timestamptz,
    stability = (p_cartao ->> 'stability')::double precision,
    difficulty = (p_cartao ->> 'difficulty')::double precision,
    elapsed_days = (p_cartao ->> 'elapsed_days')::integer,
    scheduled_days = (p_cartao ->> 'scheduled_days')::integer,
    learning_steps = coalesce((p_cartao ->> 'learning_steps')::integer, 0),
    reps = (p_cartao ->> 'reps')::integer,
    lapses = (p_cartao ->> 'lapses')::integer,
    state = (p_cartao ->> 'state')::smallint,
    last_review = (p_cartao ->> 'last_review')::timestamptz
  where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Cartão não encontrado.';
  end if;

  insert into public.revisoes_flashcard
    (flashcard_id, rating, state, due, stability, difficulty, elapsed_days, last_elapsed_days, scheduled_days, learning_steps, review, duracao_ms)
  values (
    p_id,
    (p_log ->> 'rating')::smallint,
    (p_log ->> 'state')::smallint,
    (p_log ->> 'due')::timestamptz,
    (p_log ->> 'stability')::double precision,
    (p_log ->> 'difficulty')::double precision,
    (p_log ->> 'elapsed_days')::integer,
    (p_log ->> 'last_elapsed_days')::integer,
    (p_log ->> 'scheduled_days')::integer,
    coalesce((p_log ->> 'learning_steps')::integer, 0),
    (p_log ->> 'review')::timestamptz,
    (p_log ->> 'duracao_ms')::integer
  );
end;
$$;

-- ---------- Segurança (RLS) --------------------------------------------

alter table public.flashcards         enable row level security;
alter table public.revisoes_flashcard enable row level security;
alter table public.sessoes_estudo     enable row level security;

drop policy if exists "dono gerencia" on public.flashcards;
create policy "dono gerencia" on public.flashcards for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono le" on public.revisoes_flashcard;
create policy "dono le" on public.revisoes_flashcard for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dono cria" on public.revisoes_flashcard;
create policy "dono cria" on public.revisoes_flashcard for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.sessoes_estudo;
create policy "dono gerencia" on public.sessoes_estudo for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.flashcards, public.sessoes_estudo to authenticated;
grant select, insert on public.revisoes_flashcard to authenticated;
grant execute on function public.revisar_flashcard(text, jsonb, jsonb) to authenticated;
revoke execute on function public.revisar_flashcard(text, jsonb, jsonb) from anon, public;
