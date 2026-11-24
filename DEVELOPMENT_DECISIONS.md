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
- Aşama 3: frontend API çalışma alanı, uçtan uca doğrulama ve kurulum belgeleri eklenecek.

Tamamlanan geliştirmeler ve test sonuçları sonraki commit'lerde bu bölüme yazılacak. Fiziksel sensör doğruluğu ve saha performansı iddia edilmiyor.
