# Ölçüm sözleşmesi v1

`POST /api/v1/missions`: UUID `id`, `name` (1–120 karakter), `source` (`simulated`/`device`).

`POST /api/v1/measurements`: aşağıdaki alanlar. Yazma işlemleri `Authorization: Bearer <AQUATWIN_INGEST_TOKEN>` ister. JSON şeması `/docs` içinde.

| Alan | Anlam |
| --- | --- |
| schema_version | Sabit `1` |
| id / mission_id | UUID; ölçüm kimliği tekrar gönderimde değişmez |
| device_id / station_id | Cihaz ve istasyon adı; cihaz modeli varsayılmaz |
| source | Görev kaynağıyla aynı olmalı |
| measured_at | Saat dilimli ISO tarih; UTC olarak saklanır |
| target_depth_m / actual_depth_m | Hedef ve ölçülen derinlik, pozitif aşağı yön, metre |
| position | `latitude`, `longitude` birlikte; isteğe bağlı `accuracy_m`. `local_x_m`, `local_north_m`, `reference_id` birlikte. En az bir konum biçimi gerekir. |
| parameters | En az bir `temp`, `ph`, `do`, `ec`, `turb`. Her biri `value`, `unit`, `sensor_id` içerir. |
| quality / quality_reason | `unreviewed`, `valid`, `unstable`, `invalid`; gerekçe zorunlu |
| calibration_id | İsteğe bağlı; kalibrasyon yapıldığını varsaymaz |
| raw_samples | İsteğe bağlı ham değerler; her öğe göreli `offset_s` ve `parameters` içerir |
| received_at | Sunucunun atadığı UTC tarih, istemci göndermez |

Birimler: temp=`degC`, ph=`1`, do=`mg/L`, ec=`uS/cm`, turb=`NTU`. Sayılar sonlu olmalıdır. GNSS doğruluğu ve gerçek derinlik bilinmiyorsa bu ilk sözleşmede ölçüm gönderilmez; cihaz adaptörü veri eksikliğini ayrıca ele almalıdır. Buradaki `actual_depth_m` sensörün ölçüm derinliğidir, gölet taban derinliği değildir.

Aynı ölçüm kimliği + aynı normalize içerik → 200; yeni kayıt → 201; aynı kimlik + farklı içerik → 409. Bilinmeyen görev → 404. Uyumsuz kaynak → 409. Hatalı JSON/alan/birim → 422.

`GET /api/v1/missions` ve `GET /api/v1/measurements?mission_id=...&limit=100&offset=0` kalıcı kayıtları döndürür. İkinci yanıt `items`, `total`, `limit`, `offset` içerir. Sayfalama sırası ölçüm zamanı ve UUID'dir.

İlk sürümde doğrudan ölçümler saklanır; interpolasyon sonuçları ölçüm tablosuna yazılmaz. 3D sahne `demo-pond-v1` referanslı kayıtları gösterebilir; bu referans gerçek GNSS veya batimetri değildir.
