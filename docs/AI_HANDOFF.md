# AquaTwin ortak yazılım planı ve AI devir rehberi

Son içerik incelemesi: 2026-11-26. Dil: Türkçe. Bu belge yeni bir ekip üyesinin veya AI yardımcısının mevcut sistemi anlaması ve aynı plan üzerinden devam etmesi içindir.

**Önce kökteki [AGENTS.md](../AGENTS.md) okunur; ardından bu belge tamamlanır.** Bu rehberdeki gelecek işler, kullanıcı ayrıca istemedikçe kendiliğinden uygulanacak bir görev listesi değildir. Kullanıcının güncel isteğini bu planla birlikte değerlendir.

## 1. Proje neyi yapıyor

AquaTwin, METU NCC göletinde farklı konum ve derinliklerden su kalitesi gözlemleri toplamak ve bunları konum, derinlik ve zamanla incelemek için geliştirilen araştırma projesidir. Fiziksel platform drone değil, manuel kullanılan yüzey botudur. Bot üzerindeki vinç, sualtı sensör modülünü uygun derinliklere indirecektir.

Hedef işlem: istasyona ulaş → sensörü hedef derinliğe indir → stabilize olmasını bekle → ham ölçüm penceresini al → kaliteyi değerlendir → diğer uygun derinlikte ölç → sensörü topla → sonraki istasyona geç.

1, 2 ve 3 metre hedefleri prototip senaryosudur; her istasyonda suyun 3 metre olduğu veya bu derinliklerin güvenli olduğu doğrulanmış değildir. Mevcut demo dip mesafesi ve süreleri saha sınırı değildir.

Donanımı ekip bağımsız olarak seçmedi. Tedarik okul/danışmanlar tarafından yürütülüyor. Son kullanıcı açıklamasında bot, sensörler ve ilişkili ekipman henüz teslim edilmemişti. Yeni bilgi gelirse bu durumu güncelle; model, arayüz, kalibrasyon, taşıma kapasitesi veya motor performansı uydurma.

## 2. Repo ve şu anki teslim durumu

Repo: https://github.com/bugractnky/aquatwin-studio

| İş | Durum | Kanıt |
| --- | --- | --- |
| React/Three.js sentetik araştırma arayüzü | Uygulandı | `src/App.jsx`, `src/Twin.jsx`, `src/useMission.js` |
| Sürümlü ölçüm sözleşmesi | Uygulandı | `backend/app/schemas.py`, `docs/MEASUREMENT_CONTRACT.md` |
| FastAPI/PostgreSQL ölçüm akışı | Uygulandı | `backend/app/main.py`, `backend/app/db.py`, `backend/migrations/001_initial.sql` |
| Harici deterministik örnek gönderici | Uygulandı | `backend/send_sample.py` |
| API görev seçimi, tablo ve şematik 3D ölçüm noktaları | Uygulandı | `src/ApiWorkspace.jsx`, `src/api.js` |
| Kalıcı görev planı ve operatör oturumu | Uygulandı (M3 branch teslimi) | `src/PlanEditor.jsx`, `src/MissionPlan.jsx`, `backend/app/plans.py`, `backend/app/operator.py` |
| Fiziksel bot/vinç kontrolü ve sensör sürücüleri | Uygulanmadı | Donanım ve protokol bekleniyor |
| Telemetri/olay API ve izleme paneli | Uygulandı (M4 branch teslimi) | `backend/app/telemetry.py`, `src/TelemetryPanel.jsx`; gerçek donanım ve komut onayı yok |
| Harici simülatör ve kalıcı gönderim kuyruğu | Uygulandı | `backend/simulate_mission.py`, `backend/outbox.py`, [SIMULATOR.md](SIMULATOR.md) |
| Gerçek gölet haritası, batimetri ve GNSS dönüşümü | Uygulanmadı | Mevcut geometri şematik |
| API yerel koordinat IDW/profil/karşılaştırma | Uygulandı | `backend/app/analysis.py`, `src/AnalysisPanel.jsx`; GP/Kriging yok |
| İnternet yayını ve çok kullanıcılı yetkilendirme | Uygulanmadı | Yerel geliştirme sistemi |
| Ekip kurulumu ve CI | Eklendi; kanıtı doğrulama belgesinden kontrol et | `scripts/setup.py`, `scripts/verify.py`, `.github/workflows/validate.yml` |

