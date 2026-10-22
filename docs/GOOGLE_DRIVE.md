# Google Drive integration

Google Drive is optional. The portfolio still works with ordinary uploads and external links when Drive is not configured.

## Implemented flow

- Owner/administrator-only connection entry point.
- Google OAuth authorization-code flow with `state` validation and PKCE (`S256`).
- Server-side token exchange.
- AES-256-GCM encryption for stored access/refresh token data.
- Server-side token refresh.
- File search using Google Drive API metadata.
- File import into the portfolio media bucket for supported files.
- 10 MB import limit, MIME allowlist, basic file-signature checks, and streamed size enforcement.
- Disconnect deletes stored credentials and attempts provider token revocation.
- Integration actions are written to the audit log where configured RLS permits it.

The integration has not been exercised against a real Google Cloud project in this environment. Treat it as implemented code requiring configuration and end-to-end verification, not as a verified live connection.

## Configure Google Cloud

1. Create a Google Cloud project and enable the Google Drive API.
2. Configure the OAuth consent screen for the intended test/production audience.
3. Create an OAuth client of type **Web application**.
4. Add the exact authorised redirect URI: `https://YOUR_DOMAIN/api/integrations/google/callback` (for local development, `http://localhost:3000/api/integrations/google/callback`).
5. Configure these server environment variables:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_REDIRECT_URI` — must exactly match the configured URI.
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` — base64 encoding of 32 random bytes.
6. Generate a key in PowerShell with:

```powershell
$bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
[Convert]::ToBase64String($bytes)
```

7. Apply `database/migrations/001_initial_schema.sql` after reviewing it.
8. Restart the application, sign in as the owner/administrator, and connect Google Drive from `/admin/media`.

Never commit the client secret or encryption key. Use a separate encryption key per environment, keep it in the hosting platform's secret store, and rotate/reconnect if it is exposed.

## Access and file behaviour

The integration requests `drive.readonly`, `openid`, and `email`. The Drive scope is read-only but broad: it permits listing and importing existing files. Google classifies Drive read scopes as restricted for many app types, so a publicly distributed production app may require OAuth verification and additional review. Do not broaden the scope further. The browser receives file metadata and links, never OAuth tokens.

Supported imports include JPEG, PNG, WebP, GIF, PDF, DOCX, XLSX, and PPTX. Google Docs export to PDF, Sheets to XLSX, and Slides to PPTX. Imports are stored in the **public** `portfolio-assets` bucket. Therefore, import only files intended for public portfolio delivery; do not import private financial records, personal documents, or confidential company files.

A Drive link and an imported file are different:

- **Open in Drive** retains Drive's access controls.
- **Import asset** creates a copy in the portfolio's public storage. Publishing access is no longer controlled by the original Drive permissions.

## Required verification before production

- Confirm OAuth state mismatch and PKCE failure are rejected.
- Test first connection, reconnection, refresh-token preservation, and disconnect/revocation.
- Test inaccessible files, revoked access, API timeouts, and expired tokens.
- Test supported and unsupported MIME types, spoofed file signatures, and files over 10 MB.
- Verify imported content is intended for public delivery.
- Verify encrypted tokens never appear in API responses or logs.
- Verify RLS prevents editors and unauthorised users from managing connections.
- Test the complete flow using the actual configured Google Cloud project.
