# The Lectionary Wheel

An interactive visualization of the Roman Catholic Sunday lectionary. The
liturgical year is drawn as a rose window; clicking a jewel in the glass opens
the Lectionary as a 3D book resting on a stone ambo.

Runs in any browser with no build step, no server, and no dependencies to
install. Open `Lectionary Wheel.dc.html` and it works.

## What it does

- **Rose window.** One full turn of the wheel is one liturgical year. Season
  arcs are stained glass subdivided into per-Sunday leaded panels; twelve month
  petals sit in the stone tracery. Every Sunday and solemnity is a clickable
  jewel coloured by its liturgical colour. A gold hand marks today.
- **The book.** Clicking a jewel opens the Lectionary on the ambo at that day.
  Pages turn with a physical curl, the page block thickens on the left as you
  leaf through, and the antependium on the ambo changes to the day's liturgical
  colour.
- **Cycles.** Year A, B, and C. The wheel can overlay all three as concentric
  rings of jewels to compare them.
- **Year navigation.** Any liturgical year, computed rather than tabulated.

### Controls

| Action | Control |
| --- | --- |
| Open the book at a day | Click a jewel in the window |
| Turn the page | Click the left or right half of the book, the `‹` `›` buttons, or the arrow keys |
| Orbit the camera | Drag on the stage (full 360° around the ambo) |
| Zoom | Scroll on the stage |
| Reset the camera | Double-click the stage, or the RESET VIEW button |
| Change year | `‹` `›` beside the year, or TODAY |
| Compare cycles | The `A · B · C` button |

## Files

| File | Contents |
| --- | --- |
| `Lectionary Wheel.dc.html` | The page: rose window (inline SVG), chrome, and the logic that resolves a year and drives the stage |
| `sanctuary-stage.js` | `<sanctuary-stage>` — the three.js scene: ambo, book, page-turn animation, candles, camera, and the canvas page renderer |
| `lectionary-data.js` | Liturgical calendar maths, the reading citations, and pagination |
| `support.js` | Runtime that renders the page's template. Not hand-written; do not edit |

Everything is loaded with plain `<script src>` tags. There is no bundler, no
package.json, and no npm install. three.js is the one external dependency and
comes from a CDN at runtime.

## Architecture

Three layers, each independent of the ones above it.

**`lectionary-data.js`** is pure data and date maths, with no knowledge of how
anything is displayed. It exposes `window.LectionaryModule`:

- `LiturgicalCalendar` — Easter by the Meeus/Jones/Butcher computus, and every
  movable feast derived from it. Also season boundaries and
  `fractionOfYear(date, ly)`, which maps a date onto the wheel's 0–1 sweep.
- `LectionaryData` — the reading citations. Sundays of Advent, Lent, and Easter;
  all 32 weeks of Ordinary Time in each of the three cycles; and the
  solemnities and feasts. Anchored declaratively (`{type: "easterOffset", days: 7}`,
  `{type: "fixed", month: 12, day: 25}`) rather than as fixed dates, so any year
  resolves from the same table.
- `buildSlots(endYear)` — resolves those anchors against one liturgical year and
  returns the year's days in date order.
- `buildPages(slots, cycle, ly)` — paginates the days into page descriptors.
  Four pages per day: title, first reading + psalm, second reading, gospel.
  Each day is a self-contained pair of spreads that opens on the left, so a
  reader never opens onto the tail of the previous week.

**`sanctuary-stage.js`** is a `<sanctuary-stage>` custom element that knows
nothing about the lectionary — it renders whatever page descriptors it is
handed. Public API:

```js
stage.setPages(pages);    // page descriptors from buildPages()
stage.goTo(spread);       // animate to a spread; -1 closes the book
stage.turn(+1 | -1);      // one page forward or back
stage.setAccent(hex);     // liturgical colour of the antependium
stage.setMood(name);      // "Candlelight" | "Vespers" | "Feast Day"
stage.resetView();        // clear the user's orbit
```

It emits `stage-ready` when the scene is built, `spread-change` when the open
spread changes (`detail: {spread, day}`), and `stage-failed` if WebGL is
unavailable — the page falls back to plain text on that event.

**`Lectionary Wheel.dc.html`** wires the two together. It draws the rose window
as inline SVG from `fractionOfYear`, resolves the chosen year, hands the pages
to the stage, and maps jewel clicks onto `goTo`.

### Things worth knowing before you change them

Several details in the stage look arbitrary and are not. Each was a bug fix.

- **Pages are drawn to canvas, then used as textures.** Page rendering is gated
  on `document.fonts` being ready (`_fontsReady`). Drawing before the webfonts
  load rasterizes a page in a fallback font, and the later redraw re-wraps every
  line, which reads as the text changing after a turn.
- **The turning leaf is not a rotating plane.** `_bendLeaf` clamps the sheet at
  the spine, varies its tangent angle along its length, and integrates positions
  along that curve, so arc length is preserved exactly and the page cannot
  stretch. The curl is clamped so the far edge never bends past flat, which
  would sink the page through the block beneath it.
- **The leaf's pivot travels during a turn.** The left and right page stacks
  differ in height by up to the whole block, so the leaf descends from the stack
  it lifts off to the stack it lands on. Riding either one alone drops the page
  through the surface when the leaf is swapped out at the end.
- **Camera pitch stops short of vertical.** Past that point the view direction
  goes parallel to the up vector and `lookAt` flips the roll, turning the scene
  upside down. Azimuth is unbounded and takes the shortest path across the
  ±180° seam.
- **The desk tilts far-edge-high.** The page's head is at −z, so the slope must
  rise with the text; the retaining lip belongs at the foot of the slope.
- **`tracked()` forces left alignment while drawing.** It draws glyph by glyph,
  and callers often leave the canvas in `center` alignment, which would centre
  every letter on its own cursor position and space the run unevenly.
- **A turn interrupted by a hidden tab snaps home.** Otherwise a throttled
  `requestAnimationFrame` leaves the leaf stranded in mid-air.

## Reading data

Citations follow the general structure of the Roman Lectionary. They are a
reference, not an authority — cross-check against
[bible.usccb.org/readings](https://bible.usccb.org/readings).

Dates are computed, not tabulated, so any year resolves correctly. Reading
citations are hand-entered and are the more likely place to find an error.

## Sharing it

`Lectionary Wheel.dc.html` needs its sibling files, so it is not a single
portable file. To hand someone one file that works offline, everything can be
inlined into a standalone HTML document — three.js, the data, and the fonts all
embedded, around 520 KB. That build is not checked in.

## License

No license chosen yet. Add one before sharing publicly.
