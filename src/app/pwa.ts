/**
 * Registro do service worker (PWA). Em testes e no modo de desenvolvimento
 * não há service worker — a função simplesmente não faz nada.
 */
export function registrarServiceWorker(aoTerNovaVersao: (atualizar: () => Promise<void>) => void): () => void {
  if (import.meta.env.DEV || import.meta.env.MODE === 'test' || !('serviceWorker' in navigator)) return () => {};
  let cancelado = false;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    if (cancelado) return;
    const atualizar = registerSW({
      onNeedRefresh: () => aoTerNovaVersao(() => atualizar(true)),
      onRegisteredSW: (_url, reg) => {
        // Verifica atualizações a cada hora enquanto o app estiver aberto.
        if (reg) window.setInterval(() => void reg.update(), 60 * 60 * 1000);
      },
    });
  });
  return () => {
    cancelado = true;
  };
}
