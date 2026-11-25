# Her geliştirme oturumunda güvenli başlangıç

Yeni clone, yeni AI sohbeti ve mevcut işe dönüşte **düzenleme yapmadan önce** bu prosedürü otomatik uygula. Kullanıcının açık güncel talimatı önceliklidir.

## 1. Yerel işi koru

```bash
git status --short --branch
git branch --show-current
git log -5 --oneline
git remote -v
```

Doğru repo/origin olduğunu doğrula. Bitmemiş merge/rebase/cherry-pick varsa önce durumunu çöz. Dirty alanda otomatik checkout, pull, stash, commit veya reset yapma. Değişikliklerin sahibini ve mevcut işi belirle; gerekiyorsa kullanıcıyla netleştir veya ayrı worktree kullan. Başkasının değişikliğini kendi commit'ine katma. Detached HEAD veya main'in başka worktree'de açık olması durumunu zorla aşma.

## 2. Remote bilgisini tazele

```bash
git fetch origin
```

Fetch dosyaları değiştirmez. Ağ/yetki hatasında eski remote bilgisini güncel sayma; hatayı bildir ve güncel base'e bağlı geliştirmeyi durdur. Açık offline çalışma yetkisi varsa kullanılan commit'i kaydet.

## 3. Yeni bağımsız iş

Alan temizse ve devam eden feature işi terk edilmiyorsa:

```bash
git switch main
git pull --ff-only origin main
git rev-list --left-right --count main...origin/main
```

Sonuç **0 0** olmalı. Yerel main ilerideyse veya ayrışmışsa reset/force kullanma; durumu raporla. Yerel main yoksa `git switch --track -c main origin/main` kullan. Main başka worktree'deyse onu zorlamadan ayrı worktree/branch kullan.

Sonra benzersiz bir iş branch'i aç:

```bash
git switch -c feat/meaningful-task-name
```

İşe göre `fix/` veya `docs/` kullan. Başlangıç HEAD'i fetch edilen `origin/main` ile aynı olmalı. Merge edilmiş eski branch'i yeni işte tekrar kullanma.

## 4. Mevcut işe dönüş

Feature branch'inde kal ve fetch sonrasında kontrol et:

```bash
git rev-list --left-right --count HEAD...origin/main
git log --oneline HEAD..origin/main
```

İlk sayı branch'e, ikinci sayı main'e özgü commit sayısıdır. İkinci sayı sıfırsa branch güncel main'i içerir. Main'de eksik commit varsa temiz alanda `git merge origin/main` ile mevcut işi koruyarak güncelle. Paylaşılan history'yi otomatik rebase etme. Çakışmada bağımlı geliştirmeyi durdur; tarafların amaçlarını incele, belirsiz ürün/kontrat kararlarını kullanıcıya sor. Branch'in kendi upstream'inde yeni commit varsa onu da incele ve koruyarak entegre et; force push kullanma. Eş zamanlı işler için kişi/iş başına branch tercih et.

## 5. Güncel rehberi yeniden oku

Senkronizasyondan sonra AGENTS.md, AI_HANDOFF.md, karar kaydı ve ilgili sözleşmeleri yeniden oku. Kısa başlangıç bilgisi ver: branch, base commit ve senkronizasyon sonucu. PR öncesinde tekrar fetch ile main farklarını kontrol et; entegrasyon sonrası ilgili testleri yeniden çalıştır. Merge yalnız açık kullanıcı yetkisiyle yapılır.

## Otomasyonun sınırı

Bu, AI giriş dosyalarına bağlı zorunlu başlangıç talimatıdır; arka planda dosyaları değiştiren pull servisi değildir. Git hook'ları AI sohbeti başlangıcını evrensel olarak algılamaz. Her AI bu dosyaları otomatik okumaz; ilk kullanımda şunu söyleyin:

> AGENTS.md'yi oku ve her geliştirme oturumunda docs/SESSION_START.md prosedürünü otomatik uygula. Yerel işi koruyup güncel main kontrolünden sonra geliştirmeye başla.

Zip indirilmişse normal Git clone gerekir. Bu süreç güncel başlamayı sağlar; eş zamanlı geliştirmede bütün çakışmaları önleyemez.
