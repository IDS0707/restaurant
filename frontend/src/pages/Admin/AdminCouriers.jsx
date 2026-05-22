import React, { useState, useEffect } from 'react'
import { couriersAPI } from '../../api'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Phone, Bike, X, Loader, MapPin } from 'lucide-react'
import './AdminLayout.css'

const fmt = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  const min = Math.floor((Date.now() - d.getTime()) / 60000)
  if (min < 1) return 'hozir'
  if (min < 60) return `${min} daq. oldin`
  if (min < 1440) return `${Math.floor(min / 60)} soat oldin`
  return `${Math.floor(min / 1440)} kun oldin`
}

const EMPTY = { phone: '', first_name: '', last_name: '', pin: '', is_active: true }

export default function AdminCouriers() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])
  const load = async () => {
    setLoading(true)
    try { const r = await couriersAPI.getAll(); setList(r.data) }
    catch { toast.error('Yuklanmadi') }
    finally { setLoading(false) }
  }

  const openNew = () => { setEditing(null); setForm(EMPTY); setModal(true) }
  const openEdit = (c) => {
    setEditing(c)
    setForm({
      phone: c.phone, first_name: c.first_name, last_name: c.last_name || '',
      pin: c.pin || '', is_active: c.is_active,
    })
    setModal(true)
  }
  const closeModal = () => { setModal(false); setEditing(null); setForm(EMPTY) }

  const save = async (e) => {
    e.preventDefault()
    if (!form.phone.trim() || !form.first_name.trim() || !form.pin.trim()) {
      toast.error('Telefon, ism va PIN kerak')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await couriersAPI.update(editing.id, form)
        toast.success('Yangilandi')
      } else {
        await couriersAPI.create(form)
        toast.success('Kuryer qo\'shildi')
      }
      closeModal()
      load()
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Xato')
    } finally { setSaving(false) }
  }

  const remove = async (c) => {
    if (!window.confirm(`${c.first_name}ni o'chirasizmi?`)) return
    try { await couriersAPI.delete(c.id); toast.success('O\'chirildi'); load() }
    catch { toast.error('Xato') }
  }

  return (
    <div>
      <div className="adm-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1>🛵 Kuryerlar</h1>
            <p>Yetkazib beruvchilarni boshqaring — {list.length} ta</p>
          </div>
          <button onClick={openNew} style={{
            padding: '10px 18px', borderRadius: 10, border: 'none', background: '#FF6B35',
            color: 'white', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            fontFamily: 'Inter, sans-serif',
          }}>
            <Plus size={16} /> Yangi kuryer
          </button>
        </div>
      </div>

      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /></div>
      ) : (
        <div className="adm-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="adm-table">
            <thead>
              <tr>
                <th>Ism</th>
                <th>Telefon</th>
                <th>PIN</th>
                <th>Holat</th>
                <th>Joylashuv</th>
                <th>Oxirgi marta</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: 40 }}>
                  Kuryerlar yo'q
                </td></tr>
              ) : list.map(c => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 700 }}>{c.first_name} {c.last_name}</td>
                  <td style={{ fontFamily: 'monospace' }}>{c.phone}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#FF6B35' }}>{c.pin}</td>
                  <td>
                    <span className={`adm-badge ${c.is_active ? 'adm-badge-green' : 'adm-badge-gray'}`}>
                      {c.is_active ? 'Faol' : 'Faolsiz'}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: '#6B7280' }}>
                    {c.current_lat && c.current_lng ? (
                      <a href={`https://yandex.uz/maps/?ll=${c.current_lng},${c.current_lat}&z=17&pt=${c.current_lng},${c.current_lat}`}
                         target="_blank" rel="noreferrer"
                         style={{ color: '#FF6B35', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> Xaritada
                      </a>
                    ) : '—'}
                  </td>
                  <td style={{ fontSize: 12, color: '#6B7280' }}>{fmt(c.last_seen_at)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => openEdit(c)} style={btn('#0EA5E9')}><Edit2 size={13} /></button>
                    <button onClick={() => remove(c)} style={btn('#EF4444')}><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="adm-modal-bg" onClick={closeModal}>
          <div className="adm-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="adm-modal-head">
              <h2>{editing ? 'Kuryerni tahrirlash' : 'Yangi kuryer'}</h2>
              <button className="adm-modal-close" onClick={closeModal}><X size={18} /></button>
            </div>
            <form onSubmit={save} style={{ padding: 24 }}>
              <div className="adm-field">
                <label className="adm-label">Ism *</label>
                <input className="adm-input" value={form.first_name}
                  onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">Familiya</label>
                <input className="adm-input" value={form.last_name}
                  onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
              </div>
              <div className="adm-field">
                <label className="adm-label">Telefon *</label>
                <input className="adm-input" type="tel" placeholder="+998 XX XXX XX XX"
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
              </div>
              <div className="adm-field">
                <label className="adm-label">PIN-kod *</label>
                <input className="adm-input" type="text" maxLength={10} placeholder="Masalan: 1234"
                  style={{ fontFamily: 'monospace', letterSpacing: 2, fontWeight: 700 }}
                  value={form.pin}
                  onChange={e => setForm(p => ({ ...p, pin: e.target.value }))} required />
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                  Kuryer ilovaga shu telefon + PIN bilan kiradi
                </div>
              </div>
              <div className="adm-field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />
                  Faol
                </label>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                <button type="button" onClick={closeModal} style={{
                  flex: 1, padding: '12px', borderRadius: 10, border: '1.5px solid #E5E7EB',
                  background: 'white', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                }}>Bekor</button>
                <button type="submit" disabled={saving} style={{
                  flex: 2, padding: '12px', borderRadius: 10, border: 'none',
                  background: '#FF6B35', color: 'white', cursor: 'pointer', fontWeight: 700,
                  fontFamily: 'Inter, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  {saving ? <Loader size={16} className="adm-spin" /> : (editing ? 'Saqlash' : 'Qo\'shish')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const btn = (color) => ({
  marginRight: 4,
  padding: '5px 8px', borderRadius: 6, border: '1px solid ' + color,
  background: 'white', color, cursor: 'pointer',
})
