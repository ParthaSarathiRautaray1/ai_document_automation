import { Link } from 'react-router-dom';
import { buttonVariants } from '@/components/ui/button';

export default function NotFoundPage() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div className="space-y-4">
        <p className="text-5xl font-semibold tracking-tight">404</p>
        <p className="text-muted-foreground">We couldn&apos;t find that page.</p>
        <Link to="/" className={buttonVariants()}>
          Go home
        </Link>
      </div>
    </div>
  );
}
