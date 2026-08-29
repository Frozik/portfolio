import { isProduction } from '@frozik/utils/isProduction';

const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const CLOUDFLARE_BEACON_TOKEN = '69d3e6095bfd4da3a3f4a48b99237a97';

function injectCloudflareBeacon(): void {
  // Cloudflare RUM (Real User Monitoring) is hosted only behind the
  // production GitHub Pages deployment and rejects CORS for any other
  // origin. Skip it in dev to avoid the double
  // "Запрос из постороннего источника заблокирован" /
  // ERR_BLOCKED_BY_CLIENT noise that drowns out real warnings.
  if (!isProduction()) {
    return;
  }
  const script = document.createElement('script');
  script.src = CLOUDFLARE_BEACON_SRC;
  script.defer = true;
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: CLOUDFLARE_BEACON_TOKEN }));
  document.body.appendChild(script);
}

export function setupCloudflareBeacon(): void {
  if (document.readyState === 'complete') {
    injectCloudflareBeacon();
  } else {
    window.addEventListener('load', injectCloudflareBeacon, { once: true });
  }
}
