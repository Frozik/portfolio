import { random } from 'lodash-es';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BallisticsEnvironment } from '../ballistics';
import { createEnvironment } from '../ballistics';
import { DEFAULT_PHYSICS_OPTIONS, MAX_POWER, MAX_VISCOSITY } from '../constants';
import type { Heightfield } from '../terrain/heightfield';
import { createFlatHeightfield, createHeightfield } from '../terrain/heightfield';
import type { AimState, ResolvedWallMode } from '../types';
import { toPlayerId } from '../types';
import { isOnTarget, measureShot } from './aim-solver';
import type { AiContext, AiTankView } from './personalities';
import {
  createRandomAim,
  decideAim,
  isBouncyWallMode,
  resolveUnknownPersonality,
  selectTarget,
} from './personalities';

vi.mock('lodash-es', async importOriginal => {
  const actual = await importOriginal<typeof import('lodash-es')>();

  return { ...actual, random: vi.fn() };
});

const randomMock = vi.mocked(random);

const FIELD_WIDTH = 800;
const FIELD_HEIGHT = 500;
const GROUND_HEIGHT_WU = 100;
const SELF: AiTankView = {
  playerId: toPlayerId(1),
  position: { x: 100, y: GROUND_HEIGHT_WU },
  health: 100,
  kills: 0,
};
const NEAR_OPPONENT: AiTankView = {
  playerId: toPlayerId(2),
  position: { x: 500, y: GROUND_HEIGHT_WU },
  health: 100,
  kills: 0,
};
const FAR_OPPONENT: AiTankView = {
  playerId: toPlayerId(3),
  position: { x: 700, y: GROUND_HEIGHT_WU },
  health: 40,
  kills: 4,
};

/** Draws in call order, then a value every personality treats as an ordinary draw. */
function queueDraws(...draws: readonly number[]): void {
  randomMock.mockReset();

  for (const draw of draws) {
    randomMock.mockReturnValueOnce(draw);
  }

  randomMock.mockReturnValue(1);
}

function createGround(): Heightfield {
  return createFlatHeightfield(GROUND_HEIGHT_WU, FIELD_WIDTH);
}

/** A wall of dirt between the two tanks: nobody has a clear line of fire across it. */
function createBlockedField(): Heightfield {
  return createHeightfield(
    Array.from({ length: FIELD_WIDTH }, (_unused, index) =>
      index >= 280 && index < 320 ? 480 : GROUND_HEIGHT_WU
    )
  );
}

function createTestEnvironment(
  wallMode: ResolvedWallMode = 'none',
  viscosity = 0
): BallisticsEnvironment {
  return createEnvironment(
    { ...DEFAULT_PHYSICS_OPTIONS, viscosity },
    0,
    wallMode,
    FIELD_WIDTH,
    FIELD_HEIGHT
  );
}

function createContext(overrides: Partial<AiContext> = {}): AiContext {
  return {
    self: SELF,
    opponents: [NEAR_OPPONENT],
    environment: createTestEnvironment(),
    field: createGround(),
    maxPower: MAX_POWER,
    previousShot: undefined,
    lastAttackerId: undefined,
    ...overrides,
  };
}

function hitsTarget(aim: AimState, context: AiContext, target: AiTankView): boolean {
  return isOnTarget(
    measureShot(context.self.position, aim, context.environment, context.field, target.position)
  );
}

beforeEach(() => {
  queueDraws();
});

describe('createRandomAim', () => {
  it('turns every draw straight into an aim', () => {
    queueDraws(0, 37, 620);

    expect(createRandomAim(MAX_POWER)).toEqual({
      facing: 'left',
      elevationDegrees: 37,
      power: 620,
    });
  });

  it('faces right on the other side of the coin', () => {
    queueDraws(1, 10, 100);

    expect(createRandomAim(MAX_POWER).facing).toBe('right');
  });
});

describe('Moron', () => {
  it('fires a random shot even with a clear line of fire', () => {
    queueDraws(1, 12, 340);

    expect(decideAim('moron', createContext())).toEqual({
      facing: 'right',
      elevationDegrees: 12,
      power: 340,
    });
  });
});

