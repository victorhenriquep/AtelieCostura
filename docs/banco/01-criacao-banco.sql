-- =====================================================================
-- Ateliê: criação do banco (SQLite)
--
-- Você NÃO precisa rodar este script: a API cria o atelie.db sozinha na primeira
-- execução (EnsureCreated no DbSeeder.cs), com exatamente estas tabelas.
-- Ele serve para documentação, para o trabalho escrito e para conferir o modelo
-- em ferramentas como o DB Browser for SQLite.
--
-- Tipos no SQLite: INTEGER (números e bool 0/1), TEXT (textos, datas ISO 8601
-- e decimais, que o EF Core grava como texto para não perder precisão).
--
-- Estrutura do pedido:
--   Pedidos 1 ──< PedidoPecas 1 ──< PedidoPecaServicos >── 1 Servicos
--   Pedidos 1 ──< Recebimentos (entradas)      Pagamentos (saídas, independentes)
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Usuários do sistema. Perfil: Administrador | Visualizador.
CREATE TABLE "Funcionarios" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Funcionarios" PRIMARY KEY AUTOINCREMENT,
    "Nome" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "SenhaHash" TEXT NOT NULL,
    "Perfil" TEXT NOT NULL,
    "Ativo" INTEGER NOT NULL,
    "CriadoEm" TEXT NOT NULL
);

-- Telefone e CPF guardados só com os dígitos.
CREATE TABLE "Clientes" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Clientes" PRIMARY KEY AUTOINCREMENT,
    "Nome" TEXT NOT NULL,
    "Telefone" TEXT NOT NULL,
    "Email" TEXT NOT NULL,
    "Cpf" TEXT NOT NULL,
    "Endereco" TEXT NOT NULL,
    "Observacoes" TEXT NOT NULL,
    "Ativo" INTEGER NOT NULL,
    "CriadoEm" TEXT NOT NULL
);

-- Catálogo. Complexidade = quanto da capacidade diária (100) UMA peça com este serviço consome.
CREATE TABLE "Servicos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Servicos" PRIMARY KEY AUTOINCREMENT,
    "Nome" TEXT NOT NULL,
    "Descricao" TEXT NOT NULL,
    "Preco" TEXT NOT NULL,
    "Complexidade" INTEGER NOT NULL,
    "Ativo" INTEGER NOT NULL,
    "CriadoEm" TEXT NOT NULL
);

-- Status: Pendente | EmProducao | Pronto | Entregue | Cancelado.
-- ComplexidadeTotal e ValorTotal são a soma das peças (gravados para a agenda somar a ocupação do dia no banco).
CREATE TABLE "Pedidos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pedidos" PRIMARY KEY AUTOINCREMENT,
    "ClienteId" INTEGER NOT NULL,
    "Status" TEXT NOT NULL,
    "DataEntrega" TEXT NOT NULL,
    "ComplexidadeTotal" INTEGER NOT NULL,
    "ValorTotal" TEXT NOT NULL,
    "Observacoes" TEXT NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    CONSTRAINT "FK_Pedidos_Clientes_ClienteId" FOREIGN KEY ("ClienteId") REFERENCES "Clientes" ("Id") ON DELETE RESTRICT
);

-- Peças do pedido (ex.: "Calça jeans azul"). Quantidade > 1 = peças iguais com os mesmos serviços.
-- Apagar o pedido apaga as peças (ON DELETE CASCADE).
CREATE TABLE "PedidoPecas" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_PedidoPecas" PRIMARY KEY AUTOINCREMENT,
    "PedidoId" INTEGER NOT NULL,
    "Descricao" TEXT NOT NULL,
    "Quantidade" INTEGER NOT NULL,
    CONSTRAINT "FK_PedidoPecas_Pedidos_PedidoId" FOREIGN KEY ("PedidoId") REFERENCES "Pedidos" ("Id") ON DELETE CASCADE
);

