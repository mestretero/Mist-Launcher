# Stealike Gelistirme Kurallari

Bu dosya yapay zeka asistanlarinin ve gelistiricilerin uymas gereken kurallari icerir.

---

## 1. Coklu Dil (i18n) Zorunlulugu

- Eklenen **her yeni sayfa, component ve ozellik** 4 dilde (TR/EN/DE/ES) olmak **zorundadir**.
- Hardcoded metin **kesinlikle yasaktir**. Tum UI string'leri `t("key")` ile cekilmelidir.
- Yeni key'ler `src/i18n/locales/` altindaki **4 dosyanin hepsine** ayni anda eklenmelidir.
- Tarih, saat ve sayi formatlari da i18n uyumlu olmalidir.

## 2. UI/UX Tutarliligi

- Yeni sayfa veya ozellik mevcut **karanlik tema** ile uyumlu olmak zorundadir.
- Renk paleti: `#0a0c10`, `#1a1c23`, `#2a2e38`, `#1a9fff` (accent), `#c6d4df` (text).
- Font boyutlari, spacing, border radius mevcut component'larla tutarli olmalidir.
- Mevcut bir sayfanin **tasarimi degistirilmeden** yeni ozellik eklenmelidir — kullanici aksini belirtmedikce.
- Responsive tasarim zorunludur: `lg:` breakpoint'i ile mobil/desktop uyumu saglanmalidir.

## 3. Baglanti ve Routing Kontrolu

- Eklenen her sayfa `App.tsx`'te route olarak tanimlanmis olmalidir.
- Her navigasyon linki (`onNavigate`) test edilmeli, tiklanabilir ve dogru sayfaya yonlendirmeli.
- `onNavigate` prop'u gecilmeyen component'lar olup olmadigi kontrol edilmelidir.
- Yeni sayfa eklendiginde TopBar veya ilgili navigasyondan erisilebilir olmalidir.

## 4. Avatar ve Gorsel URL'leri

- Server'dan gelen gorsel URL'leri **relative path** olarak gelir (`/public/avatars/...`).
- Frontend'de gosterirken **mutlaka** `http://localhost:3001` prefix'i eklenmelidir.
- Bu kural tum component'lar icin gecerlidir: ProfilePage, FriendsPage, TopBar, CommentWall, UserProfilePage vb.
- Gorseller `object-cover` ile gosterilmeli, alt text saglanmalidir.

## 5. API Response Mapping

- Server API'den gelen veri formati ile frontend'in bekledigu format **her zaman** kontrol edilmelidir.
- Nested objeler (orn. `friend.sender.username` vs `friend.username`) dogru map'lenmelidir.
- `undefined` ve `null` degerlere karsi guard konulmalidir — `?.` ve `|| fallback` kullanilmalidir.

## 6. Tauri Uyumlulugu

- Bu bir **desktop uygulamasidir**, web degil. `invoke()` ve `listen()` sadece Tauri runtime'da calisir.
- Tarayicida test **yapilamaz** — sadece `npm run tauri dev` ile test edilir.
- Yeni Tauri komutu eklendiginde `src-tauri/src/lib.rs`'deki `invoke_handler`'a kayit edilmelidir.
- Yeni plugin eklendiginde `capabilities/default.json`'a izin eklenmelidir.

## 7. CORS ve HTTP Header'lar

- `DELETE` isteklerinde `Content-Type: application/json` **gonderilmemelidir** (body yoksa Fastify 500 verir).
- Yeni HTTP method kullanildiginda `server/src/app.ts`'teki CORS `methods` listesi kontrol edilmelidir.
- `@fastify/helmet` CSP ayarlari cross-origin kaynaklari engelleyebilir — yeni static resource eklendiginde kontrol edilmelidir.

## 8. Veritabani Kurallari

- Prisma schema'da `@db.Uuid`, `@map()`, `@@map()` convention'lari **tutarli** kullanilmalidir.
- Yeni model eklendiginde `User` modeline gerekli relation'lar eklenmelidir.
- Migration sonrasi `npx prisma migrate dev` basarili calistigindan emin olunmalidir.
- Soft delete kullanilan tablolarda `deletedAt` filtresi **her sorguda** kontrol edilmelidir.

## 9. Yerel Oyun Sistemi (SQLite)

- Yerel oyun verileri **asla** server'a gonderilmez — gizlilik kritiktir.
- SQLite islemleri `Arc<Mutex<Connection>>` pattern'i ile thread-safe olmalidir.
- `tokio::spawn` icinde SQLite kullanilacaksa `Arc::clone()` ile connection tasinmalidir.
- Yeni Rust komutu eklendiginde `scanner/mod.rs`'de modul tanimlanmali ve `lib.rs`'de kayit edilmelidir.

## 10. Test ve Dogrulama

- Her degisiklik sonrasi `npx tsc --noEmit` ile TypeScript kontrolu yapilmalidir.
- Rust degisiklikleri icin `cd src-tauri && cargo check` calistirilmalidir.
- `npm run build` basarili olmalidir — commit oncesi kontrol edilmelidir.
- Server degisiklikleri icin server yeniden baslatilmali ve `/health` endpoint'i kontrol edilmelidir.

## 11. Commit Kurallari

- Her commit tek bir is birimi icermelidir.
- Commit mesajlari `feat:`, `fix:`, `docs:` prefix'leri ile baslamalidir.
- Buyuk degisiklikler icin plan + spec dokumani olusturulmalidir (`docs/superpowers/`).

## 12. Performans

- Buyuk listeler icin pagination kullanilmalidir (orn. yorumlar, bildirimler).
- Gorsel yuklemelerinde `loading="lazy"` kullanilmalidir.
- Gereksiz re-render onlemek icin `useMemo` ve `useCallback` uygun yerlerde kullanilmalidir.
