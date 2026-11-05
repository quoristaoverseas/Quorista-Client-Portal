/**
 * Quorista Overseas — client progress email notifications
 *
 * Deploy as a Web App executing as the project owner. The Firebase ID token
 * supplied by the staff workspace is verified with Firebase Authentication.
 * Firestore REST reads are then made with that same token, so existing
 * Firestore Security Rules enforce staff/application/client access.
 *
 * Script Properties required:
 *   FIREBASE_API_KEY = the Firebase Web API key from firebase-config.js
 *   CLIENT_PORTAL_URL = https://quoristaoverseas.github.io/Quorista-Client-Portal/
 *
 * Do not add Gmail passwords or service-account private keys.
 */
const QO_PROJECT_ID = "quorista-client-platform";
const QO_ADMIN_UID = "oqgmvKDsJQc7WdDcjOVi5YIohAj1";
const QO_ALLOWED_ACTION = "sendProgressUpdate";

function doGet() {
  return ContentService.createTextOutput("Quorista notification service is running.");
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (payload.action !== QO_ALLOWED_ACTION) throw new Error("Unsupported action.");
    const applicationId = cleanId_(payload.applicationId);
    const eventId = cleanId_(payload.eventId);
    const idToken = String(payload.idToken || "");
    if (!applicationId || !eventId || !idToken) throw new Error("Missing required request fields.");

    const identity = verifyFirebaseToken_(idToken);
    const uid = identity.localId;
    const staff = firestoreGet_("staff/" + uid, idToken);
    if (!staff || staff.active !== true || !["counsellor", "super_admin"].includes(staff.role)) {
      throw new Error("This Firebase account is not an active authorised staff member.");
    }
    const isAdmin = uid === QO_ADMIN_UID || staff.role === "super_admin";
    const application = firestoreGet_("applications/" + applicationId, idToken);
    if (!application) throw new Error("Application not found or access denied.");
    if (!isAdmin && application.assignedCounsellorUid !== uid) {
      throw new Error("This staff member is not assigned to the application.");
    }

    const update = firestoreGet_("status_updates/" + eventId, idToken);
    if (!update || update.applicationId !== applicationId || update.clientUid !== application.clientUid) {
      throw new Error("The client-visible progress update could not be verified.");
    }
    if (update.hiddenFromClient === true) throw new Error("Hidden updates are not emailed.");

    const client = firestoreGet_("users/" + application.clientUid, idToken);
    if (!client || client.role !== "client" || client.accountStatus !== "active" || !validEmail_(client.email)) {
      throw new Error("The client account does not contain a valid registered email address.");
    }

    const props = PropertiesService.getScriptProperties();
    const sentKey = "sent_" + eventId;
    if (props.getProperty(sentKey)) return json_({ ok: true, duplicate: true });

    const status = String(update.status || application.progressStatus || "updated");
    const statusLabel = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    const clientMessage = String(update.clientMessage || "Your Quorista case progress has been updated.");
    const portalUrl = props.getProperty("CLIENT_PORTAL_URL") || "https://quoristaoverseas.github.io/Quorista-Client-Portal/";
    const service = application.applicationType === "study_abroad" ? "Study Abroad" : "International Tourism";
    const name = String(client.fullName || application.applicantFullName || "Client");
    const university = update.universityDetails || {};
    const details = [
      university.universityName ? "University: " + university.universityName : "",
      university.country ? "Country: " + university.country : "",
      university.programLevel ? "Programme: " + university.programLevel : "",
      university.intake ? "Intake: " + university.intake : ""
    ].filter(Boolean);
    const subject = "Your Quorista progress update: " + statusLabel;
    const plain = [
      "Dear " + name + ",",
      "",
      "There is a new update to your " + service + " case with Quorista Overseas.",
      "",
      "Current stage: " + statusLabel,
      "",
      clientMessage,
      details.length ? "\n" + details.join("\n") : "",
      "",
      "You can sign in to My Quorista to view your progress history:",
      portalUrl,
      "",
      "Regards,",
      "Quorista Overseas",
      "https://quoristaoverseas.in/"
    ].join("\n");

    const html = '<div style="font-family:Arial,sans-serif;color:#20213b;max-width:620px;margin:auto;line-height:1.6">' +
      '<div style="background:#09072e;padding:24px 28px;color:#fff"><div style="font-size:12px;letter-spacing:2px;color:#d7c89b">QUORISTA OVERSEAS</div><h2 style="margin:8px 0 0;font-size:22px">A progress update for you</h2></div>' +
      '<div style="padding:28px;border:1px solid #e8e7ef"><p>Dear ' + html_(name) + ',</p>' +
      '<p>There is a new update to your <strong>' + html_(service) + '</strong> case with Quorista Overseas.</p>' +
      '<div style="background:#f5f4fa;border-left:4px solid #b59a5b;padding:16px 18px;margin:20px 0"><div style="font-size:12px;color:#66617e;text-transform:uppercase;letter-spacing:1px">Current stage</div><strong style="font-size:18px">' + html_(statusLabel) + '</strong><p style="margin-bottom:0">' + html_(clientMessage).replace(/\n/g, "<br>") + '</p></div>' +
      (details.length ? '<p>' + details.map(html_).join("<br>") + '</p>' : '') +
      '<p style="margin:26px 0"><a href="' + html_(portalUrl) + '" style="background:#09072e;color:#fff;text-decoration:none;padding:12px 20px;border-radius:4px;display:inline-block">Open My Quorista</a></p>' +
      '<p>Regards,<br><strong>Quorista Overseas</strong><br><a href="https://quoristaoverseas.in/">quoristaoverseas.in</a></p></div>' +
      '<div style="padding:16px;text-align:center;color:#777;font-size:12px">This is an automated notification about a client-visible update in your Quorista account.</div></div>';

    lock.waitLock(20000);
    if (props.getProperty(sentKey)) return json_({ ok: true, duplicate: true });
    MailApp.sendEmail({ to: client.email, subject: subject, body: plain, htmlBody: html, name: "Quorista Overseas" });
    props.setProperty(sentKey, new Date().toISOString());
    return json_({ ok: true, sent: true });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return json_({ ok: false, error: String(error && error.message || error) });
  } finally {
    try { if (lock.hasLock()) lock.releaseLock(); } catch (_) {}
  }
}

