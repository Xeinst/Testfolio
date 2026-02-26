# Deploy Testfolio on Your Vercel Project

The latest code (Portfolio Backtester, Asset Analyzer, Optimizer, Efficient Frontier, Rebalancing Sensitivity, TVM) is on GitHub: **https://github.com/Xeinst/Testfolio**

## Option A — Vercel is already connected to Xeinst/Testfolio

1. Open your **testfolio** project on [Vercel](https://vercel.com).
2. Go to **Deployments**.
3. Click **Redeploy** on the latest deployment, or wait for the automatic deploy from the latest push to `main`.

Your live site will then serve the full app and all API routes (`/api/backtest`, `/api/asset_analyzer`, `/api/optimizer`, etc.).

---

## Option B — Vercel is connected to a different repo (e.g. under Nadavlistingsync)

### 1. Connect Vercel to Xeinst/Testfolio (if you have access)

1. Vercel → **testfolio** project → **Settings** → **Git**.
2. Under **Connected Git Repository**, click **Disconnect**.
3. Click **Connect Git Repository** → **GitHub** → choose **Xeinst** (if listed) → select **Testfolio**.
4. Go to **Deployments** → **Redeploy** (or push any commit to trigger a new deploy).

### 2. Or push this code to the repo Vercel is already using

1. On GitHub, create a new repository under the **same account** your Vercel project uses (e.g. **Nadavlistingsync**). Name it **Testfolio** (leave it empty, no README).
2. On your machine, in the Testfolio folder, run:

   ```bash
   git remote add vercel https://github.com/Nadavlistingsync/Testfolio.git
   git push vercel main
   ```

   (Replace `Nadavlistingsync` with your GitHub username if different.)  
   You may need to log in as that user (`gh auth login` or Git credentials) to push.
3. In Vercel, connect the project to **that** repo (or leave it connected) and **Redeploy** from the Deployments tab.

---

## After deploy

- **Root Directory**: leave empty (repo root has `frontend/` and `api/`).
- **Build** is set in `vercel.json`: `cd frontend && npm ci && npm run build`, output `frontend/dist`.
- **API routes** live under `/api/` (backtest, asset_analyzer, optimizer, efficient_frontier, rebalancing_sensitivity, tvm).
- No env vars required; the app uses same-origin `/api` when not on localhost.

Your live URL will be like: **https://testfolio-xxxx.vercel.app**
