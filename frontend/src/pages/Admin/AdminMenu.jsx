import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { menuAPI, inventoryAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  Plus, Edit2, Trash2, ToggleLeft, ToggleRight, X, Check,
  ChefHat, DollarSign, Percent, Loader, AlertTriangle,
} from 'lucide-react'
import '../Admin/AdminLayout.css'

const CATS = ['Основные блюда', 'Супы', 'Гриль', 'Выпечка', 'Напитки', 'Десерты']
const UNITS = ['g', 'kg', 'ml', 'liter', 'pcs', '10g']

const EMPTY_FORM = {
  name: '', description: '', price: '', markup_percent: 0,
  category: 'Основные блюда', image_url: '', available: true,
}
const EMPTY_ING = { ingredient_id: '', quantity_used: '', unit: 'g' }

const fmt = v => Number(v || 0).toLocaleString()

// Client-side unit conversion for cost preview
function calcIngCost(ing, quantity, unit) {
  const qty = parseFloat(quantity) || 0
  if (!ing || qty === 0) return 0
  const toG = { kg: 1000, g: 1, '10g': 10 }
  const toML = { liter: 1000, ml: 1 }
  const from = unit, to = ing.measurement_unit
  let converted = qty
  if (from !== to) {
    if (toG[from] && toG[to]) converted = qty * toG[from] / toG[to]
    else if (toML[from] && toML[to]) converted = qty * toML[from] / toML[to]
  }
  return converted * (ing.unit_price || 0)
}

