import React from 'react'
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom'
import { LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, BarChart3, LogOut, Home, Package } from 'lucide-react'
import './AdminLayout.css'

const NAV = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Бош панель', end: true },
  { to: '/admin/orders', icon: ShoppingBag, label: 'Буюртмалар' },
  { to: '/admin/menu', icon: UtensilsCrossed, label: 'Меню' },
  { to: '/admin/inventory', icon: Package, label: 'Омбор' },
  { to: '/admin/agents', icon: Users, label: 'Агентлар' },
  { to: '/admin/analytics', icon: BarChart3, label: 'Аналитика' },
]

export default function AdminLayout() {
  const navigate = useNavigate()
  const token = localStorage.getItem('eco_taomlar_token')

  if (!token) {
    return <Navigate to="/admin" replace />
  }

  const logout = () => {
    localStorage.removeItem('eco_taomlar_token')
    navigate('/admin', { replace: true })
  }

  return (
    <div className="al-root">
      <aside className="al-sidebar">
        <div className="al-logo">
          <span className="al-logo-icon">🍽️</span>
          <div>
            <div className="al-logo-name">ECO taomlar</div>
            <div className="al-logo-sub">Бошқарув панели</div>
          </div>
        </div>

        <nav className="al-nav">
          {NAV.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `al-nav-item${isActive ? ' active' : ''}`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="al-bottom">
          <button className="al-nav-item al-logout" onClick={() => navigate('/')}>
            <Home size={18} />
            <span>Бош саҳифа</span>
          </button>
          <button className="al-nav-item al-logout" onClick={logout}>
            <LogOut size={18} />
            <span>Чиқиш</span>
          </button>
        </div>
      </aside>

      <main className="al-main">
        <Outlet />
      </main>
    </div>
  )
}
