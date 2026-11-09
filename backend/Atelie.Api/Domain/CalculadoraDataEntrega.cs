namespace Atelie.Api.Domain;

/// <summary>Valores lidos da seção "Producao" do appsettings.json.</summary>
public class ConfiguracaoProducao
{
    /// <summary>Complexidade máxima que o ateliê produz por dia.</summary>
    public int CapacidadeDiaria { get; set; } = 100;

    /// <summary>Prazo mínimo de entrega, em dias úteis, a partir do dia do pedido.</summary>
    public int DiasUteisParaEntrega { get; set; } = 3;
}

/// <summary>
/// REGRA DA DATA DE ENTREGA
///  1. O prazo mínimo é hoje + 3 dias úteis (segunda a sexta).
///  2. Cada dia aguenta no máximo 100 de complexidade (somando os pedidos ativos daquele dia).
///  3. O pedido inteiro é entregue em um único dia: se não cabe na data, vai para o próximo dia útil em que cabe.
///  4. Um pedido acima de 100 de complexidade não é aceito (precisa ser dividido).
///
/// Esta classe não acessa o banco: recebe a ocupação de cada dia pronta.
/// Isso permite testá-la isoladamente (veja o projeto Atelie.Tests).
/// </summary>
public class CalculadoraDataEntrega(ConfiguracaoProducao configuracao)
{
    public int CapacidadeDiaria => configuracao.CapacidadeDiaria;

    public static bool EhDiaUtil(DateOnly data) =>
        data.DayOfWeek is not (DayOfWeek.Saturday or DayOfWeek.Sunday);

    public static DateOnly ProximoDiaUtil(DateOnly data)
    {
        do
        {
            data = data.AddDays(1);
        } while (!EhDiaUtil(data));
        return data;
    }

    public static DateOnly AdicionarDiasUteis(DateOnly data, int dias)
    {
        for (var i = 0; i < dias; i++)
            data = ProximoDiaUtil(data);
        return data;
    }

    /// <summary>Primeira data possível para um pedido feito hoje (hoje + 3 dias úteis).</summary>
    public DateOnly DataMinima(DateOnly hoje) => AdicionarDiasUteis(hoje, configuracao.DiasUteisParaEntrega);

    public void ValidarComplexidade(int complexidadePedido)
    {
        if (complexidadePedido <= 0)
            throw new RegraNegocioException("O pedido precisa ter ao menos um serviço.");

        if (complexidadePedido > configuracao.CapacidadeDiaria)
            throw new RegraNegocioException(
                $"Este pedido soma {complexidadePedido} de complexidade e o limite de produção por dia é " +
                $"{configuracao.CapacidadeDiaria}. Divida-o em mais de um pedido.");
    }

    /// <summary>
    /// Procura, a partir de <paramref name="inicio"/>, o primeiro dia útil em que o pedido cabe inteiro.
    /// </summary>
    /// <param name="ocupacaoPorDia">Complexidade já reservada em cada data (pedidos pendentes, em produção ou prontos).</param>
    public DateOnly ProximaDataDisponivel(DateOnly inicio, int complexidadePedido, IReadOnlyDictionary<DateOnly, int> ocupacaoPorDia)
    {
        ValidarComplexidade(complexidadePedido);

        var data = EhDiaUtil(inicio) ? inicio : ProximoDiaUtil(inicio);

        while (ocupacaoPorDia.GetValueOrDefault(data) + complexidadePedido > configuracao.CapacidadeDiaria)
            data = ProximoDiaUtil(data);

        return data;
    }

    /// <summary>Data de entrega de um pedido novo feito em <paramref name="hoje"/>.</summary>
    public DateOnly CalcularParaNovoPedido(DateOnly hoje, int complexidadePedido, IReadOnlyDictionary<DateOnly, int> ocupacaoPorDia) =>
        ProximaDataDisponivel(DataMinima(hoje), complexidadePedido, ocupacaoPorDia);
}
