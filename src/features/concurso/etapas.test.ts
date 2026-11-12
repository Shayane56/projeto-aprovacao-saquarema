import { etapasDoSeed } from '@/test/fixtures';
import { classificarEtapas, descreverPrazo, proximosPrazos } from './etapas';

const etapas = etapasDoSeed();
const porTitulo = (lista: ReturnType<typeof classificarEtapas>, t: string) => lista.find((e) => e.titulo.startsWith(t))!;

describe('situação das etapas do concurso', () => {
  it('em 12/11/2026: edital publicado, isenção próxima, prova futura', () => {
    const l = classificarEtapas(etapas, '2026-11-12');
    expect(porTitulo(l, 'Publicação do edital').situacao).toBe('encerrada');
    expect(porTitulo(l, 'Pedido de isenção').situacao).toBe('proxima');
    expect(descreverPrazo(porTitulo(l, 'Pedido de isenção'))).toBe('Em 5 dias');
    expect(porTitulo(l, 'Prova objetiva').situacao).toBe('futura');
    expect(porTitulo(l, 'Prova objetiva').diasParaInicio).toBe(80);
  });

  it('em 18/11/2026: isenção e inscrição em andamento', () => {
    const l = classificarEtapas(etapas, '2026-11-18');
    expect(porTitulo(l, 'Pedido de isenção').situacao).toBe('em_andamento');
    expect(descreverPrazo(porTitulo(l, 'Pedido de isenção'))).toBe('Termina amanhã');
    expect(porTitulo(l, 'Inscrições').situacao).toBe('em_andamento');
  });

  it('no dia da prova a etapa aparece como "hoje"', () => {
    const l = classificarEtapas(etapas, '2027-01-31');
    expect(descreverPrazo(porTitulo(l, 'Prova objetiva'))).toBe('É hoje');
  });

  it('próximos prazos escondem ações já marcadas como feitas', () => {
    const l = classificarEtapas(etapas, '2026-11-18');
    const isencao = porTitulo(l, 'Pedido de isenção');
    expect(proximosPrazos(l, new Set(), 3).map((e) => e.id)).toContain(isencao.id);
    expect(proximosPrazos(l, new Set([isencao.id]), 3).map((e) => e.id)).not.toContain(isencao.id);
  });

  it('o Curso de Formação aparece sem data', () => {
    const l = classificarEtapas(etapas, '2026-11-12');
    expect(descreverPrazo(porTitulo(l, 'Curso de Formação'))).toBe('Data a definir');
  });
});
