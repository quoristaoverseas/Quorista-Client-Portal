import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp, collection, query, where, getDocs, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
const $ = (id) => document.getElementById(id);
let mode = "login";
let authActionInProgress = false;

$("year").textContent = new Date().getFullYear();
$("year-auth").textContent = new Date().getFullYear();

function setMessage(message, isError = true) {
  $("auth-message").textContent = message;
  $("auth-message").style.color = isError ? "#b3321f" : "#16815e";
}

function setMode(nextMode) {
  mode = nextMode;
  const signup = mode === "signup";
  $("auth-heading").textContent = signup ? "Create your account." : "Welcome back.";
  $("auth-intro").textContent = signup
    ? "Create your free client account and start your journey with Quorista Overseas."
    : "Sign in to continue your journey with Quorista Overseas.";
  $("name-field").classList.toggle("hidden", !signup);
  $("phone-field").classList.toggle("hidden", !signup);
  $("service-field").classList.toggle("hidden", !signup);
  $("full-name").required = signup;
  $("service-type").required = false;
  document.querySelectorAll('input[name="service-choice"]').forEach((choice) => {
    choice.required = signup;
    choice.checked = false;
  });
  $("service-type").value = "";
  $("phone").required = signup;
  $("full-name").value = "";
  $("phone").value = "";
  $("auth-submit").innerHTML = signup ? "Create account <span>→</span>" : "Sign in <span>→</span>";
  $("mode-prompt").textContent = signup ? "Already have an account?" : "New to Quorista?";
  $("mode-toggle").textContent = signup ? "Sign in" : "Create an account";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  setMessage("");
}

