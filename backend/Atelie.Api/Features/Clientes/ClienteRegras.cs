namespace Atelie.Api.Features.Clientes;

/// <summary>Validações compartilhadas entre CriarCliente e AtualizarCliente.</summary>
public static class ClienteRegras
{
    /// <summary>Limpa os dados recebidos, valida e copia para a entidade.</summary>
    public static void ValidarEAplicar(ClienteDados dados, Cliente cliente)
    {
        var nome = Texto.Limpar(dados.Nome);
        var telefone = Texto.SoDigitos(dados.Telefone);
        var email = Texto.Limpar(dados.Email).ToLowerInvariant();
        var cpf = Texto.SoDigitos(dados.Cpf);
        var endereco = Texto.Limpar(dados.Endereco);
        var observacoes = Texto.Limpar(dados.Observacoes);

        if (nome.Length == 0)
            throw new RegraNegocioException("O nome é obrigatório.");
        if (telefone.Length is < 10 or > 11)
            throw new RegraNegocioException("Informe um telefone válido com DDD.");
        if (email.Length > 0 && !Texto.EmailValido(email))
            throw new RegraNegocioException("E-mail inválido.");
        if (cpf.Length > 0 && !Texto.CpfValido(cpf))
            throw new RegraNegocioException("CPF inválido.");

        Texto.ExigirTamanhoMaximo(nome, 150, "Nome");
        Texto.ExigirTamanhoMaximo(email, 150, "E-mail");
        Texto.ExigirTamanhoMaximo(endereco, 250, "Endereço");
        Texto.ExigirTamanhoMaximo(observacoes, 500, "Observações");

        // Ao atribuir, o EF compara com o valor original: só os campos que mudaram geram log.
        cliente.Nome = nome;
        cliente.Telefone = telefone;
        cliente.Email = email;
        cliente.Cpf = cpf;
        cliente.Endereco = endereco;
        cliente.Observacoes = observacoes;
    }

    /// <summary>Não permite dois clientes com o mesmo CPF.</summary>
    public static async Task GarantirCpfUnico(AppDbContext db, Cliente cliente, CancellationToken ct)
    {
        if (cliente.Cpf.Length == 0)
            return;

        var existe = await db.Clientes.AnyAsync(c => c.Cpf == cliente.Cpf && c.Id != cliente.Id, ct);
        if (existe)
            throw new RegraNegocioException("Já existe um cliente cadastrado com este CPF.");
    }
}
