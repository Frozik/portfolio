const CLOUDFLARE_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';
const CLOUDFLARE_BEACON_TOKEN = '69d3e6095bfd4da3a3f4a48b99237a97';
/**
 * Cloudflare RUM accepts requests only from deployed origins and answers a
 * local one (dev server, `vite preview`, a phone on the LAN, Lighthouse runs)
 * with a CORS error, so the beacon is keyed on the hostname, not on the build
 * mode. Loopback, `.local` and RFC 1918 addresses count as local.
 */
const LOCAL_HOSTNAME_PATTERN =
  /^(localhost|127(\.\d+){3}|\[::1\]|10(\.\d+){3}|192\.168(\.\d+){2}|172\.(1[6-9]|2\d|3[01])(\.\d+){2}|.+\.local)$/;

function injectCloudflareBeacon(): void {
  if (LOCAL_HOSTNAME_PATTERN.test(window.location.hostname)) {
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
