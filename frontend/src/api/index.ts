import type { Api } from './contrato';
import { apiReal } from './apiReal';
import { apiMock } from './mock/apiMock';

/** Defina VITE_USE_MOCK=false no .env.development quando o backend estiver pronto. */
export const usandoMock = import.meta.env.VITE_USE_MOCK === 'true';

export const api: Api = usandoMock ? apiMock : apiReal;
export { ApiError } from './http';
