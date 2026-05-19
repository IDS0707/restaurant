import React from 'react'
import { useNavigate } from 'react-router-dom'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="home-page">
      <div className="home-pattern" />
      <div className="home-content">
        <div className="home-hero">
          <div className="home-emoji-row">
            🍽️ 🥘 🍜
          </div>
          <h1>ECO taomlar</h1>
          <p>Milliy taomlar kafesi boshqaruv tizimi</p>
          <div className="home-divider" />
        </div>

        <div className="home-panels">
          <button className="home-panel" onClick={() => navigate('/cashier')}>
            <div className="panel-emoji">🧾</div>
            <h2>Kassir</h2>
            <p>Buyurtma qabul qilish va to'lov</p>
            <span className="panel-arrow">→</span>
          </button>

          <button className="home-panel" onClick={() => navigate('/kitchen')}>
            <div className="panel-emoji">👨‍🍳</div>
            <h2>Oshpazxona</h2>
            <p>Buyurtmalarni ko'rish va tayyorlash</p>
            <span className="panel-arrow">→</span>
          </button>

          <button className="home-panel" onClick={() => navigate('/admin')}>
            <div className="panel-emoji">⚙️</div>
            <h2>Boshqaruv</h2>
            <p>Admin paneli va analitika</p>
            <span className="panel-arrow">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}
