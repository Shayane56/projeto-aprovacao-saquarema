import { hashTexto } from '@/lib/aleatorio';

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const;
export const letra = (i: number | null | undefined) => (i === null || i === undefined ? '—' : LETRAS[i] ?? '?');

export type OrigemQuestao = 'autoral' | 'importada' | 'manual' | 'ia';

export interface Questao {
  id: string;
  disciplina_id: string;
  topico_id: string | null;
  texto_id: string | null;
  enunciado: string;
  alternativas: string[];
  gabarito: number | null;
  anulada: boolean;
  explicacao: string | null;
  origem: OrigemQuestao;
  fonte: string | null;
  numero_original: number | null;
  dificuldade: number | null;
  criado_em: string;
  /** Impressão digital do conteúdo (enunciado + alternativas); identifica a questão sem duplicar. */
  hash?: string;
}

/** Dados para criar uma questão (o banco preenche id, dono e data). */
export type NovaQuestao = Omit<Questao, 'id' | 'criado_em' | 'texto_id'> & { texto_id?: string | null; hash: string };

export interface TextoApoio {
  id: string;
  titulo: string | null;
  conteudo: string;
}

export type OrigemResposta = 'treino' | 'simulado' | 'erros';

export interface Resposta {
  questao_id: string;
  escolha: number | null;
  correta: boolean;
  origem: OrigemResposta;
  respondida_em: string;
}

export type MotivoErro = 'nao_sabia' | 'confundi' | 'desatencao' | 'interpretacao' | 'chute' | 'tempo';

export const MOTIVOS: { valor: MotivoErro; rotulo: string }[] = [
  { valor: 'nao_sabia', rotulo: 'Não sabia o conteúdo' },
  { valor: 'confundi', rotulo: 'Confundi conceitos' },
  { valor: 'desatencao', rotulo: 'Falta de atenção' },
  { valor: 'interpretacao', rotulo: 'Erro de interpretação' },
  { valor: 'chute', rotulo: 'Chutei' },
  { valor: 'tempo', rotulo: 'Faltou tempo' },
];
export const rotuloMotivo = (m: MotivoErro | null) => MOTIVOS.find((x) => x.valor === m)?.rotulo ?? 'Sem motivo';

export interface ItemCaderno {
  questao_id: string;
  ultima_escolha: number | null;
  vezes_errada: number;
  acertos_seguidos: number;
  resolvido: boolean;
  motivo: MotivoErro | null;
  anotacao: string | null;
  ultimo_erro_em: string;
}

/** Questão pode ser usada para treino/simulado (tem gabarito e não foi anulada). */
export const questaoValida = (q: Questao) => !q.anulada && q.gabarito !== null && q.gabarito < q.alternativas.length;

/** Texto normalizado para identificar questões repetidas na importação. */
export function hashQuestao(enunciado: string, alternativas: string[]): string {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return hashTexto([enunciado, ...alternativas].map(norm).join('|'));
}
