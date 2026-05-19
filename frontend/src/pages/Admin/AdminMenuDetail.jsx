import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { menuAPI, inventoryAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Plus, Trash2, X, Check, Save,
  TrendingUp, DollarSign, Percent, ChefHat,
  AlertTriangle, RefreshCw,
} from 'lucide-react'
import '../Admin/AdminLayout.css'

const CATS = ['Основные блюда', 'Супы', 'Гриль', 'Выпечка', 'Напитки', 'Десерты']
const UNITS = ['kg', 'g', 'liter', 'ml', 'pcs', '10g']

const fmt = (v) => Number(v || 0).toLocaleString()
const fmtCost = (v) => `${Number(v || 0).toLocaleString()} сум`

export default function AdminMenuDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [item, setItem] = useState(null)
  const [ingredients, setIngredients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Edit basic info
  const [infoForm, setInfoForm] = useState(null)
  const [editingInfo, setEditingInfo] = useState(false)

  // Add recipe item modal
  const [recipeModal, setRecipeModal] = useState(false)
  const [recipeForm, setRecipeForm] = useState({ ingredient_id: '', quantity_used: '', unit: 'g' })
  const [addingRecipe, setAddingRecipe] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [detailRes, ingRes] = await Promise.all([
        menuAPI.getDetail(id),
        inventoryAPI.getAll(),
      ])
      setItem(detailRes.data)
      setIngredients(ingRes.data)
      const d = detailRes.data
      setInfoForm({
        name: d.name, description: d.description || '',
        category: d.category, markup_percent: d.markup_percent || 0,
      })
    } catch (err) {
      toast.error('Юкланмади')
      navigate('/admin/menu')
    }
    finally { setLoading(false) }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  const saveInfo = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Update basic info
      await menuAPI.update(id, {
        name: infoForm.name,
        description: infoForm.description,
        category: infoForm.category,
        price: item.price,
        available: item.available,
        image_url: item.image_url,
      })
      // Update markup separately (triggers food cost recalc)
      await menuAPI.updateMarkup(id, parseFloat(infoForm.markup_percent) || 0)
      await load()
      setEditingInfo(false)
      toast.success('Сақланди')
    } catch {
      toast.error('Хатолик')
    }
    finally { setSaving(false) }
  }

  const addRecipeItem = async (e) => {
    e.preventDefault()
    setAddingRecipe(true)
    try {
      await menuAPI.addRecipeItem(id, {
        ingredient_id: parseInt(recipeForm.ingredient_id),
        quantity_used: parseFloat(recipeForm.quantity_used),
        unit: recipeForm.unit,
      })
      await load()
      setRecipeModal(false)
      setRecipeForm({ ingredient_id: '', quantity_used: '', unit: 'g' })
      toast.success('Ингредиент рецептга қўшилди')
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Хатолик')
    }
    finally { setAddingRecipe(false) }
  }

  const removeRecipeItem = async (recipeItemId, ingredientName) => {
    if (!window.confirm(`"${ingredientName}" ни рецептдан олиб ташлайсизми?`)) return
    try {
      await menuAPI.deleteRecipeItem(recipeItemId)
      await load()
      toast.success('Олиб ташланди')
    } catch {
      toast.error('Хатолик')
    }
  }

  if (loading) {
    return <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
  }
  if (!item) return null

  const margin = item.sale_price > 0 && item.food_cost > 0
    ? ((item.sale_price - item.food_cost) / item.sale_price * 100).toFixed(1)
    : 0
  const profit = item.sale_price - item.food_cost

  // Find ingredients not yet in recipe for the add modal
  const usedIngredientIds = new Set(item.recipe?.map(r => r.ingredient_id) || [])
  const availableIngredients = ingredients.filter(i => !usedIngredientIds.has(i.id))

  // Suggest unit based on selected ingredient's measurement_unit
  const selectedIngredient = ingredients.find(i => i.id === parseInt(recipeForm.ingredient_id))

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <button
          onClick={() => navigate('/admin/menu')}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: 'Inter, sans-serif' }}
        >
          <ArrowLeft size={16} /> Меню
        </button>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1 style={{ fontSize: 20 }}>🍽️ {item.name}</h1>
          <p>{item.category}</p>
        </div>
        <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={load} style={{ marginLeft: 'auto' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* ── Section 1: Basic Info ───────────────────────────────── */}
        <div className="adm-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: 0 }}>📋 Асосий маълумот</h3>
            {!editingInfo && (
              <button
                onClick={() => setEditingInfo(true)}
                className="adm-btn adm-btn-secondary adm-btn-sm"
              >
                Таҳрирлаш
              </button>
            )}
          </div>

          {editingInfo ? (
            <form onSubmit={saveInfo}>
              <div className="adm-field">
                <label className="adm-label">Номи *</label>
                <input className="adm-input" value={infoForm.name}
                  onChange={e => setInfoForm(p => ({ ...p, name: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Тавсиф</label>
                <textarea className="adm-input" rows={2} value={infoForm.description}
                  onChange={e => setInfoForm(p => ({ ...p, description: e.target.value }))}
                  style={{ resize: 'vertical' }} />
              </div>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Категория</label>
                  <select className="adm-input" value={infoForm.category}
                    onChange={e => setInfoForm(p => ({ ...p, category: e.target.value }))}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="adm-field">
                  <label className="adm-label">Устама % (Markup)</label>
                  <input className="adm-input" type="number" step="0.1" min="0" max="500"
                    value={infoForm.markup_percent}
                    onChange={e => setInfoForm(p => ({ ...p, markup_percent: e.target.value }))}
                    placeholder="Масалан: 40" />
                </div>
              </div>
              {parseFloat(infoForm.markup_percent) > 0 && item.food_cost > 0 && (
                <div style={{ background: '#F0FDF4', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#166534' }}>
                  💡 Нарх автоматик ҳисобланади: {fmt(item.food_cost * (1 + parseFloat(infoForm.markup_percent) / 100))} сум
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="adm-btn adm-btn-secondary adm-btn-sm" onClick={() => setEditingInfo(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary adm-btn-sm" disabled={saving}>
                  <Save size={14} /> {saving ? 'Сақланмоқда...' : 'Сақлаш'}
                </button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Номи', value: item.name },
                { label: 'Категория', value: item.category },
                { label: 'Тавсиф', value: item.description || '—' },
              ].map(row => (
                <div key={row.label}>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{row.label}</div>
                  <div style={{ fontSize: 14, color: '#111827', fontWeight: 500 }}>{row.value}</div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 20, paddingTop: 8, borderTop: '1px solid #F3F4F6' }}>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Устама %</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#FF6B35' }}>{item.markup_percent || 0}%</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>Сотиш нарх</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>{fmt(item.price)} сум</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Section 3: Cost Breakdown ───────────────────────────── */}
        <div className="adm-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 16 }}>💰 Харажат тахлили</h3>

          {item.food_cost === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF' }}>
              <ChefHat size={36} color="#D1D5DB" style={{ marginBottom: 8 }} />
              <p style={{ fontSize: 13, margin: 0 }}>Рецепт қўшинг — харажат автоматик ҳисобланади</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {[
                { icon: DollarSign, color: '#3B82F6', bg: '#DBEAFE', label: 'Таннарх (Food Cost)', value: fmtCost(item.food_cost) },
                { icon: Percent, color: '#F59E0B', bg: '#FEF3C7', label: `Устама ${item.markup_percent || 0}%`, value: fmtCost(item.sale_price - item.food_cost) },
                { icon: TrendingUp, color: '#10B981', bg: '#D1FAE5', label: 'Сотиш нарх', value: fmtCost(item.sale_price || item.price) },
                { icon: TrendingUp, color: '#FF6B35', bg: '#FFF4EF', label: 'Соф фойда', value: fmtCost(profit) },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0',
                  borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 9, background: row.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <row.icon size={17} color={row.color} />
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: '#6B7280' }}>{row.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{row.value}</div>
                </div>
              ))}

              {/* Margin bar */}
              <div style={{ marginTop: 16, background: '#F9FAFB', borderRadius: 9, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Margin</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: margin >= 30 ? '#10B981' : '#EF4444' }}>{margin}%</span>
                </div>
                <div style={{ background: '#E5E7EB', borderRadius: 100, height: 8, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 100,
                    background: margin >= 30 ? 'linear-gradient(90deg,#10B981,#34D399)' : 'linear-gradient(90deg,#EF4444,#F87171)',
                    width: `${Math.min(100, margin)}%`,
                    transition: 'width 0.5s',
                  }} />
                </div>
                {margin < 20 && (
                  <div style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <AlertTriangle size={11} /> Margin жуда паст — нарх ёки рецептни кўrib чиқинг
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Recipe ────────────────────────────────────── */}
      <div className="adm-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#374151', margin: '0 0 3px' }}>
              🧾 Рецептура — {item.name}
            </h3>
            <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0 }}>
              {item.recipe?.length || 0} та ингредиент
              {item.food_cost > 0 && ` · Жами таннарх: ${fmtCost(item.food_cost)}`}
            </p>
          </div>
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setRecipeModal(true)}>
            <Plus size={14} /> Ингредиент қўшиш
          </button>
        </div>

        {!item.recipe || item.recipe.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#9CA3AF' }}>
            <ChefHat size={40} color="#D1D5DB" style={{ marginBottom: 10 }} />
            <p style={{ fontSize: 14, margin: '0 0 14px' }}>Рецепт ҳали қўшилмаган</p>
            <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setRecipeModal(true)}>
              <Plus size={14} /> Биринчи ингредиентни қўшинг
            </button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>ИНГРЕДИЕНТ</th>
                  <th style={{ textAlign: 'right' }}>МИҚДОР</th>
                  <th>БИРЛИК</th>
                  <th style={{ textAlign: 'right' }}>БИРЛИК НАРХ</th>
                  <th style={{ textAlign: 'right' }}>ХАРАЖАТ</th>
                  <th style={{ textAlign: 'right' }}>УЛУШ %</th>
                  <th style={{ textAlign: 'center' }}>АМАЛ</th>
                </tr>
              </thead>
              <tbody>
                {item.recipe.map(ri => {
                  const share = item.food_cost > 0 ? (ri.cost / item.food_cost * 100).toFixed(1) : 0
                  return (
                    <tr key={ri.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#111827' }}>{ri.ingredient_name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF' }}>Омборда: {ri.ingredient_unit}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{ri.quantity_used}</td>
                      <td>
                        <span className="adm-badge adm-badge-gray" style={{ fontSize: 11 }}>{ri.unit}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: 13, color: '#6B7280' }}>
                        {fmt(ri.unit_price)} / {ri.ingredient_unit}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: '#374151' }}>{fmtCost(ri.cost)}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                          <div style={{ width: 50, background: '#F3F4F6', borderRadius: 100, height: 5, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: '#FF6B35', width: `${Math.min(100, share)}%`, borderRadius: 100 }} />
                          </div>
                          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600, minWidth: 34 }}>{share}%</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => removeRecipeItem(ri.id, ri.ingredient_name)}
                          style={{ padding: '5px 9px', borderRadius: 7, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center', margin: '0 auto' }}
                        >
                          <Trash2 size={13} color="#EF4444" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#FAFAFA' }}>
                  <td colSpan={4} style={{ fontWeight: 700, color: '#374151', fontSize: 13, padding: '12px 14px' }}>
                    Жами таннарх
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 800, fontSize: 15, color: '#111827', padding: '12px 14px' }}>
                    {fmtCost(item.food_cost)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Add Recipe Item Modal */}
      {recipeModal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setRecipeModal(false)}>
          <div className="adm-modal" style={{ maxWidth: 480 }}>
            <div className="adm-modal-header">
              <h2>Рецептга ингредиент қўшиш</h2>
              <button onClick={() => setRecipeModal(false)}><X size={20} /></button>
            </div>

            {availableIngredients.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px', color: '#6B7280' }}>
                <p>Барча ингредиентлар рецептга қўшилган</p>
                <button className="adm-btn adm-btn-secondary adm-btn-sm" style={{ marginTop: 12 }}
                  onClick={() => { setRecipeModal(false); navigate('/admin/inventory') }}>
                  Омборга ўтиш
                </button>
              </div>
            ) : (
              <form onSubmit={addRecipeItem}>
                <div className="adm-field">
                  <label className="adm-label">Ингредиент *</label>
                  <select className="adm-input" required value={recipeForm.ingredient_id}
                    onChange={e => {
                      const ing = ingredients.find(i => i.id === parseInt(e.target.value))
                      setRecipeForm(p => ({
                        ...p,
                        ingredient_id: e.target.value,
                        unit: ing?.measurement_unit || 'g',
                      }))
                    }}>
                    <option value="">— Танланг —</option>
                    {availableIngredients.map(ing => (
                      <option key={ing.id} value={ing.id}>
                        {ing.name} ({ing.quantity} {ing.measurement_unit} мавжуд)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedIngredient && (
                  <div style={{ background: '#EFF6FF', borderRadius: 9, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#1D4ED8' }}>
                    Омборда: <strong>{selectedIngredient.quantity} {selectedIngredient.measurement_unit}</strong> · Нарх: <strong>{fmt(selectedIngredient.unit_price)} сум/{selectedIngredient.measurement_unit}</strong>
                  </div>
                )}

                <div className="adm-form-row">
                  <div className="adm-field">
                    <label className="adm-label">1 порция учун миқдор *</label>
                    <input className="adm-input" type="number" step="0.001" min="0.001" required
                      value={recipeForm.quantity_used}
                      onChange={e => setRecipeForm(p => ({ ...p, quantity_used: e.target.value }))}
                      placeholder="Масалан: 300" />
                  </div>
                  <div className="adm-field">
                    <label className="adm-label">Бирлик *</label>
                    <select className="adm-input" value={recipeForm.unit}
                      onChange={e => setRecipeForm(p => ({ ...p, unit: e.target.value }))}>
                      {UNITS.map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>

                {/* Cost preview */}
                {selectedIngredient && recipeForm.quantity_used > 0 && (
                  <div style={{ background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: '#166534', marginBottom: 4 }}>Тахминий харажат (1 порция):</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>
                      ≈ {fmtCost(calcPreviewCost(selectedIngredient, recipeForm))}
                    </div>
                  </div>
                )}

                <div className="adm-modal-footer">
                  <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRecipeModal(false)}>Бекор</button>
                  <button type="submit" className="adm-btn adm-btn-primary" disabled={addingRecipe}>
                    <Check size={16} /> {addingRecipe ? 'Қўшиляпти...' : 'Рецептга қўшиш'}
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

// Client-side cost preview (mirrors backend unitCostFactor)
function calcPreviewCost(ingredient, form) {
  const qty = parseFloat(form.quantity_used) || 0
  const recipeUnit = form.unit
  const ingUnit = ingredient.measurement_unit
  const unitPrice = ingredient.unit_price

  if (recipeUnit === ingUnit) return qty * unitPrice

  const toG = { kg: 1000, g: 1, '10g': 10 }
  const toML = { liter: 1000, ml: 1 }

  if (toG[recipeUnit] && toG[ingUnit]) {
    return (qty * toG[recipeUnit] / toG[ingUnit]) * unitPrice
  }
  if (toML[recipeUnit] && toML[ingUnit]) {
    return (qty * toML[recipeUnit] / toML[ingUnit]) * unitPrice
  }
  return qty * unitPrice
}
