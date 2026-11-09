import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator } from 'react-native';

import type { TGroupId } from '../../contexts/grouping/domain/group';
import { findGroup, strangersGroup } from '../../contexts/grouping/domain/group-book';
import { useApp } from '../AppContext';
import { moveEntry } from '../calls/move-caller';
import { Screen } from '../kit/Screen';

/**
 * The answer to «where does this number go?» from the shade: a group button moves the caller
 * there and shows that group; «Other…» opens «Strangers», where every group is a chip away.
 */
export function WhereToAnswer() {
  const app = useApp();
  const router = useRouter();
  const { at, group } = useLocalSearchParams<{ at?: string; group?: string }>();
  useEffect(() => {
    const answer = async () => {
      app.dismissWhereTo();
      await app.calls.refresh();
      const entry = app.calls.entries.find(
        candidate => String(candidate.at.epochMilliseconds) === at
      );
      const target = group === undefined ? null : findGroup(app.books.book, group as TGroupId);
      if (entry !== undefined && target?.kind === 'custom') {
        moveEntry(app, entry, target.id, entry.caller.number === null ? 'name' : 'number');
        router.replace({ pathname: '/group/[id]', params: { id: target.id } });
        return;
      }
      router.replace({
        pathname: '/group/[id]',
        params: { id: strangersGroup(app.books.book).id },
      });
    };
    void answer();
  }, [app, at, group, router]);
  return (
    <Screen testID="where-to-answer">
      <ActivityIndicator />
    </Screen>
  );
}
