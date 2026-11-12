# Configuração

## 1. Banco de dados (Supabase)

Projeto: `azydkohkesfcbaynzktx` (região São Paulo). As credenciais públicas (URL e chave *publishable*) já estão em `src/lib/config.ts`. Elas são públicas por definição: só permitem o que as regras de segurança (RLS) autorizam.

> **Nunca** coloque no código a chave *secret* / *service_role* nem a senha do banco.

### Atualização automática do banco (recomendado — configurar uma vez)

Com dois segredos no GitHub, cada atualização do app aplica sozinha as mudanças do banco
(`supabase/migrations`) antes de publicar. Nunca mais é preciso colar SQL.

1. **Token do Supabase:** em <https://supabase.com/dashboard/account/tokens> → **Generate new token** → nome
   `github-actions` → copie o token (começa com `sbp_`).
2. **Senha do banco:** a que você guardou ao criar o projeto. Se não tiver, gere outra em
   **Project Settings → Database → Reset database password** (o app não usa essa senha, nada quebra).
3. No GitHub: repositório → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_ACCESS_TOKEN` = o token do passo 1
   - `SUPABASE_DB_PASSWORD` = a senha do passo 2
4. Em **Actions → Publicar (banco + app) → Run workflow**. O passo “Aplicar migrações no Supabase” deve ficar verde.

> Os segredos ficam guardados (criptografados) no GitHub e nunca aparecem no código nem nos registros.
> Não cole esses valores em conversas.

Regra para quem desenvolve: **nunca edite uma migração já publicada** — crie um arquivo novo em
`supabase/migrations` (o histórico de migrações só aplica arquivos novos).

### Criar as tabelas manualmente (alternativa)

**A) Pelo SQL Editor, em partes (pelo celular)**

Cole e execute, em ordem, os arquivos de [`supabase/sql-editor-partes/`](../supabase/sql-editor-partes):

| Parte | Conteúdo | Fase |
|---|---|---|
| 1 | Estrutura (edital, progresso, perfil) | A |
| 2 | Concurso, blocos da prova e etapas | A |
| 3 | Itens do edital | A |
| 4 | Subitens do edital | A |
| 5 | Questões, simulados, respostas e caderno de erros (tabelas e gatilhos) | B |
| 6 | Funções de simulado e segurança | B |

Todas as partes podem ser executadas de novo sem perder dados.

**A2) Pelo SQL Editor, tudo de uma vez (computador)**
1. Abra o projeto no Supabase → **SQL Editor** → **New query**.
2. Copie todo o conteúdo de [`supabase/sql-editor-completo.sql`](../supabase/sql-editor-completo.sql), cole e clique em **Run**.
3. Deve aparecer *Success. No rows returned*. O script pode ser executado de novo sem perder dados.

**B) Pela integração com o GitHub (automático nas próximas fases)**
1. No Supabase: **Project Settings → Integrations → GitHub** → conecte o repositório `projeto-aprovacao-saquarema`.
2. *Supabase directory*: `supabase` · *Production branch*: `main` · ative **Deploy to production**.
3. A cada atualização da branch `main`, as migrações novas de `supabase/migrations` são aplicadas automaticamente.

## 2. Login (Authentication)

1. **Authentication → URL Configuration**
   - *Site URL*: o endereço onde o app está publicado (ex.: `https://SEU-USUARIO.github.io/projeto-aprovacao-saquarema/`).
   - *Redirect URLs*: adicione o mesmo endereço seguido de `**` (ex.: `https://SEU-USUARIO.github.io/projeto-aprovacao-saquarema/**`) e, se for testar localmente, `http://localhost:5173/**`.
2. Crie sua conta no app (**Primeiro acesso? Criar conta**) e confirme pelo link do e-mail.
3. **Recomendado, já que o app é pessoal:** depois de criar sua conta, desative novos cadastros em **Authentication → Sign In / Providers → User Signups → Allow new users to sign up** (desligado).

## 3. Publicação

O app é estático (pasta `dist/`) e usa rotas com `#`, então funciona em qualquer hospedagem.

- **GitHub Pages:** *Settings → Pages → Source: GitHub Actions*. O workflow `deploy-pages.yml` publica a cada atualização da `main`. Em repositório **privado**, o Pages exige plano pago do GitHub.
- **Vercel (grátis, funciona com repositório privado):** importe o repositório em vercel.com/new. O `vercel.json` já traz as configurações.

Depois de publicar, atualize a *Site URL* e as *Redirect URLs* (passo 2).

## 4. Instalar no Android

Abra o endereço no Chrome → menu **⋮** → **Instalar app** (ou **Adicionar à tela inicial**). Também há um botão em **Ajustes**.
