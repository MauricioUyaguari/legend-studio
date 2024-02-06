export function registerServicerWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register(
        new URL('./ServiceWorker.js', import.meta.url),
        // TODO: remove the scope
        {
          scope: '/',
        },
      )
      .then((reg) => {
        console.log('regsitexxxxred', reg);
      })
      .catch((error) => {
        console.log('error', error);
      });
  }
}
