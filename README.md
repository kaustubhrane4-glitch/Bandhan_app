# 💍 Bandhan Matrimony

> **बंधन — हर दिल का रिश्ता**
> India's most trusted matrimony platform. Verified profiles, AI matching, zero fake profiles, zero sales calls.

---

## 🚀 Quick Deploy (No Laptop Needed)

### Step 1 — Backend on Railway
1. Go to [railway.app](https://railway.app) → Login with GitHub
2. New Project → Deploy from GitHub → select this repo → set root to `/backend`
3. Add environment variables from `backend/.env.example`
4. Your API goes live at: `https://your-app.up.railway.app`

### Step 2 — Frontend on Vercel
1. Go to [vercel.com](https://vercel.com) → Login with GitHub
2. New Project → import this repo → set root to `/frontend`
3. Add env var: `REACT_APP_API_URL=https://your-railway-url.up.railway.app`
4. Your app goes live at: `https://your-app.vercel.app`

### Step 3 — Android APK on Codemagic
1. Go to [codemagic.io](https://codemagic.io) → Login with GitHub
2. Add application → select this repo → set root to `/android`
3. Generate keystore in Codemagic → Start build
4. Download `.aab` file → upload to Play Store

---

## 📁 Project Structure

```
bandhan/
├── backend/          ← Node.js API (deploy to Railway)
│   ├── server.js     ← Main server entry point
│   ├── db.js         ← JSON database engine
│   ├── package.json
│   ├── .env.example
│   ├── data/         ← JSON data files
│   ├── routes/       ← API route handlers
│   ├── middleware/   ← Auth, validation
│   └── services/     ← AI engine, payments
│
├── frontend/         ← React app (deploy to Vercel)
│   ├── public/
│   │   ├── index.html
│   │   └── manifest.json
│   ├── src/
│   │   ├── App.jsx   ← Main app component
│   │   ├── index.js
│   │   └── components/
│   └── package.json
│
├── android/          ← Android WebView (build on Codemagic)
│   ├── app/
│   └── build.gradle
│
└── README.md
```

---

## 💰 Total Cost to Launch

| Item | Cost |
|------|------|
| GitHub, Railway, Vercel, MongoDB Atlas | ₹0 Free |
| Codemagic APK builder | ₹0 Free |
| Google Play Console | ₹2,100 ($25 once) |
| Domain bandhan.app (optional) | ₹800/year |
| **Minimum to launch** | **₹2,100** |

---

## 🔑 Demo Login

Email: `priya@example.com` | Password: `demo123`

---

*Built with ❤️ in India*
