import { Document, Page, Path, StyleSheet, Svg, Text, View } from '@react-pdf/renderer';
import { encode } from 'uqr';

import { ensurePdfFontsRegistered, PDF_FONT_FAMILY } from '../../../../shared/lib/pdf/pdf-fonts';
import type { keysTranslationsEn } from '../translations/keys-en';

ensurePdfFontsRegistered();

const QR_SIZE = 132;
const INK = '#111111';
const MUTED = '#555555';
const RULE = '#bbbbbb';

const styles = StyleSheet.create({
  page: { padding: 48, fontFamily: PDF_FONT_FAMILY, fontSize: 10, color: INK },
  title: { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  intro: { color: MUTED, marginBottom: 24, lineHeight: 1.4 },
  label: { fontSize: 8, color: MUTED, textTransform: 'uppercase', marginBottom: 3 },
  value: { fontSize: 12, marginBottom: 14 },
  keyRow: { flexDirection: 'row', gap: 24, alignItems: 'center', marginBottom: 18 },
  key: { fontSize: 15, fontWeight: 700, letterSpacing: 1, lineHeight: 1.6 },
  blank: { borderBottom: `1 solid ${RULE}`, height: 28, marginBottom: 6 },
  hint: { color: MUTED, fontSize: 8, marginBottom: 18 },
  step: { marginBottom: 4, lineHeight: 1.4 },
});

export interface IEmergencyKitContent {
  readonly vaultName: string;
  readonly location: string;
  readonly createdOn: string;
  readonly siteAddress: string;
  readonly recoveryKey: string;
  readonly texts: (typeof keysTranslationsEn)['kit'];
}

/** The dark modules of the key's QR code as one path, a unit square each. */
function qrPath(text: string): { readonly d: string; readonly size: number } {
  const { data, size } = encode(text, { ecc: 'M', border: 1 });
  const squares = data.flatMap((row, y) =>
    row.flatMap((dark, x) => (dark ? [`M${x} ${y}h1v1h-1z`] : []))
  );
  return { d: squares.join(''), size };
}

/**
 * The Emergency Kit, after 1Password's: the vault, where it
 * lives, the day, the recovery key as text and QR, a line to write the master
 * password by hand, and how to get back in. Never the master password itself.
 */
export function EmergencyKitDocument({ kit }: { readonly kit: IEmergencyKitContent }) {
  const t = kit.texts;
  const qr = qrPath(kit.recoveryKey);
  return (
    <Document title={`${t.title} — ${kit.vaultName}`}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{t.title}</Text>
        <Text style={styles.intro}>{t.intro}</Text>
        <Text style={styles.label}>{t.vault}</Text>
        <Text style={styles.value}>{kit.vaultName}</Text>
        <Text style={styles.label}>{t.location}</Text>
        <Text style={styles.value}>{kit.location}</Text>
        <Text style={styles.label}>{t.created}</Text>
        <Text style={styles.value}>{kit.createdOn}</Text>
        <Text style={styles.label}>{t.recoveryKey}</Text>
        <View style={styles.keyRow}>
          <Text style={styles.key}>{kit.recoveryKey}</Text>
          <Svg width={QR_SIZE} height={QR_SIZE} viewBox={`0 0 ${qr.size} ${qr.size}`}>
            <Path d={qr.d} fill={INK} />
          </Svg>
        </View>
        <Text style={styles.label}>{t.masterPassword}</Text>
        <View style={styles.blank} />
        <Text style={styles.hint}>{t.masterPasswordHint}</Text>
        <Text style={styles.label}>{t.howTo}</Text>
        {t.steps(kit.siteAddress).map(step => (
          <Text key={step} style={styles.step}>
            {step}
          </Text>
        ))}
      </Page>
    </Document>
  );
}
