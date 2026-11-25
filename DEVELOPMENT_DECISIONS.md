# AquaTwin yazılım geliştirme kararları

## 2026-11-25 — Ölçüm API temeli

Bu kararları mevcut React/Three.js prototipini ilerletmek için aldım. Donanım henüz teslim edilmedi; sensör modeli ve fiziksel kontrol protokolü varsayılmıyor.

1. React/Vite arayüzünü koruyup Python FastAPI ve PostgreSQL ekliyorum. Aynı repoda `backend/` kullanılacak.
2. Önce kalıcı ölçüm akışını tamamlıyorum: harici örnek üretici → API → PostgreSQL → tablo/3D. MQTT ve fiziksel komutlar bu aşamanın dışında.
3. Demo ve API çalışma alanları ayrı tutulacak. API erişilemezken sessizce demo verisine dönülmeyecek. API ekranındaki 3D gölet şematiktir.
4. Veri sözleşmesi sürümlü; görev ve ölçüm UUID ile tanımlanacak. UTC ölçüm zamanı ve sunucu alım zamanı ayrı. Hedef ve gerçek derinlik ayrı.
5. Sensör parametreleri isteğe bağlı; eksik değer sıfırla doldurulmayacak. Her parametrede birim ve sensör kimliği bulunacak. Genel kalite durumu ve gerekçe korunacak; gerçek sensör eşikleri henüz belirlenmedi.
6. Kaynak `simulated` veya `device`; bir görev iki kaynağı karıştıramayacak. Kimlik tekrar gönderildiğinde aynı içerik tek kayıt; değişik içerik 409 olacak.
7. GNSS ile yerel metre koordinatları ayrı. Şimdilik yalnız `demo-pond-v1` referanslı yerel noktalar mevcut şematik 3D sahneye yerleştirilecek. GNSS-only kayıt tabloya gelir; sahte dönüşüm yapılmaz.
8. API modu izleme içindir: gerçek bot hareketi, vinç durumu veya komut başarısı animasyondan türetilmeyecek.
9. PostgreSQL tek kalıcı kaynak; localStorage yalnız demo/tercihler için. Yazma uçları ortamdan gelen cihaz token'ı ile korunacak; token frontend'e konulmayacak.
10. Şema migration dosyalarıyla izlenecek. Otomatik test ayrı test veritabanında çalışacak. Erişim localhost ile sınırlandırılacak; internet yayını bu aşamada yapılmıyor.

## Uygulama ve doğrulama günlüğü

- Aşama 1: kararlar ve veri sözleşmesi kaydedildi.
- Aşama 2 tamamlandı: FastAPI uçları, PostgreSQL migration, token korumalı yazma, idempotent kayıt ve harici örnek gönderici eklendi. PostgreSQL 16 üzerinde 17 backend testi geçti (doğrulama, kaynak/görev ayrımı, zaman normalizasyonu, tekrar gönderim, kalıcılık). Docker mevcut olmadığı için testler izole yerel PostgreSQL sunucusunda çalıştırıldı; Compose tarifi ayrıca sunuldu.
- Aşama 3 tamamlandı: ayrı API çalışma alanı, görev seçimi, 5 saniyelik iptal edilebilir sorgulama, eksik sensör gösterimi, kayıt ayrıntısı, CSV metaverisi ve mevcut Three.js sahnesinde ölçüm noktaları eklendi. Demo korunuyor; API alanında sahte hareket veya demo fallback yok. 12 frontend birim testi, 2 gerçek API/PostgreSQL tarayıcı senaryosu ve production build geçti. Masaüstü/mobil ekranlar görsel olarak kontrol edildi.

Tamamlanan geliştirmeler ve test sonuçları sonraki commit'lerde bu bölüme yazılacak. Fiziksel sensör doğruluğu ve saha performansı iddia edilmiyor.

## Doğrulama ve kapsam

