import type { VariantProps } from 'class-variance-authority';
import { cva } from 'class-variance-authority';
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { memo } from 'react';
import { cn } from '../lib/cn';

const alertVariants = cva('flex gap-3 rounded-lg border p-4', {
  variants: {
    type: {
      info: 'border-info/30 bg-info/10 text-info',
      success: 'border-success/30 bg-success/10 text-success',
      warning: 'border-warning/30 bg-warning/10 text-warning',
      error: 'border-error/30 bg-error/10 text-error',
    },
  },
  defaultVariants: {
    type: 'info',
  },
});

const ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  warning: TriangleAlert,
  error: AlertCircle,
} as const;

const ICON_SIZE = 18;

type AlertProps = VariantProps<typeof alertVariants> & {
  message: ReactNode;
  description?: ReactNode;
  className?: string;
};

export const Alert = memo(({ type = 'info', message, description, className }: AlertProps) => {
  const Icon = ICON_MAP[type ?? 'info'];

  return (
    <div className={cn(alertVariants({ type }), className)} role="alert">
      <Icon className="mt-0.5 shrink-0" size={ICON_SIZE} />
      <div className="flex flex-col gap-1">
        <div className="font-medium">{message}</div>
        {description && <div className="text-sm opacity-80">{description}</div>}
      </div>
    </div>
  );
});

export type { AlertProps };
