# Kahve Üreticisi B2B Sipariş, Operasyon ve Müşteri Yönetim Uygulaması

> Ürün tanımı — kaynak spec. Mimari karşılığı için `docs/MIMARI.md`.

## 1. Uygulamanın Genel Tanımı

Bu uygulama, kahve üreticisi bir firmanın kendi müşterileriyle olan tüm toptan satış, sipariş,
üretim, sevkiyat, hizmet ve iletişim süreçlerini tek bir platform üzerinden yönetmesini sağlayan B2B
mobil uygulama ve yönetim sistemi olarak tasarlanacaktır.

Uygulamanın temel amacı, kahve üreticisinin müşterilerinden aldığı toptan siparişleri dijitalleştirmek
ve siparişin oluşturulmasından üretimine, sevkiyatından müşteriye teslim edilmesine kadar olan tüm
süreci takip edilebilir hale getirmektir.

Ancak uygulama yalnızca bir kahve sipariş uygulaması olmayacaktır. Firmanın kahve dışında sattığı
veya sunduğu tüm ürün ve hizmetler de sistem içerisinde yer alabilecektir:

- Kahve çeşitleri
- Paketleme ürünleri
- Kahve makineleri
- Ekipmanlar
- Araç ve gereçler
- Sarf malzemeleri
- Barista ekipmanları
- Barista eğitimi
- Teknik servis
- Danışmanlık
- Diğer ürün ve hizmetler

Bu nedenle uygulama; B2B sipariş platformu, müşteri yönetim sistemi ve operasyon takip sistemi olarak
çalışacaktır.

## 2. Sistemin Temel Mantığı

Uygulamanın merkezinde kahve üreticisi firma bulunur. Firma kendi müşterilerini sisteme tanımlar,
müşterilerin hangi ürünleri görebileceğini ve hangi fiyatlardan satın alabileceğini belirler.

Müşteriler uygulama üzerinden kendilerine tanımlanan ürünleri görür, siparişlerini oluşturur ve
siparişlerinin hangi aşamada olduğunu takip eder.

Sipariş üretici firmanın içerisinde farklı departmanlardan geçer:

`Müşteri → Satış → Üretim → Sevkiyat → Teslimat`

Her departmanın kendisine ait ekranı ve yetkileri bulunur. Herkes yalnızca kendi sorumlu olduğu
aşamayı yönetir; üretici firma yöneticisi bütün sistemi kontrol edebilir.

## 3. Müşteri Üyelik Sistemi

Uygulamayı kullanmak isteyen işletmeler telefon numarası üzerinden üyelik talebinde bulunacaktır.
Başvuru doğrudan aktif hale gelmez; kahve üreticisi firmanın yönetim paneline düşer. Üretici firma
başvuruyu inceleyerek:

- Onaylayabilir
- Reddedebilir
- Bilgileri düzenleyebilir
- Müşteriye kullanıcı rolleri tanımlayabilir
- Müşteriye bağlı şubeler oluşturabilir

Onaylanan firma artık üreticinin sistemindeki aktif B2B müşterisi olur. Hesap ve üyelik işlemlerinin
temelinde telefon numarası bulunur.

## 4. Firma ve Şube Yapısı

Bir müşterinin birden fazla şubesi olabilir. Sistemde firma ile şubeler arasında hiyerarşik bir yapı
bulunmalıdır. Örnek:

```
ABC Coffee
├── Merkez
├── Konyaaltı Şubesi
├── Lara Şubesi
└── Kemer Şubesi
```

Her şubenin farklı adresi, teslimat noktası, kullanıcıları, siparişleri ve yetkileri olabilir. Ana
firma bütün şubelerini tek merkezden görebilmeli ve yönetebilmelidir. Şube müdürü veya ilgili
kullanıcı ise yalnızca kendisine yetki verilen şubenin bilgilerine erişebilmelidir.

## 5. Rol ve Yetkilendirme Sistemi

Her rolün görebileceği ekranlar ve değiştirebileceği bilgiler farklıdır.

