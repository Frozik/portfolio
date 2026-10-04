import { z } from 'zod';

/**
 * One tool an agent can call, already erased to a uniform shape: the input
 * schema is plain JSON Schema and `run` refuses whatever the agent sent that
 * breaks it before the typed body sees it — agents do send hallucinated arguments.
 */
export interface IAgentTool {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: object;
  readonly readOnly: boolean;
  readonly run: (input: unknown, signal: AbortSignal) => Promise<unknown>;
}

/**
 * A mistake the agent can correct, returned rather than thrown: Chrome replaces
 * a thrown error with a bare "invocation failed", so the reason would be lost.
 */
export interface IAgentToolRefusal {
  readonly error: string;
}

export function refuse(reason: string): IAgentToolRefusal {
  return { error: reason };
}

export function defineAgentTool<TInput extends z.ZodObject>({
  name,
  title,
  description,
  input,
  readOnly = false,
  execute,
}: {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: TInput;
  readonly readOnly?: boolean;
  readonly execute: (input: z.output<TInput>, signal: AbortSignal) => unknown;
}): IAgentTool {
  return {
    name,
    title,
    description,
    inputSchema: z.toJSONSchema(input),
    readOnly,
    async run(rawInput, signal) {
      const parsed = input.safeParse(rawInput ?? {});
      if (!parsed.success) {
        return refuse(z.prettifyError(parsed.error));
      }
      return execute(parsed.data, signal);
    },
  };
}
