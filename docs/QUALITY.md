# Ham veri, parametre kalitesi ve kalibrasyon

Migration 005 yeni `calibrations` ve `quality_reviews` tablolarını ekler. Ölçüm v1, ham örnekler ve ilk `quality` beyanı değişmez. Operatör ölçüm ayrıntısındaki **Parametre kalite incelemesi** bölümünde değerlendirme yapar. Önce operatör girişi gerekir.

- GET `/measurements/{id}/quality`: son review revision, tam geçmiş ve parametre başına ham pencere özeti.
- PUT aynı uç: operatör session + Origin + CSRF; expected_revision, recorded_by ve ölçülen parametrelerin tam kümesi. Her parametrede status (unreviewed/valid/unstable/invalid), reason, isteğe bağlı calibration UUID ve thresholds bulunur. Eski revision 409; aynı içerik yeni revision üretmez. Özgün ölçüm mutate edilmez.
- POST `/calibrations`: operatör yetkisi. UUID, sensör kimliği, parametre/birim, source, performed_at, isteğe bağlı expires_at, procedure, recorded_by, outcome (pass/fail/unreviewed), 1–20 reference_value/observed_value çifti. Append-only; aynı UUID+aynı içerik retry 200, farklı içerik 409. UI tek referans çifti girer, API çok noktayı destekler. Değerleri otomatik dönüştüren kalibrasyon eğrisi yoktur.
- GET `/calibrations`: sensor_id filtresi, limit/offset. UI son 200 kaydı listeler.

`recorded_by` kişinin beyanıdır, bağımsız kullanıcı kimliği doğrulaması değildir. Shared operatör hesabı gerçek çok kullanıcılı audit sistemi sayılmaz. UI kaynak/sensör/parametreyi ölçümden alır, eksik donanım bilgisi uydurmaz.

Ham özet: parametreyi içeren n, son−ilk offset süresi, aritmetik ortalama, n−1 örnek standart sapması. n<2 ise SD yoktur. Eşikler yoksa not_evaluated; açık min_samples/min_duration_s/max_sd ile yetersiz/verilen eşik içinde/eşik dışında ayrımı yapılır. Eşiklerin gerekçesi zorunludur, varsayılan fiziksel kabul eşiği yoktur. Eşiğin karşılanması otomatik valid kararı değildir; operatör gerekçeli karar verir. Gerçek sensör özellikleri gelince eşikler deneyle belirlenecek.

Kalibrasyon bağlamak için sensör, parametre ve source eşleşmeli; outcome=pass, performed_at≤measured_at ve varsa expires_at≥measured_at olmalı. UUID yok/uyuşmazsa 422. Bağlanmadıysa eksiklik açıkça kalır; genel legacy calibration_id etiketini doğrulanmış kayıt sanma. Kalibrasyon olmadan gerekçeli kalite kararı verilebilir, bu kalibrasyon yapılmış anlamına gelmez.

Analiz son parametre review'ını, yoksa ilk ingest kalite beyanını kullanır. Kayıt tablosu ve hedef karşılaştırması hâlâ **ilk ingest kalite beyanını** gösterir; bunları güncel parametre incelemesiyle karıştırmayın. Kalite ayrıntısını açıp güncel revision'ı inceleyin. Değerlendirme değişiklikleri geçmişe eklenir, eski ölçüm veya eski değerlendirme silinmez. Gerçek kalibrasyon ve saha kabulü donanım tesliminden sonra doğrulanır.
