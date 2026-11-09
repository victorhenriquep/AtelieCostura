using Atelie.Api.Features.Financeiro;
using Atelie.Api.Infrastructure.Auth;

namespace Atelie.Api.Features.Indicadores;

public record IndicadoresDto(
    DateOnly De,
    DateOnly Ate,
    int TotalPedidos,
    List<TempoServicoDto> TempoPorServico,      // P1
    List<OcupacaoSemanaDto> OcupacaoSemanal,    // P2
    PrazosDto Prazos,                           // P4
    // Financeiro: só para o Administrador (null para o Visualizador)
    decimal? Faturamento,
    decimal? TicketMedioPedido,
    List<TicketServicoDto>? TicketPorServico,   // P3
    List<ReceitaHoraDto>? ReceitaPorHora,       // P3
    List<FaturamentoClienteDto>? FaturamentoPorCliente, // P5
    InadimplenciaDto? Inadimplencia);           // P5

/// <summary>
/// CONSULTA — GET /api/indicadores?de=2026-08-01&amp;ate=2026-10-31   (padrão: mês atual e os 2 anteriores)
/// Usa os pedidos não cancelados com entrega prevista no período. Regras em CalculadoraIndicadores.
/// </summary>
public static class ConsultarIndicadores
{
    public static void MapIndicadores(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/indicadores", (DateOnly? de, DateOnly? ate, Handler handler, CancellationToken ct) =>
                handler.Handle(de, ate, ct))
            .RequireAuthorization(Politicas.TodosOsPerfis);

    public class Handler(AppDbContext db, CalculadoraDataEntrega calculadora, TimeProvider relogio, UsuarioAtual usuario) : IHandler
    {
        public async Task<IndicadoresDto> Handle(DateOnly? de, DateOnly? ate, CancellationToken ct)
        {
            var hoje = DateOnly.FromDateTime(relogio.GetLocalNow().DateTime);
            var inicioMes = new DateOnly(hoje.Year, hoje.Month, 1);
            var inicio = de ?? inicioMes.AddMonths(-2);
            var fim = ate ?? inicioMes.AddMonths(1).AddDays(-1);
            if (fim < inicio)
                throw new RegraNegocioException("A data final deve ser igual ou posterior à inicial.");
            if (fim.DayNumber - inicio.DayNumber > 366)
                throw new RegraNegocioException("Consulte no máximo 366 dias por vez.");

            var pedidos = await db.Pedidos.AsNoTracking()
                .Where(p => p.Status != StatusPedido.Cancelado && p.DataEntrega >= inicio && p.DataEntrega <= fim)
                .Include(p => p.Cliente)
                .Include(p => p.Pecas)
                    .ThenInclude(peca => peca.Servicos)
                .AsSplitQuery()
                .ToListAsync(ct);

            var ids = pedidos.Select(p => p.Id).ToList();

            // Quando cada pedido entrou em produção e quando ficou pronto (primeira vez), pelo histórico de status.
            var mudancas = await db.Logs.AsNoTracking()
                .Where(l => l.Entidade == nameof(Pedido) && l.Campo == nameof(Pedido.Status) && ids.Contains(l.EntidadeId)
                            && (l.ValorNovo == nameof(StatusPedido.EmProducao) || l.ValorNovo == nameof(StatusPedido.Pronto)))
                .Select(l => new { l.EntidadeId, l.ValorNovo, l.DataHora })
                .ToListAsync(ct);
            DateTime? Primeira(int pedidoId, string status) =>
                mudancas.Where(m => m.EntidadeId == pedidoId && m.ValorNovo == status)
                    .Select(m => (DateTime?)m.DataHora).Min();

            var recebido = await RecebimentosEndpoints.RecebidoPorPedido(db, ids, ct);

            var dados = pedidos.Select(p =>
            {
                var pronto = Primeira(p.Id, nameof(StatusPedido.Pronto));
                return new PedidoIndicador(
                    p.Id, p.Cliente.Nome, p.Status, p.DataEntrega, p.ComplexidadeTotal, p.ValorTotal,
                    Primeira(p.Id, nameof(StatusPedido.EmProducao)), pronto,
                    pronto is null ? null : DateOnly.FromDateTime(pronto.Value.ToLocalTime()),
                    recebido.GetValueOrDefault(p.Id),
                    p.Pecas.SelectMany(peca => peca.Servicos.Select(s => new ItemIndicador(
                        s.ServicoNome, peca.Quantidade, s.ComplexidadeUnitaria * peca.Quantidade, s.PrecoUnitario * peca.Quantidade)))
                        .ToList());
            }).ToList();

            var financeiro = usuario.EhAdministrador;
            var faturamento = dados.Sum(p => p.ValorTotal);

            return new IndicadoresDto(
                inicio, fim, dados.Count,
                CalculadoraIndicadores.TempoPorServico(dados),
                CalculadoraIndicadores.OcupacaoSemanal(dados, inicio, fim, calculadora.CapacidadeDiaria),
                CalculadoraIndicadores.Prazos(dados, hoje),
                financeiro ? faturamento : null,
                financeiro && dados.Count > 0 ? Math.Round(faturamento / dados.Count, 2) : null,
                financeiro ? CalculadoraIndicadores.TicketPorServico(dados) : null,
                financeiro ? CalculadoraIndicadores.ReceitaPorHora(dados) : null,
                financeiro ? CalculadoraIndicadores.FaturamentoPorCliente(dados) : null,
                financeiro ? CalculadoraIndicadores.Inadimplencia(dados) : null);
        }
    }
}
