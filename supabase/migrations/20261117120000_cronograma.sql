-- =====================================================================
-- Projeto Aprovação Saquarema — cronograma firmado (recuperação de atrasos)
--
-- O plano dos próximos dias fica guardado ("firmado"). O que passar do dia
-- sem ser concluído (sessoes_estudo) vira atraso, mostrado no app com um
-- plano de recuperação. Uma linha por dia, com as sessões em JSON.
-- Idempotente: pode ser executado mais de uma vez.
-- =====================================================================

create table if not exists public.cronograma_dias (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data       date not null,
  sessoes    jsonb not null check (jsonb_typeof(sessoes) = 'array'),
  firmado_em timestamptz not null default now(),
  primary key (user_id, data)
);

alter table public.cronograma_dias enable row level security;

drop policy if exists "dono gerencia" on public.cronograma_dias;
create policy "dono gerencia" on public.cronograma_dias for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

grant select, insert, update, delete on public.cronograma_dias to authenticated;
