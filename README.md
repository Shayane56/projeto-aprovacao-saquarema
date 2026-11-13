# Projeto Aprovação Saquarema

Plataforma pessoal de preparação para o **Processo Seletivo Público nº 001/2026 da Prefeitura de Saquarema/RJ (IBAM)**, cargo **022 — Agente de Combate às Endemias**. Prova objetiva em **31/01/2027**.

App web instalável (PWA) para Android e computador, com login e dados sincronizados na nuvem (Supabase), tema claro e escuro.

## O que já funciona (Fase A)

- **Login** por e-mail e senha, com cadastro e recuperação de senha.
- **Edital verticalizado já carregado**: 4 disciplinas, 55 itens e 29 subitens, exatamente como no edital. Cada tópico pode ser marcado como *não iniciado*, *estudando*, *revisando* ou *dominado*, com busca (que ignora acentos) e filtros.
- **Progresso ponderado pela prova**: Conhecimentos Específicos valem 60 pontos, Português 20 e SUS + Município 10. O painel mostra onde estão mais pontos em aberto.
- **Contagem regressiva** até a prova e **cronograma completo** do processo seletivo, com marcação das etapas que dependem de você (isenção, inscrição, boleto, títulos…).
- **Regras do concurso**: formato da prova, nota mínima (54/90, sem zerar disciplina), desempate, títulos.
- **Offline**: o conteúdo fica salvo no aparelho, e o que você marca sem internet é enviado quando a conexão volta.

## O que já funciona (Fase B)

- **Banco de questões** ligado aos tópicos do edital, já com **125 questões autorais no estilo IBAM** e **questões de provas reais** de Agente de Endemias — 30 de Conhecimentos Específicos, 15 de Português, 15 de SUS e 65 de Conhecimentos do Município (baseadas no documento oficial do IBAM, na Lei Orgânica e na biografia de Alberto de Oliveira da ABL, com o artigo/trecho no comentário) — instaladas automaticamente na sua conta.
- **Resolver questões** por disciplina, tópico (incluindo subtópicos), não respondidas, todas ou só os erros pendentes, com correção e comentário na hora.
- **Simulados IBAM**: completo (40 questões em 3h) e rápido (10 em 45 min), com pontuação 3/2/1, nota mínima de 60% e reprovação por bloco zerado; cronômetro, mapa de questões, marcação "revisar", retomada em outro aparelho e histórico.
- **Caderno de erros automático**: toda questão errada entra, com motivo e anotação; acertou 2 vezes seguidas, fica resolvida.
- **Importar provas** do IBAM em PDF (lido no próprio aparelho) ou texto, com gabarito, textos de apoio, sugestão de disciplina e tópico, e revisão antes de salvar. Também é possível cadastrar questões manualmente.

## O que já funciona (Fase C)

- **Plano de estudos inteligente** até 31/01: recalculado todo dia a partir do progresso no edital, do desempenho nas questões e da sua disponibilidade por dia da semana. Prioriza o que vale mais pontos e o que você mais erra, alterna os blocos (CE 55% · PT 27% · SUS/Município 18%), revisa cada tópico 7 dias depois, agenda caderno de erros e simulado semanal (completo nas 6 últimas semanas), deixa a última semana só para revisão e a véspera leve. Avisa quando o tempo não cobre o edital.
- **Flashcards com revisão espaçada (FSRS)**: pacote inicial com cerca de 60 cartões dos pontos mais cobrados, criação manual ou a partir de uma questão errada, limite de cartões novos por dia, botões Errei/Difícil/Bom/Fácil com o próximo intervalo, e intervalos limitados à data da prova.
- Concluir a teoria de um tópico no plano avança o status dele no edital.

## O que já funciona (Fase E)

- **Materiais**: envie PDFs (até 25 MB, guardados numa pasta privada da sua conta) ou links, ligados a uma disciplina ou tópico do edital. O texto de cada página é lido no próprio aparelho e indexado.
- **Busca dentro de todos os PDFs**, em português (acha "vereador" em "Vereadores"), com o trecho destacado e link direto para a página.
- **Leitor de PDF** no app, página a página, com zoom.
- **Anotações por tópico**: no edital, toque em "Anotar" em qualquer tópico; salva sozinho enquanto você escreve (também offline). Todas ficam reunidas em Materiais → Anotações, com busca.
- **Estatísticas**: previsão de nota na prova (com faixa provável e alerta de risco de zerar bloco), evolução nos simulados com a linha dos 60%, acerto por disciplina, tópicos para reforçar e horas de estudo por semana. Todo gráfico tem "Ver em tabela".

## Fases

| Fase | Situação |
|---|---|
| A — base, edital e concurso | pronta |
| B — questões, simulados, caderno de erros, importação | pronta |
| C — flashcards FSRS e plano de estudos | pronta |
| D — IA tutora | cancelada |
| E — materiais, anotações e estatísticas | pronta |

## Tecnologia

React 19 · TypeScript · Vite · Tailwind · TanStack Query (cache offline no IndexedDB) · pdf.js · Supabase (Auth, Postgres com RLS, Storage) · vite-plugin-pwa · Vitest.

```
src/
  app/          rotas, layout, PWA
  features/     auth · edital · concurso · inicio · configuracoes
                questoes · simulados · erros · importar · flashcards · plano · perfil
                materiais · estatisticas
  shared/       componentes de interface, hooks, tema
  lib/          Supabase, cache, datas
supabase/
  seed/edital-ace-2026.json   conteúdo oficial do edital (fonte única)
  migrations/                 SQL versionado (estrutura + dados do edital)
  sql-editor-completo.sql     tudo em um arquivo, para colar no SQL Editor
  sql-editor-partes/          o mesmo SQL em partes pequenas, para colar pelo celular
```

## Comandos

```bash
npm install
npm run dev          # desenvolvimento
npm test             # testes
npm run build        # versão de produção em dist/
npm run seed:gerar   # regenera o SQL do edital a partir do JSON
npm run icons        # regenera os ícones do PWA
```

Configuração do Supabase e publicação: veja [docs/CONFIGURACAO.md](docs/CONFIGURACAO.md). Arquitetura: [docs/ARQUITETURA.md](docs/ARQUITETURA.md).
