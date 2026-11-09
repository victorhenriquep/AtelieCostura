using Atelie.Api.Infrastructure.Auth;
using Microsoft.AspNetCore.Identity;

namespace Atelie.Api.Features.Funcionarios;

/// <summary>
/// Operações de funcionários (usuários do sistema). Todas somente para Administrador.
/// Mesmo padrão do slice de Clientes, reunidas em um arquivo por serem curtas.
/// </summary>
public static class FuncionariosEndpoints
{
    public static void MapFuncionarios(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/funcionarios").RequireAuthorization(Politicas.SomenteAdministrador);

        ListarFuncionarios.Mapear(grupo);
        ObterFuncionario.Mapear(grupo);
        CriarFuncionario.Mapear(grupo);
        AtualizarFuncionario.Mapear(grupo);
        AlterarStatusFuncionario.Mapear(grupo);
    }
}

/// <summary>CONSULTA — GET /api/funcionarios?busca=&amp;incluirInativos=</summary>
public static class ListarFuncionarios
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (string? busca, bool? incluirInativos, Handler handler, CancellationToken ct) =>
            handler.Handle(busca, incluirInativos ?? false, ct));

    public class Handler(AppDbContext db) : IHandler
    {
        public Task<List<FuncionarioDto>> Handle(string? busca, bool incluirInativos, CancellationToken ct)
        {
            var query = db.Funcionarios.AsNoTracking();
            if (!incluirInativos)
                query = query.Where(f => f.Ativo);

            var termo = Texto.Limpar(busca);
            if (termo.Length > 0)
                query = query.Where(f => EF.Functions.Like(f.Nome, $"%{termo}%") || EF.Functions.Like(f.Email, $"%{termo}%"));

            return query.OrderBy(f => f.Nome).Select(FuncionarioDto.Projecao).ToListAsync(ct);
        }
    }
}

/// <summary>CONSULTA — GET /api/funcionarios/{id}</summary>
public static class ObterFuncionario
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
            TypedResults.Ok(await handler.Handle(id, ct)));

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task<FuncionarioDto> Handle(int id, CancellationToken ct) =>
            await db.Funcionarios.AsNoTracking().Where(f => f.Id == id).Select(FuncionarioDto.Projecao).FirstOrDefaultAsync(ct)
            ?? throw new NaoEncontradoException("Funcionário não encontrado.");
    }
}

/// <summary>COMANDO — POST /api/funcionarios   corpo: { nome, email, perfil, senha }</summary>
public static class CriarFuncionario
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (FuncionarioDados dados, Handler handler, CancellationToken ct) =>
        {
            var criado = await handler.Handle(dados, ct);
            return TypedResults.Created($"/api/funcionarios/{criado.Id}", criado);
        });

    public class Handler(AppDbContext db, IPasswordHasher<Funcionario> hasher) : IHandler
    {
        public async Task<FuncionarioDto> Handle(FuncionarioDados dados, CancellationToken ct)
        {
            var funcionario = new Funcionario();
            FuncionarioRegras.ValidarEAplicar(dados, funcionario, hasher, senhaObrigatoria: true);
            await FuncionarioRegras.GarantirEmailUnico(db, funcionario, ct);

            db.Funcionarios.Add(funcionario);
            await db.SaveChangesAsync(ct);
            return FuncionarioDto.De(funcionario);
        }
    }
}

/// <summary>COMANDO — PUT /api/funcionarios/{id}   (senha vazia = mantém a atual)</summary>
public static class AtualizarFuncionario
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPut("/{id:int}", async (int id, FuncionarioDados dados, Handler handler, CancellationToken ct) =>
            TypedResults.Ok(await handler.Handle(id, dados, ct)));

    public class Handler(AppDbContext db, IPasswordHasher<Funcionario> hasher) : IHandler
    {
        public async Task<FuncionarioDto> Handle(int id, FuncionarioDados dados, CancellationToken ct)
        {
            var funcionario = await db.Funcionarios.FirstOrDefaultAsync(f => f.Id == id, ct)
                ?? throw new NaoEncontradoException("Funcionário não encontrado.");

            FuncionarioRegras.ValidarEAplicar(dados, funcionario, hasher, senhaObrigatoria: false);
            await FuncionarioRegras.GarantirEmailUnico(db, funcionario, ct);
            await FuncionarioRegras.GarantirOutroAdministrador(db, funcionario, ct);

            await db.SaveChangesAsync(ct);
            return FuncionarioDto.De(funcionario);
        }
    }
}

/// <summary>COMANDO — PATCH /api/funcionarios/{id}/status   corpo: { "ativo": false }</summary>
public static class AlterarStatusFuncionario
{
    public record Requisicao(bool Ativo);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPatch("/{id:int}/status", async (int id, Requisicao requisicao, Handler handler, CancellationToken ct) =>
        {
            await handler.Handle(id, requisicao.Ativo, ct);
            return TypedResults.NoContent();
        });

    public class Handler(AppDbContext db, UsuarioAtual usuarioAtual) : IHandler
    {
        public async Task Handle(int id, bool ativo, CancellationToken ct)
        {
            if (!ativo && usuarioAtual.Id == id)
                throw new RegraNegocioException("Você não pode inativar o seu próprio usuário.");

            var funcionario = await db.Funcionarios.FirstOrDefaultAsync(f => f.Id == id, ct)
                ?? throw new NaoEncontradoException("Funcionário não encontrado.");

            funcionario.Ativo = ativo;
            await FuncionarioRegras.GarantirOutroAdministrador(db, funcionario, ct);
            await db.SaveChangesAsync(ct);
        }
    }
}
