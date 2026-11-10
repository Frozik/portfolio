import { useRouter } from 'expo-router';
import { observer } from 'mobx-react-lite';

import type { TGroup } from '../../contexts/grouping/domain/group';
import { hiddenCallsMissRepeat } from '../../contexts/screening/domain/hidden-repeat';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { Hint } from '../kit/Hint';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { PlaceStateMark } from '../place/PlaceStateMark';
import { SettingIcons } from './SettingIcons';

/** «What to do»: one action always, or one in the windows and another the rest of the time. */
export const PolicyPanel = observer(function PolicyPanel({
  group,
  onForAWhile,
}: {
  readonly group: TGroup;
  readonly onForAWhile: () => void;
}) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const { policy } = group;
  const { scheduled } = policy;
  return (
    <>
      <SettingIcons group={group} onForAWhile={onForAWhile} />
      {(scheduled?.places.length ?? 0) === 0 ? null : (
        <Section>
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
        </Section>
      )}
      {hiddenCallsMissRepeat(
        app.books.book,
        group,
        app.environment,
        app.device.preferences.repeatPass,
        app.clock.now()
      ) ? (
        <Hint testID="repeat-hidden-miss" tone="caution" text={texts.repeat.hiddenMiss} />
      ) : null}
    </>
  );
});
