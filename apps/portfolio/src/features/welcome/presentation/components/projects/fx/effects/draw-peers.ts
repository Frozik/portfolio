import { DARK_SURFACE_HEX, MONO_FONT_STACK } from '../../../../canvasTheme';
import type { IFxDrawContext } from '../types';

const PEER_COUNT = 5;
const RING_RADIUS_RATIO = 0.32;
const RING_ROTATION_SPEED = 0.1;
const LINK_ALPHA = 0.15;
const PACKET_SPEED = 0.6;
const PACKET_PHASE_PER_FROM = 0.2;
const PACKET_PHASE_PER_TO = 0.13;
const PACKET_ALPHA = 0.9;
const PACKET_RADIUS_PX = 2;
const PEER_HALO_ALPHA = 0.2;
const PEER_HALO_RADIUS_PX = 12;
const PEER_RADIUS_PX = 7;
const PEER_LABEL_FONT_PX = 8;

interface IPoint {
  readonly x: number;
  readonly y: number;
}

/** Peers on a slowly turning ring, exchanging packets over a full mesh. */
export function drawPeers({
  ctx,
  width,
  height,
  time,
  accent,
  devicePixelRatio,
}: IFxDrawContext): void {
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * RING_RADIUS_RATIO;
  const peers: readonly IPoint[] = Array.from({ length: PEER_COUNT }, (_, peerIndex) => {
    const angle = (peerIndex / PEER_COUNT) * Math.PI * 2 + time * RING_ROTATION_SPEED;
    return { x: centerX + Math.cos(angle) * radius, y: centerY + Math.sin(angle) * radius };
  });

  ctx.strokeStyle = accent(LINK_ALPHA);
  ctx.lineWidth = devicePixelRatio;
  peers.forEach((from, fromIndex) => {
    peers.slice(fromIndex + 1).forEach((to, offset) => {
      const toIndex = fromIndex + 1 + offset;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
      const phase =
        (time * PACKET_SPEED + fromIndex * PACKET_PHASE_PER_FROM + toIndex * PACKET_PHASE_PER_TO) %
        1;
      ctx.fillStyle = accent(PACKET_ALPHA);
      ctx.beginPath();
      ctx.arc(
        from.x + (to.x - from.x) * phase,
        from.y + (to.y - from.y) * phase,
        PACKET_RADIUS_PX * devicePixelRatio,
        0,
        Math.PI * 2
      );
      ctx.fill();
    });
  });

  peers.forEach((peer, peerIndex) => {
    ctx.fillStyle = accent(PEER_HALO_ALPHA);
    ctx.beginPath();
    ctx.arc(peer.x, peer.y, PEER_HALO_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent(1);
    ctx.beginPath();
    ctx.arc(peer.x, peer.y, PEER_RADIUS_PX * devicePixelRatio, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = DARK_SURFACE_HEX;
    ctx.font = `${PEER_LABEL_FONT_PX * devicePixelRatio}px ${MONO_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`P${peerIndex + 1}`, peer.x, peer.y);
  });
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
