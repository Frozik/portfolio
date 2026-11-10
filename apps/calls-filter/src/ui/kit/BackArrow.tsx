import { ArrowLeft } from 'lucide-react-native';

import { useTexts } from '../../texts/use-texts';
import { IconButton } from './IconButton';
import { useLeave } from './use-leave';

/** «Back» as an arrow at the start of a screen's title line, where a row of its own costs too much. */
export function BackArrow({ testID }: { readonly testID: string }) {
  const texts = useTexts();
  const leave = useLeave();
  return (
    <IconButton
      testID={testID}
      icon={ArrowLeft}
      label={texts.common.back}
      onPress={() => leave()}
    />
  );
}
