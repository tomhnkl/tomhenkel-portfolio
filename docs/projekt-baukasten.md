# Projekt-Baukasten

Eine Projektseite besteht immer aus demselben Rahmen:

1. **Hero:** volle Breite, 16:9
2. **Titelblock:** Titel, Kategorie, Jahr und Untertitel
3. **Module** in beliebiger Reihenfolge: Medien-Zeilen, Text, Akkordeons
4. **Weitere Projekte:** das vorherige und das nächste Projekt

Alles steht in `data/projects.json`. Übersetzbare Felder sind immer `{ "de": "…", "en": "…" }`. Fehlt eine Sprache, erscheint vorerst die andere. So sind Entwürfe schon sichtbar, bevor die Übersetzung da ist.

---

## Ordner und Dateinamen

Jedes Projekt hat einen Ordner `images/projects/<id>/` mit zwei Unterordnern:

| Ordner | Inhalt | Online |
|---|---|---|
| `_ROH` | alles, was ins Projekt soll, in beliebigen Formaten und gern mit Unterordnern. Wird nur gelesen, nie verändert. | nein (`.gitignore`, `.vercelignore`) |
| `_ABB` | die fertigen Exporte mit den Namen aus der Exportliste, Bilder **und** Videos, ohne Unterordner. Die Website lädt sie direkt von hier. | ja |

Ein Standbild zu einem Video hat denselben Namen als `.webp`, z. B. `05.mp4` und `05.webp`.

`<id>` ist die `id` des Projekts, z. B. `reality-by-algorithm`.

---

## Grundgerüst eines Projekts

```json
{
  "id": "mein-projekt",
  "featured": true,
  "year": "2026",
  "hero": {
    "image": { "src": "images/projects/mein-projekt/_ABB/hero.webp", "width": 2560, "height": 1440 },
    "teaser": "images/projects/mein-projekt/_ABB/teaser.mp4",
    "film": { "bunny": "VIDEO-ID" }
  },
  "preview": { "portrait": "images/projects/mein-projekt/_ABB/preview-portrait.mp4" },
  "blocks": [ … ],
  "de": { "title": "mein projekt", "category": "Installation", "subtitle": "Ein Satz zum Projekt." },
  "en": { "title": "my project", "category": "installation", "subtitle": "One sentence about the project." }
}
```

- **`featured`:** Das Projekt erscheint in der Liste auf der Startseite.
- **`title`:** darf `<br>` enthalten, z. B. `"reality,<br>by algorithm."`.
- **`year`:** das exakte Jahr, z. B. `"2025"`. Für laufende Projekte auch pro Sprache, z. B. `{ "de": "seit 2023", "en": "since 2023" }`.
- **`preview.portrait`:** optional, die Hochformat-Vorschau für die Startseite auf dem Handy. Auf dem Desktop läuft dort der Teaser.
- **Adresse und Link-Vorschau:** Jedes Projekt hat eine eigene Seite unter `/work/<id>`, z. B. `tomhenkel.xyz/work/reality-by-algorithm`. Die Datei `work/<id>/index.html` entsteht aus `project.html`: `npm run pages` (oder `npm run build`) in `_tooling`. Danach stehen der Titel, der deutsche Untertitel als Beschreibung und `_ABB/og.jpg` als Vorschaubild im HTML. Dasselbe gilt für `sitemap.xml`. Nach jeder Änderung an `id`, `de.title` oder `de.subtitle` und für jedes neue Projekt neu erzeugen. Ist eine Seite veraltet, schlägt `npm test` fehl.
- **Lokal ansehen:** Die Seiten liegen als Ordner mit `index.html` (`work/<id>/`, `about/`), deshalb laufen `/work/<id>` und `/about` in VS Code Live Server und im Server aus `_tooling` (`npm run dev`). Nur `npm run dev` zeigt die Weiterleitungen und die 404-Seite wie bei Vercel.

---

## Hero

`hero.image` ist immer Pflicht. Es ist das Standbild und das Notfallbild, und Startseite und Karten verwenden es.

| Variante | Felder | Verhalten |
|---|---|---|
| Teaser + Film | `image`, `teaser`, `film` | Teaser läuft sofort stumm; „abspielen“ lädt den Film mit Ton |
| Nur Teaser | `image`, `teaser` | Stummer Loop, keine Buttons |
| Standbild + Film | `image`, `film` | Bild; „abspielen“ lädt den Film |
| Nur Bild | `image` | Bild |

