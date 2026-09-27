import { observer } from 'mobx-react-lite';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import type { ITooltipsSlice } from '../../../extensions/tooltips/core';
import { useTableContext } from '../../context';
import type { IViewContext } from '../../slots';

const GAP = 6;

export interface ITooltipContent {
  readonly key: string;
  readonly render: () => ReactNode;
  readonly placement: 'top' | 'bottom';
  readonly interactive: boolean;
  readonly maxWidth: number | undefined;
}

/** The registry the cells write their tooltip content into; the layer reads the open one. */
export class TooltipContents {
  private readonly byKey = new Map<string, ITooltipContent>();

  set(content: ITooltipContent): void {
    this.byKey.set(content.key, content);
  }

  delete(key: string): void {
    this.byKey.delete(key);
  }

  get(key: string): ITooltipContent | undefined {
    return this.byKey.get(key);
  }
}

export function tooltipLayerFor<TRow>(contents: TooltipContents) {
  return observer(function TooltipLayer({ table }: IViewContext<TRow>) {
    const { translations } = useTableContext<TRow>();
    const slice = table.extension<ITooltipsSlice>('tooltips');
    const open = slice?.open ?? null;
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      if (open === null || slice === undefined) {
        setVisible(false);
        return undefined;
      }
      const timer = setTimeout(() => setVisible(true), slice.delayMs);
      return () => clearTimeout(timer);
    }, [open, slice]);

    const content = open === null ? undefined : contents.get(open.key);
    if (open === null || content === undefined || !visible || slice === undefined) {
      return null;
    }
    const { anchor } = open;
    const style: CSSProperties = {
      left: anchor.left,
      top: content.placement === 'top' ? undefined : anchor.top + anchor.height + GAP,
      bottom: content.placement === 'top' ? `calc(100% - ${anchor.top - GAP}px)` : undefined,
      maxWidth: content.maxWidth ?? slice.maxWidth,
    };
    return (
      <div
        role="tooltip"
        aria-label={translations.tooltip}
        className="ft-tooltip"
        data-placement={content.placement}
        data-interactive={content.interactive || slice.interactive ? '' : undefined}
        style={style}
        onPointerLeave={() => slice.hide(open.key)}
      >
        {content.render()}
      </div>
    );
  });
}
