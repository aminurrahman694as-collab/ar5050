import { ShoppingBag, Film, Home, ClipboardList, Sparkles, LayoutDashboard, Store, PlusSquare, UserCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export type NavLink = { label: string; path: string; icon: LucideIcon };

export function isPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  if (path === '/shop') return pathname === '/shop' || pathname.startsWith('/product/');
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function useNavLinks() {
  const { user, profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const isCustomer = profile?.role === 'customer';

  const main: NavLink[] = [
    { label: 'Home', path: '/', icon: Home },
    { label: 'Shop', path: '/shop', icon: ShoppingBag },
    { label: 'Reels', path: '/reels', icon: Film },
  ];

  const account: NavLink[] = [];
  if (user) account.push({ label: 'Create a Reel', path: '/create', icon: PlusSquare });
  if (user) account.push({ label: 'My Profile', path: '/profile', icon: UserCircle });
  if (user) account.push({ label: 'My Orders', path: '/orders', icon: ClipboardList });
  if (user && isCustomer) account.push({ label: 'Become a Seller', path: '/become-seller', icon: Sparkles });
  if (isSeller || isAdmin) account.push({ label: 'Seller Dashboard', path: '/seller', icon: LayoutDashboard });
  if (isAdmin) account.push({ label: 'Admin Panel', path: '/admin', icon: Store });

  return { main, account, user, profile, isAdmin, isSeller, isCustomer };
}
