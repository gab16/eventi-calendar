# Kalendarr — Architecture & Sprint Reference
*June 2026*

---

## Target Architecture

```
kalendarr.com (Cloudflare Pages)
      ↓
Cloudflare Workers (API proxy + auth logic)
      ↓
nocodb.tattionline.com (Cloudflare Tunnel → OrangePi)
      ↓
NocoDB CE → PostgreSQL 16 (OrangePi 512GB NVMe)
```

---

## Stack Decisions

| Component | Status | Notes |
|---|---|---|
| OrangePi 5+ 16GB | KEEP | Primary server, all Docker services |
| Cloudflare (free) | KEEP | Tunnel, DNS, DDoS, SSL |
| kalendarr.com at IONOS | KEEP (registrar only) | DNS moves to Cloudflare |
| PostgreSQL 16 | NEW | Replaces Airtable, unlimited records/API calls |
| NocoDB CE | NEW | API + admin UI over Postgres, via CF Tunnel |
| Flowise | KEEP | Already running on OrangePi |
| IONOS shared hosting | REPLACE → Cloudflare Workers | Cancel once migrated |
| Airtable | REPLACE → PostgreSQL | Hit API limits |
| Vercel (frontend) | REPLACE → Cloudflare Pages | Consolidate into CF ecosystem |

### Backup Strategy
- DS218+ (SSD, offsite) via Synology Hyper Backup → Backblaze B2
- OrangePi nightly pg_dump via cron

### Capacity
- Target: 100 users, 100k records — well within limits
- Real bottleneck: 35Mbps 5G upload (~200-300 concurrent users)
- Cloudflare caching reduces origin hits by ~70-80%

---

## Sprint Tickets

### CAL-110 — Deploy PostgreSQL + NocoDB on OrangePi
**Type:** Infra  
**Status:** In Progress

**Tasks:**
- Add postgres:16 and nocodb:latest to docker-compose.yml alongside Flowise
- Configure NC_DB connection string to Postgres kalendarr database
- Add nocodb.tattionline.com to Cloudflare tunnel config (port 8080)
- Add CNAME DNS record in Cloudflare dashboard
- Verify NocoDB UI accessible at nocodb.tattionline.com

---

### CAL-111 — Migrate Airtable events to NocoDB/PostgreSQL
**Type:** Migration  
**Status:** To Do

**Tasks:**
- Export events from Airtable base appjmCsXtF4V9wmmt / tblhaBmXjcrE8U8ku
- Import into NocoDB using built-in Airtable import tool
- Verify record count and field mapping post-import
- Create Users table: id, username, password_hash, display_name
- Create Likes table: id, user_id (FK), event_id (FK), liked_at
- Update api.php endpoint URLs to NocoDB REST API

---

### CAL-112 — Region filter for public event browsing
**Type:** Feature  
**Status:** To Do

**Tasks:**
- Add Region dropdown to frontend (Maremma / Zurich / New York)
- Pass selected region as filterByFormula to NocoDB API
- Persist last selected region in localStorage
- Default to first region on fresh load

---

### CAL-113 — User login + likes for beta testers (10 users)
**Type:** Feature  
**Status:** To Do

**Tasks:**
- Login screen on app load — password prompt matched against Users table
- Store userId in sessionStorage on successful auth
- Like/unlike button on each event card
- Write like/unlike to Likes table via api.php
- My Calendar toggle — filters to liked events for current user
- Seed 10 test users: Poggio!0 through Poggio!9

---

## DNS / Domain Migrations (separate task)
- Move kalendarr.com nameservers from IONOS → Cloudflare
- Add nocodb.tattionline.com CNAME in Cloudflare → tunnel ID
- Eventually move frontend from Vercel → Cloudflare Pages
