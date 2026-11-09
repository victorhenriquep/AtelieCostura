namespace Atelie.Api.Features.Indicadores;

/// <summary>Um serviço feito numa peça do pedido (quantidade, complexidade e valor já multiplicados pela quantidade).</summary>
public record ItemIndicador(string ServicoNome, int Quantidade, int Complexidade, decimal Valor);

/// <summary>Pedido com o que os indicadores precisam. Horários em UTC, vindos do histórico de status.</summary>
public record PedidoIndicador(
    int Id,
    string ClienteNome,
    StatusPedido Status,
    DateOnly DataEntrega,
    int ComplexidadeTotal,
    decimal ValorTotal,
    DateTime? InicioProducao,
    DateTime? Pronto,
    DateOnly? DiaPronto,
    decimal Recebido,
    List<ItemIndicador> Itens);

public record TempoServicoDto(string Servico, double HorasMedias, int Pecas);
public record OcupacaoSemanaDto(DateOnly Semana, double Percentual, int Complexidade, int Capacidade);
public record PrazosDto(int NoPrazo, int Atrasados, int EmAndamento, double? Indice);
public record TicketServicoDto(string Servico, decimal TicketMedio, int Pedidos);
public record ReceitaHoraDto(string Servico, decimal ReceitaPorHora, double Horas);
public record FaturamentoClienteDto(string Cliente, decimal Valor, int Pedidos);
public record InadimplenciaDto(int Pedidos, decimal Valor);

/// <summary>
/// REGRAS DOS INDICADORES (todos sobre os pedidos não cancelados com entrega prevista no período)
///  P1 Tempo de execução por serviço: tempo entre "Em produção" e "Pronto" (histórico de status), dividido entre os
///     serviços do pedido pela complexidade de cada um, e depois pela quantidade de peças. É tempo corrido.
///  P2 Ocupação semanal: complexidade reservada ÷ (dias úteis da semana × capacidade diária).
///  P3 Ticket médio por serviço: valor cobrado pelo serviço ÷ número de pedidos que o incluem.
///  P3 Receita por hora: valor do serviço ÷ horas de produção atribuídas a ele (mesma divisão do P1).
///  P4 Prazos: no prazo = ficou Pronto até a data de entrega; atrasado = ficou Pronto depois, ou ainda não ficou
///     e a data já passou; em andamento = ainda não ficou Pronto e a data não chegou.
///  P5 Faturamento por cliente: soma do valor dos pedidos (10 maiores). Inadimplência: entregues com saldo a receber.
/// Não acessa o banco, para poder ser testada (Atelie.Tests/IndicadoresTests.cs).
/// </summary>
public static class CalculadoraIndicadores
{
    /// <summary>Horas de produção atribuídas a cada item do pedido, proporcionais à complexidade.</summary>
    private static IEnumerable<(ItemIndicador Item, double Horas)> HorasPorItem(PedidoIndicador p)
    {
        if (p.InicioProducao is null || p.Pronto is null || p.Pronto <= p.InicioProducao)
            yield break;

        var horas = (p.Pronto.Value - p.InicioProducao.Value).TotalHours;
        var total = p.Itens.Sum(i => i.Complexidade);
        foreach (var item in p.Itens)
            yield return (item, total > 0 ? horas * item.Complexidade / total : horas / p.Itens.Count);
    }

    public static List<TempoServicoDto> TempoPorServico(IEnumerable<PedidoIndicador> pedidos) =>
        pedidos.SelectMany(p => HorasPorItem(p))
            .GroupBy(x => x.Item.ServicoNome)
            .Select(g =>
            {
                var pecas = g.Sum(x => x.Item.Quantidade);
                return new TempoServicoDto(g.Key, Math.Round(g.Sum(x => x.Horas) / pecas, 1), pecas);
            })
            .OrderByDescending(t => t.HorasMedias)
            .ToList();

