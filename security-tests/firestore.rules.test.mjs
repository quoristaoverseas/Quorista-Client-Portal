import fs from "node:fs";
import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp
} from "firebase/firestore";

const projectId = "demo-quorista-client-platform";
const superAdminUid = "oqgmvKDsJQc7WdDcjOVi5YIohAj1";
let testEnv;

const dbFor = (uid, email = `${uid}@example.com`) =>
  testEnv.authenticatedContext(uid, { email }).firestore();

async function seed() {
  await testEnv.clearFirestore();
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const put = (path, data) => setDoc(doc(db, path), data);
    await put("users/study1", { role: "study_counsellor", accountStatus: "active" });
    await put("staff/study1", { role: "counsellor", active: true, services: ["study_abroad"] });
    await put("users/tourism1", { role: "tourism_counsellor", accountStatus: "active" });
    await put("staff/tourism1", { role: "counsellor", active: true, services: ["tourism"] });
    await put("users/study2", { role: "study_counsellor", accountStatus: "active" });
    await put("staff/study2", { role: "counsellor", active: true, services: ["study_abroad"] });
    await put("users/inactive1", { role: "study_counsellor", accountStatus: "inactive" });
    await put("staff/inactive1", { role: "counsellor", active: true, services: ["study_abroad"] });
    await put("users/inactive2", { role: "study_counsellor", accountStatus: "active" });
    await put("staff/inactive2", { role: "counsellor", active: false, services: ["study_abroad"] });
    await put("users/mismatch1", { role: "study_counsellor", accountStatus: "active" });
    await put("staff/mismatch1", { role: "counsellor", active: true, services: ["study_abroad"] });
    await put("users/multi1", { role: "study_counsellor", accountStatus: "active" });
    await put("staff/multi1", { role: "counsellor", active: true, services: ["study_abroad", "tourism"] });

    await put("users/client1", {
      role: "client", accountStatus: "active", serviceType: "study_abroad",
      assignedCounsellorUid: "study1", fullName: "Test Client", email: "client1@example.com",
      phone: "+91 90000 00001"
    });
    await put("users/client2", {
      role: "client", accountStatus: "active", serviceType: "study_abroad",
      assignedCounsellorUid: "study2", fullName: "Other Client", email: "client2@example.com",
      phone: "+91 90000 00002"
    });
    await put("users/client3", {
      role: "client", accountStatus: "active", serviceType: "tourism",
      assignedCounsellorUid: "tourism1", fullName: "Tourism Client", email: "client3@example.com",
      phone: "+91 90000 00003"
    });
    await put("users/client4", {
      role: "client", accountStatus: "active", serviceType: "study_abroad",
      assignedCounsellorUid: "", fullName: "Unassigned Client", email: "client4@example.com",
      phone: "+91 90000 00004"
    });
    await put("users/client5", {
      role: "client", accountStatus: "active", serviceType: "study_abroad",
      assignedCounsellorUid: "multi1", fullName: "Multi-service Study Client", email: "client5@example.com",
      phone: "+91 90000 00005"
    });
    await put("users/client6", {
      role: "client", accountStatus: "active", serviceType: "tourism",
      assignedCounsellorUid: "multi1", fullName: "Multi-service Tourism Client", email: "client6@example.com",
      phone: "+91 90000 00006"
    });

    const application = (clientUid, applicationType, assignedCounsellorUid) => ({
      clientUid, applicationType, assignedCounsellorUid,
      applicantFullName: "Test Applicant", status: "registered", progressStatus: "registered",
      formData: {}, formVersion: 1, questionnaireStatus: "not_started"
    });
    await put("applications/app1", application("client1", "study_abroad", "study1"));
    await put("applications/app2", application("client2", "study_abroad", "study2"));
    await put("applications/app3", application("client3", "tourism", "tourism1"));
    await put("applications/app4", application("client4", "study_abroad", ""));
    await put("applications/app5", application("client3", "tourism", "mismatch1"));
    await put("applications/app6", application("client5", "study_abroad", "multi1"));
    await put("applications/app7", application("client6", "tourism", "multi1"));

    await put("status_updates/update1", {
      applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
      applicationType: "study_abroad", createdByUid: "study1", status: "registered",
      clientMessage: "Your case is registered.", hiddenFromClient: false, createdAt: new Date()
    });
    await put("status_updates/hiddenUpdate", {
      applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
      applicationType: "study_abroad", createdByUid: "study1", status: "under_review",
      clientMessage: "Private visibility test.", hiddenFromClient: true, createdAt: new Date()
    });
    await put("internal_notes/note1", {
      applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
      applicationType: "study_abroad", createdByUid: "study1", note: "Private staff note",
      createdAt: new Date()
    });
    await put("follow_ups/follow1", {
      applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
      applicationType: "study_abroad", createdByUid: "study1", followUpDate: "2026-12-01",
      action: "Call applicant", status: "pending", createdAt: new Date(), updatedAt: new Date()
    });
    await put("progress_cycles/cycle1", {
      applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
      applicationType: "study_abroad", createdByUid: "study1", status: "active"
    });
    await put("status_updates/tourismUpdate", {
      applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
      applicationType: "tourism", cycleId: "tourism-cycle", createdByUid: "tourism1",
      status: "requirements_review", clientMessage: "Travel requirements are being reviewed.",
      hiddenFromClient: false, createdAt: new Date()
    });
    await put("internal_notes/tourismNote", {
      applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
      applicationType: "tourism", createdByUid: "tourism1", note: "Tourism internal note",
      createdAt: new Date()
    });
    await put("follow_ups/tourismFollowUp", {
      applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
      applicationType: "tourism", createdByUid: "tourism1", followUpDate: "2026-12-05",
      action: "Confirm traveller details", status: "pending", createdAt: new Date(), updatedAt: new Date()
    });
    await put("progress_cycles/tourismCycle", {
      applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
      applicationType: "tourism", createdByUid: "tourism1", cycleNumber: 1,
      label: "Initial tourism cycle", reason: "Initial travel planning", status: "active",
      createdAt: new Date()
    });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId,
    firestore: { rules: fs.readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") }
  });
});
after(async () => {
  if (testEnv) await testEnv.cleanup();
});
beforeEach(seed);

