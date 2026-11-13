import { embaralhar, geradorComSemente } from '@/lib/aleatorio';
import { hashQuestao, LETRAS, type NovaQuestao } from '../tipos';

interface QuestaoPacote {
  disciplina: string;
  topico: string | null;
  dificuldade: number;
  enunciado: string;
  alternativas: string[];
  gabarito: string;
  explicacao: string;
  /** Origem da questão (ex.: prova real); se ausente, vale a do pacote. */
  fonte?: string;
  /** Chave de um texto de apoio em `pacote.textos`. */
  texto?: string;
}

export interface TextoPacote {
  titulo: string;
  conteudo: string;
}

/** Questão pronta para o banco; `texto` vira `texto_id` na instalação. */
export type QuestaoPreparada = NovaQuestao & { texto?: TextoPacote };

export interface Pacote {
  id: string;
  nome: string;
  fonte: string;
  /** 'autoral' (padrão) ou 'importada' (questões de provas reais). */
  origem?: 'autoral' | 'importada';
  /** Provas reais mantêm a ordem original das alternativas. */
  embaralhar?: boolean;
  /** Textos de apoio compartilhados por várias questões. */
  textos?: Record<string, TextoPacote>;
  questoes: QuestaoPacote[];
}

/**
 * Converte o pacote para o formato do banco. As alternativas são embaralhadas
 * com semente fixa (o mesmo resultado em qualquer aparelho), para que a letra
 * correta fique bem distribuída entre A, B, C e D.
 */
export function prepararPacote(pacote: Pacote): QuestaoPreparada[] {
  return pacote.questoes.map((q) => {
    const hash = hashQuestao(q.enunciado, q.alternativas);
    const correta = LETRAS.indexOf(q.gabarito as (typeof LETRAS)[number]);
    const indices = q.alternativas.map((_, i) => i);
    const ordem = pacote.embaralhar === false ? indices : embaralhar(indices, geradorComSemente(parseInt(hash.slice(-8), 16)));
    return {
      disciplina_id: q.disciplina,
      topico_id: q.topico,
      enunciado: q.enunciado,
      alternativas: ordem.map((i) => q.alternativas[i]),
      gabarito: ordem.indexOf(correta),
      anulada: false,
      explicacao: q.explicacao,
      origem: pacote.origem ?? 'autoral',
      fonte: q.fonte ?? pacote.fonte,
      numero_original: null,
      dificuldade: q.dificuldade,
      hash,
      ...(q.texto ? { texto: textoDoPacote(pacote, q.texto) } : {}),
    };
  });
}

function textoDoPacote(pacote: Pacote, chave: string): TextoPacote {
  const t = pacote.textos?.[chave];
  if (!t) throw new Error(`Pacote ${pacote.id}: texto "${chave}" não existe`);
  return t;
}

export async function carregarPacotesAutorais(): Promise<Pacote[]> {
  const [v1, municipio, provas, ineditas] = await Promise.all([
    import('./autorais-v1.json'),
    import('./municipio-v1.json'),
    import('./provas-v1.json'),
    import('./ineditas-ibam-v1.json'),
  ]);
  return [v1.default as Pacote, municipio.default as Pacote, provas.default as Pacote, ineditas.default as Pacote];
}
