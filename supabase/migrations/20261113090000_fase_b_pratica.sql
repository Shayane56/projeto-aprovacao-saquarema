-- =====================================================================
-- Projeto Aprovação Saquarema — Fase B: questões, simulados e erros
--
-- Todas as tabelas desta fase são pessoais (RLS: só o dono acessa).
-- As questões entram pelo app (pacote autoral, importação de provas e
-- cadastro manual), nunca por migração.
-- O script é idempotente: pode ser executado mais de uma vez.
-- =====================================================================

-- ---------- Tabelas -----------------------------------------------------

-- Texto de apoio compartilhado por várias questões (ex.: interpretação).
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

-- ---------- Gatilhos ----------------------------------------------------

-- A correção é feita no banco: a resposta vem só com a alternativa escolhida.
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

-- Caderno de erros automático: errou → entra (ou volta) para o caderno;
-- acertou 2 vezes seguidas depois do erro → marcado como resolvido.
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

-- ---------- Funções de simulado ----------------------------------------

-- Cria o simulado e suas questões numa única operação.
create or replace function public.iniciar_simulado(p_tipo text, p_duracao_seg integer, p_questoes text[])
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_id text;
begin
  if coalesce(array_length(p_questoes, 1), 0) = 0 then
    raise exception 'O simulado precisa de pelo menos uma questão.';
  end if;
  insert into public.simulados (tipo, duracao_seg) values (p_tipo, p_duracao_seg) returning id into v_id;
  insert into public.simulado_questoes (simulado_id, ordem, questao_id)
  select v_id, t.ordem::smallint, t.questao_id
  from unnest(p_questoes) with ordinality as t(questao_id, ordem);
  return v_id;
end;
$$;

-- Corrige o simulado, grava as respostas (alimentando o caderno de erros)
-- e devolve o resultado por bloco, no critério do edital:
-- mínimo de 60% dos pontos e nenhum bloco zerado.
create or replace function public.finalizar_simulado(p_id text)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_sim       public.simulados;
  v_resultado jsonb;
  v_pontos    numeric;
  v_max       numeric;
  v_minimo    numeric;
  v_zerado    boolean;
begin
  select * into v_sim from public.simulados where id = p_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'Simulado não encontrado.';
  end if;
  if v_sim.status = 'finalizado' then
    return v_sim.resultado;
  end if;

  insert into public.respostas (questao_id, escolha, origem, simulado_id)
  select sq.questao_id, sq.escolha, 'simulado', p_id
  from public.simulado_questoes sq
  where sq.simulado_id = p_id
  order by sq.ordem;

  with base as (
    select sq.escolha, q.gabarito, q.anulada, b.id as bloco_id, b.nome, b.ordem, b.valor_questao
    from public.simulado_questoes sq
    join public.questoes q on q.id = sq.questao_id
    join public.disciplinas d on d.id = q.disciplina_id
    join public.blocos_prova b on b.id = d.bloco_id
    where sq.simulado_id = p_id
  ), por_bloco as (
    select bloco_id, nome, ordem, valor_questao,
           count(*) as total,
           count(*) filter (where anulada or escolha = gabarito) as acertos,
           count(*) filter (where escolha is null) as em_branco
    from base
    group by bloco_id, nome, ordem, valor_questao
  )
  select jsonb_build_object(
           'acertos', sum(acertos),
           'total', sum(total),
           'em_branco', sum(em_branco),
           'pontos', sum(acertos * valor_questao),
           'pontos_max', sum(total * valor_questao),
           'blocos', jsonb_agg(jsonb_build_object(
              'bloco_id', bloco_id, 'nome', nome, 'acertos', acertos, 'total', total, 'em_branco', em_branco,
              'pontos', acertos * valor_questao, 'pontos_max', total * valor_questao) order by ordem)
         ),
         sum(acertos * valor_questao), sum(total * valor_questao), bool_or(acertos = 0)
    into v_resultado, v_pontos, v_max, v_zerado
  from por_bloco;

  v_minimo := ceil(v_max * 0.6);
  v_resultado := v_resultado || jsonb_build_object(
    'nota_minima', v_minimo,
    'algum_bloco_zerado', v_zerado,
    'aprovado', v_pontos >= v_minimo and not v_zerado,
    'tempo_seg', least(extract(epoch from (now() - v_sim.iniciado_em))::integer, v_sim.duracao_seg)
  );

  update public.simulados
     set status = 'finalizado', finalizado_em = now(), resultado = v_resultado
   where id = p_id;

  return v_resultado;
end;
$$;

-- ---------- Segurança (RLS) --------------------------------------------

alter table public.textos_apoio      enable row level security;
alter table public.questoes          enable row level security;
alter table public.simulados         enable row level security;
alter table public.simulado_questoes enable row level security;
alter table public.respostas         enable row level security;
alter table public.caderno_erros     enable row level security;

drop policy if exists "dono gerencia" on public.textos_apoio;
create policy "dono gerencia" on public.textos_apoio for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.questoes;
create policy "dono gerencia" on public.questoes for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "dono le" on public.simulados;
create policy "dono le" on public.simulados for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dono cria" on public.simulados;
create policy "dono cria" on public.simulados for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "dono altera" on public.simulados;
create policy "dono altera" on public.simulados for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "dono apaga" on public.simulados;
create policy "dono apaga" on public.simulados for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dono le" on public.simulado_questoes;
create policy "dono le" on public.simulado_questoes for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dono cria" on public.simulado_questoes;
create policy "dono cria" on public.simulado_questoes for insert to authenticated with check ((select auth.uid()) = user_id);
-- Respostas do simulado só mudam enquanto ele está em andamento.
drop policy if exists "dono responde em andamento" on public.simulado_questoes;
create policy "dono responde em andamento" on public.simulado_questoes for update to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (select 1 from public.simulados s where s.id = simulado_id and s.status = 'em_andamento')
  )
  with check ((select auth.uid()) = user_id);

drop policy if exists "dono le" on public.respostas;
create policy "dono le" on public.respostas for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "dono cria" on public.respostas;
create policy "dono cria" on public.respostas for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "dono apaga" on public.respostas;
create policy "dono apaga" on public.respostas for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "dono gerencia" on public.caderno_erros;
create policy "dono gerencia" on public.caderno_erros for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ---------- Permissões da Data API -------------------------------------

grant select, insert, update, delete on public.textos_apoio, public.questoes, public.caderno_erros to authenticated;
grant select, insert, update, delete on public.simulados to authenticated;
grant select, insert, update on public.simulado_questoes to authenticated;
grant select, insert, delete on public.respostas to authenticated;
grant execute on function public.iniciar_simulado(text, integer, text[]) to authenticated;
grant execute on function public.finalizar_simulado(text) to authenticated;
revoke execute on function public.iniciar_simulado(text, integer, text[]) from anon, public;
revoke execute on function public.finalizar_simulado(text) from anon, public;
