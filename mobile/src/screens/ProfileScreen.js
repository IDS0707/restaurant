import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { getAgent } from '../agentStore'
import QRCode from 'react-native-qrcode-svg'

export default function ProfileScreen() {
  const agent = getAgent()
  const [openCard, setOpenCard] = useState(null)

  if (!agent) {
    router.replace('/')
    return null
  }

  const regularCards = agent.cards?.filter(c => c.card_type === 'regular') || []

  const logout = () => router.replace('/')

  const statItems = [
    { icon: 'star', color: '#C47A1B', bg: '#FFF5D6', label: 'Gold tashriflar', val: agent.gold_card_uses || 0 },
    { icon: 'card', color: '#E8621A', bg: '#FFF0E8', label: 'Referal foydalanish', val: agent.referral_card_total_uses || 0 },
    { icon: 'gift', color: '#1E8B4E', bg: '#E8F5EE', label: 'Bonus chegarasi', val: `${agent.bonus_threshold || 10} tashrif` },
    { icon: 'pricetag', color: '#7B5EA7', bg: '#F0EBF8', label: 'Chegirma miqdori', val: `${(agent.discount_amount || 0).toLocaleString()} so'm` },
  ]

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Profil</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <View style={s.profileCard}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{agent.name?.[0]?.toUpperCase() || '?'}</Text>
          </View>
          <Text style={s.name}>{agent.name}</Text>
          {agent.phone ? (
            <View style={s.infoRow}>
              <Ionicons name="call-outline" size={14} color="#8B6B50" />
              <Text style={s.infoText}>{agent.phone}</Text>
            </View>
          ) : null}
          <View style={s.infoRow}>
            <Ionicons name="key-outline" size={14} color="#8B6B50" />
            <Text style={s.infoText}>Agent kodi: #{agent.code}</Text>
          </View>
          <View style={s.goldBadge}>
            <Ionicons name="star" size={14} color="#C47A1B" />
            <Text style={s.goldBadgeText}>{agent.gold_card_code}</Text>
          </View>
        </View>

        {/* Stats */}
        <Text style={s.sectionTitle}>📊 Statistika</Text>
        <View style={s.statsGrid}>
          {statItems.map((item, i) => (
            <View key={i} style={[s.statCard, { borderTopColor: item.color }]}>
              <View style={[s.statIcon, { backgroundColor: item.bg }]}>
                <Ionicons name={item.icon} size={20} color={item.color} />
              </View>
              <Text style={s.statVal}>{item.val}</Text>
              <Text style={s.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Referral Cards */}
        {regularCards.length > 0 && (
          <>
            <Text style={s.sectionTitle}>💳 Referal kartalar ({regularCards.length} ta)</Text>
            <View style={s.cardsWrap}>
              {regularCards.map(card => (
                <View key={card.id}>
                  <TouchableOpacity
                    style={[s.refCard, !card.is_active && s.refCardOff, openCard === card.id && s.refCardOpen]}
                    onPress={() => setOpenCard(openCard === card.id ? null : card.id)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="card-outline" size={16} color={card.is_active ? '#E8621A' : '#C4A896'} />
                    <Text style={[s.refCode, !card.is_active && s.dim]}>{card.card_code}</Text>
                    <Text style={s.refUses}>{card.use_count}×</Text>
                    <Ionicons
                      name={openCard === card.id ? 'chevron-up' : 'chevron-down'}
                      size={14} color="#B8A098"
                    />
                  </TouchableOpacity>
                  {openCard === card.id && (
                    <View style={s.qrExpand}>
                      <Text style={s.qrExpandCode}>{card.card_code}</Text>
                      <View style={s.qrWrap}>
                        <QRCode value={card.card_code} size={130} color="#2D1507" backgroundColor="white" />
                      </View>
                      <Text style={s.qrHint}>Kassaga bu QR kodni ko'rsating</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </>
        )}

        {/* Info */}
        <View style={s.infoCard}>
          {[
            { label: 'Referal karta soni', val: `${agent.regular_card_count || 0} ta` },
            { label: 'Referal bonus chegarasi', val: `${agent.referral_bonus_threshold || 0} marta` },
            { label: 'Jami bonus', val: `${(agent.total_bonus_earned || 0).toLocaleString()} so'm` },
          ].map((row, i) => (
            <View key={i} style={[s.infoLine, i > 0 && s.infoLineBorder]}>
              <Text style={s.infoLineLabel}>{row.label}</Text>
              <Text style={s.infoLineVal}>{row.val}</Text>
            </View>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#C0392B" />
          <Text style={s.logoutText}>Chiqish</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF5EE' },

  header: {
    paddingHorizontal: 20, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F5DDD0',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#2D1507' },

  scroll: { flex: 1 },
  scrollInner: { padding: 16, paddingBottom: 36 },

  profileCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    alignItems: 'center', marginBottom: 20,
    borderWidth: 1, borderColor: '#F5DDD0',
    shadowColor: '#C47A1B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 14, elevation: 3,
  },
  avatar: {
    width: 76, height: 76, borderRadius: 22,
    backgroundColor: '#FFF0E0', borderWidth: 2, borderColor: '#E8621A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 34, fontWeight: '900', color: '#E8621A' },
  name: { fontSize: 22, fontWeight: '800', color: '#2D1507', marginBottom: 10 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  infoText: { fontSize: 14, color: '#8B6B50' },
  goldBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FFF5D6', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7, marginTop: 10,
    borderWidth: 1, borderColor: '#F0C070',
  },
  goldBadgeText: { fontSize: 13, fontWeight: '800', color: '#C47A1B' },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#2D1507', marginBottom: 12, marginTop: 4 },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#FFFFFF',
    borderRadius: 14, padding: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#F5DDD0', borderTopWidth: 3,
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statVal: { fontSize: 18, fontWeight: '900', color: '#2D1507', marginBottom: 3 },
  statLabel: { fontSize: 11, color: '#8B6B50', textAlign: 'center' },

  cardsWrap: { marginBottom: 20, gap: 6 },
  refCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#F5DDD0',
  },
  refCardOff: { opacity: 0.5 },
  refCardOpen: { borderColor: '#E8621A', backgroundColor: '#FFF8F5' },
  refCode: { flex: 1, fontSize: 13, fontWeight: '700', color: '#2D1507' },
  refUses: { fontSize: 12, color: '#B8A098' },
  dim: { color: '#C4A896' },
  qrExpand: {
    backgroundColor: '#FFFAF7', borderRadius: 12, padding: 20,
    alignItems: 'center', marginTop: 4,
    borderWidth: 1, borderColor: '#F0DDD0',
  },
  qrExpandCode: { fontSize: 13, fontWeight: '700', color: '#C47A1B', marginBottom: 14 },
  qrWrap: { padding: 10, backgroundColor: 'white', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#F5DDD0' },
  qrHint: { fontSize: 11, color: '#B8A098' },

  infoCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#F5DDD0', overflow: 'hidden', marginBottom: 20,
  },
  infoLine: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, alignItems: 'center' },
  infoLineBorder: { borderTopWidth: 1, borderTopColor: '#F9F5F2' },
  infoLineLabel: { fontSize: 13, color: '#8B6B50' },
  infoLineVal: { fontSize: 13, fontWeight: '700', color: '#2D1507' },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#FEF0EE', borderRadius: 14, paddingVertical: 15,
    borderWidth: 1.5, borderColor: '#F5C5C0',
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#C0392B' },
})
