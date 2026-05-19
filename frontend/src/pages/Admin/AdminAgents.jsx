import React, { useState, useEffect } from 'react'
import { agentsAPI } from '../../api'
import toast from 'react-hot-toast'
import { Plus, Users, Star, CreditCard, X, Check, ChevronRight, Gift, Trash2, Edit2 } from 'lucide-react'
import '../Admin/AdminLayout.css'

const EMPTY = { name: '', phone: '', regular_card_count: 20, discount_amount: 20000, bonus_threshold: 10, referral_bonus_threshold: 20 }

export default function AdminAgents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [bonuses, setBonuses] = useState([])
  const [modal, setModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    try { const r = await agentsAPI.getAll(); setAgents(r.data) }
    catch { toast.error('Юкланмади') }
    finally { setLoading(false) }
  }

  const selectAgent = async (agent) => {
    setSelected(agent)
    setBonuses([])
    try {
      const [r, b] = await Promise.all([agentsAPI.getById(agent.id), agentsAPI.getBonuses(agent.id)])
      setSelected(r.data)
      setBonuses(b.data)
    } catch {}
  }

  const create = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await agentsAPI.create({
        ...form,
        regular_card_count: +form.regular_card_count,
        discount_amount: +form.discount_amount,
        bonus_threshold: +form.bonus_threshold,
        referral_bonus_threshold: +form.referral_bonus_threshold,
      })
      setAgents(a => [res.data, ...a])
      setModal(false)
      setForm(EMPTY)
      toast.success(`Агент яратилди: ${res.data.code}`)
    } catch (e) { toast.error(e.response?.data?.error || 'Хатолик') }
    finally { setSaving(false) }
  }

  const openEdit = (agent) => {
    setEditForm({
      name: agent.name || '',
      phone: agent.phone || '',
      discount_amount: agent.discount_amount || 0,
      bonus_threshold: agent.bonus_threshold || 10,
      referral_bonus_threshold: agent.referral_bonus_threshold || 20,
    })
    setEditModal(true)
  }

  const saveEdit = async (e) => {
    e.preventDefault()
    if (!selected) return
    setEditSaving(true)
    try {
      const res = await agentsAPI.update(selected.id, {
        name: editForm.name,
        phone: editForm.phone,
        discount_amount: +editForm.discount_amount,
        bonus_threshold: +editForm.bonus_threshold,
        referral_bonus_threshold: +editForm.referral_bonus_threshold,
      })
      setAgents(a => a.map(x => x.id === selected.id ? res.data : x))
      setSelected(res.data)
      setEditModal(false)
      toast.success('Агент маълумотлари янгиланди')
    } catch (e) { toast.error(e.response?.data?.error || 'Хатолик') }
    finally { setEditSaving(false) }
  }

  const deleteAgent = async (agent) => {
    setDeleting(true)
    try {
      await agentsAPI.delete(agent.id)
      setAgents(a => a.filter(x => x.id !== agent.id))
      if (selected?.id === agent.id) setSelected(null)
      setDeleteConfirm(null)
      toast.success(`Агент "${agent.name}" ўчирилди`)
    } catch (e) { toast.error(e.response?.data?.error || 'Ўчиришда хатолик') }
    finally { setDeleting(false) }
  }

  const f = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.value }))
  const ef = (k) => (e) => setEditForm(p => ({ ...p, [k]: e.target.value }))

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 120px)' }}>
      {/* Left: agent list */}
      <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>👥 Агентлар</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>{agents.length} та агент</p>
          </div>
          <button className="adm-btn adm-btn-primary adm-btn-sm" onClick={() => setModal(true)}>
            <Plus size={14} /> Агент
          </button>
        </div>

        <div className="adm-card" style={{ flex: 1, padding: 0, overflow: 'hidden auto' }}>
          {loading ? (
            <div className="adm-loading"><div className="adm-spinner" /></div>
          ) : agents.length === 0 ? (
            <div className="adm-empty">Агентлар йўқ</div>
          ) : agents.map(ag => (
            <div
              key={ag.id}
              onClick={() => selectAgent(ag)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
                cursor: 'pointer', borderBottom: '1px solid #F3F4F6',
                background: selected?.id === ag.id ? '#FFF4EF' : 'white',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: selected?.id === ag.id ? '#FF6B35' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Users size={18} color={selected?.id === ag.id ? 'white' : '#6B7280'} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: '#111827', fontSize: 14 }}>{ag.name}</div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>#{ag.code}</div>
              </div>
              <div style={{ display: 'flex', gap: 4, flexShrink: 0, alignItems: 'center' }}>
                <span style={{ fontSize: 11, background: '#FEF3C7', color: '#92400E', padding: '2px 7px', borderRadius: 100, fontWeight: 600 }}>
                  ⭐ {ag.gold_card_uses}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setDeleteConfirm(ag) }}
                  style={{ width: 28, height: 28, borderRadius: 7, border: '1.5px solid #FEE2E2', background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#EF4444', flexShrink: 0 }}
                  title="Ўчириш"
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <ChevronRight size={16} color="#9CA3AF" />
            </div>
          ))}
        </div>
      </div>

      {/* Right: agent detail */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Header */}
            <div className="adm-card" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#FFF4EF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={26} color="#FF6B35" />
              </div>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#111827', margin: 0 }}>{selected.name}</h2>
                <div style={{ fontSize: 14, color: '#FF6B35', fontWeight: 600 }}>#{selected.code}</div>
                {selected.phone && <div style={{ fontSize: 13, color: '#6B7280' }}>{selected.phone}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    { label: 'Олтин карта', val: selected.gold_card_uses },
                    { label: 'Реферал', val: selected.referral_card_total_uses },
                    { label: 'Бонус', val: selected.total_bonus_earned },
                    { label: 'Чегирма', val: `${selected.discount_amount?.toLocaleString()} сум` },
                  ].map((s, i) => (
                    <div key={i} style={{ textAlign: 'center', padding: '8px 14px', background: '#F9FAFB', borderRadius: 10 }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#FF6B35' }}>{s.val}</div>
                      <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 500 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => openEdit(selected)}
                    style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #DBEAFE', background: '#EFF6FF', cursor: 'pointer', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                  >
                    <Edit2 size={15} /> Tahrirlash
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(selected)}
                    style={{ padding: '8px 14px', borderRadius: 9, border: '1.5px solid #FEE2E2', background: '#FEF2F2', cursor: 'pointer', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif' }}
                  >
                    <Trash2 size={15} /> Ўчириш
                  </button>
                </div>
              </div>
            </div>

            {/* Settings summary */}
            <div className="adm-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>⚙️ Sozlamalar</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                {[
                  { label: 'Chegirma miqdori', val: `${selected.discount_amount?.toLocaleString()} so'm` },
                  { label: 'Oltin bonus (tashriflar)', val: `${selected.bonus_threshold} ta` },
                  { label: 'Referral bonus (ishlatish)', val: `${selected.referral_bonus_threshold} ta` },
                ].map((s, i) => (
                  <div key={i} style={{ padding: '12px 14px', background: '#F9FAFB', borderRadius: 10, border: '1px solid #F3F4F6' }}>
                    <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Gold card */}
            <div className="adm-card">
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>⭐ Олтин карта</h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #FEF3C7, #FDE68A)', borderRadius: 12, padding: '14px 18px' }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#92400E', letterSpacing: 2 }}>{selected.gold_card_code}</div>
                  <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>
                    {selected.gold_card_uses} / {selected.bonus_threshold} ташриф → бонус
                  </div>
                </div>
                <Star size={32} color="#F59E0B" fill="#F59E0B" />
              </div>
            </div>

            {/* Referral cards */}
            {selected.cards?.filter(c => c.card_type === 'regular').length > 0 && (
              <div className="adm-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>
                  💳 Реферал карталар ({selected.cards.filter(c => c.card_type === 'regular').length} та)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                  {selected.cards.filter(c => c.card_type === 'regular').map(card => (
                    <div key={card.id} style={{
                      padding: '10px 12px', borderRadius: 9, border: '1.5px solid',
                      borderColor: card.is_active ? '#E5E7EB' : '#F3F4F6',
                      background: card.is_active ? 'white' : '#F9FAFB',
                      opacity: card.is_active ? 1 : 0.6,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <CreditCard size={13} color={card.is_active ? '#FF6B35' : '#9CA3AF'} />
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', letterSpacing: 1 }}>{card.card_code}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>Ишлатилди: {card.use_count}×</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bonuses */}
            {bonuses.length > 0 && (
              <div className="adm-card">
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 12 }}>🎁 Бонуслар ({bonuses.length})</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {bonuses.map(b => (
                    <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 9, background: b.used ? '#F9FAFB' : '#F0FDF4', border: `1px solid ${b.used ? '#F3F4F6' : '#BBF7D0'}` }}>
                      <Gift size={16} color={b.bonus_type === 'gold_meal' ? '#F59E0B' : '#10B981'} />
                      <span style={{ flex: 1, fontSize: 13, color: '#374151' }}>{b.description}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{b.amount?.toLocaleString()} сум</span>
                      <span className={`adm-badge ${b.used ? 'adm-badge-gray' : 'adm-badge-green'}`}>
                        {b.used ? 'Ишлатилди' : 'Актив'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF', gap: 12 }}>
            <Users size={56} opacity={0.25} />
            <p style={{ fontSize: 15 }}>Агентни рўйхатдан танланг</p>
          </div>
        )}
      </div>

      {/* Create modal */}
      {modal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="adm-modal">
            <div className="adm-modal-header">
              <h2>Янги агент яратиш</h2>
              <button onClick={() => setModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={create}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Исм *</label>
                  <input className="adm-input" value={form.name} onChange={f('name')} required />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Телефон</label>
                  <input className="adm-input" value={form.phone} onChange={f('phone')} placeholder="+998..." />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Реферал карта сони</label>
                  <input className="adm-input" type="number" value={form.regular_card_count} onChange={f('regular_card_count')} min="1" max="100" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Чегирма (сум)</label>
                  <input className="adm-input" type="number" value={form.discount_amount} onChange={f('discount_amount')} min="0" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Олтин бонус (ташриф)</label>
                  <input className="adm-input" type="number" value={form.bonus_threshold} onChange={f('bonus_threshold')} min="1" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Реферал бонус (ишлатиш)</label>
                  <input className="adm-input" type="number" value={form.referral_bonus_threshold} onChange={f('referral_bonus_threshold')} min="1" />
                </div>
              </div>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: '4px 0 0' }}>Агентга автоматик 7 рақамли код ва QR карталар берилади</p>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setModal(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={saving}>
                  <Check size={16} /> {saving ? 'Яратилмоқда...' : 'Яратиш'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {editModal && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setEditModal(false)}>
          <div className="adm-modal">
            <div className="adm-modal-header">
              <h2>Агент маълумотларини ўзгартириш</h2>
              <button onClick={() => setEditModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={saveEdit}>
              <div className="adm-form-row">
                <div className="adm-field">
                  <label className="adm-label">Исм *</label>
                  <input className="adm-input" value={editForm.name} onChange={ef('name')} required />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Телефон</label>
                  <input className="adm-input" value={editForm.phone} onChange={ef('phone')} placeholder="+998..." />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Чегирма (сум)</label>
                  <input className="adm-input" type="number" value={editForm.discount_amount} onChange={ef('discount_amount')} min="0" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Олтин бонус (ташриф сони)</label>
                  <input className="adm-input" type="number" value={editForm.bonus_threshold} onChange={ef('bonus_threshold')} min="1" />
                </div>
                <div className="adm-field">
                  <label className="adm-label">Реферал бонус (ишлатиш сони)</label>
                  <input className="adm-input" type="number" value={editForm.referral_bonus_threshold} onChange={ef('referral_bonus_threshold')} min="1" />
                </div>
              </div>
              <div className="adm-modal-footer">
                <button type="button" className="adm-btn adm-btn-secondary" onClick={() => setEditModal(false)}>Бекор</button>
                <button type="submit" className="adm-btn adm-btn-primary" disabled={editSaving}>
                  <Check size={16} /> {editSaving ? 'Сақланмоқда...' : 'Сақлаш'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="adm-overlay" onClick={e => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="adm-modal" style={{ maxWidth: 380 }}>
            <div className="adm-modal-header">
              <h2>Агентни ўчириш</h2>
              <button onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <div style={{ padding: '16px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: '#FEF2F2', borderRadius: 10, marginBottom: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 size={20} color="#EF4444" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 15 }}>{deleteConfirm.name}</div>
                  <div style={{ fontSize: 13, color: '#6B7280' }}>#{deleteConfirm.code}</div>
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#374151', margin: '0 0 4px' }}>
                Ушбу агентни ҳамда унинг барча карталари, транзакциялари ва бонусларини ўчирмоқчимисиз?
              </p>
              <p style={{ fontSize: 13, color: '#EF4444', margin: 0, fontWeight: 600 }}>Бу амал қайтарилмайди!</p>
            </div>
            <div className="adm-modal-footer">
              <button className="adm-btn adm-btn-secondary" onClick={() => setDeleteConfirm(null)}>Бекор</button>
              <button
                className="adm-btn"
                onClick={() => deleteAgent(deleteConfirm)}
                disabled={deleting}
                style={{ background: '#EF4444', color: 'white', display: 'flex', alignItems: 'center', gap: 6 }}
              >
                <Trash2 size={15} /> {deleting ? 'Ўчирилмоқда...' : 'Ҳа, ўчириш'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
