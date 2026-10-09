# CV

Resume page with experience, skills and contacts, downloadable as a PDF rendered in the browser.

Live: [https://frozik.github.io/portfolio](https://frozik.github.io/portfolio) · Part of the [portfolio](../../../../../README.md) monorepo; code lives in `apps/portfolio/src/features/welcome/`.

Resume page with work experience, skills, education, and contacts.
Available in PDF format for download.

## The sky over my clock

The hero bar shows the author's own time: "my time 01:45 · UTC+3". Hover it, or tap it on a phone, and a round watch opens. It has no words on it; everything it says is in its accessible label.

- **The dial.** A twelve-hour face with numerals on the bezel, minute ticks, and two thick sword hands with lume. A thin seconds hand carries a ring near its tip and a counterweight.
- **The Sun and the Moon** cross an arc over the mountains, each between its own real rise and set. They come up from behind the left ridge, pass over the summit and sink behind the right one; a daytime Moon shares the sky with the Sun, and a moonless night has only stars.
  - The Sun glows: a white-hot core, a corona and a wide halo, red near the horizon and white high up.
  - The Moon is cold. Its disc darkens towards the limb and carries the maria and bright craters as seen from the ground, Tycho's rays included. It shows its real phase, and its unlit part keeps a faint earthshine at night but lets the daytime sky through.
- **The mountains.** Each face is lit from the real position of the Sun and the Moon, by one rule for both. The sky is computed for the city that names the clock's time zone, as a stand-in, not as the author's whereabouts:
  - Low over the horizon a body lights only the summits; the higher it climbs, the further its light slides down the faces, until the whole massif is lit.
  - Faces turned towards it catch the most.
  - Sunlight brings the rose and orange alpenglow at dawn and dusk. Moonlight is a cold blue, as strong as the phase, and stars come out as the twilight ends.
- **The next event.** It appears at six o'clock as a half Sun on the horizon, with an arrow up for the sunrise or down for the sunset, and the time beside it.

Everything is computed in the browser by the repo's own astronomy (`@frozik/utils/astronomy`), with no requests. The watch is a lazily loaded chunk of about 9 KB gzipped that the landing page fetches only when the visitor reaches for the clock.

Where the code lives:
- `domain/sky-state.ts`: the Sun, the Moon, the arc and the next event.
- `presentation/components/hero/sky-dial/`: the SVG mountains, the light palette, the hands and the dial.
