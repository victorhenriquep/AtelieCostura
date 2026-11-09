using System.Security.Claims;

namespace Atelie.Api.Infrastructure.Auth;

/// <summary>Dados do funcionário logado, lidos do token JWT da requisição.</summary>
public class UsuarioAtual(IHttpContextAccessor acessor)
{
    private ClaimsPrincipal? Principal => acessor.HttpContext?.User;

    public int? Id => int.TryParse(Principal?.FindFirst(ClaimsDoToken.Id)?.Value, out var id) ? id : null;

    /// <summary>Nome gravado nos logs. "Sistema" quando não há usuário (ex.: carga inicial).</summary>
    public string Nome => Principal?.FindFirst(ClaimsDoToken.Nome)?.Value ?? "Sistema";

    public bool EhAdministrador => Principal?.IsInRole(nameof(Perfil.Administrador)) == true;
}

/// <summary>Nomes das informações (claims) gravadas dentro do token.</summary>
public static class ClaimsDoToken
{
    public const string Id = "sub";
    public const string Nome = "name";
    public const string Email = "email";
    public const string Perfil = "role";
}
