# City / Diocese switcher

Turn the site into one calendar per Catholic diocese: a searchable "Change your city" picker in the header, and every page (calendar, list, map, highlights, organizers) scoped to the selected diocese.

## What the user sees

- A diocese button in the header showing the current one, e.g. **Montréal**. Clicking it opens a search dialog: type "nash" → "Diocese of Nashville". Grouped by country and region (Canada: archdioceses / dioceses / Eastern; US: Regions I–XIV / Eastern).
- Picking one changes the page title to "The Catholic Calendar of Nashville", filters all events and organizers to that diocese, and re-centers the map on that diocese's city.
- The choice lives in the URL (`/catholic-calendar/d/nashville`, plus `/d/nashville/organizers`, `/d/nashville/highlights`) so each diocese is a shareable, indexable "site" with its own title, meta description and canonical tag. Legacy URLs keep working and default to the saved/last-used diocese (stored in the browser); first-time visitors are matched to the nearest diocese from their browser location if they allow it, otherwise Montréal.
- Empty dioceses show a friendly "No events yet in this diocese — be the first to submit one" state.

## How events and organizers get a diocese

- Every diocese in your list is seeded with its see city, province/state, country and coordinates.
- New events and organizer applications get a diocese automatically from their address (nearest diocese see, computed after geocoding), with a searchable diocese dropdown on the submit form and the organizer profile so a submitter can correct it.
- Existing events/organizers are backfilled the same way from their stored coordinates; anything without coordinates falls back to Montréal and can be reassigned.
- Admin dashboard gets a diocese column and an editable diocese field so you can fix any mis-assignment, plus a diocese filter on the moderation queue.

## Technical notes

- New table `public.dioceses` (id, slug, name_en, name_fr, rite, country, region, see_city, lat, lng) seeded from the supplied Canada + US lists including Eastern jurisdictions and military/personal ordinariates (national jurisdictions are listed but not geo-matched — they must be chosen manually).
- `calendar_events.diocese_id` and `organizer_profiles.diocese_id` (FK, nullable), exposed through the existing `calendar_events_public` / `organizer_profiles_public` views; public read GRANT + RLS select policy on `dioceses`.
- Nearest-diocese assignment runs in the existing `geocode-address` edge function (it already has coordinates) and in a one-off backfill migration.
- Frontend: `DioceseProvider` context + `useDiocese()` reading the `:dioceseSlug` route param with localStorage fallback; a `DiocesePicker` command-palette dialog (shadcn `Command`) in `CalendarLayout`. Queries in `CalendarHome`, `Highlights`, `Organizers` add `.eq("diocese_id", …)`.
- Map default center/zoom comes from the diocese coordinates; the existing address + radius filter stays and stacks on top.
- All new UI strings added to `en.json` / `fr.json`; diocese names carry a French label where one exists (Montréal, Québec, Sherbrooke, …).
- Sitemap generator emits one URL per diocese page.

## Not included

- Dioceses outside Canada and the US (structure supports adding them later).
- Automatic moving of your existing real events to other dioceses beyond the coordinate-based backfill.
