import { Camera, Disc, Download, X } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IDiagnosticsCounts, TDiagnosticsSection, TIncludedSections } from '../core/report';
import { DIAGNOSTICS_SECTIONS } from '../core/report';
import type {
  IReporterCapability,
  TDraftAttachment,
  TReporterNotice,
  TReporterPhase,
} from '../reporter/state';
import { ScreenshotThumbnail } from './ScreenshotThumbnail';
import type { IBugReporterTranslations } from './translations/types';
import { useObjectUrl } from './useObjectUrl';

const ICON_SIZE = 16;
const MILLISECONDS = 1_000;

/** Comment, attachments and the list of what the archive will contain, then the download. */
export function ComposePanel({
  phase,
  comment,
  attachments,
  included,
  counts,
  capability,
  notice,
  translations,
  onCommentChange,
  onIncludedChange,
  onRemoveAttachment,
  onAddScreenshot,
  onAddRecording,
  onDownload,
  onCancel,
}: {
  readonly phase: Extract<TReporterPhase, { kind: 'composing' | 'packaging' }>;
  readonly comment: string;
  readonly attachments: readonly TDraftAttachment[];
  readonly included: TIncludedSections;
  readonly counts: IDiagnosticsCounts;
  readonly capability: IReporterCapability;
  readonly notice: TReporterNotice | null;
  readonly translations: IBugReporterTranslations;
  readonly onCommentChange: (comment: string) => void;
  readonly onIncludedChange: (section: TDiagnosticsSection, included: boolean) => void;
  readonly onRemoveAttachment: (id: string) => void;
  readonly onAddScreenshot: () => void;
  readonly onAddRecording: () => void;
  readonly onDownload: () => void;
  readonly onCancel: () => void;
}) {
  const packaging = phase.kind === 'packaging';
  const handleComment = useEventCallback((event: ChangeEvent<HTMLTextAreaElement>) =>
    onCommentChange(event.target.value)
  );

  return (
    <div className="bug-reporter-compose">
      <header className="bug-reporter-compose-header">
        <h2 className="bug-reporter-title">{translations.composeTitle}</h2>
        <button
          type="button"
          className="bug-reporter-icon-button"
          aria-label={translations.cancel}
          disabled={packaging}
          onClick={onCancel}
        >
          <X size={ICON_SIZE} aria-hidden="true" />
        </button>
      </header>
      {notice !== null && (
        <p className="bug-reporter-notice" role="alert">
          {translations.notices[notice]}
        </p>
      )}
      <label className="bug-reporter-field">
        <span className="bug-reporter-label">{translations.commentLabel}</span>
        <textarea
          className="bug-reporter-textarea"
          rows={4}
          value={comment}
          placeholder={translations.commentPlaceholder}
          disabled={packaging}
          onChange={handleComment}
        />
      </label>
      <section className="bug-reporter-section" aria-label={translations.attachments}>
        <span className="bug-reporter-label">{translations.attachments}</span>
        {attachments.length === 0 ? (
          <p className="bug-reporter-muted">{translations.noAttachments}</p>
        ) : (
          <ul className="bug-reporter-attachments">
            {attachments.map(attachment => (
              <AttachmentCard
                key={attachment.id}
                attachment={attachment}
                translations={translations}
                disabled={packaging}
                onRemove={onRemoveAttachment}
              />
            ))}
          </ul>
        )}
        <div className="bug-reporter-add-actions">
          {capability.screenshot && (
            <button
              type="button"
              className="bug-reporter-button bug-reporter-button-small"
              disabled={packaging}
              onClick={onAddScreenshot}
            >
              <Camera size={ICON_SIZE} aria-hidden="true" />
              {translations.addScreenshot}
            </button>
          )}
          {capability.recording && (
            <button
              type="button"
              className="bug-reporter-button bug-reporter-button-small"
              disabled={packaging}
              onClick={onAddRecording}
            >
              <Disc size={ICON_SIZE} aria-hidden="true" />
              {translations.addRecording}
            </button>
          )}
        </div>
      </section>
      <fieldset className="bug-reporter-section bug-reporter-included" disabled={packaging}>
        <legend className="bug-reporter-label">{translations.includedTitle}</legend>
        {DIAGNOSTICS_SECTIONS.map(section => (
          <IncludedToggle
            key={section}
            section={section}
            checked={included[section]}
            label={sectionLabel(section, translations.sections[section], counts)}
            onChange={onIncludedChange}
          />
        ))}
      </fieldset>
      <footer className="bug-reporter-actions">
        {packaging && (
          <span className="bug-reporter-progress" role="status" aria-live="polite">
            {translations.packaging} {translations.bytes(phase.writtenBytes)}
          </span>
        )}
        <button
          type="button"
          className="bug-reporter-button bug-reporter-button-primary"
          disabled={packaging}
          onClick={onDownload}
        >
          <Download size={ICON_SIZE} aria-hidden="true" />
          {translations.download}
        </button>
      </footer>
    </div>
  );
}

function IncludedToggle({
  section,
  checked,
  label,
  onChange,
}: {
  readonly section: TDiagnosticsSection;
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (section: TDiagnosticsSection, included: boolean) => void;
}) {
  const handleChange = useEventCallback((event: ChangeEvent<HTMLInputElement>) =>
    onChange(section, event.target.checked)
  );
  return (
    <label className="bug-reporter-check">
      <input type="checkbox" checked={checked} onChange={handleChange} />
      {label}
    </label>
  );
}

function AttachmentCard({
  attachment,
  translations,
  disabled,
  onRemove,
}: {
  readonly attachment: TDraftAttachment;
  readonly translations: IBugReporterTranslations;
  readonly disabled: boolean;
  readonly onRemove: (id: string) => void;
}) {
  const media = attachment.kind === 'screenshot' ? attachment.image : attachment.video;
  const handleRemove = useEventCallback(() => onRemove(attachment.id));
  return (
    <li className="bug-reporter-attachment">
      {attachment.kind === 'screenshot' ? (
        <ScreenshotThumbnail
          image={attachment.image}
          annotation={attachment.annotation}
          alt={translations.screenshot}
        />
      ) : (
        <VideoPreview video={attachment.video} />
      )}
      <span className="bug-reporter-attachment-meta">
        {attachment.kind === 'screenshot'
          ? translations.screenshot
          : `${translations.record} · ${translations.duration(Math.round(attachment.durationMs / MILLISECONDS))}`}
        {' · '}
        {translations.bytes(media.size)}
      </span>
      <button
        type="button"
        className="bug-reporter-icon-button"
        aria-label={translations.remove}
        disabled={disabled}
        onClick={handleRemove}
      >
        <X size={ICON_SIZE} aria-hidden="true" />
      </button>
    </li>
  );
}

function sectionLabel(
  section: TDiagnosticsSection,
  name: string,
  counts: IDiagnosticsCounts
): string {
  switch (section) {
    case 'console':
    case 'errors':
    case 'breadcrumbs':
    case 'network':
    case 'performance':
      return `${name} (${counts[section]})`;
    case 'environment':
      return name;
    default:
      return section satisfies never;
  }
}

function VideoPreview({ video }: { readonly video: Blob }) {
  const url = useObjectUrl(video);
  return url === null ? null : (
    <video src={url} controls muted playsInline className="bug-reporter-thumbnail" />
  );
}
