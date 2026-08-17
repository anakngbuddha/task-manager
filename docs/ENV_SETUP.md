# Task Manager -- Environment Variables Setup Guide

This document explains every environment variable the backend needs, how to generate or obtain each one, and how to configure them on Render.

---

## Quick Start: Setting Up on Render

1. Go to your service on the Render Dashboard (https://dashboard.render.com)
2. Click **Environment** in the left sidebar
3. Add each key listed below
4. Click **Save Changes** -> Render will redeploy automatically

The ender.yaml in this repo already lists all keys (sync: false), so Render knows to expect manual values.

---

## REQUIRED Variables (app will NOT start without these)

### DATABASE_URL
Your Aiven MySQL (free tier) connection string.

How to get it:
1. Go to https://console.aiven.io and open your MySQL service
2. Click the **Overview** tab
3. Under **Connection Information**, find:
   - Host (e.g. mysql-yourproject-username.aivencloud.com)
   - Port (e.g. 12345)
   - User: avnadmin
   - Password: (shown or can be reset)
   - Database: defaultdb
4. Build your DATABASE_URL:

   # Simple SSL (recommended for Render):
   DATABASE_URL=mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED

   # Strict SSL with CA cert (download ca.pem from Aiven -> Connection Information):
   DATABASE_URL=mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?sslcert=./ca.pem&sslmode=verify-ca

IMPORTANT -- Aiven free tier note:
- Free tier services sleep after periods of inactivity
- The first connection after sleep may take 30-60 seconds
- Prisma's connection pool handles reconnects automatically

### JWT_SECRET
Secret key for signing JWT tokens. Must be >=32 characters in production.

How to generate (run in terminal):
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

### BETTER_AUTH_SECRET
Session signing secret for Better-Auth. Must be >=32 characters in production.
Generate the same way as JWT_SECRET -- use a DIFFERENT value.

### BETTER_AUTH_URL
The full public URL of your Render backend.
Example: https://taskmanager-api.onrender.com
(Find this in Render service -> Settings -> URL)

### FRONTEND_URL
The public URL of your deployed frontend.
Example: https://task-manager-mauve-eta.vercel.app

---

## Email -- Brevo (REQUIRED in Production)

Without these, email verification and password reset will fail in production.

### BREVO_API_KEY
1. Sign up / log in at https://app.brevo.com
2. SMTP & API -> API Keys -> Create a new API key
3. Copy the key (shown only once -- save it!)

### EMAIL_FROM_ADDRESS
The sender email address for all outgoing emails.
Example: noreply@yourdomain.com
Must be a domain verified in Brevo -> Senders & Domains.

### EMAIL_FROM_NAME
Display name for the sender. Example: Task Manager

---

## Google OAuth (Optional -- enables Sign in with Google)

### GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
1. Go to https://console.cloud.google.com/apis/credentials
2. Create Credentials -> OAuth client ID -> Web application
3. Add Authorized redirect URI:
   https://taskmanager-api.onrender.com/api/auth/callback/google
4. Copy the Client ID and Client Secret

---

## GitHub OAuth (Optional -- enables Sign in with GitHub)

### GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET
1. Go to https://github.com/settings/developers
2. New OAuth App
3. Authorization callback URL:
   https://taskmanager-api.onrender.com/api/auth/callback/github
4. Copy Client ID and generate Client Secret

---

## GitHub App (Optional -- for repo integration features)

### GITHUB_APP_ID
Numeric ID from your GitHub App settings page.

### GITHUB_APP_SLUG
URL slug from github.com/apps/YOUR_SLUG

### GITHUB_APP_PRIVATE_KEY
1. GitHub App settings -> Private keys -> Generate a private key (.pem downloaded)
2. Paste the full PEM content, replacing actual newlines with \n

### GITHUB_WEBHOOK_SECRET
A random 32+ character string.
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
Set the same value in your GitHub App's Webhook secret field.

### GITHUB_INSTALLATION_URL
  https://github.com/apps/YOUR_APP_SLUG/installations/new

---

## Cloudinary (Optional -- for file uploads)

### CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET
From https://cloudinary.com/console -> Dashboard.

---

## Google Gemini AI (Optional -- for AI features)

### GEMINI_API_KEY
From https://aistudio.google.com/apikey -> Create API key

### GEMINI_PROXY_URL
Your Cloudflare Worker proxy URL for Gemini (if using one). Leave blank otherwise.

---

## Pinecone (Optional -- for RAG / knowledge base)

### PINECONE_API_KEY
From https://app.pinecone.io -> API Keys

### PINECONE_INDEX
Name of your Pinecone index. Default: taskbot-rag (auto-created on first run)

---

## AI Fallback Keys (Optional)

### FALLBACK_GEMINI_API_KEY
A secondary Gemini key. Generate the same way as GEMINI_API_KEY.

### GROQ_API_KEY
From https://console.groq.com -> API Keys

### CEREBRAS_API_KEY
From https://cloud.cerebras.ai -> API Keys

---

## Frontend -- Vercel

Set ONE variable in Vercel Dashboard -> Project -> Settings -> Environment Variables:

  VITE_API_URL = https://taskmanager-api.onrender.com/api

---

## Security Checklist Before Deploying

- [ ] JWT_SECRET is >=32 random characters (not a placeholder)
- [ ] BETTER_AUTH_SECRET is >=32 random characters (different from JWT_SECRET)
- [ ] BREVO_API_KEY is set (email fails in production without it)
- [ ] DATABASE_URL uses SSL (?sslaccept=strict for PlanetScale)
- [ ] .env is in .gitignore and NEVER committed to git
- [ ] OAuth redirect URIs match your exact deployed backend URL

---

## Generating Secrets Quickly

Run these in your terminal to generate strong random secrets:

  # For JWT_SECRET (64 hex chars = 256 bits)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # For BETTER_AUTH_SECRET
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # For GITHUB_WEBHOOK_SECRET
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

  # Using OpenSSL
  openssl rand -hex 32

---

## Files Reference

  backend/.env.example   -- Copy to backend/.env and fill in values
  backend/render.yaml    -- Tells Render which env vars to expect
  backend/src/config/env.ts  -- Validates all env vars on startup (Zod schema)
