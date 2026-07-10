import { FileText } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';

/** Centered card shell used by every auth screen. */
export function AuthLayout({ title, description, children, footer }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>DocFlow&nbsp;AI</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="grid flex-1 place-items-center px-4 pb-16 pt-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            {description ? <CardDescription>{description}</CardDescription> : null}
          </CardHeader>
          <CardContent>{children}</CardContent>
          {footer ? (
            <CardFooter className="justify-center text-sm text-muted-foreground">{footer}</CardFooter>
          ) : null}
        </Card>
      </main>
    </div>
  );
}