**Film (Bunny Stream, D4):** `"film": { "bunny": "VIDEO-ID" }`, die Video-ID aus der Bunny-Bibliothek. Der CDN-Host steht einmal für alle Filme in `data/site-content.json` unter `settings.bunny_cdn` (z. B. `"vz-xxxx.b-cdn.net"`); ist er leer, wird der Film übersprungen (Hinweis in der Konsole). Abgespielt wird `https://<bunny_cdn>/<VIDEO-ID>/playlist.m3u8` im eigenen Video-Element: Safari/iOS und Browser mit eigenem HLS nativ, sonst über hls.js (`js/vendor/hls.light.min.js`, 1.7.3, Apache-2.0), das erst der Klick lädt; die Qualität ist auf die Playergröße begrenzt.

Übergangsweise funktionieren noch `"film": { "vimeo": "76979871" }` und `"film": { "youtube": "dQw4w9WgXcQ" }` (nur die ID; YouTube über `youtube-nocookie.com`).

Vor dem Klick auf „abspielen“ geht keine einzige Anfrage an den Anbieter (auch hls.js lädt erst dann); ein Hinweis am Button entfällt, das deckt die Datenschutzerklärung ab.

**Steuerung (D11):** „abspielen“ mittig über dem Hero (Differenz-Mischung wie Nav und Footer), der ganze Hero ist Klickfläche. Läuft der Film: „pause“ und darunter „ton aus“ / „ton an“ fest unten rechts in der Ecke des Films, immer sichtbar. Ein Tipp oder Klick auf den Film pausiert ihn bzw. spielt weiter. Die Knöpfe behalten ihre IDs (`#btn-play`, `#btn-sound`), Icons statt Wörter sind vorbereitet, das Design folgt.

---

## Module (`blocks`)

### Medien-Zeile

```json
{ "type": "media", "cols": [4, 8], "ratio": "16:9", "items": [ BILD_ODER_VIDEO, BILD_ODER_VIDEO ] }
```

- **`cols`:** Spalten pro Feld, zusammen höchstens 12.
- **`items`:** genauso viele Einträge wie `cols`. `null` steht für ein leeres Feld.
- **`start`** (optional): die Spalte, in der das erste Feld beginnt, für einen Versatz.
- **`ratio`** (optional): das Format des **größten** Feldes, z. B. `"16:9"`, `"3:2"`, `"4:5"`, `"1:1"`.
  - Die anderen Felder bekommen dieselbe Höhe, ein Bild mit anderem Format wird mittig beschnitten.
  - Ohne `ratio` gilt das Format des Mediums im größten Feld.
- **Folgezeilen:** Zwei Medien-Zeilen direkt hintereinander haben nur 20px Abstand, wie ein durchgehendes Raster.
- **Handy:** Jedes Medium steht in voller Breite untereinander, in dem Format, in dem es exportiert ist. Leere Felder entfallen.

**Bild:**
```json
{ "type": "image", "src": "images/projects/<id>/_ABB/01.webp", "width": 2560, "height": 1440,
  "alt": { "de": "Blick in die Ausstellung", "en": "View of the exhibition" }, "focus": "30% 50%" }
```

**Video** (stummer Loop, spielt nur, wenn es sichtbar ist):
```json
{ "type": "video", "src": "images/projects/<id>/_ABB/05.mp4", "poster": "images/projects/<id>/_ABB/05.webp", "width": 1920, "height": 1080 }
```

- **`focus`** (optional): der Punkt, der beim Beschneiden sichtbar bleibt (x y). Standard ist die Mitte.
- **`width` und `height`:** die Maße der exportierten Datei. Die trage ich ein.
- **`placeholder` und `color`:** die unscharfe 32px-Vorschau und die Grundfarbe. Die trage ich auch ein.

**Beispiele:**

| Zeile | `cols` | `start` | Bild |
|---|---|---|---|
| Ein Medium über die volle Breite | `[12]` | | `████████████` |
| Paar | `[6, 6]` | | `██████ ██████` |
| Klein + groß | `[4, 8]` | | `████ ████████` |
| Drei gleiche | `[4, 4, 4]` | | `████ ████ ████` |
| Halb rechts | `[6]` | `7` | `       ██████` |
| Mit Lücke | `[4, 2, 6]` + `items: [A, null, B]` | | `████    ██████` |

### Text (rechte Hälfte)

```json
{ "type": "text", "text": { "de": "Absatz 1.\n\nAbsatz 2.", "en": "…" } }
{ "type": "text", "title": { "de": "Technische Umsetzung", "en": "Technical realization" }, "text": { "de": "…", "en": "…" } }
```

