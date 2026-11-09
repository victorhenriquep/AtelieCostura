using Microsoft.AspNetCore.Identity;

namespace Atelie.Api.Infrastructure.Data;

/// <summary>
/// Cria o banco (se não existir) e cadastra os dados iniciais:
/// um Administrador, um Visualizador e alguns serviços de exemplo.
/// </summary>
public static class DbSeeder
{
    public static async Task InicializarAsync(IServiceProvider services)
    {
        using var escopo = services.CreateScope();
        var db = escopo.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = escopo.ServiceProvider.GetRequiredService<IPasswordHasher<Funcionario>>();

        // Cria o arquivo atelie.db com todas as tabelas na primeira execução.
        // Se você mudar as entidades, apague o atelie.db e rode de novo (veja o README).
        await db.Database.EnsureCreatedAsync();

        // Banco criado por uma versão anterior? Acrescenta o que faltar (peças, financeiro).
        var logger = escopo.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbSeeder));
        await AtualizacaoBanco.AplicarAsync(db, logger);

        if (!await db.Funcionarios.AnyAsync())
        {
            var admin = new Funcionario { Nome = "Administrador", Email = "admin@atelie.com", Perfil = Perfil.Administrador };
            admin.SenhaHash = hasher.HashPassword(admin, "admin123");

            var visualizador = new Funcionario { Nome = "Maria Visualizadora", Email = "visualizador@atelie.com", Perfil = Perfil.Visualizador };
            visualizador.SenhaHash = hasher.HashPassword(visualizador, "visualizador123");

            db.Funcionarios.AddRange(admin, visualizador);
        }

        if (!await db.Servicos.AnyAsync())
        {
            db.Servicos.AddRange(
                new Servico { Nome = "Barra simples", Descricao = "Barra de calça ou saia", Preco = 25m, Complexidade = 5 },
                new Servico { Nome = "Troca de zíper", Descricao = "Calças, saias e jaquetas", Preco = 35m, Complexidade = 10 },
                new Servico { Nome = "Ajuste de cintura", Descricao = "Apertar ou soltar a cintura", Preco = 45m, Complexidade = 15 },
                new Servico { Nome = "Bainha de vestido", Descricao = "Vestidos longos ou de festa", Preco = 60m, Complexidade = 20 },
                new Servico { Nome = "Customização", Descricao = "Aplicações e bordados simples", Preco = 90m, Complexidade = 30 },
                new Servico { Nome = "Vestido sob medida", Descricao = "Confecção completa de vestido", Preco = 600m, Complexidade = 80 });
        }

        await db.SaveChangesAsync();
    }
}
