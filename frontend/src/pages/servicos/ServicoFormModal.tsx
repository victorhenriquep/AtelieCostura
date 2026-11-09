import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError } from '../../api';
import { Campo } from '../../components/Campo';
import { Modal } from '../../components/Modal';
import type { Servico } from '../../types';

interface Props {
  aberto: boolean;
  servico: Servico | null; // null = novo
  aoFechar(): void;
  aoSalvar(servico: Servico, novo: boolean): void;
}

const CAPACIDADE_DIARIA = 100;

// No formulário os números ficam como texto, para o usuário poder apagar e digitar livremente.
interface Form { nome: string; descricao: string; preco: string; complexidade: string }
const VAZIO: Form = { nome: '', descricao: '', preco: '', complexidade: '' };
type Erros = Partial<Record<keyof Form, string>>;

const paraNumero = (v: string) => Number(v.replace(',', '.'));

function validar(f: Form): Erros {
  const erros: Erros = {};
  if (!f.nome.trim()) erros.nome = 'Informe o nome.';
  const preco = paraNumero(f.preco);
  if (f.preco.trim() === '' || !Number.isFinite(preco) || preco < 0) erros.preco = 'Informe um preço válido.';
  const c = Number(f.complexidade);
  if (!Number.isInteger(c) || c < 1 || c > CAPACIDADE_DIARIA) erros.complexidade = `Informe um número de 1 a ${CAPACIDADE_DIARIA}.`;
  return erros;
}

export function ServicoFormModal({ aberto, servico, aoFechar, aoSalvar }: Props) {
  const [form, setForm] = useState<Form>(VAZIO);
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm(servico
      ? { nome: servico.nome, descricao: servico.descricao, preco: servico.preco.toFixed(2).replace('.', ','), complexidade: String(servico.complexidade) }
      : VAZIO);
    setErros({});
    setErroGeral(null);
  }, [aberto, servico]);

  function alterar(campo: keyof Form, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (erros[campo]) setErros((e) => ({ ...e, [campo]: undefined }));
  }

  async function salvar(e: FormEvent) {
    e.preventDefault();
    const encontrados = validar(form);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    const dados = { nome: form.nome, descricao: form.descricao, preco: paraNumero(form.preco), complexidade: Number(form.complexidade) };
    setSalvando(true);
    setErroGeral(null);
    try {
      const salvo = servico ? await api.servicos.atualizar(servico.id, dados) : await api.servicos.criar(dados);
      aoSalvar(salvo, !servico);
    } catch (ex) {
      setErroGeral(ex instanceof ApiError ? ex.message : 'Não foi possível salvar.');
    } finally {
      setSalvando(false);
    }
  }

  const complexidade = Number(form.complexidade);
  const pecasPorDia = Number.isInteger(complexidade) && complexidade > 0 ? Math.floor(CAPACIDADE_DIARIA / complexidade) : null;

  return (
    <Modal
      aberto={aberto}
      titulo={servico ? 'Editar serviço' : 'Novo serviço'}
      aoFechar={aoFechar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoFechar} disabled={salvando}>Cancelar</button>
          <button type="submit" form="form-servico" className="botao botao-primario" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </>
      }
    >
      <form id="form-servico" className="grade-form" onSubmit={salvar} noValidate>
        <Campo rotulo="Nome *" erro={erros.nome} largo>
          <input value={form.nome} onChange={(e) => alterar('nome', e.target.value)} maxLength={100} autoFocus />
        </Campo>
        <Campo rotulo="Descrição" largo>
          <textarea rows={2} value={form.descricao} onChange={(e) => alterar('descricao', e.target.value)} maxLength={500} />
        </Campo>
        <Campo rotulo="Preço (R$) *" erro={erros.preco}>
          <input value={form.preco} inputMode="decimal" placeholder="0,00" onChange={(e) => alterar('preco', e.target.value)} />
        </Campo>
        <Campo
          rotulo="Complexidade *"
          erro={erros.complexidade}
          dica={pecasPorDia ? `Cabem até ${pecasPorDia} peça(s) por dia (limite ${CAPACIDADE_DIARIA}).` : `De 1 a ${CAPACIDADE_DIARIA} por peça.`}
        >
          <input value={form.complexidade} inputMode="numeric" placeholder="Ex.: 15"
            onChange={(e) => alterar('complexidade', e.target.value.replace(/\D/g, '').slice(0, 3))} />
        </Campo>
        {erroGeral && <p className="mensagem-erro largo" role="alert">{erroGeral}</p>}
      </form>
    </Modal>
  );
}
