import React, { useState, useEffect } from 'react'
import { ordersAPI } from '../../api'
import toast from 'react-hot-toast'
import { RefreshCw, Calendar, X } from 'lucide-react'
import '../Admin/AdminLayout.css'

const STATUS = {
  pending:  { label: 'Кутилмоқда',    cls: 'adm-badge-yellow' },
  cooking:  { label: 'Тайёрланмоқда', cls: 'adm-badge-orange' },
  ready:    { label: 'Тайёр',          cls: 'adm-badge-green'  },
  served:   { label: 'Берилди',        cls: 'adm-badge-gray'   },
}

const DATE_FILTERS = [
  { val: 'all',   label: 'Барчаси' },
  { val: 'today', label: 'Бугун' },
  { val: 'week',  label: 'Ҳафта' },
  { val: 'month', label: '30 кун' },
  { val: 'year',  label: 'Йил' },
]

const fmtDate = (iso) => {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function inDateRange(isoStr, dateFilter, customDate) {
  if (customDate) {
    return isoStr.slice(0, 10) === customDate
  }
  if (dateFilter === 'all') return true
  const d = new Date(isoStr)
  const now = new Date()
  if (dateFilter === 'today') {
    return d.toDateString() === now.toDateString()
  }
  const days = dateFilter === 'week' ? 7 : dateFilter === 'month' ? 30 : 365
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return d >= cutoff
}

export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('all')
  const [customDate, setCustomDate] = useState('')
  const [showCal, setShowCal] = useState(false)

  useEffect(() => { load() }, [statusFilter])

  const load = async () => {
    setLoading(true)
    try {
      const res = await ordersAPI.getAll(statusFilter || undefined)
      setOrders(res.data)
    } catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const statusFilters = [
    { val: '', label: 'Барча ҳолат' },
    { val: 'pending', label: 'Кутилмоқда' },
    { val: 'cooking', label: 'Тайёрланмоқда' },
    { val: 'ready', label: 'Тайёр' },
    { val: 'served', label: 'Берилди' },
  ]

  const visibleOrders = orders.filter(o => inDateRange(o.created_at, dateFilter, customDate))

  const selectDateFilter = (val) => {
    setDateFilter(val)
    setCustomDate('')
    setShowCal(false)
  }

  const applyCustomDate = (date) => {
    setCustomDate(date)
    setDateFilter('custom')
    setShowCal(false)
  }

  return (
    <div>
      <div className="adm-page-header">
        <h1>📋 Буюртмалар тарихи</h1>
        <p>Барча буюртмалар рўйхати — {visibleOrders.length} та</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Date filter */}
        <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
          {DATE_FILTERS.map(f => (
            <button key={f.val} onClick={() => selectDateFilter(f.val)} style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
              background: dateFilter === f.val && !customDate ? '#FF6B35' : 'transparent',
              color: dateFilter === f.val && !customDate ? 'white' : '#6B7280',
            }}>{f.label}</button>
          ))}
        </div>

        {/* Calendar picker */}
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowCal(s => !s)} style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1.5px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            background: customDate ? '#FF6B35' : 'white',
            color: customDate ? 'white' : '#374151',
            borderColor: customDate ? '#FF6B35' : '#E5E7EB',
          }}>
            <Calendar size={13} />
            {customDate || 'Сана'}
          </button>
          {showCal && (
            <div style={{ position: 'absolute', left: 0, top: '110%', background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 14, zIndex: 50, border: '1px solid #E5E7EB' }}>
              <input type="date" max={new Date().toISOString().slice(0,10)}
                defaultValue={customDate || new Date().toISOString().slice(0,10)}
                onChange={e => applyCustomDate(e.target.value)}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none' }}
              />
            </div>
          )}
        </div>

        {customDate && (
          <button onClick={() => { setCustomDate(''); setDateFilter('all') }} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '7px 10px', borderRadius: 8,
            border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif',
          }}><X size={12} /> Тозалаш</button>
        )}

        <div style={{ width: 1, height: 24, background: '#E5E7EB' }} />

        {/* Status filter */}
        {statusFilters.map(f => (
          <button key={f.val} onClick={() => setStatusFilter(f.val)} style={{
            padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1.5px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            background: statusFilter === f.val ? '#FF6B35' : 'white',
            color: statusFilter === f.val ? 'white' : '#374151',
            borderColor: statusFilter === f.val ? '#FF6B35' : '#E5E7EB',
            transition: 'all 0.15s',
          }}>{f.label}</button>
        ))}

        <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 12px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
          <RefreshCw size={13} /> Янгилаш
        </button>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Рақам</th>
                <th>Таомлар</th>
                <th>Жами</th>
                <th>Чегирма</th>
                <th>Тўлов</th>
                <th>Карта</th>
                <th>Ҳолат</th>
                <th>Вақт</th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#9CA3AF', padding: '40px' }}>Буюртма топилмади</td></tr>
              ) : visibleOrders.map(o => (
                <tr key={o.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: '#FF6B35', fontSize: 15 }}>#{o.order_code}</span>
                  </td>
                  <td>
                    {o.items?.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {o.items.map((item, i) => (
                          <div key={i} style={{ fontSize: 12, color: '#374151' }}>
                            <span style={{ fontWeight: 600 }}>×{item.quantity}</span>{' '}{item.item_name}
                          </div>
                        ))}
                      </div>
                    ) : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>}
                  </td>
                  <td>{o.total_price?.toLocaleString()} сум</td>
                  <td style={{ color: o.discount_amount > 0 ? '#10B981' : '#9CA3AF' }}>
                    {o.discount_amount > 0 ? `-${o.discount_amount?.toLocaleString()} сум` : '—'}
                  </td>
                  <td style={{ fontWeight: 700 }}>{o.final_price?.toLocaleString()} сум</td>
                  <td style={{ color: '#6B7280', fontSize: 13 }}>{o.card_code || '—'}</td>
                  <td>
                    <span className={`adm-badge ${STATUS[o.status]?.cls || 'adm-badge-gray'}`}>
                      {STATUS[o.status]?.label || o.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap' }}>{fmtDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
