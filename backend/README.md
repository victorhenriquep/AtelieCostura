# Ateliê: Backend (C# / .NET 10)

API REST com Minimal APIs, Entity Framework Core e SQLite, organizada em vertical slices com CQRS simplificado.

## Pré-requisitos

- [.NET 10 SDK](https://dotnet.microsoft.com/download/dotnet/10.0). Confira com `dotnet --version`.
- VS Code com as extensões **C# Dev Kit** e **REST Client** (o VS Code sugere as duas ao abrir a pasta).

## Como rodar

```bash
cd backend/Atelie.Api
dotnet run
```

A API sobe em **http://localhost:5000**. Na primeira execução ela cria o arquivo `atelie.db` com:

| Perfil        | E-mail              | Senha       |
|---------------|---------------------|-------------|
| Administrador | admin@atelie.com    | admin123    |
| Visualizador  | visualizador@atelie.com | visualizador123 |

Ela também cadastra 6 serviços de exemplo.

Para testar as rotas sem o front, abra `Atelie.Api/Atelie.http` e clique em **Send Request**.

### Testes automatizados

```bash
cd backend
dotnet test
```

Os testes cobrem a regra da data de entrega (`Atelie.Tests/CalculadoraDataEntregaTests.cs`),
os cálculos de peças e serviços do pedido (`PedidoRegrasTests.cs`), o fluxo de caixa (`FluxoCaixaTests.cs`), os indicadores do Início (`IndicadoresTests.cs`) e a validação de CPF.

### Ligar o front ao backend

No `frontend/.env.development`, troque para `VITE_USE_MOCK=false` e reinicie o `npm run dev`.

## Estrutura

```
Atelie.Api/
├── Program.cs                  # configuração: banco, JWT, permissões, CORS, rotas
├── appsettings.json            # conexão, chave do JWT, capacidade diária, CORS
├── Atelie.http                 # requisições de exemplo (REST Client)
│
├── Domain/                     # regras de negócio puras (não conhecem HTTP nem banco)
│   ├── Entidades.cs            # Funcionario, Cliente, Servico, Pedido, PedidoPeca, PedidoPecaServico
│   ├── Enums.cs                # Perfil, StatusPedido, AcaoLog
│   ├── Auditoria.cs            # IAuditavel, LogAlteracao, [DadoSensivel], [NaoAuditar]
│   └── CalculadoraDataEntrega.cs   # ★ regra da data de entrega
│
├── Infrastructure/             # detalhes técnicos
│   ├── Data/AppDbContext.cs    # ★ EF Core + log automático de alterações
│   ├── Data/DbSeeder.cs        # cria o banco e os dados iniciais
│   ├── Data/AtualizacaoBanco.cs # converte bancos da versão antiga (PedidoItens) para peças
│   └── Auth/                   # geração do token e leitura do usuário logado
│
├── Common/                     # coisas usadas por todas as features
│   ├── IHandler.cs             # marcador + registro automático dos handlers
│   ├── Politicas.cs            # nomes das permissões
│   ├── Excecoes.cs             # RegraNegocioException (400), NaoEncontradoException (404)
│   ├── TratamentoErrosMiddleware.cs
│   └── Texto.cs                # limpeza de texto, e-mail, CPF
│
└── Features/                   # ★ VERTICAL SLICES: uma pasta por módulo
    ├── Auth/Login.cs
    ├── Clientes/               # ★ slice de referência, um arquivo por operação (veja LEIA-ME.md)
    ├── Servicos/
    ├── Funcionarios/
    ├── Pedidos/
    ├── Financeiro/             # recebimentos, pagamentos e fluxo de caixa
    ├── Indicadores/            # KPIs do dashboard (Início)
    └── Logs/ListarLogs.cs
```

### Como as camadas se encaixam (Clean Architecture simplificada)

- **Domain** não depende de nada: entidades e regras puras. Por isso a calculadora tem testes sem banco.
- **Infrastructure** implementa o acesso ao banco e a autenticação.
- **Features** usam as duas. Cada operação é um arquivo com endpoint e handler.

Tudo fica em um único projeto: as camadas são pastas, não projetos separados. É uma escolha deliberada para manter o monolito simples.

### CQRS simplificado

- **Comandos** (Criar, Atualizar, AlterarStatus) carregam a entidade com rastreamento, alteram e salvam.
- **Consultas** (Listar, Obter) usam `AsNoTracking()` e projetam direto para DTO.
- Sem MediatR: o endpoint recebe o `Handler` por injeção de dependência e chama `Handle(...)`.

## Regras implementadas

### Permissões

| Recurso | Administrador | Visualizador |
|---|:---:|:---:|
| Consultar pedidos e clientes | ✅ | ✅ |
| Criar, editar, mudar status e cancelar pedidos | ✅ | ❌ |
| Cadastrar, editar e inativar clientes | ✅ | ❌ |
| Serviços e funcionários (tudo) | ✅ | ❌ |
| Logs (histórico) | ✅ | ❌ |
| Financeiro: recebimentos, pagamentos e fluxo de caixa | ✅ | ❌ |
| Indicadores de produção e prazos (P1, P2, P4) | ✅ | ✅ |
| Indicadores financeiros (P3, P5) | ✅ | ❌ |

O perfil vai dentro do token (claim `role`). As rotas usam `.RequireAuthorization(Politicas.X)`:
`TodosOsPerfis` nas consultas e `SomenteAdministrador` em tudo que altera dados.

### Log de alterações

- Toda entidade que implementa `IAuditavel` tem as alterações gravadas **automaticamente** no `SaveChangesAsync` do `AppDbContext`: quem alterou, quando, o campo, o valor anterior e o valor novo.
- A senha aparece no log como `******` (atributo `[DadoSensivel]`).
- Em pedidos, a troca de cliente e de peças é registrada com textos legíveis, por exemplo
  `2x Calça jeans: Barra simples (subir 3 cm) + Troca de zíper`.
- Consulta: `GET /api/logs?entidade=Cliente&entidadeId=1`, somente para o Administrador.

### Peças e serviços do pedido

O pedido é dividido em **peças**, e cada peça recebe **um ou mais serviços** (`Pedido → PedidoPeca → PedidoPecaServico`).

```json
"pecas": [
  { "descricao": "Calça jeans", "quantidade": 2,
    "servicos": [ { "servicoId": 1, "observacao": "subir 3 cm" }, { "servicoId": 2 } ] }
]
```

- Cada peça precisa de descrição, quantidade (1 a 100) e de 1 a 10 serviços. São aceitas até 50 peças por pedido.
- O mesmo serviço não pode aparecer duas vezes na mesma peça.
- Nome, preço e complexidade do serviço são copiados para o pedido. Mudar o catálogo depois não altera pedidos já feitos.
- Complexidade da peça = (soma dos serviços) × quantidade. A complexidade do pedido é a soma das peças.
- Ao editar, as peças são substituídas por inteiro: as antigas (com seus serviços) são apagadas e as novas inseridas.

As regras ficam em `Features/Pedidos/PedidoRegras.cs`. A documentação do banco está em `docs/banco/README.md`.

### Data de entrega

1. O prazo mínimo é **hoje + 3 dias úteis** (segunda a sexta).
2. Cada dia aguenta **100 de complexidade**. A complexidade do pedido é a soma das peças, e cada peça soma os seus serviços × a quantidade.
3. O pedido é entregue inteiro em um dia. Se não couber na data, vai para o **próximo dia útil com espaço**.
4. Um pedido acima de 100 é recusado com a mensagem para dividi-lo.
5. Somente pedidos **Pendente, Em produção e Pronto** ocupam o dia. **Entregue** e **Cancelado** liberam a capacidade.
6. Ao **editar** um pedido pendente, a data prometida é mantida se ele ainda couber nela; senão, vai para o próximo dia com espaço.

A capacidade (100) e o prazo (3 dias) ficam no `appsettings.json`, na seção `Producao`.

### Status do pedido

`Pendente → EmProducao → Pronto → Entregue`, e `Cancelado` a partir de qualquer etapa antes de Entregue.
O pedido só pode ser editado enquanto está **Pendente**. As transições permitidas ficam no dicionário em `AlterarStatusPedido.cs`.

### Financeiro

- **Recebimento** = dinheiro que entrou de um pedido. Pode ser em partes (sinal + restante): valor maior que zero e até o saldo; data de hoje ou passada; pedido cancelado não recebe.
- A situação do pagamento (`AReceber`, `Parcial`, `Pago`) é calculada pela soma dos recebimentos, não é gravada.
- Pedido com recebimento não pode ser cancelado nem ficar com total menor que o recebido: é preciso **estornar** antes (`DELETE /api/recebimentos/{id}`). Recebimentos e estornos aparecem no histórico do pedido.
- **Pagamento** = dinheiro que saiu do caixa, com categoria (Materiais, Aluguel, Contas, Salarios, Impostos, Manutencao, Outros).
- **Fluxo de caixa** (só o realizado): saldo inicial = entradas − saídas antes do período; depois, entradas, saídas, saldo do dia e saldo acumulado por dia com movimento. A conta fica em `CalculadoraFluxoCaixa` (`Features/Financeiro/FluxoCaixa.cs`), com testes em `Atelie.Tests/FluxoCaixaTests.cs`.
- Sem `de`/`ate`, as consultas usam o mês atual. O SQLite não soma `decimal` no banco, então as somas de dinheiro são feitas em memória.

### Indicadores (dashboard do Início)

Calculados só com o que já existe no banco: pedidos não cancelados com entrega prevista no período (padrão: mês atual e os dois anteriores) e o histórico de status (`Logs`).

- **P1 Tempo médio por serviço:** horas entre "Em produção" e "Pronto", divididas entre os serviços pela complexidade e depois pelas peças (tempo corrido).
- **P2 Ocupação semanal:** complexidade reservada ÷ (dias úteis × capacidade diária).
- **P3 Ticket médio por serviço** e **receita por hora** (valor do serviço ÷ horas do P1).
- **P4 Cumprimento de prazos:** no prazo = ficou Pronto até a data prometida.
- **P5 Faturamento por cliente** (10 maiores) e inadimplência (entregues com saldo a receber).

Os campos financeiros voltam `null` para o Visualizador. As regras ficam em `CalculadoraIndicadores` (`Features/Indicadores/`), com testes em `Atelie.Tests/IndicadoresTests.cs`.

## Rotas

| Método | Rota | Perfil |
|---|---|---|
| POST  | `/api/auth/login` | público |
| GET   | `/api/clientes?busca=&incluirInativos=` | Todos |
| GET   | `/api/clientes/{id}` | Todos |
| GET   | `/api/clientes/opcoes?busca=` | Admin |
| POST  | `/api/clientes` | Admin |
| PUT   | `/api/clientes/{id}` | Admin |
| PATCH | `/api/clientes/{id}/status` `{ ativo }` | Admin |
| GET/POST/PUT/PATCH | `/api/servicos` (inclui `/opcoes`) | Admin |
| GET/POST/PUT/PATCH | `/api/funcionarios` | Admin |
| GET   | `/api/pedidos?status=&busca=&entregaDe=&entregaAte=&incluirFinalizados=` | Todos |
| GET   | `/api/pedidos/{id}` | Todos |
| GET   | `/api/pedidos/ocupacao?de=&ate=` | Todos |
| POST  | `/api/pedidos` | Admin |
| PUT   | `/api/pedidos/{id}` (só Pendente) | Admin |
| PATCH | `/api/pedidos/{id}/status` `{ status }` | Admin |
| POST  | `/api/pedidos/simular-entrega` | Admin |
| GET   | `/api/recebimentos?de=&ate=&forma=` | Admin |
| GET   | `/api/recebimentos/pedidos-a-receber` | Admin |
| POST  | `/api/recebimentos` | Admin |
| DELETE | `/api/recebimentos/{id}` (estorno) | Admin |
| GET   | `/api/pagamentos?de=&ate=&categoria=` | Admin |
| POST/PUT/DELETE | `/api/pagamentos` e `/api/pagamentos/{id}` | Admin |
| GET   | `/api/fluxo-caixa?de=&ate=` | Admin |
| GET   | `/api/indicadores?de=&ate=` (financeiro só Admin) | Todos |
| GET   | `/api/logs?entidade=&entidadeId=` | Admin |

Todos os erros voltam no formato `{ "mensagem": "texto para o usuário" }` (400, 404 ou 500).

## Alterando o banco

O banco é criado com `EnsureCreated`, sem migrations, para simplificar.
**Se você mudar alguma entidade**, apague o `atelie.db` e rode de novo. Os dados iniciais são recriados.

**Peças e serviços:** quem já tinha um `atelie.db` da versão anterior (tabela `PedidoItens`) não precisa apagar nada.
Na primeira execução, a API converte cada item antigo em uma peça com um único serviço, mantendo totais e datas
(`Infrastructure/Data/AtualizacaoBanco.cs`, mesmo SQL de `docs/banco/02-conversao-pedido-itens.sql`).
Do mesmo jeito, se o banco ainda não tem as tabelas do financeiro, a API cria `Recebimentos` e `Pagamentos`
(`docs/banco/03-financeiro.sql`). Seus clientes, serviços e pedidos continuam lá.

Quando o modelo estabilizar e você quiser preservar os dados entre mudanças, troque para migrations:

```bash
dotnet tool install --global dotnet-ef
dotnet add package Microsoft.EntityFrameworkCore.Design
dotnet ef migrations add Inicial
```

Depois disso, no `DbSeeder.cs`, troque `EnsureCreatedAsync()` por `MigrateAsync()`.

## Usando .NET 8 em vez do 10

Nos dois `.csproj`, troque `net10.0` por `net8.0` e as versões `10.0.*` por `8.0.*`. O código é compatível com as duas versões.
