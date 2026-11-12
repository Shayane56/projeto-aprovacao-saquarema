import { exigir, supabase } from '@/lib/supabase';
import type { BlocoProva, Concurso, Disciplina, Edital, MapaProgresso, StatusTopico, Topico } from './tipos';

export async function buscarEdital(concursoId: string): Promise<Edital> {
  const [concurso, blocos, disciplinas] = await Promise.all([
    supabase.from('concursos').select('*').eq('id', concursoId).single().then(exigir<Concurso>),
    supabase.from('blocos_prova').select('id, nome, num_questoes, valor_questao, ordem').eq('concurso_id', concursoId).order('ordem').then(exigir<BlocoProva[]>),
    supabase.from('disciplinas').select('id, bloco_id, nome, sigla, cor, ordem').eq('concurso_id', concursoId).order('ordem').then(exigir<Disciplina[]>),
  ]);
  const topicos = await supabase
    .from('topicos')
    .select('id, disciplina_id, parent_id, numero, titulo, referencia, link, ordem')
    .in('disciplina_id', disciplinas.map((d) => d.id))
    .order('ordem')
    .then(exigir<Topico[]>);
  return {
    concurso: { ...concurso, salario: num(concurso.salario), taxa_inscricao: num(concurso.taxa_inscricao), pontuacao_total: Number(concurso.pontuacao_total), nota_minima: Number(concurso.nota_minima) },
    blocos: blocos.map((b) => ({ ...b, valor_questao: Number(b.valor_questao) })),
    disciplinas,
    topicos,
  };
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function buscarProgresso(): Promise<MapaProgresso> {
  const linhas = await supabase.from('progresso_topico').select('topico_id, status').then(exigir<{ topico_id: string; status: StatusTopico }[]>);
  return Object.fromEntries(linhas.map((l) => [l.topico_id, l.status]));
}

export interface DefinirStatus {
  userId: string;
  topicoId: string;
  status: StatusTopico;
}

export async function definirStatus({ userId, topicoId, status }: DefinirStatus): Promise<void> {
  if (status === 'nao_iniciado') {
    exigir(await supabase.from('progresso_topico').delete().eq('user_id', userId).eq('topico_id', topicoId));
    return;
  }
  exigir(await supabase.from('progresso_topico').upsert({ user_id: userId, topico_id: topicoId, status }, { onConflict: 'user_id,topico_id' }));
}
