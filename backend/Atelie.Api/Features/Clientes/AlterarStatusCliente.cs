namespace Atelie.Api.Features.Clientes;

/// <summary>
/// COMANDO: inativa ou reativa um cliente (exclusão lógica: o registro e o histórico continuam no banco).
/// PATCH /api/clientes/{id}/status   corpo: { "ativo": false }   (somente Administrador)
/// </summary>
public static class AlterarStatusCliente
{
    public record Requisicao(bool Ativo);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPatch("/{id:int}/status", async (int id, Requisicao requisicao, Handler handler, CancellationToken ct) =>
            {
                await handler.Handle(id, requisicao.Ativo, ct);
                return TypedResults.NoContent(); // HTTP 204
            })
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task Handle(int id, bool ativo, CancellationToken ct)
        {
            var cliente = await db.Clientes.FirstOrDefaultAsync(c => c.Id == id, ct)
                ?? throw new NaoEncontradoException("Cliente não encontrado.");

            cliente.Ativo = ativo;
            await db.SaveChangesAsync(ct); // log: campo "Ativo", true -> false
        }
    }
}