Ölçüm temeli `feat/measurement-api-foundation` branch'inde üç commit ile teslim edildi:

- `19971dd`: veri sözleşmesi ve karar kaydı.
- `4baf12d`: PostgreSQL API, migration, örnek gönderici ve backend testleri.
- `7fe1bca`: React/API bağlantısı, testler ve kurulum belgeleri.

Bu işler PR #1 ile `1dd1114` merge commit'inde main'e alındı. Bu belge tarihindeki doğrulanmış tarihçedir; çalışmaya başlarken kendi checkout'unun branch, HEAD ve değişikliklerini kontrol et. Eski commit'i veya branch'i otomatik olarak güncel sürüm kabul etme.

## 3. Mimari ve kodda nereden başlanır

```text
Demo: src/model.js + src/useMission.js → src/App.jsx → tablo/grafikler/Twin

API: backend/send_sample.py veya gelecekte cihaz adaptörü
       → FastAPI doğrulama ve token kontrolü
       → PostgreSQL missions + measurements
       → GET API ve src/api.js adaptörü
       → src/ApiWorkspace.jsx → ortak RecordsTable ve Twin
```

| Dosya | Sorumluluk |
| --- | --- |
| `src/SourceApp.jsx` | Demo/API seçimi; aynı anda iki görev kaynağı çalıştırmaz |
| `src/App.jsx` | Eski demo çalışma alanları; API'ye geçiş düğmesi |
| `src/useMission.js` | Tarayıcıdaki demo zamanlayıcısı ve localStorage; fiziksel kontrol değil |
| `src/model.js` | Sentetik ölçüm, demo durum makinesi, IDW, CSV, filtreler |
| `src/api.js` | Sözleşmeden görüntüleme modeline dönüşüm; birim/eksik değer ve sahne uygunluğu |
| `src/ApiWorkspace.jsx` | Sunucu görevlerini/ölçümlerini okuma; hata ve son başarılı veri durumu |
| `src/components.jsx` | Ortak tablo, demo profili ve dialog bileşenleri |
| `src/Twin.jsx` | Şematik Three.js sahnesi; API modunda bot/vinç/rota gizlenir |
| `backend/app/schemas.py` | Sözleşmenin yürütülebilir doğrulaması |
| `backend/app/main.py` | Mevcut HTTP uçları ve idempotent kayıt |
| `backend/app/db.py` | PostgreSQL bağlantısı ve transaction/kilitli migration |
| `backend/migrations/` | Numaralı veritabanı şema değişiklikleri |
| `backend/tests/test_api.py` | Gerçek PostgreSQL ile API testleri |
| `src/*.test.js` | Frontend model/adaptör testleri |
| `e2e/measurement-flow.spec.js` | Gerçek API/DB üzerinden Playwright senaryoları |

Ölçüm route'ları `backend/app/main.py`, planlar `backend/app/plans.py`, operatör oturumu `backend/app/operator.py` içinde bulunur. Yeni görev/telemetri modülleri büyürken route ve servisleri ayır; sırf stil için bütün backend'i yeniden yazma. Framework değiştirme veya ayrı repo açma mevcut planın parçası değildir.

## 4. Birbirimizle çelişmemek için koruyacağımız kararlar

### Veri ve anlamı

