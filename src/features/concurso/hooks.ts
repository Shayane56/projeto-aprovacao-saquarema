import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { config } from '@/lib/config';
import { dataLocal } from '@/lib/datas';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAgora } from '@/shared/hooks/useAgora';
import { buscarEtapas, buscarEtapasConcluidas, marcarEtapa, type MarcarEtapa } from './api';
import { classificarEtapas } from './etapas';

const chaves = {
  etapas: (id: string) => ['etapas', id] as const,
  concluidas: (userId: string) => ['etapas-concluidas', userId] as const,
};

export function useEtapas() {
  const agora = useAgora(60_000);
  const hoje = dataLocal(agora);
  const etapas = useQuery({ queryKey: chaves.etapas(config.concursoId), queryFn: () => buscarEtapas(config.concursoId), staleTime: 1000 * 60 * 60 * 12 });
  const { usuario } = useAuth();
  const concluidas = useQuery({
    queryKey: chaves.concluidas(usuario?.id ?? 'anonimo'),
    queryFn: buscarEtapasConcluidas,
    enabled: Boolean(usuario),
  });
  const lista = useMemo(() => (etapas.data ? classificarEtapas(etapas.data, hoje) : undefined), [etapas.data, hoje]);
  const conjunto = useMemo(() => new Set(concluidas.data ?? []), [concluidas.data]);
  return { etapas: lista, concluidas: conjunto, carregando: etapas.isPending, erro: etapas.error ?? concluidas.error, hoje };
}

const CHAVE_MUTACAO = ['etapas', 'marcar'] as const;
queryClient.setMutationDefaults(CHAVE_MUTACAO, { mutationFn: (v: MarcarEtapa) => marcarEtapa(v) });

export function useMarcarEtapa() {
  const qc = useQueryClient();
  return useMutation<void, Error, MarcarEtapa, { anterior?: string[] }>({
    mutationKey: CHAVE_MUTACAO,
    mutationFn: marcarEtapa,
    onMutate: async (v) => {
      const chave = chaves.concluidas(v.userId);
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData<string[]>(chave);
      qc.setQueryData<string[]>(chave, (atual = []) => (v.concluida ? [...new Set([...atual, v.etapaId])] : atual.filter((id) => id !== v.etapaId)));
      return { anterior };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.concluidas(v.userId), ctx.anterior);
    },
    onSettled: (_d, _e, v) => {
      if (qc.isMutating({ mutationKey: CHAVE_MUTACAO }) <= 1) void qc.invalidateQueries({ queryKey: chaves.concluidas(v.userId) });
    },
  });
}
