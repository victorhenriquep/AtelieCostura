# Deploy na Vercel (plano Hobby, grátis)

Front e API sobem juntos, num único projeto da Vercel (Vercel Services),
configurado pelo `vercel.json` da raiz:

- `/api/...` vai para o backend (container .NET, `backend/Dockerfile.vercel`)
- todo o resto vai para o front (Vite, `frontend/`)

Como ficam no mesmo domínio, não precisa configurar CORS nem a URL da API:
o front chama `/api` (veja `frontend/src/api/http.ts`).

## 1. Banco (Neon)
Copie a connection string do projeto no Neon (botão **Connect**).
A API cria as tabelas e os usuários iniciais sozinha no primeiro acesso.

## 2. Projeto na Vercel
1. Add New → Project → importe o repositório (ou rode `vercel` na raiz do projeto).
2. **Root Directory:** a raiz do repositório (não escolha `frontend` nem `backend`).
3. **Framework Preset:** `Services`.
4. Variáveis de ambiente:
   | Nome | Valor |
   | --- | --- |
   | `DATABASE_URL` | connection string do Neon |
   | `Jwt__Chave` | uma frase secreta com 32+ caracteres |
5. Deploy.

## Testando
- `https://SEU-PROJETO.vercel.app/` abre o sistema.
- Login: `admin@atelie.com` / `admin123`.

## Rodando localmente
Nada muda: sem `DATABASE_URL`, a API usa o SQLite (`atelie.db`) e o front
usa o `.env.development` (`http://localhost:5000/api`).
