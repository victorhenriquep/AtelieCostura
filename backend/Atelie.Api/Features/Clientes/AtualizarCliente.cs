namespace Atelie.Api.Features.Clientes;

/// <summary>
/// COMANDO: altera os dados de um cliente.
/// PUT /api/clientes/{id}   (somente Administrador)
/// </summary>
public static class AtualizarCliente
{
    public record Comando(int Id, ClienteDados Dados);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPut("/{id:int}", async (int id, ClienteDados dados, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(new Comando(id, dados), ct)))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<ClienteDto> Handle(Comando comando, CancellationToken ct)
        {
            // Carrega COM rastreamento (sem AsNoTracking): é assim que o EF sabe
            // o valor anterior de cada campo e consegue gerar o log "antes -> depois".
            var cliente = await db.Clientes.FirstOrDefaultAsync(c => c.Id == comando.Id, ct)
                ?? throw new NaoEncontradoException("Cliente não encontrado.");

            ClienteRegras.ValidarEAplicar(comando.Dados, cliente);
            await ClienteRegras.GarantirCpfUnico(db, cliente, ct);

            await db.SaveChangesAsync(ct); // uma linha de log por campo que mudou

            return ClienteDto.De(cliente);
        }
    }
}
