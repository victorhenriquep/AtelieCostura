namespace Atelie.Api.Features.Financeiro;

/// <summary>Pagamentos (saídas do caixa). Somente Administrador.</summary>
public static class PagamentosEndpoints
{
    public static void MapPagamentos(this IEndpointRouteBuilder app)
    {
        var grupo = app.MapGroup("/api/pagamentos").RequireAuthorization(Politicas.SomenteAdministrador);

        ListarPagamentos.Mapear(grupo);
        CriarPagamento.Mapear(grupo);
        AtualizarPagamento.Mapear(grupo);
        ExcluirPagamento.Mapear(grupo);
    }

    internal static void ValidarEAplicar(PagamentoDados dados, Pagamento pagamento, DateOnly hoje)
    {
        var descricao = Texto.Limpar(dados.Descricao);
        if (descricao.Length == 0)
            throw new RegraNegocioException("Informe a descrição.");
        Texto.ExigirTamanhoMaximo(descricao, 150, "Descrição");

        if (dados.Categoria is null || !Enum.IsDefined(dados.Categoria.Value))
            throw new RegraNegocioException("Informe a categoria.");

        pagamento.Descricao = descricao;
        pagamento.Categoria = dados.Categoria.Value;
        pagamento.Data = FinanceiroRegras.ValidarData(dados.Data, hoje);
        pagamento.Valor = FinanceiroRegras.ValidarValor(dados.Valor);
        pagamento.FormaPagamento = FinanceiroRegras.ValidarForma(dados.FormaPagamento);
        pagamento.Observacao = FinanceiroRegras.ValidarObservacao(dados.Observacao);
    }
}

/// <summary>CONSULTA — GET /api/pagamentos?de=2026-10-01&amp;ate=2026-10-31&amp;categoria=Materiais   (padrão: mês atual)</summary>
public static class ListarPagamentos
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (DateOnly? de, DateOnly? ate, CategoriaPagamento? categoria, Handler handler, CancellationToken ct) =>
            handler.Handle(de, ate, categoria, ct));

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<ListaPagamentosDto> Handle(DateOnly? de, DateOnly? ate, CategoriaPagamento? categoria, CancellationToken ct)
        {
            var (inicio, fim) = FinanceiroRegras.Periodo(de, ate, RecebimentosEndpoints.Hoje(relogio));

            var query = db.Pagamentos.AsNoTracking().Where(p => p.Data >= inicio && p.Data <= fim);
            if (categoria is not null)
                query = query.Where(p => p.Categoria == categoria);

            var pagamentos = (await query.OrderByDescending(p => p.Data).ThenByDescending(p => p.Id).ToListAsync(ct))
                .Select(PagamentoDto.De)
                .ToList();

            var porCategoria = pagamentos
                .GroupBy(p => p.Categoria)
                .Select(g => new TotalPorCategoria(g.Key, g.Sum(p => p.Valor)))
                .OrderByDescending(t => t.Total)
                .ToList();

            return new ListaPagamentosDto(pagamentos, pagamentos.Sum(p => p.Valor), porCategoria);
        }
    }
}

/// <summary>
/// COMANDO — POST /api/pagamentos
/// corpo: { "descricao": "Linhas e zíperes", "categoria": "Materiais", "data": "2026-10-26", "valor": 89.90, "formaPagamento": "Pix" }
/// </summary>
public static class CriarPagamento
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/", async (PagamentoDados dados, Handler handler, CancellationToken ct) =>
        {
            var criado = await handler.Handle(dados, ct);
            return TypedResults.Created($"/api/pagamentos/{criado.Id}", criado);
        });

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<PagamentoDto> Handle(PagamentoDados dados, CancellationToken ct)
        {
            var pagamento = new Pagamento();
            PagamentosEndpoints.ValidarEAplicar(dados, pagamento, RecebimentosEndpoints.Hoje(relogio));

            db.Pagamentos.Add(pagamento);
            await db.SaveChangesAsync(ct);
            return PagamentoDto.De(pagamento);
        }
    }
}

/// <summary>COMANDO — PUT /api/pagamentos/{id}   mesmo corpo do POST</summary>
public static class AtualizarPagamento
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPut("/{id:int}", async (int id, PagamentoDados dados, Handler handler, CancellationToken ct) =>
            TypedResults.Ok(await handler.Handle(id, dados, ct)));

    public class Handler(AppDbContext db, TimeProvider relogio) : IHandler
    {
        public async Task<PagamentoDto> Handle(int id, PagamentoDados dados, CancellationToken ct)
        {
            var pagamento = await db.Pagamentos.FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NaoEncontradoException("Pagamento não encontrado.");

            PagamentosEndpoints.ValidarEAplicar(dados, pagamento, RecebimentosEndpoints.Hoje(relogio));
            await db.SaveChangesAsync(ct); // log automático dos campos alterados
            return PagamentoDto.De(pagamento);
        }
    }
}

/// <summary>COMANDO — DELETE /api/pagamentos/{id}</summary>
public static class ExcluirPagamento
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapDelete("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
        {
            await handler.Handle(id, ct);
            return TypedResults.NoContent();
        });

    public class Handler(AppDbContext db) : IHandler
    {
        public async Task Handle(int id, CancellationToken ct)
        {
            var pagamento = await db.Pagamentos.FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NaoEncontradoException("Pagamento não encontrado.");

            db.Pagamentos.Remove(pagamento); // log automático: Exclusão
            await db.SaveChangesAsync(ct);
        }
    }
}
