import { Code, ConnectError } from '@connectrpc/connect';
import type { CallOutcome, CallRecord } from '@frozik/transport/server/call-recorder';
import { describe, expect, it } from 'vitest';

import type { IServerLogger } from '../../application/ports/IServerLogger';
import { logCall } from './call-log';

type Level = 'info' | 'warn' | 'error' | 'debug';

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736';

function recordingLogger() {
  const lines: { level: Level; msg: string; fields: Record<string, unknown> | undefined }[] = [];
  const at =
    (level: Level) =>
    (msg: string, fields?: Record<string, unknown>): void => {
      lines.push({ level, msg, fields });
    };
  const logger: IServerLogger = {
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
    debug: at('debug'),
    child: () => logger,
  };
  return { logger, lines };
}

function recordOf(outcome: CallOutcome): CallRecord {
  return {
    traceId: TRACE_ID,
    procedure: 'frozik.transport.v1.PlotService/Sample',
    protocol: 'websocket',
    clientAddress: '203.0.113.7',
    durationMs: 12.4,
    requests: [{ expression: 'x +' }],
    requestCount: 1,
    responseCount: 0,
    outcome,
  };
}

describe('transport call log', () => {
  it('writes a finished call as one debug line under its trace id, without the client address', () => {
    const { logger, lines } = recordingLogger();

    logCall(logger, recordOf({ kind: 'ok' }));

    expect(lines).toEqual([
      {
        level: 'debug',
        msg: 'transport.call',
        fields: expect.objectContaining({
          trace_id: TRACE_ID,
          duration_ms: 12,
          requests: [{ expression: 'x +' }],
          outcome: 'ok',
        }),
      },
    ]);
    expect(JSON.stringify(lines)).not.toContain('203.0.113.7');
  });

  it.each([
    ['a refused request without a stack', Code.InvalidArgument, false],
    ['a server fault with its stack', Code.Internal, true],
  ] as const)('writes %s, at debug too', (_, code, hasStack) => {
    const { logger, lines } = recordingLogger();

    logCall(logger, recordOf({ kind: 'failed', error: new ConnectError('no', code) }));

    expect(lines[0]?.level).toBe('debug');
    expect(lines[0]?.fields).toEqual(
      expect.objectContaining({ trace_id: TRACE_ID, code: Code[code], message: 'no' })
    );
    expect(lines[0]?.fields?.stack !== undefined).toBe(hasStack);
  });
});
