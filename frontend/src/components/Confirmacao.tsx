import { Modal } from './Modal';

interface Props {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  textoConfirmar: string;
  /** Texto do botão que fecha sem fazer nada (padrão: "Cancelar"). */
  textoVoltar?: string;
  perigo?: boolean;
  carregando?: boolean;
  aoConfirmar(): void;
  aoCancelar(): void;
}

export function Confirmacao({ aberto, titulo, mensagem, textoConfirmar, textoVoltar = 'Cancelar', perigo, carregando, aoConfirmar, aoCancelar }: Props) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button type="button" className="botao botao-secundario" onClick={aoCancelar} disabled={carregando}>{textoVoltar}</button>
          <button type="button" className={`botao ${perigo ? 'botao-perigo' : 'botao-primario'}`} onClick={aoConfirmar} disabled={carregando}>
            {carregando ? 'Aguarde…' : textoConfirmar}
          </button>
        </>
      }
    >
      <p>{mensagem}</p>
    </Modal>
  );
}
