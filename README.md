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

## Próximas fases

| Fase | Entrega |
|---|---|
| B | Questões no formato IBAM (A–D), simulado de 40 questões em 3h com pontuação 3/2/1, caderno de erros automático |
| C | Flashcards com FSRS e cronograma inteligente até a prova |
| D | IA tutora, gerador de questões e flashcards, explicações e resumos |
| E | Materiais em PDF, anotações, busca e estatísticas de desempenho |

## Tecnologia

React 19 · TypeScript · Vite · Tailwind · TanStack Query (cache offline no IndexedDB) · Supabase (Auth, Postgres com RLS) · vite-plugin-pwa · Vitest.

```
src/
  app/          rotas, layout, PWA
  features/     auth · edital · concurso · inicio · configuracoes
  shared/       componentes de interface, hooks, tema
  lib/          Supabase, cache, datas
supabase/
  seed/edital-ace-2026.json   conteúdo oficial do edital (fonte única)
  migrations/                 SQL versionado (estrutura + dados do edital)
  sql-editor-completo.sql     tudo em um arquivo, para colar no SQL Editor
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
