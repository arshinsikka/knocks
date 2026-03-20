# Knocks

Multiplayer Teen Patti card game. 2–6 players, 5 rounds per orbit, first to reach the knock target wins the pot.

## Local setup

```bash
# 1. Clone and install
git clone <repo>
cd knocks

# 2. Server
cd server
cp .env.example .env
npm install
npm run dev        # ts-node-dev, port 3001

# 3. Client (new terminal)
cd client
cp .env.example .env.local
npm install
npm run dev        # Next.js, port 3000
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

### Server (`server/.env`)

| Variable     | Default                   | Description                        |
|--------------|---------------------------|------------------------------------|
| `PORT`       | `3001`                    | HTTP + WebSocket port              |
| `CLIENT_URL` | `http://localhost:3000`   | Allowed CORS origin (client URL)   |

### Client (`client/.env.local`)

| Variable                    | Default                   | Description              |
|-----------------------------|---------------------------|--------------------------|
| `NEXT_PUBLIC_SOCKET_URL`    | `http://localhost:3001`   | Server WebSocket URL     |

## Deploying to Railway (server) + Vercel (client)

### Server → Railway

1. Create a new Railway project and connect this repo.
2. Set the root directory to `server/`.
3. Add environment variables in the Railway dashboard:
   - `CLIENT_URL` = your Vercel deployment URL (e.g. `https://knocks.vercel.app`)
4. Railway injects `PORT` automatically — do not override it.
5. The server listens on `0.0.0.0` and handles `SIGTERM` gracefully.

### Client → Vercel

1. Import the repo into Vercel, set root directory to `client/`.
2. Add environment variable:
   - `NEXT_PUBLIC_SOCKET_URL` = your Railway server URL (e.g. `https://knocks-server.up.railway.app`)
3. Deploy.

## Health check

```
GET /health
→ { "status": "ok", "activeRooms": 3 }
```

## Game rules (brief)

- Each orbit: 5 rounds (1–5 cards dealt per round).
- Round 1: 1 card each; Round 3: wild card; Round 4: muflis (worst hand wins); Round 5: 5 cards, best 3.
- Each turn: say **In** or **Out**. Out players can **Join** the challenge or **Pass**.
- Showdown winner gets a knock. First to reach the knock target wins the pot.
- Pot grows by `numPlayers × 2` at the start of each orbit.
