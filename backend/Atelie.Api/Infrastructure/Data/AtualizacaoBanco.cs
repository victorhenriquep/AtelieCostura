namespace Atelie.Api.Infrastructure.Data;

/// <summary>
/// Atualiza um atelie.db criado por uma versão anterior do sistema, sem perder dados.
/// O projeto usa EnsureCreated (sem migrations), que não altera um banco que já existe,
/// por isso cada mudança de estrutura tem um passo em SQL aqui. Cada passo roda uma única vez.
///
/// 1. Peças: a tabela antiga PedidoItens (um serviço por linha) vira PedidoPecas + PedidoPecaServicos.
///    Cada item antigo vira uma peça com um único serviço, então totais e datas não mudam.
///    Mesmo SQL de docs/banco/02-conversao-pedido-itens.sql.
/// 2. Financeiro: cria as tabelas Recebimentos e Pagamentos.
///    Mesmo SQL de docs/banco/03-financeiro.sql.
/// </summary>
public static class AtualizacaoBanco
{
    public static async Task AplicarAsync(AppDbContext db, ILogger logger)
    {
        if (await TabelaExiste(db, "PedidoItens"))
        {
            logger.LogInformation("Convertendo os itens de pedido para a estrutura de peças...");
            await Executar(db, ScriptConversao);
        }

        if (!await TabelaExiste(db, "Recebimentos"))
        {
            logger.LogInformation("Criando as tabelas do financeiro...");
            await Executar(db, ScriptFinanceiro);
        }
    }

    private static async Task Executar(AppDbContext db, string sql)
    {
        await using var transacao = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync(sql);
        await transacao.CommitAsync();
    }

    private static async Task<bool> TabelaExiste(AppDbContext db, string nome)
    {
        var conexao = db.Database.GetDbConnection();
        await db.Database.OpenConnectionAsync();
        try
        {
            await using var comando = conexao.CreateCommand();
            comando.CommandText = "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = $nome";
            var parametro = comando.CreateParameter();
            parametro.ParameterName = "$nome";
            parametro.Value = nome;
            comando.Parameters.Add(parametro);

            return Convert.ToInt64(await comando.ExecuteScalarAsync()) > 0;
        }
        finally
        {
            await db.Database.CloseConnectionAsync();
        }
    }

    private const string ScriptConversao = """
        CREATE TABLE "PedidoPecas" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_PedidoPecas" PRIMARY KEY AUTOINCREMENT,
            "PedidoId" INTEGER NOT NULL,
            "Descricao" TEXT NOT NULL,
            "Quantidade" INTEGER NOT NULL,
            CONSTRAINT "FK_PedidoPecas_Pedidos_PedidoId" FOREIGN KEY ("PedidoId") REFERENCES "Pedidos" ("Id") ON DELETE CASCADE
        );

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

        CREATE INDEX "IX_PedidoPecas_PedidoId" ON "PedidoPecas" ("PedidoId");
        CREATE UNIQUE INDEX "IX_PedidoPecaServicos_PedidoPecaId_ServicoId" ON "PedidoPecaServicos" ("PedidoPecaId", "ServicoId");
        CREATE INDEX "IX_PedidoPecaServicos_ServicoId" ON "PedidoPecaServicos" ("ServicoId");

        -- Cada item antigo vira uma peça (reaproveitando o Id do item) ...
        INSERT INTO "PedidoPecas" ("Id", "PedidoId", "Descricao", "Quantidade")
        SELECT "Id", "PedidoId",
               CASE WHEN TRIM("Descricao") = '' THEN 'Peça' ELSE "Descricao" END,
               "Quantidade"
        FROM "PedidoItens";

        -- ... com um único serviço.
        INSERT INTO "PedidoPecaServicos" ("PedidoPecaId", "ServicoId", "ServicoNome", "ComplexidadeUnitaria", "PrecoUnitario", "Observacao")
        SELECT "Id", "ServicoId", "ServicoNome", "ComplexidadeUnitaria", "PrecoUnitario", ''
        FROM "PedidoItens";

        DROP TABLE "PedidoItens";
        """;

    private const string ScriptFinanceiro = """
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
        """;
}
