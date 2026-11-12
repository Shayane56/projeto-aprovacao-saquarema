import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { dataLocal } from '@/lib/datas';
import { atualizarFlashcard, buscarFlashcards, buscarRevisoesDesde, excluirFlashcard, inserirFlashcards, revisarFlashcard, type Revisar } from './api';
import { hashCartao } from './agendador';
import type { Flashcard, NovoFlashcard, RevisaoFlashcard } from './tipos';

export const chavesCartoes = {
  cartoes: (u: string) => ['flashcards', u] as const,
  revisoes: (u: string, desde: string) => ['revisoes-flashcard', u, desde] as const,
};

const useUid = () => useAuth().usuario?.id ?? 'anonimo';

/** Início do dia de estudo (00h em Brasília) em ISO, para contar as revisões de hoje. */
export function inicioDoDia(agora: Date = new Date()): string {
  return new Date(`${dataLocal(agora)}T00:00:00-03:00`).toISOString();
}

export function useFlashcards() {
  const uid = useUid();
  return useQuery({ queryKey: chavesCartoes.cartoes(uid), queryFn: buscarFlashcards, enabled: uid !== 'anonimo' });
}

export function useRevisoesHoje() {
  const uid = useUid();
  const desde = inicioDoDia();
  return useQuery({ queryKey: chavesCartoes.revisoes(uid, desde), queryFn: () => buscarRevisoesDesde(desde), enabled: uid !== 'anonimo' });
}

const CHAVE_REVISAR = ['flashcards', 'revisar'] as const;
const ESCOPO = { id: 'flashcards' };
queryClient.setMutationDefaults(CHAVE_REVISAR, { mutationFn: (v: Revisar) => revisarFlashcard(v), scope: ESCOPO });

/** Registra a nota de um cartão. Atualiza a fila na hora e envia em fila (funciona offline). */
export function useRevisar() {
  const qc = useQueryClient();
  return useMutation<void, Error, Revisar>({
    mutationKey: CHAVE_REVISAR,
    mutationFn: revisarFlashcard,
    scope: ESCOPO,
    onMutate: (v) => {
      qc.setQueryData<Flashcard[]>(chavesCartoes.cartoes(v.userId), (lista = []) => lista.map((c) => (c.id === v.id ? { ...c, ...v.estado } : c)));
      qc.setQueryData<RevisaoFlashcard[]>(chavesCartoes.revisoes(v.userId, inicioDoDia()), (lista = []) => [
        ...lista,
        { flashcard_id: v.id, rating: v.log.rating as RevisaoFlashcard['rating'], state: v.log.state as RevisaoFlashcard['state'], review: v.log.review },
      ]);
    },
  });
}

export function useSalvarFlashcard() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (v: { id?: string; dados: Omit<NovoFlashcard, 'hash'> }) => {
      if (v.id) {
        await atualizarFlashcard(v.id, { frente: v.dados.frente, verso: v.dados.verso, disciplina_id: v.dados.disciplina_id, topico_id: v.dados.topico_id });
        return 1;
      }
      return inserirFlashcards(usuario!.id, [{ ...v.dados, hash: hashCartao(v.dados.frente) }]);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesCartoes.cartoes(usuario?.id ?? 'anonimo') }),
  });
}

export function useAlterarCartao() {
  const qc = useQueryClient();
  const uid = useUid();
  return useMutation({
    mutationFn: (v: { id: string; acao: 'suspender' | 'reativar' | 'excluir' }) =>
      v.acao === 'excluir' ? excluirFlashcard(v.id) : atualizarFlashcard(v.id, { suspenso: v.acao === 'suspender' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: chavesCartoes.cartoes(uid) }),
  });
}

/** Instala o pacote de cartões autorais (uma vez; repetir não duplica). */
export function useInstalarCartoes() {
  const { usuario } = useAuth();
  const cartoes = useFlashcards();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<'ocioso' | 'instalando' | 'pronto' | 'erro'>('ocioso');
  const tentou = useRef(false);

  useEffect(() => {
    if (!usuario || !cartoes.data || tentou.current) return;
    tentou.current = true;
    void (async () => {
      type PacoteCartoes = { cartoes: { disciplina: string; topico: string | null; frente: string; verso: string }[] };
      const pacotes = (await Promise.all([import('./pacotes/cartoes-v1.json'), import('./pacotes/municipio-v1.json')])).map((m) => m.default as PacoteCartoes);
      const existentes = new Set(cartoes.data.map((c) => hashCartao(c.frente)));
      const faltando: NovoFlashcard[] = pacotes
        .flatMap((p) => p.cartoes)
        .map((c) => ({ disciplina_id: c.disciplina, topico_id: c.topico, questao_id: null, frente: c.frente, verso: c.verso, origem: 'autoral' as const, hash: hashCartao(c.frente) }))
        .filter((c) => !existentes.has(c.hash));
      if (!faltando.length) return setEstado('pronto');
      setEstado('instalando');
      try {
        await inserirFlashcards(usuario.id, faltando);
        await qc.invalidateQueries({ queryKey: chavesCartoes.cartoes(usuario.id) });
        setEstado('pronto');
      } catch {
        tentou.current = false;
        setEstado('erro');
      }
    })();
  }, [usuario, cartoes.data, qc]);

  return estado;
}
