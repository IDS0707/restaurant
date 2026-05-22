import React, { useState, useEffect } from 'react'
import { menuAPI, ordersAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  ShoppingCart, Plus, Minus, Trash2, X, Search,
  MapPin, Truck, Store, Phone, User, Check, Loader, ChevronLeft,
} from 'lucide-react'
import './ShopPage.css'

const fmt = v => Number(v || 0).toLocaleString()

export default function ShopPage() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem('shop_cart') || '[]') } catch { return [] }
  })
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [view, setView] = useState('menu') // 'menu' | 'checkout' | 'success'

  // Customer + delivery state (persist in localStorage so user doesn't re-type each time)
  const [first, setFirst] = useState(() => localStorage.getItem('shop_first') || '')
  const [last, setLast] = useState(() => localStorage.getItem('shop_last') || '')
  const [phone, setPhone] = useState(() => localStorage.getItem('shop_phone') || '')
  const [deliveryType, setDeliveryType] = useState(() => localStorage.getItem('shop_dtype') || 'delivery')
  const [address, setAddress] = useState(() => localStorage.getItem('shop_addr') || '')
  const [coords, setCoords] = useState(null) // {lat, lng}
  const [locating, setLocating] = useState(false)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [orderCode, setOrderCode] = useState('')

  useEffect(() => { loadMenu() }, [])
  useEffect(() => { localStorage.setItem('shop_cart', JSON.stringify(cart)) }, [cart])
  useEffect(() => { localStorage.setItem('shop_first', first) }, [first])
  useEffect(() => { localStorage.setItem('shop_last', last) }, [last])
  useEffect(() => { localStorage.setItem('shop_phone', phone) }, [phone])
  useEffect(() => { localStorage.setItem('shop_dtype', deliveryType) }, [deliveryType])
  useEffect(() => { localStorage.setItem('shop_addr', address) }, [address])

  const loadMenu = async () => {
    setLoading(true)
    try {
      const r = await menuAPI.getAll()
      setMenu(r.data.filter(m => m.available))
    } catch { toast.error("Menyu yuklanmadi") }
    finally { setLoading(false) }
  }

  const categories = ['all', ...new Set(menu.map(m => m.category))]
  const filtered = menu.filter(m => {
    const matchCat = category === 'all' || m.category === category
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

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
  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id))

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const cartCount = cart.reduce((s, c) => s + c.qty, 0)

  const getLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Brauzer joylashuvni qo'llab-quvvatlamaydi")
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        toast.success('Joylashuv olindi ✓')
        setLocating(false)
      },
      (err) => {
        let msg = 'Joylashuvni olib bo\'lmadi'
        if (err.code === 1) msg = 'Joylashuvga ruxsat berilmadi'
        else if (err.code === 2) msg = 'Joylashuv aniqlanmadi'
        else if (err.code === 3) msg = 'Joylashuv kuttirib qo\'ydi'
        toast.error(msg)
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }

  const submitOrder = async () => {
    if (cart.length === 0) { toast.error("Savat bo'sh"); return }
    if (!first.trim()) { toast.error("Ismni kiriting"); return }
    if (!phone.trim()) { toast.error("Telefon raqamingizni kiriting"); return }
    if (deliveryType === 'delivery' && !address.trim() && !coords) {
      toast.error("Yetkazib berish manzili kerak")
      return
    }

    setSubmitting(true)
    try {
      const res = await ordersAPI.create({
        items: cart.map(c => ({ menu_item_id: c.id, quantity: c.qty })),
        note,
        customer_first_name: first.trim(),
        customer_last_name: last.trim(),
        customer_phone: phone.trim(),
        delivery_type: deliveryType,
        delivery_address: deliveryType === 'delivery' ? address.trim() : '',
        delivery_lat: deliveryType === 'delivery' && coords ? coords.lat : undefined,
        delivery_lng: deliveryType === 'delivery' && coords ? coords.lng : undefined,
      })
      setOrderCode(res.data.order_code)
      setCart([])
      setNote('')
      setView('success')
    } catch (e) {
      toast.error(e?.response?.data?.error || "Buyurtma jo'natilmadi")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="shop-loading">
        <Loader size={40} className="spin" />
        <p>Yuklanmoqda...</p>
      </div>
    )
  }

  // SUCCESS view
  if (view === 'success') {
    return (
      <div className="shop-page">
        <div className="shop-success">
          <div className="shop-success-emoji">✅</div>
          <h1>Buyurtma qabul qilindi!</h1>
          <div className="shop-success-code">#{orderCode}</div>
          <p>Tez orada siz bilan bog'lanamiz</p>
          <button className="shop-btn-primary" onClick={() => { setView('menu'); setOrderCode('') }}>
            Yangi buyurtma
          </button>
        </div>
      </div>
    )
  }

  // CHECKOUT view
  if (view === 'checkout') {
    return (
      <div className="shop-page">
        <header className="shop-header">
          <button className="shop-icon-btn" onClick={() => setView('menu')}>
            <ChevronLeft size={22} />
          </button>
          <h1>Buyurtmani rasmiylashtirish</h1>
        </header>

        <div className="shop-checkout">
          {/* Cart summary */}
          <div className="shop-section">
            <h3>Savatdagi taomlar ({cartCount})</h3>
            {cart.map(c => (
              <div key={c.id} className="shop-summary-row">
                <span>{c.qty}× {c.name}</span>
                <span className="shop-summary-price">{fmt(c.price * c.qty)} so'm</span>
              </div>
            ))}
            <div className="shop-summary-total">
              <span>Jami</span>
              <span>{fmt(cartTotal)} so'm</span>
            </div>
          </div>

          {/* Customer info */}
          <div className="shop-section">
            <h3><User size={18} /> Aloqa ma'lumotlari</h3>
            <input
              className="shop-input"
              placeholder="Ism *"
              value={first}
              onChange={e => setFirst(e.target.value)}
            />
            <input
              className="shop-input"
              placeholder="Familiya"
              value={last}
              onChange={e => setLast(e.target.value)}
            />
            <div className="shop-input-with-icon">
              <Phone size={16} />
              <input
                className="shop-input"
                type="tel"
                placeholder="+998 XX XXX XX XX *"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          {/* Delivery type */}
          <div className="shop-section">
            <h3>Yetkazib berish</h3>
            <div className="shop-toggle">
              <button
                className={`shop-toggle-btn ${deliveryType === 'delivery' ? 'active' : ''}`}
                onClick={() => setDeliveryType('delivery')}
              >
                <Truck size={18} />
                <span>Yetkazib berish</span>
              </button>
              <button
                className={`shop-toggle-btn ${deliveryType === 'pickup' ? 'active' : ''}`}
                onClick={() => setDeliveryType('pickup')}
              >
                <Store size={18} />
                <span>Olib ketish</span>
              </button>
            </div>

            {deliveryType === 'delivery' && (
              <>
                <input
                  className="shop-input"
                  placeholder="Manzil (ko'cha, uy)"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                />
                <button
                  className="shop-btn-secondary"
                  onClick={getLocation}
                  disabled={locating}
                  style={{ marginTop: 8 }}
                >
                  {locating
                    ? <><Loader size={16} className="spin" /> Joylashuv aniqlanmoqda...</>
                    : <><MapPin size={16} /> {coords ? 'Joylashuv aniqlandi ✓ — qaytadan olish' : 'Joriy joylashuvni olish'}</>}
                </button>
                {coords && (
                  <div className="shop-coords">
                    📍 {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                    <a
                      href={`https://yandex.uz/maps/?ll=${coords.lng},${coords.lat}&z=17&pt=${coords.lng},${coords.lat}`}
                      target="_blank" rel="noreferrer"
                      style={{ marginLeft: 8, fontSize: 12 }}
                    >
                      Xaritada
                    </a>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Note */}
          <div className="shop-section">
            <textarea
              className="shop-input"
              rows={2}
              placeholder="Izoh (ixtiyoriy)"
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
              ? <><Loader size={18} className="spin" /> Jo'natilmoqda...</>
              : <><Check size={18} /> Buyurtma berish — {fmt(cartTotal)} so'm</>}
          </button>
        </div>
      </div>
    )
  }

  // MENU view (default)
  return (
    <div className="shop-page">
      <header className="shop-header">
        <h1>🍽️ ECO taomlar</h1>
        <p className="shop-subtitle">Tez va mazali</p>
      </header>

      <div className="shop-search">
        <Search size={16} />
        <input
          placeholder="Taom qidirish..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="shop-cats">
        {categories.map(c => (
          <button
            key={c}
            className={`shop-cat ${category === c ? 'active' : ''}`}
            onClick={() => setCategory(c)}
          >
            {c === 'all' ? 'Barchasi' : c}
          </button>
        ))}
      </div>

      <div className="shop-grid">
        {filtered.map(item => {
          const cartItem = inCart(item.id)
          return (
            <div key={item.id} className="shop-card" onClick={() => !cartItem && addToCart(item)}>
              {item.image_url && (
                <div className="shop-card-img" style={{ backgroundImage: `url(${item.image_url})` }} />
              )}
              {!item.image_url && (
                <div className="shop-card-img shop-card-img-empty">🍽️</div>
              )}
              <div className="shop-card-body">
                <h3>{item.name}</h3>
                <p>{item.description}</p>
                <div className="shop-card-footer">
                  <span className="shop-price">{fmt(item.price)} so'm</span>
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
        })}
      </div>

      {cartCount > 0 && (
        <button className="shop-cart-fab" onClick={() => setView('checkout')}>
          <ShoppingCart size={22} />
          <span className="shop-cart-fab-count">{cartCount}</span>
          <span className="shop-cart-fab-total">{fmt(cartTotal)} so'm</span>
        </button>
      )}
    </div>
  )
}
