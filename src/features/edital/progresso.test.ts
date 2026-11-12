import { editalDoSeed } from '@/test/fixtures';
import { blocoPrioritario, indexar, resumir } from './progresso';
import type { MapaProgresso, StatusTopico } from './tipos';

const edital = editalDoSeed();
const indice = indexar(edital.topicos);
const folhas = edital.topicos.filter((t) => !indice.filhos.has(t.id));

function marcarDisciplina(id: string, status: StatusTopico, base: MapaProgresso = {}): MapaProgresso {
  const m = { ...base };
  for (const t of folhas.filter((f) => f.disciplina_id === id)) m[t.id] = status;
  return m;
}

describe('cálculo de progresso do edital', () => {
  it('começa em zero com todos os tópicos a estudar', () => {
    const r = resumir(edital, {});
    expect(r.geral).toBe(0);
    expect(r.contagem.nao_iniciado).toBe(r.totalEstudavel);
    expect(r.totalEstudavel).toBe(folhas.length);
  });

  it('chega a 100% com tudo dominado', () => {
    const tudo = Object.fromEntries(folhas.map((f) => [f.id, 'dominado' as const]));
    const r = resumir(edital, tudo);
    expect(r.geral).toBeCloseTo(1);
    expect(r.contagem.dominado).toBe(folhas.length);
  });

  it('pondera pelos pontos da prova: dominar Conhecimentos Específicos vale 60 de 90', () => {
    const r = resumir(edital, marcarDisciplina('ace26-ce', 'dominado'));
    expect(r.geral).toBeCloseTo(60 / 90);
    expect(r.porBloco.find((b) => b.bloco.id === 'ace26-bloco-ce')?.conclusao).toBeCloseTo(1);
  });

  it('dominar Português vale 20 de 90', () => {
    expect(resumir(edital, marcarDisciplina('ace26-pt', 'dominado')).geral).toBeCloseTo(20 / 90);
  });

  it('um item com subitens vale a média dos subitens (doenças do item 8)', () => {
    // Domina 11 das 11 doenças → item 8 completo = 1 de 12 itens de CE.
    const r = resumir(edital, Object.fromEntries(folhas.filter((f) => f.parent_id === 'ace26-ce-08').map((f) => [f.id, 'dominado'])));
    const ce = r.porDisciplina.find((d) => d.disciplina.id === 'ace26-ce');
    expect(ce?.conclusao).toBeCloseTo(1 / 12);
  });

  it('estudando vale 1/3 e revisando 2/3', () => {
    expect(resumir(edital, marcarDisciplina('ace26-ce', 'estudando')).geral).toBeCloseTo((60 / 90) / 3);
    expect(resumir(edital, marcarDisciplina('ace26-ce', 'revisando')).geral).toBeCloseTo((60 / 90) * (2 / 3));
  });

  it('sugere o bloco com mais pontos em aberto', () => {
    expect(blocoPrioritario(resumir(edital, {})).bloco.id).toBe('ace26-bloco-ce');
    const semCE = marcarDisciplina('ace26-ce', 'dominado');
    expect(blocoPrioritario(resumir(edital, semCE)).bloco.id).toBe('ace26-bloco-pt');
  });
});
