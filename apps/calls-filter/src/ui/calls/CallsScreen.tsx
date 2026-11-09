import { useRouter } from 'expo-router';
import { SearchCheck } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';

import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { IconButton } from '../kit/IconButton';
import { Screen } from '../kit/Screen';
import { CallList } from './CallList';

/** Every call of every group, newest first, with the group it is in now. */
export const CallsScreen = observer(function CallsScreen() {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  return (
    <Screen
      testID="calls-screen"
      title={texts.tabs.calls}
      titleAction={
        <IconButton
          testID="open-check"
          icon={SearchCheck}
          label={texts.check.open}
          onPress={() => router.push('/check')}
        />
      }
    >
      <CallList days={app.calls.byDay} quickMove={false} showGroup />
    </Screen>
  );
});