- Gerçek PostgreSQL 16 ile kalıcılık, yeniden açılan API uygulaması, UTC normalizasyonu, birim/konum doğrulama, kaynak/görev ayrımı, aynı kimlikte aynı/farklı içerik davranışları test edildi.
- Tarayıcıda harici gönderim → API → DB → ortak tablo ve 3D akışı doğrulandı. Kaydı açma, eksik parametre, sayfa yenileme, 503 hata uyarısı, toparlanma, boş görev listesi ve 390 px görünüm test edildi.
- Mevcut IDW `accepted` anahtarı görev kimliğini de içerecek şekilde düzeltildi; farklı görevler aynı istasyon/derinlikte birbirini ezmiyor. API alanında interpolasyon henüz açılmadı.
- PostGIS ilk aşamada eklenmedi: henüz gerçek gölet/GNSS dönüşümü yok. Ham GNSS konumu saklanıyor; şematik yerel referansla karıştırılmıyor.
- Örnek gönderici deterministik fixture gönderir; tam bot/telemetri simülatörü değildir. Donanım adaptörleri, çevrimdışı cihaz kuyruğu, fiziksel komutlar ve kalibrasyon deneyleri sonraki aşamadır.
- Bağımlılıklar kilitlendi. Build, mevcut Three.js parçası için 500 kB uyarısı veriyor; build başarısız değil. Backend testlerinde Starlette/httpx deprecation uyarısı bulunuyor; testler geçiyor.
- Doğrulama PostgreSQL'i sistemdeki mevcut veritabanına dokunmadan ayrı geçici cluster üzerinde çalıştırıldı. Günlük kullanım için `backend/README.md` ile kalıcı PostgreSQL kurulmalıdır. Docker bulunmadığından Compose çalıştırılarak doğrulanmadı.
- İlk teslim geliştirme branch'ine gönderildi; bu teslim sırasında main merge veya internet yayını yapılmadı. Daha sonra PR #1, `1dd1114` ile main'e merge edildi (2026-11-25 uzak Git geçmişinden doğrulandı).

## 2026-11-25 — Ekip ve AI devir rehberi

- Ortak giriş dosyası `AGENTS.md` ve ayrıntılı `docs/AI_HANDOFF.md` eklendi. Claude/Copilot girişleri aynı kaynaklara yönleniyor; ayrı mimari kuralları çoğaltılmıyor.
- Tamamlanan ölçüm temeli ile gelecekteki görev/telemetri/simülatör/kalite/analiz/donanım aşamaları ayrıldı. Önerilen sıradaki iş temiz clone ortamı ve CI doğrulaması; bu dokümantasyon değişikliğinde o işler uygulanmadı.
- Kurulum, dosya sorumlulukları, sözleşme sınırları, test ortamları, Git/commit/push düzeni ve gelecek geliştiricinin belge güncelleme yöntemi kaydedildi.
- Ölçüm sözleşmesindeki GNSS doğruluğu cümlesi gerçek şemayla hizalandı: `accuracy_m` isteğe bağlı; referanslı yerel koordinat alternatifi geçerli; gerçek derinlik zorunlu. Runtime davranışı değiştirilmedi.
- Bu teslim yalnız dokümantasyondur. Kaynak ve belge bağlantı tutarlılığı kontrol edilecek; eski 12/17/2 test sonucu yeni çalıştırılmış gibi sunulmayacak.

## 2026-11-25 — M3 kalıcı görev planlama

- Kullanıcı, ortam/CI işi M2 yerine yazılım özelliği M3'ün ilerletilmesini istedi. M2 tamamlandı sayılmıyor.
- Planlar ölçümlerden ayrı, migration 002 ile sürümlü JSON olarak saklanacak. Mevcut ingest sözleşmesi korunuyor.
- İlk ölçüme kadar revision kontrollü düzenleme; ölçüm geldikten sonra plan kilidi. Yeni plan için yeni görev açılır. Böylece geçmiş ölçümlerin hedefi sonradan değiştirilmez.
- Operatör girişi cihaz Bearer token'ından ayrı parola ile; HttpOnly/SameSite oturum çerezi, izinli Origin ve CSRF doğrulaması kullanılır. Oturumun yalnız hash'i DB'de 8 saat tutulur. Parola/cihaz token'ı localStorage'a yazılmaz.
- Plan oluşturmak veya kaydetmek hiçbir fiziksel hareket başlatmaz. Karşılaştırma istasyon kimliği ve hedef derinlik üzerinden kayıt varlığını gösterir; botun konumunu veya derinlik doğruluğunu onaylamaz.
- Uygulandı: yeni operatör/plan route modülleri, migration 002, çok istasyonlu create/edit formu, kalıcı plan okuma, hedef/gerçek derinlik karşılaştırması ve plansız geçmiş görevlerle uyumluluk.
- Açık düzenleme formu ilk revision snapshot'ını korur; arka planda yeni plan okunması eski taslağın güncel planı ezmesine izin vermez. Geçerli hedef eşleştirmesi fiziksel tolerans değildir.
- Doğrulandı: 30 backend testi, 16 frontend birim testi, gerçek API ve ayrı E2E PostgreSQL DB'siyle 4 tarayıcı senaryosu, production build. İki yeni tarayıcı senaryosu plan oluşturma/düzenleme/yeniden açma/ölçümle kilit ve eşzamanlı revision çakışmasını kapsar.
- Masaüstü ve mobil ekranlar incelendi. Sonraki yazılım özelliği M4 telemetri/olay sözleşmesi; M2 ortam/CI işi ertelendi, yapılmış sayılmıyor.
