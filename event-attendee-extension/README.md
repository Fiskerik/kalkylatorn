# Event Attendee Extractor (Chrome Extension)

## What it does

- Extracts attendees from the current event page.
- Shows attendee name and title in the side panel.
- Lets you expand each attendee to view contact data if present.
- Supports local save, CSV export, and PDF export.
- Adds account login via Supabase and credit sync from `profiles`.

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `event-attendee-extension` folder.

## Usage

1. Open an event attendee page.
2. Click the extension icon to open the side panel.
3. Sign in with your account email/password.
4. Click **Extract attendees**.
5. Expand any attendee card to view contact details.
6. Use **Export CSV** to export up to 20 rows for free.
7. Buy credits from the pricing buttons to unlock full-list exports.

## Pricing behavior

- Free: CSV exports first 20 attendees.
- Full list (1 credit): $9.99
- 5 credits: $39.99
- 10 credits: $69.99

## Supabase setup

- URL is set to: `https://vhemqgjwjqgjqrnjhvm.supabase.co`
- Extension expects `supabaseAnonKey` in `chrome.storage.local`.
- Credits are fetched from `profiles` table fields:
  - `id`
  - `email`
  - `credits`
  - `has_unlimited`
  - `updated_at`

## Notes

- PDF export still requires paid access when attendee count exceeds 20.
- Debug logs are available in the page console and extension console.
