import { useLocalSearchParams } from 'expo-router';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import { changeGroup } from '../../contexts/grouping/domain/group-book-edits';
import type { IFoundAddress } from '../../contexts/places/domain/ports/geofences';
import { withoutPlace, withPlace } from '../../contexts/policy/domain/place-edits';
import type {
  IPlaceRule,
  IPoint,
  TPlaceId,
  TPlaceRadius,
} from '../../contexts/policy/domain/place-rule';
import { PLACE_RADII } from '../../contexts/policy/domain/place-rule';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { BackArrow } from '../kit/BackArrow';
import { Button } from '../kit/Button';
import { Chip } from '../kit/Chip';
import { Hint } from '../kit/Hint';
import { GAP, RADIUS } from '../kit/metrics';
import { Row } from '../kit/Row';
import { Screen } from '../kit/Screen';
import { Section } from '../kit/Section';
import { TextField } from '../kit/TextField';
import { useLeave } from '../kit/use-leave';
import { useLeaveWhenGone } from '../kit/use-leave-when-gone';
import { Wrap } from '../kit/Wrap';
import PlaceMap from './PlaceMap.dom';

/** Before any point is known: the whole world, zoomed out. */
const WORLD: IPoint = { latitude: 20, longitude: 0 };
const WORLD_ZOOM = 2;
const STREET_ZOOM = 15;
const DEFAULT_RADIUS: TPlaceRadius = 500;
const UNRELIABLE_RADIUS = 50;
const MAP_HEIGHT = 320;

/** A place of a group: a point on the map (tapped, found by address, or where the phone is) and a radius. */
export const PlaceScreen = observer(function PlaceScreen() {
  const app = useApp();
  const texts = useTexts();
  const leave = useLeave();
  const { group: groupId, place: placeId } = useLocalSearchParams<{
    readonly group: string;
    readonly place?: string;
  }>();
  const group = findGroup(app.books.book, groupId as TGroupId);
  useLeaveWhenGone(group === null);
  const existing = group?.policy.conditions?.places.find(place => place.id === placeId) ?? null;
  const [name, setName] = useState(existing?.name ?? '');
  const [point, setPoint] = useState<IPoint | null>(existing);
  const [hereUnknown, setHereUnknown] = useState(false);
  const [radius, setRadius] = useState<TPlaceRadius>(existing?.radius ?? DEFAULT_RADIUS);
  const [mode, setMode] = useState<IPlaceRule['mode']>(existing?.mode ?? 'only-at');
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<readonly IFoundAddress[]>([]);
  if (group === null) {
    return null;
  }
  const findAddress = async () => {
    setFound(await app.places.search(query.trim()));
  };
  const goHere = async () => {
    if (app.device.permissions.location !== 'granted') {
      await app.device.request('location');
    }
    const here = await app.places.here();
    setHereUnknown(here === null);
    if (here !== null) {
      setPoint(here);
    }
  };
  const save = () => {
    if (point === null) {
      return;
    }
    const rule: IPlaceRule = {
      id: existing?.id ?? app.newPlaceId(),
      name: name.trim(),
      latitude: point.latitude,
      longitude: point.longitude,
      radius,
      mode,
    };
    app.books.run((book, context) =>
      changeGroup(book, group.id, { policy: withPlace(group.policy, rule) }, context.now)
    );
    leave();
  };
  const remove = (id: TPlaceId) => {
    app.books.run((book, context) =>
      changeGroup(book, group.id, { policy: withoutPlace(group.policy, id) }, context.now)
    );
    leave();
  };
  const shown = point ?? WORLD;
  return (
    <Screen
      testID="place-screen"
      title={texts.place.title}
      titleLeading={<BackArrow testID="screen-back" />}
      footer={
        <>
          <Button
            testID="place-save"
            label={texts.place.save}
            disabled={point === null || name.trim() === ''}
            onPress={save}
          />
          {existing === null ? null : (
            <Button
              testID="place-remove"
              variant="danger"
              label={texts.place.remove}
              onPress={() => remove(existing.id)}
            />
          )}
        </>
      }
    >
      <TextField
        testID="place-name"
        label={texts.place.name}
        placeholder={texts.place.namePlaceholder}
        value={name}
        onChange={setName}
      />
      <Wrap>
        <Chip
          testID="place-mode-only-at"
          label={texts.place.onlyAt}
          selected={mode === 'only-at'}
          onPress={() => setMode('only-at')}
        />
        <Chip
          testID="place-mode-except-at"
          label={texts.place.exceptAt}
          selected={mode === 'except-at'}
          onPress={() => setMode('except-at')}
        />
      </Wrap>
      <View style={styles.searchLine}>
        <View style={styles.searchField}>
          <TextField
            testID="place-search"
            label={texts.place.search}
            placeholder={texts.place.search}
            value={query}
            onChange={setQuery}
          />
        </View>
        <Button
          testID="place-find"
          variant="secondary"
          label={texts.place.find}
          disabled={query.trim() === ''}
          onPress={() => void findAddress()}
        />
      </View>
      {found.length === 0 ? null : (
        <Section>
          {found.map(address => (
            <Row
              key={`${address.point.latitude},${address.point.longitude}`}
              title={address.label}
              onPress={() => {
                setPoint(address.point);
                setFound([]);
              }}
            />
          ))}
        </Section>
      )}
      <Button
        testID="place-here"
        variant="secondary"
        label={texts.place.here}
        onPress={() => void goHere()}
      />
      {hereUnknown ? (
        <Hint testID="place-here-unknown" tone="caution" text={texts.place.hereUnknown} />
      ) : null}
      <View style={styles.map}>
        <PlaceMap
          latitude={shown.latitude}
          longitude={shown.longitude}
          radius={radius}
          zoom={point === null ? WORLD_ZOOM : STREET_ZOOM}
          onPick={(latitude, longitude) => setPoint({ latitude, longitude })}
          dom={{ scrollEnabled: false, style: styles.map }}
        />
      </View>
      <Wrap>
        {PLACE_RADII.map(candidate => (
          <Chip
            key={candidate}
            testID={`place-radius-${candidate}`}
            label={texts.place.radius(candidate)}
            selected={radius === candidate}
            onPress={() => setRadius(candidate)}
          />
        ))}
      </Wrap>
      {radius === UNRELIABLE_RADIUS ? <Hint tone="caution" text={texts.place.radiusSmall} /> : null}
    </Screen>
  );
});

const styles = StyleSheet.create({
  searchLine: { flexDirection: 'row', alignItems: 'flex-end', gap: GAP },
  searchField: { flex: 1 },
  map: { height: MAP_HEIGHT, borderRadius: RADIUS, overflow: 'hidden' },
});
