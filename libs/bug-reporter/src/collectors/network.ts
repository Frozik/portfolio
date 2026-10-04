import type { TNow } from '../core/clock';
import type { INetworkEntry } from '../core/report';
import { sanitizeUrl } from '../core/sanitize-url';

type TPush = (entry: INetworkEntry) => void;

/**
 * Method, address, status and duration of every fetch and XHR — never
 * headers, bodies or query strings, which is where credentials travel.
 */
export function captureNetwork(push: TPush, now: TNow): () => void {
  const restoreFetch = patchFetch(push, now);
  const restoreXhr = patchXhr(push, now);
  return () => {
    restoreFetch();
    restoreXhr();
  };
}

function patchFetch(push: TPush, now: TNow): () => void {
  const original = window.fetch;
  const patched: typeof window.fetch = (input, init) => {
    const startedAt = performance.now();
    const timestamp = now();
    const method = (
      init?.method ?? (input instanceof Request ? input.method : 'GET')
    ).toUpperCase();
    const url = sanitizeUrl(input instanceof Request ? input.url : String(input), location.href);
    const promise = original.call(window, input, init);
    const settle = (status: number | null, failed: boolean) =>
      push({
        timestamp,
        transport: 'fetch',
        method,
        url,
        status,
        durationMs: Math.round(performance.now() - startedAt),
        failed,
      });
    promise.then(
      response => settle(response.status, !response.ok),
      () => settle(null, true)
    );
    return promise;
  };
  window.fetch = patched;
  return () => {
    if (window.fetch === patched) {
      window.fetch = original;
    }
  };
}

interface IXhrRequest {
  readonly method: string;
  readonly url: string;
}

function patchXhr(push: TPush, now: TNow): () => void {
  const requests = new WeakMap<XMLHttpRequest, IXhrRequest>();
  const { open, send } = XMLHttpRequest.prototype;
  const patchedOpen: typeof open = function patchedOpen(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async: boolean = true,
    username?: string | null,
    password?: string | null
  ) {
    requests.set(this, {
      method: method.toUpperCase(),
      url: sanitizeUrl(String(url), location.href),
    });
    open.call(this, method, url, async, username, password);
  };
  const patchedSend: typeof send = function patchedSend(this: XMLHttpRequest, body) {
    const request = requests.get(this);
    if (request !== undefined) {
      const startedAt = performance.now();
      const timestamp = now();
      this.addEventListener('loadend', () => {
        push({
          timestamp,
          transport: 'xhr',
          method: request.method,
          url: request.url,
          status: this.status === 0 ? null : this.status,
          durationMs: Math.round(performance.now() - startedAt),
          failed: this.status === 0 || this.status >= HTTP_ERROR_STATUS,
        });
      });
    }
    send.call(this, body);
  };
  XMLHttpRequest.prototype.open = patchedOpen;
  XMLHttpRequest.prototype.send = patchedSend;
  return () => {
    if (XMLHttpRequest.prototype.open === patchedOpen) {
      XMLHttpRequest.prototype.open = open;
    }
    if (XMLHttpRequest.prototype.send === patchedSend) {
      XMLHttpRequest.prototype.send = send;
    }
  };
}

const HTTP_ERROR_STATUS = 400;
