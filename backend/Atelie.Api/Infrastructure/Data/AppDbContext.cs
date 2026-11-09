using System.Globalization;
using System.Reflection;
using Atelie.Api.Infrastructure.Auth;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace Atelie.Api.Infrastructure.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options, UsuarioAtual usuarioAtual, TimeProvider relogio)
    : DbContext(options)
{
    public DbSet<Funcionario> Funcionarios => Set<Funcionario>();
    public DbSet<Cliente> Clientes => Set<Cliente>();
    public DbSet<Servico> Servicos => Set<Servico>();
    public DbSet<Pedido> Pedidos => Set<Pedido>();
    public DbSet<PedidoPeca> PedidoPecas => Set<PedidoPeca>();
    public DbSet<PedidoPecaServico> PedidoPecaServicos => Set<PedidoPecaServico>();
    public DbSet<Recebimento> Recebimentos => Set<Recebimento>();
    public DbSet<Pagamento> Pagamentos => Set<Pagamento>();
    public DbSet<LogAlteracao> Logs => Set<LogAlteracao>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Funcionario>(e =>
        {
            e.Property(x => x.Nome).HasMaxLength(150);
            e.Property(x => x.Email).HasMaxLength(150);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Perfil).HasConversion<string>().HasMaxLength(20);
        });

        modelBuilder.Entity<Cliente>(e =>
        {
            e.Property(x => x.Nome).HasMaxLength(150);
            e.Property(x => x.Telefone).HasMaxLength(11);
            e.Property(x => x.Email).HasMaxLength(150);
            e.Property(x => x.Cpf).HasMaxLength(11);
            e.Property(x => x.Endereco).HasMaxLength(250);
            e.Property(x => x.Observacoes).HasMaxLength(500);
            e.HasIndex(x => x.Nome);
        });

        modelBuilder.Entity<Servico>(e =>
        {
            e.Property(x => x.Nome).HasMaxLength(100);
            e.Property(x => x.Descricao).HasMaxLength(500);
        });

        modelBuilder.Entity<Pedido>(e =>
        {
            e.Property(x => x.Status).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Observacoes).HasMaxLength(500);
            e.HasIndex(x => x.DataEntrega);
            e.HasOne(x => x.Cliente).WithMany().HasForeignKey(x => x.ClienteId).OnDelete(DeleteBehavior.Restrict);
            // Pedido 1 -> N Peças. Apagar o pedido (ou tirar a peça da lista) apaga a peça.
            e.HasMany(x => x.Pecas).WithOne().HasForeignKey(x => x.PedidoId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PedidoPeca>(e =>
        {
            e.Property(x => x.Descricao).HasMaxLength(200);
            // Peça 1 -> N Serviços da peça. Apagar a peça apaga os serviços dela.
            e.HasMany(x => x.Servicos).WithOne().HasForeignKey(x => x.PedidoPecaId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PedidoPecaServico>(e =>
        {
            e.Property(x => x.ServicoNome).HasMaxLength(100);
            e.Property(x => x.Observacao).HasMaxLength(200);
            // O mesmo serviço não pode aparecer duas vezes na mesma peça.
            e.HasIndex(x => new { x.PedidoPecaId, x.ServicoId }).IsUnique();
            // Um serviço usado em algum pedido não pode ser apagado (só inativado).
            e.HasOne<Servico>().WithMany().HasForeignKey(x => x.ServicoId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Recebimento>(e =>
        {
            e.Property(x => x.FormaPagamento).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Observacao).HasMaxLength(200);
            e.HasIndex(x => x.Data);
            // Pedido com recebimento não pode ser apagado; o estorno apaga o recebimento antes.
            e.HasOne(x => x.Pedido).WithMany(p => p.Recebimentos).HasForeignKey(x => x.PedidoId).OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Pagamento>(e =>
        {
            e.Property(x => x.Descricao).HasMaxLength(150);
            e.Property(x => x.Categoria).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.FormaPagamento).HasConversion<string>().HasMaxLength(20);
            e.Property(x => x.Observacao).HasMaxLength(200);
            e.HasIndex(x => x.Data);
        });

        modelBuilder.Entity<LogAlteracao>(e =>
        {
            e.ToTable("Logs");
            e.Property(x => x.Entidade).HasMaxLength(50);
            e.Property(x => x.Campo).HasMaxLength(50);
            e.Property(x => x.Acao).HasConversion<string>().HasMaxLength(20);
            e.HasIndex(x => new { x.Entidade, x.EntidadeId });
        });

        // O SQLite não guarda o "fuso" da data. Gravamos tudo em UTC e, ao ler, marcamos como UTC,
        // assim o JSON sai com "Z" no final e o navegador converte para o horário local.
        var conversorUtc = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        foreach (var entidade in modelBuilder.Model.GetEntityTypes())
            foreach (var propriedade in entidade.GetProperties().Where(p => p.ClrType == typeof(DateTime)))
                propriedade.SetValueConverter(conversorUtc);
    }

    // =====================================================================
    // LOG AUTOMÁTICO DE ALTERAÇÕES
    // Toda vez que um handler chama SaveChangesAsync, comparamos o valor
    // original de cada campo com o valor atual das entidades IAuditavel e
    // gravamos uma linha de log por campo alterado.
    // Importante: para isso funcionar, a entidade precisa ter sido carregada
    // do banco SEM AsNoTracking antes de ser alterada.
    // =====================================================================

    private static readonly HashSet<string> CamposIgnorados = ["Id", "CriadoEm"];

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        ChangeTracker.DetectChanges();
        var agora = relogio.GetUtcNow().UtcDateTime;
        var novos = new List<EntityEntry>();

        foreach (var entrada in ChangeTracker.Entries().Where(e => e.Entity is IAuditavel).ToList())
        {
            switch (entrada.State)
            {
                case EntityState.Added:
                    ((IAuditavel)entrada.Entity).CriadoEm = agora;
                    novos.Add(entrada); // o Id só existe depois de salvar
                    break;

                case EntityState.Modified:
                    RegistrarCamposAlterados(entrada, agora);
                    break;

                case EntityState.Deleted:
                    Logs.Add(NovoLog(entrada, AcaoLog.Exclusao, null, null, null, agora));
                    break;
            }
        }

        // Se houver registros novos, salvamos em duas etapas (dados e depois o log com o Id gerado)
        // dentro de uma transação, para não ficar dado sem log nem log sem dado.
        var transacao = novos.Count > 0 && Database.CurrentTransaction is null
            ? await Database.BeginTransactionAsync(cancellationToken)
            : null;

        try
        {
            var resultado = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);

            if (novos.Count > 0)
            {
                foreach (var entrada in novos)
                    Logs.Add(NovoLog(entrada, AcaoLog.Criacao, null, null, null, agora));

                await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
            }

            if (transacao is not null)
                await transacao.CommitAsync(cancellationToken);

            return resultado;
        }
        finally
        {
            if (transacao is not null)
                await transacao.DisposeAsync();
        }
    }

    /// <summary>
    /// Log manual, para alterações que o log automático não descreve bem
    /// (ex.: troca das peças de um pedido). É gravado no próximo SaveChangesAsync.
    /// </summary>
    public void RegistrarLog(string entidade, int entidadeId, string campo, string? valorAnterior, string? valorNovo)
    {
        Logs.Add(new LogAlteracao
        {
            Entidade = entidade,
            EntidadeId = entidadeId,
            Acao = AcaoLog.Alteracao,
            Campo = campo,
            ValorAnterior = valorAnterior,
            ValorNovo = valorNovo,
            UsuarioNome = usuarioAtual.Nome,
            DataHora = relogio.GetUtcNow().UtcDateTime,
        });
    }

    private void RegistrarCamposAlterados(EntityEntry entrada, DateTime agora)
    {
        foreach (var propriedade in entrada.Properties)
        {
            var info = propriedade.Metadata.PropertyInfo;

            if (!propriedade.IsModified
                || CamposIgnorados.Contains(propriedade.Metadata.Name)
                || info?.IsDefined(typeof(NaoAuditarAttribute)) == true
                || Equals(propriedade.OriginalValue, propriedade.CurrentValue))
                continue;

            var sensivel = info?.IsDefined(typeof(DadoSensivelAttribute)) == true;

            Logs.Add(NovoLog(
                entrada,
                AcaoLog.Alteracao,
                propriedade.Metadata.Name,
                sensivel ? "******" : Formatar(propriedade.OriginalValue),
                sensivel ? "******" : Formatar(propriedade.CurrentValue),
                agora));
        }
    }

    private LogAlteracao NovoLog(EntityEntry entrada, AcaoLog acao, string? campo, string? anterior, string? novo, DateTime agora) => new()
    {
        Entidade = entrada.Metadata.ClrType.Name,
        EntidadeId = ((IAuditavel)entrada.Entity).Id,
        Acao = acao,
        Campo = campo,
        ValorAnterior = anterior,
        ValorNovo = novo,
        UsuarioNome = usuarioAtual.Nome,
        DataHora = agora,
    };

    /// <summary>Converte o valor para texto de forma previsível (sem depender do idioma do computador).</summary>
    private static string? Formatar(object? valor) => valor switch
    {
        null => null,
        bool b => b ? "true" : "false",
        decimal d => d.ToString("0.00", CultureInfo.InvariantCulture),
        DateOnly d => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        DateTime d => d.ToString("o", CultureInfo.InvariantCulture),
        IFormattable f => f.ToString(null, CultureInfo.InvariantCulture),
        _ => valor.ToString(),
    };
}