describe('Shooter', () => {
  it('solves the shot when the line is clear', () => {
    const context = createContext();

    expect(hitsTarget(decideAim('shooter', context), context, NEAR_OPPONENT)).toBe(true);
  });

  it('falls back to a random shot when a hill is in the way', () => {
    queueDraws(1, 12, 340);

    const context = createContext({ field: createBlockedField() });

    expect(decideAim('shooter', context)).toEqual({
      facing: 'right',
      elevationDegrees: 12,
      power: 340,
    });
  });
});

describe('Poolshark', () => {
  it('shoots straight when it can', () => {
    const context = createContext({ environment: createTestEnvironment('rubber') });

    expect(hitsTarget(decideAim('poolshark', context), context, NEAR_OPPONENT)).toBe(true);
  });

  it('banks off a bouncy wall when the direct line is blocked', () => {
    const context = createContext({
      self: { ...SELF, position: { x: 700, y: GROUND_HEIGHT_WU } },
      opponents: [{ ...NEAR_OPPONENT, position: { x: 760, y: GROUND_HEIGHT_WU } }],
      environment: createTestEnvironment('rubber'),
      field: createHeightfield(
        Array.from({ length: FIELD_WIDTH }, (_unused, index) =>
          index >= 730 && index < 736 ? GROUND_HEIGHT_WU + 5 : GROUND_HEIGHT_WU
        )
      ),
    });
    const aim = decideAim('poolshark', context);

    expect(hitsTarget(aim, context, context.opponents[0])).toBe(true);
  });

  it('gives up and fires wild when the walls are not bouncy', () => {
    queueDraws(1, 12, 340);

    const context = createContext({
      field: createBlockedField(),
      environment: createTestEnvironment('concrete'),
    });

    expect(decideAim('poolshark', context).power).toBe(340);
  });
});

describe('Tosser', () => {
  it('starts with a wild shot when it has no memory of the target', () => {
    queueDraws(1, 12, 340);

    expect(decideAim('tosser', createContext()).power).toBe(340);
  });

  it('walks its next shot towards the target after falling short', () => {
    const previousAim: AimState = { facing: 'right', elevationDegrees: 45, power: 400 };
    const context = createContext({
      previousShot: {
        aim: previousAim,
        impact: { x: 300, y: GROUND_HEIGHT_WU },
        targetId: toPlayerId(2),
      },
    });

    expect(decideAim('tosser', context).power).toBeGreaterThan(previousAim.power);
  });

  it('ignores a memory of a different target', () => {
    queueDraws(1, 12, 340);

    const context = createContext({
      previousShot: {
        aim: { facing: 'right', elevationDegrees: 45, power: 400 },
        impact: { x: 300, y: GROUND_HEIGHT_WU },
        targetId: toPlayerId(99),
      },
    });

    expect(decideAim('tosser', context).power).toBe(340);
  });
});

describe('Chooser', () => {
  it('shoots straight when the line is clear', () => {
    const context = createContext();

    expect(hitsTarget(decideAim('chooser', context), context, NEAR_OPPONENT)).toBe(true);
  });

  it('walks its shots in when the line is blocked and the walls are dead', () => {
    const previousAim: AimState = { facing: 'right', elevationDegrees: 45, power: 400 };
    const context = createContext({
      field: createBlockedField(),
      environment: createTestEnvironment('concrete'),
      previousShot: {
        aim: previousAim,
        impact: { x: 300, y: GROUND_HEIGHT_WU },
        targetId: toPlayerId(2),
      },
    });

    expect(decideAim('chooser', context).power).toBeGreaterThan(previousAim.power);
  });
});

