import { getIsHosted } from '@frozik/utils/isHosted';

/**
 * Developer-only channel for WebGPU diagnostics that never reach application
 * state: WGSL compilation messages and uncaptured device errors. Safari in
 * particular stays silent about broken pipelines, so during development the
 * console is the only place they can surface. Silent on the hosted build.
 */
function reportGpuDiagnostic(message: string, detail?: unknown): void {
  if (getIsHosted()) {
    return;
  }
  // biome-ignore lint/suspicious/noConsole: the single developer-only WebGPU diagnostics sink
  console.warn(`binance-view: ${message}`, detail);
}

export function reportShaderDiagnostics(module: GPUShaderModule, label: string): void {
  void module.getCompilationInfo().then(info => {
    for (const message of info.messages) {
      reportGpuDiagnostic(
        `shader[${label}] ${message.type} L${message.lineNum}:${message.linePos}`,
        message.message
      );
    }
  });
}

/** Listens for the device's whole lifetime; a broken pipeline would otherwise be a silent blank canvas. */
export function reportUncapturedDeviceErrors(device: GPUDevice): void {
  device.addEventListener('uncapturederror', (event: GPUUncapturedErrorEvent) => {
    reportGpuDiagnostic(`webgpu ${event.error.constructor.name}`, event.error.message);
  });
}