- **Müşteri** — Ürünleri görür, sipariş oluşturur, siparişlerini takip eder, hizmetleri inceler,
  destek talebi oluşturur, bildirimleri alır.
- **Şube Müdürü / Bayi Yöneticisi** — Kendisine bağlı şubeyi/sipariş noktasını yönetir. Yetkisi
  dahilindeki siparişleri ve işlemleri takip eder.
- **Üretici Yöneticisi** — Sistemin en yetkili kullanıcısı. Tüm müşteriler, şubeler, kullanıcılar,
  ürünler, fiyatlar, stoklar, siparişler, üretim, sevkiyat, hizmetler ve destek talepleri.
- **Satış Personeli** — Müşterileri, müşteri taleplerini ve siparişleri yönetir. Kendisine tanımlanan
  satış ve müşteri bilgilerine erişir.
- **Üretim Personeli** — Üretime aktarılmış siparişleri görür, içerik ve ürün bilgilerini inceler,
  yalnızca üretim aşamasındaki durumları günceller.
- **Sevkiyat Personeli** — Üretimi tamamlanmış siparişleri görür, teslimat adreslerine ulaşır,
  sevkiyat sürecindeki durumları günceller.

Her rol yalnızca kendi görev alanıyla ilgili ekranlara ve yetkilere sahip olmalıdır.

## 6. Müşteri Ana Ekranı

Müşterinin giriş yaptığında karşılaşacağı ana ekran, aynı zamanda üretici firmanın müşterileriyle
iletişim kurduğu bir duyuru alanıdır. Üretici yöneticisi panelden içerik oluşturur:

- Firma haberleri, duyurular, yeni ürünler, kampanyalar, eğitimler
- Hizmet duyuruları, sevkiyat bilgilendirmeleri, çalışma saatleri, önemli bilgilendirmeler

Yönetici bir duyuruyu tüm müşterilere, belirli müşterilere veya müşteri gruplarına gösterebilir.

## 7. Ürün Yönetimi

Üretici firma bütün ürünlerini panelden kontrol eder. Ürünler kategorilere ayrılabilir (kahve,
paketleme, makine, ekipman, sarf malzemesi, araç-gereç, diğer). Her ürün için ad, kod, kategori,
açıklama, görsel, birim, fiyat, stok vb. tutulabilir.

## 8. Müşteriye Özel Ürün Gösterme

Ürünler müşteri bazında kontrol edilebilir. "Hangi ürün kime görünecek?" sorusunun cevabı üretici
firmadadır. Bir ürün sistemde olsa bile belirli müşterilere kapatılabilir. Böylece her müşteriye özel
bir ürün kataloğu oluşturulabilir.

## 9. Müşteriye Özel Fiyatlandırma

Her müşterinin fiyatı aynı olmak zorunda değildir. Aynı ürün Müşteri A için 500 TL, Müşteri B için
475 TL olabilir. Müşteri yalnızca kendisine tanımlanan fiyatı görür. Sistem ileride müşteri grubu,
miktar, kampanya veya farklı ticari kurallara göre genişletilebilecek şekilde tasarlanmalıdır.

## 10. Müşteriye Gösterilen Stok Durumu

Üretici gerçek stoğu takip ederken müşteriye stok durumunun nasıl gösterileceğini de belirler:
Stokta / Sınırlı stok / Ön sipariş / Tedarik bekleniyor / Geçici olarak satışa kapalı.

## 11. Sipariş Oluşturma

1. Ürün seçilir
2. Miktar belirlenir
3. Gerekirse şube / teslimat noktası seçilir
4. Sipariş kontrol edilir
5. Sipariş onaylanır
6. Üretici firmanın sistemine aktarılır
7. İlgili personele bildirim gönderilir

## 12. Sipariş Takip Sistemi

Müşterinin siparişlerinin durumunu görebileceği ayrı bir "Siparişlerim / Sipariş Takip" bölümü olur.
Örnek akış:

`Sipariş Verildi → Sipariş Onaylandı → Üretimde → Üretim Tamamlandı → Sevkiyata Hazır → Teslimatta → Teslim Edildi`

Her aşamada ilgili kullanıcıya bildirim gönderilir.

