# Tekrarlanabilir ekip kurulumu ve doğrulama

Desteklenen doğrulama ortamı: Linux/WSL, Python 3.12+, Node 20+, PostgreSQL 16+, Chromium/Chrome. macOS/Windows yerel komutları benzer olsa da bu teslimde doğrulanmadı; Windows için WSL önerilir. API localhost içindir.

## Temiz clone

```bash
git clone git@github.com:bugractnky/aquatwin-studio.git
cd aquatwin-studio
# Önce AGENTS.md ve docs/SESSION_START.md
python3 scripts/setup.py
```

Script kilitli Python bağımlılıklarını `.venv` içine ve npm lockfile'dan `npm ci` ile frontend'i kurar. `backend/.env` yoksa örnek dosyayı kopyalar, mevcut dosyayı değiştirmez. **Şablon kimlik bilgileri kullanıma hazır değildir**: kendi DB URL/parolanızı ve farklı ingest/operatör sırlarını ayarlayın. `.env`, SQLite outbox ve test çıktıları ignore edilir. Script PostgreSQL kurmaz, cihaz veya API çalıştırmaz.

PostgreSQL için [backend rehberi](../backend/README.md) ile mevcut yerel sunucuyu veya isteğe bağlı Compose'u kullanın. Compose komutu bu ortamda Docker bulunmadığı için çalıştırılarak doğrulanmadı. Native PostgreSQL yolu test edildi. Geliştirme DB'sinden **iki ayrı** boş test DB'si oluşturun:

```bash
# Host/port/kullanıcıyı kendi yerel PostgreSQL ayarınıza göre verin.
createdb -h 127.0.0.1 -p 54329 -U aquatwin -T template0 -E UTF8 aquatwin_test_unit
createdb -h 127.0.0.1 -p 54329 -U aquatwin -T template0 -E UTF8 aquatwin_test_browser
```

API kurulumu/start: [backend/README.md](../backend/README.md). Başlangıç migration'ları 001–005'i transaction ile uygular. Var olan migration değiştirilmez. Önce geliştirme DB'sini yedekleyin; testleri asla gerçek saha DB'sinde çalıştırmayın.

## Tek komutla doğrulama

```bash
. .venv/bin/activate
npx playwright install --with-deps chromium
export TEST_DATABASE_URL='postgresql://aquatwin:YOUR_PASSWORD@127.0.0.1:54329/aquatwin_test_unit'
export E2E_DATABASE_URL='postgresql://aquatwin:YOUR_PASSWORD@127.0.0.1:54329/aquatwin_test_browser'
python scripts/verify.py
```

URL'lerdeki şifre URL-encode edilmeli; komutları log/dokümana gerçek sırlarla koymayın. Verify `.env` dosyasını otomatik source etmez. İki test DB ismi `aquatwin_test` ile başlamalı ve aynı host/port/DB olmamalı. UUID'li fixture ekler, veri silmez. E2E de yazdığı için ayrı DB gerekir.

Sıra: frontend unit → build → PostgreSQL backend testleri → ayrı API ve Vite → Playwright. Sunuculara yalnız yerel doğrulama token/parolası verir, üretim sırrı gerekmez. Varsayılan API 8001 ve Vite 5177; port doluysa başarısız olur, başkasının sunucusunu kapatmaz. `E2E_API_PORT` ve `E2E_FRONTEND_PORT` ile boş port seçin. Sistem Chrome için `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` verilebilir. Başarısızlıkta da kendisinin açtığı süreçleri kapatır. Loglar `validation-logs`, screenshot ve hata bağlamı `test-results` içindedir (gitignored).

## CI

`.github/workflows/validate.yml` PR ve main/feat/fix/docs push'larında Node20, Python3.12 ve PostgreSQL16 servisinde **aynı verify komutunu** çalıştırır. Ayrı unit/E2E DB oluşturur, yalnız test kimlik bilgileri kullanır; repo yazma yetkisi veya kullanıcı sırlarına ihtiyaç duymaz. Sonuçlar GitHub Actions/PR Checks'te görünür; yerel test sonucu CI geçti demek değildir. Test log/screenshot'ları 7 gün artefact olarak saklanır.

CI Chromium kurulumu resmi [Playwright CI rehberine](https://playwright.dev/docs/ci) dayanır. İlk başarılı CI sonucu doğrulama belgesine kaydedilir. Koruma kuralına zorunlu check eklemek ayrı repo ayarıdır; bu teslimde güvenlik ayarları değiştirilmez.

## Donanım olmadan tam örnek akış

1. API alanında simulated görev ve plan oluşturun.
2. [Simülatör](SIMULATOR.md) ile planı rezerve edip outbox oluşturun, tekrar açarak gönderin.
3. Ölçüm ayrıntısından [kalite ve kalibrasyon](QUALITY.md) altyapısını sentetik veriyle deneyin; gerçek işlem yapılmadıysa kalibrasyon kaydı uydurmayın.
4. [API analizi](API_ANALYSIS.md) ile aynı referans/zaman/parametre seçerek tahmin, profil ve karşılaştırmayı inceleyin.
5. Yeni iş öncesinde güvenli fetch/base/branch prosedürünü uygulayın.
