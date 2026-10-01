import { ProjectData } from "@/types/project";
import { normalizeItems } from "@/lib/projectLayout";

/**
 * Şablon görselleri — Firebase Storage'daki mevcut proje görsellerinden.
 *
 * Şablonun her bloğu gerçek görsellerle dolu görünsün diye buradan beslenir.
 * `deneme` projesinin görselleri o projenin Storage klasöründe duruyor:
 * proje silinirse (admin silme işlemi klasörü de temizliyor) bu adresler
 * kırılır — o durumda burada başka görsellerle değiştirin.
 */
const STORAGE = "https://firebasestorage.googleapis.com/v0/b/burakkoc-a15d3.firebasestorage.app/o";

const TEMPLATE_MEDIA = {
  /** Oxtv logosu, açık gri zemin — 1366×920 */
  oxtvCover: `${STORAGE}/projects%2Foxtv%2Fcover%2F1790279715173.jpg?alt=media&token=777b5296-496d-4138-ba2d-029ef5503142`,
  /** Detay sayfası, TV + telefon — 1366×920 */
  oxtvInterface: `${STORAGE}/projects%2Foxtv%2Fblocks%2Fimg-interface-01%2F1790284313034.jpg?alt=media&token=1e2626d5-35e7-4003-ae6f-613df31ba25a`,
  /** Oynatıcı, "Sıradaki Bölüm" — 1366×768 */
  oxtvPlayer: `${STORAGE}/projects%2Foxtv%2Fblocks%2Fimg-features-01%2F1790284489047.jpg?alt=media&token=29f1e3dd-cad6-428c-be77-285353731e8b`,
  /** Arayüz kolajı, iPad + TV — 1366×1366 */
  oxtvCollage: `${STORAGE}/projects%2Foxtv%2Fblocks%2Fimg-intro-01%2F1790285322735.jpg?alt=media&token=a34a521f-31f3-4f87-af0f-bf109667b99c`,
  /** Telefon ekranları — 452×982. phone1 ve phone3 aynı dosya: DB'de iki farklı telefon görseli var. */
  phone1: `${STORAGE}/projects%2Fdeneme%2Fblocks%2Fgallery-features-gallery-feature-1%2F1790441548739.jpg?alt=media&token=7abcaafc-1a8f-428a-99f1-ec2d6c624ffb`,
  phone2: `${STORAGE}/projects%2Fdeneme%2Fblocks%2Fgallery-features-gallery-feature-2%2F1790441554316.jpg?alt=media&token=ce0f9f9c-8c35-4d05-9d5b-6c4b86ddb12b`,
  phone3: `${STORAGE}/projects%2Fdeneme%2Fblocks%2Fgallery-features-gallery-feature-3%2F1790441562357.jpg?alt=media&token=1eaf5412-4c2f-41bd-9bf0-92dd19855205`,
  /** CV profil fotoğrafı — 1045×1263 */
  profile: `${STORAGE}/projects%2Fcv-profile%2Fcover%2F1786633180710.jpg?alt=media&token=7a8c14e5-142e-4408-a22c-d153fd139edb`,
};

/**
 * Örnek künye — kategori, açıklama ve kapak görseli. Yeni bir projenin
 * Overview'u bunlarla dolu açılır (bkz. src/figma/overview.ts); şablon
 * proje de bunları kullanır.
 */
export const TEMPLATE_OVERVIEW = {
  category: "UX / UI Design",
  description:
    "Projeyi tek cümlede özetleyin: ne yapıldı, kimin için ve hangi sonucu doğurdu. Bu metin sayfanın en üstünde, kapak görselinin hemen üzerinde görünür.",
  coverImage: TEMPLATE_MEDIA.oxtvCover,
};

/**
 * Şablon proje — bir vaka çalışmasının iskeleti.
 *
 * Mevcut bütün blok tiplerini kullanır ve her blokta oraya ne yazılacağını
 * anlatan yönlendirme metni vardır. Admin editöründe boş bir projede
 * "Şablondan başla" ile yüklenir; kaydedilene kadar hiçbir yere yazılmaz.
 *
 * Görseller TEMPLATE_MEDIA'dan gelir; alt metinler oraya ne tür bir görsel
 * konacağını anlatmaya devam ediyor.
 */
