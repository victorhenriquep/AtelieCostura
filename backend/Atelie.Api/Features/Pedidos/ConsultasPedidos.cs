using Atelie.Api.Features.Financeiro;
using Atelie.Api.Infrastructure.Auth;

namespace Atelie.Api.Features.Pedidos;

/// <summary>
/// CONSULTA: lista pedidos.
/// GET /api/pedidos?status=Pendente&amp;busca=ana&amp;entregaDe=2026-10-01&amp;entregaAte=2026-10-31&amp;incluirFinalizados=true
/// Por padrão esconde Entregues e Cancelados (use incluirFinalizados=true ou filtre pelo status).
/// </summary>
public static class ListarPedidos
{
    public record Consulta(StatusPedido? Status, string? Busca, DateOnly? EntregaDe, DateOnly? EntregaAte, bool IncluirFinalizados);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/", (StatusPedido? status, string? busca, DateOnly? entregaDe, DateOnly? entregaAte,
                bool? incluirFinalizados, Handler handler, CancellationToken ct) =>
            handler.Handle(new Consulta(status, busca, entregaDe, entregaAte, incluirFinalizados ?? false), ct));

    public class Handler(AppDbContext db, UsuarioAtual usuario) : IHandler
    {
        public async Task<List<PedidoResumoDto>> Handle(Consulta consulta, CancellationToken ct)
        {
            var query = db.Pedidos.AsNoTracking();

            if (consulta.Status is not null)
                query = query.Where(p => p.Status == consulta.Status);
            else if (!consulta.IncluirFinalizados)
                query = query.Where(p => p.Status != StatusPedido.Entregue && p.Status != StatusPedido.Cancelado);

            if (consulta.EntregaDe is not null)
                query = query.Where(p => p.DataEntrega >= consulta.EntregaDe);
            if (consulta.EntregaAte is not null)
                query = query.Where(p => p.DataEntrega <= consulta.EntregaAte);

            var termo = Texto.Limpar(consulta.Busca);
            if (termo.Length > 0)
                query = query.Where(p => EF.Functions.Like(p.Cliente.Nome, $"%{termo}%"));

            var pedidos = await query
                .OrderBy(p => p.DataEntrega)
                .ThenBy(p => p.Id)
                .Select(p => new PedidoResumoDto(
                    p.Id, p.Cliente.Nome, p.Status, p.DataEntrega, p.ComplexidadeTotal, p.ValorTotal,
                    p.Pecas.Sum(peca => peca.Quantidade), p.CriadoEm, null, null))
                .ToListAsync(ct);

            if (!usuario.EhAdministrador || pedidos.Count == 0)
                return pedidos;

            // O SQLite não soma decimal no banco: traz os valores e soma aqui.
            var ids = pedidos.Select(p => p.Id).ToList();
            var recebidos = (await db.Recebimentos.AsNoTracking()
                    .Where(r => ids.Contains(r.PedidoId))
                    .Select(r => new { r.PedidoId, r.Valor })
                    .ToListAsync(ct))
                .GroupBy(r => r.PedidoId)
                .ToDictionary(g => g.Key, g => g.Sum(r => r.Valor));

            return pedidos
                .Select(p =>
                {
                    var recebido = recebidos.GetValueOrDefault(p.Id);
                    return p with { ValorRecebido = recebido, SituacaoPagamento = FinanceiroRegras.Situacao(p.ValorTotal, recebido) };
                })
                .ToList();
        }
    }
}

/// <summary>CONSULTA: um pedido completo, com as peças e os serviços de cada peça. GET /api/pedidos/{id}</summary>
public static class ObterPedido
{
    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/{id:int}", async (int id, Handler handler, CancellationToken ct) =>
            TypedResults.Ok(await handler.Handle(id, ct)));

    public class Handler(AppDbContext db, UsuarioAtual usuario) : IHandler
    {
        public async Task<PedidoDto> Handle(int id, CancellationToken ct)
        {
            var pedido = await db.Pedidos.AsNoTracking()
                .Include(p => p.Cliente)
                .Include(p => p.Pecas)
                    .ThenInclude(peca => peca.Servicos)
                .Include(p => p.Recebimentos)
                .AsSplitQuery() // uma consulta por nível, em vez de um JOIN que repete as linhas do pedido
                .FirstOrDefaultAsync(p => p.Id == id, ct)
                ?? throw new NaoEncontradoException("Pedido não encontrado.");

            return PedidoDto.De(pedido, usuario.EhAdministrador);
        }
    }
}

