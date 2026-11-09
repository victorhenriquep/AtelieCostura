namespace Atelie.Api.Features.Pedidos;

/// <summary>
/// COMANDO: cria um pedido e calcula a data de entrega.
/// POST /api/pedidos   (somente Administrador)
/// corpo:
/// {
///   "clienteId": 1,
///   "observacoes": "",
///   "pecas": [
///     { "descricao": "Calça jeans", "quantidade": 1,
///       "servicos": [ { "servicoId": 1, "observacao": "subir 3 cm" }, { "servicoId": 2 } ] }
///   ]
/// }
/// </summary>
public static class CriarPedido
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (PedidoDados dados, Handler handler, CancellationToken ct) =>
        {
            var criado = await handler.Handle(dados, ct);
            return TypedResults.Created($"/api/pedidos/{criado.Id}", criado);
        })
        .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, AgendaProducao agenda) : IHandler
    {
        public async Task<PedidoDto> Handle(PedidoDados dados, CancellationToken ct)
        {
            var cliente = await PedidoRegras.ObterClienteAtivo(db, dados.ClienteId, ct);
            var pecas = await PedidoRegras.MontarPecas(db, dados.Pecas, ct);
            var observacoes = PedidoRegras.ValidarObservacoes(dados.Observacoes);
            var complexidade = PedidoRegras.CalcularComplexidade(pecas);

            await AgendaProducao.Trava.WaitAsync(ct);
            try
            {
                var pedido = new Pedido
                {
                    Cliente = cliente,
                    Status = StatusPedido.Pendente,
                    Observacoes = observacoes,
                    Pecas = pecas, // o EF grava as peças e os serviços de cada peça junto com o pedido
                    ComplexidadeTotal = complexidade,
                    ValorTotal = PedidoRegras.CalcularValor(pecas),
                    // Lança erro pedindo para dividir o pedido se passar de 100.
                    DataEntrega = await agenda.CalcularParaNovoPedido(complexidade, ct),
                };

                db.Pedidos.Add(pedido);
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
