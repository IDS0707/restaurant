import React, { useState, useEffect, useRef } from 'react'
import { vipAPI } from '../../api'
import toast from 'react-hot-toast'
import { QRCodeCanvas } from 'qrcode.react'
import { Plus, Crown, Trash2, Printer, Download, X, Check, Loader, Power } from 'lucide-react'
import '../Admin/AdminLayout.css'

export default function AdminVip() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [selected, setSelected] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const qrRefs = useRef({})

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await vipAPI.getAll()
      setList(r.data)
    } catch (e) {
      toast.error('Юкланмади')
    } finally {
      setLoading(false)
    }
  }

  const create = async (e) => {
    e?.preventDefault?.()
    if (!firstName.trim()) {
      toast.error('Исм киритинг')
      return
    }
    setCreating(true)
    try {
      const r = await vipAPI.create({ first_name: firstName.trim(), last_name: lastName.trim() })
      setList(p => [r.data, ...p])
      setFirstName('')
      setLastName('')
      setShowForm(false)
      setSelected(r.data)
      toast.success(`VIP яратилди: ${r.data.code}`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Хатолик')
    } finally {
      setCreating(false)
    }
  }

  const toggleActive = async (v) => {
    try {
      const r = await vipAPI.update(v.id, { is_active: !v.is_active })
      setList(p => p.map(x => x.id === v.id ? r.data : x))
      if (selected?.id === v.id) setSelected(r.data)
    } catch (e) {
      toast.error('Хатолик')
    }
  }

  const remove = async (v) => {
    setDeleting(v.id)
    try {
      await vipAPI.delete(v.id)
      setList(p => p.filter(x => x.id !== v.id))
      if (selected?.id === v.id) setSelected(null)
      toast.success(`${v.first_name} ўчирилди`)
    } catch (e) {
      toast.error('Хатолик')
    } finally {
      setDeleting(null)
    }
  }

  const downloadQR = (v) => {
    const canvas = qrRefs.current[v.id]?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `vip-${v.first_name}-${v.code}.png`
    a.click()
  }

  const printQR = (v) => {
    const canvas = qrRefs.current[v.id]?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>VIP — ${v.first_name}</title>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
          h1 { color: #F59E0B; margin: 8px 0; font-size: 28px; }
          h2 { color: #111827; font-size: 36px; margin: 4px 0 6px; }
          h3 { color: #15803D; font-size: 20px; margin: 4px 0 24px; font-weight: 600; }
          img { width: 360px; height: 360px; }
          .code { font-family: monospace; letter-spacing: 2px; font-size: 18px; color: #374151; margin-top: 12px; }
          p { color: #6B7280; max-width: 420px; margin: 16px auto; }
        </style>
        </head>
        <body>
          <h1>⭐ ECO taomlar — VIP</h1>
          <h2>${v.first_name} ${v.last_name || ''}</h2>
          <h3>Barcha taomlar bepul</h3>
          <img src="${url}" />
          <div class="code">${v.code}</div>
          <p>Bu QR kodni kassirga ko'rsating — taomlar bepul beriladi</p>
          <script>window.onload = () => setTimeout(() => window.print(), 300)</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1>⭐ VIP карталар</h1>
          <p>Махсус мижозлар учун — барча таомлар бепул</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Янги VIP
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="adm-modal" style={{ maxWidth: 460 }}>
            <div className="adm-modal-header">
              <h2>Янги VIP қўшиш</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={create}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Исм *</label>
                  <input
                    className="adm-input"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="Масалан: Алишер"
                    autoFocus
                    required
                  />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Фамилия</label>
                  <input
                    className="adm-input"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Масалан: Каримов"
                  />
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                Автоматик QR код берилади. Уни чоп этиб ёки экранда кўрсатиб берасиз.
              </p>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowForm(false)}>
                  Бекор
                </button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={creating}>
                  {creating ? <><Loader size={14} style={{ animation: 'adm-spin 0.7s linear infinite' }} /> Яратилмоқда...</>
                            : <><Check size={14} /> Яратиш</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
      ) : list.length === 0 ? (
        <div className="adm-card" style={{ textAlign: 'center', padding: 48 }}>
          <Crown size={48} color="#D1D5DB" style={{ marginBottom: 12 }} />
          <p style={{ color: '#9CA3AF' }}>Ҳозирча VIP мижозлар йўқ</p>
          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
            «Янги VIP» тугмаси билан биринчисини қўшинг
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {list.map(v => (
            <div key={v.id} className="adm-card" style={{
              opacity: v.is_active ? 1 : 0.6,
              border: v.is_active ? '1.5px solid #FEF3C7' : '1.5px solid #E5E7EB',
              background: v.is_active ? 'linear-gradient(135deg, #FFFBEB 0%, white 60%)' : 'white',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #F59E0B, #FF6B35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Crown size={20} color="white" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {v.first_name} {v.last_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', fontFamily: 'monospace' }}>
                    {v.code}
                  </div>
                </div>
              </div>

              <div ref={el => qrRefs.current[v.id] = el} style={{
                display: 'flex', justifyContent: 'center', padding: 12, background: 'white',
                borderRadius: 10, border: '1px solid #F3F4F6', marginBottom: 12,
              }}>
                <QRCodeCanvas value={v.code} size={180} level="H" fgColor="#111827" />
              </div>

              <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 12 }}>
                Ишлатилди: <b>{v.use_count}</b> марта
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => downloadQR(v)}
                  className="adm-btn adm-btn-secondary adm-btn-sm"
                  style={{ flex: 1 }}
                >
                  <Download size={12} /> Юклаб
                </button>
                <button
                  onClick={() => printQR(v)}
                  className="adm-btn adm-btn-secondary adm-btn-sm"
                  style={{ flex: 1 }}
                >
                  <Printer size={12} /> Чоп
                </button>
              </div>

              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  onClick={() => toggleActive(v)}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                    fontFamily: 'Inter, sans-serif',
                    border: v.is_active ? '1.5px solid #FECACA' : '1.5px solid #BBF7D0',
                    background: v.is_active ? '#FEF2F2' : '#F0FDF4',
                    color: v.is_active ? '#B91C1C' : '#15803D',
                  }}
                >
                  <Power size={12} /> {v.is_active ? 'Тўхтатиш' : 'Ишлатиш'}
                </button>
                <button
                  onClick={() => { if (window.confirm(`${v.first_name} VIP'ни ўчиришни тасдиқлайсизми?`)) remove(v) }}
                  disabled={deleting === v.id}
                  style={{
                    padding: '6px 10px', borderRadius: 7, border: '1.5px solid #FEE2E2',
                    background: '#FEF2F2', color: '#EF4444', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
