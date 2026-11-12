import sql from '../../../supabase/migrations/20261112120100_fase_a_edital_ace.sql?raw';
import seed from '../../../supabase/seed/edital-ace-2026.json';
import { editalDoSeed } from '@/test/fixtures';

describe('dados do edital nº 001/2026 (ACE)', () => {
  it('tem o número de itens de cada disciplina igual ao edital', () => {
    const itens = Object.fromEntries(seed.disciplinas.map((d) => [d.sigla, d.topicos.length]));
    expect(itens).toEqual({ CE: 12, PT: 17, SUS: 23, MUN: 3 });
  });

  it('soma 40 questões e 90 pontos, com mínimo de 54', () => {
    expect(seed.blocos.reduce((s, b) => s + b.num_questoes, 0)).toBe(40);
    expect(seed.blocos.reduce((s, b) => s + b.num_questoes * b.valor_questao, 0)).toBe(90);
    expect(seed.concurso.total_questoes).toBe(40);
    expect(seed.concurso.pontuacao_total).toBe(90);
    expect(seed.concurso.nota_minima).toBe(54);
  });

  it('a migração SQL está sincronizada com o JSON (rode npm run seed:gerar)', () => {
    for (const t of editalDoSeed().topicos) expect(sql).toContain(`'${t.id}'`);
    for (const t of editalDoSeed().topicos) expect(sql).toContain(t.titulo.replaceAll("'", "''"));
  });

  it('as etapas estão em ordem cronológica', () => {
    const datas = seed.etapas.map((e) => (e as { inicio?: string }).inicio).filter(Boolean) as string[];
    const ordenadas = [...datas].sort();
    // Isenção e inscrição começam no mesmo dia; o resto deve seguir a ordem do edital.
    expect(datas.filter((d, i) => d !== ordenadas[i])).toEqual([]);
  });
});
