-- =====================================================================
-- Ateliê: tabelas do financeiro (recebimentos e pagamentos)
--
-- A API roda este script sozinha na inicialização se a tabela Recebimentos
-- ainda não existir (Infrastructure/Data/AtualizacaoBanco.cs). Está aqui para
-- documentação ou para rodar à mão no DB Browser for SQLite.
--
-- Recebimentos: entradas do caixa, ligadas ao pedido (um pedido pode ser pago em partes).
-- Pagamentos: saídas do caixa (materiais, aluguel, contas...), sem ligação com pedido.
-- =====================================================================

BEGIN TRANSACTION;

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

CREATE INDEX "IX_Recebimentos_Data" ON "Recebimentos" ("Data");
CREATE INDEX "IX_Recebimentos_PedidoId" ON "Recebimentos" ("PedidoId");
CREATE INDEX "IX_Pagamentos_Data" ON "Pagamentos" ("Data");

COMMIT;
