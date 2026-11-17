-- =====================================================================
-- Disponibilidade de estudo pedida pela usuária em 17/11/2026:
-- 3h30 (210 min) por dia, todos os dias. Mantém as demais preferências.
-- Depois disso, a disponibilidade continua editável no app (Plano → Disponibilidade).
-- =====================================================================

update public.perfis
set preferencias = coalesce(preferencias, '{}'::jsonb)
  || jsonb_build_object(
       'estudo',
       coalesce(preferencias -> 'estudo', '{}'::jsonb)
         || '{"minutosPorDia": [210, 210, 210, 210, 210, 210, 210]}'::jsonb
     );