- React + Vite + Three.js, FastAPI ve PostgreSQL korunur. Backend için sahte bir in-memory liste veya SQLite fallback eklenmez.
- PostgreSQL API kayıtlarının kalıcı kaynağıdır. localStorage demo ve arayüz tercihleri içindir.
- `schema_version=1`; görev/ölçüm UUID'leri kullanılır. Tekrar gönderimde ölçüm UUID'si değişmez.
- Aynı kimlik ve normalize içerik 200; yeni kayıt 201; aynı kimlikle farklı içerik 409 döner. Değişik içeriği sessizce overwrite etme.
- `source=simulated` veya `source=device`. Görev ile ölçüm kaynağı eşleşmelidir; fixture verisini device olarak işaretleme.
- `measured_at` ölçüm zamanıdır; `received_at` sunucunun alım zamanıdır. Depolamada UTC, arayüzde açıkça etiketlenmiş yerel zaman kullanılır.
- `target_depth_m` ve `actual_depth_m` farklıdır; kablo uzunluğu ve gölet taban derinliği de bunlardan ayrıdır. Hedefe bakarak gerçekleşen derinliği üretme.
- Parametreler isteğe bağlıdır; pakette en az biri bulunur. Olmayan sensör sıfır veya sentetik değerle doldurulmaz.
- Birimler: `temp=degC`, `ph=1`, `do=mg/L`, `ec=uS/cm`, `turb=NTU`. Görüntü birimleri API kodlarından farklı yazılabilir; sayısal dönüşüm açık olmalıdır.
- Kalite API'de `unreviewed`, `valid`, `unstable`, `invalid`. UI adaptörü `valid` → `ok` çevirir. Yeni geliştirme bu eşlemeyi bozmasın.
- Kabul edilmiş kayıt anahtarı görev + istasyon + derinliği içerir. Yine de IDW çağrısına farklı görevleri karıştırmadan, açık bir görev/zaman seçimiyle veri verilir.

### Konum, geometri ve bilimsel sınırlar

- GNSS enlem/boylam derece, yerel x/kuzey koordinatları metredir. Dereceyi metre gibi hesaplama.
- Konumda ya enlem/boylam çifti ya da yerel x/kuzey + referans kimliği gerekir; ikisi de verilebilir. GNSS `accuracy_m` isteğe bağlıdır. Gerçek derinlik ise mevcut ölçüm sözleşmesinde zorunludur.
- `demo-pond-v1` gerçek ölçülmüş koordinat sistemi değildir. Mevcut API sahnesi yalnız bu referanstaki uygun noktaları gösterir; diğer kayıtlar tabloda kalır.
- Three.js içindeki `z` sahnedeki kuzey eksenidir; veritabanındaki coğrafi yükseklik olarak yorumlanmaz.
- Şematik batimetri, 5× görsel derinlik abartısı ve demo istasyonlarını gerçek saha bilgisi gibi sunma.
- Demo IDW derinlik mesafesinde 8× ağırlık kullanır; bu doğrulanmış fiziksel parametre değildir.
- En yakın örneğe uzaklık, GP varyansı veya güven aralığı değildir. Sentetik RMSE saha başarımı değildir.
- Ölçülen noktalar, interpolasyon ve ham veriler ayrı kalmalıdır. Cividis sayısal skala; kalite/hata renkleri farklı anlamdadır.

### Cihaz ve bağlantı

- Tarayıcı animasyonu cihazın durum kaynağı olamaz. Buton basılması komutun gerçekleştiğinin kanıtı değildir.
- API poll süresi 5 saniye, istek zaman aşımı 8 saniye; ekran başına mevcut koruma sınırı 10.000 kayıttır. Bunlar cihaz örnekleme gereksinimi değildir.
- API kesilince son başarılı veri korunur ve uyarı görünür; sessiz demo fallback yapılmaz.
- Yazma token'ı `AQUATWIN_INGEST_TOKEN` ile yalnız backend/cihaz tarafında tutulur; `VITE_*` içine, kaynak koda veya commit'e konulmaz.
- Plan yazımı ayrı operatör oturumu, Origin ve CSRF ile korunur; ayrıntılar `docs/MISSION_PLANNING.md` içinde. İlk ölçüm sonrası plan kilitlenir.
- Mevcut GET uçları yerel kullanım için açıktır; bu internet kullanımı için tam yetkilendirme değildir. HTTPS, kullanıcı rolleri ve yayınlama ayrı iş paketidir.
- Mevcut demo engelleri fiziksel güvenlik sertifikası değildir. Gerçek hareket kısıtları cihaz yazılımında da uygulanmalıdır.

## 5. Clone sonrası ilk çalışma sırası

Her geliştirme oturumunda önce [güvenli başlangıç prosedürünü](SESSION_START.md) otomatik uygula. Yeni iş güncel main’den açılır; devam eden işte branch ve yerel değişiklikler korunur. Senkronizasyondan sonra güncel rehberleri yeniden oku.

