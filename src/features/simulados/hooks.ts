import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { chavesPratica } from '@/features/questoes/hooks';
import { queryClient } from '@/lib/queryClient';
import { buscarSimulado, excluirSimulado, finalizarSimulado, iniciarSimulado, listarSimulados, marcarItem, type MarcarItem } from './api';
import type { TipoSimulado } from './config';
import type { SimuladoDetalhado } from './tipos';

export const chavesSimulado = {
  lista: (u: string) => ['simulados', u] as const,
  um: (id: string) => ['simulado', id] as const,
};

export function useSimulados() {
  const uid = useAuth().usuario?.id ?? 'anonimo';
  return useQuery({ queryKey: chavesSimulado.lista(uid), queryFn: listarSimulados, enabled: uid !== 'anonimo' });
}

export function useSimulado(id: string | undefined) {
  return useQuery({ queryKey: chavesSimulado.um(id ?? ''), queryFn: () => buscarSimulado(id!), enabled: Boolean(id), staleTime: Infinity });
}

export function useIniciarSimulado() {
  const qc = useQueryClient();
  const uid = useAuth().usuario?.id ?? 'anonimo';
  return useMutation({
    mutationFn: (v: { tipo: TipoSimulado; duracaoSeg: number; ids: string[] }) => iniciarSimulado(v.tipo, v.duracaoSeg, v.ids),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesSimulado.lista(uid) }),
  });
}

const CHAVE_MARCAR = ['simulado', 'marcar'] as const;
const ESCOPO = { id: 'simulado' };
queryClient.setMutationDefaults(CHAVE_MARCAR, { mutationFn: (v: MarcarItem) => marcarItem(v), scope: ESCOPO });

/** Grava a alternativa (ou a marcação "revisar") de uma questão do simulado; funciona offline. */
export function useMarcarItem() {
  const qc = useQueryClient();
  return useMutation<void, Error, MarcarItem>({
    mutationKey: CHAVE_MARCAR,
    mutationFn: marcarItem,
    scope: ESCOPO,
    onMutate: (v) => {
      qc.setQueryData<SimuladoDetalhado>(chavesSimulado.um(v.simuladoId), (s) =>
        s && { ...s, itens: s.itens.map((i) => (i.ordem === v.ordem ? { ...i, ...v.dados } : i)) },
      );
    },
  });
}

export function useFinalizarSimulado() {
  const qc = useQueryClient();
  const uid = useAuth().usuario?.id ?? 'anonimo';
  return useMutation({
    mutationFn: async (id: string) => {
      // Garante que as respostas pendentes sejam enviadas antes de corrigir.
      await qc.resumePausedMutations();
      while (qc.isMutating({ mutationKey: CHAVE_MARCAR }) > 0) await new Promise((r) => setTimeout(r, 150));
      return finalizarSimulado(id);
    },
    onSuccess: (resultado, id) => {
      qc.setQueryData<SimuladoDetalhado>(chavesSimulado.um(id), (s) => s && { ...s, status: 'finalizado', resultado, finalizado_em: new Date().toISOString() });
      void qc.invalidateQueries({ queryKey: chavesSimulado.lista(uid) });
      void qc.invalidateQueries({ queryKey: chavesPratica.respostas(uid) });
      void qc.invalidateQueries({ queryKey: chavesPratica.caderno(uid) });
    },
  });
}

export function useExcluirSimulado() {
  const qc = useQueryClient();
  const uid = useAuth().usuario?.id ?? 'anonimo';
  return useMutation({
    mutationFn: excluirSimulado,
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesSimulado.lista(uid) }),
  });
}
