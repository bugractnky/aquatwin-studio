# AquaTwin: bilimsel renk ve HCI kararları

Araştırma tarihi: 4 Kasım 2026. Bu not, literatür bulgularını tasarım tercihlerinden ayırır. Uygulamanın kullanılabilirliği henüz saha katılımcılarıyla doğrulanmamıştır.

## 1. Sayısal veri için bilimsel renk skalası

Crameri, Shephard ve Heron (2020), algısal olarak düzensiz skalaların görsel veri yorumunu çarpıtabildiğini; yaygın rainbow ve eş parlaklıklı kırmızı/yeşil karşıtlıklarının sorunlu olduğunu tartışır. Bu nedenle ölçüm renkleri dekoratif marka gradyanından ayrıldı; göz alıcı gökkuşağı skalası kaldırıldı.

Kaynak: [The misuse of colour in science communication, Nature Communications](https://doi.org/10.1038/s41467-020-19160-7).

Nuñez, Anderton ve Renslow (2018), kırmızı/yeşil renk görme farklılıkları dikkate alınarak optimize edilmiş Cividis skalasını sunar. Bu yüzden büyüklük verileri için orijinal Matplotlib Cividis LUT'sinin 256 örneği kullanıldı. Gösterge ve sahne aynı `dataColor` fonksiyonundan beslenir. Özel bir gradyana Cividis adı verilmedi. Sabit parametre sınırları görevler arasında renk anlamını korur. Skala aralığı kalite sınırı değildir.

Kaynak: [PLOS ONE, DOI 10.1371/journal.pone.0199239](https://doi.org/10.1371/journal.pone.0199239); [yazarların açık makale sürümü](https://arxiv.org/abs/1712.01662).

Mutlak miktar için sıralı skala; M011'e göre negatif/pozitif değişim için sıfır merkezli RdBu_r skala kullanıldı. Kırmızı/mavi burada işaret yönüdür, çevresel alarm anlamına gelmez. Uzaklık katmanı gri skaladır ve güven aralığı olmadığı açıkça yazılır. Kalite ayrıca metin, simge ve nokta şekliyle belirtilir.

## 2. Açık ve koyu tema

Piepenbrock, Mayr ve Buchner (2014) kontrollü metin okuma/düzeltme görevinde açık zemin üzerindeki koyu metinle daha iyi performans bildirir. Buchner ve Baumgartner (2007) da benzer deneylerde olumlu polarite avantajını inceler. Bunlar gölet kenarında yapılmış saha araştırmaları değildir; her kullanıcı, ekran veya ışık koşulunda tek tema üstünlüğü kanıtlamaz.

Kaynaklar: [2014 araştırması](https://doi.org/10.1080/00140139.2014.948496), [2007 araştırması](https://doi.org/10.1080/00140130701306413).

Çıkarımımız: metin ve tabloların öneminden dolayı varsayılan açık tema, düşük ışık/tercih için koyu tema. Otomatik olarak ortam ışığı ölçüldüğü iddia edilmez.

## 3. Arayüz ve veri renkleri ayrı

Bunlar makalelerin zorunlu tuttuğu HEX kodları değil, karşıtlık ölçümüyle desteklenen proje tasarım kararlarıdır.

| İşlev         | Açık tema | Koyu tema    |
| ------------- | --------- | ------------ |
| Arka plan     | #F1F5F7   | #0D1822      |
| Panel         | #FFFFFF   | #152530      |
| Ana metin     | #172C3B   | #EDF4F8      |
| İkincil metin | #4C6373   | #B3C7D3      |
| Eylem/seçim   | #126875   | #8AD9DC      |
| Dikkat        | #854B08   | #F7D391      |
| Hata          | #A52B24   | #FFC0B6      |
| Geçerli durum | #216347   | #A5DFBA      |
| Sayısal veri  | Cividis   | Aynı Cividis |

Dikkat/hata renkleri tüm kartlara yayılmaz; eylem gereken durumlara ayrılır. Her durum metinle açıklanır. Rengin tek başına fiziksel bir risk sınıfını doğruladığı iddia edilmez.

## 4. Durum farkındalığı ve bilgi önceliği

Endsley (1995), dinamik sistemlerde durum farkındalığını; dikkat, bellek, iş yükü ve otomasyonla ilişkili bir çerçevede ele alır. NASA Human Integration Design Handbook, kritik bilginin görünür tutulmasını ve dikkat çekici kodlamanın ölçülü kullanılmasını önerir.

Kaynaklar: [Endsley, Human Factors](https://doi.org/10.1518/001872095779049543), [NASA HIDH](https://www.nasa.gov/human-integration-design-handbook/), [HIDH Revision 1 PDF](https://www.nasa.gov/wp-content/uploads/2023/03/human-integration-design-handbook-revision-1.pdf).

Uyarlama: kalıcı görev şeridi; aktif istasyon, gerçek/son bilinen derinlik, ölçüm aşaması ve telemetri yaşı. İncelenen istasyon ayrı; otomatik takip kullanıcı seçimine bağlı. Görev yüzdesi yerine ölçüm kapsamı açıkça adlandırılır, sensör toplanmadan görev tamamlanmaz. Sonraki aşama ve yaklaşık demo süresi gösterilir. Operasyon, analiz ve kayıt ekranları ayrılır.

## 5. Erişilebilirlik

WCAG 2.2 normal metinde 4,5:1; büyük metinde 3:1 karşıtlık eşiği belirtir. 24×24 CSS px hedef veya uygun istisna/boşluk minimumu vardır. Sürükleme hareketinin tek işaretçiyle sürüklemeden yapılabilen alternatifi bulunmalıdır. Klavye erişimi ayrıca gereklidir.

Kaynaklar: [metin karşıtlığı](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [hedef boyutu](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [sürükleme alternatifleri](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [klavye](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html).

Uyarlama: sistem fontu, okunaklı 12–16 px içerik, çoğu hedefte 44 px boyut, görünür odak, açıklamalı menü, native select ve dialog, kamera döndürme/yakınlaştırma düğmeleri, tablo başlıklarında sıralama durumu, ekran okuyucu durum mesajı ve hareket azaltma desteği. 12/14/16 veya 44 px seçimi doğrudan WCAG'nin evrensel font zorunluluğu değildir.

## 6. Doğrulama planı ve sınırlar

- Model testleri: güvenli derinlik, toplama öncesi geçiş engeli, kararsız kaydın dışlanması, IDW bilinen nokta tahmini, renk/gösterge eşliği, yerel kayıt doğrulaması, CSV kaçışları.
- Tarayıcı: canlı görev, bağımsız istasyon seçimi, hata/yeniden ölçüm, analiz katmanları, replay, filtreler, kayıt penceresi, tema ve mobil yeniden akış.
- Kontrast: palet tokenları için sayısal ölçüm; erişilebilirlik kontrolleri için hedef boyutu ve DOM semantiği.
- Tam uyumluluk, dış ortam okunabilirliği veya gerçek kullanıcı başarımı bu kontrollerle kanıtlanmış sayılmaz. Üç görevle temsilî kullanıcı testi gerekir: bot durumunu anlama, belirli derinlikteki kaydı bulma, görev sürerken farklı istasyonu inceleyip aktif bota dönme.

## Veri modeline ilişkin dürüstlük

Gerçek batimetri dosyası yoktur. Eklenen dip modeli şematiktir ve arayüzde böyle işaretlenir. IDW uygulanmıştır; GP/kriging veya istatistiksel belirsizlik uygulanmış gibi gösterilmez. Örnekleme önerileri model güveni yerine örnek uzaklığına dayanır. Gerçek hardware komutları veya otomatik acil durum prosedürü yoktur.
