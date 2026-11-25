# Telemetri ve görev olayları v1

Yerel araştırma API'sidir; bu modül fiziksel komut göndermez. HTTP ve 5 saniyelik UI sorgusu korunur. Ölçüm v1 sözleşmesi değişmez.

## Yazma

`POST /api/v1/telemetry` ve `POST /api/v1/events`, mevcut cihaz ingest Bearer token'ını ister. Operatör oturumu tek başına yeterli değildir. Token frontend'e verilmez.

Ortak alanlar: `schema_version=1`, UUID `id`, `mission_id`, `device_id`, görevle eşleşen `source`, UUID `session_id`, saat dilimli `session_started_at`, sıfırdan başlayan güvenli integer `sequence` (0..2^53−1), saat dilimli `observed_at`. Zamanlar UTC'ye normalize edilir; observed_at oturum başlangıcından önce olamaz, sunucudan 30 saniyeden fazla ileride olamaz. Bu clock toleransı saha doğrulaması değildir.

Telemetri: zorunlu `validity=valid|invalid`, `validity_reason`. Opsiyonel `station_id`, `position` (ölçümle aynı konum şeması), `target_depth_m`, `actual_depth_m` (metre, pozitif aşağı, sıfır dahil), `winch_stage=idle|lowering|settling|measuring|retracting|fault`, `error_code`. Bilinmeyenler null. **Tam snapshot** gönderilir, patch değildir. Eksik derinliği hedeften veya önceki paketten üretme. `valid` cihazın kendi beyanıdır, kalibrasyon/saha onayı değildir. `device` kaynağı demo koordinatı kullanamaz.

Olay: `kind=mission_started|station_arrived|depth_reached|measurement_started|measurement_completed|retraction_completed|mission_completed|fault|info`, `severity=info|warning|error`, `message` (1–1000 karakter); opsiyonel istasyon/hata kodu. Olayın varlığı ölçüm kaydı oluşturmaz veya telemetriyi güncellemez.

## Kimlik, sıralama ve yeniden başlatma

Yeni rapor 201, aynı UUID+normalize içerik tekrar 200 ve **orijinal received_at**, farklı içerik 409. Başka UUID ile aynı oturum/sıra 409. Telemetri ve olaylar ayrı sıra sayaçlarına sahiptir. Oturum kimliği bir mission/device içinde değişmez başlangıca bağlıdır; iki oturum aynı başlangıç zamanını paylaşamaz.

Yeni cihaz bağlantısı/yeniden başlatma yeni UUID ve ileri `session_started_at` kullanır; sayaç sıfırlanabilir. Son durum her cihaz için **oturum başlangıcı, sonra sıra numarası** ile seçilir; alım sırasıyla seçilmez. Gecikmiş eski oturum paketi kaydedilir ancak yeni oturumu aktif yapmaz. Aynı oturumda sıra ile cihaz zamanı komşu paketlerle tutarlı olmalıdır; clock geri giderse 422. Cihaz clock resetinde adaptör zamanı senkronize etmeden yeni oturumu doğru sıraya koyamayabilir; gerçek donanım protokolü henüz doğrulanmadı.

Geçersiz en yeni snapshot gizlice eski geçerli duruma dönmez: UI alanları bilinmiyor gösterir, ham raporu korur. Yeni oturumdan yalnız olay gelmesi eski telemetriyi yenilemez; telemetri alındığında yeni snapshot seçilir. Bir görevde birden çok cihaz ayrı gösterilir.

## Okuma ve güncellik

- `GET /api/v1/missions/{id}/telemetry`: her cihazın son raporu, `server_time`, `age_seconds`, `freshness`, eşikler. Kayıt yoksa boş liste; bilinmeyen görev 404. No-store.
- `GET /api/v1/missions/{id}/events?limit=20&offset=0`: cihaz zamanı ve UUID'ye göre en yeni önce; toplam ve sayfalama. UI son 20 olayı gösterir; API en fazla 200/sayfa.

Yaş = sunucu zamanı − min(son snapshot observed_at, received_at), en az sıfır. Gecikmiş paket veya retry raporu taze göstermez. <15 sn fresh, 15–<60 stale, ≥60 offline: **geçici yazılım varsayımları**, fiziksel bağlantı kaybı kanıtı değildir. UI yaşa monotonic elapsed süreyi ekler; sorgu saatini cihaz heartbeat'i saymaz. API hatasında son rapor korunur ve API erişiminin doğrulanamadığı ayrıca yazılır. Görev değişince önceki görevin paneli temizlenir.

Okuma uçları önceki API gibi yalnız yerel kullanım için açıktır. Kullanıcı/cihaz bazlı üretim yetkilendirmesi bu teslim değildir. Gerçek sensör, motor, rota animasyonu, SSE/MQTT ve çevrimdışı kuyruk eklenmedi.
