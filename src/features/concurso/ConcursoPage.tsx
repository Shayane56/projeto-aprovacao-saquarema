import { Award, ExternalLink, ListChecks, Scale, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEdital } from '@/features/edital/hooks';
import { pontosDoBloco } from '@/features/edital/progresso';
import { dataLocal, dataPorExtenso, horaLocal, maiuscula } from '@/lib/datas';
import { Carregando, ErroCarga } from '@/shared/ui';
import { useEtapas } from './hooks';
import { ItemEtapa } from './ItemEtapa';

const real = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

export function ConcursoPage() {
  const edital = useEdital();
  const etapas = useEtapas();

  if (edital.isPending) return <Carregando />;
  if (edital.error || !edital.data) return <ErroCarga erro={edital.error} tentarDeNovo={() => void edital.refetch()} />;

  const { concurso: c, blocos } = edital.data;
  const prova = c.prova_inicio ? new Date(c.prova_inicio) : null;
  const regras = c.regras;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Concurso</h1>
        <p className="mt-1 text-sm text-suave">{c.nome} · {c.orgao}</p>
      </div>

      <section className="cartao p-5" aria-labelledby="titulo-cargo">
        <h2 id="titulo-cargo" className="text-lg font-semibold">{c.cargo} <span className="text-sm font-medium text-suave">· código {c.codigo_cargo}</span></h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          <Dado rotulo="Vagas" valor={`${c.vagas} (${c.vagas_ac} AC + ${c.vagas_pcd} PcD)`} />
          <Dado rotulo="Salário" valor={real(c.salario)} />
          <Dado rotulo="Jornada" valor={c.carga_horaria ?? '—'} />
          <Dado rotulo="Taxa de inscrição" valor={real(c.taxa_inscricao)} />
          <Dado rotulo="Escolaridade" valor={c.escolaridade ?? '—'} amplo />
          <Dado rotulo="Banca" valor={c.banca} amplo />
        </dl>
        {c.link_oficial && (
          <a href={c.link_oficial} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primaria hover:underline">
            Site oficial do IBAM <ExternalLink className="h-4 w-4" aria-hidden />
          </a>
        )}
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-prova">
        <h2 id="titulo-prova" className="font-semibold">Prova objetiva</h2>
        {prova && (
          <p className="mt-1 text-sm text-suave">
            {maiuscula(dataPorExtenso(dataLocal(prova)))} · portão {c.portao_abre ? horaLocal(new Date(c.portao_abre)) : ''}–{c.portao_fecha ? horaLocal(new Date(c.portao_fecha)) : ''} · início {horaLocal(prova)} · {(c.duracao_min ?? 0) / 60}h
          </p>
        )}
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-borda text-left text-xs uppercase tracking-wide text-suave">
                <th className="py-2 pr-2 font-semibold">Disciplina</th>
                <th className="px-1.5 py-2 text-center font-semibold">Qtd.</th>
                <th className="px-1.5 py-2 text-center font-semibold">Valor</th>
                <th className="py-2 pl-1.5 text-right font-semibold">Máx.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borda">
              {blocos.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 pr-3 font-medium">{b.nome}</td>
                  <td className="px-2 py-2.5 text-center">{b.num_questoes}</td>
                  <td className="px-2 py-2.5 text-center">{b.valor_questao}</td>
                  <td className="py-2.5 pl-2 text-right font-semibold">{pontosDoBloco(b)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="py-2.5 pr-3">Total</td>
                <td className="px-2 py-2.5 text-center">{c.total_questoes}</td>
                <td className="px-2 py-2.5" />
                <td className="py-2.5 pl-2 text-right">{c.pontuacao_total}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-suave">{c.alternativas} alternativas por questão (A a D).</p>
        {regras.aprovacao && (
          <div className="mt-4 rounded-xl border border-primaria/25 bg-primaria-suave/50 p-3.5 text-sm">
            <p className="font-semibold text-primaria">Para ser aprovada</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">{regras.aprovacao.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        )}
      </section>

      <section className="cartao p-5" aria-labelledby="titulo-cronograma">
        <h2 id="titulo-cronograma" className="font-semibold">Cronograma do processo seletivo</h2>
        <p className="mt-1 text-sm text-suave">Datas previstas no edital. Marque as etapas que dependem de você quando concluí-las.</p>
        <div className="mt-5 space-y-5">
          {etapas.carregando ? <Carregando /> : etapas.erro && !etapas.etapas ? (
            <ErroCarga erro={etapas.erro} />
          ) : (
            etapas.etapas?.map((e) => <ItemEtapa key={e.id} etapa={e} concluida={etapas.concluidas.has(e.id)} />)
          )}
        </div>
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        {regras.etapas_selecao && (
          <Lista titulo="Etapas da seleção" icone={<ListChecks className="h-5 w-5 text-primaria" aria-hidden />}>
            {regras.etapas_selecao.map((e) => <li key={e.etapa}><strong>{e.etapa}:</strong> {e.descricao}</li>)}
          </Lista>
        )}
        {regras.desempate && (
          <Lista titulo="Critérios de desempate" icone={<Scale className="h-5 w-5 text-primaria" aria-hidden />} numerada>
            {regras.desempate.map((d) => <li key={d}>{d}</li>)}
          </Lista>
        )}
        {regras.titulos && (
          <Lista titulo="Prova de títulos (classificatória)" icone={<Award className="h-5 w-5 text-primaria" aria-hidden />}>
            {regras.titulos.map((t) => <li key={t.item}>{t.item} — <strong>{t.pontos}</strong></li>)}
          </Lista>
        )}
        {regras.dicas_prova && (
          <Lista titulo="Atenção no dia da prova" icone={<TriangleAlert className="h-5 w-5 text-alerta" aria-hidden />}>
            {regras.dicas_prova.map((d) => <li key={d}>{d}</li>)}
          </Lista>
        )}
      </div>
      <p className="text-xs text-suave">Informações do Edital nº 001/2026. Confira sempre retificações e comunicados no site oficial do IBAM.</p>
    </div>
  );
}

function Dado({ rotulo, valor, amplo }: { rotulo: string; valor: string; amplo?: boolean }) {
  return (
    <div className={amplo ? 'col-span-2' : undefined}>
      <dt className="rotulo">{rotulo}</dt>
      <dd className="mt-0.5 font-medium">{valor}</dd>
    </div>
  );
}

function Lista({ titulo, icone, numerada, children }: { titulo: string; icone: ReactNode; numerada?: boolean; children: ReactNode }) {
  const Tag = numerada ? 'ol' : 'ul';
  return (
    <section className="cartao p-5">
      <h2 className="flex items-center gap-2 font-semibold">{icone}{titulo}</h2>
      <Tag className={`mt-3 space-y-1.5 pl-5 text-sm ${numerada ? 'list-decimal' : 'list-disc'}`}>{children}</Tag>
    </section>
  );
}
