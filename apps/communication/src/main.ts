import { loadConfig } from './infrastructure/load-config';
import { bootstrap } from './presentation/bootstrap';

const config = loadConfig();
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
