# iOS design v3: Mobbin research and redesign

Date: 2026-10-29. Scope: the iOS app only. The web dashboard keeps art direction v2 (`design-261028-1447-my-petkit-taste-art-direction.md`).

## Outcome

The user asked for a mobile app that looks better than PetKit's and Catlink's apps, which are plain lists of devices and settings. v3 keeps v2's tokens, type and honesty rules, and adds what a consumer pet app needs: the cats as real photos, each device drawn so its state is visible at a glance, soft cards and pill controls, and a dark live view. All 14 iOS artboards are now drawn in v3: 12 redrawn and 2 new (feeder detail, paused litter box).

## What v2 got wrong on the phone

- It read as a server console: white rows split by rules, 20px avatars, figures in text.
- Nothing on Home showed a device; the user had to read the words "Litter box" to find it.
- Pets, the reason the user owns these devices, were small.
- Five tabs gave Logs and Settings the same weight as the cats.

## Mobbin references (what we took)

| Reference | What we took |
|---|---|
| [Fi · Home](https://mobbin.com/screens/0664355c-9bc5-4a8a-8b06-ea31593f8601) | The pet first, as a picture, with today's state underneath; soft white cards on a light ground |
| [Fi · Base detail](https://mobbin.com/screens/dc206d42-796a-48e5-be6f-2a1c2c476e55) | The device drawn large on a panel, its state as one sentence with the hue on the key word |
| [Oura · Ring details](https://mobbin.com/screens/dd7d147b-da86-4e94-99ca-226a7fa880bc) | Hero object, one status line, then quiet grouped actions; destructive action as red text last |
| [Google Home · Devices](https://mobbin.com/screens/2e24550f-ded1-432a-8da7-6470a509196d) | Devices as a two-column grid of cards rather than a list |
| [Meta Quest · Device](https://mobbin.com/screens/d2f52711-5793-472e-9ee0-0e21747aa467) | Device status at the top of the card, quick actions directly under the hero |
| [Withings · Weight](https://mobbin.com/screens/9ab952f7-dccf-44e9-ad50-fd83667ae174), [Alma · Weight](https://mobbin.com/screens/d5d1920d-5970-4437-92d8-e9097400bac1) | Big current value, change over the window in words, a range segmented control, one 2px line |
| [Tesla · Dashcam clips](https://mobbin.com/screens/039ce5a1-b503-4279-9679-65f18c7c938d) | Events with a video thumbnail beside the time and the sentence |
| [Tesla · Live camera](https://mobbin.com/screens/7b38ed5b-d445-4346-86ff-11a41dc3a1c1) | A fully dark live screen, video on top, large controls below |
| [Amazon Alexa · Device sheet](https://mobbin.com/screens/79c8bfe1-902d-4445-8f05-54970f2645f5) | Round quick controls with a label under each |

Rejected:
- BitePal, Finch and Abode: mascots and game art. A cat's health record is not a game.
- MyDyson and SmartThings: full-colour rooms and product renders. We have no product photography, and imitating PetKit's renders is not ours to do.
- Whoop and Eight Sleep: dark, tracked uppercase labels.

## What the artboards show

| Artboard | The question it answers | The move |
|---|---|---|
| `ios-devices` (Home) | Is everyone fine, and does anything need me? | One sentence names the problem; cats as photo tiles; devices as drawn cards whose drawing shows litter, food and water levels; day strip last |
| `ios-device-t6` | Is the box clean, and what next? | Large drum drawing; "Idle and clean." in green; one Clean now pill and four quick actions; 2×2 figures; live thumbnail; Automation with auto-pack (phase 13) |
| `ios-device-t6-paused` | Can I safely continue? | Bottom sheet listing the three checks the server makes, the warning in one sentence, then the action; matches the phase 13 guards |
| `ios-device-feeder` | When is the next meal, and is there food? | Hopper windows filled to their level; per-hopper portion steppers and Feed 20 g; today's meals; shortage alarm and skip-if-full in settings |
| `ios-schedules` | When is the next meal, and how much? | Meal cards on a now line, toggles per meal |
| `ios-timeline` | What did each cat do today? | Latest visit as a big video card, the rest as rows with clip thumbnails; cat filter chips with faces |
| `ios-pets` | Is each cat healthy and recognised? | Photo, weight line with 1W/2W/3M, visits per day bars, face photo grid, unbound face row |
| `ios-live` | Can I see and talk to the box? | Dark screen, Live and WebRTC pills on the video, stream switch with a one-line explanation, Hold to talk |

## Changes to the plan

- `design/design-reference.md` §7: tokens, components, relaxed rules and the iOS screen map for v3.
- `design/artboards/`: 14 iOS artboards (12 replaced, 2 new; Settings became the Server tab) and `canvas.json` (web row moved down to make room). Screenshots in `design/screenshots/`.
- `design/archive-v2/`: the previous iOS artboards, screenshots and reference.
- `design/tools/ios-v3/`: the generator that builds the artboards from bodies.
- `phase-08`: tab bar becomes Home, Timeline, Pets, Server; v3 artboards listed.

## Unresolved questions

- The live canvas artifact (claude.ai) still shows v2 for iOS. The local `design/` folder is now the source of truth for iOS.
- `my-petkit/docs/design/` (copied in phase 01) still holds v2. Copy v3 into it when phase 07 is merged, so the copy does not collide with the open web branch.
- Pets needs per-pet weight history and visits per day from the API; neither exists yet.
- Dark mode for iOS is still not drawn.