1. Kullanıcının güncel isteğini oku; donanım durumu değişmiş mi öğren. Repodan anlaşılabilen şeyi tekrar sorma.
2. `git status --short --branch` ve son commit'leri kontrol et. Başkasının değişikliklerini silme veya kendi commit'ine katma.
3. `AGENTS.md`, bu rehber, karar kaydı ve ölçüm sözleşmesini oku. Etkilenen kod/test dosyalarını ardından incele.
4. Önce demo kurulumunu `npm ci`, `npm test`, `npm run build` ile kontrol et. Node 20+ kullan; lockfile'ı koru.
5. `backend/README.md` ile kendi PostgreSQL ve Python 3.12+ ortamını kur. Başka kişinin `/tmp` veritabanı, portu veya token'ının sende de var olduğunu varsayma.
6. Demo ve backend birbirinden bağımsız başlar. PostgreSQL Compose host portu 54329, API 8000; Vite varsayılanı 5173 veya sonraki boş porttur. E2E varsayılanı özellikle 5176'dır.
7. API sağlığını kontrol et, örnek göndericiyi çalıştır, API çalışma alanında kaydı aç. Bir kez daha gönderip çoğalmadığını doğrula.
8. Gerçekleştirilecek tek iş paketini ve bitiş ölçütünü belirle; henüz istenmemiş tüm roadmap'i uygulama.

Kurulumun tek ayrıntılı kaynağı [backend/README.md](../backend/README.md) ve [README.md](../README.md). Bu rehber ortam değişkeni değerlerinin kopyalarını içermez.

## 6. Bundan sonraki adım adım plan

Aşağıdaki M1 tamamlanmıştır. **Kullanıcı M2 yerine yazılım özelliği M3'ü önceliklendirdi; M3 uygulandı. M4, M5 ve M6 yazılım altyapısı ile M7 yerel koordinat analizi uygulandı. M2 kurulum/CI eklendi; gerçek koşu kanıtını [doğrulama kaydından](VALIDATION_PRE_HARDWARE.md) kontrol et. Saha eşikleri, gerçek koordinat dönüşümü ve donanım adaptörleri teslim edilmiş sayılmaz.** M2–M7 donanım olmadan ilerletilebilir. Cihaz protokolüne bağlı ayrıntılar donanım bilgisi gelmeden kesinleştirilmez.

### M1 — Kalıcı ölçüm temeli — TAMAMLANDI

Kapsam: ölçüm sözleşmesi, PostgreSQL API, harici fixture gönderimi, React/API okuma, ortak tablo/3D noktaları ve testler.

Bitiş kanıtı: `7fe1bca` içeriği, PR #1 ve [doğrulama kaydı](VALIDATION_MEASUREMENT_API.md). Bu kayıt geçmiş koşullardaki doğrulamadır; her makinede otomatik test geçmiş sayılmaz.

### M2 — Tekrarlanabilir ekip ortamı ve otomatik kontroller — KURULUM/CI EKLENDİ

[TEAM_SETUP.md](TEAM_SETUP.md): temiz kaynak kurulumu ve tek komut doğrulama. Docker yok; native PostgreSQL yolu kullanıldı. CI dosyasının bulunması başarılı koşu kanıtı değildir; doğrulama kaydındaki gerçek sonucu esas al.

Amaç: takım arkadaşının kendi makinesinde aynı akışı kurabilmesi; mevcut geçici doğrulama ortamına bağımlılığın kaldırılması.

1. Temiz clone'da kilitli Node/Python bağımlılıklarıyla kurulumu doğrula.
2. Mevcut Compose tarifini Docker bulunan ortamda gerçekten çalıştırıp sağlık, volume kalıcılığı ve yeniden açılışı doğrula. Docker yoksa bunu doğrulanmış sayma; native PostgreSQL yolu belgede korunur.
3. Geliştirme DB'sinden ayrı backend test ve E2E DB'lerini/portlarını tanımla. E2E de yazma yaptığı için geliştirmenin veya sahanın gerçek kayıtlarında çalışmasın.
4. Kendi yerel secret dosyalarını kullan; mevcut dosyaları otomatik overwrite etme. Eksik ayarları anlaşılır biçimde raporla.
5. GitHub Actions üzerinde Node test/build ve PostgreSQL servisli backend testlerini ekle. Sonra ayrı portlu API/Vite başlatılarak Playwright'ı bağla.
6. Kontrollerin kapanışını ve başarısız olduğunda log/artefact çıktısını düzenle.

