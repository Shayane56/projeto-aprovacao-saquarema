import { exigir, supabase } from '@/lib/supabase';
import type { SessaoPlano, TipoSessao } from './gerador';

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

export interface DiaCronograma {
  data: string;
  sessoes: SessaoPlano[];
}

/** Dias firmados do cronograma a partir de uma data. */
export async function buscarCronograma(desde: string): Promise<DiaCronograma[]> {
  return exigir(await supabase.from('cronograma_dias').select('data, sessoes').gte('data', desde).order('data').limit(400)) as DiaCronograma[];
}

/** Guarda dias do cronograma (não sobrescreve dias já firmados). */
export async function firmarDias(userId: string, dias: DiaCronograma[]): Promise<void> {
  if (!dias.length) return;
  exigir(
    await supabase
      .from('cronograma_dias')
      .upsert(dias.map((d) => ({ user_id: userId, data: d.data, sessoes: d.sessoes })), { onConflict: 'user_id,data', ignoreDuplicates: true }),
  );
}

/** Apaga os dias firmados a partir de uma data (para refazer depois de mudar a disponibilidade). */
export async function apagarDiasDesde(userId: string, desde: string): Promise<void> {
  exigir(await supabase.from('cronograma_dias').delete().eq('user_id', userId).gte('data', desde));
}