Leerzeilen (`\n\n`) trennen Absätze, `<br>` erzwingt einen Zeilenumbruch.

### Akkordeons (rechte Hälfte)

```json
{ "type": "accordions", "items": [
  { "title": { "de": "Konzept", "en": "Concept" }, "content": { "de": "…", "en": "…" } },
  { "title": { "de": "Credits", "en": "Credits" }, "content": { "de": "Code: Tom Henkel<br>Sound: …", "en": "…" } }
] }
```

Ein Akkordeon direkt nach einem Text rückt näher an ihn heran (`--space-m` statt `--space-l`).

**Zeitverlauf:** Statt Text kann `content` eine Liste von Einträgen sein. Jeder Eintrag erscheint als kleiner Block, Datum über Ereignis, `--space-s` dazwischen.

```json
{ "title": { "de": "Zeitlicher Verlauf", "en": "Timeline" },
  "content": [
    { "date": { "de": "Oktober 2023", "en": "October 2023" }, "text": { "de": "Idee und Konzeption", "en": "idea and concept" } },
    { "date": { "de": "Juni 2026", "en": "June 2026" }, "text": { "de": "ADC Talent Award", "en": "ADC Talent Award" } }
  ] }
```

**Mit Bild:** Jedes Akkordeon kann `media` enthalten, Bilder oder Videos wie in den Medien-Zeilen. Sie stehen oben in voller Akkordeon-Breite und im eigenen Format, der Text darunter. Die Bilder laden erst beim Aufklappen. Export: 1440 px breit (Akkordeon = 6 Spalten).

```json
{ "title": { "de": "Notation", "en": "Notation" },
  "media": [{ "type": "image", "src": "images/projects/<id>/_ABB/notation.webp", "width": 1440, "height": 960, "alt": { "de": "…", "en": "…" } }],
  "content": { "de": "…", "en": "…" } }
```

### Links (rechte Hälfte)

```json
{ "type": "links", "items": [
  { "label": { "de": "Zur Website", "en": "Visit the website" }, "href": "https://lonis-weltraumreise.de/story" }
] }
```

Eine Zeile pro Link, in Book und Fließtextgröße wie die Kontakt-Links auf About. Weitere Links kommen als zusätzliche Einträge in `items`. Direkt nach einem Text oder vor Akkordeons rückt das Modul näher heran (`--space-m`).

**Link-Standard für die ganze Seite** (`.text-link`, `css/components/_links.scss`):
- **In Ruhe:** wie der umgebende Text, ohne Unterstreichung.
- **Links, die die Seite verlassen:** andere Websites (öffnen in einem neuen Tab), Mail-Links (`mailto:`, z. B. „kontakt“ im Footer und die Adresse auf About) und Telefon-Links (`tel:`) tragen automatisch ↗, bei `.text-link` wie im Footer. Interne Links bekommen nie einen Pfeil. Der Pfeil wird nicht vorgelesen und ist nie unterstrichen, auch nicht bei Hover oder Fokus.
- **Hover bei internen Links:** Unterstreichung, wie in Nav und Footer (Mixin `underline` in `css/base/_typography.scss`, Lage und Stärke aus den Tokens `--underline-offset` und `--underline-thickness`). Wie beim früheren Lining-Schnitt hat die Linie Lücken an Wortabständen. Die Schrift wechselt nicht, also springt nichts und keine Zeile bricht neu um.
- **Hover bei externen Links** (andere Websites, Mail, Telefon): keine Unterstreichung. Der Pfeil ↗ gleitet 3 px schräg nach oben rechts und beim Verlassen zurück (`--duration-fast`, `--ease-out`), auch beim Tastaturfokus.
- **Tastaturfokus:** weiße 2px-Kontur mit 4px Abstand auf allem, was fokussierbar ist (`css/components/_focus.scss`). Sie erscheint nur bei Bedienung mit der Tastatur.

### Persönlicher Text am Ende

Jedes Projekt kann am Ende, vor „Weitere Projekte“, einen persönlichen Text bekommen. Er steht nicht in `blocks`, sondern als eigenes Feld, damit er immer am Schluss steht:

```json
"personal": { "text": { "de": "…", "en": "…" } }
```

`title` ist optional. Ohne Text erscheint nichts.

---

## Abstände (automatisch)

