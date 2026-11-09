import { useRouter } from 'expo-router';
import { Regex, UserPlus } from 'lucide-react-native';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type {
  ICustomGroup,
  IMyContactsGroup,
  TGroupId,
} from '../../contexts/grouping/domain/group';
import { findGroup } from '../../contexts/grouping/domain/group-book';
import {
  addMember,
  removeMember,
  setExcludeMyContacts,
} from '../../contexts/grouping/domain/group-book-edits';
import type { TMember, TSpecialMask } from '../../contexts/grouping/domain/member';
import { SPECIAL_MASKS } from '../../contexts/grouping/domain/member';
import { useTexts } from '../../texts/use-texts';
import { useApp } from '../AppContext';
import { groupName } from '../group-name';
import { Button } from '../kit/Button';
import { ContactAvatar } from '../kit/ContactAvatar';
import { Hint } from '../kit/Hint';
import { IconButton } from '../kit/IconButton';
import { IconToggle } from '../kit/IconToggle';
import { GUTTER, ICON_SIZE, SMALL_GAP } from '../kit/metrics';
import { Row } from '../kit/Row';
import { Section } from '../kit/Section';
import { Sheet } from '../kit/Sheet';
import { ToggleRow } from '../kit/ToggleRow';
import { usePalette } from '../theme/AppTheme';
import { memberLabel } from './member-label';
import { pickContactMember } from './pick-contact';
import { SPECIAL_ICONS } from './special-icons';

type TSide = 'include' | 'exclude';

interface ISelected {
  readonly side: TSide;
  readonly member: TMember;
}

/** «Who»: the include and exclude lists, then the special masks as switches — what is in reads at a glance. */
export const MembersPanel = observer(function MembersPanel({
  group,
}: {
  readonly group: ICustomGroup | IMyContactsGroup;
}) {
  const app = useApp();
  const texts = useTexts();
  const router = useRouter();
  const [selected, setSelected] = useState<ISelected | null>(null);
  const add = (side: TSide, member: TMember) =>
    app.books.run((book, context) =>
      addMember(book, {
        group: group.id,
        side,
        member,
        newMemberId: context.newMemberId,
        now: context.now,
        facts: context.facts,
      })
    );
  const toggleSpecial = (special: TSpecialMask) => {
    if (group.kind !== 'custom') {
      return;
    }
    const present = group.include.find(
      member => member.kind === 'special' && member.special === special
    );
    if (present !== undefined) {
      app.books.run((book, context) =>
        removeMember(book, group.id, 'include', present.id, context.now)
      );
      return;
    }
    const context = app.books.context();
    add('include', {
      kind: 'special',
      id: context.newMemberId(),
      special,
      updatedAt: context.now,
      excludedFor: null,
    });
  };
  const addContact = async (side: TSide) => {
    const member = await pickContactMember(app);
    if (member !== null) {
      add(side, member);
    }
  };
  const excludedForName = (id: TGroupId) => {
    const owner = findGroup(app.books.book, id);
    return owner === null ? '' : groupName(texts, owner);
  };
  const openMask = (side: TSide) =>
    router.push({ pathname: '/mask', params: { group: group.id, side } });
  const remove = () => {
    if (selected !== null) {
      app.books.run((book, context) =>
        removeMember(book, group.id, selected.side, selected.member.id, context.now)
      );
    }
    setSelected(null);
  };
  const subtitleOf = (member: TMember) => {
    const lines = [
      member.kind === 'number-mask' || member.kind === 'name-mask' ? member.note : '',
      member.excludedFor === null
        ? ''
        : texts.group.excludedFor(excludedForName(member.excludedFor)),
    ].filter(line => line !== '');
    return lines.length === 0 ? undefined : lines.join(' · ');
  };
  const side = (which: TSide, title: string, members: readonly TMember[]) => {
    const listed = members.filter(member => which === 'exclude' || member.kind !== 'special');
    return (
      <Section
        title={title}
        testID={`members-${which}`}
        actions={
          <>
            <IconButton
              testID={`add-${which}-number`}
              icon={Regex}
              label={texts.group.addMask}
              onPress={() => openMask(which)}
            />
            <IconButton
              testID={`add-${which}-contact`}
              icon={UserPlus}
              label={texts.group.addContact}
              onPress={() => void addContact(which)}
            />
          </>
        }
      >
        {listed.length === 0 ? <Row title={texts.group.emptySide} /> : null}
        {listed.map(member => (
          <Row
            key={member.id}
            testID={`member-${member.id}`}
            leading={
              member.kind === 'contact' ? (
                <ContactAvatar
                  photoUri={
                    member.lookupKey === null ? null : app.contactPhotoUri(member.lookupKey)
                  }
                  name={member.displayName}
                />
              ) : member.kind === 'special' ? (
                <SpecialIcon special={member.special} />
              ) : undefined
            }
            title={member.kind === 'contact' ? member.displayName : memberLabel(texts, member)}
            subtitle={subtitleOf(member)}
            onPress={() => setSelected({ side: which, member })}
          />
        ))}
      </Section>
    );
  };
  return (
    <>
      {group.kind === 'custom' ? (
        <>
          {side('include', texts.group.include, group.include)}
          <Section title={texts.group.specialTitle}>
            <View style={styles.specials}>
              {SPECIAL_MASKS.map(special => (
                <IconToggle
                  key={special}
                  testID={`special-${special}`}
                  icon={SPECIAL_ICONS[special]}
                  title={texts.group.special[special]}
                  description={texts.group.specialHint[special]}
                  value={group.include.some(
                    member => member.kind === 'special' && member.special === special
                  )}
                  onChange={() => toggleSpecial(special)}
                />
              ))}
            </View>
          </Section>
        </>
      ) : (
        <Hint text={texts.group.myContactsWho} />
      )}
      {side('exclude', texts.group.exclude, group.exclude)}
      {group.kind === 'custom' ? (
        <Section>
          <ToggleRow
            testID="exclude-my-contacts"
            title={texts.group.excludeMyContacts}
            subtitle={texts.group.excludeMyContactsHint}
            value={group.excludeMyContacts}
            onChange={excludeMyContacts =>
              app.books.run((book, context) =>
                setExcludeMyContacts(book, group.id, excludeMyContacts, context.now, context.facts)
              )
            }
          />
        </Section>
      ) : (
        <Hint text={texts.group.myContactsHint} />
      )}
      <Sheet
        visible={selected !== null}
        title={selected === null ? '' : memberLabel(texts, selected.member)}
        onClose={() => setSelected(null)}
        testID="member-sheet"
      >
        {selected?.member.excludedFor === null || selected === null ? null : (
          <Hint text={texts.group.excludedFor(excludedForName(selected.member.excludedFor))} />
        )}
        <Button
          testID="member-remove"
          variant="danger"
          label={texts.common.delete}
          onPress={remove}
        />
      </Sheet>
    </>
  );
});

const styles = StyleSheet.create({
  specials: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER,
    paddingVertical: SMALL_GAP * 2,
  },
});

function SpecialIcon({ special }: { readonly special: TSpecialMask }) {
  const palette = usePalette();
  const Icon = SPECIAL_ICONS[special];
  return <Icon color={palette.fgDim} size={ICON_SIZE} />;
}
