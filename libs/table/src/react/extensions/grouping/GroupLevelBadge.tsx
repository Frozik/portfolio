import { observer } from 'mobx-react-lite';

import type { IGroupingSlice } from '../../../extensions/grouping/core';
import type { IHeaderContext } from '../../column';
import { useTableContext } from '../../context';

/** The 1-based grouping level of a grouped column, in its header. */
export const GroupLevelBadge = observer(function GroupLevelBadge<TRow>({
  table,
  column,
}: IHeaderContext<TRow>) {
  const { translations } = useTableContext<TRow>();
  const slice = table.extension<IGroupingSlice<TRow>>('grouping');
  const level = slice?.groupBy.indexOf(column.id) ?? -1;
  if (level === -1) {
    return null;
  }
  return (
    <span className="ft-group-level" title={translations.groupLevel(level + 1)}>
      {level + 1}
    </span>
  );
});
