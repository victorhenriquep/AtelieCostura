/**
 * Datas "puras" no formato do backend ("2026-10-14"), sem horário.
 * Trabalhar com texto evita o erro clássico de o fuso horário mudar o dia.
 */

export function isoLocal(d: Date) {
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function hojeIso() {
  return isoLocal(new Date());
}

/** Converte "2026-10-14" em Date ao meio-dia local (seguro contra fuso). */
export function deIso(iso: string) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, 12);
}

export function adicionarDias(iso: string, dias: number) {
  const d = deIso(iso);
  d.setDate(d.getDate() + dias);
  return isoLocal(d);
}

export function ehDiaUtil(iso: string) {
  const dia = deIso(iso).getDay();
  return dia !== 0 && dia !== 6;
}

export function proximoDiaUtil(iso: string) {
  let d = adicionarDias(iso, 1);
  while (!ehDiaUtil(d)) d = adicionarDias(d, 1);
  return d;
}

export function adicionarDiasUteis(iso: string, dias: number) {
  let d = iso;
  for (let i = 0; i < dias; i++) d = proximoDiaUtil(d);
  return d;
}

/** "qua" */
export function diaSemanaCurto(iso: string) {
  return deIso(iso).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

/** "14/10" */
export function diaMes(iso: string) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diasEntre(a: string, b: string) {
  return Math.round((deIso(b).getTime() - deIso(a).getTime()) / 86_400_000);
}