test("counsellors can read only assigned cases in their mapped service", async () => {
  const studyDb = dbFor("study1");
  await assertSucceeds(getDoc(doc(studyDb, "applications/app1")));
  await assertFails(getDoc(doc(studyDb, "applications/app2")));
  await assertFails(getDoc(doc(studyDb, "applications/app3")));
  await assertFails(getDoc(doc(studyDb, "applications/app4")));

  const tourismDb = dbFor("tourism1");
  await assertSucceeds(getDoc(doc(tourismDb, "applications/app3")));
  await assertFails(getDoc(doc(tourismDb, "applications/app1")));
  await assertFails(getDoc(doc(tourismDb, "applications/app2")));
  await assertFails(getDoc(doc(tourismDb, "applications/app4")));
});

test("inactive or role/service-mismatched counsellors are denied", async () => {
  await assertFails(getDoc(doc(dbFor("inactive1"), "applications/app1")));
  await assertFails(getDoc(doc(dbFor("inactive2"), "applications/app1")));
  await assertFails(getDoc(doc(dbFor("mismatch1"), "applications/app3")));
  await assertFails(getDoc(doc(dbFor("mismatch1"), "applications/app1")));
  await assertFails(getDoc(doc(dbFor("mismatch1"), "applications/app5")));
});

