# Projekt-Baukasten

Eine Projektseite besteht immer aus demselben Rahmen:

1. **Hero:** volle Breite, 16:9
2. **Titelblock:** Titel, Kategorie, Jahr und Untertitel
3. **Module** in beliebiger Reihenfolge: Medien-Zeilen, Text, Akkordeons
4. **Weitere Projekte:** das vorherige und das nächste Projekt

Alles steht in `data/projects.json`. Übersetzbare Felder sind immer `{ "de": "…", "en": "…" }`. Fehlt eine Sprache, erscheint vorerst die andere. So sind Entwürfe schon sichtbar, bevor die Übersetzung da ist.

---

## Ordner und Dateinamen

| Was | Pfad |
|---|---|
| Bilder | `images/projects/<id>/` (z. B. `hero.webp`, `01.webp`, `02.webp`) |
| Videos | `videos/projects/<id>/` (z. B. `teaser.mp4`, `05.mp4`) |
| Standbild zu einem Video | gleicher Name als `.webp` im Bilder-Ordner (z. B. `images/projects/<id>/05.webp`) |

`<id>` ist die `id` des Projekts, z. B. `reality-by-algorithm`.

---

## Grundgerüst eines Projekts

```json
{
  "id": "mein-projekt",
  "featured": true,
  "year": "2026",
  "hero": {
    "image": { "src": "images/projects/mein-projekt/hero.webp", "width": 2560, "height": 1440 },
    "teaser": "videos/projects/mein-projekt/teaser.mp4",
    "film": { "youtube": "dQw4w9WgXcQ" }
  },
  "preview": { "portrait": "videos/projects/mein-projekt/preview-portrait.mp4" },
  "blocks": [ … ],
  "de": { "title": "mein projekt", "category": "Installation", "subtitle": "Ein Satz zum Projekt." },
  "en": { "title": "my project", "category": "installation", "subtitle": "One sentence about the project." }
}
```

- **`featured`:** Das Projekt erscheint in der Liste auf der Startseite.
- **`title`:** darf `<br>` enthalten, z. B. `"reality,<br>by algorithm."`.
- **`preview.portrait`:** optional, die Hochformat-Vorschau für die Startseite auf dem Handy. Auf dem Desktop läuft dort der Teaser.

---

## Hero

`hero.image` ist immer Pflicht. Es ist das Standbild und das Notfallbild, und Startseite und Karten verwenden es.

| Variante | Felder | Verhalten |
|---|---|---|
| Teaser + Film | `image`, `teaser`, `film` | Teaser läuft sofort stumm; „abspielen“ lädt den Film (Vimeo oder YouTube) mit Ton |
| Nur Teaser | `image`, `teaser` | Stummer Loop, keine Buttons |
| Standbild + Film | `image`, `film` | Bild; „abspielen“ lädt den Film |
| Nur Bild | `image` | Bild |

**Film:** `"film": { "vimeo": "76979871" }` oder `"film": { "youtube": "dQw4w9WgXcQ" }`. Eingetragen wird nur die ID (bei YouTube der Teil nach `v=` bzw. nach `youtu.be/`, bei Vimeo die Zahl aus der Adresse).

Vor dem Klick auf „abspielen“ geht keine einzige Anfrage an den Anbieter. Neben dem Button steht dazu der Hinweis „Film wird von Vimeo geladen“ bzw. „… von YouTube …“. YouTube wird über `youtube-nocookie.com` eingebunden.

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
{ "type": "image", "src": "images/projects/<id>/01.webp", "width": 2560, "height": 1440,
  "alt": { "de": "Blick in die Ausstellung", "en": "View of the exhibition" }, "focus": "30% 50%" }
```

**Video** (stummer Loop, spielt nur, wenn es sichtbar ist):
```json
{ "type": "video", "src": "videos/projects/<id>/05.mp4", "poster": "images/projects/<id>/05.webp", "width": 1920, "height": 1080 }
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

**Mit Bild:** Jedes Akkordeon kann `media` enthalten, Bilder oder Videos wie in den Medien-Zeilen. Sie stehen oben in voller Akkordeon-Breite und im eigenen Format, der Text darunter. Die Bilder laden erst beim Aufklappen. Export: 1440 px breit (Akkordeon = 6 Spalten).

```json
{ "title": { "de": "Notation", "en": "Notation" },
  "media": [{ "type": "image", "src": "images/projects/<id>/notation.webp", "width": 1440, "height": 960, "alt": { "de": "…", "en": "…" } }],
  "content": { "de": "…", "en": "…" } }
```

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

**Bilder:** WebP, sRGB, ohne Transparenz, Qualität ca. 75–80. Die Breite richtet sich nach der Feldgröße:

| Spalten des Feldes | 12–10 | 9–7 | 6–5 | 4 | 3–2 |
|---|---|---|---|---|---|
| Breite (px) | 2560 | 1920 | 1440 | 1080 | 800 |

- **Höhe:** Breite ÷ Format. Das größte Feld hat das Format der Zeile, die kleineren Felder werden gleich hoch und damit schmaler im Format.
- **Beispiele** für kleinere Felder, bezogen auf 1440px:
  - `[4, 8]` mit 16:9: das 4er-Feld etwa 1080×1242
  - `[3, 9]` mit 16:9: das 3er-Feld etwa 800×1404
  - Bei anderen Zeilen sag mir die Zeile, ich rechne die Maße aus.

**Videos:**
- **Codierung:** MP4, H.264 (High), 8 Bit yuv420p, **ohne Tonspur**, Fast Start / „für Web optimiert“, ca. 3 Mbit/s.
- **Loop im Inhalt:** Breite wie bei Bildern, höchstens 1920. Dazu ein Standbild (das erste Bild) als WebP in denselben Maßen.
- **Hero:**
  - `teaser.mp4` 1920×1080, ca. 15 s
  - `hero.webp` 2560×1440, das erste Bild des Teasers
- **Startseite, Handy:** `preview-portrait.mp4` 1080×1920

**Alt-Texte:** Jedes Bild bekommt einen deutschen und einen englischen Alt-Text. Videos sind dekorativ und brauchen keinen.

---

## Was passiert, wenn …

| Fall | Verhalten |
|---|---|
| Datei fehlt | Farbfläche im richtigen Format, kein kaputtes Symbol |
| Video darf nicht laufen (Bewegung reduzieren, Datensparen, Stromsparmodus) | Standbild statt Loop |
| Langsames Netz | Unscharfe Vorschau, bis das Medium da ist |
| Film lädt nicht, Anbieter meldet Fehler, Start blockiert (z. B. Ton in Safari) | Die Steuerung des Anbieters wird freigegeben: ein Tipp direkt auf das Video startet ihn |
| Zeile falsch befüllt (Spalten über 12, `items` passt nicht zu `cols`, Maße fehlen) | Block wird übersprungen, die Browser-Konsole sagt, welcher und warum |

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

## Checkliste neues Projekt

1. Dateien exportieren und in die Ordner legen.
2. Das Projekt in `projects.json` anlegen (oder mir die gewünschten Zeilen sagen).
3. Ich trage Vorschauen, Farben und Maße ein und prüfe die Seite im Browser.
