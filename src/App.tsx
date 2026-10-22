import React from 'react';
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
import AdminSellerPayouts from './pages/admin/AdminSellerPayouts';
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
import ProfileGuard from './components/ProfileGuard'; // নতুন প্রোফাইল গার্ড ইম্পোর্ট করা হলো

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-dark-400">loading...</p>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const isSeller = profile?.role === 'seller';
  const isCustomer = profile?.role === 'customer';

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<ReelsFeed />} />
        <Route path="shop" element={<Shop />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="orders" element={<MyOrders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="feed" element={<FullScreenFeed />} />
        <Route path="become-seller" element={<BecomeSeller />} />
        <Route path="contact" element={<Contact />} />
        <Route path="faq" element={<Faq />} />
        <Route path="terms" element={<Terms />} />
        <Route path="creator/:username" element={<CreatorProfile />} />
        
        {/* প্রোফাইল গার্ড যুক্ত ক্রিয়েটর বা পেজ */}
        <Route path="create" element={<Create />} />
        <Route path="my-profile" element={<MyProfileRedirect />} />
      </Route>

      {/* অ্যাডমিন প্যানেল */}
      {isAdmin && (
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminHome />} />
          <Route path="sellers" element={<AdminSellers />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="approvals" element={<ProductApproval />} />
          <Route path="commissions" element={<CommissionSettings />} />
          <Route path="delivery" element={<DeliveryZones />} />
          <Route path="payments" element={<PaymentSettings />} />
          <Route path="payouts" element={<AdminSellerPayouts />} />
          <Route path="reels" element={<ReelsReview />} />
        </Route>
      )}

      {/* সেলার ড্যাশবোর্ড */}
      {isSeller && (
        <Route path="/seller/dashboard" element={<SellerDashboard />} />
      )}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <CartProvider>
          {/* এখানে পুরো অ্যাপটিকে ProfileGuard দিয়ে ঘিরে দেওয়া হলো যাতে ফোন ও অ্যাভাটার বাধ্যতামূলক হয় */}
          <ProfileGuard>
            <AppRoutes />
          </ProfileGuard>
        </CartProvider>
      </AuthProvider>
    </Router>
  );
}
