using System.Reflection;

namespace Atelie.Api.Common;

/// <summary>
/// Marca as classes que executam um comando ou uma consulta (o "H" do CQRS).
/// Toda classe que implementa IHandler é registrada automaticamente na injeção de dependência,
/// então criar uma feature nova não exige mexer no Program.cs.
/// </summary>
public interface IHandler { }

public static class HandlerExtensions
{
    public static IServiceCollection AddHandlers(this IServiceCollection services)
    {
        var handlers = Assembly.GetExecutingAssembly()
            .GetTypes()
            .Where(t => t is { IsClass: true, IsAbstract: false } && typeof(IHandler).IsAssignableFrom(t));

        foreach (var handler in handlers)
            services.AddScoped(handler);

        return services;
    }
}
