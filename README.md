# Rotom Dex

A portrait Expo / React Native app using the supplied local artwork and media.

## Run

```sh
npm install
npm start
```

Scan Metro's QR code with Expo Go compatible with SDK 58. Keep the phone and computer on the same Wi-Fi network. `npm start` runs both Metro and a small local photo server on port 8787. Use the npm scripts so the app receives the photo server address and access token automatically.

The screen starts black for at least 450ms while media loads, plays `assets/rotom-wake-inner-grid-1s.mp4` once with `assets/rotom_opening.mp3`, then shows `assets/rotom-opened-still.png` with the live back camera inside the grid. Expo Image's `useImage` hook decodes the still once and shares the ready bitmap between the intro and camera layers. Neither layer waits for an image view's load callback, which Android can skip for cached bitmaps. Startup also checks the players' current native readiness while waiting, so an event emitted before React subscribes cannot strand the black screen. The camera frame is mounted underneath in advance. At the end, the opening layer crossfades for 220ms over the prepared frame; its video surface stays mounted until that fade finishes. The still then fades through to the live camera. The face, bezel, and cyan accent stay in front of the camera. The sound can finish over the still after the one-second video ends. There are no wake or camera explanation buttons: camera access is requested automatically through the operating system after the intro.

## Capture and storage

Hold the Poké Ball to darken it and dim the scene immediately. Release to capture: the ball spins while darkened, `assets/rotom_pic_taken_camera.mp3` plays, a white flash and cyan pulse fire, and the Rotom frame expands beyond the screen. The frame returns once processing finishes. The captured image stays still and the camera is unmounted immediately after taking the photo; tap the Poké Ball again (Retake photo) to reopen the live viewfinder. The live preview is confined to the grid opening so it cannot show below the artwork. Releasing outside the button cancels the press without capturing. Reduced-motion settings keep gentle dimming and a softer flash, without spin or frame zoom.

Tap the smooth 2D vector Poké Ball at the bottom of the viewfinder to capture a full-quality photo. The computer saves the captured photo as an orientation-corrected PNG without the decorative frame, then sends a compressed copy to Terra. Terra directs the image generator to isolate the object and produce a realistic 3D object with googly eyes and a transparent background. Files are named with the UTC capture time, including milliseconds, for example:

```text
photos-store/2026-11-10T12-30-00.123Z.png
```

Processed PNGs and creature metadata appear in this project's `photos-store/` directory. Native apps also keep the returned source PNG in their Documents `photos-store/` directory. Raw captures are held only in a temporary cache for processing/retry and are removed from that cache after success. If processing fails or the computer cannot be reached, **Retry save** processes the same capture with its original timestamp. Existing photos from before this change are left untouched. On web, keep the page open until the upload succeeds; the pending capture is held in memory. The capture button waits while saving and remains disabled while a failed upload is pending, so that capture is not replaced.

Every newly generated Pokémon also gets a self-contained folder on the computer,
ready for a future Pokémon PC. Two captures of the same object get separate entries.
The capture's UTC timestamp is its stable folder ID:

```text
saved-pokedex-entries/2026-11-11T12-30-00.123Z/
  picture.png   # transparent generated Pokémon portrait
  capture.png   # original orientation-corrected camera photo
  cry.mp3       # a copy of this Pokémon's selected cry
  entry.json
```

`entry.json` has `schemaVersion: 1`, `id`, `capturedAt`, `savedAt`, the identified
`object`, `name`, `description`, `fieldNotes` (the description shown in the entry),
`category`, `element`, `types`, `heightCm`, `weightKg`, `measurementsEstimated`,
`eyebrow`, `style`, all six `stats`, and the selected `cry` ID. Its `files` map
contains paths relative to that folder; `source` records the original filenames,
and `generation` preserves the model, prompt and timing metadata. Missing size
estimates are `null`; the UI's fallback category and Normal type are saved when
those details are absent.

