namespace Atelie.Api.Domain;

/// <summary>
/// Entidades que implementam esta interface têm as alterações gravadas automaticamente
/// na tabela de logs (veja AppDbContext.SaveChangesAsync).
/// </summary>
public interface IAuditavel
{
    int Id { get; }
    DateTime CriadoEm { get; set; }
}

/// <summary>O campo aparece no log, mas com os valores ocultos (ex.: senha).</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class DadoSensivelAttribute : Attribute { }

/// <summary>O campo não gera log automático (quando o log é feito manualmente, de forma mais legível).</summary>
[AttributeUsage(AttributeTargets.Property)]
public sealed class NaoAuditarAttribute : Attribute { }

/// <summary>Uma linha de log = um campo alterado de uma entidade.</summary>
public class LogAlteracao
{
    public int Id { get; set; }
    public string Entidade { get; set; } = "";     // "Cliente", "Servico", "Funcionario", "Pedido", "Recebimento", "Pagamento"
    public int EntidadeId { get; set; }
    public AcaoLog Acao { get; set; }
    public string? Campo { get; set; }             // nome da propriedade, ex.: "Telefone"
    public string? ValorAnterior { get; set; }
    public string? ValorNovo { get; set; }
    public string UsuarioNome { get; set; } = "";
    public DateTime DataHora { get; set; }
}