export default function AdminMenu() {
  const navigate = useNavigate()

  // Menu list
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modal, setModal] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Recipe state inside modal
  const [allIngredients, setAllIngredients] = useState([])
  const [pendingRecipe, setPendingRecipe] = useState([])   // working recipe list
  const [originalRecipe, setOriginalRecipe] = useState([]) // original (for edit diff)
  const [addIngForm, setAddIngForm] = useState(EMPTY_ING)
  const [showAddIng, setShowAddIng] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const r = await menuAPI.getAll(); setMenu(r.data) }
    catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const openModal = async (item = null) => {
    setModalLoading(true)
    setModal(true)
    setEditing(item)
    setPendingRecipe([])
    setOriginalRecipe([])
    setAddIngForm(EMPTY_ING)
    setShowAddIng(false)

    if (item) {
      setForm({
        name: item.name, description: item.description || '',
        price: item.price, markup_percent: item.markup_percent || 0,
        category: item.category, image_url: item.image_url || '',
        available: item.available,
      })
    } else {
      setForm(EMPTY_FORM)
    }

    try {
      const requests = [inventoryAPI.getAll()]
      if (item) requests.push(menuAPI.getDetail(item.id))
      const results = await Promise.all(requests)
      setAllIngredients(results[0].data || [])
      if (item && results[1]) {
        const recipe = results[1].data.recipe || []
        setPendingRecipe(recipe.map(r => ({ ...r })))
        setOriginalRecipe(recipe.map(r => ({ ...r })))
      }
    } catch { toast.error('Маълумот юкланмади') }
    finally { setModalLoading(false) }
  }

  const closeModal = () => { setModal(false); setEditing(null); setSaving(false) }

  // Add ingredient to pending recipe
  const addToRecipe = () => {
    const ing = allIngredients.find(i => i.id === parseInt(addIngForm.ingredient_id))
    if (!ing) { toast.error('Ингредиент танланг'); return }
    const qty = parseFloat(addIngForm.quantity_used)
    if (!qty || qty <= 0) { toast.error('Миқдор киритинг'); return }
    if (pendingRecipe.some(r => r.ingredient_id === ing.id)) {
      toast.error('Бу ингредиент аллақачон рецептда мавжуд'); return
    }
    const cost = calcIngCost(ing, addIngForm.quantity_used, addIngForm.unit)
    setPendingRecipe(p => [...p, {
      id: null,
      ingredient_id: ing.id,
      ingredient_name: ing.name,
      quantity_used: qty,
      unit: addIngForm.unit,
      ingredient_unit: ing.measurement_unit,
      unit_price: ing.unit_price,
      cost,
    }])
    setAddIngForm(EMPTY_ING)
    setShowAddIng(false)
  }

  // Update quantity/unit of an ingredient already in recipe
  const updateRecipeRow = (ingredientId, field, value) => {
    setPendingRecipe(p => p.map(r => {
      if (r.ingredient_id !== ingredientId) return r
      const updated = { ...r, [field]: field === 'quantity_used' ? (parseFloat(value) || 0) : value }
      const ing = allIngredients.find(i => i.id === ingredientId)
      updated.cost = calcIngCost(ing, updated.quantity_used, updated.unit)
      return updated
    }))
  }

  const removeFromRecipe = (ingredientId) => {
    setPendingRecipe(p => p.filter(r => r.ingredient_id !== ingredientId))
  }

  const foodCost = pendingRecipe.reduce((s, r) => s + (r.cost || 0), 0)
  const markup = parseFloat(form.markup_percent) || 0
  const salePrice = markup > 0 && foodCost > 0
    ? foodCost * (1 + markup / 100)
    : parseFloat(form.price) || 0
  const profitAmount = salePrice - foodCost
  const marginPct = salePrice > 0 ? ((profitAmount / salePrice) * 100).toFixed(1) : 0

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const finalPrice = markup > 0 && foodCost > 0 ? salePrice : parseFloat(form.price) || 0
      const data = {
        name: form.name,
        description: form.description,
        price: finalPrice,
        category: form.category,
        image_url: form.image_url,
        available: form.available !== false,
      }

      let menuItemId

      if (editing) {
        await menuAPI.update(editing.id, data)
        menuItemId = editing.id

        if (markup !== (editing.markup_percent || 0)) {
          await menuAPI.updateMarkup(menuItemId, markup)
        }

        // Delete removed recipe items
        const removed = originalRecipe.filter(
          orig => !pendingRecipe.some(p => p.ingredient_id === orig.ingredient_id)
        )
        for (const r of removed) {
          if (r.id) await menuAPI.deleteRecipeItem(r.id)
        }

        // Update changed items (delete + re-add)
        const changed = pendingRecipe.filter(p => {
          const orig = originalRecipe.find(o => o.ingredient_id === p.ingredient_id)
          return orig && (orig.quantity_used !== p.quantity_used || orig.unit !== p.unit)
        })
        for (const c of changed) {
          const orig = originalRecipe.find(o => o.ingredient_id === c.ingredient_id)
          if (orig?.id) await menuAPI.deleteRecipeItem(orig.id)
          await menuAPI.addRecipeItem(menuItemId, {
            ingredient_id: c.ingredient_id, quantity_used: c.quantity_used, unit: c.unit,
          })
        }

        // Add brand new items
        const newItems = pendingRecipe.filter(
          p => !originalRecipe.some(o => o.ingredient_id === p.ingredient_id)
        )
        for (const n of newItems) {
          await menuAPI.addRecipeItem(menuItemId, {
            ingredient_id: n.ingredient_id, quantity_used: n.quantity_used, unit: n.unit,
          })
        }

        toast.success('Янгиланди')
      } else {
        const res = await menuAPI.create(data)
        menuItemId = res.data.id

        if (markup > 0) await menuAPI.updateMarkup(menuItemId, markup)

        for (const n of pendingRecipe) {
          await menuAPI.addRecipeItem(menuItemId, {
            ingredient_id: n.ingredient_id, quantity_used: n.quantity_used, unit: n.unit,
          })
        }
        toast.success('Янги таом қўшилди')
      }

      await load()
      closeModal()
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Хатолик')
    }
    finally { setSaving(false) }
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

  const selectedIng = allIngredients.find(i => i.id === parseInt(addIngForm.ingredient_id))
  const usedIngIds = new Set(pendingRecipe.map(r => r.ingredient_id))
  const availableIngs = allIngredients.filter(i => !usedIngIds.has(i.id))

  return (
    <div>
      {/* Header */}
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
          {menu.map(item => (
            <div key={item.id} className="adm-card" style={{ opacity: item.available ? 1 : 0.6 }}>
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

              {/* Cost strip */}
              {item.food_cost > 0 && (
                <div style={{ background: '#F9FAFB', borderRadius: 8, padding: '7px 10px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: '#6B7280' }}>Таннарх: <b style={{ color: '#374151' }}>{fmt(item.food_cost)} сум</b></span>
                  {item.markup_percent > 0 && (
                    <span style={{ color: '#10B981', fontWeight: 700 }}>+{item.markup_percent}%</span>
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
          ))}
        </div>
      )}

      {/* ─── EXPANDED ADD/EDIT MODAL ────────────────────────────── */}
      {modal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={{
            background: 'white', borderRadius: 18, width: '100%', maxWidth: 860,
            maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}>
            {/* Modal header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #F3F4F6' }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>
                {editing ? '✏️ Таомни таҳрирлаш' : '🍽️ Янги таом қўшиш'}
              </h2>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, borderRadius: 6, display: 'flex' }}>
                <X size={22} />
              </button>
            </div>

            {modalLoading ? (
              <div className="adm-loading" style={{ flex: 1 }}>
                <div className="adm-spinner" /><span>Юкланмоқда...</span>
              </div>
            ) : (
              <form onSubmit={save} style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

                    {/* ── LEFT: Basic info ────────────────────── */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14 }}>
                        📋 Асосий маълумот
                      </div>

                      <div className="adm-field">
                        <label className="adm-label">Таом номи *</label>
                        <input className="adm-input" value={form.name}
                          onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                          required placeholder="Масалан: Паlov" />
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

                      <div className="adm-field">
                        <label className="adm-label">Расм URL (ихтиёрий)</label>
                        <input className="adm-input" value={form.image_url}
                          onChange={e => setForm(p => ({ ...p, image_url: e.target.value }))}
                          placeholder="https://..." />
                      </div>

                      {/* Markup + price */}
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 14, marginTop: 8 }}>
                        💰 Нарх ва наценка
                      </div>

                      <div className="adm-form-row">
                        <div className="adm-field">
                          <label className="adm-label">Наценка % *</label>
                          <input className="adm-input" type="number" step="0.1" min="0" max="1000"
                            value={form.markup_percent}
                            onChange={e => setForm(p => ({ ...p, markup_percent: e.target.value }))}
                            placeholder="Масалан: 40" />
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                            Таннарх × (1 + %)
                          </div>
                        </div>
                        <div className="adm-field">
                          <label className="adm-label">
                            {markup > 0 && foodCost > 0 ? 'Сотиш нарх (авто)' : 'Сотиш нарх (қўлда) *'}
                          </label>
                          <input className="adm-input"
                            type="number" step="1" min="0"
                            value={markup > 0 && foodCost > 0 ? Math.round(salePrice) : form.price}
                            onChange={e => setForm(p => ({ ...p, price: e.target.value }))}
                            readOnly={markup > 0 && foodCost > 0}
                            style={{ background: markup > 0 && foodCost > 0 ? '#F9FAFB' : 'white' }}
                            required />
                        </div>
                      </div>

                      {/* Cost summary */}
                      {foodCost > 0 && (
                        <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 12, padding: '14px 16px', marginTop: 4 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                            <span style={{ fontSize: 12, color: '#6B7280' }}>Таннарх (Food Cost)</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{fmt(foodCost)} сум</span>
                          </div>
                          {markup > 0 && (
                            <>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                <span style={{ fontSize: 12, color: '#6B7280' }}>Наценка {markup}%</span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#FF6B35' }}>+{fmt(profitAmount)} сум</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid #BBF7D0' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#166534' }}>Сотиш нарх</span>
                                <span style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>{fmt(Math.round(salePrice))} сум</span>
                              </div>
                              <div style={{ marginTop: 10, background: '#DCFCE7', borderRadius: 8, padding: '7px 10px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                                  <span style={{ fontSize: 11, color: '#166534', fontWeight: 600 }}>Margin: {marginPct}%</span>
                                </div>
                                <div style={{ background: '#BBF7D0', borderRadius: 100, height: 6 }}>
                                  <div style={{ height: '100%', background: '#16A34A', borderRadius: 100, width: `${Math.min(100, marginPct)}%` }} />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}

                      {foodCost === 0 && markup > 0 && (
                        <div style={{ background: '#FEF3C7', borderRadius: 9, padding: '10px 12px', fontSize: 12, color: '#92400E', marginTop: 4 }}>
                          <AlertTriangle size={12} style={{ display: 'inline', marginRight: 4 }} />
                          Рецепт қўшинг — наценка ишлаши учун ингредиентлар керак
                        </div>
                      )}
                    </div>

                    {/* ── RIGHT: Recipe editor ─────────────────── */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          🧾 Рецептура ({pendingRecipe.length} та ингредиент)
                        </div>
                        {allIngredients.length === 0 && (
                          <button type="button" onClick={() => navigate('/admin/inventory')}
                            style={{ fontSize: 11, color: '#2563EB', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                            Омборни очиш
                          </button>
                        )}
                      </div>

                      {allIngredients.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px 16px', background: '#F9FAFB', borderRadius: 12, border: '2px dashed #E5E7EB' }}>
                          <ChefHat size={32} color="#D1D5DB" style={{ marginBottom: 8 }} />
                          <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 12px' }}>
                            Омборда ингредиент йўқ
                          </p>
                          <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm"
                            onClick={() => { closeModal(); navigate('/admin/inventory') }}>
                            + Ингредиент қўшиш
                          </button>
                        </div>
                      ) : (
                        <>
                          {/* Recipe table */}
                          {pendingRecipe.length > 0 && (
                            <div style={{ marginBottom: 12, border: '1px solid #F3F4F6', borderRadius: 10, overflow: 'hidden' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: '#F9FAFB' }}>
                                    <th style={{ padding: '8px 12px', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', textAlign: 'left' }}>ИНГРЕДИЕНТ</th>
                                    <th style={{ padding: '8px 8px', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', width: 72 }}>МИҚДОР</th>
                                    <th style={{ padding: '8px 8px', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', textAlign: 'center', width: 64 }}>БИРЛИК</th>
                                    <th style={{ padding: '8px 8px', fontSize: 10, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', textAlign: 'right', width: 80 }}>ХАРАЖАТ</th>
                                    <th style={{ width: 32 }}></th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {pendingRecipe.map(r => (
                                    <tr key={r.ingredient_id} style={{ borderTop: '1px solid #F3F4F6' }}>
                                      <td style={{ padding: '8px 12px' }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{r.ingredient_name}</div>
                                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>омборда: {r.ingredient_unit}</div>
                                      </td>
                                      <td style={{ padding: '6px 6px' }}>
                                        <input
                                          type="number" step="0.001" min="0.001"
                                          value={r.quantity_used}
                                          onChange={e => updateRecipeRow(r.ingredient_id, 'quantity_used', e.target.value)}
                                          style={{
                                            width: '100%', padding: '5px 6px', border: '1.5px solid #E5E7EB',
                                            borderRadius: 7, fontSize: 13, fontFamily: 'Inter, sans-serif',
                                            textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                                          }}
                                          onFocus={e => e.target.style.borderColor = '#FF6B35'}
                                          onBlur={e => e.target.style.borderColor = '#E5E7EB'}
                                        />
                                      </td>
                                      <td style={{ padding: '6px 6px' }}>
                                        <select
                                          value={r.unit}
                                          onChange={e => updateRecipeRow(r.ingredient_id, 'unit', e.target.value)}
                                          style={{
                                            width: '100%', padding: '5px 4px', border: '1.5px solid #E5E7EB',
                                            borderRadius: 7, fontSize: 12, fontFamily: 'Inter, sans-serif',
                                            outline: 'none', background: 'white',
                                          }}>
                                          {UNITS.map(u => <option key={u}>{u}</option>)}
                                        </select>
                                      </td>
                                      <td style={{ padding: '8px 8px', textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#374151', whiteSpace: 'nowrap' }}>
                                        {fmt(Math.round(r.cost))}
                                      </td>
                                      <td style={{ padding: '8px 6px' }}>
                                        <button type="button" onClick={() => removeFromRecipe(r.ingredient_id)}
                                          style={{ padding: '4px', borderRadius: 6, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                          <X size={12} color="#EF4444" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                                {pendingRecipe.length > 0 && (
                                  <tfoot>
                                    <tr style={{ background: '#F9FAFB', borderTop: '2px solid #F3F4F6' }}>
                                      <td colSpan={3} style={{ padding: '8px 12px', fontSize: 12, fontWeight: 700, color: '#374151' }}>Жами таннарх</td>
                                      <td style={{ padding: '8px 8px', fontSize: 13, fontWeight: 800, color: '#111827', textAlign: 'right' }}>{fmt(Math.round(foodCost))}</td>
                                      <td />
                                    </tr>
                                  </tfoot>
                                )}
                              </table>
                            </div>
                          )}

                          {/* Add ingredient row */}
                          {showAddIng ? (
                            <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, border: '1.5px dashed #E5E7EB' }}>
                              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                                Ингредиент қўшиш
                              </div>
                              <div className="adm-field" style={{ marginBottom: 8 }}>
                                <select className="adm-input" value={addIngForm.ingredient_id}
                                  onChange={e => {
                                    const ing = allIngredients.find(i => i.id === parseInt(e.target.value))
                                    setAddIngForm(p => ({ ...p, ingredient_id: e.target.value, unit: ing?.measurement_unit || 'g' }))
                                  }}>
                                  <option value="">— Ингредиент танланг —</option>
                                  {availableIngs.map(ing => (
                                    <option key={ing.id} value={ing.id}>
                                      {ing.name} ({ing.quantity} {ing.measurement_unit})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {selectedIng && (
                                <div style={{ fontSize: 11, color: '#2563EB', background: '#EFF6FF', borderRadius: 7, padding: '5px 10px', marginBottom: 8 }}>
                                  Нарх: {fmt(selectedIng.unit_price)} сум/{selectedIng.measurement_unit}
                                </div>
                              )}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: 8, marginBottom: 8 }}>
                                <div>
                                  <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>МИҚДОР (1 ПОРЦИЯ)</label>
                                  <input className="adm-input" type="number" step="0.001" min="0"
                                    value={addIngForm.quantity_used}
                                    onChange={e => setAddIngForm(p => ({ ...p, quantity_used: e.target.value }))}
                                    placeholder="300" />
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>БИРЛИК</label>
                                  <select className="adm-input" value={addIngForm.unit}
                                    onChange={e => setAddIngForm(p => ({ ...p, unit: e.target.value }))}>
                                    {UNITS.map(u => <option key={u}>{u}</option>)}
                                  </select>
                                </div>
                                <div>
                                  <label style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, display: 'block', marginBottom: 4 }}>ХАРАЖАТ</label>
                                  <div style={{ height: 41, display: 'flex', alignItems: 'center', fontSize: 13, fontWeight: 700, color: '#10B981' }}>
                                    {selectedIng ? `${fmt(Math.round(calcIngCost(selectedIng, addIngForm.quantity_used, addIngForm.unit)))}` : '—'}
                                  </div>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button type="button" onClick={() => { setShowAddIng(false); setAddIngForm(EMPTY_ING) }}
                                  className="adm-btn adm-btn-secondary adm-btn-sm">Бекор</button>
                                <button type="button" onClick={addToRecipe}
                                  className="adm-btn adm-btn-primary adm-btn-sm">
                                  <Plus size={14} /> Қўшиш
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setShowAddIng(true)}
                              style={{
                                width: '100%', padding: '10px', borderRadius: 10,
                                border: '2px dashed #E5E7EB', background: '#FAFAFA',
                                cursor: 'pointer', fontSize: 13, color: '#6B7280',
                                fontFamily: 'Inter, sans-serif', fontWeight: 600,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                transition: 'all 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF6B35'; e.currentTarget.style.color = '#FF6B35' }}
                              onMouseLeave={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#6B7280' }}
                            >
                              <Plus size={14} />
                              {pendingRecipe.length === 0 ? 'Рецептга ингредиент қўшиш' : 'Яна ингредиент қўшиш'}
                            </button>
                          )}

                          {pendingRecipe.length === 0 && !showAddIng && (
                            <div style={{ textAlign: 'center', padding: '20px 0', color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>
                              Рецепт бўш — таом таннархи 0 сум ҳисобланади
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Modal footer */}
                <div style={{ padding: '16px 28px', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 10, justifyContent: 'flex-end', background: '#FAFAFA', borderRadius: '0 0 18px 18px' }}>
                  <button type="button" className="adm-btn adm-btn-secondary" onClick={closeModal}>Бекор</button>
                  <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                    {saving ? <><Loader size={16} style={{ animation: 'adm-spin 0.7s linear infinite' }} /> Сақланмоқда...</> : <><Check size={16} /> {editing ? 'Сақлаш' : 'Қўшиш'}</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
