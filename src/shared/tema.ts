import { useEffect, useState } from 'react';

export type Tema = 'claro' | 'escuro' | 'sistema';
const CHAVE = 'pas:tema';

function ler(): Tema {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'claro' || v === 'escuro' ? v : 'sistema';
  } catch {
    return 'sistema';
  }
}

function aplicar(tema: Tema) {
  const escuro = tema === 'escuro' || (tema === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', Boolean(escuro));
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#080F1F' : '#1D4ED8');
}

export function useTema(): [Tema, (t: Tema) => void] {
  const [tema, setTema] = useState<Tema>(ler);
  useEffect(() => {
    aplicar(tema);
    try { localStorage.setItem(CHAVE, tema); } catch { /* armazenamento indisponível */ }
    if (tema !== 'sistema') return;
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const ouvir = () => aplicar('sistema');
    mq?.addEventListener('change', ouvir);
    return () => mq?.removeEventListener('change', ouvir);
  }, [tema]);
  return [tema, setTema];
}
