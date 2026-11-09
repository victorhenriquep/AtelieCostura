namespace Atelie.Api.Features.Clientes;

/// <summary>
/// CONSULTA: lista resumida de clientes ATIVOS para o campo "Cliente" da tela de pedidos.
/// GET /api/clientes/opcoes?busca=ana   (somente Administrador)
///
/// Versão leve do ListarClientes (só id, nome e telefone) usada no formulário de pedido.
/// Como só o Administrador cria pedidos, só ele usa esta rota.
/// </summary>
public static class ListarOpcoesClientes
{
    public record ClienteOpcaoDto(int Id, string Nome, string Telefone);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/opcoes", (string? busca, Handler handler, CancellationToken ct) => handler.Handle(busca, ct))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<List<ClienteOpcaoDto>> Handle(string? busca, CancellationToken ct)
        {
            var query = db.Clientes.AsNoTracking().Where(c => c.Ativo);

            var termo = Texto.Limpar(busca);
            if (termo.Length > 0)
                query = query.Where(c => EF.Functions.Like(c.Nome, $"%{termo}%"));

            return await query
                .OrderBy(c => c.Nome)
                .Take(50)
                .Select(c => new ClienteOpcaoDto(c.Id, c.Nome, c.Telefone))
                .ToListAsync(ct);
        }
    }
}
