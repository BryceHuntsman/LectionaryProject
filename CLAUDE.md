# Working in this repository

Read `README.md` first — it has the architecture and, importantly, a list of
details in `sanctuary-stage.js` that look arbitrary but are each a bug fix.
Check that list before "simplifying" anything in the 3D stage.

## Environment

No build step, no bundler, no package manager. Files are loaded with plain
`<script src>` tags and the page opens directly in a browser.

Do not introduce a build step, a package.json, a framework, or TypeScript
without being asked. The no-install property is deliberate: the project's
purpose is to be openable and shareable by people who do not have a toolchain.

To run it, open `Lectionary Wheel.dc.html` in a browser. No server is required,
though a static server avoids any local-file restrictions:

```
python3 -m http.server
```

## Layout

- `lectionary-data.js` — calendar maths, reading citations, pagination. Pure
  data and dates; no rendering. Exposes `window.LectionaryModule`.
- `sanctuary-stage.js` — the `<sanctuary-stage>` custom element. three.js scene
  plus a canvas page renderer. Knows nothing about the lectionary; it renders
  whatever page descriptors it is given.
- `Lectionary Wheel.dc.html` — the page. Rose window as inline SVG, chrome, and
  the wiring between the data and the stage.
- `support.js` — generated runtime for the page's template. **Never edit it.**

Keep those boundaries. Calendar logic belongs in `lectionary-data.js`, scene and
page-drawing code in `sanctuary-stage.js`, and layout in the HTML file.

## Conventions

`sanctuary-stage.js` is deliberately plain ES5-style classic script — `var`,
`function`, no modules, no optional chaining. It is loaded directly by the
browser with no transpilation. Match the surrounding style.

`lectionary-data.js` uses modern syntax and is fine as-is.

Styling in the HTML file is inline `style` attributes rather than stylesheets.
That is a constraint of the page runtime, not a preference — follow it.

## Editing the page

`Lectionary Wheel.dc.html` is a template plus a logic class. Markup goes in the
template; anything computed goes in the logic class's `renderVals()`, which
returns the values the template reads by name. Template holes are plain dotted
lookups — `{{ year }}`, `{{ item.name }}` — never expressions. `{{ a + b }}`
fails silently.

## Reading data

Reading citations in `lectionary-data.js` are hand-entered and are the most
likely source of a factual error. Verify against
[bible.usccb.org/readings](https://bible.usccb.org/readings) before changing
one, and do not rewrite citations to match a different lectionary edition
without being asked.

Dates are computed from the Easter computus and are reliable. If a date looks
wrong, suspect the anchor declaration rather than the calendar maths.

## Testing

There is no test suite. Verify by opening the page and checking:

- The window draws, with today's marker in a plausible place.
- Clicking a jewel opens the book at that day.
- Pages turn cleanly in both directions — no text changing after the turn
  settles, no page sinking through the block, no stranded leaf.
- The camera orbits the full circle without the scene flipping over.
- Year navigation and the A · B · C overlay work.

The page-turn and camera behaviours are where regressions hide. Geometry claims
are worth checking numerically — arc length, the gap between the landing leaf
and the block, the angle between the view direction and vertical — rather than
by eye.