| Token | 320px | 1440px | 2560px | Wo |
|---|---|---|---|---|
| `--space-s` | 20 | 20 | 20 | Titel → Untertitel, Medien-Zeile → Medien-Zeile, Bild → Kartentitel |
| `--space-m` | 40 | 60 | 80 | Hero → Titelblock, Text → Akkordeons, „Weitere Projekte“ → Karten |
| `--space-l` | 80 | 120 | 160 | Titelblock → Modul, Modul → Modul, Seitenende |

---

## Export

**Bilder:** WebP, sRGB, ohne Transparenz, ohne Metadaten, Qualität ca. 75–80. Die Breite richtet sich nach der Feldgröße:

| Spalten des Feldes | 12–10 | 9–7 | 6–5 | 4 | 3–2 |
|---|---|---|---|---|---|
| Breite (px) | 2560 | 1920 | 1440 | 1080 | 800 |

- **Höhe:** Breite ÷ Format. Das größte Feld hat das Format der Zeile, die kleineren Felder werden gleich hoch und damit schmaler im Format.
- **Beispiele** für kleinere Felder, bezogen auf 1440px:
  - `[4, 8]` mit 16:9: das 4er-Feld etwa 1080×1242
  - `[3, 9]` mit 16:9: das 3er-Feld etwa 800×1404
  - Bei anderen Zeilen sag mir die Zeile, ich rechne die Maße aus.
- **Handygröße:** Bilder ab 1920 px Breite gibt es zusätzlich in 1280 px Breite. Das Format bleibt gleich, an den Dateinamen kommt `-1280`, z. B. `01-1280.webp`. Schmalere Bilder brauchen keine zweite Fassung.

**Videos:**
- **Codierung:** MP4, H.264 (High), 8 Bit yuv420p, **ohne Tonspur**, Fast Start / „für Web optimiert“, ca. 3 Mbit/s bei 1080p.
- **Handygröße:** Videos über 1280 px Breite gibt es zusätzlich in 1280 px Breite, z. B. 1280×720. An den Dateinamen kommt `-720`, z. B. `05-720.mp4`, ca. 1,5 Mbit/s.
- **Loop im Inhalt:** Breite wie bei Bildern, höchstens 1920. Dazu kommt ein Standbild als WebP in denselben Maßen, nämlich das erste Bild. Ab 1920 px Breite gibt es das Standbild auch als `-1280`.

**Pro Projekt immer**, unabhängig vom Raster:

| Datei | Maß | Wofür |
|---|---|---|
| `images/projects/<id>/_ABB/hero.webp` + `hero-1280.webp` | 2560×1440 / 1280×720 | Standbild für Hero und Startseite; das erste Bild des Teasers |
| `images/projects/<id>/_ABB/teaser.mp4` + `teaser-720.mp4` | 1920×1080 / 1280×720, ca. 15 s | Loop im Hero und auf der Startseite |
| `images/projects/<id>/_ABB/preview-portrait.mp4` | 720×1280, ca. 1,5 Mbit/s | Startseite auf dem Handy |
| `images/projects/<id>/_ABB/preview-portrait.webp` | 720×1280 | Standbild dazu (erstes Bild), wenn Videos nicht laufen dürfen |
| `images/projects/<id>/_ABB/og.jpg` | 1200×630, JPG, möglichst unter 300 KB | Vorschau, wenn jemand den Projektlink teilt |

**Für die ganze Seite:**

| Datei | Maß | Wofür |
|---|---|---|
| `images/og.jpg` | 1200×630, JPG, möglichst unter 300 KB | Link-Vorschau für Startseite und About |
| `favicon.svg` | Vektor | Symbol im Browser-Tab |
| `favicon.ico` | 32×32 | ältere Browser |
| `apple-touch-icon.png` | 180×180, ohne Transparenz | Symbol auf dem iPhone-Homescreen |

**Alt-Texte:** Jedes Bild bekommt einen deutschen und einen englischen Alt-Text. Videos sind dekorativ und brauchen keinen.

---

## Was passiert, wenn …

