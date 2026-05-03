import { StyleSheet } from '@react-pdf/renderer';

import { PDF_FONT_FAMILY } from './pdfFonts';

const COLOR_BG = '#ffffff';
const COLOR_TEXT = '#1f2937';
const COLOR_TEXT_DIM = '#4b5563';
const COLOR_TEXT_FAINT = '#9ca3af';
const COLOR_ACCENT = '#2563eb';
const COLOR_BORDER = '#e5e7eb';
const COLOR_BORDER_SOFT = '#f3f4f6';

const PAGE_MARGIN_PT = 36;
const PAGE_MARGIN_TOP_PT = 32;
const HEADER_GAP_PT = 16;
const AVATAR_SIZE_PT = 78;
const SECTION_GAP_PT = 18;
const SUB_SECTION_GAP_PT = 8;
const SKILL_GROUP_GAP_PT = 10;
const EXP_HEADER_GAP_PT = 6;
const EXP_BODY_GAP_PT = 4;
const EXP_DATE_COLUMN_WIDTH_PT = 110;
const EXP_GAP_PT = 14;
const BULLET_INDENT_PT = 10;
const SECTION_TITLE_TRACKING_PT = 1.4;
const PAGE_NUMBER_FONT_SIZE_PT = 8;

const FONT_SIZE_NAME_PT = 22;
const FONT_SIZE_ROLE_PT = 11;
const FONT_SIZE_LEAD_PT = 9.5;
const FONT_SIZE_BODY_PT = 9.5;
const FONT_SIZE_SECTION_TITLE_PT = 9;
const FONT_SIZE_HEADING_PT = 11;
const FONT_SIZE_DESC_HEADING_PT = 9.5;
const FONT_SIZE_SMALL_PT = 8.5;

const LINE_HEIGHT_BODY = 1.45;
const LINE_HEIGHT_TIGHT = 1.3;

