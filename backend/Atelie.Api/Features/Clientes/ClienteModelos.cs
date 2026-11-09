using System.Linq.Expressions;

namespace Atelie.Api.Features.Clientes;

/// <summary>O que a API devolve para o front. Nunca devolvemos a entidade direto.</summary>
public record ClienteDto(
    int Id,
    string Nome,
    string Telefone,
    string Email,
    string Cpf,
    string Endereco,
    string Observacoes,
    bool Ativo,
    DateTime CriadoEm)
{
    /// <summary>Usado nas consultas: o EF transforma em SELECT só com estas colunas.</summary>
    public static readonly Expression<Func<Cliente, ClienteDto>> Projecao = c =>
        new ClienteDto(c.Id, c.Nome, c.Telefone, c.Email, c.Cpf, c.Endereco, c.Observacoes, c.Ativo, c.CriadoEm);

    /// <summary>Usado nos comandos, depois de salvar a entidade.</summary>
    public static ClienteDto De(Cliente c) =>
        new(c.Id, c.Nome, c.Telefone, c.Email, c.Cpf, c.Endereco, c.Observacoes, c.Ativo, c.CriadoEm);
}

/// <summary>
/// Dados que o front envia para criar ou atualizar um cliente (corpo do POST/PUT).
/// Tudo é opcional (string?) porque o JSON pode vir incompleto: quem valida é o ClienteRegras.
/// </summary>
public record ClienteDados(
    string? Nome,
    string? Telefone,
    string? Email,
    string? Cpf,
    string? Endereco,
    string? Observacoes);
