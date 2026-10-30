import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
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
  $("full-name").required = signup;
  $("full-name").value = "";
  $("auth-submit").innerHTML = signup ? "Create account <span>→</span>" : "Sign in <span>→</span>";
  $("mode-prompt").textContent = signup ? "Already have an account?" : "New to Quorista?";
  $("mode-toggle").textContent = signup ? "Sign in" : "Create an account";
  $("password").autocomplete = signup ? "new-password" : "current-password";
  setMessage("");
}
function showDashboard(user, profile) {
  $("welcome-title").textContent = "Welcome, " + (profile.fullName || user.displayName || "Client");
  $("profile-email").textContent = profile.email || user.email || "";
  $("auth-view").classList.add("hidden");
  $("dashboard-view").classList.remove("hidden");
}
$("mode-toggle").addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

async function ensureClientProfile(user, fullName = "") {
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
  const profile = {
    fullName: name,
    email: user.email || "",
    role: "client",
    accountStatus: "active",
    createdAt: serverTimestamp(),
    authProvider: user.providerData.map((provider) => provider.providerId)
  };
  await setDoc(userRef, profile);
  return profile;
}
async function loadExistingClient(user) {
  const profileSnap = await getDoc(doc(db, "users", user.uid));
  if (!profileSnap.exists() || profileSnap.data().role !== "client" || profileSnap.data().accountStatus !== "active") {
    await signOut(auth);
    throw new Error("This account is not authorized for Client Portal access. Please use the correct portal.");
  }
  showDashboard(user, profileSnap.data());
}

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
      if (!fullName) throw new Error("Please enter your full name.");
      const credential = await createUserWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
      await updateProfile(credential.user, { displayName: fullName });
      const profile = await ensureClientProfile(credential.user, fullName);
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
    const credential = await signInWithPopup(auth, googleProvider);
    const profile = await ensureClientProfile(credential.user);
    showDashboard(credential.user, profile);
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

$("signout-button").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (authActionInProgress) return;
  if (!user) {
    $("auth-view").classList.remove("hidden");
    $("dashboard-view").classList.add("hidden");
    return;
  }
  try {
    await loadExistingClient(user);
  } catch (error) {
    setMessage(error.message || "Unable to load your profile. Please try again later.");
    console.error(error);
  }
});
