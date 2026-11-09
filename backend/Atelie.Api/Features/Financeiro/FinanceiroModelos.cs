using System.Globalization;

namespace Atelie.Api.Features.Financeiro;

// ----- Recebimentos (entradas) -----

public record RecebimentoDto(
    int Id,
    int PedidoId,
    string ClienteNome,
    DateOnly Data,
    decimal Valor,
    FormaPagamento FormaPagamento,
    string Observacao,
    SituacaoPagamento SituacaoPedido,
    DateTime CriadoEm);

public record RecebimentoDados(int? PedidoId, DateOnly? Data, decimal? Valor, FormaPagamento? FormaPagamento, string? Observacao);

/// <summary>Pedido que ainda tem saldo, para escolher na tela de recebimentos.</summary>
public record PedidoAReceberDto(int Id, string ClienteNome, StatusPedido Status, DateOnly DataEntrega,
    decimal ValorTotal, decimal ValorRecebido, decimal Saldo);

public record TotalPorForma(FormaPagamento Forma, decimal Total);

public record ListaRecebimentosDto(List<RecebimentoDto> Recebimentos, decimal Total, List<TotalPorForma> PorForma);

// ----- Pagamentos (saídas) -----

public record PagamentoDto(
    int Id,
    string Descricao,
    CategoriaPagamento Categoria,
    DateOnly Data,
    decimal Valor,
    FormaPagamento FormaPagamento,
    string Observacao,
    DateTime CriadoEm)
{
    public static PagamentoDto De(Pagamento p) =>
        new(p.Id, p.Descricao, p.Categoria, p.Data, p.Valor, p.FormaPagamento, p.Observacao, p.CriadoEm);
}

public record PagamentoDados(string? Descricao, CategoriaPagamento? Categoria, DateOnly? Data, decimal? Valor,
    FormaPagamento? FormaPagamento, string? Observacao);

public record TotalPorCategoria(CategoriaPagamento Categoria, decimal Total);

public record ListaPagamentosDto(List<PagamentoDto> Pagamentos, decimal Total, List<TotalPorCategoria> PorCategoria);

public static class FinanceiroRegras
{
    private static readonly CultureInfo PtBr = CultureInfo.GetCultureInfo("pt-BR");

    public static SituacaoPagamento Situacao(decimal valorTotal, decimal valorRecebido) =>
        valorRecebido <= 0 ? SituacaoPagamento.AReceber
        : valorRecebido < valorTotal ? SituacaoPagamento.Parcial
        : SituacaoPagamento.Pago;

    /// <summary>Data obrigatória e não futura (o caixa registra só o que já aconteceu).</summary>
    public static DateOnly ValidarData(DateOnly? data, DateOnly hoje)
    {
        if (data is null)
            throw new RegraNegocioException("Informe a data.");
        if (data > hoje)
            throw new RegraNegocioException("A data não pode ser futura.");
        return data.Value;
    }

    public static decimal ValidarValor(decimal? valor)
    {
        if (valor is null || valor <= 0)
            throw new RegraNegocioException("Informe um valor maior que zero.");
        return Math.Round(valor.Value, 2);
    }

    public static FormaPagamento ValidarForma(FormaPagamento? forma)
    {
        if (forma is null || !Enum.IsDefined(forma.Value))
            throw new RegraNegocioException("Informe a forma de pagamento.");
        return forma.Value;
    }

    public static string ValidarObservacao(string? observacao)
    {
        var texto = Texto.Limpar(observacao);
        Texto.ExigirTamanhoMaximo(texto, 200, "Observação");
        return texto;
    }

    /// <summary>Período padrão = mês de <paramref name="hoje"/>. Limite de 366 dias por consulta.</summary>
    public static (DateOnly De, DateOnly Ate) Periodo(DateOnly? de, DateOnly? ate, DateOnly hoje)
    {
        var inicio = de ?? new DateOnly(hoje.Year, hoje.Month, 1);
        var fim = ate ?? inicio.AddMonths(1).AddDays(-1);
        if (fim < inicio)
            throw new RegraNegocioException("A data final deve ser igual ou posterior à inicial.");
        if (fim.DayNumber - inicio.DayNumber > 366)
            throw new RegraNegocioException("Consulte no máximo 366 dias por vez.");
        return (inicio, fim);
    }

    public static string Moeda(decimal valor) => "R$ " + valor.ToString("N2", PtBr);

    public static string NomeForma(FormaPagamento forma) => forma switch
    {
        FormaPagamento.Dinheiro => "Dinheiro",
        FormaPagamento.Pix => "Pix",
        FormaPagamento.CartaoDebito => "Cartão de débito",
        FormaPagamento.CartaoCredito => "Cartão de crédito",
        _ => forma.ToString(),
    };

    /// <summary>Texto do histórico do pedido, ex.: "R$ 50,00 · Pix · 26/10/2026".</summary>
    public static string DescreverRecebimento(Recebimento r) =>
        $"{Moeda(r.Valor)} · {NomeForma(r.FormaPagamento)} · {r.Data.ToString("dd/MM/yyyy", PtBr)}";
}
