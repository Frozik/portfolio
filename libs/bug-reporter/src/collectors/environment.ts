import { isNil } from 'lodash-es';
import '../platform/browser-apis';

import type { TNow } from '../core/clock';
import type { IConnectionInfo, IEnvironment, IGpuInfo } from '../core/report';

const HIGH_ENTROPY_HINTS = ['platform', 'platformVersion', 'fullVersionList'];

/** Everything about the device and browser a developer asks for first, read fresh at report time. */
export async function snapshotEnvironment(
  now: TNow,
  gpu: () => Promise<IGpuInfo | null>
): Promise<IEnvironment> {
  const [agent, storage, gpuInfo] = await Promise.all([readUserAgent(), readStorage(), gpu()]);
  return {
    capturedAt: now(),
    url: location.href,
    referrer: document.referrer,
    pageTitle: document.title,
    userAgent: navigator.userAgent,
    brands: agent.brands,
    platform: agent.platform,
    language: navigator.language,
    languages: [...navigator.languages],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemoryGb: navigator.deviceMemory ?? null,
    connection: readConnection(),
    screen: {
      width: window.screen.width,
      height: window.screen.height,
      colorDepth: window.screen.colorDepth,
    },
    viewport: {
      width: Math.round(window.visualViewport?.width ?? window.innerWidth),
      height: Math.round(window.visualViewport?.height ?? window.innerHeight),
      scale: window.visualViewport?.scale ?? 1,
    },
    devicePixelRatio: window.devicePixelRatio,
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    pointer: window.matchMedia('(pointer: fine)').matches
      ? 'fine'
      : window.matchMedia('(pointer: coarse)').matches
        ? 'coarse'
        : 'none',
    online: navigator.onLine,
    visibility: document.visibilityState,
    crossOriginIsolated: window.crossOriginIsolated,
    storage,
    gpu: gpuInfo,
  };
}

/** Requests the adapter once per page: Chromium rate-limits the call and the answer never changes. */
export function createGpuInfoReader(): () => Promise<IGpuInfo | null> {
  let pending: Promise<IGpuInfo | null> | null = null;
  return () => {
    pending ??= readGpu();
    return pending;
  };
}

async function readGpu(): Promise<IGpuInfo | null> {
  if (isNil(navigator.gpu)) {
    return null;
  }
  const adapter = await navigator.gpu.requestAdapter();
  if (isNil(adapter)) {
    return null;
  }
  const { vendor, architecture, device, description } = adapter.info;
  return { vendor, architecture, device, description, features: [...adapter.features] };
}

async function readUserAgent(): Promise<Pick<IEnvironment, 'brands' | 'platform'>> {
  const data = navigator.userAgentData;
  if (isNil(data)) {
    return { brands: [], platform: null };
  }
  const detailed = await data.getHighEntropyValues(HIGH_ENTROPY_HINTS).catch(() => undefined);
  const brands = detailed?.fullVersionList ?? data.brands;
  const version = detailed?.platformVersion;
  const platform = isNil(version) || version === '' ? data.platform : `${data.platform} ${version}`;
  return {
    brands: brands.map(({ brand, version: brandVersion }) => ({ brand, version: brandVersion })),
    platform,
  };
}

async function readStorage(): Promise<IEnvironment['storage']> {
  if (isNil(navigator.storage?.estimate)) {
    return null;
  }
  const estimate = await navigator.storage.estimate();
  return { usageBytes: estimate.usage ?? 0, quotaBytes: estimate.quota ?? 0 };
}

function readConnection(): IConnectionInfo | null {
  const connection = navigator.connection;
  if (isNil(connection)) {
    return null;
  }
  return {
    effectiveType: connection.effectiveType ?? 'unknown',
    rttMs: connection.rtt ?? 0,
    downlinkMbps: connection.downlink ?? 0,
    saveData: connection.saveData ?? false,
  };
}
