import type { IFxDrawContext } from '../types';
import { pseudoRandom } from '../utils';

const LANE_COUNT = 5;
const PADDING_RATIO = 0.08;
const NODE_WIDTH_RATIO = 0.07;
const PACKET_WIDTH_RATIO = 0.035;
const PACKET_HEIGHT_RATIO = 0.035;
const PACKETS_PER_LANE = 4;
const SPEED_MIN = 0.12;
const SPEED_MAX = 0.3;
const NODE_ALPHA = 0.3;
const LANE_ALPHA = 0.1;
const OUTBOUND_ALPHA = 0.45;
const ECHO_ALPHA = 0.25;
/** The lane where the reader is slow: packets bunch up at the far end instead of piling past it. */
const STALLED_LANE = 2;
const STALL_PERIOD_SECONDS = 4;
const STALL_SHARE = 0.5;
const STALL_SPACING = 1.4;

/**
 * Parallel streams between a browser and a server: packets travel out, the
 * echo travels back, and on one lane a slow reader holds the sender back —
 * packets queue at the window's edge, then flow again.
 */
export function drawStreams({ ctx, width, height, time, accent }: IFxDrawContext): void {
  const padding = width * PADDING_RATIO;
  const nodeWidth = width * NODE_WIDTH_RATIO;
  const laneStart = padding + nodeWidth;
  const laneEnd = width - padding - nodeWidth;
  const laneLength = laneEnd - laneStart;
  const laneGap = (height - padding * 2) / LANE_COUNT;
  const packetWidth = width * PACKET_WIDTH_RATIO;
  const packetHeight = height * PACKET_HEIGHT_RATIO;

  ctx.fillStyle = accent(NODE_ALPHA);
  ctx.fillRect(padding, padding, nodeWidth, height - padding * 2);
  ctx.fillRect(width - padding - nodeWidth, padding, nodeWidth, height - padding * 2);

  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const centre = padding + laneGap * (lane + 0.5);
    ctx.fillStyle = accent(LANE_ALPHA);
    ctx.fillRect(laneStart, centre - packetHeight * 0.15, laneLength, packetHeight * 0.3);

    const speed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * pseudoRandom(lane, 1);
    const stalled =
      lane === STALLED_LANE && (time % STALL_PERIOD_SECONDS) / STALL_PERIOD_SECONDS < STALL_SHARE;
    for (let packet = 0; packet < PACKETS_PER_LANE; packet++) {
      const phase = (time * speed + packet / PACKETS_PER_LANE + pseudoRandom(lane, packet)) % 1;
      const outbound = stalled ? 1 - (packet * STALL_SPACING * packetWidth) / laneLength : phase;
      ctx.fillStyle = accent(OUTBOUND_ALPHA);
      ctx.fillRect(
        laneStart + outbound * (laneLength - packetWidth),
        centre - packetHeight - 1,
        packetWidth,
        packetHeight
      );
      if (stalled) {
        continue;
      }
      ctx.fillStyle = accent(ECHO_ALPHA);
      ctx.fillRect(
        laneStart + (1 - phase) * (laneLength - packetWidth),
        centre + 1,
        packetWidth,
        packetHeight
      );
    }
  }
}
