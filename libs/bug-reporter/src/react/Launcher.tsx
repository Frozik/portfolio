import { Bug, Camera, Disc, PenLine } from 'lucide-react';
import type { ReactNode, ToggleEvent } from 'react';
import { useEffect, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import type { IReporterCapability, TReporterNotice } from '../reporter/state';
import type { IBugReporterTranslations } from './translations/types';

const MENU_ID = 'bug-reporter-menu';
const ICON_SIZE = 20;

/**
 * The bug button and the three-way menu it opens: screenshot, recording or
 * words alone. The button is the popover's invoker, so the browser owns
 * toggling and light dismiss; the toggle event keeps the reporter in step,
 * and the effect pushes the reporter's own transitions back to the popover.
 */
export function Launcher({
  open,
  capability,
  notice,
  translations,
  onOpen,
  onClose,
  onScreenshot,
  onRecord,
  onDescribe,
}: {
  readonly open: boolean;
  readonly capability: IReporterCapability;
  readonly notice: TReporterNotice | null;
  readonly translations: IBugReporterTranslations;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onScreenshot: () => void;
  readonly onRecord: () => void;
  readonly onDescribe: () => void;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = menu.current;
    if (element === null) {
      return;
    }
    if (open && !element.matches(':popover-open')) {
      element.showPopover();
    } else if (!open && element.matches(':popover-open')) {
      element.hidePopover();
      button.current?.focus();
    }
  }, [open]);

  const handleToggle = useEventCallback((event: ToggleEvent<HTMLDivElement>) => {
    if (event.newState === 'open') {
      onOpen();
    } else if (open) {
      onClose();
    }
  });

  return (
    <>
      <button
        ref={button}
        type="button"
        className="bug-reporter-launcher bug-reporter-hidden-on-capture"
        aria-label={translations.launcher}
        title={translations.launcher}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={MENU_ID}
        popoverTarget={MENU_ID}
      >
        <Bug size={ICON_SIZE} aria-hidden="true" />
      </button>
      <div
        ref={menu}
        id={MENU_ID}
        popover="auto"
        role="menu"
        aria-label={translations.menuTitle}
        className="bug-reporter-menu bug-reporter-hidden-on-capture"
        onToggle={handleToggle}
      >
        <p className="bug-reporter-menu-title">{translations.menuTitle}</p>
        {notice !== null && (
          <p className="bug-reporter-notice" role="alert">
            {translations.notices[notice]}
          </p>
        )}
        <div className="bug-reporter-menu-actions">
          {capability.screenshot && (
            <MenuAction
              label={translations.screenshot}
              onClick={onScreenshot}
              icon={<Camera size={ICON_SIZE} />}
            />
          )}
          {capability.recording && (
            <MenuAction
              label={translations.record}
              onClick={onRecord}
              icon={<Disc size={ICON_SIZE} />}
            />
          )}
          <MenuAction
            label={translations.describe}
            onClick={onDescribe}
            icon={<PenLine size={ICON_SIZE} />}
          />
        </div>
        <p className="bug-reporter-menu-hint">{translations.menuHint}</p>
      </div>
    </>
  );
}

function MenuAction({
  label,
  icon,
  onClick,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button type="button" role="menuitem" className="bug-reporter-menu-action" onClick={onClick}>
      <span className="bug-reporter-menu-icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );
}
