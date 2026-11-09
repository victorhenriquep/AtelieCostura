namespace Atelie.Api.Features.Financeiro;

/// <summary>Recebimentos dos pedidos (entradas do caixa). Somente Administrador.</summary>
public static class RecebimentosEndpoints
{
    public static void MapRecebimentos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/recebimentos").RequireAuthorization(Politicas.SomenteAdministrador);

        ListarRecebimentos.Mapear(grupo);
        ListarPedidosAReceber.Mapear(grupo);
        RegistrarRecebimento.Mapear(grupo);
        EstornarRecebimento.Mapear(grupo);
    }

    /// <summary>Soma os recebimentos de cada pedido em memória (o SQLite não soma decimal no banco).</summary>
    internal static async Task<Dictionary<int, decimal>> RecebidoPorPedido(AppDbContext db, List<int> pedidoIds, CancellationToken ct) =>
        (await db.Recebimentos.AsNoTracking()
            .Where(r => pedidoIds.Contains(r.PedidoId))
            .Select(r => new { r.PedidoId, r.Valor })
            .ToListAsync(ct))
        .GroupBy(r => r.PedidoId)
        .ToDictionary(g => g.Key, g => g.Sum(r => r.Valor));

    internal static DateOnly Hoje(TimeProvider relogio) => DateOnly.FromDateTime(relogio.GetLocalNow().DateTime);
}

/// <summary>CONSULTA — GET /api/recebimentos?de=2026-10-01&amp;ate=2026-10-31&amp;forma=Pix   (padrão: mês atual)</summary>
public static class ListarRecebimentos
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (DateOnly? de, DateOnly? ate, FormaPagamento? forma, Handler handler, CancellationToken ct) =>
            handler.Handle(de, ate, forma, ct));

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<ListaRecebimentosDto> Handle(DateOnly? de, DateOnly? ate, FormaPagamento? forma, CancellationToken ct)
        {
            var (inicio, fim) = FinanceiroRegras.Periodo(de, ate, RecebimentosEndpoints.Hoje(relogio));

            var query = db.Recebimentos.AsNoTracking().Where(r => r.Data >= inicio && r.Data <= fim);
            if (forma is not null)
                query = query.Where(r => r.FormaPagamento == forma);

            var linhas = await query
                .OrderByDescending(r => r.Data)
                .ThenByDescending(r => r.Id)
                .Select(r => new
                {
                    r.Id, r.PedidoId, ClienteNome = r.Pedido.Cliente.Nome, PedidoTotal = r.Pedido.ValorTotal,
                    r.Data, r.Valor, r.FormaPagamento, r.Observacao, r.CriadoEm,
                })
                .ToListAsync(ct);

            var recebido = await RecebimentosEndpoints.RecebidoPorPedido(db, linhas.Select(l => l.PedidoId).Distinct().ToList(), ct);

            var recebimentos = linhas
                .Select(l => new RecebimentoDto(l.Id, l.PedidoId, l.ClienteNome, l.Data, l.Valor, l.FormaPagamento, l.Observacao,
                    FinanceiroRegras.Situacao(l.PedidoTotal, recebido.GetValueOrDefault(l.PedidoId)), l.CriadoEm))
                .ToList();

            var porForma = recebimentos
                .GroupBy(r => r.FormaPagamento)
                .Select(g => new TotalPorForma(g.Key, g.Sum(r => r.Valor)))
                .OrderByDescending(t => t.Total)
                .ToList();

            return new ListaRecebimentosDto(recebimentos, recebimentos.Sum(r => r.Valor), porForma);
        }
    }
}

/// <summary>CONSULTA — GET /api/recebimentos/pedidos-a-receber   Pedidos não cancelados que ainda têm saldo.</summary>
public static class ListarPedidosAReceber
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/pedidos-a-receber", (Handler handler, CancellationToken ct) => handler.Handle(ct));

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<List<PedidoAReceberDto>> Handle(CancellationToken ct)
        {
            var pedidos = await db.Pedidos.AsNoTracking()
                .Where(p => p.Status != StatusPedido.Cancelado)
                .OrderBy(p => p.DataEntrega)
                .ThenBy(p => p.Id)
                .Select(p => new { p.Id, ClienteNome = p.Cliente.Nome, p.Status, p.DataEntrega, p.ValorTotal })
                .ToListAsync(ct);

            var recebido = await RecebimentosEndpoints.RecebidoPorPedido(db, pedidos.Select(p => p.Id).ToList(), ct);

            return pedidos
                .Select(p =>
                {
                    var pago = recebido.GetValueOrDefault(p.Id);
                    return new PedidoAReceberDto(p.Id, p.ClienteNome, p.Status, p.DataEntrega, p.ValorTotal, pago, p.ValorTotal - pago);
                })
                .Where(p => p.Saldo > 0)
                .ToList();
        }
    }
}

