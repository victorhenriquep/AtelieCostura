namespace Atelie.Api.Common;

/// <summary>
/// Violação de uma regra de negócio ou dado inválido.
/// O middleware de erros transforma em HTTP 400 com { "mensagem": "..." }.
/// </summary>
public class RegraNegocioException(string mensagem) : Exception(mensagem) { }

/// <summary>Registro não encontrado. Vira HTTP 404.</summary>
public class NaoEncontradoException(string mensagem) : Exception(mensagem) { }