Bitiş ölçütü: temiz ortamda örnek ölçüm kalıcı olarak görülür; tekrar açılışta korunur; CI gerçekten koşmuş ve sonuçları kaydedilmiştir. Çıktı: kurulum güncellemesi, CI dosyaları ve güncel doğrulama kaydı.

### M3 — Kalıcı görev planı — UYGULANDI

Uygulama ve kurallar: [MISSION_PLANNING.md](MISSION_PLANNING.md). Doğrulama: [VALIDATION_MISSION_PLANNING.md](VALIDATION_MISSION_PLANNING.md). Aşağıdaki kapsam bu aşamada karşılandı; PR merge durumu Git geçmişinden ayrıca doğrulanmalı.

1. Görevin adı/kaynağı dışında planlanan istasyonları ve hedef derinlikleri modelle. Gerçekleşen ölçümler bu plandan ayrı tutulur.
2. Uygun yeni migration ve API işlemleri ekle; plan düzenlenmesi ile mevcut ölçümün immutable kimliği karışmasın.
3. Yerel koordinatlı sentetik plan ve daha sonra coğrafi plan için referans bilgisini açık tut.
4. API alanına görev/plan oluşturma ve görüntüleme ekle; token'ı frontend'e gömme. Uygulanan yaklaşım ayrı operatör parolası, HttpOnly oturum, Origin ve CSRF doğrulamasıdır; mevcut ingest token'ı tarayıcıya kopyalanmaz.
5. Aktif görev seçimi, zaman/istasyon/derinlik filtreleri ve geçmiş görevler arasında tutarlı seçim sağla.

Bitiş ölçütü: görev planı veritabanında saklanır; görev değişince ölçümler karışmaz; plan oluşturmak botu hareket ettirmez. API yetkilendirme yaklaşımı karar kaydına yazılmıştır.

### M4 — Telemetri ve olay sözleşmesi — UYGULANDI

[Sözleşme](TELEMETRY_CONTRACT.md), [doğrulama](VALIDATION_TELEMETRY.md). HTTP snapshot/olay alımı, migration 003, oturum/sıra koruması ve API paneli eklendi. Gerçek donanım yok; 15/60 sn eşikleri geçici tercihler. `send_telemetry.py` tek seferlik fixture aracıdır, M5 canlı simülatörü değildir.

1. Ölçümden ayrı telemetri modeli tanımla: cihaz kimliği, cihaz zamanı, sunucu alım zamanı, bağlantı oturumu, sıralama ve geçerlilik.
2. Destekleniyorsa konum, gerçek/hedef derinlik, vinç aşaması ve hata kodları ekle; donanımda olmayan alanları bilinmiyor bırak.
3. Görev olaylarını yapılandırılmış kayıt olarak sakla; ölçüm zamanı ile telemetri yaşını ayır.
4. Geciken/sırası değişen eski paketin yeni cihaz durumunu geriye götürmesini engelle.
5. UI'nin en son doğrulanmış cihaz durumunu göstermesini, stale/offline durumlarını ve kurtarma akışını tasarla.
6. İlk sürümde HTTP akışı yeterliyse koru. SSE/WebSocket/MQTT ancak ölçülmüş ihtiyaçla ve gerekçesi kaydedilerek seçilir.

Bitiş ölçütü: tarayıcı saatinden veya animasyondan cihaz durumu üretilmez; bağlantı kaybı ve eski paket senaryoları testlidir. Bu aşama gerçek motor kontrolü içermez.

### M5 — Harici görev simülatörü ve çevrimdışı kuyruk — UYGULANDI

[SIMULATOR.md](SIMULATOR.md): plan revision rezervasyonu, geçmiş zamanlı aşamalı sentetik replay ve kalıcı SQLite cihaz outbox’ı. Gerçekçi fizik veya canlı cihaz emülasyonu değil; normal/missing/unstable/restart/fault senaryoları ve retry/reorder sözleşmeleri testlidir.

