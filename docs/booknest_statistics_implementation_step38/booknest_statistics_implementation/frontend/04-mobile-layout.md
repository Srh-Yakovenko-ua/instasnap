# Mobile Overview

Do not remove analytics; adapt presentation.

## Patterns

- KPI → 2×2 grid.
- Insights → horizontal swipe, card ~85–90% viewport.
- Discoveries → horizontal swipe.
- Records → horizontal swipe.
- Rankings → Top 3 default + `Показати ще 2`.
- Series → compact summary + expand.
- Detail popovers → bottom sheets.

## Order

Header → Hero → KPI → Insights → Dynamics → Goal → Calendar →
`Ваші читацькі смаки` → Ratings → Genres → Authors → Publishers →
Languages → Discoveries → `Ваш прогрес` → Series →
Library Balance → Records.

Period controls may be sticky under the app header if that matches existing shell behavior.

Formats are not part of the guaranteed V1 mobile sequence. Render an optional Formats section only if the backend exposes a reliable actually-read-format capability; never reserve an empty placeholder.
