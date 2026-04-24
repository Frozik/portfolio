import type {
  HTMLAttributeAnchorTarget,
  HTMLAttributes,
  MouseEvent,
  MouseEventHandler,
  ReactNode,
} from 'react';
import { memo } from 'react';
import type { NavigateOptions, To } from 'react-router-dom';
import { createPath, useLocation, useNavigate, useResolvedPath } from 'react-router-dom';

import { useFunction } from '../../hooks/useFunction';
import { shouldProcessLinkClick } from './utils';

export const RouteLink = memo(
  ({
    children,
    relative,
    replace: replaceProp,
    state,
    target,
    to,
    preventScrollReset,
    onClick,
    className,
    ...restProps
  }: {
    to: To;
    target?: HTMLAttributeAnchorTarget;
    onClick?: MouseEventHandler;
    children?: ReactNode;
    className?: string;
  } & Pick<NavigateOptions, 'state' | 'replace' | 'preventScrollReset' | 'relative'> &
    Omit<HTMLAttributes<HTMLButtonElement>, 'onClick'>) => {
    const navigate = useNavigate();
    const location = useLocation();
    const path = useResolvedPath(to, { relative });

    const internalOnClick = useFunction((event: MouseEvent) => {
      if (!event.defaultPrevented && shouldProcessLinkClick(event, target)) {
        event.preventDefault();

        const replace =
          replaceProp !== undefined ? replaceProp : createPath(location) === createPath(path);

        navigate(to, {
          replace,
          state,
          preventScrollReset,
          relative,
        });

        onClick?.(event);
      }
    });

    return (
      <button type="button" className={className} onClick={internalOnClick} {...restProps}>
        {children}
      </button>
    );
  }
);
