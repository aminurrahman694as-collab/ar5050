import { Link, useLocation } from 'react-router-dom';
import { LogIn, ClipboardList, LayoutDashboard, Store, ShoppingCart, Home, LayoutGrid, Film, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { isPathActive, useNavLinks } from './useNavLinks';
import CartBadge from './CartBadge';

interface BottomNavProps {
  onLoginClick: () => void;
  /** Opens the side drawer (the "Categories" tab). */
  onCategoriesClick: () => void;
  /** True while the drawer is open, so the Categories tab lights up. */
  categoriesActive?: boolean;
}

type Item = { label: string; icon: LucideIcon; path?: string; onClick?: () => void; active?: boolean; highlight?: boolean };

export default function BottomNav({ onLoginClick, onCategoriesClick, categoriesActive = false }: BottomNavProps) {
  const { user, isAdmin, isSeller } = useNavLinks();
  const location = useLocation();

  const last: Item = !user
    ? { label: 'Login', icon: LogIn, onClick: onLoginClick }
    : isAdmin
      ? { label: 'Admin', icon: Store, path: '/admin' }
      : isSeller
        ? { label: 'Dashboard', icon: LayoutDashboard, path: '/seller' }
        : { label: 'Orders', icon: ClipboardList, path: '/orders' };

  // Home / Categories (opens the drawer) / Create (＋) / Reels / Cart / Account
  // Guests tapping ＋ get the login popup (posting needs an account).
  const create: Item = user
    ? { label: 'Create', icon: Plus, path: '/create', highlight: true }
    : { label: 'Create', icon: Plus, onClick: onLoginClick, highlight: true };
  const items: Item[] = [
    { label: 'Home', icon: Home, path: '/' },
    { label: 'Categories', icon: LayoutGrid, onClick: onCategoriesClick, active: categoriesActive },
    create,
    { label: 'Reels', icon: Film, path: '/reels' },
    { label: 'Cart', icon: ShoppingCart, path: '/cart' },
    last,
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-dark-900/95 backdrop-blur-xl border-t border-white/5"
      style={{ height: 'var(--bottom-nav-h)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="h-[60px] grid grid-cols-6">
        {items.map((item) => {
          const active = item.path ? isPathActive(location.pathname, item.path) : Boolean(item.active);
          const content = item.highlight ? (
            <>
              <span className="flex h-8 w-11 items-center justify-center rounded-xl bg-primary-600 text-white shadow-md shadow-primary-900/40">
                <item.icon className="w-5 h-5" />
              </span>
              <span className="sr-only">{item.label}</span>
            </>
          ) : (
            <>
              <span className="relative">
                <item.icon className={`w-5 h-5 ${active ? 'text-primary-400' : ''}`} />
                {item.path === '/cart' && <CartBadge />}
              </span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </>
          );
          const cls = `flex flex-col items-center justify-center gap-1 transition-colors ${
            active ? 'text-primary-400' : 'text-dark-400 active:text-white'
          }`;
          return item.path ? (
            <Link key={item.label} to={item.path} className={cls}>
              {content}
            </Link>
          ) : (
            <button key={item.label} onClick={item.onClick} className={cls}>
              {content}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
