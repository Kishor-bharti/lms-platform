# AWS Deployment Guide — 10xAccel LMS Platform

> Target audience: deploying a TypeScript/Express + React app on AWS for the first time,
> with budget constraints and ~200–300 users initially.

---

## Table of Contents

1. [AWS Free Tier & $200 Credits — Honest Breakdown](#1-aws-free-tier--200-credits--honest-breakdown)
2. [Architecture Overview](#2-architecture-overview)
3. [Code Changes Required (Supabase Storage → AWS S3)](#3-code-changes-required-supabase-storage--aws-s3)
4. [Step-by-Step Deployment](#4-step-by-step-deployment)
   - [4.1 AWS Account & IAM Setup](#41-aws-account--iam-setup)
   - [4.2 S3 Buckets (File Storage)](#42-s3-buckets-file-storage)
   - [4.3 RDS PostgreSQL Database](#43-rds-postgresql-database)
   - [4.4 EC2 Instance (Backend Server)](#44-ec2-instance-backend-server)
   - [4.5 S3 + CloudFront (Frontend)](#45-s3--cloudfront-frontend)
   - [4.6 Domain & HTTPS (Route 53 + ACM)](#46-domain--https-route-53--acm)
   - [4.7 Environment Variables & Final Config](#47-environment-variables--final-config)
5. [Cost Estimate](#5-cost-estimate)
6. [Ongoing Maintenance Tips](#6-ongoing-maintenance-tips)

---

## 1. AWS Free Tier & $200 Credits — Honest Breakdown

### The $200 Credit
- AWS gives **$200 in promotional credits** to new accounts (for startups via Activate or AWS Builder ID programs).
- These credits **expire after 1 year** or when exhausted, whichever comes first.
- Credits cover almost all services, so for your scale you likely won't spend $200 in year 1.

### The 12-Month Free Tier (separate from the $200)
After your account is created, AWS also gives you **12 months of free tier** usage:

| Service | Free Tier Amount | What it means for you |
|---|---|---|
| **EC2** | 750 hrs/month of `t2.micro` | 1 always-on server — **free** |
| **RDS** | 750 hrs/month of `db.t3.micro` + 20 GB storage | 1 always-on Postgres DB — **free** |
| **S3** | 5 GB storage + 20K GETs + 2K PUTs/month | More than enough for 200–300 users |
| **CloudFront** | 1 TB data transfer + 10M requests/month | Easily covers your frontend |
| **Data Transfer** | 15 GB outbound/month | Should be sufficient |

**Always-Free tier** (never expires, even after 12 months):
- Lambda: 1M free requests/month (not used here but good to know)
- CloudWatch: 10 custom metrics, 5 GB logs

### Bottom Line: Is $200 Enough?

**Yes, comfortably.**

- During the 12-month free tier: you pay **~$0–5/month** (only things not in free tier: Route 53 domain ~$12/year, ACM is free).
- After 12 months (paid): **~$30–50/month** for your scale of 200–300 users.
- Your $200 credit will cover **4–6 months of post-free-tier costs** even if you do nothing.

> You do NOT need to buy anything upfront. AWS is pay-as-you-go. Free tier + credits will carry you well beyond your first year.

---

## 2. Architecture Overview

```
Internet
    │
    ├── [CloudFront CDN] ──► [S3 Bucket: React frontend build]
    │
    └── [EC2 Instance: t2.micro]
            │  (Express/Node.js server on port 4000)
            │
            ├── [RDS PostgreSQL: db.t3.micro]   ← private subnet
            │
            └── [S3 Buckets: portal-assets, temp-uploads, quiz-images]
                    (private, accessed via presigned URLs)
```

**Why not use Elastic Beanstalk or ECS?**
Those add complexity and cost. For 200–300 users, a single EC2 + RDS is exactly right. You scale later if needed.

---

## 3. Code Changes Required (Supabase Storage → AWS S3)

### What needs to change

Your entire file storage layer lives in one file: `server/src/utils/storage.ts`. It is 100% Supabase-specific — it uses `@supabase/supabase-js` to upload, delete, sign, and move files. Everything else (services, controllers) calls functions from this file through a clean interface, which makes migration straightforward.

**Files you must change:**
1. `server/src/utils/storage.ts` — rewrite to use AWS S3 SDK
2. `server/src/modules/upload/upload.controller.ts` — remove `getStorageClient()` call; use SDK directly via the updated storage utils
3. `server/src/config/env.ts` — swap Supabase vars for AWS vars
4. `server/.env.production` — update env vars

**Files you do NOT need to change:**
- All service files (`student-uploads.service.ts`, `materials.service.ts`, etc.) — they call `signFileFields`, `deleteFilesByUrls`, etc., which are the same interface
- All routes and controllers — no change needed

### 3.1 Install AWS SDK

```bash
cd server
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm uninstall @supabase/supabase-js   # optional, remove when done
```

### 3.2 Updated `server/src/config/env.ts`

Replace the Supabase block with:

```ts
// AWS S3 Storage
AWS_REGION:            process.env.AWS_REGION            || 'ap-south-1',
AWS_ACCESS_KEY_ID:     process.env.AWS_ACCESS_KEY_ID     || '',
AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
S3_PORTAL_BUCKET:      process.env.S3_PORTAL_BUCKET      || 'portal-assets',
S3_TEMP_BUCKET:        process.env.S3_TEMP_BUCKET        || 'temp-uploads',
S3_QUIZ_BUCKET:        process.env.S3_QUIZ_BUCKET        || 'quiz-images',
```

And remove these lines:
```ts
SUPABASE_URL_PUBLIC:       ...
SUPABASE_ANON_KEY:         ...
SUPABASE_SERVICE_ROLE_KEY: ...
SUPABASE_PORTAL_BUCKET:    ...
SUPABASE_TEMP_BUCKET:      ...
```

### 3.3 Rewritten `server/src/utils/storage.ts`

Replace the entire file with the following:

```ts
import {
  S3Client,
  DeleteObjectsCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import logger from '../config/logger';

// ---------------------------------------------------------------------------
// S3 Client
// ---------------------------------------------------------------------------

let _s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!_s3Client) {
    _s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return _s3Client;
}

// ---------------------------------------------------------------------------
// Storage reference helpers (same interface as before — no callers need to change)
// ---------------------------------------------------------------------------

/**
 * Stored references are "bucket-name/object-key"  e.g. "portal-assets/1234-abc.pdf"
 * Old Supabase full URLs are handled for backwards compatibility during migration.
 */
export function resolveStorageRef(stored: string): { bucket: string; path: string } | null {
  if (!stored) return null;

  // Backwards compat: old Supabase public URL format
  const publicMatch = stored.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (publicMatch) return { bucket: publicMatch[1]!, path: publicMatch[2]! };

  // Backwards compat: Supabase signed URL format
  const signedMatch = stored.match(/\/storage\/v1\/object\/sign\/([^/]+)\/(.+?)(?:\?|$)/);
  if (signedMatch) return { bucket: signedMatch[1]!, path: signedMatch[2]! };

  // Current format: "bucket/path"
  const slashIdx = stored.indexOf('/');
  if (slashIdx > 0 && !stored.startsWith('http')) {
    return { bucket: stored.substring(0, slashIdx), path: stored.substring(slashIdx + 1) };
  }

  return null;
}

/** @deprecated Use resolveStorageRef instead */
export const parseStorageUrl = resolveStorageRef;

export function buildStorageRef(bucket: string, path: string): string {
  return `${bucket}/${path}`;
}

// ---------------------------------------------------------------------------
// Signed URL generation
// ---------------------------------------------------------------------------

const DEFAULT_SIGNED_URL_EXPIRY = 900; // 15 minutes

export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY
): Promise<string | null> {
  try {
    const s3 = getS3Client();
    const command = new GetObjectCommand({ Bucket: bucket, Key: path });
    return await getSignedUrl(s3, command, { expiresIn });
  } catch (err) {
    logger.error(`[storage] Failed to sign ${bucket}/${path}:`, err);
    return null;
  }
}

export async function resolveSignedUrl(
  stored: string | null | undefined,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY
): Promise<string | null> {
  if (!stored) return null;
  const ref = resolveStorageRef(stored);
  if (!ref) return null;
  return createSignedUrl(ref.bucket, ref.path, expiresIn);
}

export async function signFileFields<T extends Record<string, any>>(
  obj: T,
  fields: (keyof T)[]
): Promise<T> {
  const result = { ...obj };
  await Promise.all(
    fields.map(async (field) => {
      const val = obj[field];
      if (typeof val === 'string' && val) {
        (result as any)[field] = (await resolveSignedUrl(val)) ?? val;
      }
    })
  );
  return result;
}

// ---------------------------------------------------------------------------
// Upload helper (used by upload.controller.ts)
// ---------------------------------------------------------------------------

export async function uploadToS3(
  bucket: string,
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

export async function moveFileBetweenBuckets(
  storedRef: string,
  targetBucket: string
): Promise<string | null> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return null;
  if (parsed.bucket === targetBucket) return buildStorageRef(targetBucket, parsed.path);

  const s3 = getS3Client();

  try {
    // Copy to target
    await s3.send(
      new CopyObjectCommand({
        CopySource: `${parsed.bucket}/${parsed.path}`,
        Bucket: targetBucket,
        Key: parsed.path,
      })
    );

    // Delete from source
    await s3.send(
      new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.path })
    );

    return buildStorageRef(targetBucket, parsed.path);
  } catch (err) {
    logger.error(`[storage] moveFileBetweenBuckets failed:`, err);
    return null;
  }
}

export async function deleteFileByUrl(storedRef: string): Promise<boolean> {
  const parsed = resolveStorageRef(storedRef);
  if (!parsed) return false;

  try {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({ Bucket: parsed.bucket, Key: parsed.path }));
    return true;
  } catch (err) {
    logger.error(`[storage] Failed to delete ${parsed.path} from ${parsed.bucket}:`, err);
    return false;
  }
}

export async function deleteFilesByUrls(refs: string[]): Promise<void> {
  const byBucket = new Map<string, string[]>();
  for (const ref of refs) {
    if (!ref) continue;
    const parsed = resolveStorageRef(ref);
    if (!parsed) continue;
    const list = byBucket.get(parsed.bucket) || [];
    list.push(parsed.path);
    byBucket.set(parsed.bucket, list);
  }

  const s3 = getS3Client();
  for (const [bucket, paths] of byBucket) {
    try {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucket,
          Delete: { Objects: paths.map((Key) => ({ Key })) },
        })
      );
    } catch (err) {
      logger.error(`[storage] Batch delete from ${bucket} failed:`, err);
    }
  }
}
```

### 3.4 Updated `server/src/modules/upload/upload.controller.ts`

Replace the Supabase upload calls with the new `uploadToS3` helper. The key change is in the upload section:

```ts
// OLD (Supabase):
import { getStorageClient, buildStorageRef, createSignedUrl } from '../../utils/storage';
// ...
const supabase = getStorageClient();
const { error } = await supabase.storage.from(bucket).upload(filename, req.file.buffer, { ... });

// NEW (S3):
import { uploadToS3, buildStorageRef, createSignedUrl } from '../../utils/storage';
// ...
const bucket = role === 'admin' ? env.S3_PORTAL_BUCKET : env.S3_TEMP_BUCKET;
await uploadToS3(bucket, filename, req.file.buffer, req.file.mimetype);
```

The return shape (`{ url, ref, signed_url, name, bucket }`) stays identical.

Similarly update `uploadQuizImage` to use `env.S3_QUIZ_BUCKET` and `uploadToS3`.

### 3.5 Updated `.env.production`

```env
NODE_ENV=production
PORT=4000

JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<generate similarly>

DATABASE_URL=postgresql://lms_user:password@your-rds-endpoint.rds.amazonaws.com:5432/lmsdb

# AWS S3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
S3_PORTAL_BUCKET=portal-assets
S3_TEMP_BUCKET=temp-uploads
S3_QUIZ_BUCKET=quiz-images

FRONTEND_ORIGINS=https://yourdomain.com

ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_HOST_EMAIL=...
```

---

## 4. Step-by-Step Deployment

### 4.1 AWS Account & IAM Setup

1. **Create AWS Account** at aws.amazon.com. Use a real credit card (you won't be charged during free tier, but it's required).

2. **Enable MFA on root account** — go to IAM → Security recommendations → Enable MFA. Non-negotiable.

3. **Create an IAM user** (don't use root for day-to-day work):
   - IAM → Users → Create user → name it `lms-admin`
   - Attach policy: `AdministratorAccess` (you can restrict later)
   - Enable console access + programmatic access
   - Save the Access Key ID and Secret Access Key

4. **Create a dedicated IAM role for EC2** (most secure approach):
   - IAM → Roles → Create role → AWS service → EC2
   - Attach a custom policy for S3 access only (principle of least privilege):

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:GetObject", "s3:PutObject", "s3:DeleteObject",
           "s3:ListBucket", "s3:CopyObject"
         ],
         "Resource": [
           "arn:aws:s3:::portal-assets/*",
           "arn:aws:s3:::temp-uploads/*",
           "arn:aws:s3:::quiz-images/*",
           "arn:aws:s3:::portal-assets",
           "arn:aws:s3:::temp-uploads",
           "arn:aws:s3:::quiz-images"
         ]
       }
     ]
   }
   ```
   - Name this role `lms-ec2-s3-role`

   > If you use this EC2 IAM role, you don't need `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in your `.env` at all — the SDK picks up credentials automatically. This is the preferred production approach.

5. **Set a billing alarm** so you don't get surprised:
   - Billing → Budgets → Create budget → Monthly cost budget → $20 → Email alert at 80%

---

### 4.2 S3 Buckets (File Storage)

1. **Go to S3 → Create bucket** (repeat for each):
   - `portal-assets` — for published content (materials, assignment answers)
   - `temp-uploads` — for draft/pending uploads
   - `quiz-images` — for quiz question images

2. **Settings for each bucket**:
   - Region: pick one close to your users (e.g., `ap-south-1` for India)
   - Block all public access: **ON** (keep private — we use presigned URLs)
   - Versioning: off (save storage costs)
   - Encryption: SSE-S3 (default, free)
   - Object ownership: ACLs disabled (default)

3. **Set bucket CORS policy** (so browsers can upload and fetch):
   For each bucket → Permissions → CORS → paste:

   ```json
   [
     {
       "AllowedHeaders": ["*"],
       "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
       "AllowedOrigins": ["https://yourdomain.com"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3000
     }
   ]
   ```

4. **Set lifecycle rules for `temp-uploads`** (auto-delete orphaned drafts):
   - Management → Create lifecycle rule → name: `auto-delete-temp`
   - Apply to all objects in bucket
   - Expire objects after: **7 days**
   - This prevents accumulation of abandoned draft files.

---

### 4.3 RDS PostgreSQL Database

1. **Go to RDS → Create database**:
   - Standard create
   - Engine: PostgreSQL 16
   - Template: **Free tier** (this locks you to db.t3.micro)
   - DB instance identifier: `lms-db`
   - Master username: `lms_admin`
   - Master password: generate a strong password and save it
   - DB instance class: `db.t3.micro` (free tier)
   - Storage: 20 GB gp2 (free tier limit)
   - Storage autoscaling: **off** (to avoid surprise costs)

2. **Connectivity settings**:
   - VPC: default VPC is fine
   - Subnet group: default
   - Public access: **No** (DB should only be accessible from EC2)
   - VPC security group: Create new → name `lms-db-sg`

3. **After RDS is created**, note the **Endpoint** (something like `lms-db.xxxx.ap-south-1.rds.amazonaws.com`). This goes into your `DATABASE_URL`.

4. **Configure the security group**:
   - EC2 → Security Groups → `lms-db-sg` → Inbound rules → Edit
   - Add rule: Type=PostgreSQL, Port=5432, Source= (security group of your EC2 instance — add this after you create EC2)

5. **Run your schema** (from your local machine once EC2 is set up):
   ```bash
   # You'll need to SSH tunnel through EC2 since RDS is not public
   psql "postgresql://lms_admin:password@lms-db.xxxx.rds.amazonaws.com:5432/postgres" \
     -c "CREATE DATABASE lmsdb;"
   psql "postgresql://lms_admin:password@lms-db.xxxx.rds.amazonaws.com:5432/lmsdb" \
     -f server/sql/schema.sql
   ```

---

### 4.4 EC2 Instance (Backend Server)

#### Launch the instance

1. **EC2 → Launch instance**:
   - Name: `lms-server`
   - AMI: **Ubuntu 24.04 LTS** (free tier eligible)
   - Instance type: **t2.micro** (free tier) or `t3.micro` ($8.50/month after free tier)
   - Key pair: Create new → `lms-keypair` → Download the `.pem` file → store safely
   - Network: default VPC
   - Subnet: any public subnet
   - Auto-assign public IP: Enable
   - Security group: Create new → `lms-server-sg`
     - Inbound: SSH (22) from your IP only
     - Inbound: Custom TCP 4000 from anywhere (or only from CloudFront/ALB later)
     - Inbound: HTTP (80) from anywhere
     - Inbound: HTTPS (443) from anywhere
   - IAM instance profile: attach `lms-ec2-s3-role` (created in step 4.1)

2. **Add to RDS security group**: After launch, go to `lms-db-sg` → add inbound PostgreSQL rule from `lms-server-sg`.

#### Set up the server

SSH into your instance:
```bash
chmod 400 lms-keypair.pem
ssh -i lms-keypair.pem ubuntu@<your-ec2-public-ip>
```

**Install Node.js 20:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # should be 20.x
```

**Install PM2 (process manager):**
```bash
sudo npm install -g pm2
```

**Install Nginx (reverse proxy):**
```bash
sudo apt-get install -y nginx
```

**Clone your repo and build:**
```bash
cd /home/ubuntu
git clone https://github.com/yourusername/lms-platform.git
cd lms-platform/server
npm install
```

**Create production env file:**
```bash
nano .env.production
# paste your env vars (see section 3.5)
```

**Build and start:**
```bash
npm run build
NODE_ENV=production pm2 start dist/server.js --name lms-api
pm2 startup   # follow the printed command to auto-start on reboot
pm2 save
```

**Configure Nginx as reverse proxy:**
```bash
sudo nano /etc/nginx/sites-available/lms
```
Paste:
```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 100M;   # allow large file uploads

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 120s;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**Install Certbot for HTTPS (free SSL):**
```bash
sudo snap install --classic certbot
sudo certbot --nginx -d api.yourdomain.com
# Follow prompts — it auto-configures Nginx with SSL
```

**Deployment workflow going forward:**
```bash
# On EC2 — to deploy a new version:
cd /home/ubuntu/lms-platform
git pull
cd server
npm install
npm run build
pm2 restart lms-api
```

---

### 4.5 S3 + CloudFront (Frontend)

Your React SPA is a static build — no server needed. Host it on S3 + CloudFront.

#### S3 for frontend

1. **Create S3 bucket**:
   - Name: `lms-frontend` (bucket names are global so add a suffix if taken)
   - Region: same as everything else
   - Block all public access: **OFF** (frontend files need to be public)
   - Enable static website hosting: Properties → Static website hosting → Enable
   - Index document: `index.html`
   - Error document: `index.html` (crucial for React Router to work)

2. **Set bucket policy** (allow public read):
   Permissions → Bucket policy:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Sid": "PublicReadGetObject",
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::lms-frontend/*"
     }]
   }
   ```

3. **Build and upload frontend**:
   ```bash
   # In client/ directory, create .env.production:
   echo "REACT_APP_API_URL=https://api.yourdomain.com" > .env.production
   
   npm run build
   
   # Upload to S3 (install AWS CLI first: sudo apt install awscli)
   aws s3 sync build/ s3://lms-frontend --delete
   ```

#### CloudFront (CDN + HTTPS for frontend)

1. **CloudFront → Create distribution**:
   - Origin domain: select your `lms-frontend` S3 bucket (use the S3 website endpoint, not the REST endpoint)
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD
   - Compress objects: Yes
   - Default root object: `index.html`

2. **Custom error pages** (for React Router):
   - Error pages → Create custom error response
   - HTTP error code: 403 → Response page: `/index.html` → HTTP response code: 200
   - HTTP error code: 404 → Response page: `/index.html` → HTTP response code: 200

3. **Attach your domain** (if using Route 53 — see next section).

4. **Invalidate cache on deploy**:
   ```bash
   # After uploading new build:
   aws cloudfront create-invalidation \
     --distribution-id YOUR_DIST_ID \
     --paths "/*"
   ```

---

### 4.6 Domain & HTTPS (Route 53 + ACM)

**If you have a domain** (e.g., from GoDaddy/Namecheap, or buy from Route 53):

1. **Route 53 → Create hosted zone** → enter your domain name → Public hosted zone.
2. Copy the 4 NS (nameserver) records and set them in your domain registrar.

3. **Request SSL certificate** (free via ACM):
   - AWS Certificate Manager → Request certificate → Public → Enter:
     - `yourdomain.com`
     - `*.yourdomain.com` (wildcard covers api.yourdomain.com, www, etc.)
   - Validation: DNS validation → Click "Create records in Route 53" (auto-creates CNAME records)
   - Wait ~5 minutes for validation

4. **Add DNS records**:
   - Route 53 → your hosted zone → Create records:
     - `A` record → `yourdomain.com` → Alias → CloudFront distribution (for frontend)
     - `A` record → `api.yourdomain.com` → EC2 Elastic IP (see below)

5. **Assign Elastic IP to EC2** (so the IP doesn't change on restart):
   - EC2 → Elastic IPs → Allocate → Associate → select your instance

---

### 4.7 Environment Variables & Final Config

**Server (EC2) `.env.production` summary:**
```env
NODE_ENV=production
PORT=4000

JWT_SECRET=<64-byte hex>
JWT_REFRESH_SECRET=<64-byte hex>

DATABASE_URL=postgresql://lms_admin:PASSWORD@lms-db.XXXX.ap-south-1.rds.amazonaws.com:5432/lmsdb

# If using EC2 IAM role — omit these two:
AWS_REGION=ap-south-1
# AWS_ACCESS_KEY_ID=      ← not needed with IAM role
# AWS_SECRET_ACCESS_KEY=  ← not needed with IAM role

S3_PORTAL_BUCKET=portal-assets
S3_TEMP_BUCKET=temp-uploads
S3_QUIZ_BUCKET=quiz-images

FRONTEND_ORIGINS=https://yourdomain.com

ZOOM_ACCOUNT_ID=...
ZOOM_CLIENT_ID=...
ZOOM_CLIENT_SECRET=...
ZOOM_HOST_EMAIL=...
```

**Client `client/.env.production`:**
```env
REACT_APP_API_URL=https://api.yourdomain.com
```

---

## 5. Cost Estimate

### During 12-month Free Tier (+ $200 credits)

| Service | Cost |
|---|---|
| EC2 t2.micro | **$0** (free tier: 750 hrs/month) |
| RDS db.t3.micro | **$0** (free tier: 750 hrs/month) |
| S3 (files) | **$0** (free tier: 5 GB) |
| CloudFront | **$0** (free tier: 1 TB transfer) |
| Route 53 domain | ~$12/year (domain registration) |
| ACM SSL cert | **$0** (always free) |
| **Total / month** | **~$1–2/month** (just domain amortized) |

> Your $200 credit: essentially untouched during free tier.

### After 12 Months (for 200–300 users)

| Service | Estimated Cost |
|---|---|
| EC2 t3.micro (1 vCPU, 1 GB RAM) | ~$8.50/month |
| RDS db.t3.micro (PostgreSQL) | ~$14/month |
| S3 (assume 20 GB files + transfers) | ~$1–2/month |
| CloudFront (assume 50 GB/month) | ~$4/month |
| Route 53 (hosted zone + queries) | ~$1/month |
| Data transfer EC2 → internet | ~$2/month |
| **Total / month** | **~$30–35/month** |

> Your $200 credit at $33/month = **6 months** covered after free tier ends. So effectively **18 months for ~$12 total** (just domain).

### When to upgrade

- EC2 → `t3.small` (2 GB RAM, ~$17/month) when you hit 500+ concurrent users
- RDS → `db.t3.small` (~$28/month) when DB becomes a bottleneck
- For 200–300 users: t3.micro handles it easily

---

## 6. Ongoing Maintenance Tips

### Backups
- RDS automated backups: already enabled by default (7-day retention, free up to 100% of DB storage)
- S3: enable versioning on `portal-assets` if you want file history (adds storage cost)

### Monitoring (free)
- CloudWatch → EC2 metrics (CPU, network) are free
- Set alarm: CPU > 80% for 5 minutes → email you
- PM2: `pm2 logs lms-api` and `pm2 monit` for process health

### Updating your app
```bash
# SSH into EC2
ssh -i lms-keypair.pem ubuntu@<elastic-ip>

cd /home/ubuntu/lms-platform
git pull origin main

cd server
npm install
npm run build
pm2 restart lms-api

# Frontend:
cd ../client
npm run build
aws s3 sync build/ s3://lms-frontend --delete
aws cloudfront create-invalidation --distribution-id DIST_ID --paths "/*"
```

### Security checklist
- [ ] MFA on root AWS account
- [ ] RDS not publicly accessible
- [ ] EC2 SSH only from your IP
- [ ] S3 buckets (file storage) are private — only accessed via presigned URLs
- [ ] JWT secrets are strong (64-byte random hex)
- [ ] `AWS_SECRET_ACCESS_KEY` never in code — use IAM role on EC2
- [ ] Set billing alert at $20/month

---

*Last updated: April 2026*
