using Atelie.Api.Features.Financeiro;

namespace Atelie.Api.Features.Pedidos;

// Estrutura do pedido:  Pedido  ->  Peças  ->  Serviços de cada peça
// Ex.: Pedido #12
//        ├─ 1x Calça jeans azul ── Barra simples ("subir 3 cm"), Troca de zíper
//        └─ 2x Camisa social    ── Ajuste de cintura

// ----- Saída -----

public record PedidoPecaServicoDto(
    int Id,
    int ServicoId,
    string ServicoNome,
    string Observacao,
    int ComplexidadeUnitaria,
    decimal PrecoUnitario);

public record PedidoPecaDto(
    int Id,
    string Descricao,
    int Quantidade,
    int Complexidade,  // de todas as unidades: soma dos serviços × quantidade
    decimal Subtotal,  // de todas as unidades: soma dos serviços × quantidade
    List<PedidoPecaServicoDto> Servicos);

public record PedidoDto(
    int Id,
    int ClienteId,
    string ClienteNome,
    string ClienteTelefone,
    StatusPedido Status,
    DateOnly DataEntrega,
    int ComplexidadeTotal,
    decimal ValorTotal,
    string Observacoes,
    DateTime CriadoEm,
    bool PodeEditar,
    List<PedidoPecaDto> Pecas,
    // Financeiro: preenchido só para o Administrador (null para o Visualizador).
    decimal? ValorRecebido,
    SituacaoPagamento? SituacaoPagamento,
    List<RecebimentoDoPedidoDto>? Recebimentos)
{
    /// <summary>Precisa do pedido com Cliente, Peças, Serviços das peças e Recebimentos carregados.</summary>
    public static PedidoDto De(Pedido p, bool incluirFinanceiro = true) => new(
        p.Id, p.ClienteId, p.Cliente.Nome, p.Cliente.Telefone, p.Status, p.DataEntrega,
        p.ComplexidadeTotal, p.ValorTotal, p.Observacoes, p.CriadoEm,
        PodeEditar: p.Status == StatusPedido.Pendente,
        ValorRecebido: incluirFinanceiro ? p.Recebimentos.Sum(r => r.Valor) : null,
        SituacaoPagamento: incluirFinanceiro ? FinanceiroRegras.Situacao(p.ValorTotal, p.Recebimentos.Sum(r => r.Valor)) : null,
        Recebimentos: incluirFinanceiro
            ? p.Recebimentos.OrderBy(r => r.Data).ThenBy(r => r.Id)
                .Select(r => new RecebimentoDoPedidoDto(r.Id, r.Data, r.Valor, r.FormaPagamento, r.Observacao)).ToList()
            : null,
        Pecas: p.Pecas
            .OrderBy(peca => peca.Id)
            .Select(peca => new PedidoPecaDto(
                peca.Id,
                peca.Descricao,
                peca.Quantidade,
                PedidoRegras.ComplexidadePeca(peca),
                PedidoRegras.ValorPeca(peca),
                peca.Servicos
                    .OrderBy(s => s.Id)
                    .Select(s => new PedidoPecaServicoDto(
                        s.Id, s.ServicoId, s.ServicoNome, s.Observacao, s.ComplexidadeUnitaria, s.PrecoUnitario))
                    .ToList()))
            .ToList());
}

/// <summary>Versão resumida para a listagem.</summary>
public record PedidoResumoDto(
    int Id,
    string ClienteNome,
    StatusPedido Status,
    DateOnly DataEntrega,
    int ComplexidadeTotal,
    decimal ValorTotal,
    int QuantidadePecas, // total de peças físicas (soma das quantidades)
    DateTime CriadoEm,
    decimal? ValorRecebido = null,             // só para o Administrador
    SituacaoPagamento? SituacaoPagamento = null);

public record RecebimentoDoPedidoDto(int Id, DateOnly Data, decimal Valor, FormaPagamento FormaPagamento, string Observacao);

// ----- Entrada -----

/// <summary>Um serviço aplicado à peça, com uma observação opcional (ex.: "subir 3 cm").</summary>
public record ServicoPecaDados(int? ServicoId, string? Observacao);

/// <summary>Uma peça do pedido: descrição, quantas unidades iguais e quais serviços ela recebe.</summary>
public record PecaDados(string? Descricao, int? Quantidade, List<ServicoPecaDados>? Servicos);

public record PedidoDados(int? ClienteId, string? Observacoes, List<PecaDados>? Pecas);
