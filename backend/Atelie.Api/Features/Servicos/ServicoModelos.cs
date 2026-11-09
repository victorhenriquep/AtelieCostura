using System.Linq.Expressions;

namespace Atelie.Api.Features.Servicos;

public record ServicoDto(int Id, string Nome, string Descricao, decimal Preco, int Complexidade, bool Ativo, DateTime CriadoEm)
{
    public static readonly Expression<Func<Servico, ServicoDto>> Projecao = s =>
        new ServicoDto(s.Id, s.Nome, s.Descricao, s.Preco, s.Complexidade, s.Ativo, s.CriadoEm);

    public static ServicoDto De(Servico s) => new(s.Id, s.Nome, s.Descricao, s.Preco, s.Complexidade, s.Ativo, s.CriadoEm);
}

public record ServicoDados(string? Nome, string? Descricao, decimal? Preco, int? Complexidade);

public static class ServicoRegras
{
    public static void ValidarEAplicar(ServicoDados dados, Servico servico, CalculadoraDataEntrega calculadora)
    {
        var nome = Texto.Limpar(dados.Nome);
        var descricao = Texto.Limpar(dados.Descricao);

        if (nome.Length == 0)
            throw new RegraNegocioException("O nome do serviço é obrigatório.");
        if (dados.Preco is null or < 0m)
            throw new RegraNegocioException("Informe um preço válido.");
        if (dados.Complexidade is null || dados.Complexidade < 1 || dados.Complexidade > calculadora.CapacidadeDiaria)
            throw new RegraNegocioException($"A complexidade deve ser um número entre 1 e {calculadora.CapacidadeDiaria}.");

        Texto.ExigirTamanhoMaximo(nome, 100, "Nome");
        Texto.ExigirTamanhoMaximo(descricao, 500, "Descrição");

        servico.Nome = nome;
        servico.Descricao = descricao;
        servico.Preco = Math.Round(dados.Preco.Value, 2);
        servico.Complexidade = dados.Complexidade.Value;
    }

    public static async Task GarantirNomeUnico(AppDbContext db, Servico servico, CancellationToken ct)
    {
        var existe = await db.Servicos.AnyAsync(s => s.Nome.ToLower() == servico.Nome.ToLower() && s.Id != servico.Id, ct);
        if (existe)
            throw new RegraNegocioException("Já existe um serviço com este nome.");
    }
}