| Fall | Verhalten |
|---|---|
| Datei fehlt | Farbfläche im richtigen Format, kein kaputtes Symbol |
| Video darf nicht laufen (Bewegung reduzieren, Datensparen, Stromsparmodus) | Standbild statt Loop |
| Langsames Netz | Unscharfe Vorschau, bis das Medium da ist |
| Browser verbietet den Ton beim Start | Film startet stumm, „ton an“ schaltet den Ton ein |
| Bunny-Film startet gar nicht (auch stumm blockiert) | Die Bedienelemente des Browsers erscheinen: ein Tipp auf das Video startet ihn |
| Bunny-Film lädt nicht (Netz, falsche ID) | Zurück zum Teaser, „abspielen“ versucht es erneut |
| Vimeo/YouTube lädt nicht, meldet Fehler oder startet nicht | Die Steuerung des Anbieters wird freigegeben: ein Tipp direkt auf das Video startet ihn |
| Zeile falsch befüllt (Spalten über 12, `items` passt nicht zu `cols`, Maße fehlen) | Block wird übersprungen, die Browser-Konsole sagt, welcher und warum |
| Alte Adresse `project.html?id=<id>` | Leitet dauerhaft auf `/work/<id>` um, ohne `id` auf die Startseite |
| Adresse `/work/<id>` gibt es nicht | Die 404-Seite |
| `work/<id>/index.html` ist da, das Projekt fehlt aber in `projects.json` | Poster „Projekt nicht gefunden“, nach 3 s zur Startseite. `npm run pages` räumt die alte Seite weg |

---

## Lab (`data/lab.json`)

Das Lab ist eine freie Leinwand. Jeder Eintrag hat eine Position und eine Breite. Bilder und Videos folgen denselben Regeln wie die Projektmedien: Lade-Effekt, Videos als stummer Loop nur im Sichtfeld, Standbild, wenn ein Video nicht laufen darf.

```json
{ "id": "exp-001", "type": "image", "src": "images/lab/exp-001.webp", "width": 800, "height": 600,
  "position": { "x": 100, "y": 200 }, "size": { "w": 400 },
  "de": { "title": "Fluid Simulation" }, "en": { "title": "Fluid Simulation" } }

{ "id": "exp-002", "type": "video", "src": "videos/lab/exp-002.mp4", "poster": "images/lab/exp-002.webp",
  "width": 1200, "height": 800, "position": { "x": 600, "y": -100 }, "size": { "w": 600, "h": 400 },
  "de": { "title": "3D Scan Test" }, "en": { "title": "3D Scan Test" } }

{ "id": "exp-003", "type": "text-block", "position": { "x": 400, "y": 600 }, "size": { "w": 300 },
  "de": { "title": "Gedanken", "content": "…" }, "en": { "title": "Thoughts", "content": "…" } }
```

- **`position`:** Pixel auf der Leinwand. Beim Öffnen liegt (500, 300) ungefähr in der Bildschirmmitte.
- **`size.w`:** Anzeigebreite in px.
- **`size.h`** (optional): feste Höhe. Das Medium wird dann beschnitten, optional mit `focus`. Ohne `size.h` richtet sich die Höhe nach dem Format der Datei (`width`/`height`).
- **`title`:** Er erscheint beim Hover als Bildunterschrift und ist zugleich der Alt-Text.
- **Export:** Breite = 2 × `size.w`, z. B. 800 px bei `"w": 400`. Die Höhe folgt aus dem Format bzw. `size.h` × 2. Videos brauchen dazu ein Standbild (`images/lab/<id>.webp`) in denselben Maßen.
- **Vorläufige Maße:** Die Werte in `lab.json` sind Platzhalter (4:3). Die echten Maße trage ich nach deinem Export ein.

---

## Texte der Seite (`data/site-content.json`)

Alle festen Wörter außerhalb der Projekte stehen in `data/site-content.json`, je Sprache unter `ui.de` und `ui.en`:

| Feld | Was |
|---|---|
| `nav` | Navigation: projekte, das lab, über mich |
| `footer` | Footer: kontakt, impressum, datenschutz |
| `titles` | Seitentitel: Über mich, Das Lab, Projekt nicht gefunden |
| `page_title` | Name hinter jedem Tab-Titel („Impressum — Tom Henkel“) |
| `player` | Film-Knöpfe: abspielen, pause, ton an, ton aus |
| `menu` | Handy-Menü: menü, schließen |
| `states` | Poster für Ladefehler, „Projekt nicht gefunden“ und die 404-Seite |
| `more` | Überschrift „Weitere Projekte“ |
| `skip` | „Zum Inhalt“, der erste Tab-Stopp für die Tastatur |
| `preview` | „weiter“ auf der Startseite (Handy ohne automatischen Wechsel) |
| `buttons` | zurzeit nicht genutzt |

Unter `settings` stehen die Angaben für die ganze Seite:

| Feld | Was |
|---|---|
| `contact_email` | Adresse für „kontakt“ im Footer und auf About |
| `instagram_url` | Instagram-Link auf About |
| `bunny_cdn` | CDN-Host der Filme (siehe Hero) |

