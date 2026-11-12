import { exigir, supabase } from '@/lib/supabase';
import type { TipoSessao } from './gerador';

export interface SessaoConcluida {
  chave: string;
  data: string;
  tipo: TipoSessao;
  disciplina_id: string | null;
  topico_id: string | null;
  titulo: string;
  minutos: number;
  concluida_em: string;
}

export async function buscarSessoes(desde: string): Promise<SessaoConcluida[]> {
  return exigir(
    await supabase.from('sessoes_estudo').select('chave, data, tipo, disciplina_id, topico_id, titulo, minutos, concluida_em').gte('data', desde).order('concluida_em').limit(2000),
  ) as SessaoConcluida[];
}

export async function concluirSessao(userId: string, s: Omit<SessaoConcluida, 'concluida_em'>): Promise<void> {
  exigir(await supabase.from('sessoes_estudo').upsert({ ...s, user_id: userId }, { onConflict: 'user_id,chave', ignoreDuplicates: true }));
}

export async function desfazerSessao(userId: string, chave: string): Promise<void> {
  exigir(await supabase.from('sessoes_estudo').delete().eq('user_id', userId).eq('chave', chave));
}
