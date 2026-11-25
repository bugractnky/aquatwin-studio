# Kalıcı görev planlama

## Kapsam

API çalışma alanında operatör yeni görev, sıralı istasyonlar, konumlar ve hedef derinlikler oluşturabilir. Görev planı PostgreSQL'de saklanır; cihaz komutu veya görev yürütme başlatmaz. Aynı görevde sentetik ve cihaz verisi karıştırılmaz.

## Operatör kurulumu

`backend/.env` dosyasında cihaz token'ından farklı, en az 16 karakterli bir `AQUATWIN_OPERATOR_PASSWORD` belirleyin. API ortamına yükleyip sunucuyu yeniden başlatın. Bu değişken yoksa ölçüm okuma çalışır; tarayıcı planlama girişi kapalı kalır.

Varsayılan izinli frontend Origin adresleri localhost/127.0.0.1 için 5173 ve 5176 portlarıdır. Farklı port kullanıyorsanız `AQUATWIN_OPERATOR_ORIGINS` içine tam adresi ekleyin. Kimlik doğrulama origin'i Vite adresidir, API proxy hedefi değildir.

API alanındaki **Operatör girişi** ile oturum açın. Parola yalnız giriş isteğinde kullanılır, frontend depolamasına yazılmaz. Oturum HttpOnly, SameSite=Strict çerezle taşınır; sunucuda token hash'i ve 8 saatlik bitiş tarihi tutulur. Yazma işlemleri ayrıca izinli Origin ve CSRF başlığı ister. Giriş cihaz ingest yetkisi vermez. `AQUATWIN_SECURE_COOKIES=true` yalnız HTTPS ortamında kullanılmalıdır; mevcut kurulum localhost geliştirmesidir. Çok kullanıcılı kimlik/rol yönetimi ve internet yayını bu aşamada yoktur.

## Kullanım

1. API çalışma alanında operatör girişi yapın, **Yeni görev oluştur** düğmesini açın.
2. Görev adı ve veri kaynağını seçin.
3. Konum biçimini seçin: şematik yerel metre (`demo-pond-v1`), açık referanslı yerel metre veya enlem/boylam (WGS84).
4. Her istasyonda benzersiz kimlik, ad, konum ve virgülle ayrılmış hedef derinlikleri girin. Liste sırası istasyon sırasıdır; derinlikler de verilen sırada korunur. 0 m yüzey hedefi geçerlidir. En fazla 3 ondalık basamak kullanılır.
5. Planı kaydedin. Yeni görev otomatik seçilir; yeniden açıldığında veritabanından okunur.
6. İlk ölçüm veya simülasyon rezervasyonu gelene kadar **Planı düzenle** ile yeni revision kaydedilebilir. Eşzamanlı değişiklik 409 ile reddedilir; eski form güncel planı sessizce ezmez.
7. Herhangi bir ölçüm geldikten veya simulation-run rezerve edildikten sonra plan kilitlenir. Farklı hedefler için yeni görev oluşturun. Ölçümler ve geçmiş plan sürümleri korunur.

Konum biçimi değiştiğinde sayılar otomatik dönüştürülmez; giriş alanları temizlenir. Cihaz planı şematik `demo-pond-v1` referansını kullanamaz. Genel yerel ve GNSS planları saklanır, ancak mevcut şematik 3D sahne yalnız desteklediği demo referansını gösterir. Derinlik veya konum kaydetmek saha uygunluğu onayı değildir.

## Plan ve ölçüm karşılaştırması

Eşleştirme aynı görevin `station_id` ve ölçümde bildirilen `target_depth_m` alanıyla yapılır. Bu karşılaştırma gerçek derinliği hedefle eşitlemez; gerçek derinlikler ayrı sütunda gösterilir. Plan hedefleri milimetre hassasiyetinde olduğundan eşleşme farkı 0.0005 m'den küçük olmalıdır; bu değer fiziksel kabul toleransı değildir.

- Geçerli kayıt varsa: **Geçerli kayıt var**.
- Yalnız incelenmemiş/kararsız/geçersiz kayıt varsa: **İnceleme / tekrar gerekli**.
- Kayıt yoksa: **Ölçüm bekleniyor**.
- Plan dışı kayıtlar silinmez; sayısı belirtilir ve ölçüm tablosunda korunur.
- Ölçüm sorgusu başarısızsa karşılaştırma doğrulanamadı olarak işaretlenir.

Konum doğruluğu, tüm sensör parametrelerinin bulunması, kalibrasyon yeterliliği veya fiziksel görev bitişi bu statülerden çıkarılamaz. Plansız eski görevler çalışmaya devam eder; ölçümü olmayan eski göreve revision 0 üzerinden plan eklenebilir.

## API

| Uç | Yetki / davranış |
| --- | --- |
| GET `/api/v1/operator/session` | Oturum/özellik durumu, no-store; oturum varsa CSRF değeri |
| POST `/api/v1/operator/session` | Operatör parolası + izinli Origin; oturum çerezi |
| DELETE `/api/v1/operator/session` | Oturum + Origin + CSRF; oturumu iptal eder |
| POST `/api/v1/planned-missions` | Oturum + Origin + CSRF; atomik görev ve plan oluşturur |
| GET `/api/v1/missions/{id}/plan` | Son plan, revision, kayıt nedeniyle kilit durumu; plansız görevde `plan=null`, revision 0 |
| PUT `/api/v1/missions/{id}/plan` | Oturum + Origin + CSRF; `expected_revision` ve tam `plan` |

Oluşturma gövdesi: mevcut görev alanları `id`, `name`, `source` + `plan`. Plan alanları: `schema_version=1`, `stations`. İstasyon alanları: `station_id`, `name`, `position`, `target_depths_m`. En çok 50 istasyon ve istasyon başına 20 hedef; tüm istasyonlar aynı koordinat referansında olmalıdır. Bunlar yazılım boyut sınırlarıdır, fiziksel limit değildir.

Yeni oluşturma 201; aynı UUID/aynı ilk içerikle yeniden gönderim 200; farklı içerik 409. Revision çakışması veya ölçüm/simülasyon rezervasyonu sonrası düzenleme 409; doğrulama hatası 422; eksik oturum 401; Origin/CSRF hatası 403. Var olan Bearer ingest uçları ve ölçüm v1 sözleşmesi değiştirilmedi. Plan güncelleme ve ilk ölçüm ekleme aynı görev satırı kilidini kullanır; geçmişi değiştirebilecek yarış önlenir.

Migration `002_mission_plans.sql`: `mission_plans` append-only sürümleri ve `operator_sessions`. Mevcut `001` değiştirilmez. Çalışan API eski kodu kendiliğinden yüklemiyorsa yeniden başlatılmalıdır.

Testler: `backend/tests/test_plans.py`, `src/planning.test.js` ve görev planlama E2E senaryosu. Son gerçek sonuçlar karar ve doğrulama kayıtlarına yazılır.
