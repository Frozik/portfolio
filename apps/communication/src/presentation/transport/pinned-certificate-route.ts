import type { PinnedCertificateBody } from '@frozik/transport/shared/pinned-certificate';
import { PINNED_CERTIFICATE_SUFFIX } from '@frozik/transport/shared/pinned-certificate';
import type { FastifyInstance } from 'fastify';

const HTTP_NOT_FOUND = 404;

/** Development only: where browsers read the self-signed HTTP/3 certificate to pin. 404 with a real one. */
export function registerPinnedCertificateRoute(
  app: FastifyInstance,
  path: string,
  pinned: () => PinnedCertificateBody | undefined
): void {
  app.get(`${path}${PINNED_CERTIFICATE_SUFFIX}`, async (_request, reply) => {
    const certificate = pinned();
    return certificate === undefined ? reply.status(HTTP_NOT_FOUND).send() : certificate;
  });
}
