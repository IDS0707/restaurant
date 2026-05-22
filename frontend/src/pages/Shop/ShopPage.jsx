import React, { useState, useEffect, useMemo, useRef } from 'react'
import { menuAPI, ordersAPI, customerAPI, promoAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Plus, Minus, Trash2, X, Search,
  MapPin, Truck, Store, Phone, User, Check, Loader, ChevronLeft, ChevronRight,
  Home as HomeIcon, ClipboardList, UserCircle, LogOut, Edit3,
  ShoppingBag, ChefHat, Bike, PackageCheck, Globe2, HelpCircle, Info, Sparkles,
} from 'lucide-react'
import './ShopPage.css'
import { t, getLang, setLang, LANGS, CATEGORY_META, categoryMeta } from './shopI18n'

const fmt = v => Number(v || 0).toLocaleString()
const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fmtJoin = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

const ACTIVE_STATUSES = ['pending', 'cooking', 'ready']
const STATUS_STEPS = ['pending', 'cooking', 'ready', 'served']
const STATUS_INDEX = { pending: 0, cooking: 1, ready: 2, served: 3 }

const statusColor = (st) => ({
  pending: { color: '#F59E0B', bg: '#FEF3C7' },
  cooking: { color: '#FF6B35', bg: '#FFE4D6' },
  ready: { color: '#0EA5E9', bg: '#E0F2FE' },
  served: { color: '#10B981', bg: '#D1FAE5' },
  rejected: { color: '#EF4444', bg: '#FEE2E2' },
}[st] || { color: '#6B7280', bg: '#F3F4F6' })

const statusKey = (st) => ({
  pending: 'statusPending',
  cooking: 'statusCooking',
  ready: 'statusReady',
  served: 'statusServed',
  rejected: 'statusRejected',
}[st] || 'statusPending')

const STEP_ICONS = [ShoppingBag, ChefHat, Bike, PackageCheck]
const STEP_KEYS = ['stepPending', 'stepCooking', 'stepReady', 'stepServed']

