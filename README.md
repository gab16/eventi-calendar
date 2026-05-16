# Eventi — Community Event Calendar

Public event calendar powered by Airtable. Deployed on Vercel.

## Setup

1. Push this repo to GitHub
2. Connect to Vercel
3. Add environment variable: `AIRTABLE_PAT` = your Airtable Personal Access Token
4. Deploy

## Structure

```
public/index.html   → Frontend (React via CDN)
api/events.js       → Serverless function (Airtable proxy)
vercel.json         → Routing config
```

## Airtable Requirements

Your table needs these fields:
- `status` (Single Select: pending, approved, rejected)
- `event_name`, `date_start`, `date_end`, `time_start`
- `location_name`, `address`, `category`, `organizer`
- `price`, `description`, `language`, `phone`
- `is_sponsored` (Checkbox)
