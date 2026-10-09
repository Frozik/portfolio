const HALF = 0.5;

// As seen from the northern hemisphere: the bright limb is on the right while the Moon waxes.
export function moonLitPath(
  centerX: number,
  centerY: number,
  radius: number,
  litFraction: number,
  isWaxing: boolean
): string {
  const terminatorRadius = Math.abs(1 - 2 * litFraction) * radius;
  const isCrescent = litFraction < HALF;
  const limbSweep = isWaxing ? 1 : 0;
  const terminatorSweep = isWaxing === isCrescent ? 0 : 1;
  const top = `${centerX} ${centerY - radius}`;
  const bottom = `${centerX} ${centerY + radius}`;
  return (
    `M ${top} A ${radius} ${radius} 0 0 ${limbSweep} ${bottom} ` +
    `A ${terminatorRadius} ${radius} 0 0 ${terminatorSweep} ${top} Z`
  );
}
