import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { agentAPI } from '../api'
import { getAgent, setAgent as storeAgent } from '../agentStore'
import QRCode from 'react-native-qrcode-svg'

const fmt = (iso) => {
  const d = new Date(iso)
  return `${d.getDate().toString().padStart(2,'0')}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getFullYear()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
}

export default function HomeScreen() {
  const initial = getAgent()
  const [agent, setAgent] = useState(initial)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    if (!agent) return
    setLoading(true)
    try {
      const [ar, hr] = await Promise.all([
        agentAPI.getByCode(agent.code),
        agentAPI.getHistory(agent.code),
      ])
      setAgent(ar.data)
      storeAgent(ar.data)
      setHistory(hr.data || [])
    } catch {}
    finally { setLoading(false) }
  }

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  if (!agent) return null

  const goldVisits = (agent.gold_card_uses || 0) % (agent.bonus_threshold || 10)
  const threshold = agent.bonus_threshold || 10
  const progress = Math.min(goldVisits / threshold, 1)

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerHello}>Xush kelibsiz 👋</Text>
          <Text style={s.headerName}>{agent.name}</Text>
        </View>
        <View style={s.headerBadge}>
          <Ionicons name="star" size={14} color="#C47A1B" />
          <Text style={s.headerBadgeText}>Agent #{agent.code}</Text>
        </View>
      </View>

      {loading ? (
        <View style={s.loadBox}>
          <ActivityIndicator color="#E8621A" size="large" />
          <Text style={s.loadText}>Yuklanmoqda...</Text>
        </View>
      ) : (
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollInner}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#E8621A" colors={['#E8621A']} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Gold Card */}
          <View style={s.goldCard}>
            <View style={s.goldCardHeader}>
              <View>
                <View style={s.goldLabelRow}>
                  <Ionicons name="star" size={16} color="#C47A1B" />
                  <Text style={s.goldLabel}>Gold Karta</Text>
                </View>
                <Text style={s.goldCode}>{agent.gold_card_code}</Text>
              </View>
              <View style={s.qrBox}>
                <QRCode value={agent.gold_card_code || 'N/A'} size={80} color="#2D1507" backgroundColor="white" />
              </View>
            </View>

            {/* Progress */}
            <View style={s.progressSection}>
              <View style={s.progressRow}>
                <Text style={s.progressLabel}>{goldVisits} / {threshold} tashrif</Text>
                <Text style={s.progressPct}>{Math.round(progress * 100)}%</Text>
              </View>
              <View style={s.track}>
                <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={s.progressHint}>
                {threshold - goldVisits} ta tashrifdan keyin {(agent.discount_amount || 0).toLocaleString()} so'm bonus
              </Text>
            </View>

            {/* QR hint */}
            <View style={s.scanHint}>
              <Ionicons name="scan-outline" size={14} color="#8B6B50" />
              <Text style={s.scanHintText}>Kassada QR kodni skaner qiling</Text>
            </View>
          </View>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Text style={s.statVal}>{agent.gold_card_uses || 0}</Text>
              <Text style={s.statLabel}>Jami tashriflar</Text>
            </View>
            <View style={[s.statBox, s.statBoxMid]}>
              <Text style={s.statVal}>{agent.referral_card_total_uses || 0}</Text>
              <Text style={s.statLabel}>Referal foydalanish</Text>
            </View>
            <View style={s.statBox}>
              <Text style={[s.statVal, { color: '#1E8B4E' }]}>{(agent.discount_amount || 0).toLocaleString()}</Text>
              <Text style={s.statLabel}>Chegirma (so'm)</Text>
            </View>
          </View>

          {/* History */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>🕐 Tashrif tarixi</Text>
            {history.length === 0 ? (
              <View style={s.emptyBox}>
                <Text style={s.emptyEmoji}>🍽️</Text>
                <Text style={s.emptyText}>Hali tashrif yo'q</Text>
                <Text style={s.emptySub}>Birinchi tashrifingizdan keyin bu yerda ko'rsatiladi</Text>
              </View>
            ) : (
              history.map((h, i) => (
                <View key={h.id || i} style={s.histRow}>
                  <View style={[s.histIcon, h.card_type === 'gold' ? s.histGold : s.histReg]}>
                    <Ionicons
                      name={h.card_type === 'gold' ? 'star' : 'card'}
                      size={15}
                      color={h.card_type === 'gold' ? '#C47A1B' : '#E8621A'}
                    />
                  </View>
                  <View style={s.histInfo}>
                    <Text style={s.histOrder}>Buyurtma #{h.order_code}</Text>
                    <Text style={s.histType}>{h.card_type === 'gold' ? 'Gold karta' : 'Referal karta'}</Text>
                    <Text style={s.histDate}>{fmt(h.created_at)}</Text>
                  </View>
                  {h.discount_applied > 0 && (
                    <View style={s.discBadge}>
                      <Text style={s.discText}>-{h.discount_applied.toLocaleString()} so'm</Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF5EE' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5DDD0',
  },
  headerHello: { fontSize: 12, color: '#8B6B50', fontWeight: '500' },
  headerName: { fontSize: 18, fontWeight: '800', color: '#2D1507' },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF0E0', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: '#F5DDD0',
  },
  headerBadgeText: { fontSize: 12, color: '#C47A1B', fontWeight: '700' },

  loadBox: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadText: { fontSize: 14, color: '#8B6B50' },

  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 32 },

  goldCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 14,
    borderWidth: 1.5, borderColor: '#F0C070',
    shadowColor: '#C47A1B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 4,
  },
  goldCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  goldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  goldLabel: { fontSize: 13, fontWeight: '700', color: '#C47A1B' },
  goldCode: { fontSize: 20, fontWeight: '900', color: '#2D1507', letterSpacing: 0.5 },
  qrBox: {
    padding: 8, backgroundColor: 'white', borderRadius: 12,
    borderWidth: 1, borderColor: '#F5DDD0',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },

  progressSection: { marginBottom: 14 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 13, fontWeight: '700', color: '#5C3A1E' },
  progressPct: { fontSize: 13, fontWeight: '700', color: '#C47A1B' },
  track: { height: 8, backgroundColor: '#F5EBD8', borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  fill: { height: '100%', backgroundColor: '#C47A1B', borderRadius: 4 },
  progressHint: { fontSize: 12, color: '#8B6B50' },

  scanHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF8EE', borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: '#F5EBD8',
  },
  scanHintText: { fontSize: 12, color: '#8B6B50' },

  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 16,
    marginBottom: 14, borderWidth: 1, borderColor: '#F5DDD0', overflow: 'hidden',
  },
  statBox: { flex: 1, alignItems: 'center', padding: 14 },
  statBoxMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: '#F5DDD0' },
  statVal: { fontSize: 20, fontWeight: '900', color: '#2D1507', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#8B6B50', textAlign: 'center' },

  section: { marginTop: 4 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#2D1507', marginBottom: 12 },

  emptyBox: { alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#F5DDD0' },
  emptyEmoji: { fontSize: 36, marginBottom: 10 },
  emptyText: { fontSize: 15, fontWeight: '700', color: '#5C3A1E', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#B8A098', textAlign: 'center' },

  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    borderWidth: 1, borderColor: '#F5DDD0',
    shadowColor: '#C47A1B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 1,
  },
  histIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  histGold: { backgroundColor: '#FFF5D6' },
  histReg: { backgroundColor: '#FFF0E8' },
  histInfo: { flex: 1 },
  histOrder: { fontSize: 13, fontWeight: '700', color: '#2D1507' },
  histType: { fontSize: 11, color: '#C47A1B', fontWeight: '600', marginTop: 1 },
  histDate: { fontSize: 11, color: '#B8A098', marginTop: 2 },
  discBadge: { backgroundColor: '#E8F5EE', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#B8E0C8' },
  discText: { fontSize: 12, fontWeight: '800', color: '#1E8B4E' },
})
