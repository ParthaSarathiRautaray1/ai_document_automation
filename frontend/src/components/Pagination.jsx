import { Button } from '@/components/ui/button';

/**
 * Prev/Next pager driven by the backend list `meta`
 * (`{ page, limit, total, pages }`). Renders nothing when there's a single
 * page. `busy` disables the buttons during a fetch; `noun` labels the count.
 *
 * @param {object} props
 * @param {{ page:number, pages:number, total:number }|undefined} props.meta
 * @param {()=>void} props.onPrev
 * @param {()=>void} props.onNext
 * @param {boolean} [props.busy]
 * @param {string} [props.noun] - singular noun for the count (e.g. 'item')
 */
export function Pagination({ meta, onPrev, onNext, busy = false, noun = 'item' }) {
  if (!meta || meta.pages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2 text-sm text-muted-foreground">
      <span>
        Page {meta.page} of {meta.pages} · {meta.total} {noun}
        {meta.total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={meta.page <= 1 || busy} onClick={onPrev}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={meta.page >= meta.pages || busy}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
