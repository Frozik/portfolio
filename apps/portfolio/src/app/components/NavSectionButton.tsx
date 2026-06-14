import { useFunction } from '@frozik/components/hooks/useFunction';
import { memo } from 'react';
import type { INavSectionTranslation } from '../translations';

export const NavSectionButton = memo(
  ({
    section,
    className,
    onSelect,
  }: {
    readonly section: INavSectionTranslation;
    readonly className: string;
    readonly onSelect: (sectionId: string) => void;
  }) => {
    const handleClick = useFunction(() => {
      onSelect(section.id);
    });
    return (
      <li>
        <button type="button" className={className} onClick={handleClick}>
          <span className="w-6 text-landing-fg-faint">{section.number}</span>
          <span>{section.label}</span>
        </button>
      </li>
    );
  }
);
