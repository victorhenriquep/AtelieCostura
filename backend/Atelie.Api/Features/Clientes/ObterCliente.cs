namespace Atelie.Api.Features.Clientes;

/// <summary>
/// CONSULTA: um cliente pelo id.
/// GET /api/clientes/{id}   (Administrador e Visualizador)
/// </summary>
public static class ObterCliente
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(id, ct)))
            .RequireAuthorization(Politicas.TodosOsPerfis);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<ClienteDto> Handle(int id, CancellationToken ct) =>
            await db.Clientes.AsNoTracking()
                .Where(c => c.Id == id)
                .Select(ClienteDto.Projecao)
                .FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("Cliente não encontrado.");
    }
}
