import { Document, Image, Link, Page, Text, View } from '@react-pdf/renderer';
import type { ReactElement } from 'react';

import avatarPngUrl from '../../../../assets/avatar.png';
import { formatDateMonthYear, getYearsOfExperience, measureDuration } from '../../utils';
import { CONTACT_LINKS } from '../contentData';
import type { IExperienceTranslation } from '../translations';
import { welcomeT } from '../translations';
import { renderInlineNode, renderRichBlocks } from './nodeToPdf';
import { ensurePdfFontsRegistered } from './pdfFonts';
import { pdfStyles } from './pdfStyles';

ensurePdfFontsRegistered();

const CONTACT_TYPE_LABELS: Record<string, string> = {
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  email: 'Email',
  github: 'GitHub',
  linkedin: 'LinkedIn',
};

interface IContactDisplay {
  readonly key: string;
  readonly type: string;
  readonly label: string;
  readonly href: string;
}

function getContactsForPdf(): readonly IContactDisplay[] {
  return CONTACT_LINKS.map(link => ({
    key: link.iconKey,
    type: CONTACT_TYPE_LABELS[link.iconKey] ?? link.iconKey,
    label: welcomeT.contacts.entries[link.iconKey]?.label ?? link.href,
    href: link.href,
  }));
}

function getCareerStartYears(): number {
  const entries = welcomeT.experience.entries;
  if (entries.length === 0) {
    return 0;
  }
  const firstEntry = entries[entries.length - 1];
  return getYearsOfExperience(firstEntry.start);
}

function ExperienceEntryView({
  entry,
  isFirst,
}: {
  readonly entry: IExperienceTranslation;
  readonly isFirst: boolean;
}): ReactElement {
  const startLabel = formatDateMonthYear(entry.start);
  const endLabel = entry.end ? formatDateMonthYear(entry.end) : welcomeT.experience.tillNow;
  const duration = measureDuration(entry.start, entry.end);
  const blocks = renderRichBlocks(entry.description);

  return (
    <View style={isFirst ? pdfStyles.expItemFirst : pdfStyles.expItem} wrap={true}>
      <View style={pdfStyles.expDateColumn}>
        <Text style={pdfStyles.expDateRange}>
          {startLabel} — {endLabel}
        </Text>
        <Text style={pdfStyles.expDuration}>{duration}</Text>
        {entry.location && <Text style={pdfStyles.expLocation}>{entry.location}</Text>}
      </View>
      <View style={pdfStyles.expBody}>
        {entry.website ? (
          <Link src={entry.website} style={pdfStyles.expCompanyLink}>
            {entry.company}
          </Link>
        ) : (
          <Text style={pdfStyles.expCompany}>{entry.company}</Text>
        )}
        <Text style={pdfStyles.expRole}>{entry.role}</Text>
        {entry.scopeOfActivity && (
          <Text style={pdfStyles.expScope}>{renderInlineNode(entry.scopeOfActivity)}</Text>
        )}
        <View style={pdfStyles.expDescription}>{blocks}</View>
      </View>
    </View>
  );
}

export function CvDocument(): ReactElement {
  const contacts = getContactsForPdf();
  const years = getCareerStartYears();
  const fullName = welcomeT.hero.name;
  const roleLine = `${welcomeT.hero.headline1} ${welcomeT.hero.headline2} · ${welcomeT.hero.headlineAccent}`;

  return (
    <Document title={`${fullName} — CV`} author={fullName}>
      <Page size="A4" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <Image src={avatarPngUrl} style={pdfStyles.avatar} />
          <View style={pdfStyles.headerInfo}>
            <Text style={pdfStyles.name}>{fullName}</Text>
            <Text style={pdfStyles.role}>{roleLine}</Text>
            <Text style={pdfStyles.lead}>{welcomeT.hero.lead(years)}</Text>
            <View style={pdfStyles.contactsBlock}>
              {contacts.map(contact => (
                <View key={contact.key} style={pdfStyles.contactRow}>
                  <Text style={pdfStyles.contactType}>{contact.type}:</Text>
                  <Link src={contact.href} style={pdfStyles.contactValue}>
                    {contact.label}
                  </Link>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={pdfStyles.section} wrap={false}>
          <Text style={pdfStyles.sectionTitle}>{welcomeT.about.sectionKicker}</Text>
          <Text style={pdfStyles.sectionParagraph}>
            {renderInlineNode(welcomeT.about.paragraph1)}
          </Text>
          <Text style={pdfStyles.sectionParagraph}>
            {renderInlineNode(welcomeT.about.paragraph2)}
          </Text>
          <Text style={pdfStyles.sectionParagraph}>
            {renderInlineNode(welcomeT.about.paragraph3)}
          </Text>
        </View>

        <View style={pdfStyles.section} wrap={false}>
          <Text style={pdfStyles.sectionTitle}>{welcomeT.skills.sectionKicker}</Text>
          <View style={pdfStyles.skillsGrid}>
            {welcomeT.skills.groups.map(group => (
              <View key={group.group} style={pdfStyles.skillGroup} wrap={false}>
                <Text style={pdfStyles.skillGroupTitle}>{group.group}</Text>
                <Text style={pdfStyles.skillItems}>{group.items.join(' · ')}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={pdfStyles.section}>
          <Text style={pdfStyles.sectionTitle}>{welcomeT.experience.sectionKicker}</Text>
          {welcomeT.experience.entries.map((entry, index) => (
            <ExperienceEntryView key={entry.id} entry={entry} isFirst={index === 0} />
          ))}
        </View>

        <Text
          style={pdfStyles.pageNumber}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          fixed={true}
        />
      </Page>
    </Document>
  );
}
