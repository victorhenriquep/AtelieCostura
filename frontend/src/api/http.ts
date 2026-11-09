import { obterSessao } from '../auth/sessao';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// O AuthContext registra aqui o que fazer quando o token expira (401).
let aoNaoAutorizado: (() => void) | null = null;
export function definirAoNaoAutorizado(fn: (() => void) | null) {
  aoNaoAutorizado = fn;
}
export function notificarNaoAutorizado() {
  aoNaoAutorizado?.();
}

/** fetch com JSON + token JWT + tratamento de erros padronizado. */
export async function http<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const token = obterSessao()?.token;

  let resposta: Response;
  try {
    resposta = await fetch(BASE_URL + caminho, {
      ...opcoes,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...opcoes.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. O backend está rodando?');
  }

  if (resposta.status === 401) {
    notificarNaoAutorizado();
    throw new ApiError(401, 'Sessão expirada. Faça login novamente.');
  }
  if (resposta.status === 403) {
    throw new ApiError(403, 'Você não tem permissão para esta ação.');
  }
  if (!resposta.ok) {
    let mensagem = 'Ocorreu um erro inesperado.';
    try {
      const corpo = await resposta.json();
      // O backend devolve { mensagem } ou um ProblemDetails ({ title, errors })
      mensagem = corpo.mensagem ?? corpo.title ?? mensagem;
    } catch {
      /* corpo vazio */
    }
    throw new ApiError(resposta.status, mensagem);
  }
  if (resposta.status === 204) return undefined as T;
  return resposta.json() as Promise<T>;
}
