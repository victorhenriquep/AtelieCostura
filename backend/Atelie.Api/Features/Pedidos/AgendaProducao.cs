namespace Atelie.Api.Features.Pedidos;

/// <summary>
/// Liga a CalculadoraDataEntrega (regra pura, sem banco) aos pedidos gravados.
/// Ocupação de um dia = soma da complexidade dos pedidos Pendentes, Em produção e Prontos daquela data.
/// Pedidos Entregues e Cancelados liberam a capacidade.
/// </summary>
public class AgendaProducao(AppDbContext db, CalculadoraDataEntrega calculadora, TimeProvider relogio)
{
    /// <summary>
    /// Garante que dois pedidos salvos ao mesmo tempo não ocupem a mesma "vaga" do dia.
    /// Funciona porque a API roda em um único processo (servidor local).
    /// </summary>
    public static readonly SemaphoreSlim Trava = new(1, 1);

    public int CapacidadeDiaria => calculadora.CapacidadeDiaria;

    /// <summary>Data de hoje no fuso do computador onde a API está rodando.</summary>
    public DateOnly Hoje() => DateOnly.FromDateTime(relogio.GetLocalNow().DateTime);

    /// <summary>Complexidade já reservada em cada data a partir de <paramref name="inicio"/>.</summary>
    /// <param name="ignorarPedidoId">Pedido que não deve ser somado (o próprio pedido, ao editar). Use 0 para nenhum.</param>
    public Task<Dictionary<DateOnly, int>> OcupacaoAPartirDe(DateOnly inicio, int ignorarPedidoId, CancellationToken ct) =>
        db.Pedidos.AsNoTracking()
            .Where(p => p.DataEntrega >= inicio
                        && p.Id != ignorarPedidoId
                        && p.Status != StatusPedido.Entregue
                        && p.Status != StatusPedido.Cancelado)
            .GroupBy(p => p.DataEntrega)
            .Select(g => new { Data = g.Key, Total = g.Sum(p => p.ComplexidadeTotal) })
            .ToDictionaryAsync(x => x.Data, x => x.Total, ct);

    /// <summary>Pedido novo: a partir de hoje + 3 dias úteis, primeiro dia em que cabe.</summary>
    public async Task<DateOnly> CalcularParaNovoPedido(int complexidade, CancellationToken ct)
    {
        calculadora.ValidarComplexidade(complexidade);
        var inicio = calculadora.DataMinima(Hoje());
        var ocupacao = await OcupacaoAPartirDe(inicio, 0, ct);
        return calculadora.ProximaDataDisponivel(inicio, complexidade, ocupacao);
    }

    /// <summary>
    /// Pedido editado: mantém a data prometida se o pedido (com a nova complexidade) ainda couber nela;
    /// senão, procura o próximo dia útil com espaço a partir dessa data.
    /// </summary>
    public async Task<DateOnly> RecalcularPedidoExistente(Pedido pedido, int novaComplexidade, CancellationToken ct)
    {
        var ocupacao = await OcupacaoAPartirDe(pedido.DataEntrega, pedido.Id, ct);
        return calculadora.ProximaDataDisponivel(pedido.DataEntrega, novaComplexidade, ocupacao);
    }
}
