import { loadConfig } from './infrastructure/load-config';
import { bootstrap } from './presentation/bootstrap';

// Safety net: a single escaped rejection must not take down every active
// call on the relay. Handler bugs are logged and the process stays up
// (uncaught synchronous exceptions still crash — state may be corrupt there).
process.on('unhandledRejection', reason => {
  // biome-ignore lint/suspicious/noConsole: process-level safety net runs outside the request-scoped logger
  console.error('[communication] unhandled rejection', reason);
});

const config = await loadConfig();
const { start, drain } = await bootstrap(config);

await start();

const shutdown = async (signal: string): Promise<void> => {
  // biome-ignore lint/suspicious/noConsole: bootstrap-time stdout before logger is wired into systemd
  console.log(`[communication] received ${signal}, draining`);
  await drain(config.server.shutdown_grace_ms);
  process.exit(0);
};

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
