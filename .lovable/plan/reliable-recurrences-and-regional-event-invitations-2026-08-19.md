# Reliable Recurrences and Regional Event Invitations

## What will change

- Put every invited multi-diocese, province/state-wide, and nationwide event before ordinary events within each calendar day and list section, while keeping chronological order within that priority.
- Add a verified-organizer audience option for **all dioceses in the event’s province/territory or state**. The form will derive the region from the selected host diocese, invite every real diocese in that region, and show a distinct province/territory-wide or state-wide badge in English, French, and Spanish.
- Keep broadcast visibility exact: invited events appear only on the host calendar plus explicitly invited dioceses/countries. The host map gets the location pin; other invited maps get the event only in the “Special events your diocese is invited to” panel.
- Make multi-diocese, regional, and nationwide badges visually distinct and ensure badge rendering uses the event’s actual audience type.

## Recurrence fix

- Replace the separate date-shifting paths with one shared occurrence generator used by both preview and saving.
- Preserve the original wall-clock time and the event’s true duration. A Wednesday–Friday event will remain Wednesday–Friday in every generated occurrence.
- Daily, weekly, and biweekly repeats will advance by exact day/week intervals.
- Monthly and yearly repeats will preserve the source weekday and ordinal week (for example, third Wednesday). If that ordinal weekday does not exist in a short month such as February, use that month’s last matching weekday rather than changing weekdays or overflowing into another month.
- Add an expanded recurrence preview to the form listing every upcoming start/end date and weekday before submission.
- Add focused automated tests for multi-day repeats, leap years, February, fifth-weekday fallback, month/year boundaries, and daylight-saving-safe local times.
- Correct the existing identifiable “Lets gooooooooo” recurring occurrence so its follow-up span uses the intended Wednesday–Friday pattern.

## Technical details

- Extend the event audience scope constraint with a regional scope; store the full invited diocese slug list in the existing audience list so current calendar queries remain efficient and explicit.
- Add region helpers derived from each diocese’s `City, XX` data and exclude synthetic combined-city entries from persisted invitations.
- Centralize audience eligibility, broadcast priority, map-pin eligibility, and badge selection helpers to prevent the calendar, list, mobile agenda, map, and invite panel from drifting apart.
- Update all EN/FR/ES labels and descriptions for the new audience choice, regional badges, and recurrence preview.
