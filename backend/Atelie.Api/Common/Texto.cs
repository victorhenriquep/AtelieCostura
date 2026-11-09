using System.Text.RegularExpressions;

namespace Atelie.Api.Common;

/// <summary>Ajudantes para limpar e validar textos vindos do front.</summary>
public static partial class Texto
{
    public static string Limpar(string? valor) => valor?.Trim() ?? "";

    public static string SoDigitos(string? valor) => new string((valor ?? "").Where(char.IsDigit).ToArray());

    public static bool EmailValido(string email) => RegexEmail().IsMatch(email);

    public static void ExigirTamanhoMaximo(string valor, int maximo, string campo)
    {
        if (valor.Length > maximo)
            throw new RegraNegocioException($"O campo {campo} aceita no máximo {maximo} caracteres.");
    }

    /// <summary>Valida os dígitos verificadores do CPF (espera só os 11 números).</summary>
    public static bool CpfValido(string cpf)
    {
        if (cpf.Length != 11 || !cpf.All(char.IsDigit) || cpf.All(c => c == cpf[0]))
            return false;

        for (var tamanho = 9; tamanho < 11; tamanho++)
        {
            var soma = 0;
            for (var i = 0; i < tamanho; i++)
                soma += (cpf[i] - '0') * (tamanho + 1 - i);

            var digito = soma * 10 % 11 % 10;
            if (cpf[tamanho] - '0' != digito)
                return false;
        }
        return true;
    }

    [GeneratedRegex(@"^[^\s@]+@[^\s@]+\.[^\s@]+$")]
    private static partial Regex RegexEmail();
}
