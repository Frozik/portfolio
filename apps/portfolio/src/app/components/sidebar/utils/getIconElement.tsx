import { isNil } from 'lodash-es';
import { Eye, Network } from 'lucide-react';
import { ICON_SIZE } from '../constants';

export function getIconElement(iconName: string | undefined): React.ReactElement | undefined {
  if (isNil(iconName)) {
    return undefined;
  }

  switch (iconName) {
    case 'eye':
      return <Eye size={ICON_SIZE} />;
    case 'network':
      return <Network size={ICON_SIZE} />;
    default:
      return undefined;
  }
}