The server publishes the whole folder atomically before returning success.
Retries, concurrent uploads and server restarts reuse that entry, including its
original stats and cry. A failed archive write offers **Retry save** and reuses
the already generated artwork. Uncertain or unavailable recognitions save the
camera photo but do not create Pokémon entries. Existing photos are not imported
automatically. Entry folders are excluded from Git. Restart `npm start` after
updating the server code to enable this behavior in an already running session.

The server accepts authenticated JPEG uploads, normalizes orientation and preserves the full camera photo as a PNG before creating the creature artwork. Uploads are limited to 25MB, and an existing filename cannot be overwritten with a different result. Photos are excluded from Git. Set `PHOTO_STORE_HOST` before `npm start` if the computer has multiple network interfaces and its Wi-Fi address is not selected automatically.

## Pokédex entries

Capture follows this path: camera photo → compressed copy → GPT-5.6 Terra
type, rarity and text generation → artwork with the selected type’s aura → a mobile Pokédex entry. Terra runs with reasoning effort set to none.
The local background-removal package is not used. Type must be exactly one of
the 18 standard types; both the JSON schema and runtime enforce that list.
Rarity is common, rare, legendary or mythical, selected with the identity and
saved with the entry. Older entries without rarity display as common.
Height (cm) and weight (kg) are typical-object estimates, shown with ≈ rather
than presented as measurements from the photograph.

The image prompt requests a focused edit with a realistic 3D product finish,
preserving its shape, colours, materials and identifying details. The only
playful additions are a type-specific aura, oversized googly eyes and randomly selected eyebrows:
determined, worried, surprised, skeptical or delighted. There is no mouth,
cartoonification, scenery, typography or decorative frame. The generator must
return actual transparent alpha; opaque backgrounds are rejected. Both calls
identify the main object from the same camera photo. Artwork waits for the selected
type so Fire receives flames, Electric receives lightning, and all other types
receive their own matching aura. The object and aura stay within the transparent
canvas. Unclear subjects skip artwork; failures finish cleanup before the next capture. Separate description, portrait and total timings are saved in the metadata
under `generation.timingsMs` to diagnose slow generations.

Before each Codex call, image copies are resized to at most 512 pixels on the
longest edge and compressed as quality-80 JPEGs. The generated transparent
portrait is saved as a 1024×1024 PNG. Original source photos are preserved.

The entry display follows the blue/orange/cream handheld encyclopedia reference:
a striped specimen panel above an orange name header, category, type, rarity, estimated
height/weight and field notes. The top branding banner is removed. All information appears below the image, with a
scrollable body for smaller phones and long text. Rarity appears directly after Type
in a gray (common), light blue (rare), light yellow (legendary), or purple (mythical) badge. Scan another object stays
reachable in the footer. The Rotom frame, capture controls and loading effects
are hidden on success. After the captured image is rendered, it expands from
the viewfinder while four black bezel panels move outward and fade on the same
660 ms curve. Reduced motion uses a stationary fade. Capture then fades to black, the specimen and details fade in
in stages under a soft light bloom, and stars/confetti burst from both lower
corners. Retaking fades the entry out. Reduced motion uses gentle fades and
stationary stars. The caught sound plays once per reveal and stops on
retake or when the app becomes inactive.

The original photo is saved as `timestamp.png`, the transparent specimen as
`timestamp.creature.png`, and the entry metadata as `timestamp.creature.json`,
including the selected eyebrows, model and exact portrait prompt. Native apps
retain these results in their Documents photos-store directory too. Successful
entries are cached with style version `dex-v2`; older artwork is regenerated on
retry. Generation failure still saves the source photo and offers recovery.

The pink stats panel shows Health, Attack, Defense, Speed, Spl Defense, and Spl
Attack on a green hexagon with a blue stat polygon. Each stat is an independent
random integer from 70 through 140, generated by the local photo server's random
number generator when the capture is first archived. AI-supplied stat and cry
fields are ignored; no AI call or prompt supplies these values. The app uses the
saved stats and selected cry returned by the server, so they stay fixed through
retries and screen redraws and are included in the native app's saved creature
metadata. The chart uses a linear
0–140 scale: 70 is halfway along each spoke and 140 is its outer vertex.