export function createProjectTemplate(): Omit<ProjectData, "slug"> {
  const template = {
    title: "Şablon Proje",
    year: new Date().getFullYear().toString(),
    ...TEMPLATE_OVERVIEW,
    items: [
      // ── 01 · Genel Bakış ────────────────────────────────────────────────
      {
        kind: "section",
        id: "section-overview",
        blocks: [
          {
            id: "head-overview",
            type: "heading",
            content: "Genel Bakış",
            subheading: "Proje künyesi ve kısa özet",
          },
          {
            id: "text-overview",
            type: "text",
            content:
              "Projenin ne olduğunu ve neden var olduğunu iki üç cümleyle anlatın. Metinde **kalın vurgu** ve [bağlantı](https://burakkoc.net) kullanabilirsiniz.",
          },
          {
            id: "info-overview",
            type: "info",
            entries: [
              { id: "info-role", label: "Rol", value: "Ürün Tasarımcısı" },
              { id: "info-duration", label: "Süre", value: "8 hafta" },
              { id: "info-team", label: "Ekip", value: "2 tasarımcı, 3 geliştirici" },
              { id: "info-platform", label: "Platform", value: "iOS · Android · Web" },
            ],
          },
          {
            id: "tags-overview",
            type: "tags",
            entries: [
              { id: "tag-1", label: "Figma" },
              { id: "tag-2", label: "Prototipleme" },
              { id: "tag-3", label: "Tasarım Sistemi" },
              { id: "tag-4", label: "Kullanılabilirlik Testi" },
            ],
          },
          {
            id: "links-overview",
            type: "links",
            entries: [
              { id: "link-web", label: "Canlı Site", href: "https://burakkoc.net", icon: "web" },
              { id: "link-appstore", label: "App Store", href: "https://apps.apple.com", icon: "appstore" },
              { id: "link-play", label: "Google Play", href: "https://play.google.com", icon: "playstore" },
            ],
          },
        ],
      },
      { kind: "divider", id: "divider-01" },

      // ── 02 · Sorunlar ───────────────────────────────────────────────────
      {
        kind: "section",
        id: "section-problem",
        blocks: [
          {
            id: "head-problem",
            type: "heading",
            content: "Sorunlar",
            subheading: "Mevcut durum nerede tıkanıyordu?",
          },
          {
            id: "text-problem",
            type: "text",
            content:
              "Başlangıçtaki durumu ve kullanıcının yaşadığı sorunları kısaca anlatın. Mümkünse bir veriyle ya da araştırma bulgusuyla destekleyin.",
          },
          {
            id: "cards-problem",
            type: "cards",
            columns: 2,
            entries: [
              { id: "problem-1", eyebrow: "01", title: "Sorun başlığı", text: "Bu sorun kullanıcıyı nasıl etkiliyordu? Tek cümle yeterli." },
              { id: "problem-2", eyebrow: "02", title: "Sorun başlığı", text: "Sorunun kaynağı neydi, hangi adımda ortaya çıkıyordu?" },
              { id: "problem-3", eyebrow: "03", title: "Sorun başlığı", text: "İş tarafına etkisi: zaman, maliyet ya da dönüşüm kaybı." },
              { id: "problem-4", eyebrow: "04", title: "Sorun başlığı", text: "Rakiplerde ya da benzer ürünlerde durum nasıldı?" },
            ],
          },
          {
            id: "quote-problem",
            type: "quote",
            content: "Kullanıcı görüşmesinden, sorunu en iyi anlatan tek bir cümle.",
            author: "Katılımcı 4",
            authorRole: "Kullanıcı görüşmesi",
          },
          {
            id: "persona-problem",
            type: "persona",
            title: "Ayşe, 34",
            subheading: "Ürün yöneticisi · İstanbul",
            content: "Personanın kısa tanımı ya da onu en iyi anlatan bir cümle.",
            entries: [
              { id: "persona-goals", label: "Hedefler", text: "Birinci hedef\nİkinci hedef\nÜçüncü hedef" },
              { id: "persona-pains", label: "Zorluklar", text: "Birinci zorluk\nİkinci zorluk" },
            ],
          },
          {
            id: "table-competitors",
            type: "table",
            tableHeader: true,
            caption: "Rakip analizi — hücreye ✓ ya da ✗ yazın",
            tableRows: [
              { id: "row-head", cells: ["Özellik", "Bizim ürün", "Rakip A", "Rakip B"] },
              { id: "row-1", cells: ["Birinci özellik", "✓", "✓", "✗"] },
              { id: "row-2", cells: ["İkinci özellik", "✓", "✗", "✗"] },
              { id: "row-3", cells: ["Fiyat", "Ücretsiz", "₺99 / ay", "₺149 / ay"] },
            ],
          },
          {
            id: "callout-problem",
            type: "callout",
            variant: "insight",
            title: "Temel içgörü",
            content: "Araştırmadan çıkan ve çözümü şekillendiren en önemli bulgu.",
          },
          {
            id: "list-problem",
            type: "list",
            listStyle: "dash",
            listItems: [
              { id: "li-research-1", text: "Araştırma yöntemi — örn. 12 kullanıcı görüşmesi" },
              { id: "li-research-2", text: "Analiz — örn. rakip incelemesi ve analitik verisi" },
            ],
          },
        ],
      },
      { kind: "divider", id: "divider-02" },

      // ── 03 · Çözüm İçin Fikirler ────────────────────────────────────────
      {
        kind: "section",
        id: "section-approach",
        blocks: [
          {
            id: "head-approach",
            type: "heading",
            content: "Çözüm İçin Fikirler",
            subheading: "Yaklaşım ve süreç",
          },
          {
            id: "text-approach",
            type: "text",
            content: "Soruna nasıl yaklaştığınızı ve hangi ilkeleri belirlediğinizi anlatın.",
          },
          {
            id: "list-principles",
            type: "list",
            listStyle: "numbered",
            listItems: [
              { id: "li-principle-1", text: "Birinci ilke — örn. içerik her zaman önde" },
              { id: "li-principle-2", text: "İkinci ilke — örn. her adım tek bir karara odaklanır" },
              { id: "li-principle-3", text: "Üçüncü ilke — örn. her platformda aynı deneyim" },
            ],
          },
          {
            id: "steps-process",
            type: "steps",
            entries: [
              { id: "step-1", title: "Keşif", eyebrow: "Hafta 1", text: "Araştırma, görüşmeler ve mevcut durumun analizi." },
              { id: "step-2", title: "Tanımlama", eyebrow: "Hafta 2", text: "Sorunların önceliklendirilmesi ve hedeflerin belirlenmesi." },
              { id: "step-3", title: "Tasarım", eyebrow: "Hafta 3–5", text: "Akışlar, wireframe'ler ve yüksek çözünürlüklü tasarımlar." },
              { id: "step-4", title: "Test ve teslim", eyebrow: "Hafta 6–8", text: "Kullanılabilirlik testleri, iyileştirmeler ve geliştirici teslimi." },
            ],
          },
          {
            id: "figma-approach",
            type: "figma",
            src: "",
            caption: "Figma prototipi — prototip ya da dosya bağlantısını ekleyin",
          },
        ],
      },
      { kind: "divider", id: "divider-03" },

      // ── 04 · Öne Çıkan Özellikler ───────────────────────────────────────
      {
        kind: "section",
        id: "section-features",
        blocks: [
          {
            id: "head-features",
            type: "heading",
            content: "Öne Çıkan Özellikler",
            subheading: "Ürünü farklı kılan noktalar",
          },
          {
            id: "cards-features",
            type: "cards",
            columns: 3,
            entries: [
              { id: "feature-1", title: "Özellik adı", text: "Kullanıcıya ne kazandırıyor?" },
              { id: "feature-2", title: "Özellik adı", text: "Rakiplerden hangi yönüyle ayrışıyor?" },
              { id: "feature-3", title: "Özellik adı", text: "Hangi sorunu çözüyor?" },
            ],
          },
          {
            id: "mockup-features",
            type: "mockup",
            variant: "phone",
            caption: "Cihaz çerçevesi — telefon ekranlarını çerçeve içinde gösterir",
            entries: [
              { id: "mockup-feature-1", src: TEMPLATE_MEDIA.phone1, alt: "Birinci özelliğin telefon ekranı" },
              { id: "mockup-feature-2", src: TEMPLATE_MEDIA.phone2, alt: "İkinci özelliğin telefon ekranı" },
              { id: "mockup-feature-3", src: TEMPLATE_MEDIA.phone3, alt: "Üçüncü özelliğin telefon ekranı" },
            ],
          },
          {
            id: "gallery-features",
            type: "gallery",
            columns: 3,
            aspectRatio: "9/16",
            caption: "Galeri — çerçevesiz dikey ekranlar için 9:16 oranı",
            entries: [
              { id: "gallery-feature-1", src: TEMPLATE_MEDIA.phone1, alt: "Akışın birinci ekranı", caption: "Birinci adım" },
              { id: "gallery-feature-2", src: TEMPLATE_MEDIA.phone2, alt: "Akışın ikinci ekranı", caption: "İkinci adım" },
              { id: "gallery-feature-3", src: TEMPLATE_MEDIA.phone3, alt: "Akışın üçüncü ekranı", caption: "Üçüncü adım" },
            ],
          },
          {
            id: "video-features",
            type: "video",
            src: "",
            videoLoop: true,
            caption: "Döngü video — .mp4 arayüz animasyonları GIF gibi sessiz ve sürekli oynar",
          },
        ],
      },
      { kind: "divider", id: "divider-04" },

      // ── 05 · Arayüz Detayları ───────────────────────────────────────────
      {
        kind: "section",
        id: "section-interface",
        blocks: [
          {
            id: "head-interface",
            type: "heading",
            content: "Arayüz Detayları",
            subheading: "Tasarım kararları ve ekranlar",
          },
          {
            id: "text-interface",
            type: "text",
            content: "Arayüzde verdiğiniz önemli kararları ve bunların nedenlerini anlatın.",
          },
          {
            id: "image-interface",
            type: "image",
            src: TEMPLATE_MEDIA.oxtvInterface,
            alt: "Ana ekranın yüksek çözünürlüklü görüntüsü",
            caption: "Ana ekran — tek geniş görsel için 16:9",
            aspectRatio: "16/9",
            badges: [
              { id: "badge-interface", icon: "external", position: "top-right", href: "https://burakkoc.net" },
            ],
          },
          {
            id: "compare-interface",
            type: "compare",
            aspectRatio: "16/9",
            caption: "Önce / sonra — tutamacı sürükleyerek karşılaştırın",
            entries: [
              { id: "compare-before", label: "Önce", src: TEMPLATE_MEDIA.oxtvPlayer, alt: "Eski tasarımın ekran görüntüsü" },
              { id: "compare-after", label: "Sonra", src: TEMPLATE_MEDIA.oxtvInterface, alt: "Yeni tasarımın aynı ekranı" },
            ],
          },
          {
            id: "split-interface",
            type: "split",
            variant: "left",
            aspectRatio: "1/1",
            src: TEMPLATE_MEDIA.oxtvCollage,
            alt: "Tek bir arayüz detayının yakın plan görüntüsü",
            title: "Bir tasarım kararı",
            content: "Görselin gösterdiği detayı ve bu kararın nedenini iki cümleyle anlatın.",
          },
          {
            id: "mockup-browser",
            type: "mockup",
            variant: "browser",
            entries: [
              { id: "mockup-browser-1", src: TEMPLATE_MEDIA.oxtvCollage, alt: "Web sitesinin ana sayfası", label: "urun.com" },
            ],
          },
          {
            id: "subhead-interface",
            type: "subheading",
            content: "Tasarım sistemi",
          },
          {
            id: "palette-interface",
            type: "palette",
            columns: 4,
            entries: [
              { id: "color-1", label: "Primary", value: "#1A1A1A", text: "Başlıklar, ana butonlar" },
              { id: "color-2", label: "Secondary", value: "#757575", text: "Yardımcı metinler" },
              { id: "color-3", label: "Surface", value: "#F2F2F2", text: "Kartlar, alanlar" },
              { id: "color-4", label: "Accent", value: "#2F6BFF", text: "Bağlantılar, vurgu" },
            ],
          },
          {
            id: "gallery-interface",
            type: "gallery",
            columns: 2,
            aspectRatio: "4/3",
            entries: [
              { id: "gallery-ds-1", src: TEMPLATE_MEDIA.oxtvCover, alt: "Logo ve renk kullanımı", caption: "Logo ve renk" },
              { id: "gallery-ds-2", src: TEMPLATE_MEDIA.oxtvPlayer, alt: "Oynatıcı bileşenleri", caption: "Bileşenler" },
            ],
          },
          {
            id: "code-interface",
            type: "code",
            language: "tsx",
            previewComponent: "ButtonDemo",
            content:
              '<Button size="md" startIcon={<ArrowIcon />}>\n  Devam et\n</Button>',
            caption: "Kod bloğu — Preview / Code sekmesiyle bileşen önizlemesi",
          },
          {
            id: "iframe-interface",
            type: "iframe",
            src: "https://burakkoc.net",
            iframeViews: ["desktop", "mobile"],
            caption: "Canlı önizleme — iFrame ile masaüstü ve mobil görünüm",
          },
        ],
      },
      { kind: "divider", id: "divider-05" },

      // ── 06 · Sonuç ──────────────────────────────────────────────────────
      {
        kind: "section",
        id: "section-outcome",
        blocks: [
          {
            id: "head-outcome",
            type: "heading",
            content: "Sonuç",
            subheading: "Etki ve öğrenimler",
          },
          {
            id: "stats-outcome",
            type: "stats",
            columns: 3,
            entries: [
              { id: "stat-1", value: "%38", label: "Dönüşüm artışı" },
              { id: "stat-2", value: "2,4×", label: "Daha hızlı arama" },
              { id: "stat-3", value: "4,8", label: "Mağaza puanı" },
            ],
          },
          {
            id: "text-outcome",
            type: "text",
            content: "Projenin sonucunu ve ürüne etkisini kısaca özetleyin.",
          },
          {
            id: "list-outcome",
            type: "list",
            listStyle: "check",
            listItems: [
              { id: "li-outcome-1", text: "Ulaşılan birinci hedef", checked: true },
              { id: "li-outcome-2", text: "Ulaşılan ikinci hedef", checked: true },
              { id: "li-outcome-3", text: "Sonraki sürüme bırakılan hedef", checked: false },
            ],
          },
          {
            id: "bars-outcome",
            type: "bars",
            title: "Kullanılabilirlik testi — görevi tamamlayanlar",
            caption: "Anket grafiği — değerleri yüzde olarak girin",
            entries: [
              { id: "bar-1", label: "Birinci görev", value: "92" },
              { id: "bar-2", label: "İkinci görev", value: "78" },
              { id: "bar-3", label: "Üçüncü görev", value: "64", text: "En çok zorlanılan adım" },
            ],
          },
          {
            id: "list-learnings",
            type: "list",
            listStyle: "bullet",
            listItems: [
              { id: "li-learning-1", text: "Bu projeden çıkarılan birinci ders" },
              { id: "li-learning-2", text: "Bir dahaki sefere farklı yapılacak şey" },
            ],
          },
          {
            id: "accordion-outcome",
            type: "accordion",
            entries: [
              { id: "acc-1", title: "Araştırma detayları", text: "Sayfayı uzatmadan vermek istediğiniz ek bilgiler burada, tıklayınca açılır." },
              { id: "acc-2", title: "Teknik notlar", text: "Geliştirme sürecine dair ayrıntılar." },
            ],
          },
          {
            id: "team-outcome",
            type: "team",
            entries: [
              { id: "team-1", src: TEMPLATE_MEDIA.profile, title: "Burak Koç", text: "Ürün Tasarımcısı", href: "https://burakkoc.net" },
              { id: "team-2", title: "Ekip arkadaşı", text: "Frontend Geliştirici" },
            ],
          },
        ],
      },
    ],
  };
  // Written as sections of components; each section gets one full-width Blok (group).
  return { ...template, items: normalizeItems(template.items) };
}
