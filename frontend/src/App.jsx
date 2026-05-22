import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import HomePage from './pages/Home/HomePage'
import CashierPage from './pages/Cashier/CashierPage'
import KitchenPage from './pages/Kitchen/KitchenPage'
import ShopPage from './pages/Shop/ShopPage'
import AdminLogin from './pages/Admin/AdminLogin'
import AdminLayout from './pages/Admin/AdminLayout'
import AdminDashboard from './pages/Admin/AdminDashboard'
import AdminOrders from './pages/Admin/AdminOrders'
import AdminMenu from './pages/Admin/AdminMenu'
import AdminMenuDetail from './pages/Admin/AdminMenuDetail'
import AdminInventory from './pages/Admin/AdminInventory'
import AdminAgents from './pages/Admin/AdminAgents'
import AdminPromo from './pages/Admin/AdminPromo'
import AdminVip from './pages/Admin/AdminVip'
import AdminAnalytics from './pages/Admin/AdminAnalytics'
import AdminCouriers from './pages/Admin/AdminCouriers'
import CourierPage from './pages/Courier/CourierPage'

export default function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { fontFamily: 'Inter, sans-serif', fontSize: '14px', borderRadius: '10px' },
          success: { iconTheme: { primary: '#FF6B35', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/courier" element={<CourierPage />} />
        <Route path="/cashier" element={<CashierPage />} />
        <Route path="/kitchen" element={<KitchenPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/*" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="menu" element={<AdminMenu />} />
          <Route path="menu/:id" element={<AdminMenuDetail />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="agents" element={<AdminAgents />} />
          <Route path="promo" element={<AdminPromo />} />
          <Route path="vip" element={<AdminVip />} />
          <Route path="couriers" element={<AdminCouriers />} />
          <Route path="analytics" element={<AdminAnalytics />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
