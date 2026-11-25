# M4 telemetri doğrulaması — 2026-11-26

Güncel main `9866e52` üzerinden `feat/telemetry-events`. Ayrı yerel PostgreSQL 16 UTF-8 `aquatwin_test_m4_utf8` ve `aquatwin_test_m4_e2e_utf8` DB'leri; saha verisi kullanılmadı. Python 3.12, Node 20.20, sistem Chrome.

## Çalıştırılan kontroller

- `TEST_DATABASE_URL=postgresql://.../aquatwin_test_m4_utf8 PYTHONPATH=backend python -m pytest -q backend/tests`: **43 geçti**. Mevcut 30 + 13 telemetri/olay kontrolü: auth, UUID retry/conflict, oturum/sıra/time doğrulama, gecikmiş paketler, yeni oturumda sayaç sıfırlama, invalid snapshot, farklı görevler, olay sayfalama, restart kalıcılığı, gecikmiş verinin freshness hesabı.
- `npm test`: **18 geçti**. Yaşın fresh/stale/offline sınırları arasında ilerlemesi, bilinmeyen derinlik ve sıfır değeri dahil.
- `npm run build`: başarılı. Önceden var olan Three.js chunk >500 kB uyarısı devam ediyor.
- `npm run test:e2e`: **5 geçti**. Ayrı API 8001 ve Vite 5177, eşleşen yerel test token/operatör parolası kullanıldı. Önceki dört senaryo korunuyor. Yeni senaryo gerçek DB/API üzerinden snapshot/olay görüntüleme, gecikmiş eski paket, 503 API kesintisi ve son verinin korunması, toparlanma, yeni invalid/eski zamanlı oturum, reload, görev izolasyonu ve 390 px düzenini kapsıyor. Sayfada JS hatası yok.
- `python backend/send_telemetry.py --url http://127.0.0.1:8001 --mission m4-review-fixture`: görev ve sentetik snapshot/olay oluşturdu, her rapor 201. Token dosyaya/repoya yazılmadı.
- `git diff --check`, kaynak incelemesi ve belge bağlantı kontrolü.

Test çıktıları/screenshot'lar `test-results/telemetry-desktop.png` ve `test-results/telemetry-mobile.png` içinde, gitignored. Masaüstü ve mobil ekranlar incelendi; sayfa yatay taşma kontrolü geçti.

## Sınırlamalar ve giderilen doğrulama sorunları

İlk geçici PostgreSQL kümesi SQL_ASCII açıldığı için metin alanlarını bytes döndürdü; ayrı UTF-8 DB oluşturularak tekrar koşuldu. İlk tarayıcı kontrolü, ilk yüklemede varsayılan görev seçiminin kullanıcı seçimini ezebildiğini ortaya çıkardı; functional state update ile düzeltildi ve tüm senaryolar tekrar geçti.

Starlette/httpx TestClient deprecation uyarısı sürüyor. Docker/Compose bu ortamda çalıştırılarak doğrulanmadı. GitHub CI eklenmedi; bu sonuçlar yerel kanıttır. Gerçek donanım, ağ kopmasının fiziksel tespiti, saat senkronizasyonu veya motor kontrolü doğrulanmadı. 15/60 saniye eşikleri ve 30 saniye saat toleransı geçici yazılım tercihleri. Çok cihaz ayrı snapshot sorgusu kaynakta destekleniyor; fiziksel çok cihaz testi yapılmadı.