1. `send_sample.py` fixture aracını koru; ayrı modül/program olarak aşamalı görev simülatörü ekle.
2. Simülatör M3 planını, M4 telemetri/olay sözleşmesini ve mevcut ölçüm sözleşmesini kullansın.
3. Yerel diske kalıcı gönderim kuyruğu ekle: kayıt onaylanmadan silinmez, süreç yeniden açılınca korunur.
4. Retry/backoff uygula; aynı paketin kimliği değişmesin. 409 farklı içerik çakışması sonsuz retry edilmesin; operatöre raporlansın.
5. Bağlantı kaybı, eksik sensör, kararsız pencere, cihaz yeniden başlatma, tekrar ve geç paket senaryolarını üret.
6. Simülatörün tüm çıktısı `simulated` olur; backend'i atlayarak UI'ye veri enjekte etmez.

Bitiş ölçütü: kesinti ve süreç restart'ından sonra bekleyen ölçümler birer kez saklanır; görev akışı izlenebilir. Testler sentetik veri ve gerçek DB ile uçtan uca çalışır.

### M6 — Kalite, ham veri ve kalibrasyon — YAZILIM ALTYAPISI UYGULANDI

[QUALITY.md](QUALITY.md): append-only kalibrasyon, parametre bazlı revision kontrollü kalite kararı, ham pencere istatistikleri ve operatör UI. Gerçek eşikler/kalibrasyon deneyi donanım bekliyor.

1. Mevcut genel kalite alanının yanında gerekli parametre/sensör bazlı kalite modelini tasarla.
2. Ham pencereyi koru; örnek sayısı, süre ve stabilizasyon özetlerini gerçek değerlerden hesapla.
3. Kalibrasyon kaydını sensör kimliği, prosedür, tarih ve referans bilgisiyle ilişkilendir.
4. Eşikleri sensör özellikleri ve deneyle belirle. Demo 5 s/3 s sürelerini, 0.30 mg/L eşiğini veya fixture kalitesini gerçek sensör doğrulaması sayma.
5. Değerlendirme değişirse ham ölçümü overwrite etmek yerine sürümlü değerlendirme/iz bırak.

Bitiş ölçütü: neden geçerli/geçersiz olduğu izlenebilir; tekrar ölçüm önceki kaydı silmez; kalibrasyon yapılmadıysa yapılmış gösterilmez.

### M7 — Gerçek koordinatlar ve API ölçümlerinde analiz — YEREL ANALİZ UYGULANDI, SAHA VERİSİ BEKLİYOR

[API_ANALYSIS.md](API_ANALYSIS.md): explicit görev/zaman/parametre/referans, son deneme ve son parametre review seçimi, IDW destek maskesi, gerçek derinlik profili ve ayrı görev karşılaştırması. Gerçek kıyı, batimetri, GNSS dönüşümü ve bağımsız saha doğrulaması eksiktir; sentetik veriyle bunlar tamamlandı denmez.

1. Gölet geometrisi/batimetri verisinin kaynağını ve doğruluğunu doğrula. Veri yoksa şematik etiket korunur.
2. Kullanılacak koordinat referans sistemi ve GNSS → yerel metre dönüşümünü belgeli, testli hâle getir. PostGIS gerekiyorsa bu ihtiyaca göre ekle.
3. API verisiyle görev/parametre/zaman filtresinden sonra IDW hesapla; ham ölçüm ve tahminleri ayrı tut.
4. Tekrarlı aynı istasyon/derinlik kayıtları için hangi zaman veya değerlendirme sürümünün kullanılacağını açıkça belirle; sınırsız geçmişi tek alan gibi karıştırma.
5. Derinlik mesafesi ağırlığını ve örnek kapsamı maskesini test et; 8× demo tercihini gerekçesiz gerçek modele taşıma.
6. İstasyon bazında dışarıda bırakma ve yeterli veri varsa ayrı tarihte doğrulama yap; parametre bazında RMSE/MAE raporla.

Bitiş ölçütü: aynı veri/ayar/sürüm aynı sonucu üretir; GNSS-only ölçüm uygun dönüşüm olmadan şematik noktaya çevrilmez; tahmin ve gözlem ayırt edilir.

### M8 — Donanım adaptörleri ve kontrollü entegrasyon — DONANIMA BAĞLI

