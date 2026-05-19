import React, { useState, useEffect, useRef } from 'react'
import { menuAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Check,
  Loader, Camera, Image as ImageIcon, Upload,
} from 'lucide-react'
import '../Admin/AdminLayout.css'

const CATS = ['Основные блюда', 'Супы', 'Гриль', 'Выпечка', 'Напитки', 'Десерты']

const EMPTY_FORM = {
  name: '', description: '', price: '', cost_price: '',
  category: 'Основные блюда', image_url: '', available: true,
}

const fmt = v => Number(v || 0).toLocaleString()

// Browser-side image compression -> data URL (base64) to stay inside JSON payload.
// Mobile camera shots can be 5–10 MB; we resize to max 900px / 0.82 quality (~80–200 KB).
function fileToCompressedDataURL(file, maxSize = 900, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        let { width, height } = img
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width); width = maxSize
        } else if (height > maxSize) {
          width = Math.round(width * maxSize / height); height = maxSize
        }
        const canvas = document.createElement('canvas')
        canvas.width = width; canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function AdminMenu() {
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)

  const galleryInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const r = await menuAPI.getAll(); setMenu(r.data) }
    catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const openModal = (item = null) => {
    setEditing(item)
    if (item) {
      setForm({
        name: item.name, description: item.description || '',
        price: item.price, cost_price: item.cost_price || 0,
        category: item.category, image_url: item.image_url || '',
        available: item.available,
      })
    } else {
      setForm(EMPTY_FORM)
    }
    setModal(true)
  }

  const closeModal = () => { setModal(false); setEditing(null); setSaving(false) }

  const handleImageFile = async (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Расм танланг'); return }
    setImageBusy(true)
    try {
      const dataUrl = await fileToCompressedDataURL(file)
      setForm(p => ({ ...p, image_url: dataUrl }))
    } catch { toast.error('Расм юкланмади') }
    finally { setImageBusy(false) }
  }

  const cost = parseFloat(form.cost_price) || 0
  const sale = parseFloat(form.price) || 0
  const profit = sale - cost
  const marginPct = sale > 0 ? ((profit / sale) * 100).toFixed(1) : 0

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        name: form.name,
        description: form.description,
        price: sale,
        cost_price: cost,
        category: form.category,
        image_url: form.image_url,
        available: form.available !== false,
      }
      if (editing) {
        await menuAPI.update(editing.id, data)
        toast.success('Янгиланди')
      } else {
        await menuAPI.create(data)
        toast.success('Янги таом қўшилди')
      }
      await load()
      closeModal()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Хатолик')
    } finally { setSaving(false) }
  }

  const del = async (item) => {
    if (!window.confirm(`"${item.name}" ни ўчиришни тасдиқлайсизми?`)) return
    try {
      await menuAPI.delete(item.id)
      setMenu(m => m.filter(i => i.id !== item.id))
      toast.success('Ўчирилди')
    } catch { toast.error('Хатолик') }
  }

  const toggle = async (item) => {
    try {
      await menuAPI.toggleAvailability(item.id, !item.available)
      setMenu(m => m.map(i => i.id === item.id ? { ...i, available: !i.available } : i))
    } catch { toast.error('Хатолик') }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1>🍜 Меню бошқаруви</h1>
          <p>{menu.length} та таом</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => openModal()}>
          <Plus size={16} /> Янги таом
        </button>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }}>
          {menu.map(item => {
            const itemCost = Number(item.cost_price || 0)
            const itemProfit = Number(item.price || 0) - itemCost
            return (
              <div key={item.id} className="adm-card" style={{ opacity: item.available ? 1 : 0.6, padding: 0, overflow: 'hidden' }}>
                {item.image_url && (
                  <div style={{ width: '100%', height: 140, background: '#F3F4F6', overflow: 'hidden' }}>
                    <img src={item.image_url} alt={item.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="adm-badge adm-badge-orange" style={{ fontSize: 11 }}>{item.category}</span>
                    <button onClick={() => toggle(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                      {item.available ? <ToggleRight size={24} color="#10B981" /> : <ToggleLeft size={24} color="#9CA3AF" />}
                    </button>
                  </div>

                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', margin: '0 0 5px' }}>{item.name}</h3>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 10px', lineHeight: 1.4, minHeight: 32 }}>
                    {item.description || '—'}
                  </p>

                  {itemCost > 0 && (
                    <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '7px 10px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: '#6B7280' }}>Келган нарх: <b style={{ color: '#374151' }}>{fmt(itemCost)} сум</b></span>
                      {itemProfit > 0 && (
                        <span style={{ color: '#10B981', fontWeight: 700 }}>+{fmt(itemProfit)}</span>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{fmt(item.price)} сум</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => openModal(item)}
                        style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Edit2 size={14} color="#374151" />
                      </button>
                      <button onClick={() => del(item)}
                        style={{ padding: '6px 10px', borderRadius: 7, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Trash2 size={14} color="#EF4444" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── ADD/EDIT MODAL ────────────────────────────── */}
      {modal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{
            background: 'white', borderRadius: 18, width: '100%', maxWidth: 540,
            maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {editing ? '✏️ Таомни таҳрирлаш' : '🍽️ Янги таом қўшиш'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, borderRadius: 6, display: 'flex' }}>
                <X size={22} />
              </button>
            </div>

            <form onSubmit={save} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>

                {/* Image */}
                <div className="adm-field">
                  <label className="adm-label">Расм</label>
                  {form.image_url ? (
                    <div style={{ position: 'relative', marginBottom: 10 }}>
                      <img src={form.image_url} alt="preview"
                        style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 10, border: '1.5px solid #E5E7EB' }} />
                      <button type="button" onClick={() => setForm(p => ({ ...p, image_url: '' }))}
                        style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)', border: 'none', color: 'white', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div style={{
                      width: '100%', height: 140, borderRadius: 10,
                      border: '2px dashed #E5E7EB', background: '#FAFAFA',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#9CA3AF', fontSize: 13, marginBottom: 10,
                    }}>
                      {imageBusy ? (
                        <><Loader size={18} style={{ animation: 'adm-spin 0.7s linear infinite', marginRight: 6 }} /> Юкланмоқда...</>
                      ) : (
                        <><ImageIcon size={18} style={{ marginRight: 6 }} /> Расм танланмаган</>
                      )}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button"
                      onClick={() => cameraInputRef.current?.click()}
                      disabled={imageBusy}
                      style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: 'white', cursor: imageBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                      <Camera size={15} /> Camera
                    </button>
                    <button type="button"
                      onClick={() => galleryInputRef.current?.click()}
                      disabled={imageBusy}
                      style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: 'white', cursor: imageBusy ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}>
                      <Upload size={15} /> Галерея
                    </button>
                  </div>
                  <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = '' }} />
                  <input ref={galleryInputRef} type="file" accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => { handleImageFile(e.target.files?.[0]); e.target.value = '' }} />
                </div>

                {/* Basic info */}
                <div className="adm-field">
                  <label className="adm-label">Таом номи *</label>
                  <input className="adm-input" value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    required placeholder="Масалан: Палов" />
                </div>

                <div className="adm-field">
                  <label className="adm-label">Тавсиф</label>
                  <textarea className="adm-input" rows={3} value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    style={{ resize: 'vertical' }}
                    placeholder="Таом ҳақида қисқача маълумот..." />
                </div>

                <div className="adm-field">
                  <label className="adm-label">Категория</label>
                  <select className="adm-input" value={form.category}
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>

                {/* Prices */}
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 14 }}>
                  💰 Нарх
                </div>

                <div className="adm-form-row">
                  <div className="adm-field">
                    <label className="adm-label">Келган нархи *</label>
                    <input className="adm-input" type="number" step="1" min="0"
                      value={form.cost_price}
                      onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                      placeholder="Масалан: 25000" required />
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                      Маҳсулот таннархи (сум)
                    </div>
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">Сотиш нархи *</label>
                    <input className="adm-input" type="number" step="1" min="0"
                      value={form.price}
                      onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                      placeholder="Масалан: 40000" required />
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                      Сотув нархи (сум)
                    </div>
                  </div>
                </div>

                {cost > 0 && sale > 0 && (
                  <div style={{ background: profit >= 0 ? '#F0FDF4' : '#FEF2F2', border: `1.5px solid ${profit >= 0 ? '#BBF7D0' : '#FECACA'}`, borderRadius: 12, padding: '12px 14px', marginTop: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 13, color: profit >= 0 ? '#166534' : '#991B1B', fontWeight: 600 }}>
                        Фойда: {fmt(profit)} сум
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: profit >= 0 ? '#15803D' : '#B91C1C' }}>
                        {marginPct}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ padding: '16px 28px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA', borderRadius: '0 0 18px 18px' }}>
                <button type="button" className="adm-btn adm-btn-secondary" onClick={closeModal}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving || imageBusy}>
                  {saving ? <><Loader size={16} style={{ animation: 'adm-spin 0.7s linear infinite' }} /> Сақланмоқда...</> : <><Check size={16} /> {editing ? 'Сақлаш' : 'Қўшиш'}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
