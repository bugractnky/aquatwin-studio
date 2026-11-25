# Plan tabanlı simülatör ve kalıcı outbox

Bu harici Python aracı geçmiş zaman damgalı **sentetik görev replay'i** üretir; canlı cihaz, fiziksel kontrol veya gerçek örnekleme süresi değildir. Planlı `simulated` görev gerekir. Önce API arayüzünde istasyonları ve derinlikleri kaydedin.

```bash
# API ile aynı ingest token ortamda yüklü olmalı; frontend'e verilmez.
python backend/simulate_mission.py --mission MISSION_UUID --outbox .aquatwin/run1.sqlite3 --generate-only
# Ağ yokken kapatıp tekrar açabilirsiniz. Aynı dosya aynı UUID ve içerikleri korur.
python backend/simulate_mission.py --outbox .aquatwin/run1.sqlite3 --watch
```

İlk üretimde sunucuda `POST /api/v1/simulation-runs` ile beklenen plan revision'ı atomik sabitlenir. Bu rezervasyon planı kilitler; başka hedefler için yeni görev açın. Rezervasyonun kendisi fiziksel görev başlatmaz. İlk rezervasyon için ağ gerekir; dosya hazırlandıktan sonra offline kalabilir. Metadata/paketlerin tamamı tek SQLite transaction içinde yazılır. SQLite yalnız cihaz tarafı kuyruktur; API PostgreSQL'den vazgeçmez. Kuyruk dosyasını iki görev için paylaşmayın, silmeyin veya repoya koymayın. Aynı dosyada tek gönderici çalıştırın.

Senaryolar `--scenario normal|missing|unstable|restart|fault`. İstasyon sırası ve hedefler plan snapshot'ından alınır. İndirme/stabilizasyon/ölçüm raporları, ham sentetik pencere ve toplama olayı üretilir. Ölçümler unreviewed veya unstable'dır; otomatik saha onayı/kalibrasyon yoktur. Fault senaryosu tamamlanma iddia etmez. Replay'in geçmiş timestamp'ları nedeniyle telemetri stale/offline görünebilir; bunu taze göstermek için zamanlar değiştirilmez. Gerçekçi fizik/enerji modeli değildir.

200/201 ve eşleşen paket UUID'si alındığında sent işaretlenir. Cevap alındıktan önce/sonra çökme tekrar gönderilebilir; sunucu aynı UUID'yi çoğaltmaz. Ağ/5xx/429 backoff ile pending kalır; 401/403 gönderimi durdurur; diğer 4xx (özellikle 409) blocked olur. Blocked paketleri elle inceleyin; sonsuz retry veya sessiz silme yoktur. Sent kayıtlar denetim için dosyada korunur. `--watch` pending bitince çıkar; blocked sayısı ayrıca raporlanır. Tek seferlik mod en fazla 100 paket işler; büyük planlarda watch kullanın.