function showPage(page) {
  const validPages = ["overview", "profile", "applications", "counsellor"];
  const selected = validPages.includes(page) ? page : "overview";
  validPages.forEach((name) => {
    $("page-" + name).classList.toggle("hidden", name !== selected);
  });
  document.querySelectorAll(".dashboard-nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === selected);
  });
  const titles = {
    overview: ["Overview", "A clear view of your journey with us."],
    profile: ["My Profile", "Your registered account information."],
    applications: ["My Case & Requirements", "Your registered case, progress and optional requirements."],
    counsellor: ["My Counsellor", "Your personal guidance and support."]
  };
  $("page-title").textContent = titles[selected][0];
  $("page-subtitle").textContent = titles[selected][1];
  if (selected === "applications" && applicationUser) renderApplicationWorkspace();
  if (selected === "counsellor" && applicationUser) renderMyCounsellor();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function formatDate(value) {
  if (!value) return "Not available";
  const date = typeof value.toDate === "function" ? value.toDate() : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function providerLabel(providers = []) {
  const labels = providers.map((provider) => {
    if (provider === "google.com") return "Google";
    if (provider === "password") return "Email and password";
    return provider;
  });
  return labels.length ? [...new Set(labels)].join(", ") : "Not available";
}

function populateProfile(user, profile) {
  const name = profile.fullName || user.displayName || "Client";
  const email = profile.email || user.email || "Email not available";
  $("welcome-title").textContent = "Welcome, " + name;
  $("profile-name").textContent = name;
  $("profile-email").textContent = email;
  $("profile-avatar").textContent = name.trim().charAt(0).toUpperCase() || "Q";
  $("detail-name").textContent = name;
  $("detail-email").textContent = email;
  $("detail-phone").textContent = profile.phone || "Not provided";
  $("detail-provider").textContent = providerLabel(profile.authProvider || user.providerData.map((item) => item.providerId));
  $("detail-created").textContent = formatDate(profile.createdAt);
}

async function renderMyCounsellor() {
  const root = $("counsellor-workspace");
  if (!root || !applicationUser) return;
  root.innerHTML = '<div class="content-panel empty-panel"><p class="muted">Loading your counsellor details…</p></div>';
  try {
    const profileSnap = await getDoc(doc(db, "users", applicationUser.uid));
    const profile = profileSnap.exists() ? profileSnap.data() : {};
    if (!profile.assignedCounsellorUid) {
      root.innerHTML = '<div class="content-panel empty-panel"><div class="empty-illustration counsellor-illustration"><span>✧</span><i>✦</i></div><span class="section-kicker">PERSONAL GUIDANCE</span><h3>Your counsellor will appear here</h3><p>Your Quorista team will assign a counsellor to your account. They can contact you directly using the phone number and email you registered with, even before you complete the optional questionnaire.</p><div class="coming-soon-tag"><span></span> Awaiting counsellor assignment</div></div>';
      return;
    }
    const name = profile.assignedCounsellorName || "Quorista counsellor";
    const designation = profile.assignedCounsellorDesignation || "Counsellor";
    root.innerHTML = '<div class="counsellor-intro"><span class="section-kicker">YOUR QUORISTA SUPPORT</span><h3>Meet your counsellor</h3><p>Your assigned point of contact at Quorista Overseas.</p></div><div class="counsellor-card-grid"><article class="counsellor-profile-card"><div class="counsellor-profile-top"><div class="counsellor-avatar">' + escapeApplicationHtml((name.trim().charAt(0) || "Q").toUpperCase()) + '</div><div><span class="section-kicker">YOUR COUNSELLOR</span><h4>' + escapeApplicationHtml(name) + '</h4><p>' + escapeApplicationHtml(designation) + '</p></div></div><div class="counsellor-detail-row"><span>HOW TO CONNECT</span><strong>Your counsellor will contact you using the email address or phone number registered with your Quorista account.</strong></div></article></div>';
  } catch (error) {
    console.error("Could not load counsellor details:", error);
    root.innerHTML = '<div class="content-panel empty-panel"><h3>We could not load your counsellor details</h3><p>Please try again in a moment.</p></div>';
  }
}


/* Study Abroad application workspace */
const applicationSteps = [
  { title: "Applicant details", subtitle: "Tell us who this application is for." },
  { title: "Education background", subtitle: "Share your most recent academic information." },
  { title: "Study preferences", subtitle: "Tell us what and where you would like to study." },
  { title: "English proficiency", subtitle: "Share your current English-language test status." },
  { title: "Budget and funding", subtitle: "Help us understand your estimated study budget." },
  { title: "Plans and additional details", subtitle: "Tell us your preferred timeline and anything else we should know." },
  { title: "Review your application", subtitle: "Check your answers before saving or submitting." }
];
let applicationUser = null;
let applicationProfile = null;
let applicationDraftId = null;
let applicationStep = 0;
let applicationData = {};
let applicationBusy = false;

const applicationFields = [
  [
    ["applyingFor", "Who are you applying for?", "select", ["Myself", "My child", "Spouse / partner", "Another family member"]],
    ["applicantFullName", "Applicant's full name", "text"],
    ["dateOfBirth", "Date of birth", "date"],
    ["nationality", "Nationality", "text"],
    ["countryOfResidence", "Country of residence", "text"],
    ["applicantEmail", "Applicant's email address", "email"],
    ["applicantPhone", "Applicant's phone / WhatsApp number", "tel"]
  ],
  [
    ["highestQualification", "Highest qualification completed", "select", ["Secondary school", "Higher secondary / A-levels", "Diploma", "Bachelor's degree", "Master's degree", "Doctorate", "Other"]],
    ["studyField", "Main subject / field of study", "text"],
    ["institutionName", "Most recent institution", "text"],
    ["graduationYear", "Year completed (or expected)", "number"],
    ["academicScore", "Grades / percentage / GPA", "text"],
    ["backlogs", "Any pending or previous backlogs?", "select", ["No", "Yes", "Not applicable"]]
  ],
  [
    ["destinationCountries", "Preferred destination country / countries", "text"],
    ["studyLevel", "Level you want to study", "select", ["Foundation", "Undergraduate", "Postgraduate", "Doctorate", "Diploma / Certificate", "Not sure yet"]],
    ["subjectInterest", "Preferred course or subject", "text"],
    ["intake", "Preferred intake (month and year)", "text"],
    ["studyMode", "Preferred study mode", "select", ["On campus", "Online", "Flexible / hybrid", "Not sure yet"]]
  ],
  [
    ["englishTest", "English-language test status", "select", ["IELTS", "TOEFL", "PTE", "Duolingo English Test", "Other test", "Not taken yet", "Planning to take a test", "Test waiver may apply"]],
    ["englishScore", "Score (if available)", "text"],
    ["englishTestDate", "Test date (if taken)", "date"]
  ],
  [
    ["budgetCurrency", "Budget currency", "select", ["INR", "USD", "GBP", "EUR", "CAD", "AUD", "Other"]],
    ["annualBudget", "Estimated annual tuition budget", "text"],
    ["fundingSource", "How do you plan to fund your studies?", "select", ["Self-funded", "Parents / family", "Education loan", "Scholarship", "Combination of sources", "Not decided yet"]],
    ["scholarshipInterest", "Would you like scholarship guidance?", "select", ["Yes", "No", "Not sure"]]
  ],
  [
    ["startTimeline", "When would you like to begin?", "select", ["As soon as possible", "Within 3 months", "Within 6 months", "Within 12 months", "More than 12 months", "Just exploring"]],
    ["visaHistory", "Have you previously applied for an international study visa?", "select", ["No", "Yes — approved", "Yes — refused", "Prefer to discuss with counsellor"]],
    ["additionalNotes", "Anything else you'd like our counsellor to know?", "textarea"]
  ]
];

function escapeApplicationHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function applicationInput(field) {
  const [name, label, type, options] = field;
  const value = applicationData[name] || "";
  const safeValue = escapeApplicationHtml(value);
  if (type === "select") {
    return '<label class="application-field"><span>' + label + '</span><select name="' + name + '"><option value="">Select an option</option>' +
      options.map(option => '<option value="' + escapeApplicationHtml(option) + '"' + (value === option ? " selected" : "") + '>' + escapeApplicationHtml(option) + '</option>').join("") +
      '</select></label>';
  }
  if (type === "textarea") {
    return '<label class="application-field application-field-wide"><span>' + label + '</span><textarea name="' + name + '" rows="4" placeholder="Add any relevant details...">' + safeValue + '</textarea></label>';
  }
  return '<label class="application-field"><span>' + label + '</span><input name="' + name + '" type="' + type + '" value="' + safeValue + '" ' + (name === "applicantFullName" ? 'required ' : '') + 'placeholder="' + (type === "date" ? "" : "Enter " + label.toLowerCase()) + '"></label>';
}

function renderApplicationWorkspace() {
  const root = $("application-workspace");
  if (!root) return;
  if (applicationProfile?.serviceType === "tourism") {
    root.innerHTML = '<div class="application-topline"><div><span class="section-kicker">INTERNATIONAL TOURISM</span><h3>Your tourism case is registered</h3><p>Your Quorista team will discuss your destination, travel dates and requirements with you. You do not need to complete the Study Abroad questionnaire.</p></div></div><div class="application-drafts"><div id="application-list" class="application-list"><p class="muted">Loading your case…</p></div></div>';
    loadClientApplications();
    return;
  }
  root.innerHTML = `
    <div class="application-topline"><div><span class="section-kicker">STUDY ABROAD</span><h3>Optional requirements questionnaire</h3><p>Share these details if you wish. Your case already exists and your counsellor can contact you even if you skip this questionnaire.</p></div><span class="application-private"><i></i> Private to your Quorista team</span></div>
    <div class="application-layout">
      <aside class="application-steps">${applicationSteps.map((step, index) => '<button type="button" class="application-step ' + (index === applicationStep ? 'active ' : '') + (index < applicationStep ? 'completed' : '') + '" data-app-step="' + index + '"><span class="step-number">' + (index < applicationStep ? '✓' : String(index + 1).padStart(2, "0")) + '</span><span><strong>' + step.title + '</strong><small>' + (index === 6 ? 'Final check' : 'Section ' + (index + 1)) + '</small></span></button>').join("")}</aside>
      <div class="application-form-panel">
        <div class="application-progress"><span style="width:${((applicationStep + 1) / applicationSteps.length) * 100}%"></span></div>
        <div class="application-step-heading"><span>STEP ${String(applicationStep + 1).padStart(2, "0")} OF 07</span><h4>${applicationSteps[applicationStep].title}</h4><p>${applicationSteps[applicationStep].subtitle}</p></div>
        <div id="application-fields" class="application-fields"></div>
        <div class="application-message" id="application-message" role="status" aria-live="polite"></div>
        <div class="application-actions"><button type="button" class="button-secondary" id="application-back" ${applicationStep === 0 ? "disabled" : ""}>Back</button><div><button type="button" class="button-secondary" id="application-save">Save draft</button><button type="button" class="application-primary" id="application-next">${applicationStep === 6 ? "Save requirements" : "Continue"} <span>→</span></button></div></div>
      </div>
    </div>
    <div class="application-drafts"><div><span class="section-kicker">YOUR WORKSPACE</span><h3>Your case</h3></div><div id="application-list" class="application-list"><p class="muted">Loading your applications…</p></div></div>`;
  const fieldsRoot = $("application-fields");
  if (applicationStep === 6) {
    fieldsRoot.innerHTML = '<div class="application-review">' + applicationFields.flat().map(([name,label]) => '<div class="review-item"><span>' + label + '</span><strong>' + (applicationData[name] ? escapeApplicationHtml(applicationData[name]) : 'Not provided') + '</strong></div>').join("") + '</div><p class="application-review-note">Please review your details carefully. Once submitted, this application will be shared with your assigned Quorista counsellor and cannot be edited from this form.</p>';
  } else {
    fieldsRoot.innerHTML = '<div class="application-fields-grid">' + applicationFields[applicationStep].map(applicationInput).join("") + '</div>';
  }
  fieldsRoot.querySelectorAll("input,select,textarea").forEach(input => {
    input.addEventListener("input", () => { applicationData[input.name] = input.value; });
    input.addEventListener("change", () => { applicationData[input.name] = input.value; });
  });
  root.querySelectorAll("[data-app-step]").forEach(button => button.addEventListener("click", () => {
    collectApplicationFields();
    applicationStep = Number(button.dataset.appStep);
    renderApplicationWorkspace();
  }));
  $("application-back").addEventListener("click", () => { collectApplicationFields(); applicationStep = Math.max(0, applicationStep - 1); renderApplicationWorkspace(); });
  $("application-next").addEventListener("click", async () => {
    collectApplicationFields();
    if (applicationStep < 6) {
      if (!validateApplicationStep()) return;
      applicationStep++;
      renderApplicationWorkspace();
    } else {
      await saveApplication(true);
    }
  });
  $("application-save").addEventListener("click", () => { collectApplicationFields(); saveApplication(false); });
  loadClientApplications();
}

function collectApplicationFields() {
  document.querySelectorAll("#application-fields [name]").forEach(input => {
    applicationData[input.name] = input.value.trim();
  });
}

function validateApplicationStep() {
  if (applicationStep === 0 && !applicationData.applicantFullName) {
    showApplicationMessage("Please enter the applicant's full name.");
    return false;
  }
  showApplicationMessage("");
  return true;
}

function showApplicationSubmittedPopup() {
  const existing = document.getElementById("application-success-modal");
  if (existing) existing.remove();
  const modal = document.createElement("div");
  modal.id = "application-success-modal";
  modal.className = "application-success-overlay";
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-labelledby", "application-success-title");
  modal.innerHTML = `
    <div class="application-success-card">
      <div class="application-success-icon" aria-hidden="true">✓</div>
      <span class="section-kicker">APPLICATION SUBMITTED</span>
      <h3 id="application-success-title">Thank you for submitting your application!</h3>
      <p>Your application has been received successfully. Your Quorista counsellor will contact you soon to discuss the next steps.</p>
      <button type="button" id="application-success-close">Continue to my dashboard</button>
    </div>`;
  document.body.appendChild(modal);
  const close = () => modal.remove();
  document.getElementById("application-success-close").addEventListener("click", close);
  modal.addEventListener("click", event => { if (event.target === modal) close(); });
  document.addEventListener("keydown", function onEscape(event) {
    if (event.key === "Escape" && document.getElementById("application-success-modal")) {
      close();
      document.removeEventListener("keydown", onEscape);
    }
  });
  document.getElementById("application-success-close").focus();
}

function showApplicationMessage(message, isError = true) {
  const node = $("application-message");
  if (node) {
    node.textContent = message;
    node.classList.toggle("error", isError);
  }
}

async function saveApplication(submit) {
  if (applicationBusy || !applicationUser) return;
  if (submit && !applicationData.applicantFullName) { applicationStep = 0; renderApplicationWorkspace(); showApplicationMessage("Please enter the applicant's full name."); return; }
  applicationBusy = true;
  const saveButton = $("application-save"), nextButton = $("application-next");
  if (saveButton) saveButton.disabled = true;
  if (nextButton) nextButton.disabled = true;
  try {
    const snapshot = await getDocs(query(collection(db, "applications"), where("clientUid", "==", applicationUser.uid)));
    if (snapshot.empty) throw new Error("Your registered case could not be found. Please contact Quorista support.");
    const existingCase = snapshot.docs[0];
    await updateDoc(doc(db, "applications", existingCase.id), {
      applicantFullName: applicationData.applicantFullName || applicationProfile?.fullName || "",
      applyingFor: applicationData.applyingFor || "Myself",
      formData: applicationData,
      questionnaireStatus: "completed",
      questionnaireUpdatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    applicationDraftId = existingCase.id;
    showApplicationMessage("Your optional requirements questionnaire has been saved to your existing case. No new application was created.", false);
    await loadClientApplications();
  } catch (error) {
    console.error("Requirements questionnaire save failed:", error);
    showApplicationMessage(error.message || "We couldn't save your requirements. Please try again.");
  } finally {
    applicationBusy = false;
    if ($("application-save")) $("application-save").disabled = false;
    if ($("application-next")) $("application-next").disabled = false;
  }
}
async function loadClientApplications() {
  const list = $("application-list");
  if (!list || !applicationUser) return;
  try {
    const ownApplications = query(collection(db, "applications"), where("clientUid", "==", applicationUser.uid));
    const snapshot = await getDocs(ownApplications);
    if (snapshot.empty) {
      list.innerHTML = '<p class="muted">No saved applications yet. Your first application can be started above.</p>';
      return;
    }
    const updateSnapshot = await getDocs(query(collection(db, "status_updates"), where("clientUid", "==", applicationUser.uid)));
    const updatesByApplication = new Map();
    updateSnapshot.docs.forEach(updateDoc => {
      const update = updateDoc.data();
      const bucket = updatesByApplication.get(update.applicationId) || [];
      bucket.push(update);
      updatesByApplication.set(update.applicationId, bucket);
    });
    list.innerHTML = snapshot.docs.map(item => {
      const data = item.data();
      const status = data.questionnaireStatus === "completed" ? "Requirements shared" : "Case registered";
      const progress = (data.progressStatus || "registered").replaceAll("_", " ");
      const progressLabel = progress.charAt(0).toUpperCase() + progress.slice(1);
      const counsellor = data.assignedCounsellorName || "";
      const update = data.progressUpdate || "";
      const history = (updatesByApplication.get(item.id) || []).sort((a,b) => {
        const av = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
        const bv = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
        return bv - av;
      });
      const historyMarkup = history.length ? '<div class="client-progress-history"><strong>Progress history</strong>' + history.map(entry => '<div class="client-progress-entry"><span>' + escapeApplicationHtml(formatDate(entry.createdAt)) + '</span><p>' + escapeApplicationHtml(entry.clientMessage || "Your application status has been updated.") + '</p></div>').join("") + '</div>' : '';
      const serviceLabel = data.applicationType === "tourism" ? "International Tourism" : "Study Abroad";
      return '<article class="application-list-item"><div><strong>' + escapeApplicationHtml(data.applicantFullName || "Client case") + '</strong><span>' + escapeApplicationHtml(status) + ' · ' + serviceLabel + '</span></div>' +
        '<div class="application-submitted-label">Case progress: ' + escapeApplicationHtml(progressLabel) + '</div>' +
        '<div class="client-case-details"><p><strong>Assigned counsellor:</strong> ' + escapeApplicationHtml(counsellor || "Not assigned yet") + '</p><p><strong>Latest update:</strong> ' + escapeApplicationHtml(update || "Your case is registered. Your counsellor will contact you about the next steps.") + '</p>' + historyMarkup + '</div></article>';
    }).join("");
    list.querySelectorAll("[data-resume-app]").forEach(button => button.addEventListener("click", async () => {
      const id = button.dataset.resumeApp;
      const record = snapshot.docs.find(item => item.id === id);
      if (!record) return;
      applicationDraftId = id;
      applicationData = { ...(record.data().formData || {}) };
      applicationStep = 0;
      renderApplicationWorkspace();
    }));
  } catch (error) {
    console.error("Could not load client applications:", error);
    list.innerHTML = '<p class="muted">Your applications could not be loaded right now.</p>';
  }
}

function showDashboard(user, profile) {
  applicationUser = user;
  applicationProfile = profile;
  document.body.classList.add("dashboard-active");
  populateProfile(user, profile);
  $("auth-view").classList.add("hidden");
  $("dashboard-view").classList.remove("hidden");
  $("auth-footer").classList.add("hidden");
  showPage("overview");
}

async function ensureClientProfile(user, fullName = "", phone = "", serviceType = "") {
  const userRef = doc(db, "users", user.uid);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    const data = existing.data();
    if (data.role !== "client" || data.accountStatus !== "active") {
      await signOut(auth);
      throw new Error("This account is not authorized for Client Portal access. Please use the correct portal.");
    }
    return data;
  }
  const name = fullName || user.displayName || (user.email ? user.email.split("@")[0] : "Client");
  const normalizedPhone = String(phone || "").trim();
  if (!normalizedPhone) throw new Error("Please provide your phone / WhatsApp number, including country code, to create your client profile.");
  if (!["study_abroad", "tourism"].includes(serviceType)) throw new Error("Please select either Study Abroad or International Tourism.");
  const profile = {
    serviceType,
    fullName: name,
    email: user.email || "",
    phone: normalizedPhone,
    assignedCounsellorUid: "",
    assignedCounsellorName: "",
    assignedCounsellorDesignation: "",
    role: "client",
    accountStatus: "active",
    createdAt: serverTimestamp(),
    authProvider: user.providerData.map((provider) => provider.providerId)
  };
  await setDoc(userRef, profile);
  await ensureClientCase(user, profile);
  const saved = await getDoc(userRef);
  return saved.exists() ? saved.data() : profile;
}

async function ensureClientCase(user, profile) {
  if (!["study_abroad", "tourism"].includes(profile?.serviceType)) return null;
  const existing = await getDocs(query(collection(db, "applications"), where("clientUid", "==", user.uid)));
  if (!existing.empty) return existing.docs[0].id;
  const caseRef = doc(collection(db, "applications"));
  await setDoc(caseRef, {
    clientUid: user.uid, applicantFullName: profile.fullName || user.displayName || "Client", applyingFor: "Myself",
    applicationType: profile.serviceType, assignedCounsellorUid: "", assignedCounsellorName: "",
    assignedCounsellorDesignation: "", status: "registered", progressStatus: "registered",
    progressUpdate: "Your account is registered. A Quorista team member will review your details and contact you about the next steps.",
    formVersion: 1, formData: {}, questionnaireStatus: "not_started", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
  });
  return caseRef.id;
}

async function loadExistingClient(user) {
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  if (!profileSnap.exists() || profileSnap.data().role !== "client" || profileSnap.data().accountStatus !== "active") {
    await signOut(auth);
    throw new Error("This account is not authorized for Client Portal access. Please use the correct portal.");
  }
  const profile = profileSnap.data();
  if (profile.serviceType) await ensureClientCase(user, profile);
  showDashboard(user, profile);
}

$("mode-toggle").addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

document.querySelectorAll('input[name="service-choice"]').forEach((choice) => {
  choice.addEventListener("change", () => {
    $("service-type").value = choice.value;
  });
});

document.querySelectorAll(".dashboard-nav-item").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.page));
});
document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.go));
});
$("signout-button").addEventListener("click", () => signOut(auth));
$("mobile-signout").addEventListener("click", () => signOut(auth));

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authActionInProgress) return;
  authActionInProgress = true;
  const button = $("auth-submit");
  button.disabled = true;
  $("google-button").disabled = true;
  setMessage("");
  try {
    if (mode === "signup") {
      const fullName = $("full-name").value.trim();
      const phone = $("phone").value.trim();
      const serviceType = $("service-type").value;
      if (!fullName) throw new Error("Please enter your full name.");
      if (!["study_abroad", "tourism"].includes(serviceType)) throw new Error("Please select Study Abroad or International Tourism.");
      if (!phone) throw new Error("Please enter your phone / WhatsApp number, including country code.");
      const credential = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
      await updateProfile(credential.user, { displayName: fullName });
      const profile = await ensureClientProfile(credential.user, fullName, phone, serviceType);
      showDashboard(credential.user, profile);
    } else {
      const credential = await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
      await loadExistingClient(credential.user);
    }
  } catch (error) {
    const messages = {
      "auth/email-already-in-use": "An account already exists with this email. Please sign in instead.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Please choose a password with at least 6 characters.",
      "auth/invalid-credential": "The email or password is incorrect.",
      "auth/popup-closed-by-user": "Google sign-in was closed before completion.",
      "auth/popup-blocked": "Your browser blocked the Google sign-in window. Please allow pop-ups and try again.",
      "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method. Sign in with that method first."
    };
    if (auth.currentUser && error.code !== "auth/invalid-credential") await signOut(auth).catch(() => {});
    setMessage(messages[error.code] || error.message || "Unable to complete sign-in. Please try again.");
    console.error(error);
  } finally {
    authActionInProgress = false;
    button.disabled = false;
    $("google-button").disabled = false;
  }
});

