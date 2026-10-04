import type { IAgentTool } from './agentTool';
import type { IModelContext } from './modelContext';

/** Registers every tool until `signal` aborts; aborting is how WebMCP unregisters. */
export function registerAgentTools(
  modelContext: IModelContext,
  tools: readonly IAgentTool[],
  signal: AbortSignal
): void {
  for (const tool of tools) {
    void modelContext
      .registerTool(
        {
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: { readOnlyHint: tool.readOnly },
          execute: (input, { signal: executionSignal }) => tool.run(input, executionSignal),
        },
        { signal }
      )
      .catch((error: unknown) => {
        throw new Error(`WebMCP rejected the "${tool.name}" tool`, { cause: error });
      });
  }
}
