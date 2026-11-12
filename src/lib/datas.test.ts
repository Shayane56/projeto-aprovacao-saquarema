import { contagemAte, dataLocal, diasEntre } from './datas';

describe('datas no fuso de Brasília', () => {
  const prova = new Date('2027-01-31T15:10:00-03:00');

  it('usa a data de Brasília mesmo perto da meia-noite UTC', () => {
    expect(dataLocal(new Date('2026-11-13T01:30:00Z'))).toBe('2026-11-12');
  });

  it('conta os dias de calendário até a prova', () => {
    expect(contagemAte(prova, new Date('2026-11-12T20:00:00-03:00')).diasCalendario).toBe(80);
    expect(contagemAte(prova, new Date('2027-01-30T23:59:00-03:00')).diasCalendario).toBe(1);
    expect(contagemAte(prova, new Date('2027-01-31T08:00:00-03:00')).diasCalendario).toBe(0);
  });

  it('marca como encerrada depois do início', () => {
    expect(contagemAte(prova, new Date('2027-01-31T15:11:00-03:00')).encerrada).toBe(true);
  });

  it('calcula diferença de dias entre datas civis', () => {
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
  });
});
