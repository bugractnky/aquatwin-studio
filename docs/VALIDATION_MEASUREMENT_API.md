# Ölçüm API temeli doğrulama kaydı

Tarih: 2026-11-25. Branch: `feat/measurement-api-foundation`.

## Sonuçlar

| Kontrol | Sonuç |
| --- | --- |
| PostgreSQL 16 backend testleri | 17 geçti |
| Frontend birim testleri | 12 geçti |
| Gerçek API/DB ile Playwright senaryoları | 2 geçti |
| Vite production build | Geçti; Three.js chunk boyutu uyarısı var |
| 1425 px masaüstü ve 390 px mobil | Görsel inceleme ve taşma kontrolü geçti |

Backend testleri ayrı `aquatwin_test` veritabanına UUID'li kayıtlar ekledi. Tarayıcı testleri ayrı yerel geliştirme ortamında API üzerinden sentetik görev/ölçüm oluşturdu. Sistem PostgreSQL veritabanlarına erişilmedi. Docker ortamı olmadığı için Compose başlatma tarifi çalıştırılmadı.

Doğrulanan davranışlar: kalıcı kayıt, yeniden açılan uygulamada okuma, idempotent tekrar gönderim, kimlik/içerik çakışması, zorunlu token, hatalı birim/konum/zaman reddi, görev/kaynak ayrımı, eksik sensörün sıfırla doldurulmaması, API kesintisinde açık uyarı ve toparlanma. Yalnız uygun yerel referanslı ve ilgili parametreyi içeren kayıtlar 3D sahneye alınır.

Tarayıcı testleri ve test talimatları repoda bulunur. `npm test`, `npm run build`, `npm run test:e2e`; backend komutu `backend/README.md` içinde.

[API çalışma alanı ekranı](images/api-workspace.png)

Bu sonuçlar fiziksel sensör doğruluğu, mekanik güvenlik, gerçek gölet geometrisi, saha iletişim başarımı veya internet yayını doğrulaması değildir. API alanı bu sürümde ölçüm noktaları/tablo sağlar; demo IDW analizleri ayrı demo modundadır. GNSS dönüşümü, gerçek telemetri, cihaz çevrimdışı kuyruğu ve fiziksel komutlar sonraki aşamadır.
