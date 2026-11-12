import { exigir, supabase } from '@/lib/supabase';
import type { Etapa } from './tipos';

export async function buscarEtapas(concursoId: string): Promise<Etapa[]> {
  return supabase
    .from('etapas_concurso')
    .select('id, titulo, descricao, categoria, data_inicio, data_fim, acao, ordem')
    .eq('concurso_id', concursoId)
    .order('ordem')
    .then(exigir<Etapa[]>);
}

export async function buscarEtapasConcluidas(): Promise<string[]> {
  const linhas = await supabase.from('etapas_usuario').select('etapa_id').eq('concluida', true).then(exigir<{ etapa_id: string }[]>);
  return linhas.map((l) => l.etapa_id);
}

export interface MarcarEtapa {
  userId: string;
  etapaId: string;
  concluida: boolean;
}

export async function marcarEtapa({ userId, etapaId, concluida }: MarcarEtapa): Promise<void> {
  if (!concluida) {
    exigir(await supabase.from('etapas_usuario').delete().eq('user_id', userId).eq('etapa_id', etapaId));
    return;
  }
  exigir(await supabase.from('etapas_usuario').upsert({ user_id: userId, etapa_id: etapaId, concluida: true }, { onConflict: 'user_id,etapa_id' }));
}
