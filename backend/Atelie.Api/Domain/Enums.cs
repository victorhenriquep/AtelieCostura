namespace Atelie.Api.Domain;

public enum Perfil
{
    Administrador,
    /// <summary>Somente consulta: vê pedidos e clientes, sem cadastrar nem alterar.</summary>
    Visualizador,
}

public enum StatusPedido
{
    Pendente,
    EmProducao,
    Pronto,
    Entregue,
    Cancelado,
}

public enum AcaoLog
{
    Criacao,
    Alteracao,
    Exclusao,
}

public enum FormaPagamento
{
    Dinheiro,
    Pix,
    CartaoDebito,
    CartaoCredito,
}

public enum CategoriaPagamento
{
    Materiais,
    Aluguel,
    Contas,
    Salarios,
    Impostos,
    Manutencao,
    Outros,
}

/// <summary>Calculada a partir dos recebimentos; não é gravada.</summary>
public enum SituacaoPagamento
{
    AReceber,
    Parcial,
    Pago,
}
