namespace Atelie.Api.Common;

/// <summary>
/// Captura as exceções da aplicação e devolve sempre o mesmo formato de erro para o front:
/// { "mensagem": "texto para mostrar ao usuário" }
/// </summary>
public class TratamentoErrosMiddleware(RequestDelegate proximo, ILogger<TratamentoErrosMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext contexto)
    {
        try
        {
            await proximo(contexto);
        }
        catch (Exception ex) when (!contexto.Response.HasStarted)
        {
            var (status, mensagem) = ex switch
            {
                RegraNegocioException => (StatusCodes.Status400BadRequest, ex.Message),
                NaoEncontradoException => (StatusCodes.Status404NotFound, ex.Message),
                BadHttpRequestException => (StatusCodes.Status400BadRequest, "Requisição inválida. Verifique os dados enviados."),
                _ => (StatusCodes.Status500InternalServerError, "Ocorreu um erro inesperado no servidor."),
            };

            if (status == StatusCodes.Status500InternalServerError)
                logger.LogError(ex, "Erro não tratado em {Metodo} {Caminho}", contexto.Request.Method, contexto.Request.Path);

            contexto.Response.StatusCode = status;
            await contexto.Response.WriteAsJsonAsync(new { mensagem });
        }
    }
}
