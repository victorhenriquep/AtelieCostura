using Atelie.Api.Infrastructure.Auth;
using Microsoft.AspNetCore.Identity;

namespace Atelie.Api.Features.Auth;

/// <summary>
/// COMANDO: login. Confere e-mail e senha e devolve um token JWT.
/// POST /api/auth/login   corpo: { "email": "...", "senha": "..." }   (público)
/// </summary>
public static class Login
{
    public record Requisicao(string? Email, string? Senha);

    public record Resposta(int Id, string Nome, string Email, Perfil Perfil, string Token);

    public static void MapAuth(this IEndpointRouteBuilder app) =>
        app.MapPost("/api/auth/login", async (Requisicao requisicao, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(requisicao, ct)))
            .AllowAnonymous();

    public class Handler(AppDbContext db, IPasswordHasher<Funcionario> hasher, TokenService tokens) : IHandler
    {
        public async Task<Resposta> Handle(Requisicao requisicao, CancellationToken ct)
        {
            var email = Texto.Limpar(requisicao.Email).ToLowerInvariant();
            var senha = requisicao.Senha ?? "";

            if (email.Length == 0 || senha.Length == 0)
                throw new RegraNegocioException("Informe e-mail e senha.");

            var funcionario = await db.Funcionarios.AsNoTracking().FirstOrDefaultAsync(f => f.Email == email, ct);

            // Mesma mensagem para "e-mail não existe" e "senha errada": não revela quais e-mails existem.
            if (funcionario is null
                || hasher.VerifyHashedPassword(funcionario, funcionario.SenhaHash, senha) == PasswordVerificationResult.Failed)
                throw new RegraNegocioException("E-mail ou senha inválidos.");

            if (!funcionario.Ativo)
                throw new RegraNegocioException("Usuário inativo. Fale com o administrador.");

            return new Resposta(funcionario.Id, funcionario.Nome, funcionario.Email, funcionario.Perfil, tokens.Gerar(funcionario));
        }
    }
}
