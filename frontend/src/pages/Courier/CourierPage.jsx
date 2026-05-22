import React, { useState, useEffect, useRef, useCallback } from 'react'
import { courierAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  Bike, Package, CheckCircle2, Phone, MapPin, Clock, LogOut,
  Bell, Loader, ChevronRight, AlertCircle, Navigation, User, Power,
} from 'lucide-react'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'
import './CourierPage.css'

const fmt = v => Number(v || 0).toLocaleString()
const fmtTime = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtElapsed = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso)) / 60000)
  if (diff < 1) return 'hozir'
  if (diff < 60) return `${diff} daq.`
  return `${Math.floor(diff / 60)} soat`
}

const yandexMapLink = (lat, lng) =>
  `https://yandex.uz/maps/?ll=${lng},${lat}&z=17&pt=${lng},${lat}`

export default function CourierPage() {
  const [courier, setCourier] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // login form
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('')
  const [logging, setLogging] = useState(false)

  // app state
  const [tab, setTab] = useState('available') // 'available' | 'mine' | 'profile'
  const [available, setAvailable] = useState([])
  const [mine, setMine] = useState([])
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(null)
  const [completing, setCompleting] = useState(null)
  const [online, setOnline] = useState(true) // duty toggle for location sharing

  const wsRef = useRef(null)
  const reconnectRef = useRef(null)
  const pollRef = useRef(null)
  const locTimerRef = useRef(null)
  const seenIdsRef = useRef(new Set())

  // Auth check on mount
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('eco_courier_token')
      if (token) {
        try {
          const r = await courierAPI.me()
          setCourier(r.data)
        } catch {
          localStorage.removeItem('eco_courier_token')
        }
      }
      setCheckingAuth(false)
    })()
  }, [])

  // After login: load lists + start polling + WS + location updates
  useEffect(() => {
    if (!courier) return
    refreshAll()
    connectWS()
    pollRef.current = setInterval(refreshAll, 5000)
    if (online) startLocationUpdates()
    return () => {
      clearInterval(pollRef.current)
      if (locTimerRef.current) clearInterval(locTimerRef.current)
      if (reconnectRef.current) clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courier])

  // Toggle online status — start/stop location pushing
  useEffect(() => {
    if (!courier) return
    if (online) startLocationUpdates()
    else stopLocationUpdates()
    return () => stopLocationUpdates()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  const refreshAll = async () => {
    try {
      const [av, my] = await Promise.all([
        courierAPI.available(),
        courierAPI.mine(),
      ])
      const newAvailable = av.data || []
      // detect new orders for notification
      const newIds = newAvailable.filter(o => !seenIdsRef.current.has(o.id))
      if (seenIdsRef.current.size > 0 && newIds.length > 0) {
        newIds.forEach(o => seenIdsRef.current.add(o.id))
        playSound()
        toast(`Yangi buyurtma! #${newIds[0].order_code}`, { icon: '🔔', duration: 6000 })
      } else if (seenIdsRef.current.size === 0) {
        newAvailable.forEach(o => seenIdsRef.current.add(o.id))
      }
      setAvailable(newAvailable)
      setMine(my.data || [])
    } catch {} finally { setLoading(false) }
  }

  const connectWS = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
      ws.onmessage = (e) => {
        let msg
        try { msg = JSON.parse(e.data) } catch { return }
        if (msg.type === 'new_ready_order') {
          // refresh to fetch full details + dedupe via seenIds
          refreshAll()
        }
        if (msg.type === 'order_status_changed') {
          refreshAll()
        }
      }
      ws.onclose = () => {
        if (reconnectRef.current) clearTimeout(reconnectRef.current)
        reconnectRef.current = setTimeout(connectWS, 2000)
      }
      ws.onerror = () => { try { ws.close() } catch {} }
      wsRef.current = ws
    } catch {
      reconnectRef.current = setTimeout(connectWS, 2000)
    }
  }

  const playSound = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.12)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.5)
    } catch {}
  }

  // ─── Location sharing ───
  const isNative = Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()

  const pushLocationOnce = useCallback(async () => {
    try {
      if (isNative) {
        const status = await Geolocation.checkPermissions()
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
          const r = await Geolocation.requestPermissions({ permissions: ['location'] })
          if (r.location !== 'granted' && r.coarseLocation !== 'granted') return
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
        await courierAPI.updateLocation(pos.coords.latitude, pos.coords.longitude)
      } else if (navigator.geolocation) {
        await new Promise((resolve) => {
          navigator.geolocation.getCurrentPosition(
            async (pos) => {
              try { await courierAPI.updateLocation(pos.coords.latitude, pos.coords.longitude) } catch {}
              resolve()
            },
            () => resolve(),
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
          )
        })
      }
    } catch {}
  }, [isNative])

  const startLocationUpdates = useCallback(() => {
    if (locTimerRef.current) clearInterval(locTimerRef.current)
    pushLocationOnce()
    locTimerRef.current = setInterval(pushLocationOnce, 20000)
  }, [pushLocationOnce])

  const stopLocationUpdates = () => {
    if (locTimerRef.current) { clearInterval(locTimerRef.current); locTimerRef.current = null }
  }

  // ─── Login ───
  const doLogin = async () => {
    if (!phone.trim() || !pin.trim()) {
      toast.error('Telefon va PIN kerak')
      return
    }
    setLogging(true)
    try {
      const r = await courierAPI.login({ phone: phone.trim(), pin: pin.trim() })
      localStorage.setItem('eco_courier_token', r.data.token)
      setCourier(r.data.courier)
      toast.success(`Xush kelibsiz, ${r.data.courier.first_name}!`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xato')
    } finally { setLogging(false) }
  }

  const logout = () => {
    if (!window.confirm('Hisobdan chiqasizmi?')) return
    stopLocationUpdates()
    localStorage.removeItem('eco_courier_token')
    setCourier(null)
    setAvailable([]); setMine([])
    setTab('available')
  }

  // ─── Order actions ───
  const acceptOrder = async (order) => {
    setAccepting(order.id)
    try {
      await courierAPI.accept(order.id)
      toast.success(`#${order.order_code} olindi`, { icon: '🛵' })
      setTab('mine')
      refreshAll()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xato')
    } finally { setAccepting(null) }
  }

  const completeOrder = async (order) => {
    if (!window.confirm(`#${order.order_code} yetkazildi deb belgilash?`)) return
    setCompleting(order.id)
    try {
      await courierAPI.complete(order.id)
      toast.success('Yetkazildi ✓', { icon: '✅' })
      refreshAll()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xato')
    } finally { setCompleting(null) }
  }

  // ─── Render ───
  if (checkingAuth) {
    return (
      <div className="cr-splash">
        <Bike size={56} className="cr-splash-icon" />
      </div>
    )
  }

  if (!courier) {
    return (
      <div className="cr-login">
        <div className="cr-login-bg" />
        <div className="cr-login-card">
          <div className="cr-login-logo">🛵</div>
          <h1 className="cr-login-title">ECO Kuryer</h1>
          <p className="cr-login-sub">Kuryerlar uchun ilova</p>

          <div className="cr-input-group">
            <Phone size={16} className="cr-input-icon" />
            <input
              className="cr-input"
              type="tel"
              placeholder="+998 XX XXX XX XX"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>
          <div className="cr-input-group">
            <span className="cr-input-icon" style={{ fontSize: 14 }}>🔒</span>
            <input
              className="cr-input"
              type="password"
              inputMode="numeric"
              placeholder="PIN-kod"
              maxLength={10}
              value={pin}
              onChange={e => setPin(e.target.value)}
            />
          </div>
          <button className="cr-btn-primary" onClick={doLogin} disabled={logging}>
            {logging ? <Loader size={18} className="spin" /> : <>Kirish <ChevronRight size={18} /></>}
          </button>
          <p className="cr-fine">PIN kodingiz adminstratordan oling</p>
        </div>
      </div>
    )
  }

  return (
    <div className="cr-app">
      {/* HEADER */}
      <header className="cr-header">
        <div className="cr-header-top">
          <div className="cr-header-avatar">{(courier.first_name?.[0] || 'K').toUpperCase()}</div>
          <div className="cr-header-info">
            <div className="cr-header-name">{courier.first_name} {courier.last_name}</div>
            <div className={`cr-online-pill ${online ? 'on' : 'off'}`}
                 onClick={() => setOnline(!online)}>
              <span className="cr-online-dot" />
              {online ? "Faol — buyurtmalarni qabul qilmoqda" : "Offline (joylashuv ulashilmaydi)"}
            </div>
          </div>
          <button className="cr-power-btn" onClick={() => setOnline(!online)}
                  title={online ? 'Offline ga o\'tish' : 'Online ga o\'tish'}>
            <Power size={20} />
          </button>
        </div>

        <div className="cr-stats">
          <div className="cr-stat">
            <div className="cr-stat-val">{available.length}</div>
            <div className="cr-stat-lbl">Mavjud</div>
          </div>
          <div className="cr-stat">
            <div className="cr-stat-val">{mine.filter(o => o.status === 'on_way').length}</div>
            <div className="cr-stat-lbl">Yo'lda</div>
          </div>
          <div className="cr-stat">
            <div className="cr-stat-val">{mine.filter(o => o.status === 'served').length}</div>
            <div className="cr-stat-lbl">Yetkazildi</div>
          </div>
        </div>
      </header>

      {/* TABS */}
      <div className="cr-tabs">
        <button className={`cr-tab ${tab === 'available' ? 'active' : ''}`} onClick={() => setTab('available')}>
          <Bell size={16} />
          <span>Mavjud</span>
          {available.length > 0 && <span className="cr-tab-badge">{available.length}</span>}
        </button>
        <button className={`cr-tab ${tab === 'mine' ? 'active' : ''}`} onClick={() => setTab('mine')}>
          <Package size={16} />
          <span>Mening</span>
          {mine.filter(o => o.status === 'on_way').length > 0 &&
            <span className="cr-tab-badge orange">{mine.filter(o => o.status === 'on_way').length}</span>}
        </button>
        <button className={`cr-tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <User size={16} />
          <span>Profil</span>
        </button>
      </div>

      {/* CONTENT */}
      <main className="cr-main">
        {tab === 'available' && (
          <>
            {loading && available.length === 0 ? (
              <div className="cr-loading"><Loader size={28} className="spin" /></div>
            ) : available.length === 0 ? (
              <div className="cr-empty">
                <Bike size={48} />
                <h2>Yangi buyurtmalar yo'q</h2>
                <p>Buyurtma kelganda ovoz va xabar bilan bildiriladi</p>
              </div>
            ) : (
              <div className="cr-orders">
                {available.map(o => (
                  <OrderCard key={o.id} order={o}
                    onAccept={() => acceptOrder(o)}
                    accepting={accepting === o.id}
                    mode="available" />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'mine' && (
          <>
            {loading && mine.length === 0 ? (
              <div className="cr-loading"><Loader size={28} className="spin" /></div>
            ) : mine.length === 0 ? (
              <div className="cr-empty">
                <Package size={48} />
                <h2>Hozircha buyurtma yo'q</h2>
                <p>"Mavjud" bo'limidan buyurtma oling</p>
              </div>
            ) : (
              <div className="cr-orders">
                {mine.map(o => (
                  <OrderCard key={o.id} order={o}
                    onComplete={() => completeOrder(o)}
                    completing={completing === o.id}
                    mode="mine" />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'profile' && (
          <div className="cr-profile">
            <div className="cr-card">
              <div className="cr-profile-row">
                <div className="cr-profile-avatar">{(courier.first_name?.[0] || 'K').toUpperCase()}</div>
                <div>
                  <div className="cr-profile-name">{courier.first_name} {courier.last_name}</div>
                  <div className="cr-profile-phone"><Phone size={12} /> {courier.phone}</div>
                </div>
              </div>
            </div>

            <div className="cr-card">
              <div className="cr-row" onClick={() => setOnline(!online)}>
                <div className="cr-row-icon" style={{ background: online ? '#DCFCE7' : '#FEE2E2', color: online ? '#15803D' : '#B91C1C' }}>
                  <Power size={16} />
                </div>
                <div className="cr-row-text">
                  <div className="cr-row-title">Holat</div>
                  <div className="cr-row-sub">{online ? 'Faol (online)' : 'Offline'}</div>
                </div>
                <div className={`cr-switch ${online ? 'on' : ''}`}>
                  <div className="cr-switch-knob" />
                </div>
              </div>
              <div className="cr-row" onClick={pushLocationOnce}>
                <div className="cr-row-icon" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                  <Navigation size={16} />
                </div>
                <div className="cr-row-text">
                  <div className="cr-row-title">Joylashuvni yangilash</div>
                  <div className="cr-row-sub">Hoziroq jo'natish</div>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </div>
            </div>

            <button className="cr-logout" onClick={logout}>
              <LogOut size={16} /> Hisobdan chiqish
            </button>
          </div>
        )}
      </main>
    </div>
  )
}

// ─── Card ───
function OrderCard({ order, onAccept, onComplete, accepting, completing, mode }) {
  const hasGeo = order.delivery_lat && order.delivery_lng
  return (
    <div className={`cr-order ${mode === 'mine' && order.status === 'on_way' ? 'active' : ''}`}>
      <div className="cr-order-head">
        <div className="cr-order-code">#{order.order_code}</div>
        <div className="cr-order-time">
          <Clock size={12} />
          {fmtTime(order.created_at)} · {fmtElapsed(order.created_at)}
        </div>
      </div>

      <div className="cr-order-customer">
        <div className="cr-order-customer-row">
          <User size={13} />
          <span>{order.customer_first_name || '—'} {order.customer_last_name || ''}</span>
        </div>
        {order.customer_phone && (
          <a className="cr-order-phone-link" href={`tel:${order.customer_phone}`}>
            <Phone size={13} /> {order.customer_phone}
          </a>
        )}
      </div>

      {order.delivery_address && (
        <div className="cr-order-addr">
          <MapPin size={14} />
          <div>
            <div className="cr-order-addr-text">{order.delivery_address}</div>
            {hasGeo && (
              <a href={yandexMapLink(order.delivery_lat, order.delivery_lng)}
                 target="_blank" rel="noreferrer" className="cr-order-map">
                <Navigation size={11} /> Xaritada
              </a>
            )}
          </div>
        </div>
      )}

      {order.items && order.items.length > 0 && (
        <details className="cr-order-items">
          <summary>{order.items.length} ta taom</summary>
          <ul>
            {order.items.map((it, i) => (
              <li key={i}><span>×{it.quantity}</span> {it.item_name}</li>
            ))}
          </ul>
        </details>
      )}

      {order.note && (
        <div className="cr-order-note">💬 {order.note}</div>
      )}

      <div className="cr-order-footer">
        <span className="cr-order-total">{fmt(order.final_price)} so'm</span>
        {mode === 'available' && (
          <button className="cr-btn-accept" onClick={onAccept} disabled={accepting}>
            {accepting ? <Loader size={16} className="spin" /> : <>🛵 Olaman</>}
          </button>
        )}
        {mode === 'mine' && order.status === 'on_way' && (
          <button className="cr-btn-done" onClick={onComplete} disabled={completing}>
            {completing ? <Loader size={16} className="spin" /> : <><CheckCircle2 size={16} /> Yetkazildi</>}
          </button>
        )}
        {mode === 'mine' && order.status === 'served' && (
          <span className="cr-order-served"><CheckCircle2 size={14} /> Yetkazildi</span>
        )}
      </div>
    </div>
  )
}
