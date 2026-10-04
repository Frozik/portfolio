/**
 * WebMCP (`document.modelContext`) as the W3C draft describes it; the
 * TypeScript DOM lib does not know it yet. Chrome exposes it only behind the
 * origin trial or `chrome://flags/#enable-webmcp-testing`, so the member is
 * optional and every caller feature-detects.
 */

declare global {
  interface Document {
    readonly modelContext?: IModelContext;
  }
}

interface IModelContextToolAnnotations {
  readonly readOnlyHint?: boolean;
  readonly untrustedContentHint?: boolean;
  readonly consequentialHint?: boolean;
}

export interface IModelContextTool {
  readonly name: string;
  readonly title?: string;
  readonly description: string;
  readonly inputSchema?: object;
  readonly annotations?: IModelContextToolAnnotations;
  readonly execute: (input: object, options: { readonly signal: AbortSignal }) => Promise<unknown>;
}

export interface IModelContext {
  registerTool(tool: IModelContextTool, options?: { readonly signal?: AbortSignal }): Promise<void>;
}

export function getModelContext(): IModelContext | undefined {
  return typeof document === 'undefined' ? undefined : document.modelContext;
}
