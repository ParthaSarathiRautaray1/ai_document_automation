import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/**
 * A search text field with a leading magnifier icon. Spreads remaining props
 * (value/onChange/placeholder/aria-label) onto the underlying input.
 */
export function SearchInput({ className, ...props }) {
  return (
    <div className={cn('relative flex-1', className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input className="pl-9" type="search" {...props} />
    </div>
  );
}
