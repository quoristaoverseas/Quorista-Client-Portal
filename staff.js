import {initializeApp} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,query,where,updateDoc,serverTimestamp} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const ADMIN_UID="oqgmvKDsJQc7WdDcjOVi5YIohAj1";
let currentUser=null,staffProfile=null,isAdmin=false;
$("year").textContent=new Date().getFullYear();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(id,text,ok=false){$(id).textContent=text;$(id).style.color=ok?"#23835f":"#a33228";}
function servicesLabel(a=[]){return a.map(x=>x==="study_abroad"?"Study Abroad":"International Tourism").join(" · ")||"No service permission";}
async function enterWorkspace(user){
 currentUser=user;isAdmin=user.uid===ADMIN_UID;
 const snap=await getDoc(doc(db,"staff",user.uid));
 staffProfile=snap.exists()?snap.data():null;
 if(isAdmin&&staffProfile&&staffProfile.fullName!=="Adarsh Srivastava"){
  await updateDoc(doc(db,"staff",user.uid),{fullName:"Adarsh Srivastava",updatedAt:serverTimestamp()});
  staffProfile={...staffProfile,fullName:"Adarsh Srivastava"};
 }
 if(!isAdmin&&(!staffProfile||staffProfile.active!==true)){await signOut(auth);throw new Error("This account has not been authorised for staff access. Contact your Quorista administrator.");}
 $("login-panel").classList.add("hidden");$("workspace").classList.remove("hidden");
 $("welcome").textContent="Welcome, "+(staffProfile?.fullName||user.displayName||"Administrator");
 $("roleline").textContent=isAdmin?"Super Admin · Counsellor access":"Counsellor · "+servicesLabel(staffProfile.services||[]);
 $("admin-panel").classList.toggle("hidden",!isAdmin);
 $("owner-profile-panel").classList.toggle("hidden",!isAdmin||!!staffProfile);
 await loadStaff();await loadCases();
}
async function loadStaff(){
 if(!isAdmin)return;
 const snap=await getDocs(collection(db,"staff"));const list=$("staff-list");
 const records=snap.docs.map(d=>({uid:d.id,...d.data()}));
 list.innerHTML=records.length?records.map(s=>{
  const locked=s.role==="super_admin"||s.uid===ADMIN_UID;
  const checked=(service)=>((s.services||[]).includes(service)?"checked":"");
  return '<article class="staff-item" data-staff-card="'+esc(s.uid)+'">'+
   '<div class="item-head"><div><strong>'+esc(s.fullName||"Staff member")+'</strong><br><small>'+esc(s.email||"")+' · '+esc(s.designation||"Counsellor")+'</small></div><span class="pill '+(s.active?"active":"inactive")+'">'+(s.active?"Active":"Inactive")+'</span></div>'+
   '<div class="muted">UID: '+esc(s.uid)+'</div>'+
   '<div class="staff-edit-grid">'+
    '<label>Full name<input data-edit-name value="'+esc(s.fullName||"")+'" required></label>'+
    '<label>Email<input data-edit-email type="email" value="'+esc(s.email||"")+'" required></label>'+
    '<label>Designation<input data-edit-title value="'+esc(s.designation||"Counsellor")+'" required></label>'+
   '</div>'+
   '<fieldset class="staff-permissions"><legend>Permitted services</legend>'+
    '<label class="check"><input data-edit-service="study_abroad" type="checkbox" '+checked("study_abroad")+'> Study Abroad</label>'+
    '<label class="check"><input data-edit-service="tourism" type="checkbox" '+checked("tourism")+'> International Tourism</label>'+
   '</fieldset>'+
   '<div class="staff-actions"><button class="primary" type="button" data-staff-save="'+esc(s.uid)+'">Save changes</button>'+
   (locked?'<span class="muted">Administrator profile is protected</span>':'<button class="secondary" type="button" data-staff-toggle="'+esc(s.uid)+'" data-active="'+(!!s.active)+'">'+(s.active?"Deactivate access":"Reactivate access")+'</button>')+
   '</div><p class="message" data-staff-message></p></article>';
 }).join(""):'<div class="empty">No staff profiles created yet.</div>';
 list.querySelectorAll("[data-staff-save]").forEach(btn=>btn.addEventListener("click",async()=>{
  const card=btn.closest("[data-staff-card]");const services=[...card.querySelectorAll("[data-edit-service]:checked")].map(x=>x.dataset.editService);
  const note=card.querySelector("[data-staff-message]");
  if(!services.length){note.textContent="Select at least one service permission.";return;}
  const fullName=card.querySelector("[data-edit-name]").value.trim();
  const email=card.querySelector("[data-edit-email]").value.trim();
  const designation=card.querySelector("[data-edit-title]").value.trim();
  if(!fullName||!email||!designation){note.textContent="Complete all profile fields.";return;}
  btn.disabled=true;
  try{await updateDoc(doc(db,"staff",btn.dataset.staffSave),{fullName,email,designation,services,updatedAt:serverTimestamp()});note.style.color="#23835f";note.textContent="Profile updated.";await loadStaff();}
  catch(e){note.textContent="Could not update profile: "+e.message;}
  finally{btn.disabled=false;}
 }));
 list.querySelectorAll("[data-staff-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{
  const uid=btn.dataset.staffToggle;const active=btn.dataset.active==="true";
  const action=active?"deactivate":"reactivate";
  if(!confirm("Are you sure you want to "+action+" this counsellor's staff access?"))return;
  btn.disabled=true;
  try{await updateDoc(doc(db,"staff",uid),{active:!active,updatedAt:serverTimestamp()});await loadStaff();}
  catch(e){alert("Could not change staff access: "+e.message);btn.disabled=false;}
 }));
}
async function loadCases(){
 const root=$("case-list");root.innerHTML='<p class="muted">Loading applications…</p>';
 try{
  let snap;
  let docs=[];
  if(isAdmin){const all=await getDocs(collection(db,"applications"));docs=all.docs;}
  else{const permitted=staffProfile?.services||[];const batches=await Promise.all(permitted.map(service=>getDocs(query(collection(db,"applications"),where("assignedCounsellorUid","==",currentUser.uid),where("applicationType","==",service)))));docs=batches.flatMap(batch=>batch.docs);}
  const records=docs.map(d=>({id:d.id,...d.data()})).filter(a=>a.status==="submitted");
  if(!records.length){root.innerHTML='<div class="empty">No submitted applications are currently assigned to this account.</div>';return;}
  const staffSnap=isAdmin?await getDocs(collection(db,"staff")):null;
  const staff=staffSnap?staffSnap.docs.map(d=>({uid:d.id,...d.data()})).filter(s=>s.active):[];
  root.innerHTML=records.map(a=>{
   const choices=staff.filter(s=>(s.services||[]).includes(a.applicationType)).map(s=>'<option value="'+esc(s.uid)+'" '+(a.assignedCounsellorUid===s.uid?'selected':'')+'>'+esc(s.fullName)+' · '+esc(servicesLabel(s.services))+'</option>').join("");
   const assignment=isAdmin?'<label>Assign counsellor<select data-assign="'+a.id+'"><option value="">Unassigned</option>'+choices+'</select></label>':'';
   const statusOptions=["submitted","under_review","contacted","in_progress","awaiting_client","completed","on_hold"].map(v=>'<option value="'+v+'" '+((a.progressStatus||"submitted")===v?"selected":"")+'>'+v.replaceAll("_"," ")+'</option>').join("");
   return '<article class="case-item"><div class="item-head"><div><strong>'+esc(a.applicantFullName||"Study Abroad applicant")+'</strong><br><small>'+esc(a.applyingFor||"Myself")+' · '+esc(a.applicationType)+'</small></div><span class="pill">'+esc((a.progressStatus||"submitted").replaceAll("_"," "))+'</span></div><div class="case-meta"><span class="muted">Client UID: '+esc(a.clientUid)+'</span><span class="muted">Assigned: '+esc(a.assignedCounsellorUid||"Not assigned")+'</span></div><div class="case-controls">'+assignment+'<label>Progress status<select data-status="'+a.id+'">'+statusOptions+'</select></label><label>Client-visible progress update<textarea data-note="'+a.id+'" placeholder="Write a concise update for the client">'+esc(a.progressUpdate||"")+'</textarea></label><button class="primary" data-save="'+a.id+'">Save update</button></div></article>';
  }).join("");
  root.querySelectorAll("[data-assign]").forEach(el=>el.addEventListener("change",async()=>{try{const uid=el.value||null;const chosen=staff.find(function(person){return person.uid===uid;});await updateDoc(doc(db,"applications",el.dataset.assign),{assignedCounsellorUid:uid,assignedCounsellorName:chosen?chosen.fullName:"",assignedCounsellorDesignation:chosen?chosen.designation:"",assignedAt:serverTimestamp(),updatedAt:serverTimestamp()});await loadCases();}catch(e){alert(e.message);}}));
  root.querySelectorAll("[data-save]").forEach(btn=>btn.addEventListener("click",async()=>{const id=btn.dataset.save;btn.disabled=true;try{const patch={progressStatus:root.querySelector('[data-status="'+id+'"]').value,progressUpdate:root.querySelector('[data-note="'+id+'"]').value.trim(),lastProgressUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()};await updateDoc(doc(db,"applications",id),patch);message("login-message","");await loadCases();}catch(e){alert("Could not save update: "+e.message);}finally{btn.disabled=false;}}));
 }catch(e){console.error(e);root.innerHTML='<div class="empty">Applications could not be loaded. Check the published Firestore rules and try again.</div>';}
}
$("login-form").addEventListener("submit",async e=>{e.preventDefault();$("login-button").disabled=true;message("login-message","");try{const c=await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);await enterWorkspace(c.user);}catch(err){message("login-message",err.message||"Sign-in failed.");if(auth.currentUser)await signOut(auth).catch(()=>{});}finally{$("login-button").disabled=false;}});
$("staff-form").addEventListener("submit",async e=>{e.preventDefault();const services=[...document.querySelectorAll('input[name="service"]:checked')].map(x=>x.value);if(!services.length){message("staff-message","Select at least one permitted service.");return;}const uid=$("staff-uid").value.trim();if(!uid||uid===ADMIN_UID){message("staff-message","Enter the counsellor's own Firebase Authentication UID. Your administrator account is already reserved.");return;}try{const existing=await getDoc(doc(db,"staff",uid));if(existing.exists()){message("staff-message","A profile already exists for this UID. Edit it in the Authorised staff list instead; existing access was not changed.");return;}await setDoc(doc(db,"staff",uid),{fullName:$("staff-name").value.trim(),email:$("staff-email").value.trim(),designation:$("staff-title").value.trim(),role:"counsellor",services,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});message("staff-message","Counsellor profile created successfully.",true);e.target.reset();$("staff-title").value="Study Abroad Counsellor";await loadStaff();}catch(err){message("staff-message","Could not save: "+err.message);}});
$("activate-owner").addEventListener("click",async()=>{try{await setDoc(doc(db,"staff",currentUser.uid),{fullName:"Adarsh Srivastava",email:currentUser.email||"",designation:"Co-Founder & Immigration Consultant",role:"super_admin",services:["study_abroad"],active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await enterWorkspace(currentUser);}catch(e){message("owner-message",e.message);}});
$("refresh").addEventListener("click",loadCases);$("signout").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{if(!user)return;try{await enterWorkspace(user);}catch(e){message("login-message",e.message);}});
