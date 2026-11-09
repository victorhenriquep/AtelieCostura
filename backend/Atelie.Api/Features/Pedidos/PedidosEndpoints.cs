namespace Atelie.Api.Features.Pedidos;

public static class PedidosEndpoints
{
    /// <summary>
    /// Consultar pedidos: Administrador e Visualizador.
    /// Criar, alterar, mudar status, cancelar e simular entrega: somente Administrador
    /// (essas rotas acrescentam .RequireAuthorization(Politicas.SomenteAdministrador)).
    /// </summary>
    public static void MapPedidos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/pedidos").RequireAuthorization(Politicas.TodosOsPerfis);

        ListarPedidos.Mapear(grupo);
        ConsultarOcupacao.Mapear(grupo);
        ObterPedido.Mapear(grupo);
        SimularEntrega.Mapear(grupo);
        CriarPedido.Mapear(grupo);
        AtualizarPedido.Mapear(grupo);
        AlterarStatusPedido.Mapear(grupo);
    }
}
