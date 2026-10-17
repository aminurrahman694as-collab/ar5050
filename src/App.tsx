import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CartProvider } from './hooks/useCart';
import Layout from './components/Layout';
import BecomeSeller from './pages/BecomeSeller';
import AdminLayout from './pages/admin/AdminLayout';
import AdminHome from './pages/admin/AdminHome';
import AdminSellers from './pages/admin/AdminSellers';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import ProductApproval from './pages/admin/ProductApproval';
import CommissionSettings from './pages/admin/CommissionSettings';
import DeliveryZones from './pages/admin/DeliveryZones';
import PaymentSettings from './pages/admin/PaymentSettings';
import AdminSellerPayouts from './pages/admin/SellerPayouts';
import ReelsReview from './pages/admin/ReelsReview';
import Create from './pages/creator/Create';
import CreatorProfile, { MyProfileRedirect } from './pages/creator/CreatorProfile';
import SellerDashboard from './pages/seller/SellerDashboard';
import Shop from './pages/shop/Shop';
import ProductDetail from './pages/shop/ProductDetail';
import ReelsFeed from './pages/shop/ReelsFeed';
import Checkout from './pages/shop/Checkout';
import OrderDetail from './pages/shop/OrderDetail';
import MyOrders from './pages/shop/MyOrders';
import FullScreenFeed from './pages/feed/FullScreenFeed';
import Cart from './pages/shop/Cart';
import Contact from './pages/info/Contact';
import Faq from './pages/info/Faq';
import Terms from './pages/info/Terms';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-dark-400">Loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const isCustomer = profile?.role === 'customer';

  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Layout fullBleed><FullScreenFeed variant="home" /></Layout>} />

      {/* Shop browsing (Phase 10) */}
      <Route path="/shop" element={<Layout><Shop /></Layout>} />
      <Route path="/product/:id" element={<Layout><ProductDetail /></Layout>} />
      <Route path="/reels" element={<Layout fullBleed><ReelsFeed /></Layout>} />

      {/* Phase 14 — full-screen TikTok-style feed (home = with header + bottom nav) */}
      <Route path="/feed-test" element={<FullScreenFeed />} />

      {/* Step 1 — creators: post a reel, public creator pages */}
      <Route path="/create" element={<Layout><Create /></Layout>} />
      <Route path="/u/:username" element={<Layout><CreatorProfile /></Layout>} />
      <Route path="/profile" element={<Layout><MyProfileRedirect /></Layout>} />

      {/* Info pages (Phase 15ছ) */}
      <Route path="/contact" element={<Layout><Contact /></Layout>} />
      <Route path="/faq" element={<Layout><Faq /></Layout>} />
      <Route path="/terms" element={<Layout><Terms /></Layout>} />

      {/* Cart (Phase 15ঘ — basic list; full editing in 15ঙ) */}
      <Route path="/cart" element={<Layout><Cart /></Layout>} />

      {/* Checkout & orders (Phase 11) — Buy Now buttons link here */}
      <Route path="/checkout" element={<Layout><Checkout /></Layout>} />
      <Route path="/checkout/:productId" element={<Layout><Checkout /></Layout>} />
      <Route path="/orders" element={user ? <Layout><MyOrders /></Layout> : <Navigate to="/" replace />} />
      <Route path="/orders/:id" element={user ? <Layout><OrderDetail /></Layout> : <Navigate to="/" replace />} />

      {/* Customer -> Seller registration */}
      <Route
        path="/become-seller"
        element={
          !user ? (
            <Navigate to="/" replace />
          ) : isCustomer ? (
            <Layout><BecomeSeller /></Layout>
          ) : (
            <Navigate to={isSeller || isAdmin ? '/seller' : '/'} replace />
          )
        }
      />

      {/* Admin only — sidebar layout with nested pages */}
      <Route
        path="/admin"
        element={
          isAdmin ? (
            <Layout>
              <AdminLayout />
            </Layout>
          ) : (
            <Navigate to="/" replace />
          )
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="sellers" element={<AdminSellers />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="approval" element={<ProductApproval />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="commission" element={<CommissionSettings />} />
        <Route path="delivery" element={<DeliveryZones />} />
        <Route path="payments" element={<PaymentSettings />} />
        <Route path="payouts" element={<AdminSellerPayouts />} />
        <Route path="reels" element={<ReelsReview />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>

      {/* Seller only */}
      <Route
        path="/seller"
        element={
          isSeller || isAdmin ? (
            <Layout>
              <SellerDashboard />
            </Layout>
          ) : user ? (
            <Navigate to="/become-seller" replace />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          <AppRoutes />
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
