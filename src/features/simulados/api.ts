import { exigir, supabase } from '@/lib/supabase';
import type { TipoSimulado } from './config';
import { normalizarResultado, type ItemSimulado, type ResultadoSimulado, type Simulado, type SimuladoDetalhado } from './tipos';

const COLUNAS = 'id, tipo, status, duracao_seg, iniciado_em, finalizado_em, resultado';
const normalizar = (s: Simulado): Simulado => ({ ...s, resultado: normalizarResultado(s.resultado) });

export async function listarSimulados(): Promise<Simulado[]> {
  const lista = exigir(await supabase.from('simulados').select(COLUNAS).order('iniciado_em', { ascending: false }).limit(200));
  return (lista as Simulado[]).map(normalizar);
}

export async function buscarSimulado(id: string): Promise<SimuladoDetalhado> {
  const [s, itens] = await Promise.all([
    supabase.from('simulados').select(COLUNAS).eq('id', id).single().then(exigir<Simulado>),
    supabase.from('simulado_questoes').select('ordem, questao_id, escolha, marcada').eq('simulado_id', id).order('ordem').then(exigir<ItemSimulado[]>),
  ]);
  return { ...normalizar(s), itens };
}

export async function iniciarSimulado(tipo: TipoSimulado, duracaoSeg: number, ids: string[]): Promise<string> {
  const { data, error } = await supabase.rpc('iniciar_simulado', { p_tipo: tipo, p_duracao_seg: duracaoSeg, p_questoes: ids });
  if (error) throw error;
  return data as string;
}

export interface MarcarItem {
  simuladoId: string;
  ordem: number;
  dados: Partial<{ escolha: number | null; marcada: boolean }>;
}

export async function marcarItem({ simuladoId, ordem, dados }: MarcarItem): Promise<void> {
  const extra = 'escolha' in dados ? { respondida_em: dados.escolha === null ? null : new Date().toISOString() } : {};
  exigir(await supabase.from('simulado_questoes').update({ ...dados, ...extra }).eq('simulado_id', simuladoId).eq('ordem', ordem));
}

export async function finalizarSimulado(id: string): Promise<ResultadoSimulado> {
  const { data, error } = await supabase.rpc('finalizar_simulado', { p_id: id });
  if (error) throw error;
  return normalizarResultado(data)!;
}

export async function excluirSimulado(id: string): Promise<void> {
  exigir(await supabase.from('simulados').delete().eq('id', id));
}
