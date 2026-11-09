namespace Atelie.Api.Features.Financeiro;

public record FluxoDiaDto(DateOnly Data, decimal Entradas, decimal Saidas, decimal SaldoDoDia, decimal SaldoAcumulado);

public record FluxoCaixaDto(
    DateOnly De,
    DateOnly Ate,
    decimal SaldoInicial,
    decimal TotalEntradas,
    decimal TotalSaidas,
    decimal SaldoFinal,
    List<FluxoDiaDto> Dias,
    List<TotalPorForma> EntradasPorForma,
    List<TotalPorCategoria> SaidasPorCategoria);

/// <summary>
/// REGRA DO FLUXO DE CAIXA (só o realizado)
///  - entrada = recebimento de pedido, na data do recebimento
///  - saída = pagamento, na data do pagamento
///  - saldo inicial = entradas − saídas de tudo antes do período
///  - saldo final = saldo inicial + entradas − saídas do período
/// Não acessa o banco, para poder ser testada (Atelie.Tests/FluxoCaixaTests.cs).
/// </summary>
public static class CalculadoraFluxoCaixa
{
    public record Movimento(DateOnly Data, decimal Valor);

    public record Resultado(decimal SaldoInicial, decimal TotalEntradas, decimal TotalSaidas, decimal SaldoFinal, List<FluxoDiaDto> Dias);

    public static Resultado Calcular(DateOnly de, DateOnly ate, IReadOnlyCollection<Movimento> entradas, IReadOnlyCollection<Movimento> saidas)
    {
        var saldoInicial = entradas.Where(m => m.Data < de).Sum(m => m.Valor) - saidas.Where(m => m.Data < de).Sum(m => m.Valor);

        var entradasDia = entradas.Where(m => m.Data >= de && m.Data <= ate).GroupBy(m => m.Data).ToDictionary(g => g.Key, g => g.Sum(m => m.Valor));
        var saidasDia = saidas.Where(m => m.Data >= de && m.Data <= ate).GroupBy(m => m.Data).ToDictionary(g => g.Key, g => g.Sum(m => m.Valor));

        var dias = new List<FluxoDiaDto>();
        var acumulado = saldoInicial;
        foreach (var data in entradasDia.Keys.Union(saidasDia.Keys).Order())
        {
            var entrou = entradasDia.GetValueOrDefault(data);
            var saiu = saidasDia.GetValueOrDefault(data);
            acumulado += entrou - saiu;
            dias.Add(new FluxoDiaDto(data, entrou, saiu, entrou - saiu, acumulado));
        }

        var totalEntradas = entradasDia.Values.Sum();
        var totalSaidas = saidasDia.Values.Sum();
        return new Resultado(saldoInicial, totalEntradas, totalSaidas, saldoInicial + totalEntradas - totalSaidas, dias);
    }
}

/// <summary>CONSULTA — GET /api/fluxo-caixa?de=2026-10-01&amp;ate=2026-10-31   (padrão: mês atual; somente Administrador)</summary>
public static class ConsultarFluxoCaixa
{
    public static void MapFluxoCaixa(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/fluxo-caixa", (DateOnly? de, DateOnly? ate, Handler handler, CancellationToken ct) =>
                handler.Handle(de, ate, ct))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<FluxoCaixaDto> Handle(DateOnly? de, DateOnly? ate, CancellationToken ct)
        {
            var (inicio, fim) = FinanceiroRegras.Periodo(de, ate, RecebimentosEndpoints.Hoje(relogio));

            // Tudo até o fim do período: o que vem antes do início forma o saldo inicial.
            var entradas = await db.Recebimentos.AsNoTracking()
                .Where(r => r.Data <= fim)
                .Select(r => new { r.Data, r.Valor, r.FormaPagamento })
                .ToListAsync(ct);
            var saidas = await db.Pagamentos.AsNoTracking()
                .Where(p => p.Data <= fim)
                .Select(p => new { p.Data, p.Valor, p.Categoria })
                .ToListAsync(ct);

            var calculo = CalculadoraFluxoCaixa.Calcular(inicio, fim,
                entradas.Select(e => new CalculadoraFluxoCaixa.Movimento(e.Data, e.Valor)).ToList(),
                saidas.Select(s => new CalculadoraFluxoCaixa.Movimento(s.Data, s.Valor)).ToList());

            var porForma = entradas
                .Where(e => e.Data >= inicio)
                .GroupBy(e => e.FormaPagamento)
                .Select(g => new TotalPorForma(g.Key, g.Sum(e => e.Valor)))
                .OrderByDescending(t => t.Total)
                .ToList();
            var porCategoria = saidas
                .Where(s => s.Data >= inicio)
                .GroupBy(s => s.Categoria)
                .Select(g => new TotalPorCategoria(g.Key, g.Sum(s => s.Valor)))
                .OrderByDescending(t => t.Total)
                .ToList();

            return new FluxoCaixaDto(inicio, fim, calculo.SaldoInicial, calculo.TotalEntradas, calculo.TotalSaidas,
                calculo.SaldoFinal, calculo.Dias, porForma, porCategoria);
        }
    }
}
