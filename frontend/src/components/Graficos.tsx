import { useState } from 'react';

// Gráficos simples em HTML/SVG, sem biblioteca externa. Todos mostram os valores ao passar o mouse
// (ou com Tab) e têm uma tabela escondida para leitores de tela.

// ---------------- Barras horizontais (uma série) ----------------

interface ItemBarra { rotulo: string; valor: number; detalhe?: string }

export function GraficoBarras({ itens, formatar, vazio = 'Sem dados no período.' }: {
  itens: ItemBarra[];
  formatar(v: number): string;
  vazio?: string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  if (itens.length === 0) return <p className="texto-suave texto-pequeno">{vazio}</p>;
  const maximo = Math.max(...itens.map((i) => i.valor), 0) || 1;

  return (
    <figure className="grafico-barras" onMouseLeave={() => setAtivo(null)}>
      {itens.map((item, i) => (
        <div key={item.rotulo} className={`barra-linha ${ativo === i ? 'ativa' : ''}`} tabIndex={0}
          aria-label={`${item.rotulo}: ${formatar(item.valor)}${item.detalhe ? `, ${item.detalhe}` : ''}`}
          onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)}>
          <span className="barra-rotulo" title={item.rotulo}>{item.rotulo}</span>
          <span className="barra-trilho">
            <span className="barra-preenchida" style={{ width: `calc((100% - 96px) * ${Math.max(0.01, item.valor / maximo)})` }} />
            <span className="barra-valor">{formatar(item.valor)}</span>
          </span>
          {ativo === i && item.detalhe && <span className="grafico-dica barra-dica" role="tooltip">{item.detalhe}</span>}
        </div>
      ))}
      <table className="sr-only">
        <tbody>{itens.map((i) => <tr key={i.rotulo}><td>{i.rotulo}</td><td>{formatar(i.valor)}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// ---------------- Linha (uma série) com linha de referência ----------------

interface PontoLinha { rotulo: string; valor: number; detalhe: string }

const L = 420, A = 210, ESQ = 38, DIR = 12, TOPO = 18, BASE = 28;

export function GraficoLinha({ pontos, referencia, rotuloReferencia, formatar }: {
  pontos: PontoLinha[];
  referencia: number;
  rotuloReferencia: string;
  formatar(v: number): string;
}) {
  const [ativo, setAtivo] = useState<number | null>(null);
  if (pontos.length === 0) return <p className="texto-suave texto-pequeno">Sem dados no período.</p>;

  const topoEscala = Math.max(referencia, ...pontos.map((p) => p.valor)) * 1.1;
  const passo = topoEscala > 150 ? 50 : 25;
  const marcas = Array.from({ length: Math.floor(topoEscala / passo) + 1 }, (_, i) => i * passo);
  const x = (i: number) => (pontos.length === 1 ? (ESQ + L - DIR) / 2 : ESQ + (i * (L - ESQ - DIR)) / (pontos.length - 1));
  const y = (v: number) => TOPO + (A - TOPO - BASE) * (1 - v / topoEscala);
  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join('');
  const area = `${caminho}L${x(pontos.length - 1)},${y(0)}L${x(0)},${y(0)}Z`;
  const cadaQuantos = Math.ceil(pontos.length / 6); // no máximo ~6 datas no eixo
  const ultimo = pontos.length - 1;

  return (
    <figure className="grafico-linha" onMouseLeave={() => setAtivo(null)}>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label="Gráfico de linhas">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={ESQ} x2={L - DIR} y1={y(m)} y2={y(m)} className="linha-grade" />
            <text x={ESQ - 8} y={y(m) + 4} textAnchor="end" className="linha-eixo">{formatar(m)}</text>
          </g>
        ))}
        <line x1={ESQ} x2={L - DIR} y1={y(referencia)} y2={y(referencia)} className="linha-referencia" />
        <text x={L - DIR} y={y(referencia) - 6} textAnchor="end" className="linha-eixo">{rotuloReferencia}</text>

        <path d={area} className="linha-area" />
        <path d={caminho} className="linha-serie" />

        {ativo !== null && <line x1={x(ativo)} x2={x(ativo)} y1={TOPO} y2={y(0)} className="linha-mira" />}
        {pontos.map((p, i) => (
          <circle key={p.rotulo} cx={x(i)} cy={y(p.valor)} r={ativo === i ? 5.5 : 4} className="linha-ponto" />
        ))}
        <text x={x(ultimo)} y={y(pontos[ultimo].valor) - 10} textAnchor={pontos.length > 1 ? 'end' : 'middle'} className="linha-valor">
          {formatar(pontos[ultimo].valor)}
        </text>

        {pontos.map((p, i) => (i % cadaQuantos === 0 || i === ultimo) && (
          <text key={p.rotulo} x={x(i)} y={A - 8} textAnchor="middle" className="linha-eixo">{p.rotulo}</text>
        ))}

        {/* Faixas invisíveis para o mouse, maiores que os pontos */}
        {pontos.map((p, i) => {
          const meio = (L - ESQ - DIR) / Math.max(1, pontos.length - 1) / 2;
          return (
            <rect key={p.rotulo} x={x(i) - meio} y={TOPO} width={meio * 2} height={A - TOPO - BASE} fill="transparent"
              tabIndex={0} aria-label={`${p.rotulo}: ${p.detalhe}`}
              onMouseEnter={() => setAtivo(i)} onFocus={() => setAtivo(i)} onBlur={() => setAtivo(null)} />
          );
        })}
      </svg>
      {ativo !== null && (
        <span className="grafico-dica linha-dica" role="tooltip"
          style={{ left: `${(x(ativo) / L) * 100}%`, transform: `translateX(${ativo > ultimo / 2 ? '-100%' : '0'})` }}>
          <strong>{pontos[ativo].rotulo}</strong>
          <span>{pontos[ativo].detalhe}</span>
        </span>
      )}
      <table className="sr-only">
        <tbody>{pontos.map((p) => <tr key={p.rotulo}><td>{p.rotulo}</td><td>{p.detalhe}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

// ---------------- Pizza (rosca), poucas fatias ----------------

interface Fatia { rotulo: string; valor: number; cor: string }

export function GraficoPizza({ fatias, centro, legendaCentro }: { fatias: Fatia[]; centro: string; legendaCentro: string }) {
  const total = fatias.reduce((t, f) => t + f.valor, 0);
  if (total === 0) return <p className="texto-suave texto-pequeno">Sem pedidos no período.</p>;

  const raio = 60, espessura = 22, circ = 2 * Math.PI * raio, folga = fatias.filter((f) => f.valor > 0).length > 1 ? 2 : 0;
  let acumulado = 0;

  return (
    <figure className="grafico-pizza">
      <svg viewBox="0 0 160 160" role="img" aria-label={`${centro} ${legendaCentro}`}>
        <g transform="rotate(-90 80 80)">
          {fatias.filter((f) => f.valor > 0).map((f) => {
            const tamanho = (f.valor / total) * circ;
            const el = (
              <circle key={f.rotulo} cx="80" cy="80" r={raio} fill="none" stroke={f.cor} strokeWidth={espessura}
                strokeDasharray={`${Math.max(0, tamanho - folga)} ${circ}`} strokeDashoffset={-acumulado}>
                <title>{`${f.rotulo}: ${f.valor}`}</title>
              </circle>
            );
            acumulado += tamanho;
            return el;
          })}
        </g>
        <text x="80" y="80" textAnchor="middle" className="pizza-centro">{centro}</text>
        <text x="80" y="98" textAnchor="middle" className="pizza-legenda-centro">{legendaCentro}</text>
      </svg>
      <ul className="pizza-legenda">
        {fatias.map((f) => (
          <li key={f.rotulo}>
            <span className="pizza-amostra" style={{ background: f.cor }} aria-hidden="true" />
            <span>{f.rotulo}</span>
            <strong>{f.valor}</strong>
            <span className="texto-suave">{Math.round((f.valor / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