/// <summary>
/// CONSULTA: mostra qual seria a data de entrega, SEM salvar nada.
/// O front pode chamar enquanto o usuário monta o pedido.
/// POST /api/pedidos/simular-entrega   corpo: { "pedidoId": null, "pecas": [ ... ] }  (mesmo formato do POST)
/// (pedidoId preenchido = simulação da edição de um pedido existente)   (somente Administrador)
/// </summary>
public static class SimularEntrega
{
    public record Requisicao(int? PedidoId, List<PecaDados>? Pecas);

    public record Resposta(DateOnly DataEntrega, int ComplexidadeTotal, int CapacidadeDiaria, decimal ValorTotal);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapPost("/simular-entrega", async (Requisicao requisicao, Handler handler, CancellationToken ct) =>
                TypedResults.Ok(await handler.Handle(requisicao, ct)))
            .RequireAuthorization(Politicas.SomenteAdministrador);

    public class Handler(AppDbContext db, AgendaProducao agenda) : IHandler
    {
        public async Task<Resposta> Handle(Requisicao requisicao, CancellationToken ct)
        {
            // A descrição da peça não muda a data, então não é exigida aqui (o usuário ainda está digitando).
            var pecas = await PedidoRegras.MontarPecas(db, requisicao.Pecas, ct, exigirDescricao: false);
            var complexidade = PedidoRegras.CalcularComplexidade(pecas);

            DateOnly data;
            if (requisicao.PedidoId is int pedidoId)
            {
                var pedido = await db.Pedidos.AsNoTracking().FirstOrDefaultAsync(p => p.Id == pedidoId, ct)
                    ?? throw new NaoEncontradoException("Pedido não encontrado.");
                data = await agenda.RecalcularPedidoExistente(pedido, complexidade, ct);
            }
            else
            {
                data = await agenda.CalcularParaNovoPedido(complexidade, ct);
            }

            return new Resposta(data, complexidade, agenda.CapacidadeDiaria, PedidoRegras.CalcularValor(pecas));
        }
    }
}

/// <summary>
/// CONSULTA: quanto da capacidade de cada dia útil já está reservada (útil para o dashboard).
/// GET /api/pedidos/ocupacao?de=2026-10-12&amp;ate=2026-10-31   (padrão: hoje até +30 dias)
/// </summary>
public static class ConsultarOcupacao
{
    public record OcupacaoDiaDto(DateOnly Data, int Complexidade, int Capacidade, int Disponivel);

    public static void Mapear(RouteGroupBuilder grupo) =>
        grupo.MapGet("/ocupacao", (DateOnly? de, DateOnly? ate, Handler handler, CancellationToken ct) =>
            handler.Handle(de, ate, ct));

    public class Handler(AgendaProducao agenda) : IHandler
    {
        public async Task<List<OcupacaoDiaDto>> Handle(DateOnly? de, DateOnly? ate, CancellationToken ct)
        {
            var inicio = de ?? agenda.Hoje();
            var fim = ate ?? inicio.AddDays(30);

            if (fim < inicio)
                throw new RegraNegocioException("A data final deve ser maior que a inicial.");
            if (fim.DayNumber - inicio.DayNumber > 180)
                throw new RegraNegocioException("Consulte no máximo 180 dias por vez.");

            var ocupacao = await agenda.OcupacaoAPartirDe(inicio, 0, ct);
            var capacidade = agenda.CapacidadeDiaria;

            var dias = new List<OcupacaoDiaDto>();
            for (var data = inicio; data <= fim; data = data.AddDays(1))
            {
                if (!CalculadoraDataEntrega.EhDiaUtil(data))
                    continue;

                var usada = ocupacao.GetValueOrDefault(data);
                dias.Add(new OcupacaoDiaDto(data, usada, capacidade, Math.Max(0, capacidade - usada)));
            }
            return dias;
        }
    }
}
