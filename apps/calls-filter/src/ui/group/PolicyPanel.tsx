import { useRouter } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { IPolicy } from '../../contexts/policy/domain/policy';
import { hiddenCallsMissRepeat } from '../../contexts/screening/domain/hidden-repeat';
import { policyText } from '../../texts/policy-phrase';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { useCalendarName } from '../calendars/use-calendar-name';
import { useClockWords } from '../clock-words';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { PlaceStateMark } from '../place/PlaceStateMark';
import { RepeatRow } from '../repeat/RepeatRow';
import { PolicyActions } from './PolicyActions';

/** «What to do»: one action always, or one in the windows and another the rest of the time. */
export const PolicyPanel = observer(function PolicyPanel({ group }: { readonly group: TGroup }) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const calendarName = useCalendarName();
  const clockWords = useClockWords();
  const { policy } = group;
  const setPolicy = (next: IPolicy) =>
    app.books.run((book, context) => changeGroup(book, group.id, { policy: next }, context.now));
  const { scheduled } = policy;
  return (
    <>
      <PolicyActions group={group} />
      <Section
        title={texts.place.title}
        actions={
          <IconButton
            testID="add-place"
            icon={MapPin}
            label={texts.place.add}
            onPress={() => router.push({ pathname: '/place', params: { group: group.id } })}
          />
        }
      >
        {(scheduled?.places ?? []).map(place => {
          const here = app.places.atPlace(place.id);
          return (
            <Row
              key={place.id}
              testID={`place-${place.id}`}
              title={place.name}
              subtitle={[
                texts.place.radius(place.radius),
                place.mode === 'only-at' ? texts.place.onlyAt : texts.place.exceptAt,
                here === null ? texts.place.unknown : here ? texts.place.at : texts.place.away,
              ].join(' · ')}
              trailing={<PlaceStateMark here={here} />}
              onPress={() =>
                router.push({ pathname: '/place', params: { group: group.id, place: place.id } })
              }
            />
          );
        })}
        {(scheduled?.places.length ?? 0) === 0 ? (
          <Row
            testID="add-place-row"
            title={texts.place.add}
            onPress={() => router.push({ pathname: '/place', params: { group: group.id } })}
          />
        ) : null}
      </Section>
      <Section>
        <RepeatRow
          testID="group-repeat"
          value={policy.repeatPass}
          hint={texts.repeat.groupHint(policy.repeatWindowMinutes)}
          onChange={repeatPass => setPolicy({ ...policy, repeatPass })}
        />
      </Section>
      {hiddenCallsMissRepeat(
        app.books.book,
        group,
        app.environment,
        app.device.preferences.repeatPass,
        app.clock.now()
      ) ? (
        <Hint testID="repeat-hidden-miss" tone="caution" text={texts.repeat.hiddenMiss} />
      ) : null}
      <Hint
        testID="policy-phrase"
        text={`«${policyText(texts, policy, calendarName, clockWords)}»`}
      />
    </>
  );
});