/// <summary>
/// COMANDO — POST /api/recebimentos
/// corpo: { "pedidoId": 12, "data": "2026-10-26", "valor": 50.00, "formaPagamento": "Pix", "observacao": "sinal" }
/// </summary>
public static class RegistrarRecebimento
{
    /// <summary>Evita que dois recebimentos ao mesmo tempo passem do saldo do pedido (API em um único processo).</summary>
    private static readonly SemaphoreSlim Trava = new(1, 1);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (RecebimentoDados dados, Handler handler, CancellationToken ct) =>
        {
            var criado = await handler.Handle(dados, ct);
            return TypedResults.Created($"/api/recebimentos/{criado.Id}", criado);
        });

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<RecebimentoDto> Handle(RecebimentoDados dados, CancellationToken ct)
        {
            if (dados.PedidoId is null)
                throw new RegraNegocioException("Selecione o pedido.");

            var data = FinanceiroRegras.ValidarData(dados.Data, RecebimentosEndpoints.Hoje(relogio));
            var valor = FinanceiroRegras.ValidarValor(dados.Valor);
            var forma = FinanceiroRegras.ValidarForma(dados.FormaPagamento);
            var observacao = FinanceiroRegras.ValidarObservacao(dados.Observacao);

            await Trava.WaitAsync(ct);
            try
            {
                var pedido = await db.Pedidos
                    .Include(p => p.Cliente)
                    .Include(p => p.Recebimentos)
                    .FirstOrDefaultAsync(p => p.Id == dados.PedidoId, ct)
                    ?? throw new NaoEncontradoException("Pedido não encontrado.");

                if (pedido.Status == StatusPedido.Cancelado)
                    throw new RegraNegocioException("Pedido cancelado não recebe pagamentos.");

                var saldo = pedido.ValorTotal - pedido.Recebimentos.Sum(r => r.Valor);
                if (saldo <= 0)
                    throw new RegraNegocioException("Este pedido já está pago.");
                if (valor > saldo)
                    throw new RegraNegocioException($"O valor passa do saldo do pedido ({FinanceiroRegras.Moeda(saldo)}).");

                var recebimento = new Recebimento
                {
                    Pedido = pedido,
                    Data = data,
                    Valor = valor,
                    FormaPagamento = forma,
                    Observacao = observacao,
                };
                pedido.Recebimentos.Add(recebimento);

                // Aparece também no histórico do pedido, com texto legível.
                db.RegistrarLog(nameof(Pedido), pedido.Id, "Recebimento", null, FinanceiroRegras.DescreverRecebimento(recebimento));
                await db.SaveChangesAsync(ct);

                var recebido = pedido.Recebimentos.Sum(r => r.Valor);
                return new RecebimentoDto(recebimento.Id, pedido.Id, pedido.Cliente.Nome, data, valor, forma, observacao,
                    FinanceiroRegras.Situacao(pedido.ValorTotal, recebido), recebimento.CriadoEm);
            }
            finally
            {
                Trava.Release();
            }
        }
    }
}

/// <summary>COMANDO — DELETE /api/recebimentos/{id}   Estorna um recebimento lançado errado.</summary>
public static class EstornarRecebimento
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapDelete("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
        {
            await handler.Handle(id, ct);
            return TypedResults.NoContent();
        });

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task Handle(int id, CancellationToken ct)
        {
            var recebimento = await db.Recebimentos.FirstOrDefaultAsync(r => r.Id == id, ct)
                ?? throw new NaoEncontradoException("Recebimento não encontrado.");

            db.RegistrarLog(nameof(Pedido), recebimento.PedidoId, "Estorno", FinanceiroRegras.DescreverRecebimento(recebimento), null);
            db.Recebimentos.Remove(recebimento); // log automático: Recebimento, Exclusão
            await db.SaveChangesAsync(ct);
        }
    }
}