function verifyFirebaseToken_(idToken) {
  const apiKey = PropertiesService.getScriptProperties().getProperty("FIREBASE_API_KEY");
  if (!apiKey) throw new Error("FIREBASE_API_KEY script property is not configured.");
  const response = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + encodeURIComponent(apiKey), {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  const data = JSON.parse(response.getContentText() || "{}");
  if (response.getResponseCode() !== 200 || !data.users || !data.users.length || !data.users[0].localId) {
    throw new Error("Firebase staff authentication failed.");
  }
  return data.users[0];
}

function firestoreGet_(documentPath, idToken) {
  const url = "https://firestore.googleapis.com/v1/projects/" + QO_PROJECT_ID +
    "/databases/(default)/documents/" + documentPath.split("/").map(encodeURIComponent).join("/");
  const response = UrlFetchApp.fetch(url, {
    method: "get",
    headers: { Authorization: "Bearer " + idToken },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() === 404) return null;
  if (response.getResponseCode() !== 200) throw new Error("Firestore verification failed for " + documentPath + " (HTTP " + response.getResponseCode() + ").");
  const doc = JSON.parse(response.getContentText() || "{}");
  return decodeFields_(doc.fields || {});
}

function decodeFields_(fields) {
  const out = {};
  Object.keys(fields).forEach(key => {
    const value = fields[key];
    if (Object.prototype.hasOwnProperty.call(value, "stringValue")) out[key] = value.stringValue;
    else if (Object.prototype.hasOwnProperty.call(value, "booleanValue")) out[key] = value.booleanValue;
    else if (Object.prototype.hasOwnProperty.call(value, "integerValue")) out[key] = Number(value.integerValue);
    else if (Object.prototype.hasOwnProperty.call(value, "doubleValue")) out[key] = Number(value.doubleValue);
    else if (Object.prototype.hasOwnProperty.call(value, "nullValue")) out[key] = null;
    else if (value.mapValue) out[key] = decodeFields_(value.mapValue.fields || {});
    else if (value.arrayValue) out[key] = (value.arrayValue.values || []).map(item => decodeFields_({ value: item }).value);
    else if (value.timestampValue) out[key] = value.timestampValue;
  });
  return out;
}

function cleanId_(value) {
  const id = String(value || "");
  return /^[A-Za-z0-9_-]{1,150}$/.test(id) ? id : "";
}
function validEmail_(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}
function html_(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