Run `codex login` on the computer running the photo server. With ChatGPT login,
both steps use your Codex allowance; no separate API key is needed. Image
inference and generation require internet access. `CODEX_BIN` can point to a
different installed CLI executable. The phone must reach the computer.

Codex runs in isolated temporary folders with user configuration ignored,
read-only sandboxing, shell execution and subagents disabled. The description step
has a 90-second timeout and cannot call image generation. The artwork step enables
only the built-in image-generation feature and has a five-minute timeout. Uploads
wait up to seven minutes for both steps. The server validates the structured data,
requires a new image file in the generation output folder or temporary workspace,
and decodes the image before publishing it. The temporary input and result files
are cleaned after each step; generated source artwork remains in Codex's library.

Only authenticated requests can retrieve portraits. Concurrent retries share the
same in-flight generation, and completed retries reuse the saved entry without
spending another generation. Original uploaded photos are never overwritten.

## Saved Pokédex box

Tap **POKÉDEX** in the camera viewfinder, or the top-left **×** on a newly
registered entry. The `/pokedex` route reads the saved entry folders through the
authenticated local photo server. **BOX 01** has a mountain landscape
and miniature specimen portraits with small ground shadows and invisible slot boundaries. The box scrolls as the
collection grows beyond its initial 30 spaces; it does not hide later captures.
Sprites use 112×112 transparent thumbnails of the original AI artwork, with a
virtualized grid and image caching to keep mobile memory and network use small.

Tap an occupied tile to inspect its saved picture, type, estimated height/weight,
field notes and original six stats. **PLAY CRY** plays the MP3 in that entry's own
folder. The panel begins as a narrow horizontal rectangle, expands upward and
downward, then reveals its contents from the center toward both sides over about
1.5 seconds. `assets/menu-open-effect.mp3` plays once when each entry opens, and
when tapping **VIEW POKÉDEX** after capture or **VIEW SAVED POKÉDEX** from the new entry. The fixed
top-left **×** reverses the sequence over 1.5 seconds, scanning inward before
collapsing to a horizontal bar, then returns to the same box. Reduced motion uses a gentle
fade. The camera pauses while viewing the collection, and cry playback stops on
close or when the app goes into the background.

The collection has loading, empty and connection-error states, refresh and retry
actions, and a placeholder for unavailable pictures. Previously loaded entries stay
visible if a refresh fails. Existing captures outside `saved-pokedex-entries` are
not imported automatically. Keep `npm start` running on the computer to browse
the saved collection from a phone.

## Browser preview

```sh
npm run web
```

The intro and camera open automatically. Browsers can block audible autoplay; the animation and camera continue without displaying a wake button. Android and iOS use native audio playback. Browser camera access requires localhost or HTTPS. A desktop uses its available webcam; phones request the back camera.

## Checks

```sh
npm run typecheck
npm run lint
npx expo-doctor
npm run test:server
npm run test:stats
npm run test:background
npm run test:e2e
```

The tests use Chromium with a synthetic camera, verify automatic startup and audiovisual timing, capture an actual processed PNG into `photos-store`, and exercise permission denial, failed-upload retry, media recovery, filename validation, and overwrite protection. Test captures are removed afterward. Set `CHROMIUM_PATH` to override the default `/usr/bin/chromium` executable. Creature tests cover the description-to-artwork pipeline, Terra model selection, actual image-file decoding, CLI stdin/output handling, cached retries, authenticated portrait retrieval, full-screen entry display, sound playback, and failed portrait downloads. Physical-device verification is still needed for hardware camera behavior and native playback timing.

[Capture-button image source and attribution](assets/ATTRIBUTION.md).
