import { useState } from 'react';
import type { OcupacaoDia } from '../types';
import { diaMes, diaSemanaCurto, hojeIso } from '../utils/datas';

interface Props {
  dias: OcupacaoDia[];
}

/**
 * Gráfico de barras: quanto da capacidade de cada dia útil já está reservado.
 * Uma única série (complexidade reservada) comparada com o limite do dia.
 * Passe o mouse (ou use Tab) sobre uma barra para ver os números.
 */
export function OcupacaoGrafico({ dias }: Props) {
  const [ativo, setAtivo] = useState<number | null>(null);
  const hoje = hojeIso();

  if (dias.length === 0) return <p className="texto-suave">Sem dias para mostrar.</p>;

  return (
    <figure className="grafico-ocupacao">
      <div className="grafico-area" onMouseLeave={() => setAtivo(null)}>
        {/* Linhas de referência: limite do dia e metade */}
        <div className="grafico-guia guia-limite"><span>Limite {dias[0].capacidade}</span></div>
        <div className="grafico-guia guia-metade"><span>{dias[0].capacidade / 2}</span></div>

        {dias.map((d, i) => {
          const percentual = Math.min(100, (d.complexidade / d.capacidade) * 100);
          const lotado = d.disponivel === 0;
          const rotulo = `${diaSemanaCurto(d.data)}, ${diaMes(d.data)}: ${d.complexidade} de ${d.capacidade} reservados, ${d.disponivel} livres`;
          return (
            <div
              key={d.data}
              className={`grafico-coluna ${ativo === i ? 'ativa' : ''}`}
              tabIndex={0}
              aria-label={rotulo}
              onMouseEnter={() => setAtivo(i)}
              onFocus={() => setAtivo(i)}
              onBlur={() => setAtivo(null)}
            >
              {lotado && <span className="grafico-rotulo-lotado">Lotado</span>}
              <span className={`grafico-barra ${d.complexidade === 0 ? 'vazia' : ''}`} style={{ height: `${percentual}%` }} />
              {ativo === i && (
                <span className={`grafico-dica ${i >= dias.length - 3 ? 'dica-esquerda' : ''}`} role="tooltip">
                  <strong>{diaSemanaCurto(d.data)}, {diaMes(d.data)}</strong>
                  <span>{d.complexidade} de {d.capacidade} reservados</span>
                  <span className="texto-suave">{lotado ? 'Sem espaço' : `${d.disponivel} livres`}</span>
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="grafico-eixo" aria-hidden="true">
        {dias.map((d) => (
          <span key={d.data} className={d.data === hoje ? 'hoje' : ''}>
            <span className="eixo-dia">{diaSemanaCurto(d.data)}</span>
            <span className="eixo-data">{diaMes(d.data)}</span>
          </span>
        ))}
      </div>

      {/* Mesmos dados em tabela, para leitores de tela */}
      <table className="sr-only">
        <caption>Ocupação da produção por dia</caption>
        <thead><tr><th>Dia</th><th>Reservado</th><th>Livre</th></tr></thead>
        <tbody>
          {dias.map((d) => (
            <tr key={d.data}><td>{diaMes(d.data)}</td><td>{d.complexidade}</td><td>{d.disponivel}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
