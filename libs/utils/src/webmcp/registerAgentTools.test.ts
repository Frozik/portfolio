import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import { defineAgentTool } from './agentTool';
import type { IModelContext, IModelContextTool } from './modelContext';
import { registerAgentTools } from './registerAgentTools';

function createFakeModelContext(): IModelContext & {
  readonly tools: ReadonlyMap<string, IModelContextTool>;
} {
  const tools = new Map<string, IModelContextTool>();
  return {
    tools,
    registerTool(tool, options) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
      return Promise.resolve();
    },
  };
}

const greet = defineAgentTool({
  name: 'greet',
  title: 'Greet',
  description: 'Greets someone by name.',
  input: z.object({ name: z.string().min(1) }),
  readOnly: true,
  execute: ({ name }) => ({ greeting: `Hello, ${name}` }),
});

function execute(tool: IModelContextTool | undefined, input: object): Promise<unknown> {
  assert(!isNil(tool), 'tool is not registered');
  return tool.execute(input, { signal: new AbortController().signal });
}

describe('registerAgentTools', () => {
  it('describes the input to the agent as JSON Schema', () => {
    const modelContext = createFakeModelContext();

    registerAgentTools(modelContext, [greet], new AbortController().signal);

    expect(modelContext.tools.get('greet')).toMatchObject({
      description: 'Greets someone by name.',
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', minLength: 1 } },
        required: ['name'],
      },
    });
  });

  it('runs the tool body with the parsed input', async () => {
    const modelContext = createFakeModelContext();
    registerAgentTools(modelContext, [greet], new AbortController().signal);

    await expect(execute(modelContext.tools.get('greet'), { name: 'Ada' })).resolves.toEqual({
      greeting: 'Hello, Ada',
    });
  });

  it('answers arguments that break the schema with the reason instead of running the body', async () => {
    const modelContext = createFakeModelContext();
    registerAgentTools(modelContext, [greet], new AbortController().signal);

    await expect(execute(modelContext.tools.get('greet'), { name: 42 })).resolves.toEqual({
      error: expect.stringMatching(/name/),
    });
  });

  it('withdraws every tool once the registration is aborted', () => {
    const modelContext = createFakeModelContext();
    const controller = new AbortController();
    registerAgentTools(modelContext, [greet], controller.signal);

    controller.abort();

    expect(modelContext.tools.size).toBe(0);
  });
});
