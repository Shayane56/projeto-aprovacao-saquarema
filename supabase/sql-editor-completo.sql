-- Todas as migrações em ordem. Cole no Supabase: SQL Editor → New query → Run.
-- Pode ser executado mais de uma vez sem perder dados.

-- >>> 20261112120000_fase_a_estrutura.sql
-- =====================================================================
-- Projeto Aprovação Saquarema — Fase A: estrutura do banco
--
-- Dados de referência (concurso, blocos, disciplinas, tópicos, etapas):
--   leitura para qualquer pessoa logada, escrita só por migração.
-- Dados pessoais (perfil, progresso, etapas cumpridas):
--   cada conta só enxerga e altera as próprias linhas (RLS).
--
-- O script é idempotente: pode ser executado mais de uma vez.
-- =====================================================================

-- ---------- Dados de referência ----------------------------------------

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

-- Bloco = grupo de pontuação da prova (ex.: "Legislação do SUS e
-- Conhecimentos Gerais do Município" somam 10 questões juntas).
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

-- ---------- Dados pessoais ---------------------------------------------

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

-- ---------- Gatilhos ----------------------------------------------------

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

-- Cria o perfil automaticamente quando uma conta é criada.
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

-- ---------- Segurança (RLS) --------------------------------------------

alter table public.concursos        enable row level security;
alter table public.blocos_prova     enable row level security;
alter table public.disciplinas      enable row level security;
alter table public.topicos          enable row level security;
alter table public.etapas_concurso  enable row level security;
alter table public.perfis           enable row level security;
alter table public.progresso_topico enable row level security;
alter table public.etapas_usuario   enable row level security;

-- Referência: leitura para quem está logado.
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

-- Pessoais: somente o dono.
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

-- ---------- Permissões da Data API -------------------------------------
-- O projeto foi criado sem expor tabelas automaticamente; liberamos aqui
-- apenas o necessário, e somente para contas logadas.

grant usage on schema public to authenticated;
grant select on public.concursos, public.blocos_prova, public.disciplinas,
                public.topicos, public.etapas_concurso to authenticated;
grant select, insert, update on public.perfis to authenticated;
grant select, insert, update, delete on public.progresso_topico, public.etapas_usuario to authenticated;

-- >>> 20261112120100_fase_a_edital_ace.sql
-- =====================================================================
-- GERADO AUTOMATICAMENTE por scripts/gerar-seed.mjs — não edite à mão.
-- Fonte: supabase/seed/edital-ace-2026.json
-- Edital nº 001/2026 — Prefeitura de Saquarema/RJ (IBAM) — cargo 022 ACE
-- 84 tópicos, 23 etapas.
-- =====================================================================

insert into public.concursos (id, nome, orgao, banca, cargo, codigo_cargo, vagas, vagas_ac, vagas_pcd, salario, carga_horaria, escolaridade, taxa_inscricao, prova_inicio, portao_abre, portao_fecha, duracao_min, total_questoes, alternativas, pontuacao_total, nota_minima, link_oficial, regras) values
  ('saquarema-ace-2026', 'Processo Seletivo Público — Edital nº 001/2026', 'Prefeitura Municipal de Saquarema/RJ', 'IBAM — Instituto Brasileiro de Administração Municipal', 'Agente de Combate às Endemias', '022', 84, 80, 4, 3242, '40h semanais', 'Ensino Médio completo, em instituição reconhecida pelo MEC', 94, '2027-01-31T15:10:00-03:00', '2027-01-31T14:00:00-03:00', '2027-01-31T15:00:00-03:00', 180, 40, 4, 90, 54, 'https://www.ibam-concursos.org.br', '{"aprovacao":["Nota mínima de 54 pontos (60% da pontuação total).","Não é permitido zerar nenhuma das disciplinas."],"etapas_selecao":[{"etapa":"1ª etapa","descricao":"Prova objetiva — eliminatória e classificatória (IBAM)."},{"etapa":"2ª etapa","descricao":"Análise de títulos — classificatória (IBAM)."},{"etapa":"3ª etapa","descricao":"Curso de Formação Inicial — eliminatório, mínimo de 40 horas (Secretaria de Saúde de Saquarema)."}],"desempate":["Idade igual ou superior a 60 anos (Estatuto do Idoso).","Mais pontos em Conhecimentos Específicos.","Mais pontos em Português.","Mais pontos em Legislação do SUS e Conhecimentos Gerais do Município.","Maior idade.","Ter exercido a função de jurado (comprovar até o último dia de inscrição)."],"titulos":[{"item":"Curso de capacitação, atualização, extensão ou aperfeiçoamento na área do cargo (mín. 40h)","pontos":"0,5 por curso — máximo 1"},{"item":"Curso técnico na área de saúde relacionado ao cargo (mín. 1.200h)","pontos":"2 — máximo 2"},{"item":"Experiência profissional na área (setor público ou privado)","pontos":"1 por ano — máximo 5"}],"dicas_prova":["Portão abre às 14h00 e fecha às 15h00 — não há segunda chamada.","Transcrever a frase da contracapa em letra cursiva no cartão-resposta (sob pena de eliminação).","Só é possível sair após 50% do tempo de prova, sem levar o caderno."]}'::jsonb)
on conflict (id) do update set nome = excluded.nome, orgao = excluded.orgao, banca = excluded.banca, cargo = excluded.cargo, codigo_cargo = excluded.codigo_cargo, vagas = excluded.vagas, vagas_ac = excluded.vagas_ac, vagas_pcd = excluded.vagas_pcd, salario = excluded.salario, carga_horaria = excluded.carga_horaria, escolaridade = excluded.escolaridade, taxa_inscricao = excluded.taxa_inscricao, prova_inicio = excluded.prova_inicio, portao_abre = excluded.portao_abre, portao_fecha = excluded.portao_fecha, duracao_min = excluded.duracao_min, total_questoes = excluded.total_questoes, alternativas = excluded.alternativas, pontuacao_total = excluded.pontuacao_total, nota_minima = excluded.nota_minima, link_oficial = excluded.link_oficial, regras = excluded.regras;

insert into public.blocos_prova (id, concurso_id, nome, num_questoes, valor_questao, ordem) values
  ('ace26-bloco-ce', 'saquarema-ace-2026', 'Conhecimentos Específicos', 20, 3, 1),
  ('ace26-bloco-pt', 'saquarema-ace-2026', 'Português', 10, 2, 2),
  ('ace26-bloco-sm', 'saquarema-ace-2026', 'Legislação do SUS e Conhecimentos Gerais do Município', 10, 1, 3)
on conflict (id) do update set concurso_id = excluded.concurso_id, nome = excluded.nome, num_questoes = excluded.num_questoes, valor_questao = excluded.valor_questao, ordem = excluded.ordem;

insert into public.disciplinas (id, concurso_id, bloco_id, nome, sigla, cor, ordem) values
  ('ace26-ce', 'saquarema-ace-2026', 'ace26-bloco-ce', 'Conhecimentos Específicos', 'CE', 'blue', 1),
  ('ace26-pt', 'saquarema-ace-2026', 'ace26-bloco-pt', 'Português', 'PT', 'violet', 2),
  ('ace26-sus', 'saquarema-ace-2026', 'ace26-bloco-sm', 'Legislação do SUS', 'SUS', 'teal', 3),
  ('ace26-mun', 'saquarema-ace-2026', 'ace26-bloco-sm', 'Conhecimentos Gerais do Município', 'MUN', 'amber', 4)
on conflict (id) do update set concurso_id = excluded.concurso_id, bloco_id = excluded.bloco_id, nome = excluded.nome, sigla = excluded.sigla, cor = excluded.cor, ordem = excluded.ordem;

insert into public.topicos (id, disciplina_id, parent_id, numero, titulo, referencia, link, ordem) values
  ('ace26-ce-01', 'ace26-ce', null, '1', 'Ética, cidadania e atuação do agente no serviço público.', null, null, 1),
  ('ace26-ce-02', 'ace26-ce', null, '2', 'Sistema Único de Saúde (SUS): princípios, organização e atuação do Agente de Combate às Endemias.', null, null, 2),
  ('ace26-ce-03', 'ace26-ce', null, '3', 'Vigilância e educação em saúde.', null, null, 3),
  ('ace26-ce-04', 'ace26-ce', null, '4', 'Noções de Epidemiologia e saneamento básico.', null, null, 4),
  ('ace26-ce-05', 'ace26-ce', null, '5', 'Promoção da saúde e determinantes ambientais das doenças.', null, null, 5),
  ('ace26-ce-06', 'ace26-ce', null, '6', 'Sistemas de informação em saúde: registro, comunicação e uso das informações.', null, null, 6),
  ('ace26-ce-07', 'ace26-ce', null, '7', 'Visita domiciliar, territorialização, cadastramento de imóveis e identificação de áreas de risco.', null, null, 7),
  ('ace26-ce-08', 'ace26-ce', null, '8', 'Conhecimento básico sobre doenças como leishmaniose, cólera, dengue, doença de chagas, esquistossomose, raiva, leptospirose, peste, malária, Esporotricose e febre amarela.', null, null, 8),
  ('ace26-ce-09', 'ace26-ce', null, '9', 'Biologia dos vetores: identificação, operações de campo, reconhecimento geográfico, tratamento focal, perifocal, bloqueio, EPI e formas de controle.', null, null, 9),
  ('ace26-ce-10', 'ace26-ce', null, '10', 'Controle de vetores e manejo ambiental: controle químico, biológico e integrado; uso de EPI e segurança do trabalho.', null, null, 10),
  ('ace26-ce-11', 'ace26-ce', null, '11', 'Organização e operação de campo nas ações de prevenção e controle de endemias.', null, null, 11),
  ('ace26-ce-12', 'ace26-ce', null, '12', 'Relação entre condições ambientais, saneamento básico e ocorrência de doenças e agravos à saúde.', null, null, 12),
  ('ace26-pt-01', 'ace26-pt', null, '1', 'Leitura e compreensão de textos variados.', null, null, 1),
  ('ace26-pt-02', 'ace26-pt', null, '2', 'Modos de organização do discurso: descritivo, narrativo, argumentativo, injuntivo, expositivo e dissertativo.', null, null, 2),
  ('ace26-pt-03', 'ace26-pt', null, '3', 'Gêneros do discurso: definição, reconhecimento dos elementos básicos.', null, null, 3),
  ('ace26-pt-04', 'ace26-pt', null, '4', 'Coesão e coerência: mecanismos, efeitos de sentido no texto.', null, null, 4),
  ('ace26-pt-05', 'ace26-pt', null, '5', 'Relação entre as partes do texto: causa, consequência, comparação, conclusão, exemplificação, generalização, particularização.', null, null, 5),
  ('ace26-pt-06', 'ace26-pt', null, '6', 'Conectivos: classificação, uso, efeitos de sentido.', null, null, 6),
  ('ace26-pt-07', 'ace26-pt', null, '7', 'Verbos: pessoa, número, tempo e modo. Vozes verbais. Transitividade verbal e nominal. Estrutura, classificação e formação de palavras. Funções e classes de palavras. Flexão nominal e verbal. Regência verbal e nominal.', null, null, 7),
  ('ace26-pt-08', 'ace26-pt', null, '8', 'Pronomes: emprego, formas de tratamento e colocação.', null, null, 8),
  ('ace26-pt-09', 'ace26-pt', null, '9', 'Figuras de linguagem.', null, null, 9),
  ('ace26-pt-10', 'ace26-pt', null, '10', 'Funções da linguagem.', null, null, 10),
  ('ace26-pt-11', 'ace26-pt', null, '11', 'Sinônimos, antônimos, parônimos e homônimos.', null, null, 11),
  ('ace26-pt-12', 'ace26-pt', null, '12', 'Acentuação gráfica.', null, null, 12),
  ('ace26-pt-13', 'ace26-pt', null, '13', 'Pontuação: regras e efeitos de sentido.', null, null, 13),
  ('ace26-pt-14', 'ace26-pt', null, '14', 'Recursos gráficos: regras, efeitos de sentido. Sintaxe do Período Simples.', null, null, 14),
  ('ace26-pt-15', 'ace26-pt', null, '15', 'Coordenação e subordinação.', null, null, 15),
  ('ace26-pt-16', 'ace26-pt', null, '16', 'Crase.', null, null, 16),
  ('ace26-pt-17', 'ace26-pt', null, '17', 'Ortografia.', null, null, 17),
  ('ace26-sus-01', 'ace26-sus', null, '1', 'Sistemas de saúde.', null, null, 1),
  ('ace26-sus-02', 'ace26-sus', null, '2', 'A Saúde Pública no Brasil.', null, null, 2),
  ('ace26-sus-03', 'ace26-sus', null, '3', 'História das políticas de saúde no Brasil: retrospectiva; reforma sanitária.', null, null, 3),
  ('ace26-sus-04', 'ace26-sus', null, '4', 'Sistema Único de Saúde (SUS).', null, null, 4),
  ('ace26-sus-05', 'ace26-sus', null, '5', 'Fundamentos do SUS.', null, null, 5),
  ('ace26-sus-06', 'ace26-sus', null, '6', 'Diretrizes e bases da implantação do SUS.', null, null, 6),
  ('ace26-sus-07', 'ace26-sus', null, '7', 'Regulamento técnico da Atenção às Urgências (Diretrizes Gerais e Componentes da Rede Assistencial).', null, null, 7),
  ('ace26-sus-08', 'ace26-sus', null, '8', 'Gestão do SUS: diretrizes para a gestão do SUS; Descentralização; Regionalização; Financiamento; Regulação; Participação Popular; Responsabilidade sanitária das instâncias gestoras do SUS; Planejamento e Programação; Regulação, Controle, Avaliação e Auditoria.', null, null, 8),
  ('ace26-sus-09', 'ace26-sus', null, '9', 'Política Nacional da Atenção Básica (2011 e 2017).', null, null, 9),
  ('ace26-sus-10', 'ace26-sus', null, '10', 'Organização da Atenção Básica no Sistema Único de Saúde.', null, null, 10),
  ('ace26-sus-11', 'ace26-sus', null, '11', 'Epidemiologia, história natural e prevenção de doenças.', null, null, 11),
  ('ace26-sus-12', 'ace26-sus', null, '12', 'Modelos de atenção à saúde.', null, null, 12),
  ('ace26-sus-13', 'ace26-sus', null, '13', 'Constituição Federal (art. 196 a 200).', null, null, 13),
  ('ace26-sus-14', 'ace26-sus', null, '14', 'Redes de Atenção à Saúde.', null, null, 14),
  ('ace26-sus-15', 'ace26-sus', null, '15', 'Atenção Primária à Saúde.', null, null, 15),
  ('ace26-sus-16', 'ace26-sus', null, '16', 'Vigilância em Saúde.', null, null, 16),
  ('ace26-sus-17', 'ace26-sus', null, '17', 'Promoção à saúde.', null, null, 17),
  ('ace26-sus-18', 'ace26-sus', null, '18', 'Controle social da saúde.', null, null, 18),
  ('ace26-sus-19', 'ace26-sus', null, '19', 'Estratégia de Saúde da Família.', null, null, 19),
  ('ace26-sus-20', 'ace26-sus', null, '20', 'Determinantes Sociais em Saúde.', null, null, 20),
  ('ace26-sus-21', 'ace26-sus', null, '21', 'Política nacional de humanização.', null, null, 21),
  ('ace26-sus-22', 'ace26-sus', null, '22', 'Sistemas de informação em saúde.', null, null, 22),
  ('ace26-sus-23', 'ace26-sus', null, '23', 'Doenças de notificação compulsória.', null, null, 23),
  ('ace26-mun-01', 'ace26-mun', null, '1', 'Informações gerais sobre o município de Saquarema (planos municipais, órgãos do governo, serviços públicos e aspectos gerais do município: cultura, história, hino, símbolos, dados, turismo).', 'Base: documento “Conhecimentos sobre o Município de Saquarema”, disponível no site do IBAM.', 'https://www.ibam-concursos.org.br', 1),
  ('ace26-mun-02', 'ace26-mun', null, '2', 'Dados biográficos sobre Alberto de Oliveira.', null, 'https://www.academia.org.br/academicos/alberto-de-oliveira/biografia', 2),
  ('ace26-mun-03', 'ace26-mun', null, '3', 'Lei Orgânica de Saquarema e suas atualizações.', null, 'https://www.transparencia.saquarema.rj.leg.br/arquivos/5/_0000001.pdf', 3)
on conflict (id) do update set disciplina_id = excluded.disciplina_id, parent_id = excluded.parent_id, numero = excluded.numero, titulo = excluded.titulo, referencia = excluded.referencia, link = excluded.link, ordem = excluded.ordem;

insert into public.topicos (id, disciplina_id, parent_id, numero, titulo, referencia, link, ordem) values
  ('ace26-ce-08-01', 'ace26-ce', 'ace26-ce-08', '8.1', 'Leishmaniose', null, null, 1),
  ('ace26-ce-08-02', 'ace26-ce', 'ace26-ce-08', '8.2', 'Cólera', null, null, 2),
  ('ace26-ce-08-03', 'ace26-ce', 'ace26-ce-08', '8.3', 'Dengue', null, null, 3),
  ('ace26-ce-08-04', 'ace26-ce', 'ace26-ce-08', '8.4', 'Doença de Chagas', null, null, 4),
  ('ace26-ce-08-05', 'ace26-ce', 'ace26-ce-08', '8.5', 'Esquistossomose', null, null, 5),
  ('ace26-ce-08-06', 'ace26-ce', 'ace26-ce-08', '8.6', 'Raiva', null, null, 6),
  ('ace26-ce-08-07', 'ace26-ce', 'ace26-ce-08', '8.7', 'Leptospirose', null, null, 7),
  ('ace26-ce-08-08', 'ace26-ce', 'ace26-ce-08', '8.8', 'Peste', null, null, 8),
  ('ace26-ce-08-09', 'ace26-ce', 'ace26-ce-08', '8.9', 'Malária', null, null, 9),
  ('ace26-ce-08-10', 'ace26-ce', 'ace26-ce-08', '8.10', 'Esporotricose', null, null, 10),
  ('ace26-ce-08-11', 'ace26-ce', 'ace26-ce-08', '8.11', 'Febre amarela', null, null, 11),
  ('ace26-pt-07-01', 'ace26-pt', 'ace26-pt-07', '7.1', 'Verbos: pessoa, número, tempo e modo', null, null, 1),
  ('ace26-pt-07-02', 'ace26-pt', 'ace26-pt-07', '7.2', 'Vozes verbais', null, null, 2),
  ('ace26-pt-07-03', 'ace26-pt', 'ace26-pt-07', '7.3', 'Transitividade verbal e nominal', null, null, 3),
  ('ace26-pt-07-04', 'ace26-pt', 'ace26-pt-07', '7.4', 'Estrutura, classificação e formação de palavras', null, null, 4),
  ('ace26-pt-07-05', 'ace26-pt', 'ace26-pt-07', '7.5', 'Funções e classes de palavras', null, null, 5),
  ('ace26-pt-07-06', 'ace26-pt', 'ace26-pt-07', '7.6', 'Flexão nominal e verbal', null, null, 6),
  ('ace26-pt-07-07', 'ace26-pt', 'ace26-pt-07', '7.7', 'Regência verbal e nominal', null, null, 7),
  ('ace26-pt-14-01', 'ace26-pt', 'ace26-pt-14', '14.1', 'Recursos gráficos: regras e efeitos de sentido', null, null, 1),
  ('ace26-pt-14-02', 'ace26-pt', 'ace26-pt-14', '14.2', 'Sintaxe do período simples', null, null, 2),
  ('ace26-sus-08-01', 'ace26-sus', 'ace26-sus-08', '8.1', 'Diretrizes para a gestão do SUS', null, null, 1),
  ('ace26-sus-08-02', 'ace26-sus', 'ace26-sus-08', '8.2', 'Descentralização', null, null, 2),
  ('ace26-sus-08-03', 'ace26-sus', 'ace26-sus-08', '8.3', 'Regionalização', null, null, 3),
  ('ace26-sus-08-04', 'ace26-sus', 'ace26-sus-08', '8.4', 'Financiamento', null, null, 4),
  ('ace26-sus-08-05', 'ace26-sus', 'ace26-sus-08', '8.5', 'Regulação', null, null, 5),
  ('ace26-sus-08-06', 'ace26-sus', 'ace26-sus-08', '8.6', 'Participação popular', null, null, 6),
  ('ace26-sus-08-07', 'ace26-sus', 'ace26-sus-08', '8.7', 'Responsabilidade sanitária das instâncias gestoras do SUS', null, null, 7),
  ('ace26-sus-08-08', 'ace26-sus', 'ace26-sus-08', '8.8', 'Planejamento e programação', null, null, 8),
  ('ace26-sus-08-09', 'ace26-sus', 'ace26-sus-08', '8.9', 'Regulação, controle, avaliação e auditoria', null, null, 9)
on conflict (id) do update set disciplina_id = excluded.disciplina_id, parent_id = excluded.parent_id, numero = excluded.numero, titulo = excluded.titulo, referencia = excluded.referencia, link = excluded.link, ordem = excluded.ordem;

insert into public.etapas_concurso (id, concurso_id, titulo, descricao, categoria, data_inicio, data_fim, acao, ordem) values
  ('ace26-etapa-01', 'saquarema-ace-2026', 'Publicação do edital', null, 'edital', '2026-11-10', null, false, 1),
  ('ace26-etapa-02', 'saquarema-ace-2026', 'Pedido de isenção da taxa (CadÚnico)', 'Somente para quem comprova inscrição no CadÚnico. O comprovante deve ser emitido após a publicação do edital.', 'isencao', '2026-11-17', '2026-11-19', true, 2),
  ('ace26-etapa-03', 'saquarema-ace-2026', 'Inscrições pela internet', 'Site do IBAM, cargo 022 — Agente de Combate às Endemias. Prazo até 23h59 do último dia.', 'inscricao', '2026-11-17', '2026-12-22', true, 3),
  ('ace26-etapa-04', 'saquarema-ace-2026', 'Resultado dos pedidos de isenção', null, 'isencao', '2026-12-07', null, false, 4),
  ('ace26-etapa-05', 'saquarema-ace-2026', 'Recurso contra isenção negada', null, 'isencao', '2026-12-08', '2026-12-09', false, 5),
  ('ace26-etapa-06', 'saquarema-ace-2026', 'Resposta aos recursos de isenção', null, 'isencao', '2026-12-18', null, false, 6),
  ('ace26-etapa-07', 'saquarema-ace-2026', 'Data limite para pagar o boleto', 'Taxa de R$ 94,00.', 'inscricao', '2026-12-23', null, true, 7),
  ('ace26-etapa-08', 'saquarema-ace-2026', 'Conferir se a inscrição foi deferida', null, 'inscricao', '2026-12-28', null, true, 8),
  ('ace26-etapa-09', 'saquarema-ace-2026', 'Relação de PcD e condições especiais', null, 'pcd', '2027-01-15', null, false, 9),
  ('ace26-etapa-10', 'saquarema-ace-2026', 'Recursos contra a relação de PcD e condições especiais', null, 'pcd', '2027-01-18', '2027-01-19', false, 10),
  ('ace26-etapa-11', 'saquarema-ace-2026', 'Relação final de PcD e condições especiais', null, 'pcd', '2027-01-27', null, false, 11),
  ('ace26-etapa-12', 'saquarema-ace-2026', 'Prova objetiva', 'Turno da tarde: portão abre 14h00, fecha 15h00, início 15h10, duração de 3 horas.', 'prova', '2027-01-31', null, true, 12),
  ('ace26-etapa-13', 'saquarema-ace-2026', 'Gabarito preliminar', null, 'gabarito', '2027-02-01', null, false, 13),
  ('ace26-etapa-14', 'saquarema-ace-2026', 'Recursos contra o gabarito preliminar', null, 'gabarito', '2027-02-02', '2027-02-03', false, 14),
  ('ace26-etapa-15', 'saquarema-ace-2026', 'Resultado parcial e cartão-resposta', null, 'resultado', '2027-03-01', null, false, 15),
  ('ace26-etapa-16', 'saquarema-ace-2026', 'Recursos contra o resultado parcial', null, 'resultado', '2027-03-02', '2027-03-03', false, 16),
  ('ace26-etapa-17', 'saquarema-ace-2026', 'Síntese dos recursos do resultado parcial', null, 'resultado', '2027-03-12', null, false, 17),
  ('ace26-etapa-18', 'saquarema-ace-2026', 'Envio dos títulos', 'Para quem foi aprovado na prova objetiva e classificado nas proporções do edital.', 'titulos', '2027-03-15', '2027-03-17', true, 18),
  ('ace26-etapa-19', 'saquarema-ace-2026', 'Resultado da prova de títulos', null, 'titulos', '2027-04-05', null, false, 19),
  ('ace26-etapa-20', 'saquarema-ace-2026', 'Recursos contra o resultado dos títulos', null, 'titulos', '2027-04-06', '2027-04-07', false, 20),
  ('ace26-etapa-21', 'saquarema-ace-2026', 'Síntese dos recursos dos títulos', null, 'titulos', '2027-04-14', null, false, 21),
  ('ace26-etapa-22', 'saquarema-ace-2026', 'Resultado da 1ª e 2ª etapas', null, 'resultado', '2027-04-16', null, false, 22),
  ('ace26-etapa-23', 'saquarema-ace-2026', 'Curso de Formação Inicial', '3ª etapa, eliminatória. Data definida pela Prefeitura após o resultado.', 'formacao', null, null, false, 23)
on conflict (id) do update set concurso_id = excluded.concurso_id, titulo = excluded.titulo, descricao = excluded.descricao, categoria = excluded.categoria, data_inicio = excluded.data_inicio, data_fim = excluded.data_fim, acao = excluded.acao, ordem = excluded.ordem;

-- >>> 20261113090000_fase_b_pratica.sql
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
