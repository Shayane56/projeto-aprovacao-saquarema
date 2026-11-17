import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useResumoProgresso } from '@/features/edital/hooks';
import { usePreferencias } from '@/features/perfil/preferencias';
import { useQuestoes, useRespostas } from '@/features/questoes/hooks';
import { dataLocal } from '@/lib/datas';
import { queryClient } from '@/lib/queryClient';
import { apagarDiasDesde, buscarCronograma, buscarSessoes, concluirSessao, desfazerSessao, firmarDias, type DiaCronograma, type SessaoConcluida } from './api';
import { calcularAtrasos, diasParaFirmar, dispensada, planejarRecuperacao } from './cronograma';
import { desempenhoPorTopico, questoesPorTopico } from './dados';
import { chaveTarefa, gerarPlano, margemDoDia, pesoDosTopicos, somarDias, type EntradaPlano } from './gerador';

const chave = (u: string, desde: string) => ['sessoes', u, desde] as const;

export function useSessoes(dias = 30) {
  const uid = useAuth().usuario?.id ?? 'anonimo';
  const desde = somarDias(dataLocal(), -dias);
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

// ---------- Cronograma firmado ----------

/** Quantos dias para trás o cronograma (e as sessões concluídas) é lido. */
const HISTORICO_DIAS = 60;
const chaveCronograma = (u: string) => ['cronograma', u] as const;

export function useCronograma() {
  const uid = useAuth().usuario?.id ?? 'anonimo';
  return useQuery({ queryKey: chaveCronograma(uid), queryFn: () => buscarCronograma(somarDias(dataLocal(), -HISTORICO_DIAS)), enabled: uid !== 'anonimo' });
}

/** Grava os dias da semana que ainda não foram firmados (uma vez por conjunto de dias). */
function useFirmarDias(dias: DiaCronograma[] | undefined) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const enviados = useRef('');
  const firmar = useMutation({
    mutationFn: (novos: DiaCronograma[]) => firmarDias(usuario!.id, novos),
    scope: { id: 'cronograma' },
    onMutate: (novos) => {
      qc.setQueryData<DiaCronograma[]>(chaveCronograma(usuario!.id), (atual = []) => [...atual, ...novos.filter((n) => !atual.some((a) => a.data === n.data))]);
    },
    onError: () => {
      enviados.current = '';
      void qc.invalidateQueries({ queryKey: chaveCronograma(usuario!.id) });
    },
  });
  const { mutate } = firmar;
  useEffect(() => {
    if (!usuario || !dias?.length) return;
    const k = dias.map((d) => d.data).join(',');
    if (enviados.current === k) return;
    enviados.current = k;
    mutate(dias);
  }, [usuario, dias, mutate]);
}

/** Refaz os dias firmados a partir de amanhã (depois de mudar a disponibilidade ou a margem). */
export function useRefazerCronograma() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apagarDiasDesde(usuario!.id, somarDias(dataLocal(), 1)),
    scope: { id: 'cronograma' },
    onMutate: () => {
      const amanha = somarDias(dataLocal(), 1);
      qc.setQueryData<DiaCronograma[]>(chaveCronograma(usuario!.id), (atual = []) => atual.filter((d) => d.data < amanha));
    },
  });
}