test("a multi-service counsellor can query assigned cases and clients for each permitted service", async () => {
  const db = dbFor("multi1");
  const studyCases = query(collection(db, "applications"),
    where("assignedCounsellorUid", "==", "multi1"),
    where("applicationType", "==", "study_abroad"));
  const tourismCases = query(collection(db, "applications"),
    where("assignedCounsellorUid", "==", "multi1"),
    where("applicationType", "==", "tourism"));
  assert.equal((await assertSucceeds(getDocs(studyCases))).size, 1);
  assert.equal((await assertSucceeds(getDocs(tourismCases))).size, 1);

  const studyClients = query(collection(db, "users"),
    where("assignedCounsellorUid", "==", "multi1"),
    where("serviceType", "==", "study_abroad"),
    where("role", "==", "client"),
    where("accountStatus", "==", "active"));
  const tourismClients = query(collection(db, "users"),
    where("assignedCounsellorUid", "==", "multi1"),
    where("serviceType", "==", "tourism"),
    where("role", "==", "client"),
    where("accountStatus", "==", "active"));
  assert.equal((await assertSucceeds(getDocs(studyClients))).size, 1);
  assert.equal((await assertSucceeds(getDocs(tourismClients))).size, 1);
});

test("clients can read their own case and published updates, but not private staff records", async () => {
  const db = dbFor("client1");
  await assertSucceeds(getDoc(doc(db, "applications/app1")));
  await assertFails(getDoc(doc(db, "applications/app2")));
  const visibleUpdates = query(collection(db, "status_updates"), where("clientUid", "==", "client1"), where("hiddenFromClient", "==", false));
  assert.equal((await assertSucceeds(getDocs(visibleUpdates))).size, 1);
  await assertFails(getDoc(doc(db, "status_updates/hiddenUpdate")));
  await assertFails(getDocs(query(collection(db, "status_updates"), where("clientUid", "==", "client1"))));
  await assertFails(getDoc(doc(db, "internal_notes/note1")));
  await assertFails(getDoc(doc(db, "follow_ups/follow1")));
});

test("clients cannot change their role or counsellor assignment", async () => {
  const db = dbFor("client1");
  await assertFails(updateDoc(doc(db, "users/client1"), { role: "super_admin" }));
  await assertFails(updateDoc(doc(db, "applications/app1"), { assignedCounsellorUid: "client1" }));
});

test("counsellor queries must include the assignment and service constraints", async () => {
  const db = dbFor("study1");
  const safeQuery = query(
    collection(db, "status_updates"),
    where("applicationId", "==", "app1"),
    where("assignedCounsellorUid", "==", "study1"),
    where("applicationType", "==", "study_abroad")
  );
  const unsafeQuery = query(collection(db, "status_updates"), where("applicationId", "==", "app1"));
  await assertSucceeds(getDocs(safeQuery));
  await assertFails(getDocs(unsafeQuery));
  await assertSucceeds(getDoc(doc(db, "progress_cycles/cycle1")));
});