1. Teslim edilen ekipmanın teknik özelliklerini ve gerçek arayüzlerini kaydet.
2. Önce tek sensörün ham okumasını doğrula; sonra sürümlü ölçüm formatına adaptör yaz.
3. Konum/derinlik geçerliliğini doğrula; hedef derinliği gerçek derinlik diye gönderme.
4. M5 kuyruk yapısını cihazda çalıştır; bağlantı kesilmesinde veri kaybını dene.
5. Gerçek kontrol gerekiyorsa komut kimliği, kabul/yürütülme/tamamlanma/hata durumlarını tasarla. Browser cevabını motor başarısı sayma.
6. İndirme, sıkışma, limit, toplama ve bağlantı kaybı davranışlarını elektronik/mekanik ekip ve danışmanlarla doğrula. Yazılım fiziksel limitleri tahmin ederek etkinleştirmesin.
7. Laboratuvar, kontrollü su ve saha testlerini ayrı kanıtlarla ilerlet.

Bitiş ölçütü: gerçek ölçüm gerçek sensör kimliği/kalibrasyon bilgisiyle izlenebilir; fiziksel komutlar yalnız doğrulanmış protokolle yürür. Donanım testleri yapılmadan saha başarımı yazılmaz.

### M9 — İleri analiz ve paylaşılabilir işletim — İLERİ HEDEF

Yeterli veri ve zaman varsa GP/Kriging karşılaştırması, kalibre belirsizlik, operatöre örnekleme önerileri ve geçmiş telemetri replay'i eklenebilir. Manuel bot kapsamı kendiliğinden otonom navigasyona çevrilmez. İnternet yayını ayrıca kullanıcı/cihaz yetkilendirmesi, HTTPS, secret yönetimi, yedekleme ve işletim planı gerektirir; branch merge etmek yayın değildir.

## 7. Test ve doğrulama kuralları

M3 doğrulamasında 30 backend testi, 16 frontend birim testi, 4 Playwright senaryosu ve build geçti. Ayrı E2E ortamında `E2E_OPERATOR_PASSWORD` gerekir. Ayrıntılar ilgili M3 doğrulama kaydında; yeni işte kontrolleri tekrar çalıştır.

2026-11-25 ölçüm temeli doğrulamasında 12 frontend testi, 17 backend testi, 2 Playwright senaryosu ve build geçti. Bunlar tarihsel başlangıç sayılarıdır; yeni test eklenince sayı değişebilir. Şu an çalıştırmadığın testi geçmiş kayıttan yola çıkarak "geçti" diye sunma.

Frontend:

```bash
npm ci
npm test
npm run build
```

Backend: `backend/README.md` kurulumundan sonra, **ayrı test DB** kullanarak:

```bash
TEST_DATABASE_URL=postgresql://USER:PASSWORD@127.0.0.1:PORT/aquatwin_test PYTHONPATH=backend .venv/bin/python -m pytest -q backend/tests
```

Yer tutucuları kendi ortamına göre değiştir. Windows'ta sanal ortam Python yolu farklıdır. Testler adı `aquatwin_test` ile başlayan DB ister; yine de bağlandığın host/DB'yi doğrula. Kurulum değişkenlerini veya token'ı loglara dökme.

E2E için ayrıca API ve Vite çalışmalı; Playwright bunları kendisi başlatmıyor:

```bash
# Ayrı E2E ortamında API'yi aç; test token'ı bu API ile eşleşsin.
npm run dev -- --port 5176
# Başka terminal; backend ortamındaki token yüklenmiş olmalı:
npm run test:e2e
```

Gerekirse `E2E_BASE_URL`, `E2E_API_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` kullanılır. İlk tarayıcı kurulumu `npx playwright install chromium`. Testler fixture görev/ölçümleri ekler; saha DB'sine karşı çalıştırma.

Bilinen sınırlar: Three.js chunk için 500 kB build uyarısı; Starlette/httpx deprecation uyarısı; henüz çalıştırılarak doğrulanmamış Compose tarifi. Bunları gizleme veya geçmeyen kontrolü "normal" sayma. İlgili değişiklik için anlamlı testleri çalıştır; yalnız doküman düzenlemesinde kaynak/dosya/bağlantı tutarlılığını kontrol etmek yeterlidir.

