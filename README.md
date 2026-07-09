# ClipViral Automation

Multi-platform video upload automation for Whop ContentRewards monetization.

## Accounts

| Platform | Account | Status | Content |
|----------|---------|--------|---------|
| Instagram | `clipviral_viralclips` | **ACTIVE** | Coinbase campaign |
| Instagram | `med.ali.84` | future | Daleel |
| YouTube | `@theclipviralco` | **ACTIVE** | Coinbase campaign |
| YouTube | `@QuranKarim-84` | future | Daleel |
| TikTok | `clipviral.co0` | app in review | Coinbase campaign |
| TikTok | `daliaoun84` | future | Daleel |

## Structure

```
clipviral-automation/
├── instagram/
│   ├── clipviral_viralclips/   ← ACTIVE
│   │   ├── upload.mjs
│   │   └── campaigns/coinbase.js
│   └── med.ali.84/             ← future (Daleel)
│       ├── upload.mjs
│       └── campaigns/daleel.js
├── youtube/
│   ├── theclipviralco/         ← ACTIVE
│   │   ├── auth.mjs            ← run once to get token
│   │   ├── upload.mjs
│   │   └── campaigns/coinbase.js
│   └── QuranKarim-84/          ← future (Daleel)
│       ├── auth.mjs
│       ├── upload.mjs
│       └── campaigns/daleel.js
├── tiktok/
│   ├── clipviral.co0/          ← app in review
│   │   └── upload.mjs
│   └── daliaoun84/             ← future (Daleel)
│       └── upload.mjs
└── whop/
    └── submit.mjs              ← ContentRewards submission
```

## Setup

```bash
npm install
cp .env.example .env
# Fill in .env with your tokens
```

## Usage

### Instagram — @clipviral_viralclips

```bash
# Upload clip 1 from Coinbase campaign
node instagram/clipviral_viralclips/upload.mjs coinbase 1

# Or via npm script
npm run ig:cv -- coinbase 3
```

### YouTube — @theclipviralco

```bash
# First time: authorize the channel
node youtube/theclipviralco/auth.mjs

# Upload clip 1
node youtube/theclipviralco/upload.mjs coinbase 1
npm run yt:cv -- coinbase 3
```

### TikTok — @clipviral.co0

```bash
# App is in review — available once TikTok approves ClipHaus app
node tiktok/clipviral.co0/upload.mjs path/to/video.mp4
```

### Whop ContentRewards submission

```bash
# First time: capture API format
node whop/submit.mjs --setup

# Submit a video URL
node whop/submit.mjs "Video Title" "https://www.youtube.com/watch?v=..."
```

## Secrets (never committed)

| File | Contains |
|------|----------|
| `.env` | All tokens and API keys |
| `youtube/theclipviralco/credentials.json` | Google OAuth client |
| `youtube/theclipviralco/token.json` | YouTube access token |
| `youtube/QuranKarim-84/credentials.json` | Google OAuth client (future) |
| `youtube/QuranKarim-84/token.json` | YouTube access token (future) |
| `tiktok/clipviral.co0/token.json` | TikTok access token |
| `whop/session.json` | Whop cookie session |

All of the above are in `.gitignore`.
