import { X } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';

import { searchCallDays } from '../../contexts/journal/application/call-days-search';
import type { ICallDay } from '../../contexts/journal/application/CallsStore';
import { useTexts } from '../../texts/use-texts';
import { CallList } from '../calls/CallList';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { TextField } from '../kit/TextField';

/** A group's calls; while the search is open, only those its query finds. */
export const GroupCalls = observer(function GroupCalls({
  days,
  quickMove,
  query,
  onQuery,
}: {
  readonly days: readonly ICallDay[];
  readonly quickMove: boolean;
  /** Null while the search is closed. */
  readonly query: string | null;
  readonly onQuery: (query: string) => void;
}) {
  const texts = useTexts();
  if (query === null) {
    return <CallList days={days} quickMove={quickMove} showGroup={false} />;
  }
  const found = searchCallDays(days, query);
  return (
    <>
      <TextField
        testID="group-search-field"
        label={texts.group.search}
        placeholder={texts.group.searchHint}
        value={query}
        onChange={onQuery}
        focusWhenShown
        trailing={
          query === '' ? null : (
            <IconButton
              testID="group-search-clear"
              icon={X}
              label={texts.group.searchClear}
              onPress={() => onQuery('')}
            />
          )
        }
      />
      {found.length === 0 ? (
        <Hint testID="group-search-nothing" text={texts.group.nothingFound} />
      ) : (
        <CallList days={found} quickMove={quickMove} showGroup={false} />
      )}
    </>
  );
});
