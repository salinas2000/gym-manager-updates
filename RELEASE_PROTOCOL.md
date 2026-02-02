# 🚀 Gym Manager Pro - Release Protocol

Follow this checklist to build and ship a production version.

## 1. Pre-Flight Checks
- [ ] **Dependencies**: Ensure all deps are installed (`npm install`).
- [ ] **Environment**: Check `.env` contains the correct Production Supabase Keys.
    - `SUPABASE_URL`: Your Project URL
    - `SUPABASE_KEY`: Service Role Key (Server) or Anon Key (if Auth implemented).
- [ ] **Database Schema**: Ensure `supabase_schema.sql` has been applied to the cloud instance.

## 2. Testing
- [ ] **Smoke Test**: Run the app locally (`npm run dev`).
    - Verify "Activation Window" behaves correctly.
    - Create a test user "Smoke Test".
    - Check database console for `[LOCAL_DB] Integrity: ✅ OK`.
    - Verify Cloud Sync (Check Supabase Dashboard).

## 3. Versioning
- [ ] **Bump Version**: Update `package.json` version.
    ```bash
    npm version patch  # 1.0.6 -> 1.0.7
    ```

## 4. Build & Ship
- [ ] **Build Command**:
    ```bash
    npm run build
    ```
- [ ] **Output**: Check `dist/` folder for the `.exe` (Windows) or `.dmg` (Mac).
- [ ] **Test Artifact**: Run the generated `.exe` on a clean VM or Sandbox if possible.

## 5. Deployment
- [ ] **GitHub Release**: Upload the artifacts to GitHub Releases.
- [ ] **Auto-Update**: The app is configured to check `salinas2000/gym-manager-updates`. Ensure the release is tagged correctly (e.g., `v1.0.7`).

## Troubleshooting
- **White Screen on Launch**: Check `main.js` debug logs. Usually means `preload.js` path is wrong in production.
- **Database Error**: Check `AppData/Roaming/Gym Manager Pro/logs/`.
- **Sync Fails**: Verify `gym_id` match between License and Cloud RLS.