## 8. Ekip ve Git çalışma düzeni

- Her iş güncel main'den ayrı `feat/...`, `fix/...` veya `docs/...` branch'inde ilerler. Önce mevcut kullanıcı değişikliklerini ve upstream durumunu incele.
- Kullanıcı bu projede geliştirme sırasında anlamlı aşamalarda açıklayıcı commit ve push istiyor. Bozuk veya testleri başarısız aşamayı sırf zaman doldu diye pushlama.
- Commit başlığı yapılan işi somut anlatır; gövdede neden ve ilgili doğrulama bulunur. Sonuçsuz "update/fix stuff" mesajları kullanma.
- PR açıklaması kapsamı, testleri, sınırlamaları ve kurulum/migration etkisini açıklar. Merge/deploy için güncel kullanıcı yetkisini esas al; geçmiş bir onayı yeni merge yetkisi sayma.
- Aynı paylaşılan branch'e farklı AI'lar eşzamanlı push yapmasın. İşleri sorumluluk ve sözleşme düzeyinde böl; branch'ler PR üzerinden birleşsin.
- Şema değişikliği backend doğrulama + frontend adaptör + test + sözleşme belgesiyle aynı PR'da gelir. Uygulanmış migration'ı değiştirmek yerine yenisini ekle.
- Başkasının kodunu reset/clean/force-push ile silme. `.env`, token, DB dump, ham saha verisi ve test çıktıları commit edilmez.

Önerilen görev paylaşımı: frontend/etkileşim; backend/veri modeli; simülatör/cihaz adaptörü. Bu bir rol önerisidir; gerçek ekip üyeleri için sorumluluk atanmış değildir. Veri sözleşmesi ortak karardır.

## 9. AI bir işi teslim ederken bu dosyaları nasıl günceller

1. Değişikliği ve gerekçesini `DEVELOPMENT_DECISIONS.md` içine tarihli olarak ekle; eski kararın yerine geçtiyse hangisi olduğunu belirt.
2. Bu rehberde ilgili kilometre taşını yalnız bitiş ölçütü karşılanınca tamamlandı yap; kısmi işleri açık yaz.
3. Sözleşme veya kurulum değiştiyse kendi ilgili belgesini güncelle. Aynı ayarları beş dosyaya kopyalama.
4. Doğrulama kaydında komutları, sonuçları ve çalıştırılmayan kontrolleri ayır. Geçici makine yollarını ekip kurulumu gibi yazma.
5. Commit/push ve PR bilgilerini gerçek Git durumundan doğrula. "Main'e alındı" ancak merge doğrulanırsa yazılır.

Doküman-kod çelişkisinde kodun gerçek davranışını test et, farkı raporla ve kullanıcının istediği kapsamda düzelt. Dokümandaki istenen davranışı kodda uygulanmış kabul etme; test edilen davranışı da onaylı tasarım niyetiyle karıştırma. Kırıcı sözleşme değişikliğini gizlice yapma.

## 10. Arkadaşının AI'ına verebileceği başlangıç metni

> Bu AquaTwin reposunda önce AGENTS.md ve docs/AI_HANDOFF.md dosyalarını oku. Sonra DEVELOPMENT_DECISIONS.md, docs/MEASUREMENT_CONTRACT.md ve ilgili kurulum belgelerini incele. Git branch/HEAD ve kod üzerinden mevcut durumu doğrula. Tamamlanan işlerle planlananları ayır. Donanım teslim edilmediyse sensör veya kontrol protokolü varsayma. Çalışan React/FastAPI/PostgreSQL yapısını koru. İstediğim iş paketine odaklan; tüm roadmap'i kendiliğinden uygulama. Değişiklik kararlarını ve gerçek test sonuçlarını belgele; anlamlı aşamalarda açıklayıcı commit ve push yap. Kullanıcıdan merge yetkisi gelmeden main'e birleştirme.

Her AI aracı repo talimat dosyalarını otomatik yüklemeyebilir. Bu başlangıç metniyle rehberin açıkça okutulması desteklenir; dosyaların varlığı tek başına tüm araçlarda otomatik okumayı garanti etmez.
