import React, { useState, useEffect } from 'react'
import { analyticsAPI } from '../../api'
import { TrendingUp, ShoppingBag, DollarSign, BarChart3 } from 'lucide-react'
import '../Admin/AdminLayout.css'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    analyticsAPI.get('today')
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.error || 'Маълумот юкланмади'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="adm-loading">
      <div className="adm-spinner" />
      <span>Юкланмоқда...</span>
    </div>
  )

  if (error) return (
    <div className="adm-loading" style={{ flexDirection: 'column', color: '#EF4444' }}>
      <span style={{ fontSize: '36px' }}>⚠️</span>
      <span>{error}</span>
    </div>
  )

  const stats = [
    { icon: DollarSign, color: '#FF6B35', bg: '#FFF4EF', label: 'Бугунги тушум', value: `${(data?.today_revenue || 0).toLocaleString()} сум` },
    { icon: ShoppingBag, color: '#3B82F6', bg: '#DBEAFE', label: 'Бугунги буюртмалар', value: data?.today_orders ?? 0 },
    { icon: TrendingUp, color: '#10B981', bg: '#D1FAE5', label: '30 кунлик тушум', value: `${(data?.total_revenue || 0).toLocaleString()} сум` },
    { icon: BarChart3, color: '#8B5CF6', bg: '#EDE9FE', label: 'Соф фойда (30 кун)', value: `${(data?.net_profit || 0).toLocaleString()} сум` },
  ]

  return (
    <div>
      <div className="adm-page-header">
        <h1>🍽️ Бош панель</h1>
        <p>Бугунги кун кўрсаткичлари</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        {stats.map((s, i) => (
          <div key={i} className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ width: 50, height: 50, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={22} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 12, color: '#6B7280', fontWeight: 500, margin: '0 0 4px' }}>{s.label}</p>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: 0 }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Popular items */}
        <div className="adm-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 16 }}>🏆 Машҳур таомлар</h2>
          {data?.popular_items?.length > 0 ? (
            <table className="adm-table">
              <thead>
                <tr><th>Таом</th><th>Сотилди</th><th>Тушум</th></tr>
              </thead>
              <tbody>
                {data.popular_items.slice(0, 5).map((item, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{item.name}</td>
                    <td><span className="adm-badge adm-badge-orange">{item.total_sold} та</span></td>
                    <td style={{ fontWeight: 700 }}>{item.revenue?.toLocaleString()} сум</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="adm-empty">Маълумот йўқ</p>}
        </div>

        {/* Category bars */}
        <div className="adm-card">
          <h2 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 16 }}>📊 Категориялар бўйича</h2>
          {data?.category_sales?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {data.category_sales.map((cat, i) => {
                const max = Math.max(...data.category_sales.map(c => c.revenue))
                const pct = max > 0 ? (cat.revenue / max) * 100 : 0
                return (
                  <div key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
                      <span style={{ fontWeight: 500 }}>{cat.category}</span>
                      <span style={{ fontWeight: 700 }}>{cat.revenue?.toLocaleString()} сум</span>
                    </div>
                    <div style={{ height: 8, background: '#F3F4F6', borderRadius: 100, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #FF6B35, #E85A24)', borderRadius: 100, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : <p className="adm-empty">Маълумот йўқ</p>}
        </div>
      </div>
    </div>
  )
}
