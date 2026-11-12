import { ArrowLeft, CheckCircle2, ListRestart, RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthProvider';
import { useEdital } from '@/features/edital/hooks';
import { useAtualizarCaderno, useCaderno, useMapaQuestoes, useResponder, useTextos } from '@/features/questoes/hooks';
import { SeletorMotivo } from '@/features/questoes/MotivoErro';
import { QuestaoCard } from '@/features/questoes/QuestaoCard';
import { letra, MOTIVOS, rotuloMotivo, type ItemCaderno, type MotivoErro } from '@/features/questoes/tipos';
import { cn } from '@/lib/cn';
import { Botao, Carregando, ErroCarga } from '@/shared/ui';

type Situacao = 'pendentes' | 'resolvidos';

export function ErrosPage() {
  const edital = useEdital();
  const caderno = useCaderno();
  const mapa = useMapaQuestoes();
  const [situacao, setSituacao] = useState<Situacao>('pendentes');
  const [disciplinaId, setDisciplinaId] = useState('');
  const [motivo, setMotivo] = useState<MotivoErro | ''>('');

  const lista = useMemo(
    () =>
      (caderno.data ?? []).filter((i) => {
        const q = mapa.get(i.questao_id);
        return q && (situacao === 'pendentes' ? !i.resolvido : i.resolvido) && (!disciplinaId || q.disciplina_id === disciplinaId) && (!motivo || i.motivo === motivo);
      }),
    [caderno.data, mapa, situacao, disciplinaId, motivo],
  );

  if (caderno.isPending || edital.isPending) return <Carregando />;
  if (!caderno.data || !edital.data) return <ErroCarga erro={caderno.error ?? edital.error} tentarDeNovo={() => void caderno.refetch()} />;

  const pendentes = caderno.data.filter((i) => !i.resolvido).length;
  const contagemMotivos = MOTIVOS.map((m) => ({ ...m, n: caderno.data.filter((i) => !i.resolvido && i.motivo === m.valor).length })).filter((m) => m.n > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Caderno de erros</h1>
      </div>
      <p className="text-sm text-suave">
        Toda questão errada entra aqui. Ao acertá-la <strong>2 vezes seguidas</strong>, ela é marcada como resolvida.
      </p>

      {pendentes > 0 && (
        <Link to="/praticar/questoes?modo=erradas">
          <Botao className="w-full sm:w-auto"><ListRestart className="h-4 w-4" aria-hidden /> Refazer os {pendentes} erros pendentes</Botao>
        </Link>
      )}

      {contagemMotivos.length > 0 && (
        <div className="cartao p-4">
          <p className="rotulo">Por que você mais erra</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {contagemMotivos.sort((a, b) => b.n - a.n).map((m) => (
              <li key={m.valor} className="rounded-full bg-superficie-2 px-3 py-1">{m.rotulo}: <strong>{m.n}</strong></li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {([['pendentes', 'Pendentes'], ['resolvidos', 'Resolvidos']] as const).map(([v, r]) => (
          <button key={v} type="button" aria-pressed={situacao === v} onClick={() => setSituacao(v)}
            className={cn('rounded-full border px-3 py-1.5 text-[13px] font-medium', situacao === v ? 'border-primaria bg-primaria-suave text-primaria' : 'border-borda bg-superficie')}>
            {r}
          </button>
        ))}
        <select className="campo w-auto py-1.5 text-[13px]" value={disciplinaId} onChange={(e) => setDisciplinaId(e.target.value)} aria-label="Filtrar por disciplina">
          <option value="">Todas as disciplinas</option>
          {edital.data.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}
        </select>
        <select className="campo w-auto py-1.5 text-[13px]" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoErro | '')} aria-label="Filtrar por motivo">
          <option value="">Todos os motivos</option>
          {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
        </select>
      </div>

      {lista.length === 0 ? (
        <div className="cartao p-8 text-center text-sm text-suave">
          {situacao === 'pendentes' ? 'Nenhum erro pendente com esses filtros. 🎉' : 'Nenhuma questão resolvida ainda.'}
        </div>
      ) : (
        <ul className="space-y-4">
          {lista.map((item) => <ItemErro key={item.questao_id} item={item} />)}
        </ul>
      )}
    </div>
  );
}

function ItemErro({ item }: { item: ItemCaderno }) {
  const { usuario } = useAuth();
  const mapa = useMapaQuestoes();
  const textos = useTextos();
  const atualizar = useAtualizarCaderno();
  const responder = useResponder();
  const questao = mapa.get(item.questao_id)!;
  const [modo, setModo] = useState<'revisar' | 'refazer'>('revisar');
  const [escolha, setEscolha] = useState<number | null>(null);
  const [corrigida, setCorrigida] = useState(false);
  const [anotacao, setAnotacao] = useState(item.anotacao ?? '');

  if (!usuario) return null;
  const salvar = (dados: Parameters<typeof atualizar.mutate>[0]['dados']) => atualizar.mutate({ userId: usuario.id, questaoId: item.questao_id, dados });

  function conferir() {
    if (escolha === null) return;
    setCorrigida(true);
    responder.mutate({
      userId: usuario!.id, questaoId: questao.id, escolha, correta: escolha === questao.gabarito, origem: 'erros', tempoSeg: 0, respondidaEm: new Date().toISOString(),
    });
  }

  return (
    <li className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
        <span>Errou <strong className="text-perigo">{item.vezes_errada}×</strong></span>
        <span>Sua última resposta: <strong>{letra(item.ultima_escolha)}</strong> · Correta: <strong className="text-sucesso">{letra(questao.gabarito)}</strong></span>
        {item.acertos_seguidos > 0 && !item.resolvido && <span className="text-sucesso">{item.acertos_seguidos} acerto seguido — falta 1</span>}
        {item.resolvido && <span className="inline-flex items-center gap-1 text-sucesso"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Resolvida</span>}
      </div>

      {modo === 'revisar' ? (
        <QuestaoCard questao={questao} escolha={item.ultima_escolha} corrigida texto={questao.texto_id ? textos.mapa.get(questao.texto_id) : undefined} />
      ) : (
        <QuestaoCard questao={questao} escolha={escolha} aoEscolher={setEscolha} corrigida={corrigida} texto={questao.texto_id ? textos.mapa.get(questao.texto_id) : undefined} />
      )}

      <div className="cartao space-y-3 p-4">
        <div>
          <p className="mb-2 text-sm font-medium">Motivo: <span className="font-normal text-suave">{rotuloMotivo(item.motivo)}</span></p>
          <SeletorMotivo valor={item.motivo} aoMudar={(m) => salvar({ motivo: m })} />
        </div>
        <label className="block text-sm">
          <span className="font-medium">Anotação</span>
          <textarea
            className="campo mt-1 min-h-[72px]"
            value={anotacao}
            onChange={(e) => setAnotacao(e.target.value)}
            onBlur={() => anotacao !== (item.anotacao ?? '') && salvar({ anotacao: anotacao.trim() || null })}
            placeholder="O que você precisa lembrar para não errar de novo?"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {modo === 'revisar' ? (
            <Botao pequeno variante="secundario" onClick={() => { setModo('refazer'); setEscolha(null); setCorrigida(false); }}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Refazer a questão
            </Botao>
          ) : !corrigida ? (
            <Botao pequeno onClick={conferir} disabled={escolha === null}>Conferir</Botao>
          ) : (
            <Botao pequeno variante="secundario" onClick={() => setModo('revisar')}>Fechar</Botao>
          )}
          <Botao pequeno variante="fantasma" onClick={() => salvar({ resolvido: !item.resolvido })}>
            {item.resolvido ? 'Voltar para pendentes' : 'Marcar como resolvida'}
          </Botao>
        </div>
      </div>
    </li>
  );
}
