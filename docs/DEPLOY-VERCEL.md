# Deploy na Vercel (plano Hobby, grátis)

São dois projetos na Vercel apontando para o mesmo repositório, mais um banco Postgres grátis.

## 1. Banco (Neon)
1. Crie uma conta em neon.tech e um projeto (região São Paulo, se houver).
2. Copie a connection string (`postgresql://usuario:senha@host/banco?sslmode=require`).

A API cria as tabelas e os usuários iniciais sozinha no primeiro acesso (EnsureCreated + DbSeeder).

## 2. Backend
1. Vercel → Add New → Project → importe o repositório.
2. **Root Directory:** `backend`. A Vercel detecta o `Dockerfile.vercel` e usa o preset Container.
3. Variáveis de ambiente:
   | Nome | Valor |
   | --- | --- |
   | `DATABASE_URL` | connection string do Neon |
   | `Jwt__Chave` | uma frase secreta com 32+ caracteres |
   | `CORS_ORIGENS` | URL do front, ex.: `https://atelie-front.vercel.app` |
4. Deploy. Teste abrindo a URL do backend: deve aparecer "API do Ateliê rodando".

## 3. Frontend
1. No projeto do front (Root Directory `frontend`), em Settings → Environment Variables:
   | Nome | Valor |
   | --- | --- |
   | `VITE_API_URL` | URL do backend + `/api`, ex.: `https://atelie-api.vercel.app/api` |
   | `VITE_USE_MOCK` | `false` |
2. Faça um **Redeploy** (variáveis `VITE_` entram no build, não valem sem redeploy).

## Rodando localmente
Nada muda: sem `DATABASE_URL`, a API continua usando o SQLite (`atelie.db`).
