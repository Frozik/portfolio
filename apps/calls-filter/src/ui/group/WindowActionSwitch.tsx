import type { TAction } from '../../contexts/policy/domain/action';
import { useTexts } from '../../texts/use-texts';
import { Hint } from '../kit/Hint';
import { ActionSwitch } from './ActionSwitch';

/**
 * What the group does while its schedule, calendars and places hold — set where each of them is
 * set: one action for all of them together.
 */
export function WindowActionSwitch({
  value,
  onChange,
}: {
  readonly value: TAction;
  readonly onChange: (action: TAction) => void;
}) {
  const texts = useTexts();
  return (
    <>
      <Hint text={texts.group.whileMet} />
      <ActionSwitch prefix="window-action" value={value} onChange={onChange} />
    </>
  );
}
