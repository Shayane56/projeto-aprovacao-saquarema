import { config } from './config';

const DIA_MS = 86_400_000;

/** Data civil (AAAA-MM-DD) no fuso de Brasília. */
export function dataLocal(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: config.fusoHorario, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

/** Dias inteiros entre duas datas civis AAAA-MM-DD (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DIA_MS);
}

export interface Contagem {
  dias: number;
  horas: number;
  minutos: number;
  /** Dias de calendário até a data da prova (0 = é hoje). */
  diasCalendario: number;
  encerrada: boolean;
}

export function contagemAte(alvo: Date, agora: Date = new Date()): Contagem {
  const ms = alvo.getTime() - agora.getTime();
  const diasCalendario = diasEntre(dataLocal(agora), dataLocal(alvo));
  if (ms <= 0) return { dias: 0, horas: 0, minutos: 0, diasCalendario, encerrada: true };
  return {
    dias: Math.floor(ms / DIA_MS),
    horas: Math.floor((ms % DIA_MS) / 3_600_000),
    minutos: Math.floor((ms % 3_600_000) / 60_000),
    diasCalendario,
    encerrada: false,
  };
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', ...opts });

/** "17/11" ou "17/11/2026" a partir de AAAA-MM-DD. */
export function dataCurta(iso: string, comAno = false): string {
  return fmt({ day: '2-digit', month: '2-digit', ...(comAno ? { year: 'numeric' } : {}) }).format(new Date(`${iso}T00:00:00Z`));
}

/** "segunda-feira, 17 de novembro de 2026". */
export function dataPorExtenso(iso: string): string {
  return fmt({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${iso}T00:00:00Z`));
}

/** "17 nov" */
export function diaMes(iso: string): { dia: string; mes: string } {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    dia: fmt({ day: '2-digit' }).format(d),
    mes: fmt({ month: 'short' }).format(d).replace('.', ''),
  };
}

export function horaLocal(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: config.fusoHorario, hour: '2-digit', minute: '2-digit' }).format(d);
}

export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

export const maiuscula = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
