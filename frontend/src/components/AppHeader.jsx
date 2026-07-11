import { Building2, Contact, FileText, LayoutTemplate, LogOut, Package, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/utils';
import { PERMISSIONS } from '@/lib/permissions';
import { useAuthStore } from '@/store/authStore';

function HeaderNavLink({ to, icon, children }) {
  const Icon = icon;
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-secondary text-secondary-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )
      }
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </NavLink>
  );
}

/** App chrome for authenticated pages: brand, permission-aware nav, theme, logout. */
export function AppHeader() {
  const logout = useAuthStore((s) => s.logout);
  const can = useAuthStore((s) => s.can);

  return (
    <header className="flex items-center justify-between border-b border-border px-5 py-3">
      <div className="flex items-center gap-6">
        <NavLink to="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <FileText className="h-4 w-4" aria-hidden="true" />
          </span>
          <span>DocFlow&nbsp;AI</span>
        </NavLink>
        <nav className="flex items-center gap-1">
          {can(PERMISSIONS.USER_READ) ? (
            <HeaderNavLink to="/users" icon={Users}>
              Users
            </HeaderNavLink>
          ) : null}
          {can(PERMISSIONS.CUSTOMER_READ) ? (
            <HeaderNavLink to="/customers" icon={Contact}>
              Customers
            </HeaderNavLink>
          ) : null}
          {can(PERMISSIONS.PRODUCT_READ) ? (
            <HeaderNavLink to="/products" icon={Package}>
              Catalog
            </HeaderNavLink>
          ) : null}
          {can(PERMISSIONS.TEMPLATE_READ) ? (
            <HeaderNavLink to="/templates" icon={LayoutTemplate}>
              Templates
            </HeaderNavLink>
          ) : null}
          {can(PERMISSIONS.ORG_READ) ? (
            <HeaderNavLink to="/organization" icon={Building2}>
              Organization
            </HeaderNavLink>
          ) : null}
        </nav>
      </div>
      <div className="flex items-center gap-1">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={logout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}
