using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Atelie.Api.Infrastructure.Auth;

/// <summary>Valores lidos da seção "Jwt" do appsettings.json.</summary>
public class ConfiguracaoJwt
{
    public string Chave { get; set; } = "";
    public string Emissor { get; set; } = "";
    public string Audiencia { get; set; } = "";
    public int ExpiracaoHoras { get; set; } = 8;

    public SymmetricSecurityKey ChaveDeAssinatura() => new(Encoding.UTF8.GetBytes(Chave));
}

public class TokenService(ConfiguracaoJwt configuracao, TimeProvider relogio)
{
    public string Gerar(Funcionario funcionario)
    {
        var agora = relogio.GetUtcNow().UtcDateTime;

        var descricao = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimsDoToken.Id, funcionario.Id.ToString()),
                new Claim(ClaimsDoToken.Nome, funcionario.Nome),
                new Claim(ClaimsDoToken.Email, funcionario.Email),
                new Claim(ClaimsDoToken.Perfil, funcionario.Perfil.ToString()),
            }),
            Issuer = configuracao.Emissor,
            Audience = configuracao.Audiencia,
            IssuedAt = agora,
            NotBefore = agora,
            Expires = agora.AddHours(configuracao.ExpiracaoHoras),
            SigningCredentials = new SigningCredentials(configuracao.ChaveDeAssinatura(), SecurityAlgorithms.HmacSha256),
        };

        return new JsonWebTokenHandler().CreateToken(descricao);
    }
}
