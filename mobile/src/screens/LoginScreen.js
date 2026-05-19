import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar,
} from 'react-native'
import { router } from 'expo-router'
import { agentAPI } from '../api'
import { setAgent } from '../agentStore'
import Toast from 'react-native-toast-message'

export default function LoginScreen() {
  const [phone, setPhone] = useState('')
  const [goldCode, setGoldCode] = useState('')
  const [loading, setLoading] = useState(false)

  const handleGoldInput = (text) => {
    const upper = text.toUpperCase()
    if (upper.startsWith('GOLD-')) {
      const digits = upper.slice(5).replace(/[^0-9]/g, '').slice(0, 8)
      setGoldCode('GOLD-' + digits)
    } else {
      const digits = text.replace(/[^0-9]/g, '').slice(0, 8)
      setGoldCode(digits.length > 0 ? 'GOLD-' + digits : '')
    }
  }

  const enter = async () => {
    if (phone.trim().length < 9) {
      Toast.show({ type: 'error', text1: 'Xato', text2: "Telefon raqamni to'liq kiriting" })
      return
    }
    const code = goldCode.trim()
    if (!code.startsWith('GOLD-') || code.length < 12) {
      Toast.show({ type: 'error', text1: 'Xato', text2: 'Gold karta kodini kiriting (GOLD-XXXXXXXX)' })
      return
    }
    setLoading(true)
    try {
      const res = await agentAPI.getByCode(code)
      const agent = res.data
      const normalize = (p) => p.replace(/[\s\-\(\)\+]/g, '')
      if (agent.phone && normalize(agent.phone) !== normalize(phone.trim())) {
        Toast.show({ type: 'error', text1: 'Xato', text2: "Telefon raqam yoki Gold karta kodi noto'g'ri" })
        return
      }
      setAgent(agent)
      router.replace('/(tabs)')
    } catch {
      Toast.show({ type: 'error', text1: 'Topilmadi', text2: 'Gold karta kodi yoki telefon raqamni tekshiring' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFF5EE" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

          {/* Header decoration */}
          <View style={s.topDecor}>
            <View style={s.decCircle1} />
            <View style={s.decCircle2} />
          </View>

          {/* Logo */}
          <View style={s.logoArea}>
            <View style={s.logoBox}>
              <Text style={s.logoEmoji}>🥘</Text>
            </View>
            <Text style={s.appName}>ECO taomlar</Text>
            <Text style={s.tagline}>Milliy taomlar • Agent portali</Text>
            <View style={s.tagsRow}>
              <View style={s.tag}><Text style={s.tagText}>🍽️ Cafe</Text></View>
              <View style={s.tag}><Text style={s.tagText}>⭐ Referral</Text></View>
              <View style={s.tag}><Text style={s.tagText}>🎁 Bonus</Text></View>
            </View>
          </View>

          {/* Login Card */}
          <View style={s.card}>
            <Text style={s.cardTitle}>Tizimga kirish</Text>
            <Text style={s.cardSub}>Telefon raqam va Gold karta kodingizni kiriting</Text>

            <View style={s.field}>
              <Text style={s.label}>📱 Telefon raqam</Text>
              <TextInput
                style={s.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+998 90 000 00 00"
                placeholderTextColor="#C4A990"
                keyboardType="phone-pad"
                autoCorrect={false}
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>⭐ Gold karta kodi</Text>
              <TextInput
                style={[s.input, s.goldInput]}
                value={goldCode}
                onChangeText={handleGoldInput}
                placeholder="GOLD-00000000"
                placeholderTextColor="#C4A990"
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Text style={s.inputHint}>8 ta raqamli Gold karta kodi</Text>
            </View>

            <TouchableOpacity
              style={[s.btn, loading && s.btnOff]}
              onPress={enter}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="white" size="small" />
                : <Text style={s.btnText}>Kirish →</Text>}
            </TouchableOpacity>
          </View>

          <Text style={s.footer}>Gold karta kodini kassa xodimidan oling</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  )
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFF5EE' },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24, paddingTop: 48 },

  topDecor: { position: 'absolute', top: 0, right: 0, left: 0 },
  decCircle1: {
    position: 'absolute', width: 220, height: 220, borderRadius: 110,
    backgroundColor: 'rgba(232,98,26,0.08)', top: -60, right: -60,
  },
  decCircle2: {
    position: 'absolute', width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(196,122,27,0.07)', top: 30, right: 80,
  },

  logoArea: { alignItems: 'center', marginBottom: 28 },
  logoBox: {
    width: 90, height: 90, borderRadius: 26,
    backgroundColor: '#FFF0E0',
    borderWidth: 2, borderColor: '#E8621A',
    alignItems: 'center', justifyContent: 'center', marginBottom: 14,
    shadowColor: '#E8621A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  logoEmoji: { fontSize: 42 },
  appName: { fontSize: 28, fontWeight: '800', color: '#2D1507', marginBottom: 4 },
  tagline: { fontSize: 13, color: '#8B6B50', fontWeight: '500', marginBottom: 14 },
  tagsRow: { flexDirection: 'row', gap: 8 },
  tag: {
    backgroundColor: '#FFF0E0', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: '#F5DDD0',
  },
  tagText: { fontSize: 12, color: '#C47A1B', fontWeight: '600' },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 22, padding: 24,
    shadowColor: '#C47A1B', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1, shadowRadius: 18, elevation: 5,
    borderWidth: 1, borderColor: '#F5DDD0', marginBottom: 16,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#2D1507', textAlign: 'center', marginBottom: 4 },
  cardSub: { fontSize: 12, color: '#8B6B50', textAlign: 'center', marginBottom: 22 },

  field: { marginBottom: 16 },
  label: { fontSize: 13, color: '#5C3A1E', fontWeight: '700', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: '#F0DDD0', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    fontSize: 15, color: '#2D1507', backgroundColor: '#FFFAF7',
  },
  goldInput: { fontWeight: '800', fontSize: 18, letterSpacing: 1.5, color: '#C47A1B' },
  inputHint: { fontSize: 11, color: '#B8A098', marginTop: 5, marginLeft: 2 },

  btn: {
    backgroundColor: '#E8621A', borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 6,
    shadowColor: '#E8621A', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 10, elevation: 5,
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '800', fontSize: 16 },

  footer: { textAlign: 'center', fontSize: 12, color: '#C4A896', marginTop: 8 },
})
