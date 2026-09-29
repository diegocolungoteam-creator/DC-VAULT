# Build your own reel studio

A code-based system for turning raw talking-head footage into finished, branded
Instagram/TikTok reels: the best takes assembled, word-synced captions, designed
graphic cards, sound design, motivated camera moves, rendered straight to MP4.

This is the setup behind the GSS reels — and since v1 it has shipped reels for
four other brands on the same code, only the tokens changed. Everything below is
brand-agnostic: swap the colours, fonts, logo and sound pack for your own and it
becomes yours.

> **The one rule that matters most:** whoever edits the video must be given the
> **written script of every video**. See [The script rule](#5-the-script-rule).
> Skip it and your captions will be wrong in ways nobody notices until it's
> published.

**v2 (Sep 2026).** What changed since the first version, in one paragraph: the
studio now assembles a reel from **many takes** (§8.6 is the new core of the
pipeline), **captions run start to finish and are never muted** (§9), the safe
zone is now a **measured Instagram box plus a fixed grid** (§8.9), audio is
**raw voice by default** with denoise opt-in (§16), there is a **brand module
per client** (§6), and three new kinds of supporting visual — b-roll inserts,
AI-generated panels and keywords matted *behind* the speaker (§14). The
gotchas list roughly doubled. A short changelog is at the end.

---

## 1. What you're building

A [Remotion](https://remotion.dev) project — video composed in React, rendered
deterministically to MP4. Not a timeline editor. You describe the reel as data
(cards, camera moves, sound cues, caption timings), and the renderer produces
the file.

**Why bother instead of CapCut/Premiere:**

- Every reel reuses the same components, so brand consistency is automatic
  rather than remembered.
- Captions are generated from a real transcript with word-level timing — no
  hand-nudging 40 text boxes.
- Changing a colour, a font or a safe zone re-renders every reel correctly.
- A second brand is a 60-line token file, not a new project.
- It's diffable and reviewable. You can see exactly what changed between v1 and v2.

**Real costs, so you go in with your eyes open:** a ~45s reel takes 4–9 minutes
to render on an 8 GB M1 (20+ minutes if the source is 4K and the machine is
swapping). It is slower than a timeline editor for one-off work and much faster
for the tenth reel in the same style. If you only ever make three videos, this
is not worth it.

**What one reel is, as data** (the props of the `<Reel>` component):

| prop | what it is |
|---|---|
| `video` | the assembled master (§8.6) |
| `words` | word-level transcript of *that master* |
| `cards` | the graphic cards: type, copy, start, end |
| `camera` | motivated zooms/reframes (§12) |
| `sfx` | sound cues: file, time, volume (§10) |
| `safe` | the measured band the speaker occupies (§8.9) |
| `accent` / `ink` | the two colour slots (§6) |
| `emphasis` | words the captions colour |
| `callouts` | hand-drawn underline/circle marks from the pack |
| `handheld` | px of noise-driven drift on the footage |
| `grain` | film grain opacity, 0 to switch off |
| `music` | bed + volume, or `null` |

---

## 2. Prerequisites

| | |
|---|---|
| Node.js | 20+ (this project runs on 26.5.1) |
| ffmpeg + ffprobe | required for all footage prep, assembly and QC |
| Python 3 + numpy | the per-reel `assemble.py` scripts (level curves, take cutting) |
| Chrome | installed automatically by Remotion on first render |
| RAM | 8 GB works but swaps hard; 16 GB+ is much happier |
| Xcode Command Line Tools (macOS) | optional — only for the person-matte tool (§14.3) |

```bash
brew install ffmpeg          # macOS
node -v && ffmpeg -version   # confirm both
python3 -c "import numpy"    # confirm numpy
```

Optional but strongly recommended: a [Groq](https://console.groq.com) API key
for transcription (`whisper-large-v3`). It is dramatically more accurate than
local `whisper small`, and accuracy here saves you an hour of caption fixing.

> Check what your ffmpeg build actually has. The one on this machine ships
> without `drawtext` and `libass`, so contact sheets can't be time-stamped —
> we work around it with 1 fps sheets tiled 9 wide (cell index = second).

---

## 3. Folder layout

```
your-video-studio/
├── editing-pack/          # your sound/graphics library (see §7)
│   ├── Sounds/
│   ├── Music/
│   ├── Overlays/
│   ├── Transitions/
│   └── PNGs/
├── footage/               # raw camera files, untouched
├── tools/
│   └── matte/             # person-segmentation binary (§14.3), optional
└── remotion/
    ├── package.json
    ├── tsconfig.json
    ├── tools/genimg.py    # AI supporting images (§14.2), optional
    ├── public/            # anything the composition loads at runtime
    │   ├── brand/logo.png
    │   ├── fonts/*.woff2
    │   ├── fx/            # grain, transition overlays (converted, §15)
    │   ├── music/         # trimmed + normalised music beds
    │   ├── sfx/           # trimmed + normalised effects
    │   └── reel-07/       # per-reel media — one folder per reel
    │       ├── raw/       #   transcoded source clips (or proxies)
    │       ├── assemble.py#   the take list → video.mp4 (§8.6)
    │       ├── TAKELIST.md#   which take carries which beat, and why
    │       ├── tx/        #   transcripts, versioned (they die with /tmp otherwise)
    │       ├── video.mp4  #   the assembled master
    │       ├── img/       #   screenshots, client photos, AI panels
    │       └── qc.py      #   post-render checks (§19)
    └── src/
        ├── Root.tsx       # registers every composition
        ├── brand.ts       # ← YOUR COLOURS, FONTS (house brand)
        ├── brands/        # one module per client brand (§6)
        ├── ig-safe.ts     # measured Instagram UI boxes + the grid (§8.9)
        ├── fonts.tsx      # self-hosted font loader
        ├── components/    # Reel, Footage, Captions, CardShell, Callout, Grain,
        │   ├── cards/     #   HookCard, QuoteCard, StrikeCard, NumberCard, CtaCard
        │   └── IgSafeOverlay.tsx   # draws the safe box for a pre-render still
        └── reels/
            └── reel-07/
                ├── index.tsx       # the reel, as data
                └── SCRIPT.md       # the written script (see §5)
```

Keep `public/` for things loaded at runtime and `src/` for code. Remotion's
`staticFile()` only reaches into `public/`.

**Every reel registers three compositions:** `reel-07` (with music),
`reel-07-nomusic` (for adding trending audio in-app, §11) and `reel-07-ig`
(same reel with the Instagram safe-zone overlay on top, for a pre-render still,
§8.9).

> ⚠️ **No symlinks inside `public/`.** They don't survive Remotion's bundle —
> the render 404s on them. Copy the file even if it duplicates 8 MB.

> ⚠️ **Keep 4K masters out of git**, and keep transcripts *in* the reel folder
> (`tx/`). Early on, transcripts lived in a session scratch directory and were
> gone when a v3 was needed.

---

## 4. Setup

```bash
mkdir -p your-video-studio/remotion && cd your-video-studio/remotion
npm init -y
npm i remotion @remotion/cli @remotion/fonts @remotion/noise \
      @remotion/media-utils @remotion/transitions @remotion/shapes \
      @remotion/paths @remotion/motion-blur @remotion/captions \
      react react-dom
npm i -D typescript@5 @types/react @types/react-dom
```

`package.json` scripts:

```json
{
  "scripts": {
    "studio": "remotion studio",
    "render": "remotion render",
    "still": "remotion still",
    "typecheck": "tsc --noEmit"
  }
}
```

> ⚠️ **Pin TypeScript to 5.x.** Remotion's bundler calls `typescript.sys`, which
> was removed in TS 7. The render dies at "Bundling 6%" with
> `Cannot read properties of undefined (reading 'readFile')` — an error that
> tells you nothing about the real cause.

---

## 5. THE SCRIPT RULE

**Every video must come with the script it was filmed from.** Not a summary —
the actual words, written down before filming. Hand it to the editor with the
footage, and store it beside the composition as `SCRIPT.md`.

### Why this is non-negotiable

Automatic transcription is ~95% accurate, and the 5% it gets wrong is
**plausible-looking**, so nobody catches it in review. Real examples from these
reels, where the audio genuinely sounds like both readings:

| Transcription heard | Actually said | Consequence if shipped |
|---|---|---|
| "come and bench" | **"comment BENCH"** | the call to action is destroyed |
| "come and audit" | **"comment AUDIT"** | same failure, second brand, months later |
| "you're present of a soft base" | "you're **pressing off** a soft base" | gibberish on screen |
| "crossed into the bench" | "**crushed** into the bench" | wrong coaching cue |
| "bench press Kodama" | *(a real exercise name)* | only the script confirms the spelling |
| "properly passed 120 kilo" | "properly **paused**" | claims the wrong lift |

Names, technical terms, brand words and the CTA keyword are exactly what
transcription gets wrong, and exactly the words that matter most.

### The division of authority

- **The script is the authority on spelling and wording.**
- **The recording is the authority on what actually appears.** People improvise
  around their script, reorder points, and cut things. Captions follow the
  delivery, corrected against the script.
- **The speaker is the authority on facts they chose to keep.** One reel says
  "more than 5 hours" where the real number is 5 minutes; the speaker decided
  to leave it. Captions stay faithful to the delivery, and no card contradicts
  it. Flag it once, then follow the call.

### What else the script gives you for free

A good script contains a **retention plan** — where the jump cuts go, which
numbers appear on screen, where the punch-in lands. That is a storyboard you
don't have to invent. It also names the **CTA keyword**, which drives the
biggest graphic in the reel. Some scripts specify edit beats outright ("half a
second of pure black, then cut hard") — do exactly that.

### Hand this over with every video

- [ ] The written script (word-for-word)
- [ ] The CTA keyword, spelled exactly as it should appear
- [ ] Every proper noun, product name and technical term
- [ ] All footage: main takes, retakes, b-roll, screenshots
- [ ] Any specific asset to include (a screenshot, a client clip, a logo)

---

## 6. Your brand tokens

Everything visual lives in one file so a new reel never re-picks colours.

`src/brand.ts`:

```ts
export const FPS = 30;
export const W = 1080;
export const H = 1920;

export const brand = {
  black: '#000000',
  white: '#FFFFFF',
  /** SOLID FILLS ONLY — slabs, chips, bars. White text sits on top. */
  accent: '#2B2EFF',
  /** Coloured TEXT laid over video. Must be lighter than `accent`. */
  accentText: '#8F91FF',
  font: 'Inter, -apple-system, sans-serif',
} as const;
```

### The two-colour-slot rule

This is the single most useful thing in the file. **A brand colour that looks
right as a solid fill will not be readable as text over video.**

- `accent` fills shapes; white text goes on top of it. Full saturation is fine.
- `accentText` is for coloured words sitting directly on footage. It has to be
  a lighter tint, or it fails 3:1 contrast against bright frames and reads as
  muddy grey.

Pick your `accentText` by taking your brand colour and lifting the lightness
until it clears 3:1 against white-ish video. Check it, don't guess.

The rule cuts the other way too: on a **light** accent (a pastel blue, a pink),
white text fails — one client's light blue gave 2.2:1 with white on top, so
that brand uses **black** text on its fills.

### One module per client brand (new)

The house brand lives in `brand.ts`; every recurring client gets
`src/brands/<client>.tsx` exporting its tokens **and** any card components
that only make sense for that client (a verdict card, an anatomy panel, a
profile card). The pipeline, captions, camera and sound code are shared —
only the module changes. Two things learned doing this four times:

- **Measure the colour from the footage, not from a mood board.** One brand's
  blue is sampled from the shirt the speaker wears on camera. It matches every
  reel because it *is* the reel.
- **Ask what the client rejects, not just what they like.** One brand wanted a
  hard offset shadow and explicitly no glow; another wanted no handle on
  screen; another wanted script + serif fonts they already owned. Write those
  down in the module as comments so the next reel doesn't relitigate them.
- Give each brand a `<brand>-brand` composition that renders one still of
  every component, so a look can be signed off in seconds.

### Fonts

Self-host as `.woff2` in `public/fonts/` and load them **inside a component**:

```tsx
export const Fonts: React.FC<{children: React.ReactNode}> = ({children}) => {
  const [handle] = useState(() => delayRender('Loading font'));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    loadFont({family: 'Inter', url: staticFile('fonts/Inter-700-latin.woff2'), weight: '700'})
      .then(() => { setReady(true); continueRender(handle); })
      .catch(cancelRender);
  }, [handle]);
  return ready ? <>{children}</> : null;
};
```

> ⚠️ Loading a font at **module scope** is the worst kind of bug: stills render
> fine, then the video render fails outright. The cheap check passes and the
> expensive one doesn't. Never link a font CDN either — a silent fallback to
> Helvetica only surfaces after a 90-second render.

Check licences. Fonts marked DEMO or "personal use only" are not licensed for a
client's commercial reel — flag it once, in writing.

### Logo

No dark chip or box behind it. A `drop-shadow` filter plus the legibility
gradient is enough; a solid plate behind a logo looks cheap. Reserve its corner
in your card padding so text never runs under it.

---

## 7. Your editing pack

You need a library of sound and graphics. For scale, the GSS pack holds 1,046
sound files, 318 music tracks, 206 transitions, 209 animated icons, 287 PNGs
and 79 overlays. You do not need that many — you need a few of each that
genuinely fit your brand.

Whatever you gather, **audition it against your own voice** rather than trusting
filenames. See §10. And **look through the whole pack for each reel** — an
arrow animation on a "starts at the floor" beat earns its place; a spinning
transition between every card does not.

---

## 8. The pipeline, per video

### 8.1 Gather every clip, not just the newest

Expect: several takes of the same section, the first half in one file and the
continuation in another, clips uploaded out of order, rehearsal clips the
speaker discarded on camera ("okay, now I'll actually record"), and extra
explanation that isn't in the script. Check the whole batch before assuming
one file is the reel.

If the speaker shoots on a real camera, the source may still be on the SD
card. Look in `/Volumes`, not just Downloads. Copy the master into
`public/<reel>/raw/` and keep a **proxy** next to it — the assembly script
should prefer the master and fall back to the proxy so you can work with the
card unmounted.

### 8.2 Watch the footage — actually watch it

A transcript is not enough. You cannot motivate a zoom or place b-roll from
text alone. Build a contact sheet and look at it:

```bash
# whole-clip overview, 6 frames with gridlines every 10% of height
TOTAL=$(ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames -of csv=p=0 video.mp4)
ffmpeg -y -v error -i video.mp4 -vf \
  "select='not(mod(n,$((TOTAL/6))))',drawgrid=w=iw:h=ih/10:t=2:c=yellow@0.6,scale=250:-1,tile=6x1" \
  -frames:v 1 framemap.jpg
```

```bash
# dense sheet for one window: 3 fps, 6x3 grid = 18 cells = 6 seconds
# cell n starts at START + n/3 seconds
ffmpeg -y -ss 12.8 -t 6.0 -i video.mp4 \
  -vf "fps=3,scale=150:-1,tile=6x3" -frames:v 1 sheet.jpg
```

A gesture lasts well under a second. Sampling every 1.7s tells you *that*
someone gestures, never *when* — and a zoom placed off a coarse scan lands on
nothing. For take selection, 2 fps sheets per block are enough to see who
looks off-camera, touches their face, or restarts.

### 8.3 Transcode if needed

Phone footage is often HEVC, which Chrome can't decode reliably. Convert, and
add dense keyframes so seeking during render is fast:

```bash
ffmpeg -i IMG_1234.MOV -vf scale=1080:1920 -c:v libx264 -preset fast -crf 18 \
  -g 30 -keyint_min 30 -pix_fmt yuv420p -c:a aac -b:a 192k public/reel-01/raw/c01.mp4
```

Two things real cameras do that phones don't:

- **Rotation lives in metadata.** `ffprobe` reports a 4K vertical clip as
  3840×2160 with `rotate=-90`; it is 2160×3840. Filters that assume width >
  height will mangle it.
- **Audio is PCM, not AAC**, and the file is 4 GB. Never decode the whole
  thing per segment — put `-ss` *before* `-i` (see §8.6).

### 8.4 Transcribe with word-level timings

```bash
ffmpeg -i video.mp4 -vn -ac 1 -ar 16000 -b:a 64k audio.mp3
curl -s https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F file=@audio.mp3 -F model=whisper-large-v3 \
  -F response_format=verbose_json -F 'timestamp_granularities[]=word' \
  -o words.json
```

Reduce to a flat array of `{text, start, end}`. Use `curl` — the same request
through Python's `urllib` comes back 403.

**Transcribe twice.** Once per source clip, to plan the takes (§8.6). Then
again on the **assembled master** (§8.8) — that is the transcript the captions
use. Mapping source timings through the cut list works, but transcribing the
master is simpler and catches what the cut actually sounds like.

### 8.5 Correct the transcript against the script

Do this before anything else uses the timings. See §5.

### 8.6 Assemble the takes (new — this is where the edit is made)

The old pipeline assumed one clip. Real shoots produce a 3–9 minute session
with five to eight attempts per line, or 23 separate phone clips. **The take
list is the edit.** Write it down before touching the composition:

```
TAKELIST.md
  hook      c4591 0.00–6.16   (louder, fewer micro-stops than the 3 in c4590)
  block 1   c4164 63.42–70.08 minus internal pause 65.73–65.91
  ...
  DROPPED   105.3–107.1 "and then I understood" → looks off camera
```

Then `assemble.py` turns it into `video.mp4`: a list of `(in, out, [internal
silences to remove], label)` per segment, each cut with `-ss` **before** `-i`
(so a 4K master isn't decoded from the start for every segment), 10 ms fades
at every join, and gain-matched per take (§16). Script-specified beats — a
0.45 s black inside a turn, a 1.3 s freeze on the final frame under the CTA
card (`tpad`) — go in here too.

**Rules for choosing takes, learned the expensive way:**

1. **If a line is said twice in a row, the last attempt is the one.** No
   exceptions. A shipped reel with "This is the reason how… / This is the
   reason why…" back to back is rejected whole, however good the rest is.
2. **The best hook is not necessarily the first clip.** One client's best hook
   was the sixth take, 63 s in, and it ran straight into the next line in the
   same take — a free clean join.
3. **The last take is not automatically the strongest.** Choose on delivery:
   louder, fewer micro-stops, eyes on the lens.
4. **Whole sentences.** The viewer hears the entire thought. Cut *between*
   thoughts, aggressively; never inside one.
5. **Two near-identical lines can be two different exercises.** If a format
   block ends up incomplete (a MAL→BIEN→GENIAL with no GENIAL), ask for the
   missing clip before discarding a "redundant" take.
6. **Check that the head of every segment is voice.** One clip opened with
   2.9 s of room noise and a cough; Whisper hallucinated a word on top and the
   cut kept it. Measure the level in 0.2 s windows at each in-point.

**Whisper hides restarts.** This is the single most important thing in this
section. When a speaker restarts a line without pausing, the transcript of the
full clip fuses both attempts into one "word" spanning 1–25 seconds. The take
list built from that transcript will keep the false start. So, before trusting
any cut:

- Every word longer than **0.9 s** in the transcript is suspect.
- Re-transcribe **only that window** (±2 s) at word level, and take a 50 ms
  RMS curve of it. A restart shows as a 0.15–0.3 s dip of −10 to −35 dB in the
  middle of the "word".
- Start the take at the **last** attempt: first word −0.06 s.
- When you isolate a window with margin, check that the last word belongs to
  *this* sentence and not the start of the next attempt.

### 8.7 Cut the silences — but not with `silencedetect` at the edges

For **internal** pauses inside a kept segment, a level map is still the tool:

```bash
ffmpeg -i audio.mp3 -af "silencedetect=noise=-35dB:d=0.10" -f null -
```

Then trim pauses longer than ~0.25–0.35 s down to ~0.10 s, **pad 0.07 s
inward** on each side so no consonant onset is clipped, and drop anything under
0.08 s after padding. Sub-0.1 s rhythm inside a sentence is delivery; a held gap
between sentences is dead air. Cutting *every* 0.1 s gap removes about a quarter
of the audio and sounds robotic.

> ⚠️ **−30 dB eats consonants.** Fricatives and word tails fall to −32 dB, so
> a −30 dB threshold cuts "diges-" off "digestion" and the speaker hears it
> immediately ("you cut me out speaking"). Use −35 dB, and pad.

For **segment edges** — where a take starts and ends — do not use
`silencedetect` at all, and do not trust Whisper's `end` (it runs 0.3–0.6 s
long). The rule that finally stopped both "you cut me before the end of the
word" and "you cut too late":

- **Take end** = first point after the last word where the 50 ms RMS drops
  below −30 dB for **two consecutive windows**, +0.04 s.
- **Take start** = first word −0.06 s.
- For any multi-syllable last word, trace the level curve to the true tail.
  "Digestion" has a −45 dB gap of 150 ms *inside* it before "-tion".

### 8.8 Transcribe the assembled master

Now `video.mp4` exists, transcribe it (§8.4) and correct it against the script
(§8.5). That transcript drives the captions and the card audit. Then run one
more check the word plan can't do:

```bash
ffmpeg -i video.mp4 -af "silencedetect=noise=-35dB:d=0.4" -f null -
```

This caught 0.63 s of dead air after a sentence whose last word Whisper had
timed half a second late. Fix it in the take list, re-assemble, re-transcribe.

### 8.9 Measure the safe zone — every shoot, never inherited

**People frame themselves differently every time they film. There is no fixed
safe zone.** Real cost of assuming: one reel put a product card directly over
the speaker's eyes because it reused the previous reel's zones. Full rebuild.

The safe zone is now the intersection of **three** things:

**(a) The speaker.** Read the widest span the head and chest occupy across the
whole clip off the framemap. Note that framing changes *within* a take — one
clip has three framings; a speaker who leans into the lens for the CTA drops
their chin from 49 % to 58 % of frame height. **Measure the lowest chin across
the whole clip, not one frame**, and put lower-third cards under *that*. If
you need to know exactly where a head is per frame, the matte tool (§14.3)
writes the silhouette's bounding box per frame — far better than eyeballing a
contact sheet.

**(b) Instagram's UI, measured, not from a blog.** Screenshot your own
published post and scale it onto the 1080×1920 canvas (on a 1179×2556 iPhone
the video starts at y 291 and scales ×1.0917). What we measured:

| Instagram element | Canvas box |
|---|---|
| avatar + username | y 78–138, x 0–700 |
| audio row | **y 124–168**, x 0–720 |
| ⋯ menu | y 90–138, x 975–1080 |
| translation chip / sound | y 1790–1920 |
| **Reels player:** header | y 0–190 |
| **Reels player:** username + caption + audio | **y 1440–1920**, x 0–900 |
| **Reels player:** button rail | **x 880–1080 from y 980 down** |

One reel shipped with cards starting at y 118 and the audio row sat on the top
third of every card. It was spotted in the published post, not in the render.

**(c) A fixed grid, because the UI moves.** The caption block's height depends
on how many lines of copy show, the button rail moves with the remix button.
So on top of the measured boxes we apply a fixed rule: **420 px covered at the
top and bottom.** Taking the stricter edge on each side, readable content lives
in **y 432–1430, x 60–1020**, and additionally clear of x > 880 below y 980.
Captions centred inside x 84–884 shift the visual centre by 56 px, which nobody
notices; captions centred on the full width run under the rail.

Put the constants in `src/ig-safe.ts`, draw them with an `IgSafeOverlay`
component, and mount it in a `reel-NN-ig` composition. **Shoot one still of
that composition before every real render:**

```bash
npx remotion still reel-07-ig out/ig-check.png --frame=420
```

Then derive the layout from what's left. With the top of the box at 432 and a
head that starts at 22 %, top-band cards will overlap hair and shoulders — that
is fine (**big beats timid**; the face is the only untouchable part), but
nothing readable goes above y 432.

**The root fix is at the shoot, not the edit.** Ask the speaker to frame with
the **top of the head at ~30 % and the chin at ~62 %** of frame height. That
opens y 432–560 for a top slot and y 1220–1430 for captions, both inside the
grid and outside Instagram's UI. Put it on the hand-over checklist (§20).

### 8.10 Write the reel

Copy an existing reel folder and change the data. Roughly 45 seconds of dense
content lands near 10 cards. Run the card audit (§9) before the first still.

### 8.11 Check stills before rendering

```bash
npm run typecheck
npx remotion still my-reel out/f.png --frame=420
```

Stills cost seconds; renders cost minutes. Check every key moment as a still
and **look at it**. In this project, still-checking caught a transition
rendering as a solid opaque frame, a product card covering the speaker's face,
and a label wrapping onto two lines.

### 8.12 Render, then verify from the MP4

```bash
npx remotion render my-reel out/reel-v3.mp4 --concurrency=2 --timeout=180000
```

Render to a **new filename every time** (see §18 for why), then run §19.

---

## 9. Cards and captions

### Captions run start to finish. Never mute them. (changed since v1)

v1 of this guide said to suppress captions under a card that says the same
thing, and to drop them entirely when the face sits in the top half. **Both
are withdrawn.** After shipping reels that way for two brands, the feedback was
the same every time — "captions well placed but no text", "there are subs
missing, make it a rule that there always are". Reels are watched muted; a gap
in the captions is a gap in the message, and the cost of repeating a line on
screen is far lower than the cost of a viewer not reading it.

So: **word-by-word captions from the first word to the last, every reel, every
brand.** Not muted under a card, not under the CTA, not over a black frame.
Leave `captionMute` empty and comment why, or someone will "fix" it back.

Card/caption collision is solved by **placement**, not by deleting captions:
captions in the upper part of the lower band (≈ y 860–980), cards below them
(≈ y 1150+), or captions on a dark uniform region the shot happens to give you
(a laptop lid, a dark shirt — free legibility).

### Never say the same thing twice — card against card

The dedupe rule survives, but only between graphics: don't stack two cards
saying the same thing, and don't put a giant text card next to a caption that
already carries the word. Emphasis goes **into** the caption track (a coloured
word) rather than into a separate text card.

### Audit every card against the audio in its exact window

Card copy that doesn't match what's being said in that moment is the single
most noticeable error. Run this before every render:

```python
import json, pathlib
w = json.loads(pathlib.Path("transcript.json").read_text())
for c in CARDS:                       # your card list: id, start, end, copy
    s, e = c["start"], c["end"]
    said = " ".join(x["text"] for x in w if x["start"] >= s-0.35 and x["end"] <= e+0.35)
    print(f"── {c['id']} [{s:.1f}-{e:.1f}]\n   SAYS: {said}\n   CARD: {c['copy']}\n")
```

Read every pair. This caught three wrong cards on the first reel and one on the
fourth.

### The card library (what's in `components/cards/`)

Five generic cards cover most reels: **HookCard** (the opening claim),
**QuoteCard** (pull-quote), **StrikeCard** (a wrong idea, struck through — draw
the strike as a separate bar; CSS `line-through` paints in the text colour and
vanishes), **NumberCard** (ONE / TWO / THREE with a staggered checklist) and
**CtaCard** (the keyword, biggest thing on screen). Plus **Callout** for
hand-drawn underline/circle marks from the pack. Reels that needed more grew a
**CalloutStack** / **BigCard** / **BrollCut** trio — short labels stacked
beside the speaker, one full-frame statement, a cut-away insert — which is
worth promoting into `components/` the day a second brand needs it.

Client modules add their own: verdict cards that slam *on* the word, a zone
chip top-right, an anatomy panel that appears when a muscle is named, a
profile-screenshot card under the CTA.

The mechanics are always the same: a card is `{type, copy, start, end}`, it
enters with a short slam or slide on the word it belongs to, and it leaves on
the next beat. Big beats timid.

### Caption craft

- Chunk at ~4 words, break on punctuation, and **merge short blocks right to
  left**. Left-to-right merging is greedy: it absorbs the wrong block, hits the
  6-word cap, and leaves a single word flashing for 0.26 s.
- Clamp each block's end to the next block's start, or blocks stack silently.
- Whisper timings that sit within ±0.1 s of a cut leave orphans ("belongs. On")
  and sometimes shift a word 0.08 s across the seam. **Replay the chunker in
  Python and fix those 5–7 timings by hand before rendering.** It cost a 10-min
  render to learn that.
- If Whisper omits a full stop, the chunker can swallow the next instruction
  into the previous block. Fix punctuation in `tx/`, not in the component.
- Emphasise selectively — numbers, key claims, contrasts, the CTA. Never
  highlight random words, and never many at once.
- Captions match the **final edited speech**, not the original script.
- Spell-check the rendered caption list, not the transcript.
- Keep every caption inside the box from §8.9.

---

## 10. Sound design

Two principles carry most of the result.

### Restraint

A ~45s reel wants roughly **8–12 cues, not 30** (a dense 77 s reel used 16).
One sound per structural beat, nothing decorative.

### Calibrate against the voice, by measurement

```bash
ffmpeg -i video.mp4 -af volumedetect -f null -   # find the voice mean
```

Normalise each effect (`loudnorm=I=-20:TP=-3` so the volume knob means the same
thing every time), then set its volume by where you want it to sit. Effective
level = file mean + 20·log₁₀(volume). Two calibrated styles, pick one per brand
and stay there:

| style | effect vs voice mean | same-window A/B (§ below) |
|---|---|---|
| **present** — you hear the whoosh | 4–8 dB under | +3 to +9 dB |
| **felt, not heard** — most client brands ended up here | 11–13 dB under | +0.3 to +2.5 dB |

At 7–8 dB under, one client said "too loud". Effects that end up 15–20 dB
under are inaudible — that's what "it doesn't sound like anything" always turns
out to be. Tiny chips can be deliberately near-silent (volume ~0.12).

```bash
ffmpeg -y -ss 1.05 -t 0.90 -i src.wav \
  -af "afade=t=in:st=0:d=0.10,afade=t=out:st=0.62:d=0.28,dynaudnorm=p=0.9,alimiter=limit=0.7" \
  -ac 2 -b:a 160k sfx-air.mp3
```

**Check where the source actually has energy before trimming.** One file's first
second was near-silence; trimming "the first 0.9s" produced a −44 dB clip that
could never be heard at any volume.

```bash
for s in 0 1 2 3 4 5; do
  ffmpeg -hide_banner -ss $s -t 1 -i src.wav -af volumedetect -f null - 2>&1 | grep mean_volume
done
```

### Sweeps beat clicks on dense narration

A 0.19s dry click was measured **inaudible in 3 of 4 placements** — the voice
completely masked it. Someone talking continuously leaves no gaps to hide short
transients in. A whoosh works because it **sweeps across the frequency band**
instead of sitting in the middle of the vocal range, so it registers without
needing volume.

### Put the whoosh on the cut, not on the card (new)

Placing a whoosh on a card that lands mid-sentence measured **+0.2 dB** against
the dry render — masked by the voice, effectively absent. Moving the same cue
to the **segment cut** the card follows made it audible at the same volume,
because the cut is where the voice has a tail. Sound design follows the edit
points; the cards follow the sound.

### Verify placement, don't trust your ears through a laptop

Compare the **same time window** in a no-SFX render versus the SFX render.
Comparing a quiet moment against a loud one proves nothing.

```bash
ffmpeg -hide_banner -ss 9.9 -to 10.7 -i without.mp4 -af volumedetect -f null - 2>&1 | grep mean_volume
ffmpeg -hide_banner -ss 9.9 -to 10.7 -i with.mp4    -af volumedetect -f null - 2>&1 | grep mean_volume
```

Use the A/B to catch **absent** effects (0.0 dB = not there) and the level
calculation to set balance. Then let the speaker listen. Don't burn renders
chasing a dB target by ear you don't have.

### Taste (this part is ours — pick your own, then be consistent)

GSS uses airy, swelling whooshes and **no trailer-style impacts** — booms and
hits read as cheap on a talking-head reel. If you want to sort a pack by that
character, the measurable difference is:

| | airy | "hardcore" |
|---|---|---|
| brightness (zero-crossings/s) | 900–1400 | 60–200 |
| energy peak position in clip | 0.4–0.8 (swells) | 0.04 (front-loaded thump) |
| crest factor | 15–19 dB | 25–28 dB (a click on a thud) |

Two limits of that scorer, found later: it doesn't detect **tonal** sweeps (a
synth riser scores as "airy" and sounds like a keyboard — "I want airy whooshes
and lowkey risers", not that), and the best files in a big pack tend to hide in
a folder the filenames don't advertise (ours: `_VIRAL (NEW)` — short reverb
whooshes, a reverse-tension swell that *lands*, wind atmos). Listen to the
top 20 by score; don't ship by score.

### Headroom

Phone footage often peaks at −0.5 dBFS, so anything summed on top hits full
scale. Set the footage volume to ~0.94 once rather than hunting individual cues.

Then read **peak count, not peak level**. `max_volume: 0.0 dB` looks alarming
and usually isn't: one sample in 2.2 million touching full scale with a flat
factor of 0 is inaudible.

```bash
ffmpeg -i out.mp4 -af "astats=metadata=1:reset=0" -f null -
```

---

## 11. Music

Choose for **fit**, not for licence — a track that suits the video and feels
current beats a safe one that makes the content feel dated. (An emotional piano
bed under a training reel is the canonical failure.) Whether a reel gets music
at all is a question for the speaker, every time.

Say the trade-off once and then follow the decision: platform music licences
generally only cover audio added through the app's own picker, so a commercial
track baked into the uploaded file can be muted or throttled. The practical
answer is to **render two cuts** — one with the bed for posting as-is, one clean
for adding trending audio in-app. That's why every reel here registers a
`-nomusic` composition alongside the main one.

Pick a **steady** bed. Measure candidates in 15-second blocks and choose one
that doesn't swing:

```bash
for s in 0 15 30 45; do
  ffmpeg -hide_banner -ss $s -t 15 -i track.mp3 -af volumedetect -f null - 2>&1 | grep mean_volume
done
```

A track that swings 12 dB mid-song will duck and swell under the voice. Land
beats and drops on real cuts. Sit the bed ~15–18 dB under the voice; if someone
says it's "a touch loud", 2–3 dB is what they mean. Once a brand has an approved
bed, reuse it at the same volume — it becomes part of the brand.

A bed shorter than the reel: loop it with a 2 s `acrossfade` and an end fade
into `public/<reel>/music/bed.mp3` rather than letting it stop.

---

## 12. Camera moves

**Every zoom needs a reason visible on screen.** Generic beat-pushes every few
seconds satisfy nothing.

| The speaker is… | Do |
|---|---|
| naming a body part while showing it | zoom onto that area |
| pointing somewhere | reframe towards it |
| making a key claim | subtle punch-in |
| moving to a new idea | zoom out / reset framing |
| demonstrating something | keep the working parts in frame |
| discussing an object or screen | reframe onto it |

**Match the direction to the gesture.** A gesture about width wants a **widen**,
not a push — zooming in on spread hands crops off the very thing being shown.

**The speaker stays on screen. Cards go where they gesture.** (new) The first
version of a case-study reel replaced the speaker with full-screen before/after
panels for four cases. Verdict: "really, really bad". What works is the speaker
on screen the whole time with the client card floating *beside* them — in the
space they are already gesturing towards (measure it: in one shoot he sits left
and gestures upper-right, so every card lives at (560, 430) and the zoom origin
is pinned at 78 % / 46 % to keep him left). **Never shrink the subject to make
room for graphics.** A card may overlap ~85 px of shoulder; it may not overlap
the face.

**Zoom limits come from the framing.** With the crown near the top of frame,
pushes above ~1.075–1.09 crop the hair; keep the transform origin at 36–46 %
so a push lifts towards the eyes, not the chin. A 1.07 push adds to a chin
that already drops when the speaker leans in — that combination put a
lower-third card on his mouth. Measure the lowest chin (§8.9) and push with a
high origin (~34 %) under it.

Scale should only ever go up if your footage is `object-fit: cover`; scaling
below 1 exposes the frame edge. Add a slow noise-driven handheld drift (a few
px) so perfectly eased moves stop reading as "template".

**Demo shots are brief.** Speak → flash of the demonstration (~0.7 s after the
word) → cut. No full reps, no mute tails. One reel went from 43.7 s to 35.0 s
with the same 74 words by applying this.

---

## 13. The legibility wash

Text over video needs a dark gradient behind it. The mistake — made twice here
— is applying a **fixed, full-frame** wash.

> Darkening the whole frame to protect text that isn't there is what makes a
> reel look muddy.

Make the wash follow the graphics **in space and in time**:

- Only darken the band that actually carries text.
- Gate it on **when** that text exists. If captions don't start until 14s, the
  bottom of the wash shouldn't be dimming your subject from second one.
- Bring it in under a transition or flash so the change is invisible.
- **Stop the wash above the hair line.** White labels on a white wall don't
  read even with a shadow; a local wash fixes it, but it must switch off before
  the head starts (at 29 % on that shoot) or the speaker goes grey.

Split it into a top element and a bottom element and animate their opacity
independently. On this reel the subject's brightness in the hook went from luma
~92 to ~170 by simply not running the caption wash before there were captions.

---

## 14. Supporting visuals (new)

Three kinds, all subject to one rule: **only where the speaker describes
something they cannot show.** Never decorative, never on every beat.

### 14.1 B-roll inserts and screenshots

- A line that was never filmed ("Sparkling water.") became a 1 s insert of the
  speaker pouring a glass, with the phrase as a top word and a film burn in and
  out. A deliberate non-speaking beat, caption-free because there is no speech.
- A client's before/after: crop it from their own post screenshot, pop BEFORE in
  on the first "this", stack AFTER over it on the second. Small moves — 34 px —
  a 150 px slide put the photo on the speaker's cheek.
- Product screenshots cut to **full frame** over a dark brand background with a
  slow push, cropped to the row that matters so it is legible at phone size.
- Store proxies of any external b-roll in `public/<reel>/` and cut them with a
  `BrollCut`; the speaker returns on the next word.

### 14.2 AI-generated panels

`tools/genimg.py` — OpenAI image API (`gpt-image-2` with fallbacks), 1024×1536
portrait, ~100 s each, the prompt saved as a `.json` sidecar next to every PNG
so a panel can be regenerated or audited. Two uses that earned their place:

- **A fault the speaker describes seated** — elbows flared, shoulder blades off
  the bench, "max 45°". Full frame with a slow push, a top word as the label,
  a burn in and out of the *run*, not between two labels over the same image.
- **An anatomy panel when a muscle is named** — the muscle in red, in a side
  strip the speaker's postures leave free. Enters on the word, leaves on the
  next verdict card.

Prompt gotchas: an overhead shot of someone on a bench needs "lying on his
back, chest faces the camera" or the model draws the lifter's back. A
`billing_hard_limit_reached` error is the account's usage cap, not the key —
make the composition render with `images=false` so the cut still ships with
labels only.

### 14.3 Keywords matted behind the speaker

"Some keywords (not all), big, with a mask behind me." One line per word,
ultra-condensed display face so the word fills ~940 px, the **word does not get
the camera transform** (it's a background plane, which gives real depth) and
the **cutout of the speaker gets exactly the camera transform** (one pixel of
offset = ghost halo).

The matte is a 40-line Swift binary using macOS Vision
(`VNGeneratePersonSegmentationRequest`, `.accurate`): ~0.1 s per frame on an
M1, handles curly hair and glasses, no models to download. `swiftc` ships with
the Command Line Tools. A second pass writes the silhouette's bounding box per
frame — which is also the most accurate way to know where the head is (§8.9).

Four things that break the effect, all paid for:

1. **`OffthreadVideo transparent` ignores VP9 alpha** — the cutout renders
   opaque and the word disappears. Use a **PNG sequence with alpha** and an
   `<Img>` indexed by `useCurrentFrame()`, cropped to the word's band
   (1080×640, not the full frame — 13.7 s is 165 MB).
2. **Don't dilate the mask** "for safety". A 2 px dilation drew a ring of wall
   around the hair — a bright halo the speaker saw instantly. No dilation,
   `gblur=sigma=1.5` on the edge.
3. **iPhone footage is BT.2020/HLG.** Chrome and ffmpeg convert it to RGB with
   a 0.8 % luminance difference, visible as a horizontal stripe across the face
   at the cutout's bottom edge. Fade the alpha over the band's last ~110 px.
4. **One line per word.** Two left-aligned lines leave the short word fully to
   the left of the silhouette with no overlap — no effect on the very word
   that asked for it.

---

## 15. Transitions and overlays from a pack (new)

- **Pack overlays are often QuickTime RLE (`qtrle`)**, which Chrome cannot
  decode at all. Convert to VP9 WebM with `-pix_fmt yuva420p`, and crop to the
  ink bounding box so x/y/width mean something. `hue-rotate()` can recolour a
  red overlay to your brand colour. Light leaks in plain H.264 play as-is.
- **Light leaks are `screen` blends, and `screen` cannot brighten what is
  already near-white.** They work on a dark shot; on a cream wall, at 0.24 and
  even 0.34 opacity, **nothing is visible**. On dark shots the limit is
  **≤ 0.6 s and ≤ 0.26 opacity** — longer/stronger tints the black shirt red
  for half a second and the whole frame goes pink. That is a colour filter,
  not a flash.
- **On bright footage use a transition that covers, not one that blends.** A
  paper-tear from the pack (ProRes with a yellow/red NLE matte — extract with
  `a='if(gt(g,120)*lt(b,120),0,255)'`, repaint the red) runs 11 frames in + 10
  mirrored out = 0.7 s, and the cut between takes sits under the paper.
- **Film burns go on real location changes.** A reel shot against three
  backgrounds gets three burns — at the cuts where the background changes,
  nowhere else.
- **Grain:** a native-H.264 grain clip from the pack in `screen` at ~0.22 costs
  ~40 % render time. Rotate it if the source is landscape.
- A CSS `blur()` that decays gives slam weight to a card. `<Trail>` from the
  motion-blur package renders each ghost as an `AbsoluteFill` and tears the
  element out of any flex row — don't use it inside a layout.

---

## 16. The audio chain (new)

**Raw voice by default.** A profiled spectral denoise was applied to one reel
without being asked, and the speaker heard it on the first listen: "the audio
is weird, did you isolate voice?". A decent mic's floor (−50 dB vs speech at
−30) costs less than the artefacts of removing it.

Default chain, per take, inside `assemble.py`:

1. raw voice
2. gain-match to a **−22 dB mean** in the file (80 % of the difference between
   takes, so floors stay within ~4 dB of each other)
3. 10 ms fades at every cut
4. `alimiter` for safety only

> ⚠️ **The mono→stereo upmix costs 3 dB.** `aformat` from mono to stereo drops
> the mean by ~3 dB, so set the pre-upmix target 3 dB higher than the number
> you want to measure in the final file.

**Denoise is opt-in** (`assemble.py --denoise`), for a shoot that is genuinely
noisy (a terrace, a coworking) — and say so when you use it. The chain that
passed a very picky ear, after eight that didn't:

- `highpass=f=60:poles=1`
- `afftdn nr=10..14 nf=-50 nt=w om=o` with a **sampled profile**: prepend
  1.3 s of room tone from the shoot to every clip (`asendcmd sn start/stop`),
  trim it off after, compensate ~1.305 s including the filter's latency.
- per-take gain match as above, `acompressor thr −16dB 1.6:1`, `alimiter 0.75`.

Result: voice bands 100 Hz–16 kHz within −0.5 dB, floor down 9–11 dB, takes at
−22 ±0.6 dB, no click at any of 28 cuts. Reduction saturates around 11 dB
whatever you set; don't chase deeper. Rejected, with the measured reason:
`nf=-42` (clamps the floor estimate, eats 4–5 dB of 100–250 Hz — thin voice);
`acrossover` + denoise the high band only (82-sample lag → comb filtering);
RNNoise (−2…−3 dB presence even at partial mix); `tn=1` tracking (−2…−3 dB at
2–8 kHz).

---

## 17. Gotchas that cost real time

Code:

- **TypeScript must stay on 5.x.** (§4)
- **Load fonts inside a component.** Stills pass, renders fail. (§6)
- **`useCurrentFrame()` inside a `<Sequence>` restarts at 0.** A component with
  absolute times mounted inside a Sequence sits at opacity 0 forever. Either use
  local times, or mount without a Sequence and switch yourself off outside
  your window.
- **`mixBlendMode` belongs on the container, not the inner video.** An
  `AbsoluteFill` with a `zIndex` forms its own stacking context, so a blend
  mode on the child composites against that empty context and renders fully
  **opaque** — a screen-blended flash transition came out as a solid blue frame
  over the cut.
- **`OffthreadVideo` has no `loop`** and ignores alpha in transparent mode
  (§14.3). Your `Footage` wrapper should call `staticFile()` itself — pass it
  a relative path, not a resolved URL.
- **Two colour slots, not one.** (§6)
- **Symlinks in `public/` 404 in the render.** (§3)

Edit:

- **Whisper hides restarts** in words longer than 0.9 s. (§8.6)
- **`silencedetect` at −30 dB eats consonants** and Whisper's word ends run
  long; segment edges come from the 50 ms RMS curve. (§8.7)
- **Clamp caption block ends** and fix seam timings by hand. (§9)
- **Never mute captions.** (§9)
- **A cross-fade between two framings of the same person ghosts.** It looks like
  a double exposure, not a transition. Move the footage instead of dissolving
  between two copies of it.
- **Never show two copies of the same person on screen at once.** If a layout
  reframes someone into a band, make sure the original isn't still visible
  above it.
- **Test files with production names get picked up.** A rejected denoise
  experiment saved as `c4577.wav` in the output folder shipped once. Name
  experiments `test-*`.

Machine:

- **A killed render leaves an ffmpeg child writing the MP4.** Re-rendering to
  the *same path* produced a file with two writers: `ffprobe` said OK, the
  video had 898 invalid NALs and the audio sat at −91 dB. After killing a
  render: `pkill -9 -f chrome-headless-shell`, `pgrep -fl ffmpeg` until nothing
  is left, and render to a **new filename**.
- **A full disk costs you a day.** With three reels of 4K proxies in
  `public/`, the disk filled mid-build and the >100 MB proxies had to be
  deleted to keep working; they are regenerated from the originals on demand
  now. Check `df -h` before a 4K job, keep masters on the card, and make the
  assembly script able to rebuild any proxy it can't find.

---

## 18. Rendering on a small machine

Measured times for a ~45s reel on an 8 GB M1:

| | |
|---|---|
| cards + captions only | ~4 min |
| with a grain overlay, machine idle | ~5.5 min |
| with grain, while the Studio is also open | ~12 min |
| 4K source, machine deep in swap | ~22 min |

Grain costs about 40% — it's a second video decoded and composited every frame.
**Contention costs far more than the grain does**, so close the Studio before
rendering and don't shoot stills during one. Render from a 1080p proxy of a 4K
master; the assembled `video.mp4` is already 1080×1920, the 4K only matters for
the assembly step.

When a render is inexplicably slow, **check swap before touching the code**:

```bash
sysctl -n vm.swapusage
pgrep -f chrome-headless-shell | wc -l
```

A swapping render doesn't fail gracefully — it dies with
`Timeout (30000ms) exceeded rendering the component at frame N` after burning
fifteen minutes. Re-run with the pressure turned down instead:

```bash
npx remotion render my-reel out/reel-v4.mp4 --concurrency=2 --timeout=120000
```

**`pkill -f "remotion render"` orphans its Chrome children** (and its ffmpeg —
§17). Always sweep:

```bash
pkill -9 -f chrome-headless-shell
```

Quote real render times, don't estimate them — wrap the command in
`START=$(date +%s)` … and report the actual number.

If someone is waiting on a *look* rather than a deliverable, send stills
(seconds each) or open `npm run studio` — kill and restart rather than finishing
a render you already know is superseded.

---

## 19. Final QC — watch the whole thing before exporting

Not stills. The finished video, start to finish. Stills cannot show you a bad
cut, an audio jump, or a zoom fighting the speech.

- [ ] no mistakes, false starts or repeated lines left in (the last attempt wins)
- [ ] no dead silences — run `silencedetect` on the **render**, not the plan
- [ ] sentences continue correctly across joins, no word tails eaten
- [ ] cuts sound natural, no audible level jumps
- [ ] the strongest takes were chosen (not automatically the last one)
- [ ] every zoom relates to what's said or shown
- [ ] demonstrations stay fully in frame, and stay brief
- [ ] transitions feel intentional, not decorative
- [ ] music fits and never covers speech
- [ ] captions run from first word to last, accurate, timed, **spell-checked**
- [ ] the CTA keyword is the strongest thing on screen and spelled right
- [ ] everything readable sits inside y 432–1430 (shoot the `-ig` still)
- [ ] nothing important hidden behind a graphic (faces especially)
- [ ] the speaker is on screen; nothing shrank them to make room for a card
- [ ] one subject on screen at a time — no accidental duplicates
- [ ] it feels cohesive, not assembled from random clips

Verify the exported file, not the preview:

```bash
ffprobe -v error -count_frames -select_streams v:0 \
  -show_entries stream=nb_read_frames,width,height -of default=noprint_wrappers=1 out/reel.mp4
ffmpeg -v error -i out/reel.mp4 -f null -      # silence here = no decode errors
ffmpeg -i out/reel.mp4 -af "silencedetect=noise=-35dB:d=0.4" -f null -   # no dead air
ffmpeg -i out/reel.mp4 -af volumedetect -f null -                        # voice mean where you set it
```

Keep those four lines in a `qc.py` in the reel folder so they run the same way
every time.

---

## 20. Checklist to hand your editor, every single video

Copy this into your message when you send footage.

```
VIDEO: [name]

1. SCRIPT (word-for-word, as written before filming)     ← REQUIRED
2. CTA keyword, spelled exactly as it goes on screen
3. Proper nouns / product names / technical terms
4. All footage: main takes, retakes, b-roll, screenshots — including the
   ones you think are bad (the editor decides which attempt is the last)
5. Which clip is which, if the filenames don't say
6. Any asset that must appear (screenshot, client clip, logo, client photo)
7. Anything you know is wrong in a take, so it gets cut
8. Music: yes/no, and a track if you have one in mind
9. Any fact you said on camera that you want kept as said
```

And for whoever is **filming**:

```
- top of head at ~30% of frame height, chin at ~62%
- leave the top 22% and the bottom 25% empty of anything that matters
- if you restart a line, just say it again — don't stop recording
- hold half a second of silence before and after each take
```

Without item 1, captions will contain confident, plausible errors — and the
word most likely to be wrong is the one your call to action depends on.

---

## Changelog

**v2 — 2 Sep 2026.** Multi-take assembly with `assemble.py`, `TAKELIST.md`
and the restart-hunting rules (§8.6–8.8). Captions always on; the two v1
"suppress captions" rules withdrawn (§9). Measured Instagram UI boxes + the
420 px grid, `ig-safe.ts` and the `-ig` composition (§8.9). Framing target for
the shoot. Raw-voice default and the opt-in denoise chain with its rejected
alternatives (§16). Brand modules per client (§6). Supporting visuals: b-roll
inserts, AI panels, matted keywords (§14). Pack transitions: light-leak limits,
cover transitions for bright shots (§15). "Whoosh on the cut" and the two SFX
level bands (§10). Camera: subject stays on screen, cards where they gesture,
zoom limits from framing (§12). Gotchas doubled (§17): Sequence/useCurrentFrame,
symlinks in public/, killed-render corruption, 4K rotation metadata, caption
seams. QC now includes silence and level checks on the render (§19).

**v1 — 5 Aug 2026.** Single-clip pipeline, script rule, brand tokens, cards
and captions, sound design by measurement, music, camera moves, wash, render
limits.