-- Serviços de cada peça. Nome, complexidade e preço são COPIADOS do serviço no momento do pedido,
-- assim mudar o catálogo depois não altera pedidos já feitos.
-- Apagar a peça apaga os serviços dela; um serviço do catálogo usado em pedidos não pode ser apagado (RESTRICT).
CREATE TABLE "PedidoPecaServicos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_PedidoPecaServicos" PRIMARY KEY AUTOINCREMENT,
    "PedidoPecaId" INTEGER NOT NULL,
    "ServicoId" INTEGER NOT NULL,
    "ServicoNome" TEXT NOT NULL,
    "ComplexidadeUnitaria" INTEGER NOT NULL,
    "PrecoUnitario" TEXT NOT NULL,
    "Observacao" TEXT NOT NULL,
    CONSTRAINT "FK_PedidoPecaServicos_PedidoPecas_PedidoPecaId" FOREIGN KEY ("PedidoPecaId") REFERENCES "PedidoPecas" ("Id") ON DELETE CASCADE,
    CONSTRAINT "FK_PedidoPecaServicos_Servicos_ServicoId" FOREIGN KEY ("ServicoId") REFERENCES "Servicos" ("Id") ON DELETE RESTRICT
);

-- Recebimentos dos pedidos (entradas do caixa). Um pedido pode ter vários (sinal + restante);
-- a soma nunca passa do ValorTotal do pedido. Pedido com recebimento não pode ser apagado (RESTRICT).
-- FormaPagamento: Dinheiro | Pix | CartaoDebito | CartaoCredito.
CREATE TABLE "Recebimentos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Recebimentos" PRIMARY KEY AUTOINCREMENT,
    "PedidoId" INTEGER NOT NULL,
    "Data" TEXT NOT NULL,
    "Valor" TEXT NOT NULL,
    "FormaPagamento" TEXT NOT NULL,
    "Observacao" TEXT NOT NULL,
    "CriadoEm" TEXT NOT NULL,
    CONSTRAINT "FK_Recebimentos_Pedidos_PedidoId" FOREIGN KEY ("PedidoId") REFERENCES "Pedidos" ("Id") ON DELETE RESTRICT
);

-- Pagamentos (saídas do caixa).
-- Categoria: Materiais | Aluguel | Contas | Salarios | Impostos | Manutencao | Outros.
CREATE TABLE "Pagamentos" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Pagamentos" PRIMARY KEY AUTOINCREMENT,
    "Descricao" TEXT NOT NULL,
    "Categoria" TEXT NOT NULL,
    "Data" TEXT NOT NULL,
    "Valor" TEXT NOT NULL,
    "FormaPagamento" TEXT NOT NULL,
    "Observacao" TEXT NOT NULL,
    "CriadoEm" TEXT NOT NULL
);

-- Histórico: uma linha por campo alterado. EntidadeId aponta para o registro da tabela indicada em Entidade.
CREATE TABLE "Logs" (
    "Id" INTEGER NOT NULL CONSTRAINT "PK_Logs" PRIMARY KEY AUTOINCREMENT,
    "Entidade" TEXT NOT NULL,
    "EntidadeId" INTEGER NOT NULL,
    "Acao" TEXT NOT NULL,
    "Campo" TEXT NULL,
    "ValorAnterior" TEXT NULL,
    "ValorNovo" TEXT NULL,
    "UsuarioNome" TEXT NOT NULL,
    "DataHora" TEXT NOT NULL
);

-- Índices
CREATE INDEX "IX_Clientes_Nome" ON "Clientes" ("Nome");
CREATE INDEX "IX_Logs_Entidade_EntidadeId" ON "Logs" ("Entidade", "EntidadeId");
CREATE INDEX "IX_PedidoPecaServicos_ServicoId" ON "PedidoPecaServicos" ("ServicoId");
CREATE INDEX "IX_PedidoPecas_PedidoId" ON "PedidoPecas" ("PedidoId");
CREATE INDEX "IX_Pedidos_ClienteId" ON "Pedidos" ("ClienteId");
CREATE INDEX "IX_Pedidos_DataEntrega" ON "Pedidos" ("DataEntrega");
CREATE INDEX "IX_Recebimentos_Data" ON "Recebimentos" ("Data");
CREATE INDEX "IX_Recebimentos_PedidoId" ON "Recebimentos" ("PedidoId");
CREATE INDEX "IX_Pagamentos_Data" ON "Pagamentos" ("Data");
CREATE UNIQUE INDEX "IX_Funcionarios_Email" ON "Funcionarios" ("Email");
CREATE UNIQUE INDEX "IX_PedidoPecaServicos_PedidoPecaId_ServicoId" ON "PedidoPecaServicos" ("PedidoPecaId", "ServicoId");
-- O mesmo serviço não pode aparecer duas vezes na mesma peça: índice único (PedidoPecaId, ServicoId).
