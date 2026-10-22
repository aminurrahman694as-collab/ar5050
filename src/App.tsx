import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { CartProvider } from './hooks/useCart';
import Layout from './components/Layout';
import BecomeSeller from './pages/becomeSeller';
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
import ProfileGuard from './components/ProfileGuard';

// আমাদের নতুন কম্পোনেন্ট দুটি ইম্পোর্ট করা হলো
import { ReelUploader } from './components/ReelUploader';
import { ReelFeed } from './components/ReelFeed';

function AppRoutes() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin e-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
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
      <Route path="/" element={<Layout />}>
        <Route index element={<ReelsFeed />} />
        
        {/* নতুন ভিডিও কমার্স ও আপলোড রাউট */}
        <Route path="reels" element={<ReelFeed />} />
        <Route path="upload-reel" element={<ReelUploader />} />

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

        <Route path="create" element={<Create />} />
        <Route path="my-profile" element={<MyProfileRedirect />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <Router>
          <AppRoutes />
        </Router>
      </CartProvider>
    </AuthProvider>
  );
}

export default App;
