# AquaTwin Studio 0.2

React + Three.js ile bot ve vinç tabanlı, çok derinlikli su kalitesi izleme prototipi. Fiziksel cihaza komut göndermez. Geometri, telemetri, kalibrasyon ve ölçümler sentetiktir.

```sh
npm install
npm run dev
npm run build
npm test
```

## Çalışma alanları

- **Canlı görev:** kalıcı durum şeridi, vinç derinliği, stabilizasyon/ölçüm geri sayımı, istasyon kapsamı ve olaylar.
- **Analiz:** gerçek IDW derinlik dilimi ve dikey kesit, görev içi leave-one-out RMSE, örnekleme uzaklığı göstergesi, önceki göreve göre fark ve sonraki örnekleme adayları.
- **Ölçüm kayıtları:** sıralama, kalite/derinlik/istasyon filtreleri, seçili kayıt, ham DO penceresi, standart sapma, kalibrasyon ve filtre kapsamı belirtilen CSV.
- **Görev geçmişi:** iki tamamlanmış sentetik görev ve kayıtların zaman sırasıyla açıldığı replay. Tarihsel fiziksel rota iddiası yoktur.
- **Ayarlar:** açık/koyu tema, hareket azaltma, demo hızı, DO dikkat eşiği ve bağlantı/vinç/kararsız ölçüm senaryoları.

Aktif bot ile incelenen istasyon ayrıdır; yalnızca “Bot takibi açık” seçiliyse istasyon otomatik güncellenir. Yenileme sonrası yerel kayıtlar geri yüklenir, görev duraklatılır. Sıfırlama ve iptal native dialog ile onaylanır; kayıtlar sıfırlanmadan CSV alınabilir.

## Bilimsel ve teknik sınırlar

IDW gerçekten hesaplanır; GP/kriging uygulanmaz. Derinlik mesafede 8× ağırlıklandırılır (demo seçimi). Örnekleme uzaklığı istatistiksel belirsizlik veya güven aralığı değildir. Değişim katmanı iki tahminin farkıdır. RMSE yalnızca sentetik görev içindeki nokta bırakma değerlendirmesidir. Öneriler enerji/engel/rota optimizasyonu yapmaz.

Şematik batimetri ile güvenli hedefler hesaplanır; gerçek gölet araştırması yerine geçmez. Sensör toplanmadan istasyonlar arası hareket oluşmaz; dipten 0,4 m bırakılır. Gerçek kablo uzunluğu ölçülmez. Demo bekleme süreleri gerçek prob sürelerini temsil etmez. DO uyarı eşiği çevresel/mevzuatsal bir tanı değildir.

## Tasarım dayanağı

`RESEARCH.md` bilimsel bulguları, kaynakları, palette seçimlerini ve kanıt sınırlarını içerir. Tasarım, React bileşenleri ve saf model fonksiyonları ayrı dosyalardadır. Ağ fontu veya CDN yoktur; sistem fontları kullanılır. Three.js yalnızca gerektiğinde dinamik yüklenir. WebGL yoksa istasyon seçici, profil ve tablo eşdeğer veri erişimi sağlar. Hedefler çoğunlukla 44 px; özel görünüm düğmeleri de 44 px. Tam WCAG sertifikasyonu iddiası yoktur.
