import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { menuAPI, ordersAPI, customerAPI, promoAPI } from '../../api'
import toast from 'react-hot-toast'
import { Geolocation } from '@capacitor/geolocation'
import { Capacitor } from '@capacitor/core'
import {
  ShoppingCart, Plus, Minus, Trash2, X, Search,
  MapPin, Truck, Store, Phone, Check, Loader, ChevronLeft, ChevronRight,
  Home as HomeIcon, ClipboardList, UserCircle, LogOut,
  ShoppingBag, ChefHat, Package, Bike, PackageCheck,
  Globe2, Info, Sparkles, AlertTriangle, Star,
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

const ACTIVE_STATUSES = ['pending', 'cooking', 'ready', 'on_way']
const STATUS_STEPS = ['pending', 'cooking', 'ready', 'on_way', 'served']
const STATUS_INDEX = { pending: 0, cooking: 1, ready: 2, on_way: 3, served: 4 }
const CANCELLABLE = ['pending', 'cooking']

const STATUS_THEME = {
  pending:  { color: '#9A3412', bg: '#FFEDD5', dot: '#FB923C' },
  cooking:  { color: '#9A3412', bg: '#FED7AA', dot: '#FF6B35' },
  ready:    { color: '#1E40AF', bg: '#DBEAFE', dot: '#3B82F6' },
  on_way:   { color: '#5B21B6', bg: '#EDE9FE', dot: '#8B5CF6' },
  served:   { color: '#065F46', bg: '#D1FAE5', dot: '#10B981' },
  rejected: { color: '#991B1B', bg: '#FEE2E2', dot: '#EF4444' },
}

const statusKey = (st) => ({
  pending: 'statusPending',
  cooking: 'statusCooking',
  ready: 'statusReady',
  on_way: 'statusOnWay',
  served: 'statusServed',
  rejected: 'statusRejected',
}[st] || 'statusPending')

const STEP_ICONS = [ShoppingBag, ChefHat, Package, Bike, PackageCheck]
const STEP_KEYS = ['stepPending', 'stepCooking', 'stepReady', 'stepOnWay', 'stepServed']

export default function ShopPage() {
  // Language
  const [lang, setLangState] = useState(getLang())
  const tr = useCallback((k) => t(k, lang), [lang])
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
  const [promoCheck, setPromoCheck] = useState(null)
  const [promoChecking, setPromoChecking] = useState(false)
  const promoDebounceRef = useRef(null)
  const [submitting, setSubmitting] = useState(false)
  const [orderCode, setOrderCode] = useState('')
  const [imgErrors, setImgErrors] = useState({})

  // Cancel modal
  const [cancelOrderCode, setCancelOrderCode] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

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

  // Load menu once — even unauthenticated user can browse
  useEffect(() => { loadMenu() }, [])

  const loadMenu = useCallback(async () => {
    setLoadingMenu(true)
    try {
      // serve stale cache first for instant render, then refresh
      const cached = localStorage.getItem('shop_menu_cache')
      if (cached) {
        try {
          const items = JSON.parse(cached)
          if (Array.isArray(items) && items.length) {
            setMenu(items)
            setLoadingMenu(false)
          }
        } catch {}
      }
      const r = await menuAPI.getAll()
      const items = (r.data || []).filter(m => m.available)
      setMenu(items)
      localStorage.setItem('shop_menu_cache', JSON.stringify(items))
    } catch {
      // keep cached menu silently
    } finally {
      setLoadingMenu(false)
    }
  }, [])

  // Load customer-specific data in parallel after login
  useEffect(() => {
    if (!customer) return
    Promise.all([loadOrders(true), loadAddresses()])
    maybeAskLocation()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer])

  // Auto-refresh orders every 5s while there's an active one (real-time)
  useEffect(() => {
    if (!customer) return
    const hasActive = orders.some(o => ACTIVE_STATUSES.includes(o.status))
    if (!hasActive) return
    const id = setInterval(() => loadOrders(false), 5000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, orders])

  const loadOrders = async (showLoader = true) => {
    if (showLoader) setLoadingOrders(true)
    try {
      const r = await customerAPI.orders()
      setOrders(r.data || [])
    } catch {} finally { if (showLoader) setLoadingOrders(false) }
  }

  const loadAddresses = async () => {
    try {
      const r = await customerAPI.addresses()
      setAddresses(r.data || [])
      const def = (r.data || []).find(a => a.is_default) || (r.data || [])[0]
      if (def) setSelectedAddrId(def.id)
    } catch {}
  }

  // Debounced promo check
  useEffect(() => {
    if (promoDebounceRef.current) clearTimeout(promoDebounceRef.current)
    const code = promoInput.trim()
    if (!code) { setPromoCheck(null); setPromoChecking(false); return }
    setPromoChecking(true)
    promoDebounceRef.current = setTimeout(async () => {
      try {
        const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
        const r = await promoAPI.check(code, total)
        setPromoCheck({ ...r.data, error: null })
      } catch (e) {
        setPromoCheck({ valid: false, error: e?.response?.data?.error || 'Xato' })
      } finally { setPromoChecking(false) }
    }, 450)
    return () => promoDebounceRef.current && clearTimeout(promoDebounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoInput, cart])

  // Unified geolocation helper — uses Capacitor Geolocation plugin on native
  // (Android/iOS), which triggers the system permission prompt the first time.
  // Falls back to the browser Geolocation API on the web.
  const getCurrentPositionUnified = useCallback(async (opts = {}) => {
    const isNative = Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()
    if (isNative) {
      // Ensure permission is granted (prompts the user the first time)
      try {
        const status = await Geolocation.checkPermissions()
        if (status.location !== 'granted' && status.coarseLocation !== 'granted') {
          const req = await Geolocation.requestPermissions({ permissions: ['location'] })
          if (req.location !== 'granted' && req.coarseLocation !== 'granted') {
            const err = new Error('denied'); err.code = 1; throw err
          }
        }
      } catch (e) {
        if (e && e.code === 1) throw e
        // checkPermissions can fail on older OS — just try getCurrentPosition
      }
      const pos = await Geolocation.getCurrentPosition({
        enableHighAccuracy: opts.enableHighAccuracy ?? true,
        timeout: opts.timeout ?? 10000,
        maximumAge: opts.maximumAge ?? 0,
      })
      return { lat: pos.coords.latitude, lng: pos.coords.longitude }
    }
    // Web fallback
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = new Error('no_geo'); err.code = 2; reject(err); return
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        reject,
        { enableHighAccuracy: opts.enableHighAccuracy ?? true,
          timeout: opts.timeout ?? 10000,
          maximumAge: opts.maximumAge ?? 0 }
      )
    })
  }, [])

  const maybeAskLocation = useCallback(async () => {
    if (localStorage.getItem('shop_location_asked') === '1') return
    localStorage.setItem('shop_location_asked', '1')
    try {
      const c = await getCurrentPositionUnified({ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 })
      setCoords(c)
    } catch {
      // user may have denied — that's fine, we'll ask again at checkout if needed
    }
  }, [getCurrentPositionUnified])

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
    } finally { setRegistering(false) }
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
  const cartTotal = useMemo(() => cart.reduce((s, c) => s + c.price * c.qty, 0), [cart])
  const cartCount = useMemo(() => cart.reduce((s, c) => s + c.qty, 0), [cart])

  // Geolocation — explicit user request (button tap). Uses native plugin on APK.
  const getLocation = async () => {
    setLocating(true)
    try {
      const c = await getCurrentPositionUnified({ enableHighAccuracy: true, timeout: 12000 })
      setCoords(c)
      toast.success('✓')
    } catch (err) {
      let msg = tr('locationFailed')
      if (err && err.code === 1) msg = tr('locationDenied')
      else if (err && err.code === 2) msg = tr('browserNoGeo')
      toast.error(msg)
    } finally {
      setLocating(false)
    }
  }

  const saveAddress = async () => {
    if (!newAddrText.trim()) { toast.error(tr('errorAddrEmpty')); return }
    try {
      const payload = {
        label: addrLabel || 'Manzil',
        address: newAddrText.trim(),
        lat: coords?.lat, lng: coords?.lng,
        is_default: addresses.length === 0,
      }
      const r = await customerAPI.addAddress(payload)
      setAddresses(prev => [r.data, ...prev])
      setSelectedAddrId(r.data.id)
      setNewAddrText(''); setCoords(null); setShowAddAddr(false)
      toast.success(tr('addrSaved'))
    } catch (e) { toast.error(e?.response?.data?.error || 'Xatolik') }
  }

  const removeAddress = async (id) => {
    if (!window.confirm(tr('deleteAddrConfirm'))) return
    try {
      await customerAPI.deleteAddress(id)
      setAddresses(prev => prev.filter(a => a.id !== id))
      if (selectedAddrId === id) setSelectedAddrId(null)
    } catch { toast.error('Xatolik') }
  }

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
      setCart([]); setNote(''); setPromoInput(''); setPromoCheck(null)
      setView('success')
      loadOrders(false)
    } catch (e) {
      toast.error(e?.response?.data?.error || "Buyurtma jo'natilmadi")
    } finally { setSubmitting(false) }
  }

  // Cancel order
  const openCancel = (code) => { setCancelOrderCode(code); setCancelReason('') }
  const closeCancel = () => { setCancelOrderCode(null); setCancelReason('') }
  const confirmCancel = async () => {
    if (!cancelOrderCode) return
    setCancelling(true)
    try {
      await customerAPI.cancelOrder(cancelOrderCode, cancelReason.trim())
      toast.success(tr('cancelDone'))
      closeCancel()
      loadOrders(false)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xatolik')
    } finally { setCancelling(false) }
  }

  // Visible categories
  const visibleCategories = useMemo(() => {
    const inMenu = new Set(menu.map(m => m.category))
    const knownInOrder = CATEGORY_META.filter(c => inMenu.has(c.src)).map(c => c.src)
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

  // Group items by category when 'all' is selected (sections)
  const grouped = useMemo(() => {
    if (category !== 'all' || search) return null
    const map = new Map()
    for (const m of filtered) {
      if (!map.has(m.category)) map.set(m.category, [])
      map.get(m.category).push(m)
    }
    // sort sections by CATEGORY_META order
    const orderedKeys = CATEGORY_META
      .filter(c => map.has(c.src))
      .map(c => c.src)
    const extraKeys = [...map.keys()].filter(k => !CATEGORY_META.find(c => c.src === k))
    return [...orderedKeys, ...extraKeys].map(key => ({ key, items: map.get(key) }))
  }, [filtered, category, search])

  const activeOrder = orders.find(o => ACTIVE_STATUSES.includes(o.status))
  const selectedAddress = addresses.find(a => a.id === selectedAddrId)
  const completedOrders = orders.filter(o => o.status === 'served')
  const totalSpent = completedOrders.reduce((s, o) => s + Number(o.final_price || 0), 0)

  // ───────── RENDER STATES ─────────

  if (checkingAuth) {
    return (
      <div className="shop-loading">
        <div className="shop-splash-logo">🍽️</div>
      </div>
    )
  }

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
            <input className="shop-input" type="tel"
              placeholder={tr('phonePlaceholder')}
              value={regPhone} onChange={e => setRegPhone(e.target.value)} />
          </div>
          <input className="shop-input"
            placeholder={tr('firstName') + ' *'}
            value={regFirst} onChange={e => setRegFirst(e.target.value)} />
          <input className="shop-input"
            placeholder={tr('lastName')}
            value={regLast} onChange={e => setRegLast(e.target.value)} />
          <button className="shop-btn-primary shop-btn-full"
            onClick={doRegister} disabled={registering}>
            {registering
              ? <><Loader size={16} className="spin" /> {tr('checking')}</>
              : <>{tr('continue')} <Check size={16} /></>}
          </button>
          <p className="shop-fine-print">{tr('registerNote')}</p>
        </div>
      </div>
    )
  }

  if (view === 'success') {
    return (
      <div className="shop-success">
        <div className="shop-success-emoji">✅</div>
        <h1>{tr('orderAccepted')}</h1>
        <div className="shop-success-code">#{orderCode}</div>
        <p>{tr('weWillCall')}</p>
        <div className="shop-success-actions">
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

  if (view === 'checkout') {
    const finalPrice = promoCheck && promoCheck.valid ? promoCheck.final_price : cartTotal
    return (
      <div className="shop-page">
        <header className="shop-header-simple">
          <button className="shop-icon-btn" onClick={() => setView('home')}>
            <ChevronLeft size={22} />
          </button>
          <h1>{tr('checkout')}</h1>
        </header>

        <div className="shop-checkout">
          <div className="shop-section">
            <h3 className="shop-section-title"><ShoppingBag size={16} /> {tr('cartItems')} <span className="shop-pill">{cartCount}</span></h3>
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

          <div className="shop-section">
            <h3 className="shop-section-title">{tr('delivery')}</h3>
            <div className="shop-toggle">
              <button className={`shop-toggle-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}>
                <Truck size={18} /><span>{tr('deliveryNow')}</span>
              </button>
              <button className={`shop-toggle-btn ${deliveryType === 'pickup' ? 'active' : ''}`}
                onClick={() => setDeliveryType('pickup')}>
                <Store size={18} /><span>{tr('pickup')}</span>
              </button>
            </div>

            {deliveryType === 'delivery' && (
              <>
                {addresses.length > 0 ? (
                  <div className="shop-addresses">
                    {addresses.map(a => (
                      <label key={a.id} className={`shop-addr ${selectedAddrId === a.id ? 'selected' : ''}`}>
                        <input type="radio" name="addr"
                          checked={selectedAddrId === a.id}
                          onChange={() => setSelectedAddrId(a.id)} />
                        <div className="shop-addr-body">
                          <div className="shop-addr-label"><MapPin size={14} /> {a.label}</div>
                          <div className="shop-addr-text">{a.address}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="shop-muted">{tr('noAddresses')}</p>
                )}

                {!showAddAddr ? (
                  <button className="shop-btn-secondary" onClick={() => setShowAddAddr(true)}>
                    <Plus size={16} /> {tr('addNewAddress')}
                  </button>
                ) : (
                  <div className="shop-addr-form">
                    <input className="shop-input"
                      placeholder={tr('addrLabelPlaceholder')}
                      value={addrLabel} onChange={e => setAddrLabel(e.target.value)} />
                    <input className="shop-input"
                      placeholder={tr('addrTextPlaceholder')}
                      value={newAddrText} onChange={e => setNewAddrText(e.target.value)} />
                    <button className="shop-btn-secondary" onClick={getLocation} disabled={locating}>
                      {locating
                        ? <><Loader size={16} className="spin" /> {tr('locating')}</>
                        : <><MapPin size={16} /> {coords ? tr('locationFetched') : tr('getLocation')}</>}
                    </button>
                    {coords && (
                      <div className="shop-coords">📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</div>
                    )}
                    <div className="shop-addr-form-actions">
                      <button className="shop-btn-ghost"
                        onClick={() => { setShowAddAddr(false); setNewAddrText(''); setCoords(null) }}>
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

          <div className="shop-section">
            <h3 className="shop-section-title">🎟️ {tr('promoCode')}</h3>
            <div className="shop-promo-row">
              <input className="shop-input shop-input-promo"
                placeholder={tr('promoCode')}
                value={promoInput}
                onChange={e => setPromoInput(e.target.value.toUpperCase())} />
              {promoChecking && <Loader size={16} className="spin shop-promo-loader" />}
            </div>
            {promoCheck && promoCheck.valid && (
              <div className="shop-promo-ok">
                <Check size={14} />
                <span>{tr('promoApplied')}</span>
                <strong>−{fmt(promoCheck.discount_value)} {tr('sum')}</strong>
              </div>
            )}
            {promoCheck && !promoCheck.valid && promoCheck.error && (
              <div className="shop-promo-err">{promoCheck.error}</div>
            )}
          </div>

          {promoCheck && promoCheck.valid && promoCheck.discount_value > 0 && (
            <div className="shop-section shop-price-summary">
              <div className="shop-summary-row">
                <span>{tr('total')}</span>
                <span className="shop-strike">{fmt(cartTotal)} {tr('sum')}</span>
              </div>
              <div className="shop-summary-row shop-summary-discount">
                <span>🎟️ {promoCheck.label || tr('promoApplied')}</span>
                <span>−{fmt(promoCheck.discount_value)} {tr('sum')}</span>
              </div>
              <div className="shop-summary-total shop-summary-final">
                <span>✓</span>
                <span>{fmt(promoCheck.final_price)} {tr('sum')}</span>
              </div>
            </div>
          )}

          <div className="shop-section">
            <textarea className="shop-input shop-textarea" rows={2}
              placeholder={tr('note')}
              value={note} onChange={e => setNote(e.target.value)} />
          </div>

          <button className="shop-btn-primary shop-btn-checkout"
            onClick={submitOrder} disabled={submitting}>
            {submitting
              ? <><Loader size={18} className="spin" /> {tr('sending')}</>
              : <><Check size={18} /> {tr('placeOrder')} · {fmt(finalPrice)} {tr('sum')}</>}
          </button>
        </div>
      </div>
    )
  }

  // ───────── MAIN APP ─────────

  const renderItemCard = (item) => {
    const cartItem = inCart(item.id)
    const fallback = categoryMeta(item.category).emoji
    const hasImage = item.image_url && !imgErrors[item.id]
    return (
      <article key={item.id} className="shop-card"
        onClick={() => !cartItem && addToCart(item)}>
        <div className="shop-card-img-wrap">
          {hasImage ? (
            <img src={item.image_url} alt={item.name}
              className="shop-card-img-real" loading="lazy"
              onError={() => setImgErrors(p => ({ ...p, [item.id]: true }))} />
          ) : (
            <div className="shop-card-img-empty">{fallback}</div>
          )}
        </div>
        <div className="shop-card-body">
          <h3 className="shop-card-title">{item.name}</h3>
          {item.description && <p className="shop-card-desc">{item.description}</p>}
          <div className="shop-card-footer">
            <span className="shop-price">{fmt(item.price)} <small>{tr('sum')}</small></span>
            {cartItem ? (
              <div className="shop-qty" onClick={e => e.stopPropagation()}>
                <button onClick={() => decQty(item.id)}><Minus size={14} /></button>
                <span>{cartItem.qty}</span>
                <button onClick={() => incQty(item.id)}><Plus size={14} /></button>
              </div>
            ) : (
              <button className="shop-add" onClick={(e) => { e.stopPropagation(); addToCart(item) }}>
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>
      </article>
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
                <p className="shop-greeting">{tr('helloPrefix')}, {customer.first_name} 👋</p>
                <h1>{tr('appName')}</h1>
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

          {activeOrder && (
            <div className="shop-active-banner" onClick={() => setTab('orders')}>
              <div className="shop-active-banner-head">
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
            <input placeholder={tr('searchPlaceholder')}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>

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

          {loadingMenu && menu.length === 0 ? (
            <div className="shop-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="shop-card shop-card-skeleton">
                  <div className="shop-card-img-wrap shop-skel"></div>
                  <div className="shop-card-body">
                    <div className="shop-skel-line"></div>
                    <div className="shop-skel-line shop-skel-line-short"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="shop-empty">
              <div className="shop-empty-emoji">🍽️</div>
              <h2>{tr('emptyCategory')}</h2>
            </div>
          ) : grouped ? (
            <div className="shop-sections">
              {grouped.map(g => {
                const meta = categoryMeta(g.key)
                return (
                  <section key={g.key} className="shop-section-group">
                    <h2 className="shop-section-h"><span>{meta.emoji}</span> {tr(meta.key)}</h2>
                    <div className="shop-grid">
                      {g.items.map(renderItemCard)}
                    </div>
                  </section>
                )
              })}
            </div>
          ) : (
            <div className="shop-grid">{filtered.map(renderItemCard)}</div>
          )}

          {cartCount > 0 && (
            <button className="shop-cart-fab" onClick={() => setView('checkout')}>
              <ShoppingCart size={22} />
              <span className="shop-cart-fab-count">{cartCount}</span>
              <span className="shop-cart-fab-total">{fmt(cartTotal)} {tr('sum')}</span>
              <ChevronRight size={20} />
            </button>
          )}
        </>
      )}

      {/* TAB: ORDERS */}
      {tab === 'orders' && (
        <>
          <header className="shop-header">
            <h1>📋 {tr('myOrders')}</h1>
          </header>
          {loadingOrders && orders.length === 0 ? (
            <div className="shop-orders">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="shop-order shop-skel" style={{ height: 140 }}></div>
              ))}
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
                const theme = STATUS_THEME[o.status] || STATUS_THEME.pending
                const isActive = ACTIVE_STATUSES.includes(o.status)
                const canCancel = CANCELLABLE.includes(o.status)
                return (
                  <div key={o.id} className={`shop-order ${isActive ? 'shop-order-active' : ''}`}>
                    <div className="shop-order-head">
                      <div>
                        <div className="shop-order-code">#{o.order_code}</div>
                        <div className="shop-order-date">{fmtDate(o.created_at)}</div>
                      </div>
                      <span className="shop-status" style={{ background: theme.bg, color: theme.color }}>
                        <span className="shop-status-dot" style={{ background: theme.dot }} />
                        {tr(statusKey(o.status))}
                      </span>
                    </div>

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
                      <span className="shop-order-delivery">
                        {o.delivery_type === 'delivery'
                          ? <><Truck size={13} /> {tr('deliveryNow')}</>
                          : <><Store size={13} /> {tr('pickup')}</>}
                      </span>
                      <span className="shop-order-total">{fmt(o.final_price)} {tr('sum')}</span>
                    </div>
                    {canCancel && (
                      <button className="shop-order-cancel-btn" onClick={() => openCancel(o.order_code)}>
                        <X size={14} /> {tr('cancelOrder')}
                      </button>
                    )}
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
            <h1>👤 {tr('profile')}</h1>
          </header>
          <div className="shop-profile">
            <div className="shop-section">
              <div className="shop-profile-card">
                <div className="shop-profile-avatar">
                  {customer.first_name[0]?.toUpperCase()}
                </div>
                <div className="shop-profile-info">
                  <div className="shop-profile-name">{customer.first_name} {customer.last_name}</div>
                  <div className="shop-profile-phone"><Phone size={12} /> {customer.phone}</div>
                </div>
              </div>
            </div>

            <div className="shop-stats">
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#FED7AA', color: '#9A3412' }}>
                  <ShoppingBag size={18} />
                </div>
                <div className="shop-stat-value">{orders.length}</div>
                <div className="shop-stat-label">{tr('totalOrders')}</div>
              </div>
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#D1FAE5', color: '#065F46' }}>
                  <Sparkles size={18} />
                </div>
                <div className="shop-stat-value">{fmt(totalSpent)}</div>
                <div className="shop-stat-label">{tr('totalSpent')}</div>
              </div>
              <div className="shop-stat">
                <div className="shop-stat-icon" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
                  <Star size={18} />
                </div>
                <div className="shop-stat-value">{fmtJoin(customer.created_at)}</div>
                <div className="shop-stat-label">{tr('joinedOn')}</div>
              </div>
            </div>

            <div className="shop-section">
              <h3 className="shop-section-title"><Globe2 size={16} /> {tr('language')}</h3>
              <div className="shop-lang-row">
                {LANGS.map(l => (
                  <button key={l.code} type="button" onClick={() => changeLang(l.code)}
                    className={`shop-lang-card ${lang === l.code ? 'active' : ''}`}>
                    <span className="shop-lang-card-flag">{l.flag}</span>
                    <span>{l.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="shop-section">
              <h3 className="shop-section-title"><MapPin size={16} /> {tr('myAddresses')}</h3>
              {addresses.length === 0 ? (
                <p className="shop-muted">{tr('noAddrsProfile')}</p>
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

            <div className="shop-section shop-section-list">
              <button className="shop-list-row" onClick={() => window.open('tel:+998901234567')}>
                <div className="shop-list-icon" style={{ background: '#FEF3C7', color: '#92400E' }}>
                  <Phone size={16} />
                </div>
                <div className="shop-list-text">{tr('helpSupport')}</div>
                <ChevronRight size={16} color="#9CA3AF" />
              </button>
              <button className="shop-list-row" onClick={() => toast(`${tr('appName')} v1.0`)}>
                <div className="shop-list-icon" style={{ background: '#DBEAFE', color: '#1E40AF' }}>
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

      <nav className="shop-bottom-nav">
        <button className={`shop-nav-item ${tab === 'menu' ? 'active' : ''}`} onClick={() => setTab('menu')}>
          <HomeIcon size={22} /><span>{tr('tabMenu')}</span>
        </button>
        <button className={`shop-nav-item ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
          <ClipboardList size={22} /><span>{tr('tabOrders')}</span>
          {orders.some(o => ACTIVE_STATUSES.includes(o.status)) && <span className="shop-nav-dot" />}
        </button>
        <button className={`shop-nav-item ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>
          <UserCircle size={22} /><span>{tr('tabProfile')}</span>
        </button>
      </nav>

      {/* CANCEL ORDER MODAL */}
      {cancelOrderCode && (
        <div className="shop-modal-overlay" onClick={closeCancel}>
          <div className="shop-modal" onClick={e => e.stopPropagation()}>
            <div className="shop-modal-icon">
              <AlertTriangle size={28} />
            </div>
            <h3>{tr('cancelConfirm')}</h3>
            <p className="shop-modal-sub">#{cancelOrderCode}</p>
            <textarea className="shop-input shop-textarea"
              rows={3}
              placeholder={tr('cancelReasonPh')}
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)} />
            <div className="shop-modal-actions">
              <button className="shop-btn-ghost" onClick={closeCancel} disabled={cancelling}>
                {tr('keepOrder')}
              </button>
              <button className="shop-btn-danger" onClick={confirmCancel} disabled={cancelling}>
                {cancelling
                  ? <><Loader size={16} className="spin" /></>
                  : <><X size={16} /> {tr('cancelTitle')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
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
                <Icon size={compact ? 12 : 14} />
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
