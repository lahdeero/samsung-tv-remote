# TV Remote Controller

Local web UI for controlling a Samsung Smart TV (S90D OLED) over the network.

The UI runs in the browser, but every TV command is executed server-side by
Next.js route handlers via the `samsungtv` CLI in the local Python virtualenv.
Power on uses Wake-on-LAN.

## Requirements

- Node.js 20+
- The existing Python venv with `samsungtvws` and a valid `.tv-token`
- `wakeonlan` for Power On

## Setup

```bash
npm install
cp .env.local.example .env.local   # then edit values if needed
```

Environment variables (see `.env.local.example`):

```text
TV_IP=192.168.1.95
TV_MAC=B8:B4:09:50:4C:72
SAMSUNGTV_BIN=/home/eero/Projects/tv-remote-controller/.venv/bin/samsungtv
SAMSUNGTV_TOKEN_FILE=/home/eero/Projects/tv-remote-controller/.tv-token
WOL_BIN=wakeonlan
```

`.env.local` and `.tv-token` are gitignored and must not be committed.

## Run

```bash
npm run dev        # development
npm run build && npm run start   # production
```

Open http://localhost:3000 (use `-H 0.0.0.0` to reach it from a phone).

## Structure

- `lib/tv.ts` — server-side TV command abstraction (`execFile`, no shell strings,
  key allowlist).
- `app/api/tv/route.ts` — POST endpoint that validates the action and runs it.
- `app/Remote.tsx` — responsive remote-style UI.
- `tv` — legacy bash helper.

## Raw keys

Media controls map to verified `samsungtvws` key codes:
Play `KEY_PLAY`, Pause `KEY_PAUSE`, Stop `KEY_STOP`, Previous `KEY_REWIND`,
Next `KEY_FF`. See the samsungtvws `COMMANDS.md` key reference.
