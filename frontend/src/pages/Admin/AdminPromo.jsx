import React, { useState, useEffect, useRef } from 'react'
import { promoAPI } from '../../api'
import toast from 'react-hot-toast'
import { QRCodeCanvas } from 'qrcode.react'
import {
  Plus, QrCode, Download, Printer, Loader, Check, X, Trash2,
  Percent, DollarSign, Calendar, Power, Infinity as InfinityIcon, RotateCcw,
} from 'lucide-react'
import '../Admin/AdminLayout.css'

const fmtDate = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const isExpired = (iso) => iso ? new Date(iso) < new Date() : false

export default function AdminPromo() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Create-form state
  const [code, setCode] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState('amount')
  const [validUntil, setValidUntil] = useState('')
  const [usageLimit, setUsageLimit] = useState('')

  // Detail / edit panel
  const [selected, setSelected] = useState(null)
  const [editAmount, setEditAmount] = useState('')
  const [editType, setEditType] = useState('amount')
  const [editActive, setEditActive] = useState(true)
  const [editValidUntil, setEditValidUntil] = useState('')
  const [editLimit, setEditLimit] = useState('')
  const [saving, setSaving] = useState(false)

  const qrRef = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await promoAPI.getAll()
      setList(r.data)
      if (r.data.length > 0 && !selected) {
        openDetail(r.data[0])
      }
    } catch (e) { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const openDetail = (p) => {
    setSelected(p)
    setEditAmount(p.discount_amount)
    setEditType(p.discount_type || 'amount')
    setEditActive(p.is_active)
    setEditValidUntil(p.valid_until ? p.valid_until.slice(0, 16) : '')
    setEditLimit(String(p.usage_limit || 0))
  }

  const create = async (e) => {
    e?.preventDefault?.()
    if (!code.trim()) { toast.error('Код киритинг'); return }
    if (!amount || parseFloat(amount) <= 0) { toast.error('Чегирма миқдорини киритинг'); return }
    setCreating(true)
    try {
      const payload = {
        code: code.trim().toUpperCase(),
        discount_amount: parseFloat(amount),
        discount_type: type,
        usage_limit: parseInt(usageLimit) || 0,
        valid_until: validUntil || '',
        is_active: true,
      }
      const r = await promoAPI.create(payload)
      setList(p => [r.data, ...p])
      setCode(''); setAmount(''); setValidUntil(''); setUsageLimit('')
      setShowForm(false)
      openDetail(r.data)
      toast.success('Промо яратилди')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Хатолик')
    } finally {
      setCreating(false)
    }
  }

  const save = async (opts = {}) => {
    if (!selected) return
    setSaving(true)
    try {
      const payload = {
        discount_amount: parseFloat(editAmount) || 0,
        discount_type: editType,
        is_active: editActive,
        usage_limit: parseInt(editLimit) || 0,
        valid_until: editValidUntil || '',
        reset_count: !!opts.reset,
      }
      const r = await promoAPI.update(selected.id, payload)
      setList(p => p.map(x => x.id === r.data.id ? r.data : x))
      setSelected(r.data)
      toast.success(opts.reset ? 'Сақланди, ҳисоб тикланди' : 'Сақланди')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Хатолик')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (p) => {
    if (!window.confirm(`«${p.code}» промосини ўчирасизми?`)) return
    try {
      await promoAPI.delete(p.id)
      setList(prev => prev.filter(x => x.id !== p.id))
      if (selected?.id === p.id) {
        const next = list.find(x => x.id !== p.id)
        if (next) openDetail(next); else setSelected(null)
      }
      toast.success(`«${p.code}» ўчирилди`)
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Хатолик')
    }
  }

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `promo-${selected.code}.png`
    a.click()
  }

  const printQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas || !selected) return
    const url = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return
    const valTxt = (selected.discount_type === 'percent')
      ? `${Number(selected.discount_amount)}% chegirma`
      : `${Number(selected.discount_amount).toLocaleString()} so'm chegirma`
    w.document.write(`
      <html><head><title>Promo — ${selected.code}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px}h1{color:#FF6B35;margin:8px 0}h2{color:#15803D;font-size:32px;margin:4px 0 24px}img{width:360px;height:360px}.code{font-family:monospace;letter-spacing:2px;font-size:22px;color:#374151;margin-top:12px;font-weight:700}p{color:#6B7280;max-width:420px;margin:16px auto}</style>
      </head><body>
        <h1>ECO taomlar — Promo</h1>
        <h2>${valTxt}</h2>
        <img src="${url}" />
        <div class="code">${selected.code}</div>
        <p>QR'ni skanerlang yoki «${selected.code}» kodini buyurtmada kiriting</p>
        <script>window.onload=()=>setTimeout(()=>window.print(),300)</script>
      </body></html>
    `)
    w.document.close()
  }

  const expired = selected && isExpired(selected.valid_until)
  const usedUp = selected && selected.usage_limit > 0 && selected.use_count >= selected.usage_limit
  const stoppedReason = !selected ? '' : (!selected.is_active ? 'Деактив' : expired ? 'Муддат тугаган' : usedUp ? 'Лимит тугаган' : '')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div className="adm-page-header" style={{ margin: 0 }}>
          <h1>🎟️ Промокодлар</h1>
          <p>Вақтинчалик промокодлар — миқдор/фоиз, муддат, ишлатиш чегараси</p>
        </div>
        <button className="adm-btn adm-btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Янги промо
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT LIST */}
        <div className="adm-card" style={{ padding: 0, maxHeight: 'calc(100vh - 180px)', overflow: 'hidden auto' }}>
          {loading ? (
            <div className="adm-loading"><div className="adm-spinner" /></div>
          ) : list.length === 0 ? (
            <div className="adm-empty">Промокод йўқ</div>
          ) : list.map(p => {
            const expr = isExpired(p.valid_until)
            const up = p.usage_limit > 0 && p.use_count >= p.usage_limit
            const bad = !p.is_active || expr || up
            return (
              <div
                key={p.id}
                onClick={() => openDetail(p)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  borderBottom: '1px solid #F3F4F6',
                  background: selected?.id === p.id ? '#FFF4EF' : 'white',
                  opacity: bad ? 0.6 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#111827', fontSize: 14, letterSpacing: 1 }}>
                    {p.code}
                  </div>
                  {bad && (
                    <span style={{ fontSize: 10, background: '#FEE2E2', color: '#B91C1C', padding: '2px 7px', borderRadius: 100, fontWeight: 700 }}>
                      ⏸
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#FF6B35', fontWeight: 700 }}>
                  {p.discount_type === 'percent' ? `${Number(p.discount_amount)}%` : `${Number(p.discount_amount).toLocaleString()} сум`}
                </div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                  {p.valid_until ? `📅 ${fmtDate(p.valid_until)}` : '∞ Муддатсиз'}
                  {p.usage_limit > 0 && ` · ${p.use_count}/${p.usage_limit}`}
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT DETAIL */}
        <div>
          {!selected ? (
            <div className="adm-card" style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
              <QrCode size={48} opacity={0.3} />
              <p>Чапдан промокод танланг ёки «Янги промо» билан яратинг</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* QR card */}
              <div className="adm-card" style={{ textAlign: 'center' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>
                  <QrCode size={14} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
                  QR код
                </h3>
                <div ref={qrRef} style={{ display: 'inline-block', padding: 14, background: 'white', borderRadius: 14, border: '2px solid #F3F4F6', marginBottom: 12 }}>
                  <QRCodeCanvas value={selected.code} size={220} level="H" fgColor="#111827" />
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 18, fontWeight: 700, letterSpacing: 2, color: '#374151', marginBottom: 12 }}>
                  {selected.code}
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={downloadQR}>
                    <Download size={13} /> Юклаб
                  </button>
                  <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={printQR}>
                    <Printer size={13} /> Чоп
                  </button>
                  <button
                    className="adm-btn adm-btn-sm"
                    onClick={() => remove(selected)}
                    style={{ background: '#FEF2F2', color: '#B91C1C', border: '1.5px solid #FEE2E2' }}
                  >
                    <Trash2 size={13} /> Ўчириш
                  </button>
                </div>
                {stoppedReason && (
                  <div style={{ marginTop: 14, padding: '10px 12px', background: '#FEF2F2', borderRadius: 9, color: '#B91C1C', fontSize: 12, fontWeight: 600 }}>
                    ⛔ {stoppedReason}
                  </div>
                )}
              </div>

              {/* Settings card */}
              <div className="adm-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>⚙️ Созламалар</h3>

                <div className="adm-field">
                  <label className="adm-label">Чегирма тури</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setEditType('amount')} style={typeBtn(editType === 'amount')}>
                      <DollarSign size={13} /> Сумма
                    </button>
                    <button type="button" onClick={() => setEditType('percent')} style={typeBtn(editType === 'percent')}>
                      <Percent size={13} /> Фоиз
                    </button>
                  </div>
                </div>

                <div className="adm-field">
                  <label className="adm-label">
                    {editType === 'percent' ? 'Фоиз (%)' : 'Сумма (сум)'} *
                  </label>
                  <input
                    className="adm-input" type="number"
                    step={editType === 'percent' ? '1' : '1000'}
                    min="0" max={editType === 'percent' ? '100' : undefined}
                    value={editAmount} onChange={e => setEditAmount(e.target.value)}
                  />
                </div>

                <div className="adm-field">
                  <label className="adm-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} /> Амал қилиш муддати</label>
                  <input
                    className="adm-input" type="datetime-local"
                    value={editValidUntil}
                    onChange={e => setEditValidUntil(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Бўш қолдирсангиз — муддатсиз
                  </div>
                </div>

                <div className="adm-field">
                  <label className="adm-label">Ишлатиш чегараси (0 = чексиз)</label>
                  <input
                    className="adm-input" type="number" min="0"
                    value={editLimit} onChange={e => setEditLimit(e.target.value)}
                  />
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Ишлатилди: <b>{selected.use_count}</b>{selected.usage_limit > 0 ? ` / ${selected.usage_limit}` : ''}
                  </div>
                </div>

                <div className="adm-field">
                  <label className="adm-label">Ҳолат</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setEditActive(true)} style={statusBtn(editActive, 'on')}>
                      <Power size={13} /> Актив
                    </button>
                    <button type="button" onClick={() => setEditActive(false)} style={statusBtn(!editActive, 'off')}>
                      <X size={13} /> Деактив
                    </button>
                  </div>
                </div>

                <button
                  className="adm-btn adm-btn-primary"
                  onClick={() => save()}
                  disabled={saving}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
                >
                  {saving ? <><Loader size={14} className="adm-spin" /> Сақланмоқда...</> : <><Check size={14} /> Сақлаш</>}
                </button>
                {selected.use_count > 0 && (
                  <button
                    onClick={() => save({ reset: true })}
                    disabled={saving}
                    style={{
                      width: '100%', marginTop: 8, padding: 8, borderRadius: 8,
                      border: '1.5px solid #DBEAFE', background: '#EFF6FF', color: '#1E40AF',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 4, fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <RotateCcw size={12} /> Ҳисобни тиклаш
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CREATE MODAL */}
      {showForm && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="adm-modal" style={{ maxWidth: 460 }}>
            <div className="adm-modal-header">
              <h2>Янги промокод</h2>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <form onSubmit={create}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Код *</label>
                  <input
                    className="adm-input"
                    value={code}
                    onChange={e => setCode(e.target.value.toUpperCase())}
                    placeholder="Масалан: SUMMER10"
                    style={{ fontFamily: 'monospace', letterSpacing: 1, fontWeight: 700 }}
                    autoFocus required
                  />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Тури</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => setType('amount')} style={typeBtn(type === 'amount')}>
                      <DollarSign size={13} /> Сумма
                    </button>
                    <button type="button" onClick={() => setType('percent')} style={typeBtn(type === 'percent')}>
                      <Percent size={13} /> Фоиз
                    </button>
                  </div>
                </div>
                <div className="adm-field">
                  <label className="adm-label">{type === 'percent' ? 'Фоиз (%)' : 'Сумма (сум)'} *</label>
                  <input
                    className="adm-input" type="number"
                    step={type === 'percent' ? '1' : '1000'} min="0"
                    max={type === 'percent' ? '100' : undefined}
                    value={amount} onChange={e => setAmount(e.target.value)}
                    placeholder={type === 'percent' ? '10' : '15000'} required
                  />
                </div>
                <div className="adm-field">
                  <label className="adm-label"><Calendar size={12} style={{ display: 'inline', marginRight: 4 }} /> Муддати</label>
                  <input
                    className="adm-input" type="datetime-local"
                    value={validUntil} onChange={e => setValidUntil(e.target.value)}
                  />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Ишлатиш чегараси (0 = чексиз)</label>
                  <input
                    className="adm-input" type="number" min="0"
                    value={usageLimit} onChange={e => setUsageLimit(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setShowForm(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={creating}>
                  {creating ? <><Loader size={14} className="adm-spin" /> Яратилмоқда...</> : <><Check size={14} /> Яратиш</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const typeBtn = (active) => ({
  flex: 1, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  border: active ? '1.5px solid #FF6B35' : '1.5px solid #E5E7EB',
  background: active ? '#FFF4EF' : 'white',
  color: active ? '#FF6B35' : '#6B7280',
})
const statusBtn = (active, kind) => ({
  flex: 1, padding: '10px 12px', borderRadius: 9, cursor: 'pointer',
  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
  border: active ? (kind === 'on' ? '1.5px solid #10B981' : '1.5px solid #EF4444') : '1.5px solid #E5E7EB',
  background: active ? (kind === 'on' ? '#F0FDF4' : '#FEF2F2') : 'white',
  color: active ? (kind === 'on' ? '#15803D' : '#B91C1C') : '#6B7280',
})
