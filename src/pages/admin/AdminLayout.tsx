import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Users, Package, PackageCheck, ClipboardList, Percent, MapPin,
  Wallet, UserCircle, Tag, BarChart3, Mail, Languages, HelpCircle, FileText, Menu, X, Film,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

type NavItem = { label: string; to?: string; icon: LucideIcon; end?: boolean; badge?: number };
type NavGroup = { title?: string; items: NavItem[] };

function buildGroups(pendingProducts: number): NavGroup[] {
  return [
    { items: [{ label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true }] },
    {
      title: 'Marketplace',
      items: [
        { label: 'Sellers', to: '/admin/sellers', icon: Users },
        { label: 'All Products', to: '/admin/products', icon: Package },
        { label: 'Pending Approval', to: '/admin/approval', icon: PackageCheck, badge: pendingProducts },
        { label: 'Orders', to: '/admin/orders', icon: ClipboardList },
        { label: 'Seller Payouts', to: '/admin/payouts', icon: Wallet },
        { label: 'Reels Review', to: '/admin/reels', icon: Film },
      ],
    },
    {
      title: 'Configuration',
      items: [
        { label: 'Commission', to: '/admin/commission', icon: Percent },
        { label: 'Delivery Zones', to: '/admin/delivery', icon: MapPin },
        { label: 'Payment Methods', to: '/admin/payments', icon: Wallet },
      ],
    },
    {
      title: 'Coming soon',
      items: [
        { label: 'Customers', icon: UserCircle },
        { label: 'Discounts', icon: Tag },
        { label: 'Analytics', icon: BarChart3 },
        { label: 'Mail Settings', icon: Mail },
        { label: 'Translation', icon: Languages },
        { label: 'Shop FAQ', icon: HelpCircle },
        { label: 'Terms & Conditions', icon: FileText },
      ],
    },
  ];
}

function SidebarNav({ groups }: { groups: NavGroup[] }) {
  return (
    <nav className="space-y-5">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-dark-500">
              {group.title}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              if (!item.to) {
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-sm text-dark-600 cursor-not-allowed select-none"
                  >
                    <Icon className="w-4 h-4" />
                    <span className="flex-1">{item.label}</span>
                  </div>
                );
              }
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-dark-300 hover:bg-dark-700 hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1">{item.label}</span>
                  {!!item.badge && item.badge > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-500 text-dark-900 text-xs font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export default function AdminLayout() {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingProducts, setPendingProducts] = useState(0);

  // Refresh the "Pending Approval" badge whenever the admin moves between pages
  useEffect(() => {
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingProducts(count ?? 0));
    setDrawerOpen(false);
  }, [location.pathname]);

  const groups = buildGroups(pendingProducts);
  const current = groups
    .flatMap((g) => g.items)
    .find((i) => i.to && (i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)));

  return (
    <div className="lg:grid lg:grid-cols-[16rem_1fr] lg:gap-6 text-white">
      {/* Desktop sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 bg-dark-800 border border-dark-700 rounded-2xl p-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <SidebarNav groups={groups} />
        </div>
      </aside>

      {/* Mobile: menu button + drawer */}
      <div className="lg:hidden mb-4 flex items-center gap-3">
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-3 py-2 bg-dark-800 border border-dark-700 rounded-xl text-sm text-dark-200"
        >
          <Menu className="w-4 h-4" />
          Admin menu
        </button>
        {pendingProducts > 0 && (
          <span className="text-xs text-yellow-400">{pendingProducts} product(s) awaiting approval</span>
        )}
      </div>

      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85%] bg-dark-800 border-r border-dark-700 p-3 overflow-y-auto animate-slide-in">
            <div className="flex items-center justify-between px-2 py-2 mb-2">
              <span className="font-semibold">Admin Panel</span>
              <button onClick={() => setDrawerOpen(false)} className="p-1.5 text-dark-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarNav groups={groups} />
          </div>
        </div>
      )}

      <div className="min-w-0">
        <h1 className="text-2xl font-bold mb-5">{current?.label ?? 'Admin Panel'}</h1>
        <Outlet />
      </div>
    </div>
  );
}