export default function ShopPage() {
  // Language
  const [lang, setLangState] = useState(getLang())
  const tr = (k) => t(k, lang)
  const changeLang = (code) => { setLang(code); setLangState(code) }

  // Auth state
  const [customer, setCustomer] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [authStep, setAuthStep] = useState('welcome')
  const [regPhone, setRegPhone] = useState('')
  const [regFirst, setRegFirst] = useState('')
  const [regLast, setRegLast] = useState('')
  const [registering, setRegistering] = useState(false)

  // App state
  const [tab, setTab] = useState('menu')
  const [menu, setMenu] = useState([])
  const [loadingMenu, setLoadingMenu] = useState(true)
  const [orders, setOrders] = useState([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [addresses, setAddresses] = useState([])

  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop_cart') || '[]') } catch { return [] }
  })
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')

  // Checkout
  const [view, setView] = useState('home')
  const [deliveryType, setDeliveryType] = useState('delivery')
  const [selectedAddrId, setSelectedAddrId] = useState(null)
  const [newAddrText, setNewAddrText] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [showAddAddr, setShowAddAddr] = useState(false)
  const [addrLabel, setAddrLabel] = useState('Uy')
  const [note, setNote] = useState('')
  const [promoInput, setPromoInput] = useState('')
  const [promoCheck, setPromoCheck] = useState(null) // {valid, discount_value, final_price, label, error?}
  const [promoChecking, setPromoChecking] = useState(false)
  const promoDebounceRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [imgErrors, setImgErrors] = useState({})

  useEffect(() => { localStorage.setItem('shop_cart', JSON.stringify(cart)) }, [cart])

  // Check auth on mount
  useEffect(() => {
    (async () => {
      const token = localStorage.getItem('eco_customer_token')
      if (token) {
        try {
          const r = await customerAPI.me()
          setCustomer(r.data)
        } catch {
          localStorage.removeItem('eco_customer_token')
        }
      }
      setCheckingAuth(false)
    })()
  }, [])

  useEffect(() => { loadMenu() }, [])
  const loadMenu = async () => {
    setLoadingMenu(true)
    try {
      const r = await menuAPI.getAll()
      setMenu(r.data.filter(m => m.available))
    } catch { toast.error("Menyu yuklanmadi") }
    finally { setLoadingMenu(false) }
  }

  useEffect(() => {
    if (customer) {
      loadOrders()
      loadAddresses()
      // Ask for location once after login (if not granted yet)
      maybeAskLocation()
    }
  }, [customer])

  // Auto-refresh orders every 5s while there's an active order (real-time status)
  useEffect(() => {
    if (!customer) return
    const hasActive = orders.some(o => ACTIVE_STATUSES.includes(o.status))
    if (!hasActive) return
    const id = setInterval(loadOrders, 5000)
    return () => clearInterval(id)
  }, [customer, orders])

  const loadOrders = async () => {
    setLoadingOrders(true)
    try {
      const r = await customerAPI.orders()
      setOrders(r.data)
    } catch {}
    finally { setLoadingOrders(false) }
  }

  const loadAddresses = async () => {
    try {
      const r = await customerAPI.addresses()
      setAddresses(r.data)
      const def = r.data.find(a => a.is_default) || r.data[0]
      if (def) setSelectedAddrId(def.id)
    } catch {}
  }

  // Debounced promo check: trigger 500ms after user stops typing
  useEffect(() => {
    if (promoDebounceRef.current) clearTimeout(promoDebounceRef.current)
    const code = promoInput.trim()
    if (!code) {
      setPromoCheck(null)
      setPromoChecking(false)
      return
    }
    setPromoChecking(true)
    promoDebounceRef.current = setTimeout(async () => {
      try {
        const r = await promoAPI.check(code, cartTotalNow())
        setPromoCheck({ ...r.data, error: null })
      } catch (e) {
        setPromoCheck({ valid: false, error: e?.response?.data?.error || 'Xato' })
      } finally {
        setPromoChecking(false)
      }
    }, 500)
    return () => promoDebounceRef.current && clearTimeout(promoDebounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoInput, cart])

  // Snapshot of current cart total (for promo check that doesn't capture stale closures)
  const cartTotalNow = () => cart.reduce((s, c) => s + c.price * c.qty, 0)

  const maybeAskLocation = () => {
    if (!navigator.geolocation) return
    if (localStorage.getItem('shop_location_asked') === '1') return
    localStorage.setItem('shop_location_asked', '1')
    // Soft request — no error toast if denied at this stage
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
    )
  }

  // Registration
  const doRegister = async () => {
    if (!regPhone.trim() || !regFirst.trim()) {
      toast.error(tr('errorRegister'))
      return
    }
    setRegistering(true)
    try {
      const r = await customerAPI.register({
        phone: regPhone.trim(),
        first_name: regFirst.trim(),
        last_name: regLast.trim(),
      })
      localStorage.setItem('eco_customer_token', r.data.token)
      setCustomer(r.data.customer)
      toast.success(`${tr('helloPrefix')}, ${r.data.customer.first_name}!`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xatolik')
    } finally {
      setRegistering(false)
    }
  }

  const logout = () => {
    if (!window.confirm(tr('logoutConfirm'))) return
    localStorage.removeItem('eco_customer_token')
    localStorage.removeItem('shop_location_asked')
    setCustomer(null)
    setOrders([])
    setAddresses([])
    setTab('menu')
    setView('home')
    setAuthStep('welcome')
  }

  // Cart helpers
  const inCart = id => cart.find(c => c.id === id)
  const addToCart = item => {
    setCart(prev => {
      const ex = prev.find(c => c.id === item.id)
      if (ex) return prev.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: item.id, name: item.name, price: item.price, image_url: item.image_url, qty: 1 }]
    })
  }
  const incQty = id => setCart(prev => prev.map(c => c.id === id ? { ...c, qty: c.qty + 1 } : c))
  const decQty = id => setCart(prev =>
    prev.map(c => c.id === id ? { ...c, qty: c.qty - 1 } : c).filter(c => c.qty > 0)
  )
  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  // Geolocation (active call from button)
  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error(tr('browserNoGeo'))
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        toast.success('✓')
        setLocating(false)
      },
      (err) => {
        let msg = tr('locationFailed')
        if (err.code === 1) msg = tr('locationDenied')
        toast.error(msg)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  // Address management
  const saveAddress = async () => {
    if (!newAddrText.trim()) {
      toast.error(tr('errorAddrEmpty'))
      return
    }
    try {
      const payload = {
        label: addrLabel || 'Manzil',
        address: newAddrText.trim(),
        lat: coords?.lat,
        lng: coords?.lng,
        is_default: addresses.length === 0,
      }
      const r = await customerAPI.addAddress(payload)
      setAddresses(prev => [r.data, ...prev])
      setSelectedAddrId(r.data.id)
      setNewAddrText('')
      setCoords(null)
      setShowAddAddr(false)
      toast.success(tr('addrSaved'))
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xatolik')
    }
  }

  const removeAddress = async (id) => {
    if (!window.confirm(tr('deleteAddrConfirm'))) return
    try {
      await customerAPI.deleteAddress(id)
      setAddresses(prev => prev.filter(a => a.id !== id))
      if (selectedAddrId === id) setSelectedAddrId(null)
    } catch { toast.error('Xatolik') }
  }

  // Submit order
  const submitOrder = async () => {
    if (cart.length === 0) { toast.error(tr('cartEmpty')); return }
    if (deliveryType === 'delivery') {
      const addr = addresses.find(a => a.id === selectedAddrId)
      if (!addr) { toast.error(tr('selectAddress')); return }
    }
    setSubmitting(true)
    try {
      const addr = deliveryType === 'delivery' ? addresses.find(a => a.id === selectedAddrId) : null
      const res = await ordersAPI.create({
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty })),
        note,
        card_code: promoInput.trim() || undefined,
        delivery_type: deliveryType,
        delivery_address: addr?.address || '',
        delivery_lat: addr?.lat || undefined,
        delivery_lng: addr?.lng || undefined,
      })
      setOrderCode(res.data.order_code)
      setCart([])
      setNote('')
      setPromoInput('')
      setPromoCheck(null)
      setView('success')
      loadOrders()
    } catch (e) {
      toast.error(e?.response?.data?.error || "Buyurtma jo'natilmadi")
    } finally {
      setSubmitting(false)
    }
  }

  // Categories: all admin-known + any extras in menu, plus 'all'
  const visibleCategories = useMemo(() => {
    const inMenu = new Set(menu.map(m => m.category))
    const knownInOrder = CATEGORY_META
      .filter(c => inMenu.has(c.src))
      .map(c => c.src)
    const extras = [...inMenu].filter(c => !CATEGORY_META.find(m => m.src === c))
    return ['all', ...knownInOrder, ...extras]
  }, [menu])

  const filtered = useMemo(() => menu
    .filter(m => {
      const matchCat = category === 'all' || m.category === category
      const matchSearch = !search || m.name.toLowerCase().includes(search.toLowerCase())
      return matchCat && matchSearch
    })
    .sort((a, b) => b.price - a.price)
  , [menu, category, search])

  // Stats
  const activeOrder = orders.find(o => ACTIVE_STATUSES.includes(o.status))
  const selectedAddress = addresses.find(a => a.id === selectedAddrId)
  const completedOrders = orders.filter(o => o.status === 'served')
  const totalSpent = completedOrders.reduce((s, o) => s + Number(o.final_price || 0), 0)

  // ───────── RENDER STATES ─────────

  if (checkingAuth) {
    return (
      <div className="shop-loading">
        <Loader size={40} className="spin" />
        <p>...</p>
      </div>
    )
  }

  // WELCOME / REGISTRATION
  if (!customer) {
    if (authStep === 'welcome') {
      return (
        <div className="shop-welcome">
          <div className="shop-welcome-bg" />
          <div className="shop-welcome-blob shop-welcome-blob-1" />
          <div className="shop-welcome-blob shop-welcome-blob-2" />
          <div className="shop-welcome-content">
            <div className="shop-welcome-lang">
              {LANGS.map(l => (
                <button key={l.code} onClick={() => changeLang(l.code)}
                  className={`shop-welcome-lang-btn ${lang === l.code ? 'active' : ''}`}>
                  {l.flag}
                </button>
              ))}
            </div>
            <div className="shop-welcome-emoji">🍽️</div>
            <h1>{tr('appName')}</h1>
            <p>{tr('welcomeTagline')}</p>
            <ul className="shop-welcome-features">
              <li>{tr('fastDelivery')}</li>
              <li>{tr('freshFood')}</li>
              <li>{tr('specialDiscounts')}</li>
            </ul>
            <button className="shop-btn-primary" onClick={() => setAuthStep('register')}>
              {tr('start')} <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="shop-page shop-auth">
        <header className="shop-header-simple">
          <button className="shop-icon-btn" onClick={() => setAuthStep('welcome')}>
            <ChevronLeft size={22} />
          </button>
          <h1>{tr('register')}</h1>
        </header>
        <div className="shop-auth-form">
          <p className="shop-auth-intro">{tr('registerIntro')}</p>
          <div className="shop-input-with-icon">
            <Phone size={16} />
            <input
              className="shop-input"
              type="tel"
              placeholder={tr('phonePlaceholder')}
              value={regPhone}
              onChange={e => setRegPhone(e.target.value)}
            />
          </div>
          <input
            className="shop-input"
            placeholder={tr('firstName') + ' *'}
            value={regFirst}
            onChange={e => setRegFirst(e.target.value)}
          />
          <input
            className="shop-input"
            placeholder={tr('lastName')}
            value={regLast}
            onChange={e => setRegLast(e.target.value)}
          />
          <button
            className="shop-btn-primary shop-btn-full"
            onClick={doRegister}
            disabled={registering}
          >
            {registering
              ? <><Loader size={16} className="spin" /> {tr('checking')}</>
              : <>{tr('continue')} <Check size={16} /></>}
          </button>
          <p style={{ fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginTop: 16 }}>
            {tr('registerNote')}
          </p>
        </div>
      </div>
    )
  }

  // SUCCESS view
  if (view === 'success') {
    return (
      <div className="shop-success">
        <div className="shop-success-emoji">✅</div>
        <h1>{tr('orderAccepted')}</h1>
        <div className="shop-success-code">#{orderCode}</div>
        <p>{tr('weWillCall')}</p>
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="shop-btn-secondary" onClick={() => { setView('home'); setTab('orders'); setOrderCode('') }}>
            <ClipboardList size={16} /> {tr('trackOrder')}
          </button>
          <button className="shop-btn-primary" onClick={() => { setView('home'); setTab('menu'); setOrderCode('') }}>
            {tr('newOrder')}
          </button>
        </div>
      </div>
    )
  }

  // CHECKOUT view
  if (view === 'checkout') {
    return (
      <div className="shop-page">
        <header className="shop-header-simple">
          <button className="shop-icon-btn" onClick={() => setView('home')}>
            <ChevronLeft size={22} />
          </button>
          <h1>{tr('checkout')}</h1>
        </header>

        <div className="shop-checkout">
          {/* Cart summary */}
          <div className="shop-section">
            <h3><ShoppingBag size={16} /> {tr('cartItems')} ({cartCount})</h3>
            {cart.map(c => (
              <div key={c.id} className="shop-summary-row">
                <span>{c.qty}× {c.name}</span>
                <span className="shop-summary-price">{fmt(c.price * c.qty)} {tr('sum')}</span>
              </div>
            ))}
            <div className="shop-summary-total">
              <span>{tr('total')}</span>
              <span>{fmt(cartTotal)} {tr('sum')}</span>
            </div>
          </div>

          {/* Delivery type */}
          <div className="shop-section">
            <h3>{tr('delivery')}</h3>
            <div className="shop-toggle">
              <button
                className={`shop-toggle-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                <Truck size={18} />
                <span>{tr('deliveryNow')}</span>
              </button>
              <button
                className={`shop-toggle-btn ${deliveryType === 'pickup' ? 'active' : ''}`}
                onClick={() => setDeliveryType('pickup')}
              >
                <Store size={18} />
                <span>{tr('pickup')}</span>
              </button>
            </div>

            {deliveryType === 'delivery' && (
              <>
                {addresses.length > 0 ? (
                  <div className="shop-addresses">
                    {addresses.map(a => (
                      <label
                        key={a.id}
                        className={`shop-addr ${selectedAddrId === a.id ? 'selected' : ''}`}
                      >
                        <input
                          type="radio"
                          name="addr"
                          checked={selectedAddrId === a.id}
                          onChange={() => setSelectedAddrId(a.id)}
                        />
                        <div className="shop-addr-body">
                          <div className="shop-addr-label">
                            <MapPin size={14} /> {a.label}
                          </div>
                          <div className="shop-addr-text">{a.address}</div>
                          {a.lat && a.lng && (
                            <div className="shop-addr-coord">📍 {a.lat.toFixed(4)}, {a.lng.toFixed(4)}</div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 10 }}>
                    {tr('noAddresses')}
                  </p>
                )}

                {!showAddAddr ? (
                  <button className="shop-btn-secondary" onClick={() => setShowAddAddr(true)}>
                    <Plus size={16} /> {tr('addNewAddress')}
                  </button>
                ) : (
                  <div style={{ marginTop: 8, padding: 12, background: '#F9FAFB', borderRadius: 10 }}>
                    <input
                      className="shop-input"
                      placeholder={tr('addrLabelPlaceholder')}
                      value={addrLabel}
                      onChange={e => setAddrLabel(e.target.value)}
                    />
                    <input
                      className="shop-input"
                      placeholder={tr('addrTextPlaceholder')}
                      value={newAddrText}
                      onChange={e => setNewAddrText(e.target.value)}
                    />
                    <button
                      className="shop-btn-secondary"
                      onClick={getLocation}
                      disabled={locating}
                      style={{ marginTop: 4 }}
                    >
                      {locating
                        ? <><Loader size={16} className="spin" /> {tr('locating')}</>
                        : <><MapPin size={16} /> {coords ? tr('locationFetched') : tr('getLocation')}</>}
                    </button>
                    {coords && (
                      <div className="shop-coords">
                        📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                      </div>
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button
                        className="shop-btn-secondary"
                        onClick={() => { setShowAddAddr(false); setNewAddrText(''); setCoords(null) }}
                      >
                        {tr('cancel')}
                      </button>
                      <button className="shop-btn-primary shop-btn-full" onClick={saveAddress}>
                        <Check size={16} /> {tr('saveAddress')}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Promo code */}
          <div className="shop-section">
            <h3>🎟️ {tr('promoCode')}</h3>
            <div className="shop-promo-row">
              <input
                className="shop-input"
                placeholder={tr('promoCode')}
                value={promoInput}
                onChange={e => setPromoInput(e.target.value.toUpperCase())}
                style={{ fontFamily: 'monospace', letterSpacing: 1, fontWeight: 600, marginBottom: 0 }}
              />
              {promoChecking && <Loader size={18} className="spin" style={{ color: '#FF6B35', marginLeft: 8 }} />}
            </div>
            {promoCheck && promoCheck.valid && (
              <div className="shop-promo-ok">
                <Check size={14} />
                <span>{tr('promoApplied')} — </span>
                <strong>−{fmt(promoCheck.discount_value)} {tr('sum')}</strong>
              </div>
            )}
            {promoCheck && !promoCheck.valid && promoCheck.error && (
              <div className="shop-promo-err">{promoCheck.error}</div>
            )}
          </div>

          {/* Final price summary (shown when a promo is applied) */}
          {promoCheck && promoCheck.valid && promoCheck.discount_value > 0 && (
            <div className="shop-section shop-price-summary">
              <div className="shop-summary-row">
                <span>{tr('total')}</span>
                <span style={{ textDecoration: 'line-through', color: '#9CA3AF' }}>{fmt(cartTotal)} {tr('sum')}</span>
              </div>
              <div className="shop-summary-row" style={{ color: '#10B981' }}>
                <span>🎟️ {promoCheck.label || tr('promoApplied')}</span>
                <span style={{ fontWeight: 700 }}>−{fmt(promoCheck.discount_value)} {tr('sum')}</span>
              </div>
              <div className="shop-summary-total">
                <span>✓</span>
                <span>{fmt(promoCheck.final_price)} {tr('sum')}</span>
              </div>
            </div>
          )}

          {/* Note */}
          <div className="shop-section">
            <textarea
              className="shop-input"
              rows={2}
              placeholder={tr('note')}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <button
            className="shop-btn-primary shop-btn-checkout"
            onClick={submitOrder}
            disabled={submitting}
          >
            {submitting
              ? <><Loader size={18} className="spin" /> {tr('sending')}</>
              : <><Check size={18} /> {tr('placeOrder')} — {fmt(promoCheck && promoCheck.valid ? promoCheck.final_price : cartTotal)} {tr('sum')}</>}
          </button>
        </div>
      </div>
    )
  }

  // ───────── MAIN APP (HOME) ─────────

  const renderItemCard = (item) => {
    const cartItem = inCart(item.id)
    const fallbackEmoji = categoryMeta(item.category).emoji
    const hasImage = item.image_url && !imgErrors[item.id]
    return (
      <div key={item.id} className="shop-card" onClick={() => !cartItem && addToCart(item)}>
        {hasImage ? (
          <div className="shop-card-img-wrap">
            <img
              src={item.image_url}
              alt={item.name}
              className="shop-card-img-real"
              loading="lazy"
              onError={() => setImgErrors(p => ({ ...p, [item.id]: true }))}
            />
          </div>
        ) : (
          <div className="shop-card-img shop-card-img-empty">{fallbackEmoji}</div>
        )}
        <div className="shop-card-body">
          <h3>{item.name}</h3>
          {item.description && <p>{item.description}</p>}
          <div className="shop-card-footer">
            <span className="shop-price">{fmt(item.price)} {tr('sum')}</span>
            {cartItem ? (
              <div className="shop-qty" onClick={e => e.stopPropagation()}>
                <button onClick={() => decQty(item.id)}><Minus size={14} /></button>
                <span>{cartItem.qty}</span>
                <button onClick={() => incQty(item.id)}><Plus size={14} /></button>
              </div>
            ) : (
              <button className="shop-add" onClick={(e) => { e.stopPropagation(); addToCart(item) }}>
                <Plus size={16} />
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="shop-page">
      {/* TAB: MENU */}
      {tab === 'menu' && (
        <>
          <header className="shop-header">
            <div className="shop-header-row">
              <div>
                <h1>🍽️ {tr('appName')}</h1>
                <p className="shop-subtitle">{tr('helloPrefix')}, {customer.first_name}!</p>
              </div>
              <div className="shop-header-langs">
                {LANGS.map(l => (
                  <button key={l.code} onClick={() => changeLang(l.code)}
                    className={`shop-lang-pill ${lang === l.code ? 'active' : ''}`}>
                    {l.flag}
                  </button>
                ))}
              </div>
            </div>
            {selectedAddress && (
              <div className="shop-deliver-to" onClick={() => setTab('profile')}>
                <MapPin size={14} />
                <div>
                  <div className="shop-deliver-label">{tr('deliverTo')}</div>
                  <div className="shop-deliver-text">{selectedAddress.label} · {selectedAddress.address}</div>
                </div>
              </div>
            )}
          </header>

          {/* Active order banner */}
          {activeOrder && (
            <div className="shop-active-banner" onClick={() => setTab('orders')}>
              <div className="shop-active-banner-top">
                <div>
                  <div className="shop-active-banner-label">{tr('activeOrder')} #{activeOrder.order_code}</div>
                  <div className="shop-active-banner-status">{tr(statusKey(activeOrder.status))}</div>
                </div>
                <ChevronRight size={20} />
              </div>
              <OrderProgress status={activeOrder.status} tr={tr} compact />
            </div>
          )}

          <div className="shop-search">
            <Search size={16} />
            <input
              placeholder={tr('searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category icon chips */}
          <div className="shop-cats">
            {visibleCategories.map(c => {
              if (c === 'all') {
                return (
                  <button key="all"
                    className={`shop-cat-chip ${category === 'all' ? 'active' : ''}`}
                    onClick={() => setCategory('all')}>
                    <span className="shop-cat-emoji">🍽️</span>
                    <span>{tr('all')}</span>
                  </button>
                )
              }
              const meta = categoryMeta(c)
              return (
                <button key={c}
                  className={`shop-cat-chip ${category === c ? 'active' : ''}`}
                  onClick={() => setCategory(c)}>
                  <span className="shop-cat-emoji">{meta.emoji}</span>
                  <span>{tr(meta.key)}</span>
                </button>
              )
            })}
          </div>

          {loadingMenu ? (
            <div className="shop-loading" style={{ minHeight: 200 }}>
              <Loader size={32} className="spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="shop-empty">
              <div style={{ fontSize: 48 }}>🍽️</div>
              <h2>{tr('emptyCategory')}</h2>
            </div>
          ) : (
            <div className="shop-grid">
              {filtered.map(renderItemCard)}
            </div>
          )}

          {cartCount > 0 && (
            <button className="shop-cart-fab" onClick={() => setView('checkout')}>
              <ShoppingCart size={22} />
              <span className="shop-cart-fab-count">{cartCount}</span>
              <span className="shop-cart-fab-total">{fmt(cartTotal)} {tr('sum')}</span>
            </button>
          )}
        </>
      )}

      {/* TAB: ORDERS */}
      {tab === 'orders' && (
        <>
          <header className="shop-header">
            <div>
              <h1>📋 {tr('myOrders')}</h1>
            </div>
          </header>
          {loadingOrders ? (
            <div className="shop-loading" style={{ minHeight: 200 }}>
              <Loader size={32} className="spin" />
            </div>
          ) : orders.length === 0 ? (
            <div className="shop-empty">
              <ClipboardList size={56} color="#D1D5DB" />
              <h2>{tr('noOrdersYet')}</h2>
              <p>{tr('firstOrderHint')}</p>
              <button className="shop-btn-primary" onClick={() => setTab('menu')}>
                {tr('openMenu')}
              </button>
            </div>
          ) : (
            <div className="shop-orders">
              {orders.map(o => {
                const st = statusColor(o.status)
                const isActive = ACTIVE_STATUSES.includes(o.status)
                return (
                  <div key={o.id} className={`shop-order ${isActive ? 'shop-order-active' : ''}`}>
                    <div className="shop-order-head">
                      <div>
                        <div className="shop-order-code">#{o.order_code}</div>
                        <div className="shop-order-date">{fmtDate(o.created_at)}</div>
                      </div>
                      <span className="shop-status" style={{ background: st.bg, color: st.color }}>
                        {tr(statusKey(o.status))}
                      </span>
                    </div>

                    {/* Progress bar for active or recent orders, hidden for rejected */}
                    {o.status !== 'rejected' && (
                      <OrderProgress status={o.status} tr={tr} />
                    )}

                    <ul className="shop-order-items">
                      {(o.items || []).map((it, i) => (
                        <li key={i}>
                          <span>{it.quantity}× {it.item_name}</span>
                          <span>{fmt(it.unit_price * it.quantity)} {tr('sum')}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="shop-order-foot">
                      <span>
                        {o.delivery_type === 'delivery' ? <><Truck size={13} /> {tr('deliveryNow')}</> : <><Store size={13} /> {tr('pickup')}</>}
                      </span>
                      <span className="shop-order-total">{fmt(o.final_price)} {tr('sum')}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* TAB: PROFILE */}
      {tab === 'profile' && (
        <>
          <header className="shop-header">
            <div>
              <h1>👤 {tr('profile')}</h1>
            </div>
          </header>
          <div className="shop-profile">
            {/* Avatar + name */}
            <div className="shop-section">
              <div className="shop-profile-card">
                <div className="shop-profile-avatar">
                  {customer.first_name[0]?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18, color: '#111827' }}>
                    {customer.first_name} {customer.last_name}
                  </div>
                  <div style={{ fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <Phone size={12} /> {customer.phone}
                  </div>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="shop-stats">
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#FFE4D6', color: '#FF6B35' }}>
                  <ShoppingBag size={18} />
                </div>
                <div className="shop-stat-value">{orders.length}</div>
                <div className="shop-stat-label">{tr('totalOrders')}</div>
              </div>
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#D1FAE5', color: '#10B981' }}>
                  <Sparkles size={18} />
                </div>
                <div className="shop-stat-value">{fmt(totalSpent)}</div>
                <div className="shop-stat-label">{tr('totalSpent')} {tr('sum')}</div>
              </div>
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#E0F2FE', color: '#0EA5E9' }}>
                  <UserCircle size={18} />
                </div>
                <div className="shop-stat-value">{fmtJoin(customer.created_at)}</div>
                <div className="shop-stat-label">{tr('joinedOn')}</div>
              </div>
            </div>

            {/* Language */}
            <div className="shop-section">
              <h3><Globe2 size={16} /> {tr('language')}</h3>
              <div style={{ display: 'flex', gap: 8 }}>
                {LANGS.map(l => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => changeLang(l.code)}
                    className={`shop-lang-card ${lang === l.code ? 'active' : ''}`}
                  >
                    <span style={{ fontSize: 22 }}>{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Addresses */}
            <div className="shop-section">
              <h3><MapPin size={16} /> {tr('myAddresses')}</h3>
              {addresses.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>
                  {tr('noAddrsProfile')}
                </p>
              ) : (
                <div className="shop-addresses">
                  {addresses.map(a => (
                    <div key={a.id} className="shop-addr">
                      <div className="shop-addr-body">
                        <div className="shop-addr-label">
                          <MapPin size={14} /> {a.label}
                          {a.is_default && <span className="shop-default-pill">default</span>}
                        </div>
                        <div className="shop-addr-text">{a.address}</div>
                      </div>
                      <button className="shop-addr-del" onClick={() => removeAddress(a.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Settings/info list */}
            <div className="shop-section shop-section-list">
              <button className="shop-list-row" onClick={() => window.open('tel:+998901234567')}>
                <div className="shop-list-icon" style={{ background: '#FEF3C7', color: '#F59E0B' }}>
                  <Phone size={16} />
                </div>
                <div className="shop-list-text">{tr('helpSupport')}</div>
                <ChevronRight size={16} color="#9CA3AF" />
              </button>
              <button className="shop-list-row" onClick={() => toast(`${tr('appName')} v1.0`)}>
                <div className="shop-list-icon" style={{ background: '#E0F2FE', color: '#0EA5E9' }}>
                  <Info size={16} />
                </div>
                <div className="shop-list-text">{tr('aboutApp')}</div>
                <ChevronRight size={16} color="#9CA3AF" />
              </button>
            </div>

            <button className="shop-btn-logout" onClick={logout}>
              <LogOut size={16} /> {tr('logout')}
            </button>
          </div>
        </>
      )}

      {/* BOTTOM NAVIGATION */}
      <nav className="shop-bottom-nav">
        <button className={`shop-nav-item ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>
          <HomeIcon size={22} />
          <span>{tr('tabMenu')}</span>
        </button>
        <button className={`shop-nav-item ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ClipboardList size={22} />
          <span>{tr('tabOrders')}</span>
          {orders.some(o => ACTIVE_STATUSES.includes(o.status)) && <span className="shop-nav-dot" />}
        </button>
        <button className={`shop-nav-item ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <UserCircle size={22} />
          <span>{tr('tabProfile')}</span>
        </button>
      </nav>
    </div>
  )
}

// ───────── ORDER PROGRESS STEPPER ─────────
function OrderProgress({ status, tr, compact }) {
  const currentIdx = STATUS_INDEX[status] ?? 0
  return (
    <div className={`shop-progress ${compact ? 'shop-progress-compact' : ''}`}>
      {STATUS_STEPS.map((step, i) => {
        const Icon = STEP_ICONS[i]
        const done = i <= currentIdx
        const isCurrent = i === currentIdx
        return (
          <React.Fragment key={step}>
            <div className={`shop-progress-step ${done ? 'done' : ''} ${isCurrent ? 'current' : ''}`}>
              <div className="shop-progress-dot">
                <Icon size={compact ? 13 : 16} />
              </div>
              {!compact && <div className="shop-progress-label">{tr(STEP_KEYS[i])}</div>}
            </div>
            {i < STATUS_STEPS.length - 1 && (
              <div className={`shop-progress-bar ${i < currentIdx ? 'done' : ''}`} />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
