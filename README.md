# ♟️ ChessMate — Chess + Social Platform

A real-time multiplayer chess platform built with the MERN stack, featuring live gameplay via Socket.IO, video/audio calls via WebRTC, rating system, and social features.

![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)

## ✨ Features

- **Real-time Chess** — Play live games with move validation (chess.js) and interactive board (react-chessboard)
- **Matchmaking** — Automated matchmaking queue with rating-based pairing
- **Video/Audio Calls** — In-game WebRTC video and audio chat
- **Rating System** — ELO-based rating with leaderboard
- **Social Features** — Friends list, game history, user profiles
- **Game Review** — Review completed games move-by-move
- **Real-time Chat** — In-game messaging via Socket.IO

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, Vite, React Router v7, react-chessboard |
| **Backend** | Node.js, Express, Socket.IO |
| **Database** | MongoDB (Mongoose ODM) |
| **Auth** | JWT (jsonwebtoken + bcryptjs) |
| **WebRTC** | Peer-to-peer with TURN/STUN servers |
| **Deployment** | Vercel (frontend) + Render (backend) |

## 📁 Project Structure

```
Chess/
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/     # UI components (Auth, Board, Dashboard, etc.)
│   │   ├── context/        # React context (Auth, Socket)
│   │   ├── services/       # API client (axios)
│   │   └── utils/          # Utility functions
│   ├── vercel.json         # Vercel SPA routing config
│   └── package.json
├── server/                 # Express backend
│   ├── config/             # DB & app configuration
│   ├── controllers/        # Route controllers
│   ├── middleware/          # Auth & error middleware
│   ├── models/             # Mongoose models (User, Game, Message)
│   ├── routes/             # API routes
│   ├── socket/             # Socket.IO handlers
│   ├── services/           # Business logic
│   └── server.js           # Entry point
├── .env.example            # Environment variables template
├── .gitignore
└── package.json            # Root scripts
```

## 🚀 Local Development

### Prerequisites
- Node.js 18+
- MongoDB (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Setup

```bash
# 1. Clone the repo
git clone https://github.com/Lokesh19102005/ChessOnline.git
cd ChessOnline

# 2. Install all dependencies (root + server + client)
npm run install-all

# 3. Configure environment
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secret, and TURN credentials

# 4. Start development (runs server + client concurrently)
npm run dev
```

The client runs on `http://localhost:5173` and the server on `http://localhost:5000`.

## 🌐 Deployment

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Set the **Root Directory** to `client`
3. Vercel auto-detects Vite — the build command is `vite build` and output is `dist`
4. Add **Environment Variables** in Vercel dashboard:

   | Variable | Value |
   |----------|-------|
   | `VITE_API_URL` | `https://your-backend.onrender.com/api` |
   | `VITE_SOCKET_URL` | `https://your-backend.onrender.com` |

5. Deploy!

### Backend → Render

1. Go to [render.com](https://render.com) and create a new **Web Service**
2. Connect your GitHub repo
3. Configure:

   | Setting | Value |
   |---------|-------|
   | **Root Directory** | `server` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Environment** | Node |

4. Add **Environment Variables** in Render dashboard:

   | Variable | Value |
   |----------|-------|
   | `NODE_ENV` | `production` |
   | `PORT` | `5000` (or let Render auto-assign) |
   | `MONGODB_URI` | Your MongoDB Atlas connection string |
   | `JWT_SECRET` | A strong random secret |
   | `CLIENT_URL` | `https://your-app.vercel.app` |
   | `TURN_URL` | Your TURN server URLs |
   | `TURN_USERNAME` | TURN username |
   | `TURN_CREDENTIAL` | TURN credential |

5. Deploy!

> **⚠️ Important**: After deploying both, update `CLIENT_URL` on Render with your actual Vercel URL, and update `VITE_API_URL` / `VITE_SOCKET_URL` on Vercel with your actual Render URL.

## 📝 Environment Variables

See [`.env.example`](.env.example) for all variables. Key ones:

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `JWT_SECRET` | Secret for signing JWT tokens | ✅ |
| `CLIENT_URL` | Frontend URL(s) for CORS — comma-separated | ✅ |
| `TURN_URL` | TURN/STUN server URLs for WebRTC | Optional |
| `VITE_API_URL` | Backend API URL (client-side) | ✅ in prod |
| `VITE_SOCKET_URL` | Backend Socket URL (client-side) | ✅ in prod |

## 📄 License

MIT
