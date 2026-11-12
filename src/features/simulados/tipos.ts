import type { TipoSimulado } from './config';

export interface ResultadoBloco {
  bloco_id: string;
  nome: string;
  acertos: number;
  total: number;
  em_branco: number;
  pontos: number;
  pontos_max: number;
}

export interface ResultadoSimulado {
  acertos: number;
  total: number;
  em_branco: number;
  pontos: number;
  pontos_max: number;
  nota_minima: number;
  algum_bloco_zerado: boolean;
  aprovado: boolean;
  tempo_seg: number;
  blocos: ResultadoBloco[];
}

export interface Simulado {
  id: string;
  tipo: TipoSimulado;
  status: 'em_andamento' | 'finalizado';
  duracao_seg: number;
  iniciado_em: string;
  finalizado_em: string | null;
  resultado: ResultadoSimulado | null;
}

export interface ItemSimulado {
  ordem: number;
  questao_id: string;
  escolha: number | null;
  marcada: boolean;
}

export interface SimuladoDetalhado extends Simulado {
  itens: ItemSimulado[];
}

/** Segundos restantes de um simulado em andamento. */
export function segundosRestantes(s: Pick<Simulado, 'iniciado_em' | 'duracao_seg'>, agora: Date = new Date()): number {
  const fim = new Date(s.iniciado_em).getTime() + s.duracao_seg * 1000;
  return Math.max(0, Math.floor((fim - agora.getTime()) / 1000));
}

export function formatarDuracao(seg: number): string {
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  const s = seg % 60;
  const dd = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${dd(m)}:${dd(s)}` : `${dd(m)}:${dd(s)}`;
}

/** Normaliza números que o Postgres devolve como texto/decimal. */
export function normalizarResultado(r: unknown): ResultadoSimulado | null {
  if (!r || typeof r !== 'object') return null;
  const x = r as Record<string, unknown>;
  const n = (v: unknown) => Number(v ?? 0);
  return {
    acertos: n(x.acertos), total: n(x.total), em_branco: n(x.em_branco), pontos: n(x.pontos), pontos_max: n(x.pontos_max),
    nota_minima: n(x.nota_minima), algum_bloco_zerado: Boolean(x.algum_bloco_zerado), aprovado: Boolean(x.aprovado), tempo_seg: n(x.tempo_seg),
    blocos: ((x.blocos as Record<string, unknown>[]) ?? []).map((b) => ({
      bloco_id: String(b.bloco_id), nome: String(b.nome), acertos: n(b.acertos), total: n(b.total), em_branco: n(b.em_branco), pontos: n(b.pontos), pontos_max: n(b.pontos_max),
    })),
  };
}
