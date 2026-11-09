import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import { Campo } from '../../components/Campo';
import { Modal } from '../../components/Modal';
import type { FormaPagamento, PedidoAReceber, Recebimento } from '../../types';
import { hojeIso } from '../../utils/datas';
import { NOME_FORMA, paraNumero, paraTexto } from '../../utils/financeiro';
import { formatarDataSimples, formatarMoeda } from '../../utils/formatos';

interface Props {
  aberto: boolean;
  /** Pedido já escolhido (vindo da tela de pedidos). Sem ele, o usuário escolhe na lista. */
  pedidoId?: number | null;
  aoFechar(): void;
  aoSalvar(recebimento: Recebimento): void;
}

export function RecebimentoFormModal({ aberto, pedidoId, aoFechar, aoSalvar }: Props) {
  const [pedidos, setPedidos] = useState<PedidoAReceber[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [escolhido, setEscolhido] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(hojeIso());
  const [forma, setForma] = useState<FormaPagamento | ''>('');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setData(hojeIso());
    setForma('');
    setObservacao('');
    api.recebimentos.pedidosAReceber()
      .then((lista) => {
        if (cancelado) return;
        setPedidos(lista);
        const inicial = pedidoId ? lista.find((p) => p.id === pedidoId) : undefined;
        setEscolhido(inicial ? String(inicial.id) : '');
        setValor(inicial ? paraTexto(inicial.saldo) : '');
        if (pedidoId && !inicial) setErro('Este pedido não tem saldo a receber.');
      })
      .catch((ex) => !cancelado && setErro(ex instanceof ApiError ? ex.message : 'Erro ao carregar os pedidos.'))
      .finally(() => !cancelado && setCarregando(false));
    return () => {
      cancelado = true;
    };
  }, [aberto, pedidoId]);

  const pedido = useMemo(() => pedidos.find((p) => p.id === Number(escolhido)), [pedidos, escolhido]);

  function escolher(id: string) {
    setEscolhido(id);
    const p = pedidos.find((x) => x.id === Number(id));
    setValor(p ? paraTexto(p.saldo) : '');
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const v = paraNumero(valor);
    if (!pedido) return setErro('Selecione o pedido.');
    if (!Number.isFinite(v) || v <= 0) return setErro('Informe um valor maior que zero.');
    if (v > pedido.saldo + 0.001) return setErro(`O valor passa do saldo do pedido (${formatarMoeda(pedido.saldo)}).`);
    if (!data || data > hojeIso()) return setErro('Informe uma data de hoje ou anterior.');
    if (!forma) return setErro('Escolha a forma de pagamento.');

    setSalvando(true);
    setErro(null);
    try {
      aoSalvar(await api.recebimentos.registrar({ pedidoId: pedido.id, data, valor: v, formaPagamento: forma, observacao }));
    } catch (ex) {
      setErro(ex instanceof ApiError ? ex.message : 'Não foi possível registrar o recebimento.');
    } finally {
      setSalvando(false);
    }
  }

  const restante = pedido ? pedido.saldo - (paraNumero(valor) || 0) : 0;

  return (
    <Modal
      aberto={aberto}
      titulo="Registrar recebimento"
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" form="form-recebimento" className="botao botao-primario" disabled={salvando || carregando || !pedido}>
            {salvando ? 'Salvando…' : 'Registrar'}
          </button>
        </>
      }
    >
      {carregando ? (
        <p className="texto-suave">Carregando…</p>
      ) : (
        <form id="form-recebimento" className="grade-form" onSubmit={salvar} noValidate>
          <Campo rotulo="Pedido *" largo>
            <select value={escolhido} onChange={(e) => escolher(e.target.value)} disabled={!!pedidoId} autoFocus={!pedidoId}>
              <option value="">{pedidos.length ? 'Selecione…' : 'Nenhum pedido com saldo a receber'}</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.id}>
                  #{p.id} · {p.clienteNome} · entrega {formatarDataSimples(p.dataEntrega)} · saldo {formatarMoeda(p.saldo)}
                </option>
              ))}
            </select>
          </Campo>

          {pedido && (
            <dl className="resumo-recebimento largo">
              <div><dt>Valor do pedido</dt><dd>{formatarMoeda(pedido.valorTotal)}</dd></div>
              <div><dt>Já recebido</dt><dd>{formatarMoeda(pedido.valorRecebido)}</dd></div>
              <div><dt>Saldo</dt><dd><strong>{formatarMoeda(pedido.saldo)}</strong></dd></div>
            </dl>
          )}

          <Campo rotulo="Valor (R$) *" dica={pedido && restante > 0.004 ? `Fica faltando ${formatarMoeda(restante)}.` : undefined}>
            <input value={valor} inputMode="decimal" placeholder="0,00" onChange={(e) => { setValor(e.target.value); setErro(null); }} autoFocus={!!pedidoId} />
          </Campo>
          <Campo rotulo="Data *">
            <input type="date" value={data} max={hojeIso()} onChange={(e) => setData(e.target.value)} />
          </Campo>
          <Campo rotulo="Forma de pagamento *" largo>
            <select value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>
              <option value="">Selecione…</option>
              {(Object.keys(NOME_FORMA) as FormaPagamento[]).map((f) => <option key={f} value={f}>{NOME_FORMA[f]}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Observação" largo>
            <input value={observacao} maxLength={200} placeholder="Ex.: sinal, restante na retirada" onChange={(e) => setObservacao(e.target.value)} />
          </Campo>
          {erro && <p className="mensagem-erro largo" role="alert">{erro}</p>}
        </form>
      )}
    </Modal>
  );
}
