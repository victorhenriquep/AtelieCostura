namespace Atelie.Api.Features.Servicos;

/// <summary>
/// Operações de serviços. Mesmo padrão do slice de Clientes (veja Features/Clientes/LEIA-ME.md),
/// aqui reunidas em um arquivo por serem curtas.
/// </summary>
public static class ServicosEndpoints
{
    public static void MapServicos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/servicos").RequireAuthorization();

        ListarServicos.Mapear(grupo);
        ListarOpcoesServicos.Mapear(grupo);
        ObterServico.Mapear(grupo);
        CriarServico.Mapear(grupo);
        AtualizarServico.Mapear(grupo);
        AlterarStatusServico.Mapear(grupo);
    }
}

/// <summary>CONSULTA — GET /api/servicos?busca=&amp;incluirInativos=   (Administrador)</summary>
public static class ListarServicos
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (string? busca, bool? incluirInativos, Handler handler, CancellationToken ct) =>
                handler.Handle(busca, incluirInativos ?? false, ct))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public Task<List<ServicoDto>> Handle(string? busca, bool incluirInativos, CancellationToken ct)
        {
            var query = db.Servicos.AsNoTracking();
            if (!incluirInativos)
                query = query.Where(s => s.Ativo);

            var termo = Texto.Limpar(busca);
            if (termo.Length > 0)
                query = query.Where(s => EF.Functions.Like(s.Nome, $"%{termo}%") || EF.Functions.Like(s.Descricao, $"%{termo}%"));

            return query.OrderBy(s => s.Nome).Select(ServicoDto.Projecao).ToListAsync(ct);
        }
    }
}

/// <summary>
/// CONSULTA — GET /api/servicos/opcoes   (Administrador)
/// Serviços ativos para montar o pedido.
/// </summary>
public static class ListarOpcoesServicos
{
    public record ServicoOpcaoDto(int Id, string Nome, decimal Preco, int Complexidade);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/opcoes", (Handler handler, CancellationToken ct) => handler.Handle(ct))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public Task<List<ServicoOpcaoDto>> Handle(CancellationToken ct) =>
            db.Servicos.AsNoTracking()
                .Where(s => s.Ativo)
                .OrderBy(s => s.Nome)
                .Select(s => new ServicoOpcaoDto(s.Id, s.Nome, s.Preco, s.Complexidade))
                .ToListAsync(ct);
    }
}

/// <summary>CONSULTA — GET /api/servicos/{id}   (Administrador)</summary>
public static class ObterServico
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(id, ct)))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<ServicoDto> Handle(int id, CancellationToken ct) =>
            await db.Servicos.AsNoTracking().Where(s => s.Id == id).Select(ServicoDto.Projecao).FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("Serviço não encontrado.");
    }
}

/// <summary>COMANDO — POST /api/servicos   (Administrador)</summary>
public static class CriarServico
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (ServicoDados dados, Handler handler, CancellationToken ct) =>
            {
                var criado = await handler.Handle(dados, ct);
                return TypedResults.Created($"/api/servicos/{criado.Id}", criado);
            })
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, CalculadoraDataEntrega calculadora) : IHandler
    {
        public async Task<ServicoDto> Handle(ServicoDados dados, CancellationToken ct)
        {
            var servico = new Servico();
            ServicoRegras.ValidarEAplicar(dados, servico, calculadora);
            await ServicoRegras.GarantirNomeUnico(db, servico, ct);

            db.Servicos.Add(servico);
            await db.SaveChangesAsync(ct);
            return ServicoDto.De(servico);
        }
    }
}

/// <summary>
/// COMANDO — PUT /api/servicos/{id}   (Administrador)
/// Mudar preço ou complexidade NÃO altera pedidos já feitos (eles guardam uma cópia dos valores).
/// </summary>
public static class AtualizarServico
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPut("/{id:int}", async (int id, ServicoDados dados, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(id, dados, ct)))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, CalculadoraDataEntrega calculadora) : IHandler
    {
        public async Task<ServicoDto> Handle(int id, ServicoDados dados, CancellationToken ct)
        {
            var servico = await db.Servicos.FirstOrDefaultAsync(s => s.Id == id, ct)
                ?? throw new NaoEncontradoException("Serviço não encontrado.");

            ServicoRegras.ValidarEAplicar(dados, servico, calculadora);
            await ServicoRegras.GarantirNomeUnico(db, servico, ct);

            await db.SaveChangesAsync(ct);
            return ServicoDto.De(servico);
        }
    }
}

/// <summary>COMANDO — PATCH /api/servicos/{id}/status   corpo: { "ativo": false }   (Administrador)</summary>
public static class AlterarStatusServico
{
    public record Requisicao(bool Ativo);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPatch("/{id:int}/status", async (int id, Requisicao requisicao, Handler handler, CancellationToken ct) =>
            {
                await handler.Handle(id, requisicao.Ativo, ct);
                return TypedResults.NoContent();
            })
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task Handle(int id, bool ativo, CancellationToken ct)
        {
            var servico = await db.Servicos.FirstOrDefaultAsync(s => s.Id == id, ct)
                ?? throw new NaoEncontradoException("Serviço não encontrado.");

            servico.Ativo = ativo;
            await db.SaveChangesAsync(ct);
        }
    }
}
