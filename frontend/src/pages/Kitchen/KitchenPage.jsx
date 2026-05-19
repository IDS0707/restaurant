import React, { useState, useEffect, useRef } from 'react'
import { ordersAPI } from '../../api'
import toast from 'react-hot-toast'
import { ChefHat, Bell, Home, RefreshCw, CheckCircle, Clock } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import './KitchenPage.css'

const fmtTime = (iso) => {
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fmtElapsed = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1) return 'Hozir'
  if (diff === 1) return '1 daqiqa'
  return `${diff} daqiqa`
}

export default function KitchenPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const wsRef = useRef(null)
  const timerRef = useRef(null)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    load()
    connectWS()
    timerRef.current = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => {
      wsRef.current?.close()
      clearInterval(timerRef.current)
    }
  }, [])

  const connectWS = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'new_order') {
        setOrders(prev => [msg.payload, ...prev])
        playSound()
        toast(`Yangi buyurtma! #${msg.payload.order_code}`, { icon: '🔔', duration: 6000 })
      }
      if (msg.type === 'order_status_changed') {
        setOrders(prev => prev.filter(o => o.id !== msg.payload.id))
      }
    }
    wsRef.current = ws
  }

  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await ordersAPI.getAll()
      setOrders(res.data.filter(o => o.status === 'pending'))
    } catch { toast.error('Yuklanmadi') }
    finally { setLoading(false) }
  }

  const markDone = async (order) => {
    setCompleting(order.id)
    try {
      await ordersAPI.updateStatus(order.id, 'served')
      setOrders(prev => prev.filter(o => o.id !== order.id))
      toast.success(`Buyurtma #${order.order_code} tayyor!`, { icon: '✅', duration: 4000 })
    } catch { toast.error('Xatolik yuz berdi') }
    finally { setCompleting(null) }
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#1a1a2e' }}>
      <ChefHat size={48} color="#FF6B35" className="animate-spin" />
    </div>
  )

  return (
    <div className="kitchen-page">
      <div className="kitchen-bg">
        <div className="k-blob k-blob-1" />
        <div className="k-blob k-blob-2" />
        <div className="k-blob k-blob-3" />
      </div>
      <header className="kitchen-header">
        <div className="kh-left">
          <button className="kh-icon-btn" onClick={() => navigate('/')}><Home size={20} /></button>
          <ChefHat size={24} color="white" />
          <h1 className="kh-title">Oshpazxona paneli</h1>
        </div>
        <div className="kh-center">
          {orders.length > 0 ? (
            <span className="kh-badge-new">
              <Bell size={15} />
              {orders.length} ta yangi buyurtma
            </span>
          ) : (
            <span className="kh-badge-empty">Buyurtma yo'q</span>
          )}
        </div>
        <button className="kh-refresh" onClick={load}>
          <RefreshCw size={16} /> Yangilash
        </button>
      </header>

      <div className="kitchen-main">
        {orders.length === 0 ? (
          <div className="kitchen-empty">
            <ChefHat size={72} color="rgba(255,107,53,0.25)" />
            <h2>Yangi buyurtmalar yo'q</h2>
            <p>Buyurtmalar kelganda bu yerda ko'rinadi</p>
          </div>
        ) : (
          <div className="korders-grid">
            {orders.map(order => (
              <div key={order.id} className="korder-card">
                <div className="korder-header">
                  <span className="korder-code">#{order.order_code}</span>
                  <span className="korder-time">
                    <Clock size={13} />
                    {fmtTime(order.created_at)} · {fmtElapsed(order.created_at)}
                  </span>
                </div>

                {order.items?.length > 0 && (
                  <ul className="korder-items">
                    {order.items.map((item, i) => (
                      <li key={i} className="korder-item">
                        <span className="korder-qty">×{item.quantity}</span>
                        <span className="korder-name">{item.item_name}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {order.note && (
                  <p className="korder-note">💬 {order.note}</p>
                )}

                <div className="korder-footer">
                  <span className="korder-total">{order.final_price?.toLocaleString()} so'm</span>
                  <button
                    className={`korder-done-btn ${completing === order.id ? 'loading' : ''}`}
                    onClick={() => markDone(order)}
                    disabled={completing === order.id}
                  >
                    <CheckCircle size={18} />
                    {completing === order.id ? 'Saqlanmoqda...' : 'Tayyor!'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
