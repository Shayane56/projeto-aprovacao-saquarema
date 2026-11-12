-- parte-6-fase-b-funcoes-e-seguranca.sql — cole no SQL Editor e clique em Run. Rode as partes em ordem.
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

grant select, insert, update, delete on public.textos_apoio, public.questoes, public.caderno_erros to authenticated;
grant select, insert, update, delete on public.simulados to authenticated;
grant select, insert, update on public.simulado_questoes to authenticated;
grant select, insert, delete on public.respostas to authenticated;
grant execute on function public.iniciar_simulado(text, integer, text[]) to authenticated;
grant execute on function public.finalizar_simulado(text) to authenticated;
revoke execute on function public.iniciar_simulado(text, integer, text[]) from anon, public;
revoke execute on function public.finalizar_simulado(text) from anon, public;
