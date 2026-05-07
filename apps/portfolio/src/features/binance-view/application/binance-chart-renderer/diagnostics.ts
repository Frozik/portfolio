/**
 * Fire off an async `getCompilationInfo()` query on a freshly created
 * shader module and log every diagnostic (error / warning / info) to
 * the console. WGSL compilers — Safari especially — stay silent in
 * `createShaderModule` and only surface problems via this API, so
 * anything breaking a shader build shows up here with line / column
 * info instead of a cryptic pipeline-creation validation error.
 *
 * Non-blocking: we don't await it so pipeline creation isn't delayed
 * in the happy path. The promise is fire-and-forget.
 */
export function logShaderDiagnostics(module: GPUShaderModule, label: string): void {
  void module.getCompilationInfo().then(info => {
    for (const message of info.messages) {
      const prefix = `binance-view: shader[${label}] ${message.type} L${message.lineNum}:${message.linePos} —`;
      if (message.type === 'error') {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile errors to aid cross-browser debugging
        console.error(prefix, message.message);
      } else if (message.type === 'warning') {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile warnings to aid cross-browser debugging
        console.warn(prefix, message.message);
      } else {
        // biome-ignore lint/suspicious/noConsole: surfaces WGSL compile info to aid cross-browser debugging
        console.info(prefix, message.message);
      }
    }
  });
}

/**
 * Force-compile a render pipeline via `createRenderPipelineAsync` and
 * log a detailed failure reason if compilation rejects. Unlike the
 * sync `createRenderPipeline` (which validates lazily at first draw
 * on some back-ends — notably Safari/Metal), the async variant
 * resolves only after the vertex / fragment libraries are fully
 * compiled, so a rejection carries the real error text rather than
 * the generic "Vertex library failed creation" that shows up later
 * in an uncapturederror.
 */
export async function createPipelineWithLogging(
  device: GPUDevice,
  label: string,
  descriptor: GPURenderPipelineDescriptor
): Promise<GPURenderPipeline | null> {
  try {
    return await device.createRenderPipelineAsync(descriptor);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // biome-ignore lint/suspicious/noConsole: surfaces pipeline compile errors to aid cross-browser debugging
    console.error(
      `binance-view: pipeline[${label}] createRenderPipelineAsync failed —`,
      message,
      error
    );
    return null;
  }
}
