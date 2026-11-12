import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Play, Trash2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEdital } from '@/features/edital/hooks';
import { useCaderno, useQuestoes, useRespostas } from '@/features/questoes/hooks';
import { cn } from '@/lib/cn';
import { mensagemDeErro } from '@/lib/supabase';
import { Aviso, Botao, Carregando, ErroCarga } from '@/shared/ui';
import { SIMULADOS, type ConfigSimulado } from './config';
import { useExcluirSimulado, useIniciarSimulado, useSimulados } from './hooks';
import { selecionarQuestoes } from './selecao';
import { formatarDuracao } from './tipos';

const dataHora = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export function SimuladosPage() {
  const edital = useEdital();
  const questoes = useQuestoes();
  const respostas = useRespostas();
  const caderno = useCaderno();
  const simulados = useSimulados();
  const iniciar = useIniciarSimulado();
  const excluir = useExcluirSimulado();
  const navegar = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  if (edital.isPending || questoes.isPending || respostas.isPending || simulados.isPending) return <Carregando />;
  if (!edital.data || !questoes.data || !respostas.data || !simulados.data) return <ErroCarga erro={questoes.error ?? simulados.error} />;

  const emAndamento = simulados.data.find((s) => s.status === 'em_andamento');
  const finalizados = simulados.data.filter((s) => s.status === 'finalizado');
  const nomeBloco = (id: string) => edital.data.blocos.find((b) => b.id === id)?.nome ?? id;

  async function comecar(config: ConfigSimulado) {
    setErro(null);
    const sel = selecionarQuestoes(edital.data!, questoes.data!, respostas.data!, caderno.data ?? [], config);
    if (sel.ids.length === 0) return setErro('Ainda não há questões no seu banco para montar o simulado.');
    try {
      const id = await iniciar.mutateAsync({ tipo: config.tipo, duracaoSeg: config.duracaoMin * 60, ids: sel.ids });
      navegar(`/simulado/${id}`);
    } catch (e) {
      setErro(mensagemDeErro(e));
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <Link to="/praticar" className="rounded-lg p-1.5 text-suave hover:bg-superficie-2" aria-label="Voltar para Praticar"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-xl font-bold tracking-tight">Simulados IBAM</h1>
      </div>

      {emAndamento && (
        <Link to={`/simulado/${emAndamento.id}`} className="flex items-center justify-between gap-3 rounded-2xl border border-alerta/40 bg-alerta/10 p-4">
          <span className="text-sm"><strong>Você tem um simulado em andamento.</strong> Toque para continuar.</span>
          <ArrowRight className="h-5 w-5 shrink-0 text-alerta" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {SIMULADOS.map((config) => {
          const sel = selecionarQuestoes(edital.data, questoes.data, respostas.data, caderno.data ?? [], config, () => 0.5);
          const faltas = Object.entries(sel.faltando);
          return (
            <section key={config.tipo} className="cartao flex flex-col p-5">
              <h2 className="font-semibold">{config.nome}</h2>
              <p className="mt-1 text-sm text-suave">{config.descricao}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {edital.data.blocos.map((b) => (
                  <li key={b.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">{b.nome}</span>
                    <span className="shrink-0 text-suave">{config.porBloco[b.id]} × {b.valor_questao} pt</span>
                  </li>
                ))}
              </ul>
              {faltas.length > 0 && (
                <Aviso tipo="alerta" className="mt-3">
                  Faltam questões no seu banco: {faltas.map(([b, n]) => `${n} de ${nomeBloco(b)}`).join('; ')}. O simulado sai com {sel.ids.length} questões.
                </Aviso>
              )}
              <Botao className="mt-4" onClick={() => void comecar(config)} carregando={iniciar.isPending && iniciar.variables?.tipo === config.tipo} disabled={Boolean(emAndamento) || sel.ids.length === 0}>
                <Play className="h-4 w-4" aria-hidden /> Começar ({config.duracaoMin >= 60 ? `${config.duracaoMin / 60}h` : `${config.duracaoMin} min`})
              </Botao>
            </section>
          );
        })}
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      {emAndamento && <p className="text-xs text-suave">Finalize o simulado em andamento antes de começar outro.</p>}

      <section className="cartao p-5" aria-labelledby="titulo-historico">
        <h2 id="titulo-historico" className="font-semibold">Histórico</h2>
        {finalizados.length === 0 ? (
          <p className="mt-2 text-sm text-suave">Seus simulados finalizados aparecem aqui, com a nota e a evolução.</p>
        ) : (
          <ul className="mt-3 divide-y divide-borda">
            {finalizados.map((s) => {
              const r = s.resultado;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <Link to={`/simulado/${s.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    {r?.aprovado ? <CheckCircle2 className="h-6 w-6 shrink-0 text-sucesso" aria-label="Aprovada" /> : <XCircle className="h-6 w-6 shrink-0 text-perigo" aria-label="Abaixo do mínimo" />}
                    <span className="min-w-0">
                      <span className="block font-medium">{r ? `${r.pontos} de ${r.pontos_max} pontos` : 'Sem resultado'} <span className="text-sm font-normal text-suave">· {r?.acertos}/{r?.total} acertos</span></span>
                      <span className="flex items-center gap-1 text-xs text-suave">
                        {s.tipo === 'completo' ? 'Completo' : 'Rápido'} · {dataHora(s.iniciado_em)} · <Clock className="h-3 w-3" aria-hidden /> {formatarDuracao(r?.tempo_seg ?? 0)}
                      </span>
                    </span>
                  </Link>
                  <button
                    type="button"
                    className={cn('rounded-lg p-2 text-suave hover:bg-superficie-2 hover:text-perigo')}
                    aria-label="Excluir simulado"
                    onClick={() => { if (window.confirm('Excluir este simulado do histórico? As respostas dele também serão apagadas.')) excluir.mutate(s.id); }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
