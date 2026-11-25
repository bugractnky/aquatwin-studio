# Kalıcı görev planlama doğrulaması

Tarih: 2026-11-25. Branch: `feat/persistent-mission-planning`. Bu kayıt M3 özelliğine aittir; M2/CI teslimi değildir.

| Kontrol | Sonuç |
| --- | --- |
| PostgreSQL 16 üzerinde backend | 30 test geçti |
| Frontend model/adaptör/plan mantığı | 16 test geçti |
| Gerçek API/DB ile Playwright | 4 senaryo geçti |
| Production build | Geçti; önceki Three.js boyut uyarısı devam ediyor |
| Masaüstü ve 390 px mobil | Görsel inceleme ve sayfa taşması kontrolü geçti |

Backend kontrolleri `TEST_DATABASE_URL` ile ayrı test veritabanında çalıştı. Yeni migration, atomik plan oluşturma, retry/409, revision güncelleme, ölçüm sonrası kilit, kaynak/konum doğrulama, oturum/Origin/CSRF/çıkış/bitiş tarihi, eski plansız görevler ve yeniden açılan uygulamada kalıcılık test edildi.

Frontend testleri plan ve ölçüm hedefinin ayrılması, tekrarlı ölçümler, plan dışı kayıtların korunması, yüzey hedefi, yerel/coğrafi referans ve geçersiz form verisini kapsıyor. Tarayıcıda iki istasyonlu plan oluşturma, revision 2 düzenleme, sayfa yenileme, ölçülen 1.1 m ile hedef 1 m'nin ayrı gösterilmesi, kilit ve operatör çıkışı doğrulandı. İkinci operatör planı değiştirirken eski açık formun 409 alarak yeni planı ezemediği de test edildi.

E2E için ayrı PostgreSQL veritabanı ve API/Vite portları kullanıldı. `E2E_BASE_URL`, `E2E_API_URL`, `E2E_OPERATOR_PASSWORD` ve ingest token ortamdan sağlandı; kimlik bilgileri repoya yazılmadı. Docker/CI çalıştırıldığı veya fiziksel donanım doğrulandığı iddia edilmiyor.

Komutlar:

```bash
TEST_DATABASE_URL=YOUR_SEPARATE_TEST_DATABASE_URL PYTHONPATH=backend .venv/bin/python -m pytest -q backend/tests
npm test
npm run build
# API/Vite ve ayrı test ortamı açıkken, gerekli E2E değişkenleri yüklenmiş olmalı:
npm run test:e2e
```

Plan sözleşmesi ve kurulum: [MISSION_PLANNING.md](MISSION_PLANNING.md).