    public static List<OcupacaoSemanaDto> OcupacaoSemanal(IEnumerable<PedidoIndicador> pedidos, DateOnly de, DateOnly ate, int capacidadeDiaria)
    {
        var porDia = pedidos.GroupBy(p => p.DataEntrega).ToDictionary(g => g.Key, g => g.Sum(p => p.ComplexidadeTotal));
        var semanas = new List<OcupacaoSemanaDto>();

        // Segunda-feira da semana de "de"
        var segunda = de.AddDays(-(((int)de.DayOfWeek + 6) % 7));
        for (; segunda <= ate; segunda = segunda.AddDays(7))
        {
            var dias = Enumerable.Range(0, 5).Select(i => segunda.AddDays(i)).Where(d => d >= de && d <= ate).ToList();
            if (dias.Count == 0)
                continue;

            var complexidade = dias.Sum(d => porDia.GetValueOrDefault(d));
            var capacidade = dias.Count * capacidadeDiaria;
            semanas.Add(new OcupacaoSemanaDto(segunda, Math.Round(100.0 * complexidade / capacidade, 1), complexidade, capacidade));
        }
        return semanas;
    }

    public static PrazosDto Prazos(IEnumerable<PedidoIndicador> pedidos, DateOnly hoje)
    {
        int noPrazo = 0, atrasados = 0, emAndamento = 0;
        foreach (var p in pedidos)
        {
            if (p.DiaPronto is DateOnly pronto)
            {
                if (pronto <= p.DataEntrega) noPrazo++;
                else atrasados++;
            }
            else if (p.DataEntrega < hoje) atrasados++;
            else emAndamento++;
        }

        var concluidos = noPrazo + atrasados;
        return new PrazosDto(noPrazo, atrasados, emAndamento, concluidos > 0 ? Math.Round(100.0 * noPrazo / concluidos, 1) : null);
    }

    public static List<TicketServicoDto> TicketPorServico(IEnumerable<PedidoIndicador> pedidos) =>
        pedidos.SelectMany(p => p.Itens.Select(i => (Pedido: p.Id, Item: i)))
            .GroupBy(x => x.Item.ServicoNome)
            .Select(g =>
            {
                var qtdPedidos = g.Select(x => x.Pedido).Distinct().Count();
                return new TicketServicoDto(g.Key, Math.Round(g.Sum(x => x.Item.Valor) / qtdPedidos, 2), qtdPedidos);
            })
            .OrderByDescending(t => t.TicketMedio)
            .ToList();

    public static List<ReceitaHoraDto> ReceitaPorHora(IEnumerable<PedidoIndicador> pedidos) =>
        pedidos.SelectMany(p => HorasPorItem(p))
            .GroupBy(x => x.Item.ServicoNome)
            .Select(g => (Servico: g.Key, Valor: g.Sum(x => x.Item.Valor), Horas: g.Sum(x => x.Horas)))
            .Where(x => x.Horas > 0)
            .Select(x => new ReceitaHoraDto(x.Servico, Math.Round(x.Valor / (decimal)x.Horas, 2), Math.Round(x.Horas, 1)))
            .OrderByDescending(r => r.ReceitaPorHora)
            .ToList();

    public static List<FaturamentoClienteDto> FaturamentoPorCliente(IEnumerable<PedidoIndicador> pedidos, int maximo = 10) =>
        pedidos.GroupBy(p => p.ClienteNome)
            .Select(g => new FaturamentoClienteDto(g.Key, g.Sum(p => p.ValorTotal), g.Count()))
            .OrderByDescending(f => f.Valor)
            .Take(maximo)
            .ToList();

    public static InadimplenciaDto Inadimplencia(IEnumerable<PedidoIndicador> pedidos)
    {
        var emAberto = pedidos.Where(p => p.Status == StatusPedido.Entregue && p.Recebido < p.ValorTotal).ToList();
        return new InadimplenciaDto(emAberto.Count, emAberto.Sum(p => p.ValorTotal - p.Recebido));
    }
}
