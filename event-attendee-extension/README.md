# Event Attendee Extractor (Chrome Extension)

## What it does

- Extracts attendees from the current event page.
- Shows attendee name and title in the side panel.
- Lets you expand each attendee to view contact data if present.
- Supports local save, CSV export, and PDF export.

## Install (developer mode)

1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the `event-attendee-extension` folder.

## Usage

1. Open an event attendee page.
2. Click the extension icon to open the side panel.
3. Click **Extract attendees**.
4. Expand any attendee card to view contact details.
5. Use **Save locally**, **Export CSV**, or **Export PDF**.

## Notes

- Extraction depends on the current event page DOM.
- If contact details are not visible in the page, they cannot be extracted.
- Debug logs are available in the page console and extension console.
