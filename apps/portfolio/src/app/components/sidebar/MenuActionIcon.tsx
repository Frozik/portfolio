import { useFunction } from '@frozik/components';
import { isEmpty } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { FloatingButton, Tooltip } from '../../../shared/ui';
import type { IMenuAction } from '../../stores/CommonStore';
import { getIconElement } from './utils/getIconElement';

export const MenuActionIcon = observer(({ action }: { action: IMenuAction }) => {
  const handleClick = useFunction(() => action.callback());

  const icon = getIconElement(action.icon);

  const button = <FloatingButton icon={icon} onClick={handleClick} inline />;

  return isEmpty(action.tooltip) ? (
    button
  ) : (
    <Tooltip title={action.tooltip} placement="right">
      {button}
    </Tooltip>
  );
});
