import React, { useState, useEffect } from 'react'
import { inventoryAPI } from '../../api'
import toast from 'react-hot-toast'
import {
  Plus, X, Check, Edit2, Trash2, AlertTriangle,
  Package, TrendingDown, DollarSign, RefreshCw, ChevronUp,
} from 'lucide-react'
import '../Admin/AdminLayout.css'

const UNITS = ['kg', 'g', 'liter', 'ml', 'pcs', '10g']
const CATS = ['Умумий', 'Гўшт', 'Сабзавот', 'Дон', 'Мой ва соус', 'Ичимлик', 'Зираворлар', 'Бошқа']

const EMPTY_FORM = {
  name: '', category: 'Умумий', measurement_unit: 'kg',
  quantity: '', unit_price: '', low_stock_threshold: 5,
}
const EMPTY_RESTOCK = { add_quantity: '', unit_price: '', notes: '' }

const fmt = (v) => Number(v || 0).toLocaleString()

export default function AdminInventory() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)       // add/edit modal
  const [restockModal, setRestockModal] = useState(null) // ingredient being restocked
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [restock, setRestock] = useState(EMPTY_RESTOCK)
  const [saving, setSaving] = useState(false)
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const r = await inventoryAPI.getAll(); setItems(r.data) }
    catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModal(true)
  }

  const openEdit = (ing) => {
    setEditing(ing)
    setForm({
      name: ing.name,
      category: ing.category,
      measurement_unit: ing.measurement_unit,
      quantity: ing.quantity,
      unit_price: ing.unit_price,
      low_stock_threshold: ing.low_stock_threshold,
    })
    setModal(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        unit_price: parseFloat(form.unit_price) || 0,
        low_stock_threshold: parseFloat(form.low_stock_threshold) || 5,
      }
      if (editing) {
        const r = await inventoryAPI.update(editing.id, data)
        setItems(p => p.map(i => i.id === editing.id ? r.data : i))
        toast.success('Янгиланди')
      } else {
        const r = await inventoryAPI.create(data)
        setItems(p => [...p, r.data])
        toast.success('Ингредиент қўшилди')
      }
      setModal(false)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Хатолик')
    }
    finally { setSaving(false) }
  }

  const doRestock = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = {
        add_quantity: parseFloat(restock.add_quantity),
        unit_price: parseFloat(restock.unit_price),
        notes: restock.notes,
      }
      const r = await inventoryAPI.restock(restockModal.id, data)
      setItems(p => p.map(i => i.id === restockModal.id ? r.data : i))
      toast.success('Захира тўлдирилди')
      setRestockModal(null)
      setRestock(EMPTY_RESTOCK)
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Хатолик')
    }
    finally { setSaving(false) }
  }

  const del = async (ing) => {
    if (!window.confirm(`"${ing.name}" ни ўчиришни тасдиқлайсизми?`)) return
    try {
      await inventoryAPI.delete(ing.id)
      setItems(p => p.filter(i => i.id !== ing.id))
      toast.success('Ўчирилди')
    } catch { toast.error('Хатолик') }
  }

  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }))
  const rf = k => e => setRestock(p => ({ ...p, [k]: e.target.value }))

  const totalValue = items.reduce((s, i) => s + (i.total_cost || 0), 0)
  const lowStockCount = items.filter(i => i.is_low_stock).length
  const categories = ['all', ...new Set(items.map(i => i.category))]

  const filtered = filterCat === 'all' ? items : items.filter(i => i.category === filterCat)

  const totalCostPreview = (parseFloat(form.quantity) || 0) * (parseFloat(form.unit_price) || 0)
  const restockCostPreview = (parseFloat(restock.add_quantity) || 0) * (parseFloat(restock.unit_price) || 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1>📦 Омбор бошқаруви</h1>
          <p>{items.length} та ингредиент · {lowStockCount > 0 ? `${lowStockCount} та кам захира` : 'Захира нормал'}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={load}>
            <RefreshCw size={14} />
          </button>
          <button className="adm-btn adm-btn-primary" onClick={openAdd}>
            <Plus size={16} /> Ингредиент қўшиш
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 20 }}>
        {[
          {
            icon: Package, color: '#3B82F6', bg: '#DBEAFE',
            label: 'Жами ингредиент', value: items.length + ' та',
          },
          {
            icon: DollarSign, color: '#10B981', bg: '#D1FAE5',
            label: 'Омбор қиймати', value: fmt(totalValue) + ' сум',
          },
          {
            icon: AlertTriangle, color: lowStockCount ? '#EF4444' : '#9CA3AF',
            bg: lowStockCount ? '#FEE2E2' : '#F3F4F6',
            label: 'Кам захира', value: lowStockCount + ' та',
          },
          {
            icon: TrendingDown, color: '#FF6B35', bg: '#FFF4EF',
            label: 'Категориялар', value: (new Set(items.map(i => i.category))).size + ' та',
          },
        ].map((s, i) => (
          <div key={i} className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 42, height: 42, borderRadius: 11, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <s.icon size={20} color={s.color} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px', fontWeight: 500 }}>{s.label}</p>
              <p style={{ fontSize: 16, fontWeight: 800, margin: 0, color: '#111827' }}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#FEF3C7', border: '1px solid #FCD34D',
          borderRadius: 10, padding: '10px 16px', marginBottom: 16,
        }}>
          <AlertTriangle size={18} color="#92400E" />
          <span style={{ fontSize: 13, color: '#92400E', fontWeight: 600 }}>
            {lowStockCount} та ингредиент кам: {items.filter(i => i.is_low_stock).map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            border: '1.5px solid', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            background: filterCat === cat ? '#FF6B35' : 'white',
            color: filterCat === cat ? 'white' : '#6B7280',
            borderColor: filterCat === cat ? '#FF6B35' : '#E5E7EB',
          }}>
            {cat === 'all' ? 'Барчаси' : cat}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
      ) : filtered.length === 0 ? (
        <div className="adm-card adm-empty">
          <Package size={36} color="#D1D5DB" style={{ marginBottom: 8 }} />
          <p>Ингредиент топилмади</p>
          <button className="adm-btn adm-btn-primary" style={{ marginTop: 12 }} onClick={openAdd}>
            <Plus size={16} /> Биринчи ингредиентни қўшинг
          </button>
        </div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="adm-table">
              <thead>
                <tr>
                  <th>ИНГРЕДИЕНТ</th>
                  <th>КАТЕГОРИЯ</th>
                  <th>БИРЛИК</th>
                  <th style={{ textAlign: 'right' }}>МИҚДОР</th>
                  <th style={{ textAlign: 'right' }}>БИРЛИК НАРХ</th>
                  <th style={{ textAlign: 'right' }}>УМУМИЙ ҚИЙМАТ</th>
                  <th style={{ textAlign: 'center' }}>ҲОЛАТ</th>
                  <th style={{ textAlign: 'center' }}>АМАЛЛАР</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(ing => (
                  <tr key={ing.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>{ing.name}</div>
                    </td>
                    <td>
                      <span className="adm-badge adm-badge-blue" style={{ fontSize: 11 }}>{ing.category}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: 13, color: '#6B7280', fontWeight: 600 }}>{ing.measurement_unit}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: ing.is_low_stock ? '#EF4444' : '#111827' }}>
                        {ing.quantity % 1 === 0 ? ing.quantity : ing.quantity?.toFixed(3)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: 13, color: '#374151' }}>
                      {fmt(ing.unit_price)} сум
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#10B981' }}>
                        {fmt(ing.total_cost)} сум
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ing.is_low_stock ? (
                        <span className="adm-badge adm-badge-red" style={{ gap: 4 }}>
                          <AlertTriangle size={11} /> Кам
                        </span>
                      ) : (
                        <span className="adm-badge adm-badge-green">Нормал</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}>
                        <button
                          title="Тўлдириш"
                          onClick={() => { setRestockModal(ing); setRestock({ ...EMPTY_RESTOCK, unit_price: ing.unit_price }) }}
                          style={{ padding: '5px 9px', borderRadius: 7, border: '1.5px solid #D1FAE5', background: '#ECFDF5', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <ChevronUp size={14} color="#10B981" />
                        </button>
                        <button
                          title="Таҳрирлаш"
                          onClick={() => openEdit(ing)}
                          style={{ padding: '5px 9px', borderRadius: 7, border: '1.5px solid #E5E7EB', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Edit2 size={14} color="#374151" />
                        </button>
                        <button
                          title="Ўчириш"
                          onClick={() => del(ing)}
                          style={{ padding: '5px 9px', borderRadius: 7, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '12px 20px', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: 24 }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              {filtered.length} та ингредиент
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#10B981' }}>
              Жами: {fmt(filtered.reduce((s, i) => s + (i.total_cost || 0), 0))} сум
            </span>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {modal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="adm-modal" style={{ maxWidth: 520 }}>
            <div className="adm-modal-header">
              <h2>{editing ? 'Ингредиентни таҳрирлаш' : '➕ Янги ингредиент'}</h2>
              <button onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={save}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Номи *</label>
                  <input className="adm-input" value={form.name} onChange={f('name')} required placeholder="Масалан: Гўшт" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Категория</label>
                  <select className="adm-input" value={form.category} onChange={f('category')}>
                    {CATS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Ўлчов бирлиги *</label>
                  <select className="adm-input" value={form.measurement_unit} onChange={f('measurement_unit')}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="adm-field">
                  <label className="adm-label">Кам захира чегараси</label>
                  <input className="adm-input" type="number" step="0.1" value={form.low_stock_threshold} onChange={f('low_stock_threshold')} min="0" />
                </div>
              </div>

              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Харид миқдори *</label>
                  <input className="adm-input" type="number" step="0.001" value={form.quantity} onChange={f('quantity')} required min="0"
                    placeholder={`Масалан: 10 ${form.measurement_unit}`} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Бирлик нарх (сум) *</label>
                  <input className="adm-input" type="number" step="1" value={form.unit_price} onChange={f('unit_price')} required min="0"
                    placeholder="120000" />
                </div>
              </div>

              {/* Auto total cost preview */}
              {totalCostPreview > 0 && (
                <div style={{
                  background: '#F0FDF4', border: '1.5px solid #BBF7D0',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>
                    📊 Умумий харажат:
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>
                    {fmt(totalCostPreview)} сум
                  </span>
                </div>
              )}

              {!editing && (
                <div style={{ background: '#EFF6FF', borderRadius: 9, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#1D4ED8' }}>
                  ℹ️ Харид аналитика харажатлари ва захира журналига автоматик қўшилади
                </div>
              )}

              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setModal(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Сақланмоқда...' : 'Сақлаш'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Restock Modal */}
      {restockModal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setRestockModal(null)}>
          <div className="adm-modal" style={{ maxWidth: 400 }}>
            <div className="adm-modal-header">
              <h2>📥 Захирани тўлдириш</h2>
              <button onClick={() => setRestockModal(null)}><X size={20} /></button>
            </div>

            <div style={{ background: '#F9FAFB', borderRadius: 9, padding: '10px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{restockModal.name}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                Ҳозирги: {restockModal.quantity} {restockModal.measurement_unit}
                {restockModal.is_low_stock && (
                  <span style={{ color: '#EF4444', marginLeft: 8 }}>⚠ Кам захира</span>
                )}
              </div>
            </div>

            <form onSubmit={doRestock}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Қўшиш миқдори *</label>
                  <input className="adm-input" type="number" step="0.001" value={restock.add_quantity}
                    onChange={rf('add_quantity')} required min="0.001"
                    placeholder={`${restockModal.measurement_unit} да`} />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Янги нарх (сум) *</label>
                  <input className="adm-input" type="number" step="1" value={restock.unit_price}
                    onChange={rf('unit_price')} required min="0" />
                </div>
              </div>

              <div className="adm-field">
                <label className="adm-label">Изоҳ (ихтиёрий)</label>
                <input className="adm-input" value={restock.notes} onChange={rf('notes')}
                  placeholder="Масалан: Бозордан харид" />
              </div>

              {restockCostPreview > 0 && (
                <div style={{
                  background: '#F0FDF4', border: '1.5px solid #BBF7D0',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <span style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Харажат:</span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: '#15803D' }}>
                    {fmt(restockCostPreview)} сум
                  </span>
                </div>
              )}

              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setRestockModal(null)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Юбориляпти...' : 'Тасдиқлаш'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
