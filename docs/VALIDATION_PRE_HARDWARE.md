# Donanım öncesi yazılım doğrulaması — 2026-11-26

Base: main `368b3e5`. Branch: `feat/pre-hardware-workflows`. Gerçek donanım veya saha verisi kullanılmadı.

## Aşama kontrolleri

- M5: 49 PostgreSQL backend testi geçti. Plan snapshot rezervasyonu, diskten outbox tekrar açılışı, normal/missing/unstable/restart/fault senaryoları, aynı paketlerin kayıpsız/idempotent tekrarı, geçici hata backoff, 409 blocked ve 401 durma kapsandı.
- M6: 52 backend testi geçti. Ham pencere değişmezliği, sürümlü review/conflict, sensör/source/tarih/outcome uyumlu kalibrasyon bağlantısı ve boş pencere/eksik eşik davranışı.
- M7: 55 backend testi geçti. IDW exact/midpoint/range/support mask, zaman/referans/kalite filtreleri, son deneme kuralı ve görev izolasyonu.
- Frontend mevcut 18 birim testi ve production build geçti. Three.js >500 kB uyarısı sürüyor.

## Temiz kurulum

Tracked ve yeni amaçlanan kaynak dosyaları ayrı `/tmp` dizinine kopyalandı; mevcut node_modules, venv, .env veya veritabanı kopyalanmadı. `python3 scripts/setup.py` yeni venv ve npm ci ile başarılı oldu; .env şablonu oluşturuldu. Bu temiz kaynak kopyasıdır, Git clone yetkisi/SSH onboarding testi değildir.

Tam uçtan uca doğrulama `scripts/verify.py` ile ayrı UTF-8 unit ve E2E PostgreSQL DB'leri, ayrı localhost API/Vite portları ve sistem Chrome üzerinde çalıştırılır. Gerçek sonuçlar ve CI koşusu son inceleme sırasında aşağıya eklenir; dosyanın varlığı tek başına testlerin geçtiğini kanıtlamaz.

## Bilinen sınırlar

Docker/Compose bu ortamda mevcut değil; native PostgreSQL yolu kullanıldı. Gerçek sensör eşikleri, sensör kalibrasyonu, gerçek harita/GNSS dönüşümü, motor kontrolü, enerji modeli ve saha kabulü doğrulanmadı. SQLite yalnız yerel cihaz outbox'ıdır; API PostgreSQL kalır. M7 gerçek koordinat dönüşümü değil, açık referanslı yerel metre analizidir. CI sonucu aşağıda ayrıca kaydedilmeden başarılı denmez.

## Son temiz ortam sonucu

`python scripts/verify.py` temiz kurulumun kendi venv/node_modules’u ve iki yeni UTF-8 PostgreSQL DB’si üzerinde **başarılı** tamamlandı: 56 backend testi, 18 frontend testi, 7 Playwright senaryosu ve production build. Verify kendisinin açtığı sunucuları kapattı. Yeni tarayıcı senaryoları kalibrasyon ekleme, kalite taslağının korunması, sürümlü review/reload, IDW sorgusu ve ayrı görev farkını, harici Python simülatörünün disk outbox’ından gerçek HTTP replay’ini kapsıyor. Var olan ölçüm/plan/telemetri senaryoları korunuyor.

Masaüstü ve 390 px mobil ekranlar incelendi; yatay sayfa taşması ve pageerror kontrolleri geçti. Testlerin ortaya çıkardığı duplicate React key ve kalibrasyon sonrası taslak reset sorunu düzeltildi. Native select testleri erişilebilir combobox rolüyle seçiliyor. Kesirli timestamp sırası datetime karşılaştırmasıyla test edildi. Starlette/httpx deprecation ve Three.js chunk uyarıları devam ediyor.

## GitHub CI kanıtı

`27fe2a8f17003612627b62b47cf8915a148695fa` üzerinde 2026-11-26 tarihinde hem [PR koşusu](https://github.com/bugractnky/aquatwin-studio/actions/runs/45719048255) hem [push koşusu](https://github.com/bugractnky/aquatwin-studio/actions/runs/45718923840) **success** tamamlandı. Ubuntu24.04, PostgreSQL16 servisinde Node20/Python3.12 ve indirilen Chromium kullanıldı. Ortam kurulumu, shared verify ve evidence upload adımları geçti. Bu kayıt belirtilen commit'in kanıtıdır; ilerideki commit'lerin check durumunu ayrıca kontrol edin.
