import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { buscarNosMateriais, criarLink, enviarPdf, excluirMaterial, listarAnotacoes, listarMateriais, salvarNotaDoTopico, type NovoLink, type NovoPdf, type SalvarNota } from './api';
import type { Anotacao, Material } from './tipos';

const useUid = () => useAuth().usuario?.id ?? 'anonimo';
export const chavesMateriais = {
  lista: (u: string) => ['materiais', u] as const,
  notas: (u: string) => ['anotacoes', u] as const,
  busca: (u: string, q: string) => ['busca-materiais', u, q] as const,
};

export function useMateriais() {
  const uid = useUid();
  return useQuery({ queryKey: chavesMateriais.lista(uid), queryFn: listarMateriais, enabled: uid !== 'anonimo' });
}

export function useBuscaMateriais(consulta: string) {
  const uid = useUid();
  const q = consulta.trim();
  return useQuery({ queryKey: chavesMateriais.busca(uid, q), queryFn: () => buscarNosMateriais(q), enabled: uid !== 'anonimo' && q.length >= 3, staleTime: 60_000 });
}

export function useEnviarPdf() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: NovoPdf) => enviarPdf(v),
    onSuccess: (_m, v) => qc.invalidateQueries({ queryKey: chavesMateriais.lista(v.userId) }),
  });
}

export function useCriarLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: NovoLink) => criarLink(v),
    onSuccess: (_m, v) => qc.invalidateQueries({ queryKey: chavesMateriais.lista(v.userId) }),
  });
}

export function useExcluirMaterial() {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: (m: Material) => excluirMaterial(m),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesMateriais.lista(uid) }),
  });
}

export function useAnotacoes() {
  const uid = useUid();
  const q = useQuery({ queryKey: chavesMateriais.notas(uid), queryFn: listarAnotacoes, enabled: uid !== 'anonimo' });
  const porTopico = useMemo(() => new Map((q.data ?? []).filter((n) => n.topico_id).map((n) => [n.topico_id!, n] as [string, Anotacao])), [q.data]);
  return { ...q, porTopico };
}

const CHAVE_NOTA = ['anotacoes', 'salvar'] as const;
queryClient.setMutationDefaults(CHAVE_NOTA, { mutationFn: (v: SalvarNota) => salvarNotaDoTopico(v), scope: { id: 'anotacoes' } });

/** Salva a anotação de um tópico (funciona offline; envia quando a conexão voltar). */
export function useSalvarNota() {
  const qc = useQueryClient();
  return useMutation<void, Error, SalvarNota>({
    mutationKey: CHAVE_NOTA,
    mutationFn: salvarNotaDoTopico,
    scope: { id: 'anotacoes' },
    onMutate: (v) => {
      qc.setQueryData<Anotacao[]>(chavesMateriais.notas(v.userId), (lista = []) => {
        const sem = lista.filter((n) => n.topico_id !== v.topicoId);
        return v.conteudo.trim()
          ? [{ id: lista.find((n) => n.topico_id === v.topicoId)?.id ?? `local-${v.topicoId}`, topico_id: v.topicoId, titulo: null, conteudo: v.conteudo, atualizado_em: new Date().toISOString() }, ...sem]
          : sem;
      });
    },
  });
}
