namespace Atelie.Api.Domain;

public class Funcionario : IAuditavel
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Email { get; set; } = "";

    [DadoSensivel]
    public string SenhaHash { get; set; } = "";

    public Perfil Perfil { get; set; }
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; }
}

public class Cliente : IAuditavel
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Telefone { get; set; } = "";   // só dígitos
    public string Email { get; set; } = "";
    public string Cpf { get; set; } = "";        // só dígitos (opcional)
    public string Endereco { get; set; } = "";
    public string Observacoes { get; set; } = "";
    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; }
}

public class Servico : IAuditavel
{
    public int Id { get; set; }
    public string Nome { get; set; } = "";
    public string Descricao { get; set; } = "";
    public decimal Preco { get; set; }

    /// <summary>Quanto da capacidade diária (padrão 100) uma peça deste serviço consome.</summary>
    public int Complexidade { get; set; }

    public bool Ativo { get; set; } = true;
    public DateTime CriadoEm { get; set; }
}

public class Pedido : IAuditavel
{
    public int Id { get; set; }

    [NaoAuditar] // a troca de cliente é registrada manualmente, com o nome em vez do id
    public int ClienteId { get; set; }
    public Cliente Cliente { get; set; } = null!;

    public StatusPedido Status { get; set; } = StatusPedido.Pendente;
    public DateOnly DataEntrega { get; set; }

    /// <summary>
    /// Soma da complexidade de todas as peças (veja PedidoRegras.ComplexidadePeca).
    /// Fica gravada no pedido para a agenda somar a ocupação do dia direto no banco.
    /// </summary>
    public int ComplexidadeTotal { get; set; }

    /// <summary>Soma do valor de todas as peças. Também gravada, pelo mesmo motivo.</summary>
    public decimal ValorTotal { get; set; }

    public string Observacoes { get; set; } = "";
    public List<PedidoPeca> Pecas { get; set; } = [];
    public List<Recebimento> Recebimentos { get; set; } = [];
    public DateTime CriadoEm { get; set; }
}

/// <summary>
/// Uma peça trazida pelo cliente (ex.: "calça jeans azul"). Cada peça recebe um ou mais serviços.
/// Quantidade &gt; 1 = várias peças iguais que recebem exatamente os mesmos serviços (ex.: 3 calças com barra).
/// </summary>
public class PedidoPeca
{
    public int Id { get; set; }
    public int PedidoId { get; set; }
    public string Descricao { get; set; } = "";
    public int Quantidade { get; set; } = 1;
    public List<PedidoPecaServico> Servicos { get; set; } = [];
}

/// <summary>
/// Serviço aplicado a uma peça. Nome, preço e complexidade do serviço são copiados no momento do pedido,
/// assim alterar o cadastro do serviço depois não muda pedidos já feitos.
/// </summary>
public class PedidoPecaServico
{
    public int Id { get; set; }
    public int PedidoPecaId { get; set; }
    public int ServicoId { get; set; }
    public string ServicoNome { get; set; } = "";
    public int ComplexidadeUnitaria { get; set; }
    public decimal PrecoUnitario { get; set; }
    public string Observacao { get; set; } = ""; // ex.: "subir 3 cm"
}

/// <summary>
/// Dinheiro recebido de um pedido. Um pedido pode ser pago em partes (ex.: sinal + restante),
/// então tem zero ou mais recebimentos. A soma nunca passa do valor total do pedido.
/// </summary>
public class Recebimento : IAuditavel
{
    public int Id { get; set; }
    public int PedidoId { get; set; }
    public Pedido Pedido { get; set; } = null!;
    public DateOnly Data { get; set; }
    public decimal Valor { get; set; }
    public FormaPagamento FormaPagamento { get; set; }
    public string Observacao { get; set; } = "";
    public DateTime CriadoEm { get; set; }
}

/// <summary>Dinheiro que saiu do caixa (compra de material, aluguel, contas...).</summary>
public class Pagamento : IAuditavel
{
    public int Id { get; set; }
    public string Descricao { get; set; } = "";
    public CategoriaPagamento Categoria { get; set; }
    public DateOnly Data { get; set; }
    public decimal Valor { get; set; }
    public FormaPagamento FormaPagamento { get; set; }
    public string Observacao { get; set; } = "";
    public DateTime CriadoEm { get; set; }
}
