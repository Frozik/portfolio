import { Text } from 'react-native';

import { actionTone } from '../theme/action-tones';
import { useScheme } from '../theme/AppTheme';
import type { IStatusPart } from './group-status';

/** A group's status line: red while it blocks, green while it lets through, the words between plain. */
export function GroupStatus({
  parts,
  testID,
}: {
  readonly parts: readonly IStatusPart[];
  readonly testID: string;
}) {
  const scheme = useScheme();
  return parts.map(({ action, text }) =>
    action === null ? (
      <Text key={`plain:${text}`}>{text}</Text>
    ) : (
      <Text
        key={`${action}:${text}`}
        testID={`${testID}-${action}`}
        style={{ color: actionTone(action, scheme) }}
      >
        {text}
      </Text>
    )
  );
}