test("counsellors can create valid updates, private notes and follow-ups for assigned cases", async () => {
  const db = dbFor("study1");
  await assertSucceeds(addDoc(collection(db, "status_updates"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
    applicationType: "study_abroad", cycleId: "cycle1", createdByUid: "study1", status: "under_review",
    clientMessage: "Your profile is under review.", hiddenFromClient: false,
    createdAt: serverTimestamp()
  }));
  await assertSucceeds(addDoc(collection(db, "internal_notes"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
    applicationType: "study_abroad", createdByUid: "study1",
    note: "Internal review completed.", createdAt: serverTimestamp()
  }));
  const followUp = await assertSucceeds(addDoc(collection(db, "follow_ups"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
    applicationType: "study_abroad", createdByUid: "study1", followUpDate: "2026-12-02",
    action: "Follow up with applicant", status: "pending",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(db, "follow_ups"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "study1",
    applicationType: "study_abroad", createdByUid: "study1", followUpDate: "2026-12-03",
    action: "Invalid legacy status", status: "open", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(followUp, {
    status: "completed", completedAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(db, "internal_notes"), {
    applicationId: "app2", clientUid: "client2", assignedCounsellorUid: "study1",
    applicationType: "study_abroad", createdByUid: "study1",
    note: "Attempt to access another counsellor's case", createdAt: serverTimestamp()
  }));
});

test("Tourism-only counsellors can read and write Tourism records but never Study Abroad records", async () => {
  const db = dbFor("tourism1");
  await assertSucceeds(getDoc(doc(db, "users/client3")));
  await assertFails(getDoc(doc(db, "users/client1")));
  await assertSucceeds(getDoc(doc(db, "status_updates/tourismUpdate")));
  await assertSucceeds(getDoc(doc(db, "internal_notes/tourismNote")));
  await assertSucceeds(getDoc(doc(db, "follow_ups/tourismFollowUp")));
  await assertSucceeds(getDoc(doc(db, "progress_cycles/tourismCycle")));
  await assertFails(getDoc(doc(db, "status_updates/update1")));
  await assertFails(getDoc(doc(db, "internal_notes/note1")));
  await assertFails(getDoc(doc(db, "follow_ups/follow1")));
  await assertFails(getDoc(doc(db, "progress_cycles/cycle1")));

  await assertSucceeds(addDoc(collection(db, "status_updates"), {
    applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
    applicationType: "tourism", cycleId: "tourism-cycle", createdByUid: "tourism1",
    status: "requirements_review", clientMessage: "Your travel requirements are under review.",
    hiddenFromClient: false, createdAt: serverTimestamp()
  }));
  await assertSucceeds(addDoc(collection(db, "internal_notes"), {
    applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
    applicationType: "tourism", createdByUid: "tourism1",
    note: "Reviewed traveller preferences.", createdAt: serverTimestamp()
  }));
  await assertSucceeds(addDoc(collection(db, "follow_ups"), {
    applicationId: "app3", clientUid: "client3", assignedCounsellorUid: "tourism1",
    applicationType: "tourism", createdByUid: "tourism1", followUpDate: "2026-12-06",
    action: "Confirm itinerary", status: "pending",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertSucceeds(addDoc(collection(db, "progress_cycles"), {
    applicationId: "app3", clientUid: "client3", applicationType: "tourism",
    cycleNumber: 2, label: "Second tourism cycle", reason: "Revised itinerary",
    status: "active", createdByUid: "tourism1", assignedCounsellorUid: "tourism1",
    createdAt: serverTimestamp()
  }));

  await assertFails(addDoc(collection(db, "status_updates"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "tourism1",
    applicationType: "study_abroad", cycleId: "study-cycle", createdByUid: "tourism1",
    status: "under_review", clientMessage: "Cross-service attempt.",
    hiddenFromClient: false, createdAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(db, "internal_notes"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "tourism1",
    applicationType: "study_abroad", createdByUid: "tourism1",
    note: "Cross-service attempt.", createdAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(db, "follow_ups"), {
    applicationId: "app1", clientUid: "client1", assignedCounsellorUid: "tourism1",
    applicationType: "study_abroad", createdByUid: "tourism1", followUpDate: "2026-12-07",
    action: "Cross-service attempt", status: "pending",
    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(addDoc(collection(db, "progress_cycles"), {
    applicationId: "app1", clientUid: "client1", applicationType: "study_abroad",
    cycleNumber: 2, label: "Invalid cycle", reason: "Cross-service attempt",
    status: "active", createdByUid: "tourism1", assignedCounsellorUid: "tourism1",
    createdAt: serverTimestamp()
  }));
});

test("a Study Abroad-only counsellor cannot read Tourism client records", async () => {
  const db = dbFor("study1");
  await assertSucceeds(getDoc(doc(db, "users/client1")));
  await assertFails(getDoc(doc(db, "users/client3")));
  await assertFails(getDoc(doc(db, "applications/app3")));
  await assertFails(getDoc(doc(db, "status_updates/tourismUpdate")));
  await assertFails(getDoc(doc(db, "internal_notes/tourismNote")));
  await assertFails(getDoc(doc(db, "follow_ups/tourismFollowUp")));
  await assertFails(getDoc(doc(db, "progress_cycles/tourismCycle")));
});

test("progress cycles reject untrusted fields and non-owner archive writes", async () => {
  const db = dbFor("tourism1");
  await assertFails(addDoc(collection(db, "progress_cycles"), {
    applicationId: "app3", clientUid: "client3", applicationType: "tourism",
    cycleNumber: 2, label: "Invalid cycle", reason: "Unexpected field",
    status: "active", createdByUid: "tourism1", assignedCounsellorUid: "tourism1",
    createdAt: serverTimestamp(), privileged: true
  }));
  await assertFails(updateDoc(doc(db, "progress_cycles/tourismCycle"), {
    status: "archived", archivedAt: serverTimestamp(), archivedByUid: "someone-else",
    archiveReason: "Attempted spoof"
  }));
  await assertSucceeds(updateDoc(doc(db, "progress_cycles/tourismCycle"), {
    status: "archived", archivedAt: serverTimestamp(), archivedByUid: "tourism1",
    archiveReason: "Planning cycle completed"
  }));
});

test("Super Admin retains access across service types", async () => {
  const db = dbFor(superAdminUid);
  await assertSucceeds(getDoc(doc(db, "applications/app1")));
  await assertSucceeds(getDoc(doc(db, "applications/app3")));
  await assertSucceeds(getDoc(doc(db, "internal_notes/note1")));
});

test("registration requires phone, service choice and legal acceptance", async () => {
  const db = dbFor("newclient", "newclient@example.com");
  const base = {
    fullName: "New Client", email: "newclient@example.com", phone: "+91 90000 00005",
    serviceType: "study_abroad", assignedCounsellorUid: "", assignedCounsellorName: "",
    assignedCounsellorDesignation: "", role: "client", accountStatus: "active",
    createdAt: serverTimestamp(), authProvider: ["password"],
    legalAcceptance: {
      termsVersion: "2026-11-17-v1", privacyVersion: "2026-11-18-v1",
      acceptedAt: serverTimestamp(), method: "email_password_signup"
    }
  };
  await assertSucceeds(setDoc(doc(db, "users/newclient"), base));
  await assertSucceeds(setDoc(doc(db, "applications/newclient-case"), {
    clientUid: "newclient", applicantFullName: "New Client", applyingFor: "Myself",
    applicationType: "study_abroad", assignedCounsellorUid: "",
    assignedCounsellorName: "", assignedCounsellorDesignation: "",
    status: "registered", progressStatus: "registered",
    progressUpdate: "Your account is registered.", formVersion: 1, formData: {},
    questionnaireStatus: "not_started", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  }));
  await assertFails(setDoc(doc(db, "users/no-phone"), { ...base, phone: "" }));
  await assertFails(setDoc(doc(db, "users/no-consent"), { ...base, legalAcceptance: null }));
  await assertFails(setDoc(doc(db, "users/invalid-privacy-version"), { ...base, legalAcceptance: { ...base.legalAcceptance, privacyVersion: "unrecognised-version" } }));
});

test("clients can save optional questionnaire drafts without changing staff-controlled fields", async () => {
  const db = dbFor("client1");
  await assertSucceeds(updateDoc(doc(db, "applications/app1"), {
    applicantFullName: "Test Applicant Updated", formData: { preferredCountry: "South Korea" },
    questionnaireStatus: "draft", updatedAt: serverTimestamp()
  }));
  await assertSucceeds(updateDoc(doc(db, "applications/app1"), {
    applicantFullName: "Test Applicant Updated", formData: { preferredCountry: "South Korea" },
    questionnaireStatus: "completed", updatedAt: serverTimestamp()
  }));
  await assertFails(updateDoc(doc(db, "applications/app1"), {
    progressStatus: "completed", updatedAt: serverTimestamp()
  }));
});