$("google-button").addEventListener("click", async () => {
  if (authActionInProgress) return;
  authActionInProgress = true;
  $("google-button").disabled = true;
  $("auth-submit").disabled = true;
  setMessage("");
  try {
    if (mode === "signup" && (!$("full-name").value.trim() || !$("phone").value.trim() || !["study_abroad", "tourism"].includes($("service-type").value))) throw new Error("Enter your name and phone number, then select one service before continuing with Google.");
    const credential = await signInWithPopup(auth, googleProvider);
    const existingProfile = await getDoc(doc(db, "users", credential.user.uid));
    if (existingProfile.exists()) {
      const profile = existingProfile.data();
      if (profile.role !== "client" || profile.accountStatus !== "active") throw new Error("This account is not authorised for Client Portal access.");
      if (profile.serviceType) await ensureClientCase(credential.user, profile);
      showDashboard(credential.user, profile);
    } else if (mode === "signup") {
      const fullName = $("full-name").value.trim();
      const profile = await ensureClientProfile(credential.user, fullName, $("phone").value.trim(), $("service-type").value);
      showDashboard(credential.user, profile);
    } else {
      await signOut(auth);
      setMode("signup");
      $("email").value = credential.user.email || "";
      $("full-name").value = credential.user.displayName || "";
      throw new Error("To create a new account with Google, choose Create an account, enter your phone / WhatsApp number, then continue with Google.");
    }
  } catch (error) {
    const messages = {
      "auth/popup-closed-by-user": "Google sign-in was closed before completion.",
      "auth/popup-blocked": "Your browser blocked the Google sign-in window. Please allow pop-ups and try again.",
      "auth/account-exists-with-different-credential": "An account already exists with this email using another sign-in method. Please sign in with that method first."
    };
    if (auth.currentUser && error.code !== "auth/account-exists-with-different-credential") await signOut(auth).catch(() => {});
    setMessage(messages[error.code] || error.message || "Google sign-in could not be completed.");
    console.error(error);
  } finally {
    authActionInProgress = false;
    $("google-button").disabled = false;
    $("auth-submit").disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (authActionInProgress) return;
  if (!user) {
    applicationUser = null;
    applicationProfile = null;
    applicationDraftId = null;
    applicationData = {};
    document.body.classList.remove("dashboard-active");
    $("auth-view").classList.remove("hidden");
    $("dashboard-view").classList.add("hidden");
    $("auth-footer").classList.remove("hidden");
    return;
  }
  try {
    await loadExistingClient(user);
  } catch (error) {
    setMessage(error.message || "Unable to load your profile. Please try again later.");
    console.error(error);
  }
});