import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        primary: 'border-primary/30 bg-primary/10 text-primary',
        success:
          'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        warning:
          'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400',
        destructive: 'border-destructive/30 bg-destructive/10 text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export function Badge({ className, variant, ...props }) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
