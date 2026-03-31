# Hosting Research: PostgreSQL + File Storage for 10xAccel LMS

**Target:** 5,000-10,000 users | ~30 tables | 50-200GB storage | Indian market
**Last updated:** March 2026 (verify pricing before purchasing)

---

## Table of Contents

1. [Database Hosting (Managed PostgreSQL)](#1-database-hosting-managed-postgresql)
2. [File/Object Storage](#2-fileobject-storage)
3. [Self-Hosted VPS Options](#3-self-hosted-vps-options)
4. [All-in-One Platforms](#4-all-in-one-platforms)
5. [Google Drive as File Storage — Analysis](#5-google-drive-as-file-storage)
6. [Cost Comparison Summary](#6-cost-comparison-summary)
7. [Final Recommendations](#7-final-recommendations)

---

## 1. Database Hosting (Managed PostgreSQL)

### Supabase

| Item | Details |
|------|---------|
| **Free Tier** | 500 MB database, 1 GB file storage, 50k monthly active users, 2 GB bandwidth |
| **Pro Plan** | $25/month — 8 GB database, 100 GB file storage, unlimited API requests |
| **Pricing Model** | Pay-as-you-grow beyond Pro limits; compute add-ons available |
| **Data Centers** | AWS-backed; Singapore is closest to India |

**Pros:**
- Generous free tier for development/testing
- Built-in auth, real-time, storage, and edge functions
- Row Level Security (RLS) built into PostgreSQL
- Dashboard with SQL editor and table viewer
- Auto-generated REST and GraphQL APIs

**Cons:**
- Free tier pauses after 1 week of inactivity
- Only 2 free projects allowed
- No Indian data center (Singapore is closest)
- Vendor lock-in if you use Supabase-specific features (auth, realtime)
- At 5-10k users with moderate queries, you will likely need Pro + compute add-on (~$50-75/month)

**Suitability for 5-10k users:** Good. Pro plan at $25/month + potential compute add-on ($25-50/month) handles this well. Total: ~$50-75/month.

---

### Neon

| Item | Details |
|------|---------|
| **Free Tier** | 0.5 GB storage, 1 project, 10 branches, auto-suspend after 5 min inactivity |
| **Launch Plan** | $19/month — 10 GB storage, 300 compute hours |
| **Scale Plan** | $69/month — 50 GB storage, 750 compute hours, read replicas |
| **Pricing Model** | Consumption-based (compute hours + storage) |

**Pros:**
- Serverless PostgreSQL — scales to zero (great cost savings for low-traffic periods)
- Database branching (great for development workflows)
- Auto-scaling compute
- Very fast cold starts (~500ms)
- Native PostgreSQL (no vendor lock-in on the DB itself)

**Cons:**
- No file storage included — need separate solution
- Cold starts may add latency after inactivity (free tier)
- Compute hours can be unpredictable in cost
- No Indian region (AWS us-east-1, eu-central-1, ap-southeast-1)
- Relatively new; smaller community than AWS RDS

**Suitability for 5-10k users:** Good for variable workloads. Scale plan ($69/month) is the sweet spot. Serverless model means you don't pay for idle time.

---

### Railway

| Item | Details |
|------|---------|
| **Free Tier** | $5 of free credits/month (trial); limited to 500 hours execution |
| **Pro Plan** | $20/month base + usage (typically $0.000463/min for compute, $0.25/GB storage) |
| **Pricing Model** | Usage-based; pay for what you consume |

**Pros:**
- Extremely easy deployment (connect GitHub repo, deploy)
- Can host both your Express server and PostgreSQL on the same platform
- Good developer experience with CLI and dashboard
- Automatic deployments from Git

**Cons:**
- Usage-based pricing can be unpredictable
- No Indian data center
- PostgreSQL is unmanaged (no auto-backups in free tier, limited monitoring)
- For 50-200GB storage, costs escalate significantly ($12.50-50/month just for storage)
- Less mature managed DB features compared to dedicated providers

**Suitability for 5-10k users:** Decent for hosting the app + DB together, but costs can spiral. Estimate ~$40-80/month for DB + app hosting.

---

### AWS RDS (PostgreSQL)

| Item | Details |
|------|---------|
| **Free Tier** | 12 months free: db.t3.micro (1 vCPU, 1 GB RAM), 20 GB SSD, 20 GB backup |
| **After Free Tier** | db.t3.micro: ~$12-15/month; db.t3.small: ~$25-30/month (Mumbai region) |
| **Storage** | $0.115/GB/month (gp3 SSD) in ap-south-1 (Mumbai) |
| **Pricing Model** | Instance-based + storage + I/O + data transfer |

**Pros:**
- Mumbai (ap-south-1) data center — lowest latency for Indian users
- Industry standard; battle-tested at scale
- Automated backups, point-in-time recovery, multi-AZ failover
- Extensive monitoring (CloudWatch)
- Can scale vertically (change instance size) with minimal downtime

**Cons:**
- Complex pricing (instance + storage + I/O + transfer + backup)
- AWS console is overwhelming for beginners
- No serverless option for standard RDS (Aurora Serverless exists but is more expensive)
- Must manage security groups, VPC, etc.
- Data transfer costs can add up

**Suitability for 5-10k users:** Excellent. db.t3.small or db.t3.medium in Mumbai region. Total: ~$25-50/month for DB alone.

---

### DigitalOcean Managed Database

| Item | Details |
|------|---------|
| **Free Tier** | None |
| **Basic Plan** | $15/month — 1 vCPU, 1 GB RAM, 10 GB SSD, single node |
| **Standard Plan** | $30/month — 1 vCPU, 2 GB RAM, 25 GB SSD, single node |
| **Pricing Model** | Fixed monthly per plan; Bangalore (BLR1) region available |

**Pros:**
- Bangalore data center (BLR1) — excellent for Indian users
- Simple, predictable pricing
- Managed backups (7-day retention), auto-failover on higher plans
- Easy to set up (much simpler than AWS)
- Includes connection pooling

**Cons:**
- No free tier
- $15/month minimum is higher than self-hosted
- 10 GB storage on basic plan is tight for growing LMS
- Scaling requires migration to a larger plan (with downtime)
- Limited monitoring compared to AWS

**Suitability for 5-10k users:** Very good. The $30/month plan (25 GB) or $50/month plan (38 GB) works well. Bangalore data center is a major advantage.

---

### Aiven

| Item | Details |
|------|---------|
| **Free Tier** | Hobbyist plan: 1 vCPU, 1 GB RAM, limited to single cloud/region |
| **Startup Plan** | ~$19/month — basic managed PostgreSQL |
| **Business Plan** | ~$90+/month — HA, backups, fork/restore |
| **Pricing Model** | Plan-based; multiple cloud providers (AWS, GCP, Azure, DO) |

**Pros:**
- Multi-cloud (choose AWS Mumbai, GCP Mumbai, etc.)
- Good free tier for development
- Managed backups, metrics, and logs included
- Can run on different cloud providers

**Cons:**
- Higher cost than alternatives at scale
- Free tier is very limited (no backups, single node)
- Less popular, smaller community
- Dashboard is functional but not as polished

**Suitability for 5-10k users:** Workable but pricey. $90+/month for a production-ready setup.

---

## 2. File/Object Storage

### AWS S3

| Item | Details |
|------|---------|
| **Free Tier** | 12 months: 5 GB storage, 20k GET, 2k PUT requests |
| **Standard** | $0.023/GB/month (Mumbai: $0.025/GB) |
| **Data Transfer** | First 100 GB/month free, then $0.085/GB (Mumbai) |
| **Request Cost** | $0.005 per 1k PUT, $0.0004 per 1k GET |

**Pros:**
- Industry standard; massive ecosystem
- Mumbai region available
- 99.999999999% (11 nines) durability
- Pre-signed URLs for secure direct uploads
- Lifecycle policies (auto-archive old files)
- CDN integration with CloudFront

**Cons:**
- Complex pricing (storage + requests + transfer)
- Egress fees add up for video-heavy LMS
- Need to manage IAM policies
- 200 GB storage = ~$5/month, but data transfer for 10k users streaming videos could be $50-100+/month

**Cost estimate (200 GB, moderate traffic):** $5 storage + $20-80 transfer = **$25-85/month**

---

### Cloudflare R2

| Item | Details |
|------|---------|
| **Free Tier** | 10 GB storage, 1M Class A (write) ops, 10M Class B (read) ops/month |
| **Paid** | $0.015/GB/month storage |
| **Data Transfer** | FREE (zero egress fees!) |
| **Request Cost** | $4.50 per 1M Class A, $0.36 per 1M Class B |

**Pros:**
- ZERO egress/bandwidth fees — this is the killer feature for video-heavy LMS
- S3-compatible API (easy migration, works with existing S3 SDKs)
- Generous free tier (10 GB)
- Global network (Cloudflare edge)
- For 200 GB: only $3/month storage + minimal request costs

**Cons:**
- No Indian-specific region (but Cloudflare's global network handles this)
- Newer service; less mature than S3
- No lifecycle policies (as of mid-2025)
- No server-side encryption at rest by default (available but must configure)
- Limited analytics compared to S3

**Cost estimate (200 GB, moderate traffic):** $3 storage + $2-5 requests = **$5-8/month**

---

### DigitalOcean Spaces

| Item | Details |
|------|---------|
| **Free Tier** | None (2-month free trial with new accounts) |
| **Pricing** | $5/month — includes 250 GB storage + 1 TB outbound transfer |
| **Extra Storage** | $0.02/GB/month |
| **Extra Transfer** | $0.01/GB |
| **Regions** | Singapore (SGP1) closest to India |

**Pros:**
- Simple, predictable pricing: $5/month covers 250 GB + 1 TB transfer
- S3-compatible API
- Built-in CDN
- Pairs well with DigitalOcean droplets/managed DB
- Great value for storage-heavy applications

**Cons:**
- No Indian data center for Spaces (Singapore is closest)
- No free tier
- 1 TB transfer limit may be tight for video streaming to 10k users
- Less feature-rich than S3

**Cost estimate (200 GB, moderate traffic):** **$5/month** (within included limits)

---

### Backblaze B2

| Item | Details |
|------|---------|
| **Free Tier** | 10 GB storage, 1 GB/day download free |
| **Paid** | $0.006/GB/month storage |
| **Data Transfer** | Free with Cloudflare (Bandwidth Alliance), otherwise $0.01/GB |
| **Request Cost** | Free 2,500 daily; $0.004 per 10k Class B, $0.004 per 1k Class C |

**Pros:**
- Cheapest storage: 200 GB = $1.20/month
- Free egress when paired with Cloudflare CDN (Bandwidth Alliance)
- S3-compatible API
- 10 GB free tier

**Cons:**
- US and EU data centers only (high latency from India)
- Must pair with Cloudflare for free egress
- Slower than S3 for direct access
- Less mature API/SDK ecosystem

**Cost estimate (200 GB, via Cloudflare):** **$1.20/month** storage + free transfer = **$1.20-3/month**

---

### Supabase Storage

| Item | Details |
|------|---------|
| **Free Tier** | 1 GB storage, 2 GB bandwidth |
| **Pro Plan** | 100 GB storage included, 250 GB bandwidth (part of $25/month Supabase Pro) |
| **Extra Storage** | $0.021/GB/month |
| **Extra Bandwidth** | $0.09/GB |

**Pros:**
- Integrated with Supabase (auth, RLS on storage)
- Simple API for uploads/downloads
- If already using Supabase for DB, this is convenient

**Cons:**
- Tied to Supabase ecosystem
- Bandwidth costs can add up for video streaming ($0.09/GB is expensive)
- 100 GB included in Pro may not be enough
- 200 GB = $25 (Pro) + $2.10 extra storage, but bandwidth for videos could be $50+/month

**Cost estimate (200 GB, moderate traffic):** $25 base + $2 storage + $20-50 bandwidth = **$47-77/month**

---

### Google Cloud Storage (GCS)

| Item | Details |
|------|---------|
| **Free Tier** | 5 GB in us-east1/us-west1/us-central1 only |
| **Standard** | $0.020/GB/month (Mumbai) |
| **Data Transfer** | $0.12/GB (Asia) |

**Pros:**
- Mumbai region available
- Google's infrastructure and durability
- Good CDN integration (Cloud CDN)

**Cons:**
- Expensive egress ($0.12/GB for Asia is higher than AWS)
- Free tier limited to US regions
- Less common in tutorials/examples than S3

**Cost estimate (200 GB, moderate traffic):** $4 storage + $50-120 transfer = **$54-124/month**

---

## 3. Self-Hosted VPS Options

Run your own PostgreSQL + MinIO (S3-compatible object storage) on a VPS.

### Hetzner Cloud

| Item | Details |
|------|---------|
| **CX22** | 2 vCPU, 4 GB RAM, 40 GB SSD — EUR 3.99/month (~INR 370) |
| **CX32** | 4 vCPU, 8 GB RAM, 80 GB SSD — EUR 7.49/month (~INR 690) |
| **CX42** | 8 vCPU, 16 GB RAM, 160 GB SSD — EUR 14.99/month (~INR 1,385) |
| **Block Storage** | EUR 0.052/GB/month (200 GB = EUR 10.40/month = ~INR 960) |
| **Data Centers** | Germany (Falkenstein, Nuremberg), Finland, US, Singapore |

**Pros:**
- Incredible value — best price-to-performance ratio
- Singapore data center available (decent latency to India: ~50-80ms)
- 20 TB included traffic/month
- Block storage and snapshots available
- Can run PostgreSQL + MinIO + your Express app on one server

**Cons:**
- No Indian data center (Singapore closest)
- Self-managed: YOU handle backups, security, updates, monitoring
- No managed database option
- Support is basic (no 24/7 phone support)
- Need DevOps knowledge

**Total cost (CX32 + 200 GB block storage):** ~EUR 18/month = **~INR 1,650/month (~$21)**

---

### Contabo

| Item | Details |
|------|---------|
| **VPS S** | 4 vCPU, 8 GB RAM, 200 GB SSD — EUR 6.99/month (~INR 645) |
| **VPS M** | 6 vCPU, 16 GB RAM, 400 GB SSD — EUR 10.49/month (~INR 970) |
| **VPS L** | 8 vCPU, 30 GB RAM, 800 GB SSD — EUR 16.99/month (~INR 1,570) |
| **Object Storage** | 250 GB at $2.49/month |
| **Data Centers** | Germany, US, UK, Singapore, Japan, Australia |

**Pros:**
- Extremely cheap for the specs
- Massive storage included (200-800 GB SSD)
- Singapore data center available
- Contabo Object Storage is very affordable
- VPS M (400 GB) can handle PostgreSQL + MinIO + app easily

**Cons:**
- Network performance can be inconsistent (known for throttling)
- CPU is shared and can be noisy-neighbor
- Support response times are slow
- No Indian data center
- Uptime not as reliable as Hetzner/DO

**Total cost (VPS S with built-in 200 GB):** **~INR 645/month (~$7.50)**

---

### DigitalOcean Droplet

| Item | Details |
|------|---------|
| **Basic 2 vCPU** | 2 vCPU, 4 GB RAM, 80 GB SSD — $24/month |
| **Basic 4 vCPU** | 4 vCPU, 8 GB RAM, 160 GB SSD — $48/month |
| **Block Storage** | $0.10/GB/month (200 GB = $20/month) |
| **Data Centers** | Bangalore (BLR1) available! |

**Pros:**
- Bangalore data center — lowest latency for Indian users
- Excellent documentation and community
- Simple, predictable pricing
- Good monitoring dashboard
- Snapshots and backups available
- Can combine with DO Spaces ($5/month) for object storage

**Cons:**
- More expensive than Hetzner/Contabo
- Self-managed (but extensive documentation helps)
- Block storage at $0.10/GB is pricier

**Total cost (4 GB droplet + Spaces):** $24 + $5 = **$29/month (~INR 2,400)**

---

### Linode (Akamai Cloud)

| Item | Details |
|------|---------|
| **Linode 4GB** | 2 vCPU, 4 GB RAM, 80 GB SSD — $24/month |
| **Linode 8GB** | 4 vCPU, 8 GB RAM, 160 GB SSD — $48/month |
| **Object Storage** | $5/month for 250 GB + 1 TB transfer |
| **Data Centers** | Mumbai (IN) available! |

**Pros:**
- Mumbai data center — lowest latency for Indian users
- Object storage with 250 GB included at $5/month
- Akamai CDN integration
- Good documentation
- Free inbound traffic

**Cons:**
- Similar pricing to DigitalOcean
- Shared CPU plans may throttle under heavy load
- Less community content than DigitalOcean

**Total cost (4 GB + Object Storage):** $24 + $5 = **$29/month (~INR 2,400)**

---

### Vultr

| Item | Details |
|------|---------|
| **Cloud Compute 4GB** | 2 vCPU, 4 GB RAM, 100 GB SSD — $24/month |
| **Block Storage** | $1/GB/month (expensive!) |
| **Object Storage** | $5/month for 250 GB + 1 TB transfer |
| **Data Centers** | Mumbai (IN) and Delhi (IN) available! |

**Pros:**
- Mumbai AND Delhi data centers
- Competitive pricing on compute
- Object storage comparable to DO Spaces
- Good API

**Cons:**
- Block storage is expensive
- Smaller community than DigitalOcean
- Dashboard is less polished

**Total cost (4 GB + Object Storage):** $24 + $5 = **$29/month (~INR 2,400)**

---

## 4. All-in-One Platforms

### Supabase (DB + Auth + Storage + Edge Functions)

- **Cost:** $25/month Pro plan
- **Includes:** 8 GB DB, 100 GB file storage, auth, realtime, edge functions
- **Best for:** If you want to reduce backend code (Supabase can replace parts of your Express API)
- **Limitation:** Your Express server is separate; Supabase is primarily the data layer

### Railway (App + DB)

- **Cost:** ~$20/month base + usage
- **Includes:** Host Express app + PostgreSQL on same platform
- **No file storage:** Need external solution (pair with R2 or B2)

### Render

- **Cost:** Free tier (with limitations) or $7+/month per service
- **Includes:** Web service hosting + managed PostgreSQL
- **PostgreSQL:** Free tier: 90 days only, then deleted. Paid: $7/month for 256 MB RAM, 1 GB storage
- **Best for:** Simple deployment, but limited for 5-10k users

### Fly.io

- **Cost:** Free tier available; machines from $1.94/month
- **Includes:** App hosting + PostgreSQL (via Fly Postgres, which is self-managed on Fly VMs)
- **Storage:** Volume-based, $0.15/GB/month
- **Note:** Fly Postgres is NOT fully managed (you run PostgreSQL on their VMs)

---

## 5. Google Drive as File Storage

### Can Google Drive be used for file uploads in a web application?

**Short answer: Technically possible, but NOT recommended for production LMS.**

### How it would work:

1. Use Google Drive API v3
2. Create a service account or use OAuth 2.0
3. Upload files to a shared Drive folder
4. Generate shareable links for access
5. Use Google Picker API for user uploads

### Limitations and problems:

| Issue | Impact |
|-------|--------|
| **API Rate Limits** | 20,000 queries/day per project (Google Workspace), 1 billion queries/day (paid). For 10k users accessing files regularly, free tier will be exhausted quickly |
| **15 GB Free Storage** | Per Google account. Pathetically small for an LMS with videos |
| **Upload Size** | 5 TB max per file (fine), but API upload is slower than S3 |
| **No CDN** | Files served from Google's servers, no edge caching for global distribution |
| **Authentication Complexity** | OAuth flow is complex; service accounts have sharing limitations |
| **No Presigned URLs** | Cannot generate time-limited access URLs like S3. Links are either public or require Google auth |
| **Terms of Service** | Google Drive is designed for personal/business file storage, not as a backend for web applications. Using it as object storage may violate ToS |
| **Bandwidth** | Undocumented bandwidth limits; Google may throttle heavy downloads |
| **File Organization** | Folder-based, not key-value like S3. Managing thousands of files is cumbersome |
| **Reliability** | No SLA for Drive API availability; not designed for high-throughput access |
| **Cost at Scale** | Google Workspace Business Standard ($12/user/month for 2 TB) is NOT per-app, it's per human user |

### When Google Drive might be acceptable:

- Internal tool with <50 users
- Personal project / prototype
- Files are rarely accessed (archival use)
- You already have Google Workspace and want to leverage existing storage

### Verdict:

**Do not use Google Drive for your LMS.** Use S3-compatible object storage (Cloudflare R2, DigitalOcean Spaces, or Backblaze B2). The cost is lower, performance is better, the API is simpler, and you get proper CDN support.

---

## 6. Cost Comparison Summary

### Option A: Managed Services (Easiest)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| Database | Supabase Pro | $25 |
| File Storage | Cloudflare R2 (200 GB) | $5-8 |
| App Hosting | Railway / Render / Vercel | $7-20 |
| **Total** | | **$37-53/month (~INR 3,000-4,400)** |

### Option B: DigitalOcean Ecosystem (Balanced)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| Database | DO Managed PostgreSQL (Bangalore) | $15-30 |
| File Storage | DO Spaces | $5 |
| App Hosting | DO Droplet (Basic) | $12-24 |
| **Total** | | **$32-59/month (~INR 2,600-4,900)** |

### Option C: Self-Hosted Budget (Cheapest)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| VPS (DB + App + MinIO) | Hetzner CX32 (Singapore) | EUR 7.49 (~$8) |
| Extra Block Storage (200 GB) | Hetzner | EUR 10.40 (~$11) |
| CDN | Cloudflare Free | $0 |
| **Total** | | **~$19/month (~INR 1,600)** |

### Option D: Indian Data Center Priority (Lowest Latency)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| VPS | DigitalOcean/Vultr (Mumbai/Bangalore) 4 GB | $24 |
| File Storage | Cloudflare R2 + Cloudflare CDN | $5-8 |
| **Total** | | **$29-32/month (~INR 2,400-2,650)** |

### Option E: Ultra-Budget (Minimum Viable)

| Component | Service | Monthly Cost |
|-----------|---------|-------------|
| VPS | Contabo VPS S (Singapore) | EUR 6.99 (~$7.50) |
| File Storage | Backblaze B2 + Cloudflare CDN | $1.20 |
| **Total** | | **~$8.70/month (~INR 720)** |

---

## 7. Final Recommendations

### Best Overall (Recommended): Option D — Indian VPS + Cloudflare R2

**Setup:** DigitalOcean Droplet (4 GB, Bangalore) + Cloudflare R2 + Cloudflare CDN

- **Cost:** ~INR 2,400-2,650/month ($29-32)
- **Why:** Indian data center gives best latency for your users. R2's zero egress makes video/PDF delivery affordable. You have full control.
- **Run:** PostgreSQL + Express server on the Droplet; store files in R2; use Cloudflare CDN in front.
- **Scaling path:** Upgrade Droplet when needed, or split DB to managed PostgreSQL later.

### Best for Simplicity: Option A — Supabase + R2

**Setup:** Supabase Pro (database) + Cloudflare R2 (files) + Vercel/Railway (app)

- **Cost:** ~INR 3,000-4,400/month ($37-53)
- **Why:** Least DevOps overhead. Supabase handles DB backups, monitoring, scaling. R2 handles files cheaply. Focus on building features.
- **Trade-off:** Slightly higher cost, Singapore-region DB (not India).

### Best for Tight Budget: Option E — Contabo + Backblaze B2

**Setup:** Contabo VPS S (Singapore) + Backblaze B2 + Cloudflare CDN

- **Cost:** ~INR 720/month ($8.70)
- **Why:** Absurdly cheap. 4 vCPU, 8 GB RAM, 200 GB SSD can handle 5-10k users if optimized.
- **Trade-off:** Contabo's network can be flaky; no Indian DC; you manage everything yourself.

### What I would personally recommend for 10xAccel:

**Start with Option D, evolve to Option B as you grow:**

1. **Phase 1 (0-5k users):** DigitalOcean 4 GB Droplet (Bangalore, $24) + Cloudflare R2 ($5) = **$29/month**
   - Run PostgreSQL + Express on the same Droplet
   - Use `pg_dump` cron for daily backups to R2
   - Set up Cloudflare CDN (free plan) in front

2. **Phase 2 (5k-10k users):** Split DB to DO Managed PostgreSQL ($30) + Droplet for app ($24) + R2 ($8) = **$62/month**
   - Move PostgreSQL to managed service for automatic backups, connection pooling
   - App server is now dedicated to Express

3. **Phase 3 (10k+ users):** Upgrade Droplet or move to multiple instances + load balancer

### Key takeaways:

- **Never use Google Drive** for production file storage in a web app
- **Cloudflare R2** is the best value for file storage (zero egress)
- **Indian data center** matters: DigitalOcean (Bangalore), Vultr (Mumbai/Delhi), Linode (Mumbai), or AWS (Mumbai)
- **Self-hosted PostgreSQL** on a VPS is viable at this scale and saves significant money
- **Avoid** GCS and Supabase Storage for video-heavy workloads (egress fees kill you)
- **Set up backups from day one** — `pg_dump` to object storage on a cron job

---

*Note: All prices are based on publicly available information as of early 2025. Verify current pricing on provider websites before making purchasing decisions. Currency conversions use approximate rates (1 USD ~ INR 83, 1 EUR ~ INR 92).*
