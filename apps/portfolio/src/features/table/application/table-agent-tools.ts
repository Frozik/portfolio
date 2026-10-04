import { defineTableTools } from '@frozik/table/agent/table-agent-tools';
import type { ITableKernel } from '@frozik/table/core/kernel/kernel';
import type { IAgentTool } from '@frozik/utils/webmcp/agentTool';

import type { IDemoTrade } from '../domain/demo-trade';
import { CANCELLED_TRADE_REASON } from '../domain/demo-trade';

/** The showcase table through the library's own tools, with the demo's guard spelled out. */
export function createTableAgentTools(
  table: ITableKernel<IDemoTrade, unknown>
): readonly IAgentTool[] {
  return defineTableTools({
    prefix: 'trades',
    table,
    reasons: { [CANCELLED_TRADE_REASON]: 'A cancelled trade can only change its status' },
  });
}
