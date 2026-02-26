# Testfolio — No Paywall Copy

A local copy of [testfol.io](https://testfol.io/) with **no paywall, no sign-in, and no limits**. Portfolio backtester using Yahoo Finance data.

## Run

### Backend (required for backtests)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The app talks to the API at `http://localhost:8000` by default. To use another API URL, set `VITE_API_URL` in `.env` (e.g. `VITE_API_URL=http://localhost:8000`).

## Features

- **Portfolio Backtester** — Multiple portfolios, date range, starting value, rebalance frequency (daily/weekly/monthly/quarterly/yearly), optional inflation adjustment.
- **No account** — No sign-in, no pricing, no backend-enforced caps.
- Same-style layout as testfol.io (sidebar tools, parameters panel, results table, equity curve chart).

## Disclaimer

Past performance does not indicate future results. For educational use only. Not financial advice.

## License

MIT.

## Publish to GitHub

```bash
git init
git add .
git commit -m "Testfolio copy — no paywall"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/Testfolio.git
git push -u origin main
```

## Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new).
2. **Import** your GitHub repo (e.g. `Xeinst/Testfolio`).
3. Leave **Root Directory** empty (repo root has `frontend/` and `api/`).
4. **Build** is set via `vercel.json`: install and build run from `frontend/`.
5. Optional: add **Environment Variable** `VITE_API_URL` = `` (empty) so the app uses the same-origin `/api` on Vercel.
6. Click **Deploy**. Your live link will be like `https://testfolio-xxx.vercel.app`.

### Vercel not showing the latest code?

- **If the deployment shows "Initial commit"** — Vercel is likely connected to a *different* repo than the one we push to (`Xeinst/Testfolio`). Fix it one of two ways:

  **Option A – Connect Vercel to Xeinst/Testfolio**  
  1. Vercel → your **testfolio** project → **Settings** → **Git**.  
  2. Under **Connected Git Repository**, click **Disconnect**.  
  3. Click **Connect Git Repository** → choose **GitHub** → pick the **Xeinst** account/org (if you have access) → select **Testfolio**.  
  4. Go to **Deployments** → open the **⋮** on the latest deployment → **Redeploy** (or push any commit to `main` to trigger a new deploy).

  **Option B – Push this code to the repo Vercel already uses**  
  1. On GitHub, create a new repo under the *same account you use in Vercel* (e.g. **Nadavlistingsync**), name it **Testfolio** (if it doesn’t exist yet).  
  2. Locally run:
     ```bash
     git remote add vercel https://github.com/Nadavlistingsync/Testfolio.git
     git push vercel main
     ```
     (Use your GitHub username if different; you may need to log in as that user to push.)  
  3. In Vercel, connect the project to that repo (or leave it connected) and **Redeploy** from the **Deployments** tab.
