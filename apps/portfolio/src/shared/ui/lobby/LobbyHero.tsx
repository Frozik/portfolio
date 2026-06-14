import type { ReactNode } from 'react';
import { memo } from 'react';

import { MonoKicker } from '../MonoKicker';
import { SectionNumber } from '../SectionNumber';
import { formatRoomCount } from './lobbyFormat';

interface LobbyHeroProps {
  readonly headlinePrimary: string;
  readonly headlineAccent: string;
  readonly heroSubtitle: string;
  readonly totalRoomsLabel: string;
  readonly roomCount: number;
  /**
   * Optional "NN / label" section marker rendered above the headline. The conf
   * lobby leads its hero with one; the retro lobby omits it.
   */
  readonly sectionNumber?: string;
  readonly sectionLabel?: string;
  /**
   * Optional top-right accessory (the retro lobby slots its `AccountChip`
   * here). When present the right column stretches and stacks the accessory
   * above the room counter.
   */
  readonly accessory?: ReactNode;
}

const RoomCountColumn = ({
  totalRoomsLabel,
  roomCount,
}: Pick<LobbyHeroProps, 'totalRoomsLabel' | 'roomCount'>) => (
  <div className="flex flex-col items-end gap-1.5">
    <MonoKicker tone="faint">{totalRoomsLabel}</MonoKicker>
    <div className="font-mono text-[52px] leading-none text-landing-fg">
      {formatRoomCount(roomCount)}
    </div>
  </div>
);

/**
 * Shared lobby hero: oversized two-line headline, subtitle, and a zero-padded
 * active-room counter. Reused by the retro and conf lobbies, which differ only
 * in the optional section marker and top-right accessory.
 */
const LobbyHeroComponent = ({
  headlinePrimary,
  headlineAccent,
  heroSubtitle,
  totalRoomsLabel,
  roomCount,
  sectionNumber,
  sectionLabel,
  accessory,
}: LobbyHeroProps) => (
  <section className="flex flex-col gap-6">
    {sectionNumber !== undefined && sectionLabel !== undefined && (
      <SectionNumber number={sectionNumber} label={sectionLabel} />
    )}
    <div className="flex flex-wrap items-end justify-between gap-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-[clamp(40px,8vw,64px)] font-medium leading-[1.02] tracking-[-0.03em] text-landing-fg">
          {headlinePrimary}
          <br />
          <span className="font-serif text-landing-fg-faint italic">{headlineAccent}</span>
        </h1>
        <p className="mt-5 max-w-[520px] text-[15px] leading-[1.5] text-landing-fg-dim">
          {heroSubtitle}
        </p>
      </div>
      {accessory !== undefined ? (
        <div className="flex flex-col items-end justify-between gap-5 self-stretch">
          {accessory}
          <RoomCountColumn totalRoomsLabel={totalRoomsLabel} roomCount={roomCount} />
        </div>
      ) : (
        <RoomCountColumn totalRoomsLabel={totalRoomsLabel} roomCount={roomCount} />
      )}
    </div>
  </section>
);

export const LobbyHero = memo(LobbyHeroComponent);
