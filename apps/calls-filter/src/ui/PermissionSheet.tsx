import { observer } from 'mobx-react-lite';

import { useTexts } from '../texts/use-texts';
import { useApp } from './AppContext';
import { Button } from './kit/Button';
import { Hint } from './kit/Hint';
import { Sheet } from './kit/Sheet';

/**
 * The next thing the app needs from the phone, one at a time: why, then the system's dialog
 * or the place in Settings. It closes by itself once the phone says it is granted.
 */
export const PermissionSheet = observer(function PermissionSheet() {
  const app = useApp();
  const texts = useTexts();
  const prompt = app.permissionPrompt;
  const { step } = prompt;
  if (step === null) {
    return null;
  }
  const words = texts.permissionPrompt;
  return (
    <Sheet
      visible
      title={words.title[step]}
      onClose={() => prompt.later()}
      testID="permission-sheet"
    >
      <Hint testID={`permission-step-${step}`} text={words.why[step]} />
      {prompt.needsSettings ? (
        <Hint
          tone="caution"
          text={
            step === 'screening-role' ? words.roleInSettings : words.inSettings(words.title[step])
          }
        />
      ) : null}
      <Button
        testID="permission-allow"
        label={prompt.needsSettings ? words.openSettings : words.allow}
        onPress={() => void prompt.allow()}
      />
      <Button
        testID="permission-later"
        variant="quiet"
        label={words.later}
        onPress={() => prompt.later()}
      />
    </Sheet>
  );
});
