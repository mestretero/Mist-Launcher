# Stealike Geliştirme Kuralları

Bu dosya yapay zeka asistanlarının ve geliştiricilerin uyması gereken kuralları içerir.

---

## 1. Çoklu Dil (i18n) Zorunluluğu

- Eklenen **her yeni sayfa, component ve özellik** 4 dilde (TR/EN/DE/ES) olmak **zorundadır**.
- Hardcoded metin **kesinlikle yasaktır**. Tüm UI string'leri `t("key")` ile çekilmelidir.
- Yeni key'ler `src/i18n/locales/` altındaki **4 dosyanın hepsine** aynı anda eklenmelidir.
- Tarih, saat ve sayı formatları da i18n uyumlu olmalıdır.

## 2. UTF-8 Karakter Kodlama

- Tüm dosyalar **UTF-8** kodlamasında olmalıdır.
- Türkçe karakterler (ç, ğ, ı, ö, ş, ü, İ, Ş, Ğ, Ö, Ü, Ç) translation dosyalarında **doğru yazılmalıdır**.
- Almanca (ä, ö, ü, ß), İspanyolca (ñ, á, é, í, ó, ú, ¿, ¡) özel karakterler korunmalıdır.
- JSON dosyalarında Unicode escape kullanılmamalı, doğrudan UTF-8 karakter yazılmalıdır.
- Her yeni sayfa ve özellikte özel karakter gösterimi **test edilmelidir**.
- Bu dosya dahil tüm dokümanlar UTF-8 Türkçe karakterlerle yazılmalıdır.

## 3. UI/UX Tutarlılığı

- Yeni sayfa veya özellik mevcut **karanlık tema** ile uyumlu olmak zorundadır.
- Renk paleti: `#0a0c10`, `#1a1c23`, `#2a2e38`, `#1a9fff` (accent), `#c6d4df` (text).
- Font boyutları, spacing, border radius mevcut component'larla tutarlı olmalıdır.
- Mevcut bir sayfanın **tasarımı değiştirilmeden** yeni özellik eklenmelidir — kullanıcı aksini belirtmedikçe.
- **Küçük görsel iyileştirmeler** (spacing, renk tonu, ikon değişikliği) yapılabilir, ancak sayfanın genel layout'u ve yapısı korunmalıdır.
- Responsive tasarım zorunludur: `lg:` breakpoint'i ile mobil/desktop uyumu sağlanmalıdır.

## 4. Bağlantı ve Routing Kontrolü

- Eklenen her sayfa `App.tsx`'te route olarak tanımlanmış olmalıdır.
- Her navigasyon linki (`onNavigate`) test edilmeli, tıklanabilir ve doğru sayfaya yönlendirmeli.
- `onNavigate` prop'u geçilmeyen component'lar olup olmadığı kontrol edilmelidir.
- Yeni sayfa eklendiğinde TopBar veya ilgili navigasyondan erişilebilir olmalıdır.

## 5. Avatar ve Görsel URL'leri

- Server'dan gelen görsel URL'leri **relative path** olarak gelir (`/public/avatars/...`).
- Frontend'de gösterirken **mutlaka** `http://localhost:3001` prefix'i eklenmelidir.
- Bu kural tüm component'lar için geçerlidir: ProfilePage, FriendsPage, TopBar, CommentWall, UserProfilePage vb.
- Görseller `object-cover` ile gösterilmeli, alt text sağlanmalıdır.

## 6. API Response Mapping

- Server API'den gelen veri formatı ile frontend'in beklediği format **her zaman** kontrol edilmelidir.
- Nested objeler (örn. `friend.sender.username` vs `friend.username`) doğru map'lenmelidir.
- `undefined` ve `null` değerlere karşı guard konulmalıdır — `?.` ve `|| fallback` kullanılmalıdır.

## 7. Tauri Uyumluluğu

- Bu bir **desktop uygulamasıdır**, web değil. `invoke()` ve `listen()` sadece Tauri runtime'da çalışır.
- Tarayıcıda test **yapılamaz** — sadece `npm run tauri dev` ile test edilir.
- Yeni Tauri komutu eklendiğinde `src-tauri/src/lib.rs`'deki `invoke_handler`'a kayıt edilmelidir.
- Yeni plugin eklendiğinde `capabilities/default.json`'a izin eklenmelidir.

## 8. CORS ve HTTP Header'lar

- `DELETE` isteklerinde `Content-Type: application/json` **gönderilmemelidir** (body yoksa Fastify 500 verir).
- Yeni HTTP method kullanıldığında `server/src/app.ts`'teki CORS `methods` listesi kontrol edilmelidir.
- `@fastify/helmet` CSP ayarları cross-origin kaynakları engelleyebilir — yeni static resource eklendiğinde kontrol edilmelidir.

## 9. Veritabanı Kuralları

- Prisma schema'da `@db.Uuid`, `@map()`, `@@map()` convention'ları **tutarlı** kullanılmalıdır.
- Yeni model eklendiğinde `User` modeline gerekli relation'lar eklenmelidir.
- Migration sonrası `npx prisma migrate dev` başarılı çalıştığından emin olunmalıdır.
- Soft delete kullanılan tablolarda `deletedAt` filtresi **her sorguda** kontrol edilmelidir.

## 10. Yerel Oyun Sistemi (SQLite)

- Yerel oyun verileri **asla** server'a gönderilmez — gizlilik kritiktir.
- SQLite işlemleri `Arc<Mutex<Connection>>` pattern'i ile thread-safe olmalıdır.
- `tokio::spawn` içinde SQLite kullanılacaksa `Arc::clone()` ile connection taşınmalıdır.
- Yeni Rust komutu eklendiğinde `scanner/mod.rs`'de modül tanımlanmalı ve `lib.rs`'de kayıt edilmelidir.

## 11. Test ve Doğrulama

- Her değişiklik sonrası `npx tsc --noEmit` ile TypeScript kontrolü yapılmalıdır.
- Rust değişiklikleri için `cd src-tauri && cargo check` çalıştırılmalıdır.
- `npm run build` başarılı olmalıdır — commit öncesi kontrol edilmelidir.
- Server değişiklikleri için server yeniden başlatılmalı ve `/health` endpoint'i kontrol edilmelidir.

## 12. Commit Kuralları

- Her commit tek bir iş birimi içermelidir.
- Commit mesajları `feat:`, `fix:`, `docs:` prefix'leri ile başlamalıdır.
- Büyük değişiklikler için plan + spec dokümanı oluşturulmalıdır (`docs/superpowers/`).

## 13. Performans

- Büyük listeler için pagination kullanılmalıdır (örn. yorumlar, bildirimler).
- Görsel yüklemelerinde `loading="lazy"` kullanılmalıdır.
- Gereksiz re-render önlemek için `useMemo` ve `useCallback` uygun yerlerde kullanılmalıdır.