Text und Porträt der About-Seite stehen unter `about`.

**Text ändern:**
1. Den Text unter `ui.de` **und** `ui.en` ändern.
2. Speichern, Seite neu laden. Mehr braucht es nicht.

Ausnahmen: `page_title` und `contact_email` stehen zusätzlich fest im HTML (Tab-Titel und Hinweis für Browser ohne JavaScript). Ändern sie sich, sag mir Bescheid, ich ziehe das HTML nach.

Neue sichtbare Wörter, die ich für die Oberfläche vorschlage, sind Entwürfe, bis du sie freigibst.

---

## Rechtstexte (`data/legal.json`)

Impressum (`/impressum`) und Datenschutz (`/datenschutz`) sehen aus wie ein Projekttext: großer Titel links wie der Projekttitel, darunter die Abschnitte in der rechten Hälfte, jeder mit Überschrift (wie ein Akkordeon-Titel) und Fließtext.

```json
{
  "impressum": {
    "title": { "de": "Impressum", "en": "Imprint" },
    "sections": [
      { "heading": { "de": "Überschrift", "en": "Heading" },
        "text": { "de": "Zeile 1\nZeile 2\n\nNeuer Absatz mit <a href=\"mailto:…\">Mail</a>", "en": "…" } }
    ]
  },
  "datenschutz": { "title": { "de": "Datenschutz", "en": "Privacy" }, "sections": [ … ] }
}
```

- **`sections`:** beliebig viele, in dieser Reihenfolge. `heading` ist optional.
- **Zeilenumbrüche:** `\n` beginnt eine neue Zeile, eine Leerzeile (`\n\n`) einen neuen Absatz.
- **Links:** einfach `<a href="…">…</a>` in den Text. Sie folgen dem Link-Standard: andere Websites öffnen im neuen Tab und tragen ↗, Mail-Links (`mailto:`) auch, interne Links wie `/about` nicht.
- **Nach jeder Änderung:** `npm run pages` (oder `npm run build`) in `_tooling`. Dann steht der deutsche Text auch fest im HTML (`impressum/index.html`, `datenschutz/index.html`) und ist ohne JavaScript lesbar. Englisch kommt beim Laden aus `legal.json`. Ist das HTML veraltet, schlägt `npm test` fehl.
- **Vorlage:** Beide Seiten entstehen aus `legal.html`, wie die Projektseiten aus `project.html`. Die erzeugten Dateien nie von Hand ändern.
- **Suchmaschinen:** Beide Seiten sind `noindex` und stehen nicht in `sitemap.xml`.
- **Platzhalter:** `[Platzhalter]` und `[Text folgt]` meldet `npm run check:placeholders`, bis die echten Texte da sind.

---

## Vorschau

- **Alltag:** VS Code Live Server auf `http://127.0.0.1:5501`. Auf dem iPhone im selben WLAN: `http://<IP des Mac im WLAN>:5501`.
- **Seiten sind Ordner:** `/work/<id>/`, `/about/`, `/impressum/`, `/datenschutz/`.
- **Wie online bei Vercel:** `npm run dev` in `_tooling` (oder in VS Code „Tasks: Run Task“ → „Portfolio-Vorschau“) auf `http://127.0.0.1:8765`, mit Live-Reload. Das braucht es nur, um die Weiterleitungen von Vercel und die 404-Seite zu sehen.
- **Tests:** `npm test` in `_tooling` (Chrome und WebKit, etwa zwei Minuten).

---

## Checkliste neues Projekt

1. Alles, was ins Projekt soll, in `images/projects/<id>/_ROH` legen.
2. Ich scanne den Ordner (`npm run scan -- <id>`) und frage nach, wo etwas unklar ist.
3. Gemeinsam legen wir Raster und Texte fest. Ich schicke die Exportliste mit Namen, Maßen und Format.
4. Exportieren und in `images/projects/<id>/_ABB` legen.
5. Ich prüfe die Exporte (`npm run check:abb -- <id>`), trage Maße ein, erzeuge Unschärfe-Vorschau und Grundfarbe (`npm run placeholders -- <id> --write`, nach jedem Neu-Export wieder) und prüfe die Seite im Browser.
6. Neues Projekt oder geänderte `id`, `de.title`, `de.subtitle`: `npm run pages` (Projektseite, Sitemap). Dazu gehört `_ABB/og.jpg` als Link-Vorschau.
