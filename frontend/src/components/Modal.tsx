import { useEffect, type ReactNode } from 'react';
import { IconeFechar } from './Icones';

interface Props {
  titulo: string;
  subtitulo?: string;
  aberto: boolean;
  aoFechar(): void;
  largura?: 'normal' | 'larga';
  children: ReactNode;
  rodape?: ReactNode;
}

export function Modal({ titulo, subtitulo, aberto, aoFechar, largura = 'normal', children, rodape }: Props) {
  // Fecha com ESC
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div className="modal-fundo" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={`modal modal-${largura}`} role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <header className="modal-cabecalho">
          <div>
            <h2 id="modal-titulo">{titulo}</h2>
            {subtitulo && <p className="modal-subtitulo">{subtitulo}</p>}
          </div>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            <IconeFechar />
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape && <footer className="modal-rodape">{rodape}</footer>}
      </div>
    </div>
  );
}
