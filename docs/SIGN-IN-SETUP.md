# Google + Apple sign-in, and saved passwords

The code is in the app. The "Continue with Apple" and "Continue with Google" buttons stay
hidden until you switch them on in step 4, so it's safe to merge before setup.

Your Supabase project's callback URL is used several times below. Find it in
**Supabase → Authentication → Sign In / Providers → Google** (or **Apple**), under "Callback URL".
It looks like `https://<project-ref>.supabase.co/auth/v1/callback`.

## 1. Supabase redirect URLs (2 min)

Go to **Supabase → Authentication → URL Configuration**.

- **Site URL:** `https://henalytics.com`
- **Redirect URLs:** add both of these
  - `https://henalytics.com/**`
  - `henalytics://auth-callback`

## 2. Google (about 10 min)

1. Go to <https://console.cloud.google.com> and pick or create a project.
2. Set up **APIs & Services → OAuth consent screen**:
   - App name: Henalytics
   - Support email: yours
   - Authorized domain: `henalytics.com`
   - Then **Publish app**.
3. Go to **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: your Supabase callback URL
4. Copy the **Client ID** and **Client secret**.
5. In **Supabase → Authentication → Sign In / Providers → Google**, turn it on, paste both, and save.

## 3. Apple (about 15 min, needs your Apple Developer account)

At <https://developer.apple.com/account/resources>:

1. **Identifiers:** open App ID `com.henalytics.app` and tick **Sign in with Apple**. Save.
2. **Identifiers → + → Services IDs:**
   - Description: Henalytics Sign In
   - Identifier: `com.henalytics.app.signin`
   - Register it, then open it, tick **Sign in with Apple → Configure**:
     - Primary App ID: `com.henalytics.app`
     - Domains: `<project-ref>.supabase.co`
     - Return URLs: your Supabase callback URL
3. **Keys → +:**
   - Name it, tick **Sign in with Apple → Configure**, and choose `com.henalytics.app`.
   - Download the `.p8` file (you only get one chance) and note the **Key ID**.
   - Your Team ID is `32S8LFT6HD`.
4. In **Supabase → Authentication → Sign In / Providers → Apple**, turn it on:
   - **Client IDs:** `com.henalytics.app.signin`
   - **Secret Key:** generate it from the `.p8`, Key ID and Team ID using the tool linked on that Supabase page, then paste it and save.

   ⚠️ Apple makes this secret expire after **6 months**. Set a calendar reminder to generate a new one, or Apple sign-in will stop working.

## 4. Turn the buttons on

Go to **Supabase → Table Editor → `app_config` → Insert row**:

- `id`: `auth_providers`
- `value`: `{"google": true, "apple": true}`

You can start with only one, e.g. `{"google": true}`. Set a value to `false`, or delete the row, to hide the buttons again. This takes effect right away, with no app update needed.

On the **iPhone app**, Apple requires the Apple button whenever the Google button is shown. Keep both on.

## 5. Saved passwords ("save this login" / autofill)

The sign-in form now uses the field labels that password managers look for. On the website, iCloud Keychain, Google Password Manager and browser password managers will offer to save and fill the login.

In the **iPhone app**, this is already set up: `ios/App/App/App.entitlements` has the Associated Domains entry `webcredentials:henalytics.com`, and the matching file is in the website at `/.well-known/apple-app-site-association`.

In the **Android app**, Google Password Manager saving works as is. To link it with saved henalytics.com passwords too, go to **Play Console → Test and release → App integrity → App signing** and copy the **SHA-256 certificate fingerprint**. Send it over and an `assetlinks.json` gets added.

## 6. Account deletion with Sign in with Apple

Apple requires apps that offer Sign in with Apple to revoke the user's Apple tokens when they delete their account (App Store guideline 5.1.1(v)). This is built in:

- Right after an Apple sign-in, the app saves Apple's refresh token to `public.apple_auth_tokens`, through the `save_apple_refresh_token` function. The app can't read that table back. The SQL is in `supabase/migrations/20261103c_apple_token_revoke.sql`.
- `api/delete-account.js` sends that token to Apple's revoke endpoint before deleting the account. The deletion email to the owner reports whether it worked.
- **The Apple key:** `api/delete-account.js` signs the revoke request with the `AuthKey_794HU6VJF5.p8` key, stored encrypted in Supabase Vault as `apple_private_key`. To store or replace it, paste the file into `docs/apple-key-to-vault.sql` and run it in the SQL editor.
  - Alternatively, a Vercel env var `APPLE_PRIVATE_KEY` takes priority if it's set.
  - `APPLE_KEY_ID`, `APPLE_TEAM_ID` and `APPLE_CLIENT_ID` default to `794HU6VJF5`, `32S8LFT6HD` and `com.henalytics.app.signin`.
- To check it's working: after an Apple sign-in, `select user_id, updated_at from public.apple_auth_tokens;` shows a row.

## Good to know

- **Existing accounts:** someone who signs in with Google or Apple using the same email as their existing account gets the same account and data. Supabase links them automatically.
- **Hide My Email:** if someone picks this on Apple, Apple gives Henalytics a private relay address. That becomes a separate account from an email/password one.
- **Staying signed in** already works. Sessions are saved on the device and refresh automatically, so people stay signed in until they sign out.
