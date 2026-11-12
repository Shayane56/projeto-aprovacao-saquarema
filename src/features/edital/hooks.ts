import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { config } from '@/lib/config';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/features/auth/AuthProvider';
import { buscarEdital, buscarProgresso, definirStatus, type DefinirStatus } from './api';
import { resumir } from './progresso';
import type { MapaProgresso } from './tipos';

export const chaves = {
  edital: (id: string) => ['edital', id] as const,
  progresso: (userId: string) => ['progresso', userId] as const,
};

export function useEdital() {
  return useQuery({
    queryKey: chaves.edital(config.concursoId),
    queryFn: () => buscarEdital(config.concursoId),
    staleTime: 1000 * 60 * 60 * 12, // o edital quase nunca muda
  });
}

export function useProgresso() {
  const { usuario } = useAuth();
  return useQuery({
    queryKey: chaves.progresso(usuario?.id ?? 'anonimo'),
    queryFn: buscarProgresso,
    enabled: Boolean(usuario),
  });
}

export function useResumoProgresso() {
  const edital = useEdital();
  const progresso = useProgresso();
  const resumo = useMemo(
    () => (edital.data && progresso.data ? resumir(edital.data, progresso.data) : undefined),
    [edital.data, progresso.data],
  );
  return { edital, progresso, resumo, carregando: edital.isPending || progresso.isPending, erro: edital.error ?? progresso.error };
}

const CHAVE_MUTACAO = ['progresso', 'definir'] as const;

// Registrado no nível do módulo: permite retomar alterações feitas offline
// mesmo depois de fechar e reabrir o app (o cache guarda as pendentes).
queryClient.setMutationDefaults(CHAVE_MUTACAO, {
  mutationFn: (v: DefinirStatus) => definirStatus(v),
});

export function useDefinirStatus() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation<void, Error, DefinirStatus, { anterior?: MapaProgresso }>({
    mutationKey: CHAVE_MUTACAO,
    mutationFn: definirStatus,
    onMutate: async (v) => {
      const chave = chaves.progresso(v.userId);
      await qc.cancelQueries({ queryKey: chave });
      const anterior = qc.getQueryData<MapaProgresso>(chave);
      qc.setQueryData<MapaProgresso>(chave, (atual = {}) => {
        const novo = { ...atual };
        if (v.status === 'nao_iniciado') delete novo[v.topicoId];
        else novo[v.topicoId] = v.status;
        return novo;
      });
      return { anterior };
    },
    onError: (_e, v, ctx) => {
      if (ctx?.anterior) qc.setQueryData(chaves.progresso(v.userId), ctx.anterior);
    },
    onSettled: () => {
      if (usuario && qc.isMutating({ mutationKey: CHAVE_MUTACAO }) <= 1) {
        void qc.invalidateQueries({ queryKey: chaves.progresso(usuario.id) });
      }
    },
  });
}
