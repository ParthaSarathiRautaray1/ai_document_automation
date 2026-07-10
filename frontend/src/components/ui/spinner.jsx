import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small inline loading spinner (respects reduced-motion via Tailwind's animate). */
export function Spinner({ className, label = 'Loading' }) {
  return (
    <span role="status" aria-label={label}>
      <Loader2 className={cn('h-4 w-4 animate-spin motion-reduce:animate-none', className)} aria-hidden="true" />
    </span>
  );
}
