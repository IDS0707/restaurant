# APK qurish — ECO taomlar mijoz ilovasi

`/shop` sahifa allaqachon **brauzerda** ishlaydi: telefondan `https://...your-tunnel.../shop` ochiib foydalansa bo'ladi. Lekin ona ilova APK kerak bo'lsa — quyidagi qadamlar.

## Sizda kerak bo'lganlar
- ✅ Node.js (bor)
- ✅ Android Studio (bor)
- ✅ JDK 17+ (Android Studio bilan birga keladi)

## Birinchi marta sozlash

Lokal kompyuteringizda (PowerShell):

```powershell
cd C:\Users\secre\Desktop\restaurant\ISP-resturant-main\frontend

# 1. Yangi bog'liqliklarni o'rnatish
npm install

# 2. Web build
npm run build

# 3. Android platformani qo'shish (birinchi marta)
npx cap add android

# 4. Buildni Capacitor android'iga sinxron qilish
npx cap sync android
```

## Android Studio orqali APK build

```powershell
# Android Studio'da loyihani ochish
npx cap open android
```

Android Studio ochiladi. Birinchi safar Gradle sync 5-10 daqiqa ketadi.

So'ng yuqori menyuda:
- **Build** → **Build Bundle(s) / APK(s)** → **Build APK(s)**
- Pastda «APK(s) generated successfully. **locate**» linki chiqadi
- Bosing — APK fayl ochiladi: `android/app/build/outputs/apk/debug/app-debug.apk`

APK telefonga o'rnatib sinab ko'ring.

## Production APK (signed, Play Store uchun)

`Build → Generate Signed Bundle / APK → APK` ni tanlang, keyin keystore yarating (parol eslab qolasiz!) → build.

## Kod yangilanishi

Frontendni o'zgartirsangiz:
```powershell
npm run android:sync
```
Keyin Android Studio'da yana build qilasiz.

## Konfiguratsiya

`frontend/capacitor.config.json`:
- `appId`: `uz.ecotaomlar.shop` — package nomi (o'zgartirish mumkin)
- `appName`: `ECO taomlar` — APK nomi
- `server.url`: hozir Cloudflare tunnel URL'siga sozlangan — bu o'zgarganda yangilash kerak

## Eslatma

- Tunnel URL doim o'zgaradi. Production'da **doimiy domen** (`yourdomain.com`) olib, `server.url`'ni o'shanga qaratishingiz kerak.
- Ilova orqali joylashuvni so'rashda **Android telefonda «Allow Location»** chiqadi.
- Sinash uchun: `/shop` sahifani avval brauzerda oching, hammasi to'g'ri ishlaganini ko'ring — keyin APK build qiling.
