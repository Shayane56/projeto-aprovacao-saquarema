import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { exigir, supabase } from '@/lib/supabase';

export interface PreferenciasEstudo {
  /** Minutos disponíveis por dia da semana: [dom, seg, ter, qua, qui, sex, sáb]. */
  minutosPorDia: number[];
  /** Dia da semana preferido para o simulado completo (0 = domingo … 6 = sábado). */
  diaSimulado: number;
  /** Cartões novos por dia nos flashcards. */
  novosPorDia: number;
}

export const PREFERENCIAS_PADRAO: PreferenciasEstudo = {
  minutosPorDia: [120, 120, 120, 120, 120, 120, 240],
  diaSimulado: 6,
  novosPorDia: 15,
};

export function normalizarPreferencias(p: unknown): PreferenciasEstudo {
  const x = (p && typeof p === 'object' ? p : {}) as Partial<PreferenciasEstudo>;
  const minutos = Array.isArray(x.minutosPorDia) && x.minutosPorDia.length === 7
    ? x.minutosPorDia.map((m) => Math.max(0, Math.min(720, Math.round(Number(m) || 0))))
    : PREFERENCIAS_PADRAO.minutosPorDia;
  return {
    minutosPorDia: minutos,
    diaSimulado: Number.isInteger(x.diaSimulado) && x.diaSimulado! >= 0 && x.diaSimulado! <= 6 ? x.diaSimulado! : PREFERENCIAS_PADRAO.diaSimulado,
    novosPorDia: Math.max(0, Math.min(100, Math.round(Number(x.novosPorDia ?? PREFERENCIAS_PADRAO.novosPorDia)))),
  };
}

async function buscarPreferencias(): Promise<{ bruto: Record<string, unknown>; estudo: PreferenciasEstudo }> {
  const linha = exigir(await supabase.from('perfis').select('preferencias').maybeSingle()) as { preferencias: Record<string, unknown> } | null;
  const bruto = linha?.preferencias ?? {};
  return { bruto, estudo: normalizarPreferencias(bruto.estudo) };
}

const chave = (u: string) => ['preferencias', u] as const;

export function usePreferencias() {
  const uid = useAuth().usuario?.id ?? 'anonimo';
  const q = useQuery({ queryKey: chave(uid), queryFn: buscarPreferencias, enabled: uid !== 'anonimo' });
  return { ...q, estudo: q.data?.estudo ?? PREFERENCIAS_PADRAO };
}

export function useSalvarPreferencias() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (estudo: PreferenciasEstudo) => {
      const atual = qc.getQueryData<{ bruto: Record<string, unknown> }>(chave(usuario!.id))?.bruto ?? {};
      exigir(await supabase.from('perfis').update({ preferencias: { ...atual, estudo } }).eq('id', usuario!.id));
    },
    onMutate: (estudo) => {
      qc.setQueryData<{ bruto: Record<string, unknown>; estudo: PreferenciasEstudo }>(chave(usuario!.id), (d) => ({ bruto: { ...(d?.bruto ?? {}), estudo }, estudo }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: chave(usuario!.id) }),
  });
}
