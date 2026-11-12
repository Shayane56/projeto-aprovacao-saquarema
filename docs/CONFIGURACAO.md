# Configuração

## 1. Banco de dados (Supabase)

Projeto: `azydkohkesfcbaynzktx` (região São Paulo). As credenciais públicas (URL e chave *publishable*) já estão em `src/lib/config.ts`. Elas são públicas por definição: só permitem o que as regras de segurança (RLS) autorizam.

> **Nunca** coloque no código a chave *secret* / *service_role* nem a senha do banco.

### Criar as tabelas, escolhendo uma das opções

**A) Pelo SQL Editor (mais rápido)**
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
