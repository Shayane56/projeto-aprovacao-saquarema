import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useResumoProgresso } from '@/features/edital/hooks';
import { usePreferencias } from '@/features/perfil/preferencias';
import { useQuestoes, useRespostas } from '@/features/questoes/hooks';
import { dataLocal } from '@/lib/datas';
import { queryClient } from '@/lib/queryClient';
import { buscarSessoes, concluirSessao, desfazerSessao, type SessaoConcluida } from './api';
import { desempenhoPorTopico, questoesPorTopico } from './dados';
import { gerarPlano, somarDias } from './gerador';

const chave = (u: string, desde: string) => ['sessoes', u, desde] as const;

export function useSessoes() {
  const uid = useAuth().usuario?.id ?? 'anonimo';
  const desde = somarDias(dataLocal(), -30);
  return useQuery({ queryKey: chave(uid, desde), queryFn: () => buscarSessoes(desde), enabled: uid !== 'anonimo' });
}

type Alternar = { userId: string; sessao: Omit<SessaoConcluida, 'concluida_em'>; concluir: boolean };
const CHAVE = ['sessoes', 'alternar'] as const;
const executar = (v: Alternar) => (v.concluir ? concluirSessao(v.userId, v.sessao) : desfazerSessao(v.userId, v.sessao.chave));
queryClient.setMutationDefaults(CHAVE, { mutationFn: executar, scope: { id: 'sessoes' } });

export function useAlternarSessao() {
  const qc = useQueryClient();
  return useMutation<void, Error, Alternar>({
    mutationKey: CHAVE,
    mutationFn: executar,
    scope: { id: 'sessoes' },
    onMutate: (v) => {
      qc.setQueriesData<SessaoConcluida[]>({ queryKey: ['sessoes', v.userId] }, (lista = []) =>
        v.concluir ? [...lista.filter((s) => s.chave !== v.sessao.chave), { ...v.sessao, concluida_em: new Date().toISOString() }] : lista.filter((s) => s.chave !== v.sessao.chave),
      );
    },
  });
}

/** Plano calculado a partir do estado atual (edital, progresso, questões, respostas e disponibilidade). */
export function usePlano() {
  const { edital, progresso, carregando: carregandoEdital, erro } = useResumoProgresso();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const prefs = usePreferencias();
  const hoje = dataLocal();
  const plano = useMemo(() => {
    if (!edital.data || !progresso.data || !questoes.data || !respostas.data || prefs.isPending) return undefined;
    const prova = edital.data.concurso.prova_inicio ? dataLocal(new Date(edital.data.concurso.prova_inicio)) : hoje;
    return gerarPlano({
      edital: edital.data,
      progresso: progresso.data,
      desempenho: desempenhoPorTopico(edital.data, questoes.data, respostas.data),
      questoesPorTopico: questoesPorTopico(edital.data, questoes.data),
      hoje,
      dataProva: prova,
      prefs: prefs.estudo,
    });
  }, [edital.data, progresso.data, questoes.data, respostas.data, prefs.isPending, prefs.estudo, hoje]);
  return {
    plano,
    hoje,
    carregando: carregandoEdital || questoes.isPending || respostas.isPending || prefs.isPending,
    erro: erro ?? questoes.error ?? respostas.error ?? prefs.error,
  };
}
