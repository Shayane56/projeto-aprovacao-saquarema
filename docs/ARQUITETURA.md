# Arquitetura

## Visão geral

```
Navegador / PWA (React)
  Telas → hooks (TanStack Query) → api.ts de cada módulo → Supabase
  Cache offline no IndexedDB + fila de alterações pendentes
        │ HTTPS (sessão do Supabase Auth)
Supabase
  Auth          login por e-mail
  Postgres      tabelas com RLS (cada conta só acessa os próprios dados)
  Edge Functions (Fase D) única porta para a IA; a chave fica no servidor
```

## Decisões

- **Supabase como fonte oficial dos dados.** O app guarda um cache no aparelho (7 dias) e retoma as alterações feitas offline, inclusive depois de fechar o app (`setMutationDefaults` + `resumePausedMutations`).
- **Dados de referência × dados pessoais.** Concurso, blocos, disciplinas, tópicos e etapas vêm por migração e são só leitura. Perfil, progresso e etapas marcadas pertencem a cada conta.
- **IDs estáveis** nos tópicos (`ace26-ce-08-03` = Conhecimentos Específicos, item 8, subitem 3). Corrigir um texto do edital não apaga o progresso.
- **Fonte única do edital:** `supabase/seed/edital-ace-2026.json` gera a migração SQL (`npm run seed:gerar`). O CI falha se os dois estiverem fora de sincronia.
- **Progresso ponderado:** status vale 0, 1/3, 2/3 ou 1; item com subitens = média dos subitens; disciplina = média dos itens; geral = média dos blocos ponderada pelos pontos da prova (60/20/10).
- **Rotas com `#` (HashRouter) e `base: './'`**: o mesmo build funciona no GitHub Pages, na Vercel ou em qualquer pasta.
- **Módulos por funcionalidade** (`src/features/*`): cada um tem `tipos.ts`, `api.ts` (acesso ao Supabase), `hooks.ts` (cache e atualização otimista) e as telas. Uma nova fase acrescenta módulos sem mexer nos existentes.

## Banco (Fase A)

| Tabela | Conteúdo | Acesso |
|---|---|---|
| `concursos` | dados do edital, formato da prova, regras (jsonb) | leitura para quem está logado |
| `blocos_prova` | grupos de pontuação (questões × valor) | leitura |
| `disciplinas` | disciplinas e o bloco de cada uma | leitura |
| `topicos` | itens e subitens do edital (`parent_id`) | leitura |
| `etapas_concurso` | cronograma oficial | leitura |
| `perfis` | nome e preferências (criado no cadastro) | só o dono |
| `progresso_topico` | status de cada tópico | só o dono |
| `etapas_usuario` | etapas marcadas como feitas | só o dono |

## Banco (Fase B)

| Tabela / função | Conteúdo |
|---|---|
| `questoes` | questões do seu banco (autorais, importadas, manuais e, na Fase D, geradas por IA), com `hash` de conteúdo para não duplicar |
| `textos_apoio` | textos compartilhados por várias questões |
| `respostas` | toda resposta dada; a correção (`correta`) é feita por gatilho no banco |
| `caderno_erros` | criado/atualizado por gatilho: errou → entra; 2 acertos seguidos → resolvido |
| `simulados`, `simulado_questoes` | simulado e alternativas marcadas; só é possível alterar enquanto está em andamento |
| `iniciar_simulado()` | cria o simulado e as questões numa única operação |
| `finalizar_simulado()` | grava as respostas, corrige por bloco e aplica a regra do edital (60% e nenhum bloco zerado) |

Todas as tabelas da Fase B são pessoais (RLS). As questões nunca entram por migração: o pacote autoral fica no app
(`src/features/questoes/pacotes/`) e é instalado na conta no primeiro acesso a **Praticar**; as alternativas são
embaralhadas com semente fixa para distribuir as letras do gabarito.

As respostas do treino e do simulado são gravadas numa fila que funciona offline e respeita a ordem
(primeiro a resposta, depois o motivo do erro).

## Testes

- Lógica: cálculo de progresso, datas no fuso de Brasília, situação das etapas, integridade dos dados do edital.
- Telas (com servidor simulado): login, painel, edital (marcar status, filtro, busca), concurso (marcar etapa),
  instalação do pacote, treino com motivo do erro, simulado completo do início ao resultado, caderno de erros e importação de prova.
- Leitura de provas: numeração, alternativas em vários formatos, quebras de linha e hifenização, cabeçalhos repetidos,
  textos de apoio com intervalo de questões, gabaritos em vários formatos e sugestão de disciplina/tópico.
- As migrações foram validadas num Postgres 16 local: idempotência e isolamento entre contas pela RLS.
