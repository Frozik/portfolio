import { useTexts } from '../../texts/use-texts';
import { Button } from './Button';
import { useLeave } from './use-leave';

/** «‹ Back» at the top of every screen that was opened over another: leaving is never a guess. */
export function BackButton({ testID = 'screen-back' }: { readonly testID?: string }) {
  const texts = useTexts();
  const leave = useLeave();
  return (
    <Button
      testID={testID}
      variant="quiet"
      label={`‹ ${texts.common.back}`}
      onPress={() => leave()}
    />
  );
}
