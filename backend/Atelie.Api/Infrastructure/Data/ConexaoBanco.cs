namespace Atelie.Api.Infrastructure.Data;

/// <summary>
/// Descobre qual banco usar a partir da configuração.
/// Sem nada configurado, cai no SQLite local (atelie.db), como antes.
/// </summary>
public static class ConexaoBanco
{
    public static string Obter(IConfiguration config) =>
        Environment.GetEnvironmentVariable("DATABASE_URL") is { Length: > 0 } url
            ? url
            : config.GetConnectionString("Atelie") ?? "Data Source=atelie.db";

    public static bool EhPostgres(string conexao) =>
        conexao.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        || conexao.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase)
        || conexao.Contains("Host=", StringComparison.OrdinalIgnoreCase);

    /// <summary>
    /// O Neon e o Supabase entregam a conexão no formato URL
    /// (postgresql://usuario:senha@host/banco?sslmode=require), mas o Npgsql espera
    /// "Host=...;Username=...". Aqui fazemos a conversão.
    /// </summary>
    public static string ParaNpgsql(string conexao)
    {
        if (!conexao.Contains("://")) return conexao;

        var uri = new Uri(conexao);
        var credenciais = uri.UserInfo.Split(':', 2);
        var partes = new List<string>
        {
            $"Host={uri.Host}",
            $"Port={(uri.Port > 0 ? uri.Port : 5432)}",
            $"Database={uri.AbsolutePath.TrimStart('/')}",
            $"Username={Uri.UnescapeDataString(credenciais[0])}",
            $"Password={(credenciais.Length > 1 ? Uri.UnescapeDataString(credenciais[1]) : "")}",
            "SSL Mode=Require",
        };
        return string.Join(';', partes);
    }
}
