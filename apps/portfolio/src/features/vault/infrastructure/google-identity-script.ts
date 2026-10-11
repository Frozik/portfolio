const GIS_SCRIPT = 'https://accounts.google.com/gsi/client';

let loading: Promise<IGoogleAccountsOauth2 | null> | null = null;

/** Google Identity Services, loaded once on demand; `null` when it cannot load. */
export function loadGoogleOauth2(): Promise<IGoogleAccountsOauth2 | null> {
  loading ??= new Promise(resolve => {
    const ready = window.google?.accounts?.oauth2;
    if (ready !== undefined) {
      resolve(ready);
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.addEventListener('load', () => resolve(window.google?.accounts?.oauth2 ?? null));
    script.addEventListener('error', () => {
      loading = null;
      resolve(null);
    });
    script.src = GIS_SCRIPT;
    document.head.append(script);
  });
  return loading;
}
