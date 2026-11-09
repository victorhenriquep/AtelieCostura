using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;

namespace Atelie.Api.Features.Funcionarios;

/// <summary>A senha (hash) nunca sai da API.</summary>
public record FuncionarioDto(int Id, string Nome, string Email, Perfil Perfil, bool Ativo, DateTime CriadoEm)
{
    public static readonly Expression<Func<Funcionario, FuncionarioDto>> Projecao = f =>
        new FuncionarioDto(f.Id, f.Nome, f.Email, f.Perfil, f.Ativo, f.CriadoEm);

    public static FuncionarioDto De(Funcionario f) => new(f.Id, f.Nome, f.Email, f.Perfil, f.Ativo, f.CriadoEm);
}

/// <summary>Na edição, deixe "senha" vazia para manter a senha atual.</summary>
public record FuncionarioDados(string? Nome, string? Email, Perfil? Perfil, string? Senha);

public static class FuncionarioRegras
{
    public const int TamanhoMinimoSenha = 6;

    public static void ValidarEAplicar(FuncionarioDados dados, Funcionario funcionario, IPasswordHasher<Funcionario> hasher, bool senhaObrigatoria)
    {
        var nome = Texto.Limpar(dados.Nome);
        var email = Texto.Limpar(dados.Email).ToLowerInvariant();
        var senha = dados.Senha ?? "";

        if (nome.Length == 0)
            throw new RegraNegocioException("O nome é obrigatório.");
        if (!Texto.EmailValido(email))
            throw new RegraNegocioException("Informe um e-mail válido.");
        if (dados.Perfil is null || !Enum.IsDefined(dados.Perfil.Value))
            throw new RegraNegocioException("Informe o perfil: Administrador ou Visualizador.");
        if (senhaObrigatoria && senha.Length == 0)
            throw new RegraNegocioException("Informe a senha.");
        if (senha.Length > 0 && senha.Length < TamanhoMinimoSenha)
            throw new RegraNegocioException($"A senha deve ter pelo menos {TamanhoMinimoSenha} caracteres.");

        Texto.ExigirTamanhoMaximo(nome, 150, "Nome");
        Texto.ExigirTamanhoMaximo(email, 150, "E-mail");

        funcionario.Nome = nome;
        funcionario.Email = email;
        funcionario.Perfil = dados.Perfil.Value;
        if (senha.Length > 0)
            funcionario.SenhaHash = hasher.HashPassword(funcionario, senha); // no log aparece como "******"
    }

    public static async Task GarantirEmailUnico(AppDbContext db, Funcionario funcionario, CancellationToken ct)
    {
        var existe = await db.Funcionarios.AnyAsync(f => f.Email == funcionario.Email && f.Id != funcionario.Id, ct);
        if (existe)
            throw new RegraNegocioException("Já existe um funcionário com este e-mail.");
    }

    /// <summary>Impede que o sistema fique sem nenhum Administrador ativo.</summary>
    public static async Task GarantirOutroAdministrador(AppDbContext db, Funcionario funcionario, CancellationToken ct)
    {
        var continuaAdminAtivo = funcionario.Ativo && funcionario.Perfil == Perfil.Administrador;
        if (continuaAdminAtivo)
            return;

        var existeOutro = await db.Funcionarios.AnyAsync(
            f => f.Id != funcionario.Id && f.Ativo && f.Perfil == Perfil.Administrador, ct);
        if (!existeOutro)
            throw new RegraNegocioException("O sistema precisa ter ao menos um Administrador ativo.");
    }
}