/** Tarefas atrasadas que a pessoa escolheu "encaixar hoje" (guardado só neste aparelho). */
export function usePuxadas(hoje: string) {
  const chaveLocal = `pas:puxadas:${hoje}`;
  const [lista, setLista] = useState<string[]>(() => {
    try {
      const v: unknown = JSON.parse(localStorage.getItem(chaveLocal) ?? '[]');
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const alternar = useCallback(
    (c: string) =>
      setLista((l) => {
        const nova = l.includes(c) ? l.filter((x) => x !== c) : [...l, c];
        try { localStorage.setItem(chaveLocal, JSON.stringify(nova)); } catch { /* sem armazenamento: vale só nesta tela */ }
        return nova;
      }),
    [chaveLocal],
  );
  return [useMemo(() => new Set(lista), [lista]), alternar] as const;
}

/** Teorias concluídas antes de hoje, pela data em que foram estudadas (para a revisão de 7 dias). */
function teoriasEstudadas(concluidas: SessaoConcluida[], hoje: string): Map<string, string[]> {
  const r = new Map<string, string[]>();
  for (const c of concluidas) {
    if (c.tipo !== 'teoria' || !c.topico_id) continue;
    const dia = c.concluida_em ? dataLocal(new Date(c.concluida_em)) : c.data;
    if (dia < hoje) r.set(dia, [...(r.get(dia) ?? []), c.topico_id]);
  }
  return r;
}

/**
 * Plano calculado a partir do estado atual (edital, progresso, questões, respostas e disponibilidade),
 * respeitando os dias já firmados, mais a recuperação dos atrasos.
 */
export function usePlano() {
  const { edital, progresso, carregando: carregandoEdital, erro } = useResumoProgresso();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const prefs = usePreferencias();
  const cronograma = useCronograma();
  const sessoes = useSessoes(HISTORICO_DIAS);
  const hoje = dataLocal();
  const [puxadas, alternarPuxada] = usePuxadas(hoje);

  const resultado = useMemo(() => {
    if (!edital.data || !progresso.data || !questoes.data || !respostas.data || prefs.isPending || !cronograma.data || !sessoes.data) return undefined;
    const prova = edital.data.concurso.prova_inicio ? dataLocal(new Date(edital.data.concurso.prova_inicio)) : hoje;
    const firmados = cronograma.data;
    const concluidas = sessoes.data;
    const feitas = new Set(concluidas.map((c) => c.chave));
    const atrasos = calcularAtrasos({ firmados, concluidas, progresso: progresso.data, pesos: pesoDosTopicos(edital.data), hoje });
    const entrada: EntradaPlano = {
      edital: edital.data,
      progresso: progresso.data,
      desempenho: desempenhoPorTopico(edital.data, questoes.data, respostas.data),
      questoesPorTopico: questoesPorTopico(edital.data, questoes.data),
      hoje,
      dataProva: prova,
      prefs: prefs.estudo,
      // Dias firmados: some o que foi dispensado no edital (a não ser que já tenha sido feito).
      fixos: new Map(firmados.filter((d) => d.data >= hoje).map((d) => [d.data, d.sessoes.filter((s) => feitas.has(s.chave) || !dispensada(s, progresso.data!))])),
      reservados: new Set(atrasos.filter((a) => a.sessao.topico_id).map((a) => chaveTarefa(a.sessao.tipo, a.sessao.topico_id!))),
      estudadas: teoriasEstudadas(concluidas, hoje),
    };
    let plano = gerarPlano({ ...entrada, margemRecuperacao: prefs.estudo.margemRecuperacao });
    // Se reservar a margem fizer o edital não caber, a recuperação passa a ser tempo extra do dia.
    let margemExtra = false;
    if (plano.minutosPendentes > 0) {
      const semMargem = gerarPlano(entrada);
      if (semMargem.minutosPendentes < plano.minutosPendentes) {
        margemExtra = true;
        plano = { ...semMargem, dias: semMargem.dias.map((d) => ({ ...d, margem: d.fase === 'estudo' ? margemDoDia(d.minutosDisponiveis, prefs.estudo.margemRecuperacao) : 0 })) };
      }
    }
    const recuperacao = planejarRecuperacao({ atrasos, dias: plano.dias, hoje, dataProva: prova, puxadas, firmados, concluidas });
    return { plano, recuperacao, margemExtra, paraFirmar: diasParaFirmar(plano.dias, firmados, hoje) };
  }, [edital.data, progresso.data, questoes.data, respostas.data, prefs.isPending, prefs.estudo, cronograma.data, sessoes.data, hoje, puxadas]);

  useFirmarDias(resultado?.paraFirmar);

  return {
    plano: resultado?.plano,
    recuperacao: resultado?.recuperacao,
    /** true quando a recuperação é tempo além da disponibilidade (o edital não cabe com a margem). */
    margemExtra: resultado?.margemExtra ?? false,
    concluidas: sessoes.data,
    puxadas,
    alternarPuxada,
    hoje,
    carregando: carregandoEdital || questoes.isPending || respostas.isPending || prefs.isPending || cronograma.isPending || sessoes.isPending,
    erro: erro ?? questoes.error ?? respostas.error ?? prefs.error ?? cronograma.error ?? sessoes.error,
  };
}
