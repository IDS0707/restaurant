import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { authAPI } from '../../api'
import toast from 'react-hot-toast'

export default function AdminLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)

  if (localStorage.getItem('eco_taomlar_token')) {
    return <Navigate to="/admin/dashboard" replace />
  }

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await authAPI.login(username, password)
      localStorage.setItem('eco_taomlar_token', res.data.token)
      navigate('/admin/dashboard', { replace: true })
    } catch {
      toast.error('Нотўғри логин ёки парол')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #FF6B35 0%, #E85A24 40%, #C94010 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '48px 44px',
        width: '100%',
        maxWidth: '420px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{ fontSize: '56px', marginBottom: '12px' }}>🍽️</div>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#111827', margin: 0 }}>ECO taomlar</h1>
          <p style={{ fontSize: '14px', color: '#6B7280', marginTop: '6px' }}>Бошқарув панелига кириш</p>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              Логин
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Логинни киритинг"
              required
              autoComplete="username"
              style={{
                width: '100%', padding: '12px 16px', fontSize: '14px',
                border: '1.5px solid #E5E7EB', borderRadius: '10px',
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={e => e.target.style.borderColor = '#FF6B35'}
              onBlur={e => e.target.style.borderColor = '#E5E7EB'}
            />
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
              Парол
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Паролни киритинг"
                required
                autoComplete="current-password"
                style={{
                  width: '100%', padding: '12px 48px 12px 16px', fontSize: '14px',
                  border: '1.5px solid #E5E7EB', borderRadius: '10px',
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'Inter, sans-serif',
                }}
                onFocus={e => e.target.style.borderColor = '#FF6B35'}
                onBlur={e => e.target.style.borderColor = '#E5E7EB'}
              />
              <button
                type="button"
                onClick={() => setShowPass(s => !s)}
                style={{
                  position: 'absolute', right: '14px', top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#9CA3AF', fontSize: '16px', padding: '4px',
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '14px', fontSize: '16px', fontWeight: 700,
              background: loading ? '#9CA3AF' : 'linear-gradient(135deg, #FF6B35, #E85A24)',
              color: 'white', border: 'none', borderRadius: '12px',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 16px rgba(255,107,53,0.4)',
              fontFamily: 'Inter, sans-serif',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⏳ Кириш...' : '🔐 Кириш'}
          </button>
        </form>
      </div>
    </div>
  )
}