describe('Spoiler', () => {
  it('is near perfect in still, thin air', () => {
    const context = createContext();

    expect(hitsTarget(decideAim('spoiler', context), context, NEAR_OPPONENT)).toBe(true);
  });

  it('still compensates a strong wind', () => {
    const context = createContext({
      environment: createEnvironment(
        DEFAULT_PHYSICS_OPTIONS,
        200,
        'none',
        FIELD_WIDTH,
        FIELD_HEIGHT
      ),
    });

    expect(hitsTarget(decideAim('spoiler', context), context, NEAR_OPPONENT)).toBe(true);
  });

  it('falls short the moment air viscosity is switched on', () => {
    const context = createContext({ environment: createTestEnvironment('none', MAX_VISCOSITY) });
    const aim = decideAim('spoiler', context);
    const measurement = measureShot(
      context.self.position,
      aim,
      context.environment,
      context.field,
      NEAR_OPPONENT.position
    );

    expect(isOnTarget(measurement)).toBe(false);
    expect(measurement.errorWu).toBeLessThan(0);
  });

  it('aims exactly the same whether or not the air is thick — it never sees the drag', () => {
    const thinAir = decideAim('spoiler', createContext());
    const thickAir = decideAim(
      'spoiler',
      createContext({ environment: createTestEnvironment('none', MAX_VISCOSITY) })
    );

    expect(thickAir).toEqual(thinAir);
  });
});

describe('Cyborg', () => {
  it('goes after whoever hit it last', () => {
    const context = createContext({
      opponents: [NEAR_OPPONENT, FAR_OPPONENT],
      lastAttackerId: FAR_OPPONENT.playerId,
    });

    expect(selectTarget('cyborg', context)?.playerId).toBe(FAR_OPPONENT.playerId);
  });

  it('picks the weakest tank when nobody has hit it yet', () => {
    const context = createContext({ opponents: [NEAR_OPPONENT, FAR_OPPONENT] });

    expect(selectTarget('cyborg', context)?.playerId).toBe(FAR_OPPONENT.playerId);
  });

  it('breaks a health tie in favour of whoever is leading', () => {
    const context = createContext({
      opponents: [NEAR_OPPONENT, { ...FAR_OPPONENT, health: NEAR_OPPONENT.health }],
    });

    expect(selectTarget('cyborg', context)?.playerId).toBe(FAR_OPPONENT.playerId);
  });

  it('aims with the Spoiler solver at its chosen victim', () => {
    const context = createContext({
      opponents: [NEAR_OPPONENT, FAR_OPPONENT],
      lastAttackerId: FAR_OPPONENT.playerId,
    });

    expect(hitsTarget(decideAim('cyborg', context), context, FAR_OPPONENT)).toBe(true);
  });
});

describe('everyone else targets the nearest tank', () => {
  it('ignores health and score', () => {
    const context = createContext({ opponents: [FAR_OPPONENT, NEAR_OPPONENT] });

    expect(selectTarget('shooter', context)?.playerId).toBe(NEAR_OPPONENT.playerId);
  });

  it('fires wild when there is nobody left to shoot at', () => {
    queueDraws(1, 12, 340);

    expect(decideAim('shooter', createContext({ opponents: [] })).power).toBe(340);
  });
});

describe('Unknown', () => {
  it('secretly draws one of the seven disclosed strategies', () => {
    queueDraws(0);
    expect(resolveUnknownPersonality()).toBe('moron');

    queueDraws(5);
    expect(resolveUnknownPersonality()).toBe('spoiler');
  });

  it('plays as the strategy it drew', () => {
    queueDraws(0, 1, 12, 340);

    expect(decideAim('unknown', createContext())).toEqual({
      facing: 'right',
      elevationDegrees: 12,
      power: 340,
    });
  });
});

describe('isBouncyWallMode', () => {
  it('knows which walls a bank shot can use', () => {
    expect(isBouncyWallMode('rubber')).toBe(true);
    expect(isBouncyWallMode('padded')).toBe(true);
    expect(isBouncyWallMode('spring')).toBe(true);
    expect(isBouncyWallMode('concrete')).toBe(false);
    expect(isBouncyWallMode('none')).toBe(false);
    expect(isBouncyWallMode('wrap')).toBe(false);
  });
});
