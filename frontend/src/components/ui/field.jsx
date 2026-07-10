import { Label } from '@/components/ui/label';

/**
 * Labelled form control wrapper: renders the label, the control (as children),
 * an optional hint, and a validation error. Wire `htmlFor`/`id` for a11y.
 */
export function FormField({ id, label, error, hint, children }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? (
        <p className="text-xs font-medium text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
