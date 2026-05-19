import React, { useState, useEffect, useRef } from 'react'
import { menuAPI, ordersAPI, agentsAPI } from '../../api'
import toast from 'react-hot-toast'
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, X, CheckCircle, Search, QrCode, ChefHat, Home, Camera } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import './CashierPage.css'

const statusLabels = { pending: "Kutilmoqda", cooking: "Tayyorlanmoqda", ready: "Tayyor", served: "Berildi" }
const statusColors = { pending: 'badge-yellow', cooking: 'badge-orange', ready: 'badge-green', served: 'badge-gray' }

export default function CashierPage() {
  const navigate = useNavigate()
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState([])
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [cardCode, setCardCode] = useState('')
  const [cardInfo, setCardInfo] = useState(null)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [lastOrder, setLastOrder] = useState(null)
  const [orders, setOrders] = useState([])
  const [activeTab, setActiveTab] = useState('menu')
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerStatus, setScannerStatus] = useState('') // 'loading' | 'running' | 'error: ...'
  const wsRef = useRef(null)
  const scanCardRef = useRef(null)

  useEffect(() => {
    loadMenu()
    loadOrders()
    connectWS()
    return () => wsRef.current?.close()
  }, [])

  const connectWS = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data)
      if (msg.type === 'order_status_changed') {
        setOrders(prev => prev.map(o => o.id === msg.payload.id ? { ...o, status: msg.payload.status } : o))
        if (msg.payload.status === 'served') {
          toast.success(`Buyurtma №${msg.payload.order_code} tayyor va berildi!`, { duration: 6000, icon: '🍽️' })
        }
      }
    }
    wsRef.current = ws
  }

  const loadMenu = async () => {
    try {
      const res = await menuAPI.getAll()
      setMenu(res.data)
    } catch { toast.error("Menyu yuklanmadi") }
  }

  const loadOrders = async () => {
    try {
      const res = await ordersAPI.getAll()
      setOrders(res.data.filter(o => o.status !== 'served').slice(0, 20))
    } catch {}
  }

  const categories = ['all', ...new Set(menu.map(m => m.category))]

  const filtered = menu.filter(m => {
    const matchCat = category === 'all' || m.category === category
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch && m.available
  })

  const addToCart = (item) => {
    setCart(prev => {
      const exists = prev.find(c => c.id === item.id)
      if (exists) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { ...item, qty: 1 }]
    })
  }

  const updateQty = (id, delta) => {
    setCart(prev => {
      const updated = prev.map(c => c.id === id ? { ...c, qty: c.qty + delta } : c)
      return updated.filter(c => c.qty > 0)
    })
  }

  const cartTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0)
  const discount = cardInfo?.discount || 0
  const finalTotal = Math.max(0, cartTotal - discount)

  const scanCard = async (codeOverride) => {
    const code = ((codeOverride ?? cardCode) || '').trim()
    if (!code) return
    try {
      const res = await agentsAPI.scanCard({ card_code: code, order_total: cartTotal })
      setCardInfo(res.data)
      setCardCode(code)
      toast.success(`Karta: ${res.data.agent_name} — chegirma ${res.data.discount.toLocaleString()} so'm`)
    } catch (e) {
      toast.error(e.response?.data?.error || "Karta topilmadi")
      setCardInfo(null)
    }
  }
  scanCardRef.current = scanCard

  useEffect(() => {
    if (!scannerOpen) return
    let qr
    let handled = false
    let cancelled = false

    setScannerStatus('loading')

    ;(async () => {
      // Wait one frame so #qr-reader is in the DOM and laid out
      await new Promise(r => setTimeout(r, 50))

      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerStatus("Brauzer kamerani qo'llab-quvvatlamaydi")
        return
      }
      if (!window.isSecureContext) {
        setScannerStatus("HTTPS kerak (manzilga 's' qo'shing: https://...)")
        return
      }

      try {
        qr = new Html5Qrcode('qr-reader', /* verbose */ false)

        const tryStart = async (cameraConfig) => {
          return qr.start(
            cameraConfig,
            { fps: 10, qrbox: { width: 240, height: 240 } },
            (decoded) => {
              if (handled) return
              handled = true
              qr.stop().catch(() => {}).then(() => {
                if (cancelled) return
                setScannerOpen(false)
                scanCardRef.current?.(decoded)
              })
            },
            () => {}
          )
        }

        // First try environment-facing (back camera on phones)
        try {
          await tryStart({ facingMode: { exact: 'environment' } })
        } catch (firstErr) {
          // Fallback: pick first available camera (laptops, devices without back cam)
          const cams = await Html5Qrcode.getCameras()
          if (!cams || cams.length === 0) {
            throw new Error('Kamera topilmadi')
          }
          await tryStart(cams[0].id)
        }

        setScannerStatus('running')
      } catch (e) {
        const msg = (e && (e.message || e.name)) || String(e)
        let userMsg = msg
        if (/Permission|NotAllowed/i.test(msg)) userMsg = "Brauzer kameraga ruxsat bermadi"
        else if (/NotFound/i.test(msg)) userMsg = "Qurilmada kamera topilmadi"
        else if (/NotReadable|TrackStart/i.test(msg)) userMsg = "Kamerani boshqa dastur ishlatayapti"
        setScannerStatus("Xato: " + userMsg)
      }
    })()

    return () => {
      cancelled = true
      setScannerStatus('')
      if (qr) {
        qr.stop().catch(() => {}).then(() => {
          try { qr.clear() } catch {}
        })
      }
    }
  }, [scannerOpen])

  const submitOrder = async () => {
    if (cart.length === 0) { toast.error("Savat bo'sh"); return }
    setSubmitting(true)
    try {
      const res = await ordersAPI.create({
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty })),
        card_code: cardCode || undefined,
        note,
      })
      setLastOrder(res.data)
      setCart([])
      setCardCode('')
      setCardInfo(null)
      setNote('')
      toast.success(`Buyurtma №${res.data.order_code} qabul qilindi!`)
      loadOrders()
    } catch (e) {
      toast.error(e.response?.data?.error || "Xatolik yuz berdi")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="cashier-page">
      {/* Cosmic animated background */}
      <div className="background-container">
        <img className="moon" src="https://s3-us-west-2.amazonaws.com/s.cdpn.io/1231630/moon2.png" alt="" />
        <div className="stars" />
        <div className="twinkling" />
        <div className="clouds" />
      </div>

      <header className="cashier-header">
        <div className="cashier-header-left">
          <button className="btn-icon" onClick={() => navigate('/')}><Home size={20} /></button>
          <div className="cashier-logo">
            <span className="logo-text">ECO taomlar</span>
            <span className="logo-sub">Kassa paneli</span>
          </div>
        </div>
        <div className="cashier-tabs">
          <button className={`tab ${activeTab === 'menu' ? 'active' : ''}`} onClick={() => setActiveTab('menu')}>
            Yangi buyurtma
          </button>
          <button className={`tab ${activeTab === 'orders' ? 'active' : ''}`} onClick={() => setActiveTab('orders')}>
            Joriy buyurtmalar
            {orders.length > 0 && <span className="tab-badge">{orders.length}</span>}
          </button>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/kitchen')}>
          <ChefHat size={16} /> Oshpaz
        </button>
      </header>

      {activeTab === 'menu' ? (
        <div className="cashier-body">
          <div className="menu-section">
            <div className="menu-controls glass-panel">
              <div className="search-wrap">
                <Search size={16} className="search-icon" />
                <input
                  className="glass-input search-input"
                  placeholder="Taom qidirish..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div className="category-tabs">
                {categories.map(cat => (
                  <button
                    key={cat}
                    className={`cat-tab ${category === cat ? 'active' : ''}`}
                    onClick={() => setCategory(cat)}
                  >
                    {cat === 'all' ? 'Barchasi' : cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="menu-grid">
              {filtered.map(item => {
                const inCart = cart.find(c => c.id === item.id)
                return (
                  <div key={item.id} className={`menu-card glass-card ${inCart ? 'in-cart' : ''}`} onClick={() => addToCart(item)}>
                    <div className="menu-card-body">
                      <h3>{item.name}</h3>
                      <p>{item.description}</p>
                    </div>
                    <div className="menu-card-footer">
                      <span className="price">{item.price.toLocaleString()} so'm</span>
                      {inCart ? (
                        <span className="qty-badge">{inCart.qty}</span>
                      ) : (
                        <Plus size={18} className="add-icon" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="cart-section glass-panel">
            <div className="cart-header">
              <ShoppingCart size={20} />
              <span>Savat ({cart.reduce((s, c) => s + c.qty, 0)} ta)</span>
            </div>

            <div className="cart-items">
              {cart.length === 0 ? (
                <div className="cart-empty">
                  <ShoppingCart size={40} opacity={0.2} />
                  <p>Savat bo'sh</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="cart-item">
                    <div className="cart-item-info">
                      <span className="cart-item-name">{item.name}</span>
                      <span className="cart-item-price">{(item.price * item.qty).toLocaleString()} so'm</span>
                    </div>
                    <div className="cart-item-controls">
                      <button onClick={() => updateQty(item.id, -1)}><Minus size={14} /></button>
                      <span>{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)}><Plus size={14} /></button>
                      <button className="delete-btn" onClick={() => setCart(c => c.filter(i => i.id !== item.id))}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="cart-footer">
              <div className="card-scan">
                <div className="card-input-row">
                  <input
                    className="glass-input"
                    placeholder="Karta kodini kiriting..."
                    value={cardCode}
                    onChange={e => setCardCode(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && scanCard()}
                  />
                  <button className="btn btn-secondary" onClick={() => scanCard()} title="Tekshirish">
                    <CheckCircle size={16} />
                  </button>
                  <button className="btn btn-secondary" onClick={() => setScannerOpen(true)} title="Kamera bilan skanerlash">
                    <QrCode size={16} />
                  </button>
                </div>
                {cardInfo && (
                  <div className="card-info">
                    <CheckCircle size={14} color="#10B981" />
                    <span>{cardInfo.agent_name}</span>
                    <span className="discount-amount">-{cardInfo.discount.toLocaleString()} so'm</span>
                    <button onClick={() => { setCardInfo(null); setCardCode('') }}><X size={14} /></button>
                  </div>
                )}
              </div>

              <input
                className="glass-input"
                placeholder="Izoh (ixtiyoriy)..."
                value={note}
                onChange={e => setNote(e.target.value)}
                style={{ marginBottom: 12 }}
              />

              <div className="cart-totals">
                <div className="total-row"><span>Jami:</span><span>{cartTotal.toLocaleString()} so'm</span></div>
                {discount > 0 && <div className="total-row discount"><span>Chegirma:</span><span>-{discount.toLocaleString()} so'm</span></div>}
                <div className="total-row final"><span>To'lov:</span><span>{finalTotal.toLocaleString()} so'm</span></div>
              </div>

              <button
                className="checkout-btn"
                onClick={submitOrder}
                disabled={submitting || cart.length === 0}
              >
                {submitting ? 'Yuborilmoqda...' : "Buyurtma bering"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="orders-list-section">
          <div className="orders-grid">
            {orders.length === 0 ? (
              <div className="empty-state">Joriy buyurtmalar yo'q</div>
            ) : (
              orders.map(order => (
                <div key={order.id} className={`order-card glass-card status-${order.status}`}>
                  <div className="order-card-header">
                    <span className="order-number">#{order.order_code}</span>
                    <span className={`badge ${statusColors[order.status]}`}>{statusLabels[order.status]}</span>
                  </div>
                  <div className="order-card-body">
                    <span className="order-total">{order.final_price?.toLocaleString()} so'm</span>
                    {order.card_code && <span className="order-card-code"><QrCode size={12} /> {order.card_code}</span>}
                    {order.note && <p className="order-note">{order.note}</p>}
                  </div>
                  <div className="order-time">
                    {new Date(order.created_at).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {lastOrder && (
        <div className="order-success-modal">
          <div className="order-success-card slide-in">
            <button className="modal-close" onClick={() => setLastOrder(null)}><X size={20} /></button>
            <div className="success-icon">✅</div>
            <h2>Buyurtma qabul qilindi!</h2>
            <div className="order-code-big">#{lastOrder.order_code}</div>
            <p>Mijozga ushbu raqamni bering</p>
            <div className="order-summary">
              <div className="summary-row"><span>Jami:</span><span>{lastOrder.total_price?.toLocaleString()} so'm</span></div>
              {lastOrder.discount_amount > 0 && (
                <div className="summary-row green"><span>Chegirma:</span><span>-{lastOrder.discount_amount?.toLocaleString()} so'm</span></div>
              )}
              <div className="summary-row bold"><span>To'lov:</span><span>{lastOrder.final_price?.toLocaleString()} so'm</span></div>
            </div>
            <button className="checkout-btn" onClick={() => setLastOrder(null)}>Tushunarli</button>
          </div>
        </div>
      )}

      {scannerOpen && (
        <div
          className="order-success-modal"
          onClick={e => e.target === e.currentTarget && setScannerOpen(false)}
        >
          <div className="order-success-card slide-in" style={{ maxWidth: 460, padding: 16, background: '#0f0a08', color: 'white', border: '1px solid rgba(255,107,53,0.3)' }}>
            <button className="modal-close" onClick={() => setScannerOpen(false)} style={{ color: 'white' }}><X size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, justifyContent: 'center', color: '#FF6B35' }}>
              <Camera size={22} />
              <h2 style={{ margin: 0, fontSize: 18, color: '#FF6B35' }}>QR kodni skanerlash</h2>
            </div>
            <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', minHeight: 320, border: '2px solid #FF6B35' }}>
              <div id="qr-reader" />
              {scannerStatus !== 'running' && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: 15, textAlign: 'center', padding: 24,
                  background: 'rgba(0,0,0,0.85)',
                  zIndex: 10,
                }}>
                  <div style={{ fontSize: 40, marginBottom: 10 }}>
                    {scannerStatus.startsWith('Xato') ? '⚠️' : '📷'}
                  </div>
                  <div style={{ fontWeight: 600 }}>
                    {scannerStatus === 'loading'
                      ? 'Kamera yuklanmoqda...'
                      : (scannerStatus || 'Kamera tayyorlanmoqda...')}
                  </div>
                  {scannerStatus === 'loading' && (
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
                      Brauzer kameraga ruxsat so'raydi — «Allow» bosing
                    </div>
                  )}
                </div>
              )}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 12, textAlign: 'center' }}>
              {scannerStatus === 'running'
                ? '👇 QR kodni rom ichiga olib keling'
                : 'Iltimos kuting yoki ruxsat bering'}
            </p>

            {/* File upload fallback — works even without live camera */}
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', textAlign: 'center', marginBottom: 8 }}>
                Yoki QR rasmni yuklang (telefonda surat oling)
              </div>
              <label style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px', borderRadius: 9, background: 'rgba(255,107,53,0.15)',
                border: '1.5px dashed #FF6B35', color: '#FF6B35', cursor: 'pointer',
                fontSize: 13, fontWeight: 600,
              }}>
                <Camera size={15} />
                <span>Rasm tanlash / Surat olish</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    try {
                      const tmp = new Html5Qrcode('qr-reader-file')
                      const decoded = await tmp.scanFile(file, false)
                      try { tmp.clear() } catch {}
                      setScannerOpen(false)
                      scanCardRef.current?.(decoded)
                    } catch (err) {
                      toast.error("Rasmda QR topilmadi — yaqinroq surat oling")
                    }
                  }}
                />
            <div id="qr-reader-file" style={{ display: 'none' }} />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
