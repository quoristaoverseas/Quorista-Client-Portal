import { initializeApp } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = (id) => document.getElementById(id);
$("year").textContent = new Date().getFullYear();

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = $("login-button");
  $("auth-message").textContent = "";
  button.disabled = true;
  button.textContent = "Signing in…";
  try {
    await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
  } catch (error) {
    $("auth-message").textContent = error.code === "auth/invalid-credential"
      ? "The email or password is incorrect."
      : error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Sign in";
  }
});

$("signout-button").addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    $("auth-view").classList.remove("hidden");
    $("dashboard-view").classList.add("hidden");
    return;
  }
  try {
    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists() || profileSnap.data().role !== "client" || profileSnap.data().accountStatus !== "active") {
      await signOut(auth);
      $("auth-message").textContent = "This account is not provisioned for Client Portal access. Please contact Quorista Overseas.";
      return;
    }
    $("welcome-title").textContent = "Welcome, " + (profileSnap.data().fullName || "Client");
    $("profile-email").textContent = profileSnap.data().email || user.email || "";
    $("auth-view").classList.add("hidden");
    $("dashboard-view").classList.remove("hidden");
  } catch (error) {
    $("auth-message").textContent = "Unable to load your profile. Please try again later.";
    console.error(error);
  }
});
