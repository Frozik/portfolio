import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import type { IServerConfig } from '../../application/config/server-config-schema';
import type { IServerLogger } from '../../application/ports/IServerLogger';
import type { CertWatcher } from '../../infrastructure/CertWatcher';
import { startCertWatcher } from '../../infrastructure/CertWatcher';

function isHttpsServer(server: HttpServer): server is HttpsServer {
  // `setSecureContext` is the load-bearing method — duck-typing avoids a
  // runtime import of node:https.
  return typeof (server as { setSecureContext?: unknown }).setSecureContext === 'function';
}

function describe(caught: unknown): string {
  return caught instanceof Error ? caught.message : String(caught);
}

/**
 * Zero-drop TLS context reload: watch the cert and key and swap them into the
 * running https server whenever they change, so active Socket.IO sessions live
 * across certificate renewals. Best-effort — on any error the existing context
 * stays in place and the next certbot deploy hook retries. Null without TLS.
 */
export function watchTlsCertificates(
  tls: IServerConfig['server']['tls'],
  httpServer: HttpServer,
  logger: IServerLogger
): CertWatcher | null {
  if (!tls.enabled || !isHttpsServer(httpServer)) {
    return null;
  }
  const httpsServer = httpServer;
  return startCertWatcher({
    certPath: tls.cert_path,
    keyPath: tls.key_path,
    onReload: ({ cert, key }) => {
      try {
        httpsServer.setSecureContext({ cert, key });
        logger.info('cert-watcher.reloaded', { source: 'fs.watch' });
      } catch (caught) {
        logger.warn('cert-watcher.set-secure-context-failed', { message: describe(caught) });
      }
    },
    onError: caught => {
      logger.warn('cert-watcher.refresh-failed', { message: describe(caught) });
    },
  });
}
