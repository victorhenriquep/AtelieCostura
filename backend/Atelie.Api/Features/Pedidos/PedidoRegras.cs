namespace Atelie.Api.Features.Pedidos;

/// <summary>Validações e cálculos compartilhados entre as operações de pedido.</summary>
public static class PedidoRegras
{
    public const int MaximoPecas = 50;
    public const int MaximoServicosPorPeca = 10;
    public const int MaximoQuantidadePorPeca = 100;

    public static async Task<Cliente> ObterClienteAtivo(AppDbContext db, int? clienteId, CancellationToken ct)
    {
        if (clienteId is null)
            throw new RegraNegocioException("Selecione o cliente.");

        var cliente = await db.Clientes.FirstOrDefaultAsync(c => c.Id == clienteId, ct)
            ?? throw new RegraNegocioException("Cliente não encontrado.");

        if (!cliente.Ativo)
            throw new RegraNegocioException("Este cliente está inativo.");

        return cliente;
    }

    /// <summary>
    /// Valida as peças enviadas e cria as entidades PedidoPeca (com seus PedidoPecaServico),
    /// copiando nome, preço e complexidade atuais de cada serviço.
    /// </summary>
    /// <param name="exigirDescricao">
    /// false só na simulação da entrega: o front simula enquanto o usuário ainda está digitando,
    /// e a descrição não muda a data. Ao salvar, a descrição é obrigatória.
    /// </param>
    public static async Task<List<PedidoPeca>> MontarPecas(
        AppDbContext db, List<PecaDados>? pecas, CancellationToken ct, bool exigirDescricao = true)
    {
        if (pecas is null || pecas.Count == 0)
            throw new RegraNegocioException("Inclua ao menos uma peça no pedido.");
        if (pecas.Count > MaximoPecas)
            throw new RegraNegocioException($"Um pedido aceita no máximo {MaximoPecas} peças diferentes.");

        // Busca todos os serviços usados de uma vez só (em vez de uma consulta por serviço).
        var ids = pecas
            .SelectMany(p => p?.Servicos ?? Enumerable.Empty<ServicoPecaDados>())
            .Select(s => s?.ServicoId ?? 0)
            .Distinct()
            .ToList();
        var servicos = await db.Servicos.AsNoTracking()
            .Where(s => ids.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, ct);

        var resultado = new List<PedidoPeca>();
        for (var i = 0; i < pecas.Count; i++)
        {
            var dados = pecas[i] ?? throw new RegraNegocioException($"Peça {i + 1}: dados inválidos.");
            var nomePeca = $"Peça {i + 1}";

            var descricao = Texto.Limpar(dados.Descricao);
            if (exigirDescricao && descricao.Length == 0)
                throw new RegraNegocioException($"{nomePeca}: informe a descrição (ex.: \"calça jeans azul\").");
            Texto.ExigirTamanhoMaximo(descricao, 200, $"descrição da {nomePeca.ToLowerInvariant()}");

            if (dados.Quantidade is null || dados.Quantidade < 1 || dados.Quantidade > MaximoQuantidadePorPeca)
                throw new RegraNegocioException($"{nomePeca}: a quantidade deve ser entre 1 e {MaximoQuantidadePorPeca}.");

            if (dados.Servicos is null || dados.Servicos.Count == 0)
                throw new RegraNegocioException($"{nomePeca}: inclua ao menos um serviço.");
            if (dados.Servicos.Count > MaximoServicosPorPeca)
                throw new RegraNegocioException($"{nomePeca}: no máximo {MaximoServicosPorPeca} serviços por peça.");

            var peca = new PedidoPeca { Descricao = descricao, Quantidade = dados.Quantidade.Value };

            foreach (var item in dados.Servicos)
            {
                if (item?.ServicoId is null || !servicos.TryGetValue(item.ServicoId.Value, out var servico))
                    throw new RegraNegocioException($"{nomePeca}: selecione um serviço válido.");
                if (!servico.Ativo)
                    throw new RegraNegocioException($"{nomePeca}: o serviço \"{servico.Nome}\" está inativo.");
                if (peca.Servicos.Any(s => s.ServicoId == servico.Id))
                    throw new RegraNegocioException($"{nomePeca}: o serviço \"{servico.Nome}\" foi incluído duas vezes.");

                var observacao = Texto.Limpar(item.Observacao);
                Texto.ExigirTamanhoMaximo(observacao, 200, $"observação do serviço \"{servico.Nome}\"");

                peca.Servicos.Add(new PedidoPecaServico
                {
                    ServicoId = servico.Id,
                    ServicoNome = servico.Nome,
                    ComplexidadeUnitaria = servico.Complexidade,
                    PrecoUnitario = servico.Preco,
                    Observacao = observacao,
                });
            }

            resultado.Add(peca);
        }
        return resultado;
    }

    public static string ValidarObservacoes(string? observacoes)
    {
        var texto = Texto.Limpar(observacoes);
        Texto.ExigirTamanhoMaximo(texto, 500, "Observações");
        return texto;
    }

    // ---------------------------------------------------------------
    // Cálculos. Uma peça com quantidade 3 recebe os serviços 3 vezes.
    //   complexidade da peça = (soma da complexidade dos serviços) × quantidade
    //   complexidade do pedido = soma das peças
    // Ex.: 2 calças com Barra (5) + Zíper (10)  ->  (5 + 10) × 2 = 30
    // ---------------------------------------------------------------

    public static int ComplexidadePeca(PedidoPeca peca) =>
        peca.Servicos.Sum(s => s.ComplexidadeUnitaria) * peca.Quantidade;

    public static decimal ValorPeca(PedidoPeca peca) =>
        peca.Servicos.Sum(s => s.PrecoUnitario) * peca.Quantidade;

    public static int CalcularComplexidade(IEnumerable<PedidoPeca> pecas) => pecas.Sum(p => ComplexidadePeca(p));

    public static decimal CalcularValor(IEnumerable<PedidoPeca> pecas) => pecas.Sum(p => ValorPeca(p));

    /// <summary>
    /// Texto usado no log, ex.:
    /// "1x Calça jeans: Barra simples (subir 3 cm) + Troca de zíper; 2x Camisa: Ajuste de cintura".
    /// </summary>
    public static string DescreverPecas(IEnumerable<PedidoPeca> pecas) =>
        string.Join("; ", pecas.Select(p =>
            $"{p.Quantidade}x {(p.Descricao.Length > 0 ? p.Descricao : "Peça")}: " +
            string.Join(" + ", p.Servicos.Select(s =>
                s.ServicoNome + (s.Observacao.Length > 0 ? $" ({s.Observacao})" : "")))));

    public static string NomeStatus(StatusPedido status) => status switch
    {
        StatusPedido.Pendente => "Pendente",
        StatusPedido.EmProducao => "Em produção",
        StatusPedido.Pronto => "Pronto",
        StatusPedido.Entregue => "Entregue",
        StatusPedido.Cancelado => "Cancelado",
        _ => status.ToString(),
    };
}
