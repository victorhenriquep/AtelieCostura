namespace Atelie.Api.Features.Clientes;

/// <summary>
/// COMANDO: cadastra um cliente novo.
/// POST /api/clientes   (somente Administrador)
///
/// Fluxo:
///   front envia JSON -> Mapear (endpoint) -> Handler.Handle -> banco -> devolve ClienteDto
/// </summary>
public static class CriarCliente
{
    // ---------------------------------------------------------------
    // 1) ENDPOINT: define a rota, quem pode acessar e chama o handler.
    //    O ASP.NET converte o JSON do corpo em ClienteDados e
    //    injeta o Handler automaticamente (ele está registrado na DI).
    // ---------------------------------------------------------------
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (ClienteDados dados, Handler handler, CancellationToken ct) =>
            {
                var criado = await handler.Handle(dados, ct);
                return TypedResults.Created($"/api/clientes/{criado.Id}", criado); // HTTP 201
            })
            .RequireAuthorization(Politicas.SomenteAdministrador);

    // ---------------------------------------------------------------
    // 2) HANDLER: a regra da operação. Não sabe nada de HTTP,
    //    então poderia ser chamado de qualquer lugar (ex.: um teste).
    // ---------------------------------------------------------------
    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<ClienteDto> Handle(ClienteDados dados, CancellationToken ct)
        {
            var cliente = new Cliente();

            // Valida e preenche. Se algo estiver errado, lança RegraNegocioException,
            // que o middleware transforma em HTTP 400 com { "mensagem": "..." }.
            ClienteRegras.ValidarEAplicar(dados, cliente);
            await ClienteRegras.GarantirCpfUnico(db, cliente, ct);

            db.Clientes.Add(cliente);

            // Salva. O AppDbContext preenche CriadoEm e grava o log "Criacao" sozinho.
            await db.SaveChangesAsync(ct);

            return ClienteDto.De(cliente);
        }
    }
}
