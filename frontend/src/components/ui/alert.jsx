import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Inline alert for form-level feedback. `variant` drives color + icon.
 */
export function Alert({ variant = 'destructive', className, children, ...props }) {
  const Icon = variant === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm',
        variant === 'success'
          ? 'border-primary/30 bg-primary/10 text-foreground'
          : 'border-destructive/30 bg-destructive/10 text-destructive',
        className
      )}
      {...props}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
