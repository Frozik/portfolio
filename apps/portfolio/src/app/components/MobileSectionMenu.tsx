import { useFunction } from '@frozik/components';
import { memo } from 'react';

import type { INavSectionTranslation } from '../../features/welcome/presentation/translations';
import { Drawer } from '../../shared/ui/Drawer';

type MobileSectionMenuProps = {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly sections: readonly INavSectionTranslation[];
  readonly title: string;
  readonly onNavigate: (sectionId: string) => void;
};

const MobileSectionMenuComponent = ({
  open,
  onClose,
  sections,
  title,
  onNavigate,
}: MobileSectionMenuProps) => {
  const handleClick = useFunction((sectionId: string) => {
    onNavigate(sectionId);
    onClose();
  });

  return (
    <Drawer open={open} onClose={onClose} placement="right" title={title}>
      <ul className="flex flex-col gap-1">
        {sections.map(section => (
          <li key={section.id}>
            <button
              type="button"
              className="flex w-full items-baseline gap-3 rounded-sm border border-transparent px-3 py-3 text-left font-mono text-sm text-landing-fg-dim transition-colors hover:border-landing-border hover:text-landing-fg"
              onClick={() => handleClick(section.id)}
            >
              <span className="w-6 text-landing-fg-faint">{section.number}</span>
              <span>{section.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Drawer>
  );
};

export const MobileSectionMenu = memo(MobileSectionMenuComponent);
