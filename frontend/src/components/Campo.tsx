import type { ReactNode } from 'react';

interface Props {
  rotulo: string;
  erro?: string;
  dica?: string;
  largo?: boolean;
  children: ReactNode;
}

/** Rótulo + campo + mensagem de erro/dica. Usado em todos os formulários. */
export function Campo({ rotulo, erro, dica, largo, children }: Props) {
  return (
    <label className={`campo ${largo ? 'largo' : ''} ${erro ? 'com-erro' : ''}`}>
      <span>{rotulo}</span>
      {children}
      {erro ? <small className="erro-campo">{erro}</small> : dica && <small className="dica-campo">{dica}</small>}
    </label>
  );
}