## 13. Departman Bazlı Sipariş Yönetimi

- Satış personeli siparişi kontrol edip onaylar.
- Üretim personeli siparişi üretime alır, tamamlandığında kendi aşamasını kapatır.
- Sevkiyat personeli üretimi tamamlanan siparişi teslimata çıkarır, süreci günceller.

Hiçbir personel kendi yetkisi dışındaki durumu değiştiremez (üretim personeli "Teslim Edildi"
yapamaz; sevkiyat personeli üretim aşamasını değiştiremez). Üretici yöneticisi gerektiğinde bütün
aşamaları yönetebilir.

## 14. Üretim Personeli

Sipariş üretim aşamasına geldiğinde bildirim alır. Ekranından üretilecek siparişler, detaylar,
ürünler, miktarlar, ürün bilgileri, fiyatlar ve stok durumları görülebilir. Yalnızca kendi aşamasını
değiştirebilir: `Üretime Alındı → Üretimde → Üretim Tamamlandı`. Gerektiğinde siparişi üretim
aşamasında iptal olarak işaretleyebilir.

## 15. Sevkiyat Personeli

Üretimi tamamlanan, sevkiyata hazır siparişler bildirilir. Sipariş ekranında: müşteri, şube,
teslimat adresi, telefon, sipariş içeriği, miktar, sipariş kodu, durum, tahmini teslimat süresi.
Güncellenebilecek durumlar: Sevkiyata hazır / Teslimatta / Tahmini teslim süresi / Sevkiyat
tamamlandı / Teslim edildi / Teslimat sorunu. Müşteri bu değişiklikleri kendi uygulamasından görür.

## 16. Siparişe Sonradan Ürün veya Hizmet Ekleme

Müşteri siparişini oluşturduktan sonra farklı aşamalarda yeni ürün/hizmet talep edebilir. Yetkili
personel mevcut siparişe kalem ekleyebilir (ekstra paket, paketleme ücreti, şurup, ekipman, ek
hizmet vb.). Her kalem için kayıt: ürün/hizmet adı, miktar, birim fiyat, toplam fiyat, ekleyen
kullanıcı, eklenme tarihi. Böylece siparişin nasıl değiştiği ve hangi personelin ne yaptığı
görülebilir.

## 17. Role Özel Bildirimler

Her kullanıcı yalnızca kendisini ilgilendiren bildirimleri alır.

- **Müşteri:** sipariş durumu, teslimat, sipariş değişikliği, destek talepleri
- **Satış:** yeni müşteri başvuruları, yeni siparişler, müşteri talepleri
- **Üretim:** üretime gelen yeni siparişler, üretimle ilgili değişiklikler
- **Sevkiyat:** sevkiyata hazır siparişler, teslimat bilgileri, değişiklikler
- **Yönetici:** önemli işlemler, başvurular, siparişler, sorunlar, operasyonel bildirimler

## 18. Sipariş Anahtar Kodu

Her sipariş için benzersiz bir sipariş anahtar kodu oluşturulur. Bu kod siparişin temel takip
numarasıdır; müşteri ve personel bu kodla siparişe ulaşır. Aynı kod destek sisteminde de kullanılır.

## 19. Destek Sistemi

Müşteri uygulama içinden destek talebi oluşturabilir: genel konu, belirli bir sipariş, teslimat,
ürün veya hizmet hakkında. Siparişle ilgili taleplerde sipariş anahtar kodu ile ilgili sipariş
otomatik bulunur. Talep ilgili departmana yönlendirilir; müşteri durumunu takip eder.

## 20. Hizmetler ve Randevu

Firmanın kahve dışı hizmetleri ayrı bir bölümde listelenir (barista eğitimi, teknik servis, makine
kurulumu, danışmanlık, eğitimler, diğer). Müşteri hizmet detayını inceleyip talep oluşturur.
Hizmete göre: tarih seçimi, randevu talebi, açıklama, iletişim, talep durumu.

## 21. Excel ile Ürün Aktarımı

