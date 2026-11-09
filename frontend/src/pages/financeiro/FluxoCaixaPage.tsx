import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../api';
import type { FluxoCaixa } from '../../types';
import { diaSemanaCurto } from '../../utils/datas';
import { NOME_CATEGORIA, NOME_FORMA, mesAtual, nomeDoMes, periodoDoMes } from '../../utils/financeiro';
import { formatarDataSimples, formatarMoeda } from '../../utils/formatos';

export function FluxoCaixaPage() {
  const [mes, setMes] = useState(mesAtual());
  const [fluxo, setFluxo] = useState<FluxoCaixa | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    if (!mes) return;
    setCarregando(true);
    setErro(null);
    try {
      setFluxo(await api.fluxoCaixa(periodoDoMes(mes)));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar o fluxo de caixa.');
    } finally {
      setCarregando(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resultado = fluxo ? fluxo.totalEntradas - fluxo.totalSaidas : 0;
  const valor = (v: number | undefined) => (fluxo && v !== undefined ? formatarMoeda(v) : '–');

  return (
    <>
      <header className="pagina-cabecalho">
        <div>
          <h1>Fluxo de caixa</h1>
        </div>
      </header>

      <div className="filtros">
        <label className="seletor">
          <span>Mês</span>
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} aria-label="Mês" />
        </label>
      </div>

      {erro && <p className="mensagem-erro">{erro}</p>}

      <section className="kpis" aria-label={`Resumo de ${mes ? nomeDoMes(mes) : ''}`}>
        <div className="kpi">
          <span className="kpi-rotulo">Saldo inicial</span>
          <strong className="kpi-valor">{valor(fluxo?.saldoInicial)}</strong>
          <span className="texto-pequeno texto-suave">antes de {fluxo ? formatarDataSimples(fluxo.de) : '—'}</span>
        </div>
        <div className="kpi kpi-entrada">
          <span className="kpi-rotulo">Entradas</span>
          <strong className="kpi-valor">{valor(fluxo?.totalEntradas)}</strong>
          <span className="texto-pequeno texto-suave">recebimentos de pedidos</span>
        </div>
        <div className="kpi kpi-saida">
          <span className="kpi-rotulo">Saídas</span>
          <strong className="kpi-valor">{valor(fluxo?.totalSaidas)}</strong>
          <span className="texto-pequeno texto-suave">pagamentos</span>
        </div>
        <div className={`kpi ${fluxo && fluxo.saldoFinal < 0 ? 'kpi-alerta' : ''}`}>
          <span className="kpi-rotulo">Saldo final</span>
          <strong className="kpi-valor">{valor(fluxo?.saldoFinal)}</strong>
          <span className={`texto-pequeno ${resultado < 0 ? 'valor-negativo' : 'texto-suave'}`}>
            {fluxo ? `resultado do mês ${resultado >= 0 ? '+' : '−'}${formatarMoeda(Math.abs(resultado))}` : ''}
          </span>
        </div>
      </section>

      <div className="painel-grade">
        <section className="cartao painel-bloco">
          <header className="bloco-cabecalho">
            <h2>Movimento por dia</h2>
          </header>
          {carregando && !fluxo && <p className="texto-suave">Carregando…</p>}
          {fluxo && fluxo.dias.length === 0 && <p className="texto-suave">Nenhuma entrada ou saída neste mês.</p>}
          {fluxo && fluxo.dias.length > 0 && (
            <div className="tabela-rolagem">
              <table className="tabela tabela-compacta">
                <thead>
                  <tr>
                    <th>Dia</th>
                    <th className="num">Entradas</th>
                    <th className="num">Saídas</th>
                    <th className="num ocultar-mobile">Saldo do dia</th>
                    <th className="num">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {fluxo.dias.map((d) => (
                    <tr key={d.data}>
                      <td className="sem-quebra">{diaSemanaCurto(d.data)}, {formatarDataSimples(d.data)}</td>
                      <td className="num sem-quebra valor-positivo">{d.entradas ? formatarMoeda(d.entradas) : <span className="texto-suave">—</span>}</td>
                      <td className="num sem-quebra valor-negativo">{d.saidas ? formatarMoeda(d.saidas) : <span className="texto-suave">—</span>}</td>
                      <td className="num sem-quebra ocultar-mobile">{formatarMoeda(d.saldoDoDia)}</td>
                      <td className={`num sem-quebra ${d.saldoAcumulado < 0 ? 'valor-negativo' : ''}`}><strong>{formatarMoeda(d.saldoAcumulado)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cartao painel-bloco">
          <header className="bloco-cabecalho">
            <h2>Entradas por forma</h2>
          </header>
          {fluxo && fluxo.entradasPorForma.length === 0 && <p className="texto-suave texto-pequeno">Nenhuma entrada.</p>}
          <ul className="totais-lista totais-coluna">
            {(fluxo?.entradasPorForma ?? []).map((t) => (
              <li key={t.forma}><span>{NOME_FORMA[t.forma]}</span><strong>{formatarMoeda(t.total)}</strong></li>
            ))}
          </ul>

          <header className="bloco-cabecalho bloco-separado">
            <h2>Saídas por categoria</h2>
          </header>
          {fluxo && fluxo.saidasPorCategoria.length === 0 && <p className="texto-suave texto-pequeno">Nenhuma saída.</p>}
          <ul className="totais-lista totais-coluna">
            {(fluxo?.saidasPorCategoria ?? []).map((t) => (
              <li key={t.categoria}><span>{NOME_CATEGORIA[t.categoria]}</span><strong>{formatarMoeda(t.total)}</strong></li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
