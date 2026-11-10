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

/** A group's rules: its settings as icons, its places, and a warning about hidden repeats. */
export const PolicyPanel = observer(function PolicyPanel({ group }: { readonly group: TGroup }) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const { policy } = group;
  const { conditions } = policy;
  return (
    <>
      <SettingIcons group={group} />
      {(conditions?.places.length ?? 0) === 0 ? null : (
        <Section>
          {(conditions?.places ?? []).map(place => {
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
