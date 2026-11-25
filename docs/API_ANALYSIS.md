# API ölçümlerinde yerel koordinat analizi

API çalışma alanındaki **API ölçüm analizi** bölümü backend'de `POST /api/v1/analysis` çağırır. Bu salt-okuma hesaplama kalıcı ölçüm yazmaz. Demo state'i kullanılmaz. Algoritma sürümü `idw-local-v1`.

Açık seçimler: tek mission UUID, parametre, yerel metre referans kimliği, dahilî UTC başlangıç/bitiş (opsiyonel), depth_scale>0 (≤100), IDW power 1–4, radius_m>0 (≤100000), en fazla 200 sorgu noktası x_m/north_m/depth_m. UI zamanları yerel girip UTC gönderir; boş zaman bütün seçili görevdir. Varsayılan derinlik mesafe çarpanı 1, kuvvet 2, yarıçap 20 m: kullanıcı tarafından değiştirilebilir yazılım tercihleri; saha kalibrasyonu değildir. Demo'nun 8× çarpanı otomatik taşınmadı.

Seçim sırası: zaman penceresi → her istasyon/hedef derinliğin **son denemesi** (measured_at, UUID tie-break) → parametre varlığı → son parametre review'ı, yoksa ilk ingest kalite beyanı valid → aynı referanslı yerel koordinat. Son deneme invalid/unreviewed ise eski valid'e dönülmez. GNSS-only veya başka referanslı kayıtlar açık excluded sayısında kalır. Dereceler metre gibi hesaplanmaz. 10.000 ham kayıt / 1.000 seçili gözlem sınırı aşılırsa 413; zaman aralığını daraltın.

Mesafe = hypot(dx, dnorth, ddepth×depth_scale). Yarıçap dışı noktalar destek vermez. Tam aynı konum/derinlikteki en yeni gözlem `measured` döner. Diğer noktalar en az iki farklı 3D destek konumuyla IDW tahminidir (`interpolated`); yoksa no_support/insufficient_support ve null. Sayısal kararlılık için ağırlıklar nearest/distance ile normalize edilir. Konumlar aynı olan farklı kayıtlar tam noktada en yeniyle çözülür. Tahminler ölçüm tablosuna yazılmaz. Yarıçap maskesi dışbükey zarf maskesi değildir; gözlem zarfı dışında da destek yarıçapı içinde tahmin üretilebilir, bu saha kapsamı/güven kanıtı değildir.

UI 11×11 destekli tahmin ızgarası, bir sorgu noktası, Cividis renk ölçeği, gerçek derinlik profili ve gözlem tablosu gösterir. Boş hücre tahmin yok anlamına gelir; şekil gerçek kıyı veya batimetri değildir. Profil grafiği sadece ölçülen noktaları gösterir. Ayrıntılarda hesaplamanın kendi snapshot ayarları bulunur; formu değiştirmek otomatik yeniden hesaplamaz. Aynı kaynak türündeki başka görev ayrı hesaplanır, sorgu noktası farkı seçili−karşılaştırma olarak gösterilir; veriler birleştirilmez. İki tahminden biri yoksa fark yoktur.

Doğrulama: bir istasyonun bütün gözlemleri dışarıda bırakılarak kalan istasyonlardan tahmin üretilir. Yeterli destek varsa RMSE ve değerlendirilen/toplam sayısı raporlanır; yeterli yoksa null. Bu leave-one-station-out, bağımsız tarih/saha testi değildir. Yarıçap destek maskesi ve yakınlık istatistiksel güven aralığı veya GP varyansı değildir. Kalibrasyon bağlantısı olmayan valid değerler kalibre edilmiş sayılmaz.

Donanıma/veriye bağlı kalanlar: gerçek kıyı/batimetri, doğrulanmış koordinat dönüşümü, fiziksel derinlik ağırlığı, sensör eşikleri ve bağımsız saha doğrulaması. GP/Kriging bu teslimin parçası değildir.
