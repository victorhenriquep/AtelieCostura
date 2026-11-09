# Ateliê: sistema de pedidos

Projeto acadêmico: React + TypeScript (front) e C# .NET + SQLite (back), rodando localmente.

```
atelie/
├── frontend/   # React + Vite. Veja frontend/README.md
├── backend/    # API .NET. Veja backend/README.md
└── docs/       # modelo ER e documentação do banco (docs/banco/README.md)
```

Um pedido é dividido em **peças**, e cada peça pode receber **vários serviços**
(ex.: uma calça com barra e troca de zíper).

O financeiro tem três telas, só para o Administrador: **Recebimentos** (o que os clientes pagaram, inclusive em partes),
**Pagamentos** (saídas do caixa) e **Fluxo de caixa** (entradas, saídas e saldo do mês).

## Rodando tudo (dois terminais no VS Code)

**Terminal 1: API**
```bash
cd backend/Atelie.Api
dotnet run            # http://localhost:5000
```

**Terminal 2: front**
```bash
cd frontend
npm install           # só na primeira vez
npm run dev           # http://localhost:5173
```

Para o front usar a API real, deixe `VITE_USE_MOCK=false` em `frontend/.env.development`.

Login: `admin@atelie.com` / `admin123` (Administrador) ou `visualizador@atelie.com` / `visualizador123` (Visualizador, somente consulta).
