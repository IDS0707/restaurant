import React, { useState, useEffect, useRef } from 'react'
import { promoAPI } from '../../api'
import toast from 'react-hot-toast'
import { QRCodeCanvas } from 'qrcode.react'
import { Save, QrCode, Download, Printer, Loader, Check, X, RotateCcw, Infinity } from 'lucide-react'
import '../Admin/AdminLayout.css'

export default function AdminPromo() {
  const [promo, setPromo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [discount, setDiscount] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [usageLimit, setUsageLimit] = useState('0')
  const [unlimited, setUnlimited] = useState(true)
  const qrRef = useRef(null)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try {
      const r = await promoAPI.getAll()
      if (r.data && r.data.length > 0) {
        const p = r.data[0]
        setPromo(p)
        setDiscount(p.discount_amount)
        setIsActive(p.is_active)
        setUsageLimit(String(p.usage_limit || 0))
        setUnlimited(!p.usage_limit || p.usage_limit === 0)
      }
    } catch (e) {
      toast.error('Юкланмади')
    } finally {
      setLoading(false)
    }
  }

  const save = async (opts = {}) => {
    if (!promo) return
    setSaving(true)
    try {
      const amount = parseFloat(discount) || 0
      const limit = unlimited ? 0 : (parseInt(usageLimit) || 0)
      const r = await promoAPI.update(promo.id, {
        discount_amount: amount,
        is_active: isActive,
        usage_limit: limit,
        reset_count: !!opts.reset,
      })
      setPromo(r.data)
      setUsageLimit(String(r.data.usage_limit || 0))
      setUnlimited(!r.data.usage_limit)
      toast.success(opts.reset ? 'Сақланди ва ҳисоб тикланди' : 'Сақланди')
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Хатолик')
    } finally {
      setSaving(false)
    }
  }

  const downloadQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `promo-qr-${promo?.code || 'main'}.png`
    a.click()
  }

  const printQR = () => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html>
        <head><title>Promo QR — ${promo?.code}</title>
        <style>
          body { font-family: system-ui, sans-serif; text-align: center; padding: 40px; }
          h1 { color: #FF6B35; margin: 8px 0; }
          h2 { color: #15803D; font-size: 32px; margin: 4px 0 24px; }
          img { width: 360px; height: 360px; }
          .code { font-family: monospace; letter-spacing: 2px; font-size: 18px; color: #374151; margin-top: 12px; }
          p { color: #6B7280; max-width: 420px; margin: 16px auto; }
        </style>
        </head>
        <body>
          <h1>ECO taomlar — Promo</h1>
          <h2>${parseFloat(discount || 0).toLocaleString()} so'm chegirma</h2>
          <img src="${url}" />
          <div class="code">${promo?.code}</div>
          <p>QR kodni kassirga ko'rsating — buyurtmangizdan ${parseFloat(discount || 0).toLocaleString()} so'm chegirma olasiz</p>
          <script>window.onload = () => setTimeout(() => window.print(), 300)</script>
        </body>
      </html>
    `)
    w.document.close()
  }

  if (loading) {
    return <div className="adm-loading"><div className="adm-spinner" /><span>Юкланмоқда...</span></div>
  }

  if (!promo) {
    return (
      <div className="adm-card" style={{ textAlign: 'center', padding: 40 }}>
        <p>Промо топилмади. Серверда миграцияни ишга туширинг.</p>
      </div>
    )
  }

  const amountChanged = parseFloat(discount) !== Number(promo.discount_amount)
  const activeChanged = isActive !== promo.is_active
  const limitChanged = (unlimited ? 0 : parseInt(usageLimit) || 0) !== (promo.usage_limit || 0)
  const dirty = amountChanged || activeChanged || limitChanged

  const usedUp = promo.usage_limit > 0 && promo.use_count >= promo.usage_limit
  const remaining = promo.usage_limit > 0 ? Math.max(0, promo.usage_limit - promo.use_count) : null

  return (
    <div>
      <div className="adm-page-header" style={{ marginBottom: 24 }}>
        <h1>🎟️ Промо QR</h1>
        <p>Битта махсус QR код — кассирга кўрсатилганда автоматик чегирма беради. Сумма ўзгариши мумкин.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, maxWidth: 1100 }}>

        {/* LEFT: QR Code */}
        <div className="adm-card" style={{ textAlign: 'center' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>
            <QrCode size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
            Промо QR
          </h3>

          <div ref={qrRef} style={{
            display: 'inline-block', padding: 16, background: 'white',
            borderRadius: 16, border: '2px solid #F3F4F6', marginBottom: 16,
          }}>
            <QRCodeCanvas
              value={promo.code}
              size={280}
              level="H"
              includeMargin={false}
              fgColor="#111827"
            />
          </div>

          <div style={{
            fontFamily: 'monospace', fontSize: 16, letterSpacing: 2, color: '#374151',
            background: '#F9FAFB', padding: '8px 16px', borderRadius: 8, display: 'inline-block',
          }}>
            {promo.code}
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={downloadQR}>
              <Download size={14} /> Юклаб олиш
            </button>
            <button className="adm-btn adm-btn-secondary adm-btn-sm" onClick={printQR}>
              <Printer size={14} /> Чоп этиш
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 14, lineHeight: 1.5 }}>
            QR'ни принтерда чоп этинг ва столга қўйинг. Мижоз QR'ни кассирга кўрсатганда —<br />
            кассир скаенерлайди ва чегирма автоматик қўлланилади.
          </p>
        </div>

        {/* RIGHT: Settings */}
        <div className="adm-card">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 16 }}>⚙️ Созламалар</h3>

          <div className="adm-field">
            <label className="adm-label">Чегирма миқдори (сум) *</label>
            <input
              className="adm-input"
              type="number"
              step="1000"
              min="0"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              placeholder="Масалан: 15000"
              style={{ fontSize: 24, fontWeight: 800, color: '#15803D', textAlign: 'center', padding: '14px 16px' }}
            />
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
              Ҳозирги қиймат: <b>{Number(promo.discount_amount).toLocaleString()} сум</b>
            </div>
          </div>

          {/* Usage limit */}
          <div className="adm-field">
            <label className="adm-label">Амал қилиш муддати (неча марта)</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                onClick={() => setUnlimited(true)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: unlimited ? '1.5px solid #2563EB' : '1.5px solid #E5E7EB',
                  background: unlimited ? '#EFF6FF' : 'white',
                  color: unlimited ? '#1E40AF' : '#6B7280',
                }}
              >
                <Infinity size={14} /> Чексиз
              </button>
              <button
                type="button"
                onClick={() => setUnlimited(false)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                  border: !unlimited ? '1.5px solid #FF6B35' : '1.5px solid #E5E7EB',
                  background: !unlimited ? '#FFF4EF' : 'white',
                  color: !unlimited ? '#FF6B35' : '#6B7280',
                }}
              >
                Чекланган
              </button>
            </div>
            {!unlimited && (
              <input
                className="adm-input"
                type="number"
                min="1"
                value={usageLimit}
                onChange={e => setUsageLimit(e.target.value)}
                placeholder="Масалан: 5"
              />
            )}
            <div style={{
              marginTop: 8, padding: '10px 12px', borderRadius: 8,
              background: usedUp ? '#FEF2F2' : (promo.usage_limit > 0 ? '#F0FDF4' : '#F9FAFB'),
              border: `1px solid ${usedUp ? '#FECACA' : (promo.usage_limit > 0 ? '#BBF7D0' : '#F3F4F6')}`,
              fontSize: 13,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6B7280' }}>Ҳозиргача ишлатилди:</span>
                <span style={{ fontWeight: 700, color: usedUp ? '#B91C1C' : '#15803D' }}>
                  {promo.use_count}
                  {promo.usage_limit > 0 && ` / ${promo.usage_limit}`}
                </span>
              </div>
              {usedUp && (
                <div style={{ marginTop: 6, color: '#B91C1C', fontWeight: 600, fontSize: 12 }}>
                  ⛔ Муддат тугаган — кассирга чегирма қўлланилмайди
                </div>
              )}
              {promo.usage_limit > 0 && !usedUp && (
                <div style={{ marginTop: 4, fontSize: 12, color: '#166534' }}>
                  Қолди: <b>{remaining}</b> марта
                </div>
              )}
            </div>
            {promo.use_count > 0 && (
              <button
                type="button"
                onClick={() => save({ reset: true })}
                disabled={saving}
                style={{
                  marginTop: 8, width: '100%', padding: '8px 10px', borderRadius: 8,
                  border: '1.5px solid #DBEAFE', background: '#EFF6FF', color: '#1E40AF',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 6, fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                }}>
                <RotateCcw size={12} /> Ҳисобни тиклаш (0 га қайтариш)
              </button>
            )}
          </div>

          <div className="adm-field">
            <label className="adm-label">Ҳолат</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setIsActive(true)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: isActive ? '1.5px solid #10B981' : '1.5px solid #E5E7EB',
                  background: isActive ? '#F0FDF4' : 'white',
                  color: isActive ? '#15803D' : '#6B7280',
                }}
              >
                <Check size={14} /> Актив
              </button>
              <button
                type="button"
                onClick={() => setIsActive(false)}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 9, cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  border: !isActive ? '1.5px solid #EF4444' : '1.5px solid #E5E7EB',
                  background: !isActive ? '#FEF2F2' : 'white',
                  color: !isActive ? '#B91C1C' : '#6B7280',
                }}
              >
                <X size={14} /> Деактив
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>
              Деактив ҳолатда QR ишламайди, кассирга «Промо деактивлашган» дейилади.
            </div>
          </div>

          <button
            className="adm-btn adm-btn-primary"
            onClick={() => save()}
            disabled={saving || !dirty}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8, padding: '12px' }}
          >
            {saving
              ? <><Loader size={16} style={{ animation: 'adm-spin 0.7s linear infinite' }} /> Сақланмоқда...</>
              : <><Save size={16} /> Сақлаш</>}
          </button>

          <div style={{ marginTop: 20, padding: '14px 16px', background: '#FFF7ED', borderRadius: 10, border: '1px solid #FED7AA' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9A3412', marginBottom: 6 }}>📌 Қандай ишлайди</div>
            <ol style={{ fontSize: 12, color: '#7C2D12', margin: 0, paddingLeft: 18, lineHeight: 1.6 }}>
              <li>Бу QR'ни чоп этинг ёки экранда кўрсатинг</li>
              <li>Мижоз буюртма бераётганда уни кассирга кўрсатсин</li>
              <li>Кассир «QR camera» тугмасини босиб скаенерлайди</li>
              <li>Тизим <b>{Number(promo.discount_amount).toLocaleString()} сум</b> чегирмани автомат қўллайди</li>
              <li>Чегирмани шу ердан ўзгартирасиз — QR'нинг ўзи ўзгармайди</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
