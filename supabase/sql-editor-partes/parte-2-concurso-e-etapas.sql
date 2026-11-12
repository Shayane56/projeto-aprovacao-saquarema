-- parte-2-concurso-e-etapas.sql — cole no SQL Editor e clique em Run. Rode as partes em ordem (1, 2, 3, 4).
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
