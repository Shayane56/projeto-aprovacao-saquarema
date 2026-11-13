import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import {
  atualizarCaderno, buscarCaderno, buscarQuestoes, buscarRespostas, buscarTextos, inserirQuestoes, responder,
  type AtualizarCaderno, type Responder,
} from './api';
import { carregarPacotesAutorais, prepararPacote } from './pacotes/instalar';
import type { ItemCaderno, Questao, Resposta, TextoApoio } from './tipos';

export const chavesPratica = {
  questoes: (u: string) => ['questoes', u] as const,
  textos: (u: string) => ['textos', u] as const,
  respostas: (u: string) => ['respostas', u] as const,
  caderno: (u: string) => ['caderno', u] as const,
};

function useUid() {
  return useAuth().usuario?.id ?? 'anonimo';
}

export function useQuestoes() {
  const uid = useUid();
  return useQuery({ queryKey: chavesPratica.questoes(uid), queryFn: buscarQuestoes, enabled: uid !== 'anonimo' });
}

export function useTextos() {
  const uid = useUid();
  const q = useQuery({ queryKey: chavesPratica.textos(uid), queryFn: buscarTextos, enabled: uid !== 'anonimo' });
  const mapa = useMemo(() => new Map((q.data ?? []).map((t) => [t.id, t] as [string, TextoApoio])), [q.data]);
  return { ...q, mapa };
}

export function useRespostas() {
  const uid = useUid();
  return useQuery({ queryKey: chavesPratica.respostas(uid), queryFn: buscarRespostas, enabled: uid !== 'anonimo' });
}

export function useCaderno() {
  const uid = useUid();
  return useQuery({ queryKey: chavesPratica.caderno(uid), queryFn: buscarCaderno, enabled: uid !== 'anonimo' });
}

export function useMapaQuestoes() {
  const { data } = useQuestoes();
  return useMemo(() => new Map((data ?? []).map((q) => [q.id, q] as [string, Questao])), [data]);
}

const CHAVE_RESPONDER = ['pratica', 'responder'] as const;
const CHAVE_CADERNO = ['pratica', 'caderno'] as const;
// Respostas e anotações do caderno são enviadas em fila, na ordem em que aconteceram
// (o gatilho do banco cria o item do caderno antes de o motivo ser gravado).
const ESCOPO = { id: 'pratica' };

queryClient.setMutationDefaults(CHAVE_RESPONDER, { mutationFn: (v: Responder) => responder(v), scope: ESCOPO });
queryClient.setMutationDefaults(CHAVE_CADERNO, { mutationFn: (v: AtualizarCaderno) => atualizarCaderno(v), scope: ESCOPO });

/**
 * Registra uma resposta. A correção aparece na hora (o gabarito já está no aparelho);
 * o envio ao banco funciona também offline e é retomado quando a conexão volta.
 */
export function useResponder() {
  const qc = useQueryClient();
  return useMutation<void, Error, Responder & { correta: boolean }>({
    mutationKey: CHAVE_RESPONDER,
    mutationFn: responder,
    scope: ESCOPO,
    onMutate: (v) => {
      qc.setQueryData<Resposta[]>(chavesPratica.respostas(v.userId), (atual = []) => [
        ...atual,
        { questao_id: v.questaoId, escolha: v.escolha, correta: v.correta, origem: v.origem, respondida_em: v.respondidaEm },
      ]);
      qc.setQueryData<ItemCaderno[]>(chavesPratica.caderno(v.userId), (atual = []) => atualizarCadernoLocal(atual, v));
    },
    onSettled: (_d, _e, v) => {
      if (qc.isMutating({ mutationKey: CHAVE_RESPONDER }) <= 1) {
        void qc.invalidateQueries({ queryKey: chavesPratica.respostas(v.userId) });
        void qc.invalidateQueries({ queryKey: chavesPratica.caderno(v.userId) });
      }
    },
  });
}

/** Espelha no aparelho a regra do banco para o caderno de erros (resposta otimista). */
export function atualizarCadernoLocal(atual: ItemCaderno[], v: { questaoId: string; escolha: number; correta: boolean; respondidaEm: string }): ItemCaderno[] {
  const existente = atual.find((i) => i.questao_id === v.questaoId);
  if (!v.correta) {
    const item: ItemCaderno = existente
      ? { ...existente, vezes_errada: existente.vezes_errada + 1, ultima_escolha: v.escolha, ultimo_erro_em: v.respondidaEm, acertos_seguidos: 0, resolvido: false }
      : { questao_id: v.questaoId, ultima_escolha: v.escolha, vezes_errada: 1, acertos_seguidos: 0, resolvido: false, motivo: null, anotacao: null, ultimo_erro_em: v.respondidaEm };
    return [item, ...atual.filter((i) => i.questao_id !== v.questaoId)];
  }
  if (!existente) return atual;
  const acertos = existente.acertos_seguidos + 1;
  return atual.map((i) => (i.questao_id === v.questaoId ? { ...i, acertos_seguidos: acertos, resolvido: i.resolvido || acertos >= 2 } : i));
}

export function useAtualizarCaderno() {
  const qc = useQueryClient();
  return useMutation<void, Error, AtualizarCaderno>({
    mutationKey: CHAVE_CADERNO,
    mutationFn: atualizarCaderno,
    scope: ESCOPO,
    onMutate: (v) => {
      qc.setQueryData<ItemCaderno[]>(chavesPratica.caderno(v.userId), (atual = []) =>
        atual.map((i) => (i.questao_id === v.questaoId ? { ...i, ...v.dados } : i)),
      );
    },
  });
}

/**
 * Instala os pacotes de questões (autorais e de provas reais) na conta (uma vez; repetir não duplica,
 * porque cada questão tem um identificador de conteúdo único).
 */
export function useInstalarPacotes() {
  const { usuario } = useAuth();
  const questoes = useQuestoes();
  const qc = useQueryClient();
  const [estado, setEstado] = useState<'ocioso' | 'instalando' | 'pronto' | 'erro'>('ocioso');
  const tentou = useRef(false);

  useEffect(() => {
    if (!usuario || !questoes.data || tentou.current) return;
    tentou.current = true;
    void (async () => {
      const pacotes = await carregarPacotesAutorais();
      const todas = pacotes.flatMap(prepararPacote);
      const existentes = new Set(questoes.data.map((q) => q.enunciado));
      const faltando = todas.filter((q) => !existentes.has(q.enunciado));
      if (faltando.length === 0) return setEstado('pronto');
      setEstado('instalando');
      try {
        await inserirQuestoes(usuario.id, faltando);
        await qc.invalidateQueries({ queryKey: chavesPratica.questoes(usuario.id) });
        setEstado('pronto');
      } catch {
        tentou.current = false;
        setEstado('erro');
      }
    })();
  }, [usuario, questoes.data, qc]);

  return estado;
}
