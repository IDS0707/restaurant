import React, { useState, useEffect } from 'react'
import { analyticsAPI } from '../../api'
import toast from 'react-hot-toast'
import { Plus, X, Check, TrendingUp, DollarSign, ShoppingBag, Tag, RefreshCw, Calendar, ChevronDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell,
} from 'recharts'
import '../Admin/AdminLayout.css'

const PERIODS = [
  { val: 'today', label: 'Бугун' },
  { val: 'week',  label: 'Ҳафта' },
  { val: 'month', label: '30 кун' },
  { val: 'year',  label: 'Йил' },
]

const CHART_COLORS = ['#FF6B35', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899']

const fmt = (v) => v ? `${Number(v).toLocaleString()} сум` : '0 сум'
const fmtDate = (iso) => {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`
}

// Fill missing days in daily revenue array so the chart shows a continuous line
function fillDailyGaps(data, period) {
  if (!data || data.length === 0) return []
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365
  const map = {}
  data.forEach(d => { map[d.date] = d })

  const result = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push(map[key] || { date: key, revenue: 0, orders: 0 })
  }
  return result
}

// Fill all 24 hours for today/single-date view
function fillHourlyGaps(data) {
  const map = {}
  if (data) data.forEach(d => { map[d.hour] = d })
  const result = []
  for (let h = 0; h < 24; h++) {
    result.push(map[h] || { hour: h, revenue: 0, orders: 0 })
  }
  return result
}

const DailyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#FF6B35', margin: 0 }}>{Number(payload[0].value).toLocaleString()} сум</p>
      {payload[1] && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{payload[1].value} буюртма</p>}
    </div>
  )
}

const HourlyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const h = Number(label)
  return (
    <div style={{ background: 'white', border: '1px solid #E5E7EB', borderRadius: 8, padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 4px' }}>{String(h).padStart(2,'0')}:00 – {String(h+1).padStart(2,'0')}:00</p>
      <p style={{ fontSize: 14, fontWeight: 700, color: '#FF6B35', margin: 0 }}>{Number(payload[0].value).toLocaleString()} сум</p>
      {payload[1] && <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{payload[1].value} буюртма</p>}
    </div>
  )
}

export default function AdminAnalytics() {
  const [period, setPeriod] = useState('month')
  const [customDate, setCustomDate] = useState('')
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expenses, setExpenses] = useState([])
  const [modal, setModal] = useState(false)
  const [expForm, setExpForm] = useState({ description: '', amount: '', expense_type: 'one_time', is_recurring: false })

  useEffect(() => { loadAnalytics() }, [period, customDate])
  useEffect(() => { loadExpenses() }, [])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const r = await analyticsAPI.get(customDate ? undefined : period, customDate || undefined)
      setData(r.data)
    } catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const loadExpenses = async () => {
    try { const r = await analyticsAPI.getExpenses(); setExpenses(r.data) } catch {}
  }

  const addExpense = async (e) => {
    e.preventDefault()
    try {
      await analyticsAPI.createExpense({ ...expForm, amount: +expForm.amount, category: expForm.expense_type === 'monthly' ? 'Ойлик' : 'Бир марталик' })
      toast.success('Харажат қўшилди')
      setModal(false)
      setExpForm({ description: '', amount: '', expense_type: 'one_time', is_recurring: false })
      loadExpenses()
      loadAnalytics()
    } catch { toast.error('Хатолик') }
  }

  const setExpenseType = (type) => {
    setExpForm(p => ({ ...p, expense_type: type, is_recurring: type === 'monthly' }))
  }

  const selectPeriod = (val) => {
    setPeriod(val)
    setCustomDate('')
    setShowDatePicker(false)
  }

  const applyCustomDate = (date) => {
    setCustomDate(date)
    setShowDatePicker(false)
  }

  const isHourlyView = period === 'today' || !!customDate
  const chartData = isHourlyView
    ? fillHourlyGaps(data?.hourly_revenue)
    : fillDailyGaps(data?.daily_revenue, period)

  const monthlyExpenses = expenses.filter(e => e.is_recurring)
  const oneTimeExpenses = expenses.filter(e => !e.is_recurring)

  const stats = data ? [
    { icon: DollarSign, color: '#FF6B35', bg: '#FFF4EF', label: 'Тушум', value: fmt(data.total_revenue) },
    { icon: TrendingUp, color: '#EF4444', bg: '#FEE2E2', label: 'Харажатлар', value: fmt(data.total_expenses) },
    { icon: Tag, color: '#10B981', bg: '#D1FAE5', label: 'Соф фойда', value: fmt(data.net_profit), negative: data.net_profit < 0 },
    { icon: ShoppingBag, color: '#3B82F6', bg: '#DBEAFE', label: 'Буюртмалар', value: data.total_orders ?? 0 },
  ] : []

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1>📊 Аналитика</h1>
          <p>Даромад ва харажатлар</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Period buttons */}
          <div style={{ display: 'flex', gap: 4, background: '#F3F4F6', borderRadius: 10, padding: 4 }}>
            {PERIODS.map(p => (
              <button key={p.val} onClick={() => selectPeriod(p.val)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', transition: 'all 0.15s',
                background: period === p.val && !customDate ? '#FF6B35' : 'transparent',
                color: period === p.val && !customDate ? 'white' : '#6B7280',
              }}>{p.label}</button>
            ))}
          </div>

          {/* Custom date picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDatePicker(s => !s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                border: '1.5px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                background: customDate ? '#FF6B35' : 'white',
                color: customDate ? 'white' : '#374151',
                borderColor: customDate ? '#FF6B35' : '#E5E7EB',
              }}
            >
              <Calendar size={14} />
              {customDate ? customDate : 'Сана'}
              <ChevronDown size={12} />
            </button>
            {showDatePicker && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: 16, zIndex: 50, border: '1px solid #E5E7EB', minWidth: 220 }}>
                <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 10px', fontWeight: 600 }}>Кун танланг</p>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  defaultValue={customDate || new Date().toISOString().slice(0, 10)}
                  onChange={e => applyCustomDate(e.target.value)}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #E5E7EB', fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', boxSizing: 'border-box' }}
                />
                {customDate && (
                  <button onClick={() => { setCustomDate(''); setShowDatePicker(false) }}
                    style={{ marginTop: 8, width: '100%', padding: '7px', borderRadius: 8, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 12, color: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
                    Тозалаш
                  </button>
                )}
              </div>
            )}
          </div>

          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Харажат
          </button>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => { loadAnalytics(); loadExpenses() }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
      ) : data && (
        <>
          {/* Stats cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            {stats.map((s, i) => (
              <div key={i} className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={20} color={s.color} />
                </div>
                <div>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 3px', fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: 17, fontWeight: 800, margin: 0, color: s.negative ? '#EF4444' : '#111827' }}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue chart — hourly for today/single date, daily otherwise */}
          <div className="adm-card" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
              📈 {isHourlyView ? 'Соатлик тушум (24 соат)' : 'Кунлик тушум'}
            </h3>
            {isHourlyView && (
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 14px' }}>
                Har bir nuqta = 1 soatlik tushum va buyurtmalar soni
              </p>
            )}
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" vertical={false} />
                <XAxis
                  dataKey={isHourlyView ? 'hour' : 'date'}
                  tickFormatter={isHourlyView
                    ? h => `${String(h).padStart(2,'0')}:00`
                    : d => { if (!d) return ''; const p = d.split('-'); return `${p[2]}/${p[1]}` }
                  }
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  interval={isHourlyView ? 1 : (chartData.length > 14 ? Math.floor(chartData.length / 7) : 0)}
                />
                <YAxis
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}
                  tick={{ fontSize: 11, fill: '#9CA3AF' }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                />
                <Tooltip content={isHourlyView ? <HourlyTooltip /> : <DailyTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#FF6B35"
                  strokeWidth={2.5}
                  fill="url(#gradRevenue)"
                  dot={isHourlyView ? { r: 4, fill: '#FF6B35', strokeWidth: 0 } : (chartData.length <= 14 ? { r: 4, fill: '#FF6B35', strokeWidth: 0 } : false)}
                  activeDot={{ r: 6, fill: '#FF6B35', strokeWidth: 2, stroke: 'white' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Category + Popular items */}
          <div style={{ display: 'grid', gridTemplateColumns: data.category_sales?.length > 0 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
            {data.category_sales?.length > 0 && (
              <div className="adm-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 14 }}>🏷️ Категориялар</h3>
                <ResponsiveContainer width="100%" height={Math.max(data.category_sales.length * 44, 120)}>
                  <BarChart layout="vertical" data={data.category_sales} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                    <XAxis type="number" tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="category" tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip formatter={v => [`${Number(v).toLocaleString()} сум`, 'Тушум']} />
                    <Bar dataKey="revenue" radius={[0, 6, 6, 0]}>
                      {data.category_sales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Popular items — always shown */}
            <div className="adm-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 4 }}>🏆 Машҳур таомлар</h3>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 14px' }}>
                {customDate ? customDate : period === 'today' ? 'Бугун' : period === 'week' ? 'Ҳафта' : period === 'month' ? '30 кун' : 'Йил'} бўйича энг кўп сотилган
              </p>
              {!data.popular_items?.length ? (
                <div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '24px 0' }}>
                  Бу давр учун маълумот йўқ
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.popular_items.slice(0, 10).map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: i === 0 ? '#FEF3C7' : i === 1 ? '#F3F4F6' : i === 2 ? '#FEE2E2' : '#F9FAFB',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 800,
                        color: i === 0 ? '#92400E' : i === 1 ? '#374151' : i === 2 ? '#991B1B' : '#9CA3AF',
                        flexShrink: 0,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{item.total_sold} та сотилди</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35', flexShrink: 0 }}>{Number(item.revenue || 0).toLocaleString()} сум</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expenses section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Monthly expenses */}
            <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>🔄 Ойлик харажатлар</h3>
                {data.monthly_expenses > 0 && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#EF4444' }}>{data.monthly_expenses?.toLocaleString()} сум/ой</span>
                )}
              </div>
              {monthlyExpenses.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Ойлик харажат йўқ</div>
              ) : (
                <div style={{ padding: '8px 0' }}>
                  {monthlyExpenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #F9FAFB' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.description}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(e.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>{e.amount?.toLocaleString()} сум</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* One-time expenses */}
            <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#374151', margin: 0 }}>💳 Бир марталик харажатлар</h3>
                {oneTimeExpenses.length > 0 && (
                  <span style={{ fontSize: 12, color: '#6B7280', background: '#F3F4F6', borderRadius: 6, padding: '2px 8px' }}>{oneTimeExpenses.length} та</span>
                )}
              </div>
              {oneTimeExpenses.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Бир марталик харажат йўқ</div>
              ) : (
                <div style={{ padding: '8px 0', maxHeight: 400, overflowY: 'auto' }}>
                  {oneTimeExpenses.map(e => (
                    <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 20px', borderBottom: '1px solid #F9FAFB' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{e.description}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>{fmtDate(e.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#EF4444' }}>{e.amount?.toLocaleString()} сум</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add expense modal */}
      {modal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="adm-modal" style={{ maxWidth: 400 }}>
            <div className="adm-modal-header">
              <h2>Харажат қўшиш</h2>
              <button onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={addExpense}>
              {/* Type selector */}
              <div className="adm-field">
                <label className="adm-label">Харажат тури</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button type="button" onClick={() => setExpenseType('one_time')} style={{
                    padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: '2px solid', cursor: 'pointer', textAlign: 'center',
                    background: expForm.expense_type === 'one_time' ? '#FF6B35' : 'white',
                    color: expForm.expense_type === 'one_time' ? 'white' : '#374151',
                    borderColor: expForm.expense_type === 'one_time' ? '#FF6B35' : '#E5E7EB',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
                    Бир марталик
                  </button>
                  <button type="button" onClick={() => setExpenseType('monthly')} style={{
                    padding: '12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: '2px solid', cursor: 'pointer', textAlign: 'center',
                    background: expForm.expense_type === 'monthly' ? '#FF6B35' : 'white',
                    color: expForm.expense_type === 'monthly' ? 'white' : '#374151',
                    borderColor: expForm.expense_type === 'monthly' ? '#FF6B35' : '#E5E7EB',
                  }}>
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🔄</div>
                    Ойлик
                  </button>
                </div>
                <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0' }}>
                  {expForm.is_recurring
                    ? 'Ойлик харажат аналитикага ҳар ой автоматик қўшилади'
                    : 'Бир марталик харажат бугун аналитикага қўшилади'}
                </p>
              </div>
              <div className="adm-field">
                <label className="adm-label">Нима учун? *</label>
                <input className="adm-input" value={expForm.description} onChange={e => setExpForm(p=>({...p,description:e.target.value}))} required placeholder="Масалан: Ижара, Гўшт харид, Электр..." />
              </div>
              <div className="adm-field">
                <label className="adm-label">Миқдор (сум) *</label>
                <input className="adm-input" type="number" value={expForm.amount} onChange={e => setExpForm(p=>({...p,amount:e.target.value}))} required min="0" placeholder="100 000" />
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setModal(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary"><Check size={16} /> Сақлаш</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
