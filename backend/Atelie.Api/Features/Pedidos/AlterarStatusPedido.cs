namespace Atelie.Api.Features.Pedidos;

/// <summary>
/// COMANDO: muda o status do pedido (inclusive cancelar).
/// PATCH /api/pedidos/{id}/status   corpo: { "status": "EmProducao" }   (somente Administrador)
///
/// Fluxo: Pendente -> EmProducao -> Pronto -> Entregue.  Cancelado a partir de qualquer etapa antes de Entregue.
/// Entregue e Cancelado liberam a capacidade do dia automaticamente (a AgendaProducao não os soma).
/// </summary>
public static class AlterarStatusPedido
{
    public record Requisicao(StatusPedido? Status);

    /// <summary>Para quais status cada status pode ir. Para permitir "voltar uma etapa", inclua aqui.</summary>
    private static readonly Dictionary<StatusPedido, StatusPedido[]> TransicoesPermitidas = new()
    {
        [StatusPedido.Pendente] = [StatusPedido.EmProducao, StatusPedido.Cancelado],
        [StatusPedido.EmProducao] = [StatusPedido.Pronto, StatusPedido.Cancelado],
        [StatusPedido.Pronto] = [StatusPedido.Entregue, StatusPedido.Cancelado],
        [StatusPedido.Entregue] = [],
        [StatusPedido.Cancelado] = [],
    };

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPatch("/{id:int}/status", async (int id, Requisicao requisicao, Handler handler, CancellationToken ct) =>
        {
            await handler.Handle(id, requisicao.Status, ct);
            return TypedResults.NoContent();
        })
        .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task Handle(int id, StatusPedido? novoStatus, CancellationToken ct)
        {
            if (novoStatus is null || !Enum.IsDefined(novoStatus.Value))
                throw new RegraNegocioException("Informe um status válido.");

            var pedido = await db.Pedidos.FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NaoEncontradoException("Pedido não encontrado.");

            if (pedido.Status == novoStatus)
                return;

            if (!TransicoesPermitidas[pedido.Status].Contains(novoStatus.Value))
                throw new RegraNegocioException(
                    $"Não é possível mudar o pedido de \"{PedidoRegras.NomeStatus(pedido.Status)}\" " +
                    $"para \"{PedidoRegras.NomeStatus(novoStatus.Value)}\".");

            if (novoStatus == StatusPedido.Cancelado && await db.Recebimentos.AnyAsync(r => r.PedidoId == id, ct))
                throw new RegraNegocioException(
                    "Este pedido tem recebimentos. Estorne-os na tela Recebimentos antes de cancelar.");

            pedido.Status = novoStatus.Value;
            await db.SaveChangesAsync(ct); // log: campo "Status"
        }
    }
}
