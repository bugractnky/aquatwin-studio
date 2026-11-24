# AquaTwin ölçüm API'si

Python 3.12+ ve PostgreSQL 16+ gerekir. API yalnız localhost'ta çalıştırılır. Docker yalnız isteğe bağlı PostgreSQL başlatma yöntemidir; mevcut PostgreSQL ile `DATABASE_URL` kullanabilirsiniz. Veritabanı önceden oluşturulmuş olmalıdır.

## Kurulum

Repo kökünde:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r backend/requirements.txt
cp backend/.env.example backend/.env
```

`backend/.env` içindeki veritabanı parolasını, URL'yi ve ingest token'ını yerel değerlerle değiştirin. Parolada URL'ye uygun karakterler kullanın veya URL-encode edin. Aynı token örnek gönderici ve API tarafından kullanılır; React tarafına yazılmaz.

İsteğe bağlı Docker PostgreSQL:

```bash
docker compose --env-file backend/.env up -d db
```

API (bash; `.env` yalnız sizin düzenlediğiniz güvenilir yerel dosya olmalı):

```bash
set -a
. backend/.env
set +a
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

Migration'lar API açılışında işlem içinde ve migration kilidiyle uygulanır. Veri silinmez. API veritabanı rolü ilk açılışta tablo oluşturma yetkisi gerektirir. İleride üretim migration rolü ayrılmalıdır.

- Sağlık: `http://127.0.0.1:8000/api/v1/health`
- Etkileşimli sözleşme: `http://127.0.0.1:8000/docs`
- Okuma uçları yerel geliştirme için açık; POST uçları Bearer token gerektirir. Bu sürüm internete yayınlanmak için hazırlanmış değildir.

## Örnek ölçüm gönderme

Başka terminalde aynı ortam değişkenlerini yükledikten sonra:

```bash
. .venv/bin/activate
set -a
. backend/.env
set +a
python backend/send_sample.py --mission first-api-session --count 3
```

Üç sentetik ölçüm, sıcaklık/pH/DO ile gönderilir. EC ve bulanıklık bilerek yoktur. Aynı komut tekrarında 200 dönmeli; kayıt sayısı artmamalıdır. Görev adını değiştirerek ayrı görev oluşturun. Fixture zamanları sabittir; bu program canlı telemetri simülatörü değildir.

Frontend ayrı terminalde `npm ci` ve `npm run dev` ile açılır. **API çalışma alanı** düğmesine basın; görevi seçin. Vite `/api` isteklerini varsayılan olarak `127.0.0.1:8000` adresine aktarır. Farklı API için Vite başlatılırken `AQUATWIN_API_PROXY_TARGET` ayarlanabilir. Production build için `/api` reverse proxy ayrıca gereklidir; API modu statik dosya hostinginde tek başına çalışmaz.

## Test

Geliştirme veritabanından ayrı `aquatwin_test` isimli bir veritabanı oluşturun. Örneğin Docker ile:

```bash
docker compose --env-file backend/.env exec db createdb -U aquatwin aquatwin_test
TEST_DATABASE_URL=postgresql://aquatwin:YOUR_PASSWORD@127.0.0.1:54329/aquatwin_test PYTHONPATH=backend python -m pytest -q backend/tests
```

Testler yalnız adı `aquatwin_test` ile başlayan veritabanında çalışır. UUID'lerle ayrılmış fixture kayıtları ekler, var olan verileri silmez. Test veritabanını geliştirme veya saha verisi için kullanmayın.

Sözleşme: [MEASUREMENT_CONTRACT.md](../docs/MEASUREMENT_CONTRACT.md). Kararlar: [DEVELOPMENT_DECISIONS.md](../DEVELOPMENT_DECISIONS.md).