export const pdfStyles = StyleSheet.create({
  page: {
    backgroundColor: COLOR_BG,
    color: COLOR_TEXT,
    fontFamily: PDF_FONT_FAMILY,
    fontSize: FONT_SIZE_BODY_PT,
    lineHeight: LINE_HEIGHT_BODY,
    paddingTop: PAGE_MARGIN_TOP_PT,
    paddingBottom: PAGE_MARGIN_PT,
    paddingLeft: PAGE_MARGIN_PT,
    paddingRight: PAGE_MARGIN_PT,
  },

  header: {
    flexDirection: 'row',
    gap: HEADER_GAP_PT,
    marginBottom: SECTION_GAP_PT,
    paddingBottom: SECTION_GAP_PT,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER,
    borderBottomStyle: 'solid',
  },
  avatar: {
    width: AVATAR_SIZE_PT,
    height: AVATAR_SIZE_PT,
    borderRadius: AVATAR_SIZE_PT / 2,
    objectFit: 'cover',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'column',
    gap: 4,
  },
  name: {
    fontSize: FONT_SIZE_NAME_PT,
    fontWeight: 700,
    color: COLOR_TEXT,
    letterSpacing: -0.4,
    lineHeight: 1.15,
    marginBottom: 6,
  },
  role: {
    fontSize: FONT_SIZE_ROLE_PT,
    color: COLOR_TEXT_DIM,
  },
  lead: {
    fontSize: FONT_SIZE_LEAD_PT,
    color: COLOR_TEXT_DIM,
    marginTop: 4,
    lineHeight: LINE_HEIGHT_BODY,
  },

  contactsBlock: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SUB_SECTION_GAP_PT,
    marginTop: SUB_SECTION_GAP_PT,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  contactType: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_TEXT_FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  contactValue: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_ACCENT,
    textDecoration: 'none',
  },

  section: {
    marginBottom: SECTION_GAP_PT,
  },
  sectionTitle: {
    fontSize: FONT_SIZE_SECTION_TITLE_PT,
    fontWeight: 700,
    color: COLOR_ACCENT,
    textTransform: 'uppercase',
    letterSpacing: SECTION_TITLE_TRACKING_PT,
    marginBottom: SUB_SECTION_GAP_PT,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: COLOR_BORDER_SOFT,
    borderBottomStyle: 'solid',
  },
  sectionParagraph: {
    color: COLOR_TEXT_DIM,
    marginBottom: 4,
  },

  skillsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: SKILL_GROUP_GAP_PT,
  },
  skillGroup: {
    width: '50%',
    paddingRight: 12,
    marginBottom: 0,
  },
  skillGroupTitle: {
    fontSize: FONT_SIZE_SMALL_PT,
    fontWeight: 700,
    color: COLOR_TEXT,
    marginBottom: 2,
  },
  skillItems: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_TEXT_DIM,
    lineHeight: LINE_HEIGHT_TIGHT,
  },

  expItem: {
    flexDirection: 'row',
    gap: EXP_GAP_PT,
    paddingTop: EXP_GAP_PT,
    borderTopWidth: 1,
    borderTopColor: COLOR_BORDER_SOFT,
    borderTopStyle: 'solid',
  },
  expItemFirst: {
    flexDirection: 'row',
    gap: EXP_GAP_PT,
    paddingTop: 4,
  },
  expDateColumn: {
    width: EXP_DATE_COLUMN_WIDTH_PT,
    flexDirection: 'column',
    gap: 2,
  },
  expDateRange: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_ACCENT,
    fontWeight: 700,
  },
  expDuration: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_TEXT_FAINT,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  expLocation: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_TEXT_FAINT,
    marginTop: 2,
  },
  expBody: {
    flex: 1,
    flexDirection: 'column',
    gap: EXP_BODY_GAP_PT,
  },
  expCompany: {
    fontSize: FONT_SIZE_HEADING_PT,
    fontWeight: 700,
    color: COLOR_TEXT,
  },
  expCompanyLink: {
    fontSize: FONT_SIZE_HEADING_PT,
    fontWeight: 700,
    color: COLOR_TEXT,
    textDecoration: 'none',
  },
  expRole: {
    fontSize: FONT_SIZE_BODY_PT,
    color: COLOR_TEXT_DIM,
    marginBottom: EXP_HEADER_GAP_PT,
  },
  expScope: {
    fontSize: FONT_SIZE_SMALL_PT,
    color: COLOR_TEXT_FAINT,
    marginBottom: EXP_HEADER_GAP_PT,
  },
  expDescription: {
    flexDirection: 'column',
    gap: EXP_BODY_GAP_PT,
  },

  descHeading: {
    fontSize: FONT_SIZE_DESC_HEADING_PT,
    fontWeight: 700,
    color: COLOR_TEXT,
    marginTop: EXP_BODY_GAP_PT,
    marginBottom: 1,
  },
  descParagraph: {
    color: COLOR_TEXT_DIM,
    marginBottom: 2,
  },
  descList: {
    flexDirection: 'column',
    marginBottom: 2,
  },
  descListItem: {
    flexDirection: 'row',
    paddingLeft: 0,
    marginBottom: 1,
  },
  descBullet: {
    width: BULLET_INDENT_PT,
    color: COLOR_TEXT_FAINT,
  },
  descListText: {
    flex: 1,
    color: COLOR_TEXT_DIM,
  },
  bold: {
    fontWeight: 700,
    color: COLOR_TEXT,
  },
  link: {
    color: COLOR_ACCENT,
    textDecoration: 'none',
  },

  pageNumber: {
    position: 'absolute',
    bottom: 16,
    left: PAGE_MARGIN_PT,
    right: PAGE_MARGIN_PT,
    textAlign: 'center',
    fontSize: PAGE_NUMBER_FONT_SIZE_PT,
    color: COLOR_TEXT_FAINT,
  },
});
