namespace Atelie.Api.Features.Logs;

/// <summary>
/// CONSULTA: histórico de alterações de um registro.
/// GET /api/logs?entidade=Cliente&amp;entidadeId=1   (somente Administrador)
/// Entidades: Cliente, Servico, Funcionario, Pedido, Pagamento.
/// </summary>
public static class ListarLogs
{
    public record LogDto(
        int Id,
        string Entidade,
        int EntidadeId,
        AcaoLog Acao,
        string? Campo,
        string? ValorAnterior,
        string? ValorNovo,
        string UsuarioNome,
        DateTime DataHora);

    public static void MapLogs(this IEndpointRouteBuilder app) =>
        app.MapGet("/api/logs", (string entidade, int entidadeId, Handler handler, CancellationToken ct) =>
                handler.Handle(entidade, entidadeId, ct))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public Task<List<LogDto>> Handle(string entidade, int entidadeId, CancellationToken ct) =>
            db.Logs.AsNoTracking()
                .Where(l => l.Entidade == entidade && l.EntidadeId == entidadeId)
                .OrderByDescending(l => l.Id) // mais recentes primeiro
                .Select(l => new LogDto(l.Id, l.Entidade, l.EntidadeId, l.Acao, l.Campo, l.ValorAnterior,
                    l.ValorNovo, l.UsuarioNome, l.DataHora))
                .ToListAsync(ct);
    }
}
