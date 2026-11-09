namespace Atelie.Api.Common;

/// <summary>
/// Políticas de autorização usadas nos endpoints.
///  - SomenteAdministrador: tudo que cadastra ou altera dados, além de serviços, funcionários, logs e financeiro
///  - TodosOsPerfis: qualquer funcionário logado (Administrador ou Visualizador), usado nas consultas
///    de pedidos e clientes
/// </summary>
public static class Politicas
{
    public const string SomenteAdministrador = "SomenteAdministrador";
    public const string TodosOsPerfis = "TodosOsPerfis";
}
