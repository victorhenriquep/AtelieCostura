using Atelie.Api.Features.Financeiro;

namespace Atelie.Api.Features.Pedidos;

/// <summary>
/// COMANDO: altera um pedido. Só é permitido enquanto ele estiver PENDENTE.
/// PUT /api/pedidos/{id}   (somente Administrador)   mesmo corpo do POST.
///
/// A data de entrega é mantida se o pedido ainda couber nela; se não couber
/// (ex.: foram incluídas mais peças ou serviços), vai para o próximo dia útil com espaço.
///
/// As peças são substituídas por inteiro: as antigas (e seus serviços) são apagadas e as novas inseridas.
/// É mais simples que comparar peça por peça e o resultado final é o mesmo.
/// </summary>
public static class AtualizarPedido
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPut("/{id:int}", async (int id, PedidoDados dados, Handler handler, CancellationToken ct) =>
            TypedResults.Ok(await handler.Handle(id, dados, ct)))
        .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, AgendaProducao agenda) : IHandler
    {
        public async Task<PedidoDto> Handle(int id, PedidoDados dados, CancellationToken ct)
        {
            var pedido = await db.Pedidos
                .Include(p => p.Cliente)
                .Include(p => p.Pecas)
                    .ThenInclude(peca => peca.Servicos)
                .Include(p => p.Recebimentos)
                .FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NaoEncontradoException("Pedido não encontrado.");

            if (pedido.Status != StatusPedido.Pendente)
                throw new RegraNegocioException("Somente pedidos pendentes podem ser alterados.");

            var cliente = dados.ClienteId == pedido.ClienteId
                ? pedido.Cliente
                : await PedidoRegras.ObterClienteAtivo(db, dados.ClienteId, ct);
            var novasPecas = await PedidoRegras.MontarPecas(db, dados.Pecas, ct);
            var observacoes = PedidoRegras.ValidarObservacoes(dados.Observacoes);
            var complexidade = PedidoRegras.CalcularComplexidade(novasPecas);
            var novoValor = PedidoRegras.CalcularValor(novasPecas);

            var recebido = pedido.Recebimentos.Sum(r => r.Valor);
            if (novoValor < recebido)
                throw new RegraNegocioException(
                    $"O cliente já pagou {FinanceiroRegras.Moeda(recebido)} e o pedido passaria a valer " +
                    $"{FinanceiroRegras.Moeda(novoValor)}. Estorne um recebimento antes de diminuir o pedido.");

            await AgendaProducao.Trava.WaitAsync(ct);
            try
            {
                // Logs manuais (mais legíveis que o automático para cliente e peças)
                if (cliente.Id != pedido.ClienteId)
                    db.RegistrarLog(nameof(Pedido), pedido.Id, "Cliente", pedido.Cliente.Nome, cliente.Nome);

                var pecasAntes = PedidoRegras.DescreverPecas(pedido.Pecas.OrderBy(p => p.Id));
                var pecasDepois = PedidoRegras.DescreverPecas(novasPecas);
                if (pecasAntes != pecasDepois)
                    db.RegistrarLog(nameof(Pedido), pedido.Id, "Pecas", pecasAntes, pecasDepois);

                // Calcula a nova data ANTES de alterar o pedido (usa a data atual como ponto de partida).
                var novaData = await agenda.RecalcularPedidoExistente(pedido, complexidade, ct);

                pedido.Cliente = cliente;
                pedido.Observacoes = observacoes;
                pedido.Pecas.Clear();             // o EF apaga as peças antigas e os serviços delas (cascade)
                pedido.Pecas.AddRange(novasPecas);
                pedido.ComplexidadeTotal = complexidade;
                pedido.ValorTotal = novoValor;
                pedido.DataEntrega = novaData; // log automático se a data mudar

                await db.SaveChangesAsync(ct);
                return PedidoDto.De(pedido);
            }
            finally
            {
                AgendaProducao.Trava.Release();
            }
        }
    }
}
