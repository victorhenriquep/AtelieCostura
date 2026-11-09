import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import { Campo } from '../../components/Campo';
import { Modal } from '../../components/Modal';
import type { CategoriaPagamento, FormaPagamento, Pagamento } from '../../types';
import { hojeIso } from '../../utils/datas';
import { NOME_CATEGORIA, NOME_FORMA, paraNumero, paraTexto } from '../../utils/financeiro';

interface Props {
  aberto: boolean;
  pagamento: Pagamento | null; // null = novo
  aoFechar(): void;
  aoSalvar(pagamento: Pagamento, novo: boolean): void;
}

interface Form { descricao: string; categoria: CategoriaPagamento | ''; data: string; valor: string; formaPagamento: FormaPagamento | ''; observacao: string }
type Erros = Partial<Record<keyof Form, string>>;

const vazio = (): Form => ({ descricao: '', categoria: '', data: hojeIso(), valor: '', formaPagamento: '', observacao: '' });

function validar(f: Form): Erros {
  const erros: Erros = {};
  if (!f.descricao.trim()) erros.descricao = 'Informe a descrição.';
  if (!f.categoria) erros.categoria = 'Escolha a categoria.';
  if (!f.data || f.data > hojeIso()) erros.data = 'Informe uma data de hoje ou anterior.';
  const v = paraNumero(f.valor);
  if (!Number.isFinite(v) || v <= 0) erros.valor = 'Informe um valor maior que zero.';
  if (!f.formaPagamento) erros.formaPagamento = 'Escolha a forma de pagamento.';
  return erros;
}

export function PagamentoFormModal({ aberto, pagamento, aoFechar, aoSalvar }: Props) {
  const [form, setForm] = useState<Form>(vazio);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(pagamento
      ? {
        descricao: pagamento.descricao, categoria: pagamento.categoria, data: pagamento.data, valor: paraTexto(pagamento.valor),
        formaPagamento: pagamento.formaPagamento, observacao: pagamento.observacao,
      }
      : vazio());
    setErros({});
    setErroGeral(null);
  }, [aberto, pagamento]);

  function alterar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validar(form);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const dados = {
      descricao: form.descricao, categoria: form.categoria as CategoriaPagamento, data: form.data, valor: paraNumero(form.valor),
      formaPagamento: form.formaPagamento as FormaPagamento, observacao: form.observacao,
    };
    setSalvando(true);
    setErroGeral(null);
    try {
      const salvo = pagamento ? await api.pagamentos.atualizar(pagamento.id, dados) : await api.pagamentos.criar(dados);
      aoSalvar(salvo, !pagamento);
    } catch (ex) {
      setErroGeral(ex instanceof ApiError ? ex.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      aberto={aberto}
      titulo={pagamento ? 'Editar pagamento' : 'Novo pagamento'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" form="form-pagamento" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-pagamento" className="grade-form" onSubmit={salvar} noValidate>
        <Campo rotulo="Descrição *" erro={erros.descricao} largo>
          <input value={form.descricao} maxLength={150} placeholder="Ex.: linhas e zíperes" autoFocus
            onChange={(e) => alterar('descricao', e.target.value)} />
        </Campo>
        <Campo rotulo="Categoria *" erro={erros.categoria}>
          <select value={form.categoria} onChange={(e) => alterar('categoria', e.target.value as CategoriaPagamento | '')}>
            <option value="">Selecione…</option>
            {(Object.keys(NOME_CATEGORIA) as CategoriaPagamento[]).map((c) => <option key={c} value={c}>{NOME_CATEGORIA[c]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Valor (R$) *" erro={erros.valor}>
          <input value={form.valor} inputMode="decimal" placeholder="0,00" onChange={(e) => alterar('valor', e.target.value)} />
        </Campo>
        <Campo rotulo="Data *" erro={erros.data}>
          <input type="date" value={form.data} max={hojeIso()} onChange={(e) => alterar('data', e.target.value)} />
        </Campo>
        <Campo rotulo="Forma de pagamento *" erro={erros.formaPagamento}>
          <select value={form.formaPagamento} onChange={(e) => alterar('formaPagamento', e.target.value as FormaPagamento | '')}>
            <option value="">Selecione…</option>
            {(Object.keys(NOME_FORMA) as FormaPagamento[]).map((f) => <option key={f} value={f}>{NOME_FORMA[f]}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Observação" largo>
          <input value={form.observacao} maxLength={200} onChange={(e) => alterar('observacao', e.target.value)} />
        </Campo>
        {erroGeral && <p className="mensagem-erro largo" role="alert">{erroGeral}</p>}
      </form>
    </Modal>
  );
}
