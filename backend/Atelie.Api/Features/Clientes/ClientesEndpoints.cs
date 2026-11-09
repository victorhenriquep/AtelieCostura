namespace Atelie.Api.Features.Clientes;

public static class ClientesEndpoints
{
    /// <summary>Registra todas as rotas de /api/clientes. Chamado no Program.cs.</summary>
    public static void MapClientes(this IEndpointRouteBuilder app)
    {
        // RequireAuthorization() aqui = precisa estar logado.
        // Cada operação define, além disso, QUAL perfil pode acessar:
        // consultas para todos os perfis; cadastrar, alterar e inativar só para o Administrador.
        var grupo = app.MapGroup("/api/clientes").RequireAuthorization();

        ListarClientes.Mapear(grupo);
        ListarOpcoesClientes.Mapear(grupo);
        ObterCliente.Mapear(grupo);
        CriarCliente.Mapear(grupo);
        AtualizarCliente.Mapear(grupo);
        AlterarStatusCliente.Mapear(grupo);
    }
}
