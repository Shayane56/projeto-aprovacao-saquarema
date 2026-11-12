import { editalDoSeed } from '@/test/fixtures';
import { disciplinaPorSecao, sugerirTopico } from './classificar';
import { lerGabarito } from './gabarito';
import { avisosDaQuestao, extrairQuestoes } from './parser';

const PROVA = `
PREFEITURA MUNICIPAL DE EXEMPLO
Processo Seletivo 2024 - Agente de Combate às Endemias
LÍNGUA PORTUGUESA
Leia o texto a seguir para responder às questões 01 e 02.
TEXTO I
O mosquito da dengue se reproduz em água parada e limpa. Por isso, a pre-
venção depende de todos.
01. De acordo com o texto, a prevenção da dengue depende:
(A) apenas dos agentes.
(B) de todos.
(C) do governo federal.
(D) dos médicos.
02. A palavra "limpa" pode ser substituída, sem
alteração de sentido, por:
(A) suja.
(B) turva.
(C) transparente e sem
resíduos.
(D) salgada.
PREFEITURA MUNICIPAL DE EXEMPLO
CONHECIMENTOS ESPECÍFICOS
03. O vetor da malária é o mosquito:
(A) Aedes.
(B) Anopheles.
(C) Culex.
(D) Lutzomyia.
Página 2 de 3
04) A leptospirose é transmitida principalmente:
a) pela picada de mosquito.
b) pela urina de ratos.
c) pelo ar.
d) pela água do mar.
PREFEITURA MUNICIPAL DE EXEMPLO
`;

describe('leitura da prova', () => {
  const { questoes, textos } = extrairQuestoes(PROVA);

  it('encontra as 4 questões em sequência com 4 alternativas cada', () => {
    expect(questoes.map((q) => q.numero)).toEqual([1, 2, 3, 4]);
    for (const q of questoes) expect(q.alternativas).toHaveLength(4);
  });

  it('junta linhas quebradas e palavras hifenizadas', () => {
    expect(questoes[1].enunciado).toBe('A palavra "limpa" pode ser substituída, sem alteração de sentido, por:');
    expect(questoes[1].alternativas[2]).toBe('transparente e sem resíduos.');
    expect(textos[0].conteudo).toContain('a prevenção depende de todos');
  });

  it('associa o texto de apoio apenas às questões indicadas', () => {
    expect(textos).toHaveLength(1);
    expect(questoes[0].texto).toBe(0);
    expect(questoes[1].texto).toBe(0);
    expect(questoes[2].texto).toBeNull();
  });

  it('identifica a seção (disciplina) de cada questão', () => {
    expect(questoes[0].secao).toBe('LÍNGUA PORTUGUESA');
    expect(questoes[3].secao).toBe('CONHECIMENTOS ESPECÍFICOS');
  });

  it('remove cabeçalhos repetidos e números de página', () => {
    expect(questoes[2].alternativas[3]).toBe('Lutzomyia.');
    expect(JSON.stringify(questoes)).not.toContain('PREFEITURA');
  });

  it('aceita o formato "Questão 1" e alternativas com ponto', () => {
    const r = extrairQuestoes('Questão 1\nQual é a capital do RJ?\nA. Niterói\nB. Rio de Janeiro\nC. Saquarema\nD. Cabo Frio\nQuestão 2 Outra pergunta?\nA. um\nB. dois\nC. três\nD. quatro');
    expect(r.questoes).toHaveLength(2);
    expect(r.questoes[0].enunciado).toBe('Qual é a capital do RJ?');
    expect(r.questoes[1].alternativas[1]).toBe('dois');
  });

  it('aponta problemas para revisão', () => {
    expect(avisosDaQuestao({ enunciado: 'Pergunta completa aqui?', alternativas: ['a', 'b', 'c'], gabarito: null, anulada: false })).toEqual([
      '3 alternativas (a prova do IBAM tem 4)', 'Sem gabarito',
    ]);
  });
});

describe('leitura do gabarito', () => {
  it('formato número-letra, com anulada', () => {
    const g = lerGabarito('01-A 02-C 03 - B 04-X 05 ANULADA 06.d');
    expect([...g.entries()]).toEqual([[1, 0], [2, 2], [3, 1], [4, 'anulada'], [5, 'anulada'], [6, 3]]);
  });

  it('sequência de letras', () => {
    expect([...lerGabarito('A C B D *').entries()]).toEqual([[1, 0], [2, 2], [3, 1], [4, 3], [5, 'anulada']]);
  });

  it('tabela copiada com quebras de linha', () => {
    const g = lerGabarito('1\tB\n2\tD\n3\tA');
    expect(g.get(2)).toBe(3);
  });
});

describe('classificação automática', () => {
  const edital = editalDoSeed();
  it('sugere a disciplina pela seção', () => {
    expect(disciplinaPorSecao('LÍNGUA PORTUGUESA', edital)).toBe('ace26-pt');
    expect(disciplinaPorSecao('CONHECIMENTOS ESPECÍFICOS', edital)).toBe('ace26-ce');
    expect(disciplinaPorSecao('LEGISLAÇÃO DO SUS', edital)).toBe('ace26-sus');
    expect(disciplinaPorSecao('CONHECIMENTOS GERAIS DO MUNICÍPIO', edital)).toBe('ace26-mun');
  });
  it('sugere o tópico por palavras em comum', () => {
    expect(sugerirTopico('A leptospirose é transmitida pela urina de ratos', 'ace26-ce', edital)?.titulo).toBe('Leptospirose');
    expect(sugerirTopico('Assinale a alternativa com crase correta', 'ace26-pt', edital)?.titulo).toBe('Crase.');
  });
});