Ürünler Excel dosyası ile toplu aktarılabilmelidir (ürün kodu, ad, kategori, birim, fiyat, stok,
açıklama, durum). Firma dosyayı yükleyerek ürünleri toplu oluşturur veya günceller. Sistemdeki
veriler Excel olarak dışa da aktarılabilir.

## 22. Harici Elektronik Tablo Entegrasyonu

İlerleyen aşamada ürün ve fiyat bilgilerinin internet üzerindeki elektronik tablolarla senkronize
edilmesi değerlendirilebilir. Firma tablodan yönetmeye devam ederken bilgiler uygulamaya otomatik
aktarılır.

## 23. Yönetim Paneli

Kapsamlı bir web yönetim paneli: müşteri başvuruları, müşteriler, firmalar, şubeler, kullanıcılar,
roller, ürünler, kategoriler, fiyatlar, müşteriye özel ürünler, müşteriye özel fiyatlar, stoklar,
siparişler, üretim, sevkiyat, hizmetler, randevular, destek talepleri, duyurular, bildirimler,
raporlar, Excel veri aktarımı, sistem ayarları.

## 24. En Önemli Özellik: Kontrol Edilebilirlik

Klasik e-ticaretten farkı: sistem tamamen üretici firmanın ticari yapısına göre kontrol edilebilir.
Her müşterinin gördüğü ürünler, fiyatlar, stok görünümü, şubeleri, kullanıcıları, yetkileri,
siparişleri, hizmetleri farklı olabilir; sipariş içeriği sonradan değişebilir. Sabit kurallı basit
bir sipariş sistemi değil, panelden mümkün olduğunca çok parametrenin kontrol edildiği esnek bir B2B
altyapı.

## 25. Örnek Bir Siparişin Baştan Sona İşleyişi

1. **Üyelik** — Kahve dükkanı telefon numarası ile üyelik talebi oluşturur.
2. **Onay** — Üretici yöneticisi başvuruyu onaylar.
3. **Firma ve Şube** — Müşterinin üç şubesi sisteme tanımlanır.
4. **Ürün ve Fiyat** — Müşteriye 10 kahve + 5 ekipman açılır, müşteriye özel fiyatlar belirlenir.
5. **Sipariş** — Müşteri bir şubesi için 2 kg kahve siparişi verir.
6. **Satış** — Sipariş satış personelinin ekranına düşer ve onaylanır.
7. **Üretim** — Sipariş üretim personeline bildirilir, üretime alınır.
8. **Ek Talep** — Müşteri ekstra paket talep eder; yetkili personel ürünü siparişe ekler, fiyat
   işlenir.
9. **Üretim Tamamlandı** — Üretim personeli aşamayı kapatır.
10. **Sevkiyat** — Sipariş sevkiyat personeline düşer; adres ve detaylar görülür.
11. **Teslimat** — Sevkiyat personeli siparişi teslimata çıkarır, tahmini teslim süresi girilir.
12. **Müşteri Bildirimi** — Müşteri siparişin teslimatta olduğunu ve süreyi görür.
13. **Ek Talep** — Teslimat sırasında müşteri şurup talep eder; sevkiyat personeli ürünü ekler.
14. **Teslimat** — Sipariş teslim edilir, "Teslim Edildi" olarak güncellenir.
15. **Destek** — Müşteri sonra sipariş anahtar koduyla destek talebi oluşturabilir.

## 26. Genel Hedef

Kahve üreticisi firmanın müşterileriyle arasındaki ticari ilişkinin tamamını dijital ortamda
yönetebileceği bir platform.

**Müşteri tarafı — basit:** Ürünleri gör → Sipariş ver → Siparişi takip et → Bildirimleri al →
Destek al.

**Üretici tarafı — kapsamlı ve kontrol edilebilir:** Müşteriyi yönet → Ürünleri belirle → Fiyatları
belirle → Stokları yönet → Siparişi yönet → Üretimi takip et → Sevkiyatı yönet → Müşteriyi bilgilendir
→ Süreci raporla.

**Ek zorunluluk:** Telefon doğrulama zorunlu. App Store ve Google Play'de yeni uygulama olarak değil,
mevcut uygulamanın yeni sürümü olarak yayınlanacak.
