import { exigir, supabase } from '@/lib/supabase';
import type { ItemCaderno, MotivoErro, NovaQuestao, OrigemResposta, Questao, Resposta, TextoApoio } from './tipos';

const PAGINA = 1000; // limite padrão de linhas por requisição no Supabase

/** Busca todas as linhas, página por página. */
async function buscarTudo<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const tudo: T[] = [];
  for (let de = 0; ; de += PAGINA) {
    const lote = exigir(await consulta(de, de + PAGINA - 1));
    tudo.push(...lote);
    if (lote.length < PAGINA) return tudo;
  }
}

const COLUNAS_QUESTAO =
  'id, disciplina_id, topico_id, texto_id, enunciado, alternativas, gabarito, anulada, explicacao, origem, fonte, numero_original, dificuldade, criado_em, hash';

export const buscarQuestoes = () =>
  buscarTudo<Questao>((de, ate) => supabase.from('questoes').select(COLUNAS_QUESTAO).order('criado_em').order('id').range(de, ate));

export const buscarTextos = () =>
  buscarTudo<TextoApoio>((de, ate) => supabase.from('textos_apoio').select('id, titulo, conteudo').order('criado_em').range(de, ate));

export const buscarRespostas = () =>
  buscarTudo<Resposta>((de, ate) =>
    supabase.from('respostas').select('questao_id, escolha, correta, origem, respondida_em').order('id').range(de, ate),
  );

export interface Responder {
  userId: string;
  questaoId: string;
  escolha: number;
  tempoSeg: number;
  origem: OrigemResposta;
  respondidaEm: string;
}

export async function responder(v: Responder): Promise<void> {
  exigir(
    await supabase.from('respostas').insert({
      user_id: v.userId, questao_id: v.questaoId, escolha: v.escolha, tempo_seg: v.tempoSeg, origem: v.origem, respondida_em: v.respondidaEm,
    }),
  );
}

/** Insere questões ignorando as que já existem (mesmo hash). Devolve quantas eram novas. */
export async function inserirQuestoes(userId: string, questoes: NovaQuestao[]): Promise<number> {
  let novas = 0;
  for (let i = 0; i < questoes.length; i += 200) {
    const lote = questoes.slice(i, i + 200).map((q) => ({ ...q, user_id: userId }));
    const inseridas = exigir(
      await supabase.from('questoes').upsert(lote, { onConflict: 'user_id,hash', ignoreDuplicates: true }).select('id'),
    );
    novas += inseridas.length;
  }
  return novas;
}

export async function criarTexto(userId: string, titulo: string | null, conteudo: string): Promise<string> {
  const r = exigir<{ id: string }>(await supabase.from('textos_apoio').insert({ user_id: userId, titulo, conteudo }).select('id').single());
  return r.id;
}

export async function atualizarQuestao(id: string, dados: Partial<Omit<Questao, 'id' | 'criado_em'>>): Promise<void> {
  exigir(await supabase.from('questoes').update(dados).eq('id', id));
}

export async function excluirQuestao(id: string): Promise<void> {
  exigir(await supabase.from('questoes').delete().eq('id', id));
}

export const buscarCaderno = () =>
  buscarTudo<ItemCaderno>((de, ate) =>
    supabase
      .from('caderno_erros')
      .select('questao_id, ultima_escolha, vezes_errada, acertos_seguidos, resolvido, motivo, anotacao, ultimo_erro_em')
      .order('ultimo_erro_em', { ascending: false })
      .range(de, ate),
  );

export interface AtualizarCaderno {
  userId: string;
  questaoId: string;
  dados: Partial<{ motivo: MotivoErro | null; anotacao: string | null; resolvido: boolean }>;
}

export async function atualizarCaderno({ userId, questaoId, dados }: AtualizarCaderno): Promise<void> {
  exigir(await supabase.from('caderno_erros').update(dados).eq('user_id', userId).eq('questao_id', questaoId));
}
