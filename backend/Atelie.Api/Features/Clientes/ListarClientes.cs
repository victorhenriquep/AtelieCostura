namespace Atelie.Api.Features.Clientes;

/// <summary>
/// CONSULTA: lista clientes, com busca opcional.
/// GET /api/clientes?busca=ana&amp;incluirInativos=true   (Administrador e Visualizador)
/// </summary>
public static class ListarClientes
{
    public record Consulta(string? Busca, bool IncluirInativos);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (string? busca, bool? incluirInativos, Handler handler, CancellationToken ct) =>
                handler.Handle(new Consulta(busca, incluirInativos ?? false), ct))
            .RequireAuthorization(Politicas.TodosOsPerfis);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<List<ClienteDto>> Handle(Consulta consulta, CancellationToken ct)
        {
            // Consultas usam AsNoTracking: só leitura, mais rápido.
            var query = db.Clientes.AsNoTracking();

            if (!consulta.IncluirInativos)
                query = query.Where(c => c.Ativo);

            var termo = Texto.Limpar(consulta.Busca);
            if (termo.Length > 0)
            {
                var digitos = Texto.SoDigitos(termo);
                // LIKE no SQLite não diferencia maiúsculas/minúsculas (para letras sem acento).
                query = query.Where(c =>
                    EF.Functions.Like(c.Nome, $"%{termo}%") ||
                    EF.Functions.Like(c.Email, $"%{termo}%") ||
                    (digitos.Length > 0 && (c.Telefone.Contains(digitos) || c.Cpf.Contains(digitos))));
            }

            return await query
                .OrderBy(c => c.Nome)
                .Select(ClienteDto.Projecao)
                .ToListAsync(ct);
        }
    }
}
