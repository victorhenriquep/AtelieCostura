# Ateliê — Frontend

React + TypeScript + Vite. Login com JWT, menu por perfil, dashboard, cadastros de clientes, serviços e funcionários, pedidos com data de entrega calculada e histórico de alterações.

## Como rodar (VS Code)

Pré-requisito: Node.js 20 ou mais recente.

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173.

### Usuários de teste (API simulada)

| Perfil        | E-mail              | Senha       |
|---------------|---------------------|-------------|
| Administrador | admin@atelie.com    | admin123    |
| Visualizador  | visualizador@atelie.com | visualizador123 |

## API simulada x backend real

O arquivo `.env.development` controla de onde vêm os dados:

```
VITE_USE_MOCK=true                        # dados simulados no navegador (localStorage)
VITE_API_URL=http://localhost:5000/api    # usado quando VITE_USE_MOCK=false
```

Está configurado com `VITE_USE_MOCK=false` (usa o backend). Para testar só o front, sem o backend, troque para `true` e reinicie o `npm run dev`.
Nenhuma tela precisa mudar: todas usam o contrato em `src/api/contrato.ts`.

Para apagar os dados simulados: DevTools → Application → Local Storage → apague `atelie.mock.banco.v6`.

## Estrutura

```
src/
├── api/
│   ├── contrato.ts        # interface da API (o que as telas usam)
│   ├── apiReal.ts         # implementação que chama o backend C#
│   ├── mock/apiMock.ts    # implementação simulada (localStorage)
│   ├── http.ts            # fetch + token JWT + tratamento de erros
│   └── index.ts           # escolhe mock ou real pelo .env
├── auth/
│   ├── AuthContext.tsx    # usuário logado, entrar(), sair(), pode()
│   ├── permissoes.ts      # QUEM acessa O QUÊ (Administrador / Visualizador)
│   ├── guards.tsx         # RequerLogin e RequerPermissao
│   └── sessao.ts          # guarda o token no sessionStorage
├── components/            # Modal, Confirmacao, Avisos, HistoricoModal, Icones
├── layout/AppLayout.tsx   # menu lateral + área de conteúdo
├── pages/
│   ├── LoginPage.tsx
│   ├── InicioPage.tsx     # dashboard: KPIs (P1–P5), ocupação dos próximos dias, próximas entregas
│   ├── clientes/          # lista + formulário (modelo seguido pelas outras telas)
│   ├── servicos/
│   ├── funcionarios/
│   ├── pedidos/           # lista com ações de status + formulário (peças com vários serviços) e cálculo da entrega
│   └── financeiro/        # recebimentos, pagamentos e fluxo de caixa
├── components/OcupacaoGrafico.tsx  # gráfico de barras da capacidade diária
├── components/Graficos.tsx         # barras, linha e pizza dos indicadores (SVG, sem biblioteca)
├── utils/formatos.ts      # máscaras de telefone/CPF, moeda, rótulos do log
├── utils/datas.ts         # dias úteis e datas no formato "2026-10-14"
├── utils/pedidos.ts       # nomes dos status e próxima etapa do pedido
├── types.ts               # tipos (espelham os DTOs do backend)
└── styles.css             # todas as cores ficam em :root no topo
```

## Endpoints do backend

A lista completa de rotas e regras está em `../backend/README.md`. O front usa todas elas através de
`src/api/apiReal.ts`. Erros voltam como `{ "mensagem": "..." }` e a tela mostra o texto.

## Telas e perfis

| Tela / ação | Administrador | Visualizador |
|---|:---:|:---:|
| Início (dashboard) | ✅ | ✅ (sem os indicadores financeiros) |
| Pedidos: consultar e ver detalhes | ✅ | ✅ |
| Pedidos: criar, editar, mudar status, cancelar | ✅ | ❌ |
| Clientes: consultar e ver dados | ✅ | ✅ |
| Clientes: cadastrar, editar, inativar | ✅ | ❌ |
| Serviços e Funcionários | ✅ | ❌ |
| Histórico (ícone de relógio) | ✅ | ❌ |
| Recebimentos, Pagamentos e Fluxo de caixa | ✅ | ❌ |

As regras ficam em `src/auth/permissoes.ts`. Recursos terminados em `.editar` (ex.: `pedidos.editar`)
controlam os botões de alteração dentro de uma tela que o perfil consegue ver.

## Como adicionar uma nova tela (ex.: Serviços)

1. Tipos em `types.ts` e métodos em `api/contrato.ts`, `apiReal.ts` e `apiMock.ts`.
2. Copie uma pasta de `pages/` (ex.: `servicos/`) e ajuste os campos.
3. Adicione a rota em `App.tsx` dentro de `<RequerPermissao recurso="servicos">`.
4. Em `layout/AppLayout.tsx`, adicione o item do menu.
5. O histórico já funciona: `<HistoricoModal entidade="Servico" ... />`.
