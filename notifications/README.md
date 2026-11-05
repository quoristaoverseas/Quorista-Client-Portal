# Client progress email notifications

This folder contains a separate Google Apps Script mailer. It does not replace or modify the existing website enquiry Apps Script, Google Sheets, Firebase project, or Firestore rules.

## What sends an email

The Staff Workspace requests an email only after a Firestore batch successfully creates a client-visible `status_updates` record:
- Save case update
- Start a new progress cycle

Internal notes and follow-up records do not trigger email. The mailer reads the update document itself and refuses to send if it is marked hidden.

## Security model

1. The staff workspace sends its current Firebase ID token, application ID and exact status-update document ID.
2. Apps Script verifies the token with Firebase Authentication.
3. Apps Script reads the staff profile, application, status update and client profile from Firestore REST using that same ID token.
4. Those reads are subject to the existing Firestore Security Rules. The server checks active staff status and assignment (or the existing super-admin UID) before sending.
5. The destination email is taken only from the registered client profile. The request cannot supply an arbitrary recipient.
6. A Script Properties key prevents repeat sends for the same status-update ID.

No Firebase Admin SDK private key, Gmail password or secret is placed in browser code. The Firebase Web API key is a public project configuration value; configure it as a Script Property rather than embedding it in the new endpoint source.

## Setup (one-time)

### 1. Create the separate Apps Script project

1. Sign in to the Quorista Google account that should send client emails.
2. Open https://script.google.com/ and create a **new standalone project** named `Quorista Client Notifications`.
3. Replace the editor contents with `notifications/Code.gs` from this repository.
4. Save the project.

Do not open or edit the existing enquiry Apps Script project.

### 2. Add Script Properties

In Apps Script, open **Project Settings → Script Properties** and add:

| Property | Value |
|---|---|
| `FIREBASE_API_KEY` | The `apiKey` value from the existing `firebase-config.js` file in this repository |
| `CLIENT_PORTAL_URL` | `https://quoristaoverseas.github.io/Quorista-Client-Portal/` |

The API key is the Firebase Web API key, not a service-account key or password.

### 3. Deploy as a Web App

1. Select **Deploy → New deployment**.
2. Choose type **Web app**.
3. Set **Execute as** to your account.
4. Set access to **Anyone** so the static staff site can reach the endpoint. This does not make email sending unauthenticated: every POST must contain a valid Firebase ID token and pass Firestore Security Rules checks.
5. Deploy and approve the Google permissions requested for external requests and sending email.
6. Copy the Web App URL ending in `/exec`.

Keep the URL private to the staff workspace configuration. Do not share it as a public website link.

### 4. Configure the Staff Workspace

In `staff.js`, replace the value of `CLIENT_NOTIFICATION_ENDPOINT` with the deployed Web App URL. Commit that one-line configuration to the feature branch, then merge the reviewed pull request and allow GitHub Pages to publish.

The notification request uses `fetch` in `no-cors` mode because Apps Script ContentService redirects responses across Google domains. The browser cannot inspect the mailer's response; Apps Script execution logs are the source of delivery errors.

## Test checklist before production use

Use one controlled test client account with an email address you can access.

1. Deploy the Apps Script and configure the endpoint.
2. Publish the staff workspace update only after reviewing the pull request.
3. Sign in to Staff Workspace as an active assigned counsellor (or the super admin).
4. Save one client-visible status update.
5. Confirm the Firestore status update is present, the client receives exactly one email, and the email links to My Quorista.
6. Add a private internal note in a separate update and confirm the email contains only the client-visible message, never the private note.
7. Check Apps Script **Executions** if an email does not arrive. MailApp quota and recipient spam filtering may affect delivery.

## Important behaviour and limitations

- Firestore is committed first. A later email failure never rolls back or misreports the case update.
- The staff browser cannot know whether the email was delivered because Apps Script's ContentService response is cross-origin and intentionally opaque.
- A repeat request for the same status-update document ID is suppressed after successful send.
- Email is sent from the Google account that owns the Apps Script deployment, subject to Google's current MailApp quotas.
- The existing Firestore rules are relied on for access checks; this implementation does not change or deploy any rules.
