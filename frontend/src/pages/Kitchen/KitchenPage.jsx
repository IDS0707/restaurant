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
  const reconnectRef = useRef(null)
  const pollRef = useRef(null)
  const tickRef = useRef(null)
  const seenIdsRef = useRef(new Set())
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    initialLoad()
    connectWS()
    // Fast polling fallback — runs every 500 ms (real-time feel).
    // If WS already delivered the order, the de-dupe by ID prevents double sound/toast.
    pollRef.current = setInterval(() => pollOrders(), 500)
    // Refresh the elapsed-time labels every 30s
    tickRef.current = setInterval(() => forceUpdate(n => n + 1), 30000)
    return () => {
      wsRef.current?.close()
      clearInterval(pollRef.current)
      clearInterval(tickRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
    }
  }, [])

  const handleNewOrder = (order) => {
    if (!order || !order.id) return
    if (seenIdsRef.current.has(order.id)) return
    seenIdsRef.current.add(order.id)
    setOrders(prev => {
      if (prev.some(o => o.id === order.id)) return prev
      return [order, ...prev]
    })
    playSound()
    toast(`Yangi buyurtma! #${order.order_code}`, { icon: '🔔', duration: 6000 })
  }

  const connectWS = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      ws.onmessage = (e) => {
        let msg
        try { msg = JSON.parse(e.data) } catch { return }
        if (msg.type === 'new_order') {
          handleNewOrder(msg.payload)
        }
        if (msg.type === 'order_status_changed') {
          setOrders(prev => prev.filter(o => o.id !== msg.payload.id))
        }
      }
      ws.onclose = () => {
        // Auto-reconnect in 2s — tunnel/Cloudflare may drop idle sockets
        if (reconnectRef.current) clearTimeout(reconnectRef.current)
        reconnectRef.current = setTimeout(connectWS, 2000)
      }
      ws.onerror = () => {
        try { ws.close() } catch {}
      }
      wsRef.current = ws
    } catch {
      // If WS construction failed, retry shortly
      reconnectRef.current = setTimeout(connectWS, 2000)
    }
  }

  // Polling fallback — catches orders even if WS is broken
  const pollOrders = async () => {
    try {
      const res = await ordersAPI.getAll()
      const pending = (res.data || []).filter(o => o.status === 'pending')
      // Seed seenIds with the current order set so we don't beep for everything on first run
      if (seenIdsRef.current.size === 0) {
        pending.forEach(o => seenIdsRef.current.add(o.id))
        setOrders(pending)
        return
      }
      // Detect orders we haven't seen yet
      const fresh = pending.filter(o => !seenIdsRef.current.has(o.id))
      fresh.forEach(o => handleNewOrder(o))
      // Drop orders that are no longer pending (e.g. served by another client)
      setOrders(prev => prev.filter(o => pending.some(p => p.id === o.id)))
    } catch {}
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

  const initialLoad = async () => {
    setLoading(true)
    try {
      const res = await ordersAPI.getAll()
      const pending = (res.data || []).filter(o => o.status === 'pending')
      // Mark all existing orders as 'seen' so we don't ring bell for them
      pending.forEach(o => seenIdsRef.current.add(o.id))
      setOrders(pending)
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
      <div className="background-container">
        <img className="moon" src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/moon2.png" alt="" />
        <div className="stars" />
        <div className="twinkling" />
        <div className="clouds" />
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
        <button className="kh-refresh" onClick={() => pollOrders()}>
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
