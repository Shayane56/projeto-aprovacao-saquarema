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
}

export interface Pacote {
  id: string;
  nome: string;
  fonte: string;
  questoes: QuestaoPacote[];
}

/**
 * Converte o pacote para o formato do banco. As alternativas são embaralhadas
 * com semente fixa (o mesmo resultado em qualquer aparelho), para que a letra
 * correta fique bem distribuída entre A, B, C e D.
 */
export function prepararPacote(pacote: Pacote): NovaQuestao[] {
  return pacote.questoes.map((q) => {
    const hash = hashQuestao(q.enunciado, q.alternativas);
    const correta = LETRAS.indexOf(q.gabarito as (typeof LETRAS)[number]);
    const ordem = embaralhar(q.alternativas.map((_, i) => i), geradorComSemente(parseInt(hash.slice(-8), 16)));
    return {
      disciplina_id: q.disciplina,
      topico_id: q.topico,
      enunciado: q.enunciado,
      alternativas: ordem.map((i) => q.alternativas[i]),
      gabarito: ordem.indexOf(correta),
      anulada: false,
      explicacao: q.explicacao,
      origem: 'autoral',
      fonte: pacote.fonte,
      numero_original: null,
      dificuldade: q.dificuldade,
      hash,
    };
  });
}

export async function carregarPacotesAutorais(): Promise<Pacote[]> {
  const v1 = await import('./autorais-v1.json');
  return [v1.default as Pacote];
}
