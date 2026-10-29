# my-petkit — art direction v2 (taste pass)

Date: 2026-10-28. Replaces the visual layer of the first design pass (canvas "my-petkit UI design"). Screens, flows, risk tiers and copy facts stay; the look, hierarchy and data presentation change.

## 1. What was wrong with v1

Measured against the app-screen rules of `design-taste-frontend` (`references/app-screens.md` §13–14):

- Tracked uppercase mono labels everywhere ("NOW", "R2 · MOVES THE DEVICE", "MY-PETKIT · SELF-HOSTED"): the most common generated tell.
- Plex Mono on every value. Mono had no single job, so it read as costume.
- KPI tiles: four bordered boxes with 26px mono numbers, the template's four-up grid.
- A black "NOW" hero card: a landing-page device in a tool.
- Pale amber fills on every R2 button: colour spent on chrome, so the screen had no colour left for data.
- No product face: no mark, no pets as themselves, no element only this product has. It was a well-applied kit.
- A 44px landing-page headline on the design-system board.

## 2. Mobbin references (what we took)

| Reference | What we take |
|---|---|
| [Fi · Base detail](https://mobbin.com/screens/dc206d42-796a-48e5-be6f-2a1c2c476e55) | The device's state is one plain sentence ("Base is Online."), with the hue on the single word that matters. |
| [Fi · Timeline](https://mobbin.com/screens/0d729c16-cbed-499b-b555-5817bd3edaa4) | A day-grouped event list with a thin rail, time over a sentence that names the pet: "Miso used the litter box". |
| [Eight Sleep · Device settings](https://mobbin.com/screens/d1b47489-67fd-43fc-a436-8752cc7d57a3) | Grouped rows, value right in grey, and destructive actions as plain red text at the end of the list rather than red blocks. |
| [Oura · Ring details](https://mobbin.com/screens/dd7d147b-da86-4e94-99ca-226a7fa880bc) | One status line under the object ("Active · Charging"), actions as a quiet list. |
| [LARQ · PureVis](https://mobbin.com/screens/9bcb5d7d-fda0-4971-875b-3c8a5a8762ea) | Switch rows with a one-line explanation under the title. Used for device settings. |
| [MacroFactor · Food log](https://mobbin.com/screens/c1166e98-7441-4e29-8776-5e8d5b7d6d85) | Hours down the side and entries placed on them. Became the feeder schedule. |
| [Railway · Logs](https://mobbin.com/screens/7b2a7c2d-d2af-4473-a8fd-7a4436fd316a) and [Modal · App logs](https://mobbin.com/screens/1f2f0cd1-eadb-435f-9632-116b03a1fc22) | A volume strip over a dense mono table, and a 2px left edge in the level colour instead of coloured rows. |
| [Vercel · Logs](https://mobbin.com/screens/c1757ea2-d024-4dd4-9ef2-13b6a2575d54) | A filter rail on the left and a quiet "Live" toggle in the toolbar. |
| [Surfshark · Device details](https://mobbin.com/screens/47a0a6ff-0a48-4e38-9e37-4923d88c385e) | A list and detail side by side. Web Devices uses a list with a detail pane. |

Rejected:
- Dyson-style illustrated rooms and Whoop's dark product renders. We have no product photography, and a fake render is worse than none.
- Swarm and Finch-style emoji timelines.

## 3. Style dealt

- Source: `draw.mjs --app --kind devtools --style framed-sheet`, seed 1187991101.
- It was chosen over `achromatic-ledger` because this is a long-session tool with many tabs. The tinted L-frame gives the shell a face without colour on the chrome.
- No redraws.

**The move.** One tinted frame holds the sidebar and the 48px top bar, with no rule between them. The work sits on a white sheet inset 8px from the window's right and bottom edges, with a 1px edge, 16px corners and no shadow.

**On the phone the frame disappears.** The sheet becomes the screen, the tint stays on the top bar and the tab bar, and content sits on white.

## 4. The face (product identity)

- **The frame is tinted from the brand teal:** `--ground #f2f6f5`, one low-chroma step of hue 172.
- **The data hue is brand teal `#0f6e66`.** It goes on today's main series, the "now" line and the one selected state. It is never used on chrome.
- **Mono has one job:** IDs, firmware, MQTT topics, hex and log lines. Every other figure is IBM Plex Sans with tabular figures.
- **The mark is the litter-box drum:** a 20px circle (2px teal stroke) with its lower third filled, beside "my-petkit" at 15/600. It is drawn as inline SVG. It is not a letter in a black square.
- **The pets appear as themselves.**
  - Miso is the tabby. Asset `/_blob/38e9ae33b4e603f8aa6a989a45ef55a8`.
  - Mochi is the calico. Asset `/_blob/04acdb0fd9daefc6a525576e97df95d6`, using `object-position: 50% 20%`.
  - Photos are round 24–40px avatars on lists and square on Pets.
  - Each cat also has a pale identity tint, 120° apart:
    - Miso: bg `#e4edf8`, ink `#24548f`.
    - Mochi: bg `#f8eedb`, ink `#7a4f08`.
  - These tints mark identity only. They never appear in a chart legend.
- **The signature element is the household day strip.** It is a 24-hour axis (00–24) with one lane per subject.
  - **Miso and Mochi lanes:** each litter-box visit is a 3px × 16px tick in the cat's ink, and a hover shows the time, duration and weight.
  - **Feeder lane:** each meal is a filled 8px square when dispensed and an outlined square when scheduled.
  - **Fountain lane:** a pale teal band while reporting, then a 1px diagonal hatch from 06:10 for "no report".
  - **Now:** a 1px teal line at 14:47, with its time in ink at the top.
  - **Legend:** the marks themselves, scaled down.
  - **Where it appears:** web Devices (overview), web Timeline (large), and iOS Timeline (compact, scrolls sideways inside its own frame).
- **Words of the trade.** Use "Miso used the box · 2 min 40 s · 5.42 kg", "Dispensed 20 g", "No report since 06:10", "Waits for next heartbeat" and "Bags left". Never "Items" or "Records".

## 5. Tokens (both platforms)

```css
--ground:#f2f6f5;   /* frame: sidebar, top bar, iOS bars */
--surface:#ffffff;  /* sheet */
--raised:#f5f7f7;   /* inset panels, settings panels, tray */
--active:#e8eded;   /* nav active pill, pressed */
--border:#e3e8e7;   /* sheet edge, cards */
--rule:#eef1f1;     /* row rules */
--control:#cdd3d2;  /* input borders */
--text:#131416; --muted:#5d6262;
--accent:#0f6e66;   /* data hue + focus ring + the one selected state */
--chart-2:#2f70bb; --chart-3:#a86f0c;
--positive:#1e7b4f; --negative:#c4242a; --warning:#92400e;
--pill-positive:#dcfae5/#04250e; --pill-negative:#ffedea/#831c1e;
--pill-warning:#fffbeb/#92400e; --pill-neutral:#e8eded/#353736;
radius: sheet 16, card 8, control 6, pill 999, avatar 50%
space: gap 24 (web) / 16 (iOS); pad 24 / 16; row 48 (web) / 52 (iOS)
type: IBM Plex Sans 400/500/600; title 22 (web) / 24 (iOS); section 16/600;
      figure 28/400; body 14 (web) / 15 (iOS); small 12. Mono 12–13 for IDs only.
```

## 6. Component rules

- **Buttons.**
  - The primary is near-black `#131416` with white text, radius 6, 32px tall on web and 48px on iOS.
  - The secondary is white with a 1px `--control` border.
  - Each screen has at most one filled primary.
  - There is no accent fill on buttons.
- **Device commands (R2), like Clean, Pack waste and Dump litter.**
  - They are secondary buttons or list rows.
  - A 12px grey line under the group says "Each command asks before it runs".
  - The confirm sheet carries the risk. Its title is a question, its body says what moves, and the confirm button is near-black.
  - No amber fills.
- **Root and firmware actions (R3).**
  - They live on their own screen.
  - The title row has one 20px pill, "Step-up required", in the negative pill pair.
  - The warning is one paragraph in a `--raised` panel with one 16px red warning icon.
  - Only the final action button is red (`--negative` fill).
- **Status.**
  - An 8px dot plus words: "Online · MQTT" in positive, "Polling · heartbeat" in chart-2 blue, "Offline" in negative, "Unknown" grey with a hollow dot.
  - Status words are the only colour in a row.
  - Red appears once per object, on the failing fact.
- **KPIs.**
  - One divided container: cells split by 1px rules, a 12/500 grey label over a 28/400 value with a grey 14px unit.
  - No tiles, icons or sparklines.
- **Lists and tables.**
  - 12px grey sentence-case headers with no band, 1px `--rule` rows and no zebra striping.
  - Numbers right-aligned with tabular figures.
  - One status mark and one trailing action per row.
- **Banned:** tracked uppercase labels, eyebrows, gradients, shadows on resting things, glass, emoji, icons in tinted squares, index numbers, accent-coloured chrome, KPI tiles, and titles over 32px.

## 7. Sample data (shared by every screen)

Now is Tue 28 Oct 2026, 14:47 (Asia/Saigon). Server: `192.168.1.20:8443`, local TLS, cert pinned, version 2.1.0.

**Devices**

| Device | Model | ID | Firmware | Transport | Last report |
|---|---|---|---|---|---|
| Litter box | Purobot Ultra T6 | `100234567` | 1.2.86 | Online · MQTT | 12 s ago |
| Kitchen feeder | YumShare Dual-Hopper D4SH | `100198342` | 1.3.12 | Polling · heartbeat | 40 s ago |
| Water fountain | EverSweet Ultra AI W7H | `100155021` | 2.1.4 | Offline | No report since 06:10 (8 h 37 m) |
| Pura Air spray K3 | BLE accessory, relayed by litter box | — | — | — | No report · 2 d |

**Litter-box visits today**

| Cat | Time | Duration | Weight |
|---|---|---|---|
| Miso | 01:12 | 2 min 10 s | 5.41 kg |
| Mochi | 03:47 | 1 min 32 s | 3.87 kg |
| Miso | 08:31 | 2 min 40 s | 5.42 kg |
| Mochi | 11:05 | 1 min 50 s | 3.86 kg |
| Miso | 13:58 | 1 min 55 s | 5.43 kg |

- Totals: 5 visits, Miso 3 and Mochi 2.
- Auto cleans run 5 min after each exit: 01:19, 03:54, 08:39, 11:12, 14:05. The last clean was 14:05.

**Litter box state**

- Bags left 14. Litter level 62%. Bin "Not reported".
- Consumables: N60 deodorizer 3 days, N50 deodorant 19 days, desiccant 26 days.

**Feeder plan today**

| Time | Amount | Status |
|---|---|---|
| 07:00 | 20 g (2 × 10 g) | dispensed |
| 12:00 | 15 g | dispensed |
| 18:00 | 20 g (2 × 10 g) | scheduled |
| 22:00 | 10 g | scheduled |

- Dispensed 35 g of 65 g planned.

**Fountain**

- Last water level 40%. Filter 9 days left. Pump mode "Smart".

**Weights over 14 days**

- Miso: 5.38 → 5.42 kg.
- Mochi: 3.80 → 3.86 kg.

**Faces**

- Miso: 41 samples.
- Mochi: 28 samples.
- One unbound face ref: `ref 7f3a…`, seen 3 times.

**Findings**

- Overview finding: "Fountain has not reported since 06:10."
- Second finding: "N60 deodorizer runs out in 3 days."

## 8. Screen questions

| Screen | Question it answers first |
|---|---|
| Devices (web, iOS) | Is every device working right now, and does anything need me? |
| Litter box T6 | Is the box clean and ready, and what does it need next? |
| Timeline | What did each cat do today? |
| Live | Can I see the box right now? |
| Pets | Is each cat recognised? |
| Schedules | When is the next meal, and how much? |
| Logs | What is the server hearing right now? |
| Provision | Is the new device on my Wi-Fi yet? |
| Setup | How is my server set up, and what is risky? |
| Patchers / Capture | Am I sure, and can I undo it? |
| Pairing / Sign in | Is this my server? |

## 9. Picture credits

These are sample pet photos for the mockup. In the product they are the user's own pets.

- "Tabby cat with blue eyes-3336579" by AdinaVoicu, CC0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Tabby_cat_with_blue_eyes-3336579.jpg
- "White Cat with black patch" by Sree4707, CC BY-SA 4.0, via Wikimedia Commons: https://commons.wikimedia.org/wiki/File:White_Cat_with_black_patch.jpg. Credit is required. Replace it with your own photo before any public use.

## Unresolved questions

- Should the iOS title use the native 34pt large title (Apple convention) or the 24px from the style? This pass uses 24px.
- Dark mode is not drawn in this pass. Tokens can map to the `true-black-flat` style later.
