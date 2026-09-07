import { pathToFileURL } from 'node:url';
import { parentPort, workerData } from 'node:worker_threads';

/**
 * Renders the landing in one language. Translations resolve from
 * `navigator.language` when their modules load, so each language needs a
 * module registry of its own — a worker thread, never the plugin's.
 */
interface PrerenderWorkerData {
  readonly language: string;
  readonly bundlePath: string;
}

const { language, bundlePath } = workerData as PrerenderWorkerData;

Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true });

const { renderLanding } = (await import(pathToFileURL(bundlePath).href)) as {
  readonly renderLanding: () => string;
};

parentPort?.postMessage(renderLanding());
