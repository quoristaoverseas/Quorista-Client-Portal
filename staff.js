import {initializeApp} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-app.js";
import {getAuth,signInWithEmailAndPassword,onAuthStateChanged,signOut} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-auth.js";
import {getFirestore,doc,getDoc,setDoc,collection,getDocs,query,where,updateDoc,writeBatch,serverTimestamp,deleteField} from "https://www.gstatic.com/firebasejs/12.5.0/firebase-firestore.js";
import {firebaseConfig} from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getFirestore(app),$=id=>document.getElementById(id);
const ADMIN_UID="oqgmvKDsJQc7WdDcjOVi5YIohAj1";
let currentUser=null,staffProfile=null,isAdmin=false;
$("year").textContent=new Date().getFullYear();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function message(id,text,ok=false){$(id).textContent=text;$(id).style.color=ok?"#23835f":"#a33228";}
function showStaffToast(text){let node=$("staff-save-toast");if(!node){node=document.createElement("div");node.id="staff-save-toast";node.className="staff-save-toast";node.setAttribute("role","status");document.body.appendChild(node);}node.textContent=text;node.classList.add("visible");clearTimeout(node._hideTimer);node._hideTimer=setTimeout(()=>node.classList.remove("visible"),3200);}
function servicesLabel(a=[]){return a.map(x=>x==="study_abroad"?"Study Abroad":"International Tourism").join(" · ")||"No service permission";}
async function removeLegacyCounsellorEmails(){
 const [usersSnap,applicationsSnap]=await Promise.all([getDocs(collection(db,"users")),getDocs(collection(db,"applications"))]);
 const targets=[
  ...usersSnap.docs.filter(d=>Object.prototype.hasOwnProperty.call(d.data(),"assignedCounsellorEmail")).map(d=>doc(db,"users",d.id)),
  ...applicationsSnap.docs.filter(d=>Object.prototype.hasOwnProperty.call(d.data(),"assignedCounsellorEmail")).map(d=>doc(db,"applications",d.id))
 ];
 for(let start=0;start<targets.length;start+=450){
  const batch=writeBatch(db);
  targets.slice(start,start+450).forEach(ref=>batch.update(ref,{assignedCounsellorEmail:deleteField()}));
  await batch.commit();
 }
}


const STUDY_PROGRESS_STAGES=[
 ["Case received",["registered","submitted","under_review"]],
 ["Counselling & profile",["counselling_scheduled","profile_assessment"]],
 ["Documents",["documents_pending","documents_under_review"]],
 ["University selection",["university_shortlisting","shortlist_shared"]],
 ["University applications",["university_application","application_preparation","application_submitted","application_under_review","additional_information_requested"]],
 ["Admission & deposit",["offer_received","offer_conditions_pending","offer_accepted","deposit_pending","deposit_paid"]],
 ["Visa & departure",["visa_documentation","visa_appointment_scheduled","visa_submitted","visa_decision","pre_departure","travel_ready"]],
 ["Other",["awaiting_client","on_hold","completed"]]
];
const TOURISM_PROGRESS_STAGES=[
 ["Case & consultation",["registered","submitted","under_review","consultation_scheduled","requirements_review"]],
 ["Travel planning",["itinerary_planning","itinerary_shared","quotation_shared"]],
 ["Bookings",["booking_confirmation_pending","bookings_confirmed"]],
 ["Documents & visa",["documents_pending","visa_documentation","visa_appointment_scheduled","visa_submitted","visa_decision"]],
 ["Travel",["travel_ready","trip_in_progress","trip_completed"]],
 ["Other",["awaiting_client","on_hold","completed"]]
];
const PROGRESS_STATUS_LABELS={
 registered:"Case Registered",submitted:"Application Submitted",under_review:"Initial Review",
 counselling_scheduled:"Counselling Scheduled",profile_assessment:"Profile Assessment",
 documents_pending:"Documents Required",documents_under_review:"Documents Under Review",
 university_shortlisting:"University Shortlisting",shortlist_shared:"University Shortlist Shared",
 university_application:"University Application In Progress",application_preparation:"Application Preparation",
 application_submitted:"University Application Submitted",application_under_review:"University Reviewing Application",
 additional_information_requested:"University Requested More Information",offer_received:"Admission Offer Received",
 offer_conditions_pending:"Offer Conditions Pending",offer_accepted:"Admission Offer Accepted",
 deposit_pending:"Tuition Deposit Pending",deposit_paid:"Tuition Deposit Confirmed",
 visa_documentation:"Visa Documents Preparation",visa_appointment_scheduled:"Visa Appointment Scheduled",
 visa_submitted:"Visa Application Submitted",visa_decision:"Visa Decision Received",
 pre_departure:"Pre-departure Preparation",travel_ready:"Ready for Travel",
 consultation_scheduled:"Travel Consultation Scheduled",requirements_review:"Travel Requirements Review",
 itinerary_planning:"Itinerary Planning",itinerary_shared:"Travel Itinerary Shared",quotation_shared:"Travel Quotation Shared",
 booking_confirmation_pending:"Booking Confirmation Pending",bookings_confirmed:"Bookings Confirmed",
 trip_in_progress:"Trip In Progress",trip_completed:"Trip Completed",
 awaiting_client:"Awaiting Your Response",on_hold:"Case Temporarily On Hold",completed:"Case Completed"
};
const UNIVERSITY_PROGRESS_STATUSES=["university_shortlisting","shortlist_shared","university_application","application_preparation","application_submitted","application_under_review","additional_information_requested","offer_received","offer_conditions_pending","offer_accepted","deposit_pending","deposit_paid"];
const CLIENT_STATUS_MESSAGES={
 registered:"Your Quorista case has been created. Our team will review the information available and guide you through the next steps.",
 submitted:"Your application details have been submitted to Quorista. The team will now check the information and confirm the next action.",
 under_review:"A Quorista team member is reviewing your case details. We will contact you if clarification or additional information is needed.",
 counselling_scheduled:"A counselling discussion has been scheduled. Your counsellor will connect with you at the agreed time to discuss your goals and next steps.",
 profile_assessment:"Your academic profile and study preferences are being assessed so that the guidance and options shared with you are relevant to your plans.",
 documents_pending:"Some documents or information are still required to move your case forward. Please review the request from your counsellor and share the pending items.",
 documents_under_review:"The documents you provided are being checked for completeness and consistency. We will let you know if anything needs to be corrected or added.",
 university_shortlisting:"Your study preferences and profile are being matched against suitable universities and programmes. The shortlist is being prepared for discussion.",
 shortlist_shared:"Your university shortlist has been prepared and shared for your review. Please discuss your preferred options with your counsellor before the application stage.",
 university_application:"Your university application is in progress. The team is coordinating the application requirements and will share the next milestone as it is reached.",
 application_preparation:"The application for the selected programme is being prepared. Your counsellor is checking the required information and supporting documents before submission.",
 application_submitted:"The university application has been submitted. It is now with the institution for processing; the next update will be shared when the university responds or requests anything further.",
 application_under_review:"The university is reviewing the submitted application. Processing timelines can vary by institution, and we will keep you informed when a decision or request is received.",
 additional_information_requested:"The university has requested additional information or supporting documents. Your counsellor will guide you on what is needed so the response can be prepared.",
 offer_received:"An admission offer has been received from the university. Your counsellor will help you understand the offer details, conditions and response deadline.",
 offer_conditions_pending:"The admission offer includes conditions that must be met. Your counsellor will explain the outstanding requirements and the documents or results needed.",
 offer_accepted:"The admission offer has been accepted. The team will guide you through the next university requirements, including any applicable deposit and enrolment steps.",
 deposit_pending:"The university deposit is pending. Please review the amount, payment instructions and deadline shared by your counsellor before making a payment.",
 deposit_paid:"The university deposit has been recorded as paid. The team will proceed with the next enrolment and visa-preparation steps as applicable.",
 visa_documentation:"Your visa documentation is being prepared and checked. Your counsellor will identify any missing documents before the application is lodged.",
 visa_appointment_scheduled:"A visa appointment has been scheduled. Please follow the appointment instructions and keep the required original documents ready.",
 visa_submitted:"Your visa application has been submitted to the relevant authorities. The decision is outside Quorista's control; we will share updates when available.",
 visa_decision:"A visa decision has been received. Your counsellor will explain the next steps based on the decision and the official communication.",
 pre_departure:"Your case has reached pre-departure preparation. The team will help you review practical arrangements and important information before travel.",
 travel_ready:"Your preparation has reached the travel-ready stage. Please check the latest travel documents, dates and instructions shared by your counsellor.",
 consultation_scheduled:"A consultation about your travel requirements has been scheduled. Your counsellor will discuss your preferences, dates and suitable arrangements.",
 requirements_review:"Your travel requirements are being reviewed, including destination, dates, traveller details and any relevant documentation.",
 itinerary_planning:"Your travel preferences are being used to prepare a suitable itinerary. The proposed route and arrangements will be shared for your review.",
 itinerary_shared:"Your proposed travel itinerary has been shared. Please review the dates, route and inclusions with your counsellor before confirming arrangements.",
 quotation_shared:"A travel quotation has been prepared and shared for your review. Please check the inclusions, exclusions, validity and payment terms before proceeding.",
 booking_confirmation_pending:"The requested travel arrangements are awaiting confirmation. Bookings should be treated as confirmed only after the relevant provider issues confirmation.",
 bookings_confirmed:"The relevant travel bookings have been confirmed. Please keep the confirmations accessible and review the dates and traveller details carefully.",
 trip_in_progress:"Your planned travel period is now in progress. Please follow the confirmed itinerary and contact your counsellor if you need assistance with the arrangements made through Quorista.",
 trip_completed:"The planned travel period has been marked complete. We hope your journey went smoothly and welcome any feedback about the arrangements.",
 awaiting_client:"We are waiting for information, documents or a decision from you before proceeding. Please check the latest request and contact your counsellor if you need clarification.",
 on_hold:"Your case has been temporarily placed on hold. The latest update from your counsellor will explain the reason and what is needed to resume progress.",
 completed:"The current case has been marked complete by the Quorista team. Please contact your counsellor if you need clarification or further assistance."
};
function progressStatusLabel(status){return PROGRESS_STATUS_LABELS[status]||String(status||"registered").replaceAll("_"," ").replace(/\b\w/g,letter=>letter.toUpperCase());}
function progressStatusOptions(groups,current){
 const known=new Set(groups.flatMap(group=>group[1]));
 const legacy= current&&!known.has(current)?[[ "Existing status", [current] ]]:[];
 return [...groups,...legacy].map(([group,values])=>'<optgroup label="'+esc(group)+'">'+values.map(value=>'<option value="'+value+'" '+(current===value?"selected":"")+'>'+esc(progressStatusLabel(value))+'</option>').join("")+'</optgroup>').join("");
}

function showWorkspaceView(view){
 const allowed=["overview","clients","cases","followups","team"];
 const selected=allowed.includes(view)?view:"overview";
 document.querySelectorAll(".workspace-view").forEach(section=>section.classList.toggle("hidden",section.id!=="view-"+selected));
 document.querySelectorAll(".workspace-nav").forEach(button=>button.classList.toggle("active",button.dataset.view===selected));
}
document.querySelectorAll("[data-view]").forEach(button=>button.addEventListener("click",()=>showWorkspaceView(button.dataset.view)));
document.querySelectorAll("[data-go]").forEach(button=>button.addEventListener("click",()=>showWorkspaceView(button.dataset.go)));

async function enterWorkspace(user){
 currentUser=user;isAdmin=user.uid===ADMIN_UID;if(isAdmin)await removeLegacyCounsellorEmails();
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
 document.querySelectorAll(".admin-only").forEach(button=>button.classList.toggle("hidden",!isAdmin));
 $("view-team").classList.toggle("hidden",!isAdmin);
 showWorkspaceView("overview");
 $("owner-profile-panel").classList.toggle("hidden",!isAdmin||!!staffProfile);
 await loadStaff();await loadClientDirectory();await loadCases();await loadFollowUps();
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
async function loadClientDirectory(){
 const root=$("client-directory-list");
 if(!root)return;
 root.innerHTML='<p class="muted">Loading client accounts…</p>';
 try{
  let snap;
  if(isAdmin) snap=await getDocs(collection(db,"users"));
  else snap=await getDocs(query(collection(db,"users"),where("assignedCounsellorUid","==",currentUser.uid)));
  const clients=snap.docs.map(d=>({uid:d.id,...d.data()})).filter(c=>c.role==="client"&&c.accountStatus==="active");
  clients.sort((a,b)=>{
   const av=a.createdAt?.toMillis?a.createdAt.toMillis():new Date(a.createdAt||0).getTime();
   const bv=b.createdAt?.toMillis?b.createdAt.toMillis():new Date(b.createdAt||0).getTime();
   return bv-av;
  });
  $("client-directory-count").textContent=clients.length+" registered client"+(clients.length===1?"":"s");
  let activeStaff=[];
  if(isAdmin){
   const staffSnap=await getDocs(collection(db,"staff"));
   activeStaff=staffSnap.docs.map(d=>({uid:d.id,...d.data()})).filter(s=>s.active);
  }
  if(!clients.length){
   root.innerHTML='<div class="empty">No registered client accounts yet. New sign-ups will appear here automatically.</div>';
   return;
  }
  root.innerHTML=clients.map(c=>{
   const assignmentOptions=activeStaff.map(s=>'<option value="'+esc(s.uid)+'" '+(c.assignedCounsellorUid===s.uid?'selected':'')+'>'+esc(s.fullName||s.email)+' · '+esc(servicesLabel(s.services||[]))+'</option>').join("");
   const assigned=c.assignedCounsellorName?'<span class="pill active">'+esc(c.assignedCounsellorName)+'</span>':'<span class="pill inactive">Unassigned</span>';
   const assignmentControl=isAdmin?'<div class="client-assign-control"><label>Assign counsellor<select data-client-assign="'+esc(c.uid)+'"><option value="">Leave unassigned</option>'+assignmentOptions+'</select></label><button class="primary" type="button" data-client-save="'+esc(c.uid)+'">Save assignment</button></div>':'';
   const phone=c.phone?'<a href="tel:'+esc(c.phone)+'">'+esc(c.phone)+'</a>':'<span class="muted">Not provided</span>';
   const email=c.email?'<a href="mailto:'+esc(c.email)+'">'+esc(c.email)+'</a>':'<span class="muted">Not provided</span>';
   const date=formatCaseDate(c.createdAt);
   return '<article class="client-directory-card" data-client-card="'+esc(c.uid)+'"><div class="item-head"><div><strong>'+esc(c.fullName||"Client")+'</strong><br><small>Registered '+esc(date)+'</small></div>'+assigned+'</div><div class="client-directory-meta"><div><span>EMAIL</span>'+email+'</div><div><span>PHONE / WHATSAPP</span>'+phone+'</div><div><span>QUESTIONNAIRE</span><strong>Optional · '+(c.questionnaireCompleted?"Completed":"Not completed")+'</strong></div><div><span>ACCOUNT</span><strong>Active client</strong></div></div>'+assignmentControl+'</article>';
  }).join("");
  root.querySelectorAll("[data-client-save]").forEach(button=>button.addEventListener("click",async()=>{
   const uid=button.dataset.clientSave;
   const card=button.closest("[data-client-card]");
   const selectedUid=card.querySelector("[data-client-assign]").value;
   const selected=activeStaff.find(s=>s.uid===selectedUid);
   button.disabled=true;button.textContent="Saving…";
   try{
    const assignment={
     assignedCounsellorUid:selected?selected.uid:"",
     assignedCounsellorName:selected?selected.fullName||"Counsellor":"",
     assignedCounsellorDesignation:selected?selected.designation||"Counsellor":"",
     assignedAt:selected?serverTimestamp():null,
     updatedAt:serverTimestamp()
    };
    const clientApps=await getDocs(query(collection(db,"applications"),where("clientUid","==",uid)));
    const batch=writeBatch(db);
    batch.update(doc(db,"users",uid),assignment);
    clientApps.docs.forEach(application=>{
     batch.update(doc(db,"applications",application.id),{
      assignedCounsellorUid:assignment.assignedCounsellorUid,
      assignedCounsellorName:assignment.assignedCounsellorName,
      assignedCounsellorDesignation:assignment.assignedCounsellorDesignation,
      updatedAt:serverTimestamp()
     });
    });
    await batch.commit();
    await loadClientDirectory();
   }catch(error){alert("Could not update client assignment: "+error.message);button.disabled=false;button.textContent="Save assignment";}
  }));
 }catch(error){
  console.error("Client directory could not be loaded:",error);
  root.innerHTML='<div class="empty">Client accounts could not be loaded. Check the published Firestore rules and try again.</div>';
 }
}
function formatCaseDate(value){
 if(!value)return "Not recorded";
 const date=typeof value.toDate==="function"?value.toDate():new Date(value);
 return Number.isNaN(date.getTime())?"Not recorded":new Intl.DateTimeFormat("en-IN",{day:"numeric",month:"short",year:"numeric"}).format(date);
}
function caseFieldLabel(key){
 return key.replace(/([A-Z])/g," $1").replace(/^./,s=>s.toUpperCase()).replace(/Uid/g,"UID").replace(/Url/g,"URL");
}
function caseDetailsMarkup(a){
 const data=a.formData&&typeof a.formData==="object"?a.formData:{};
 const fields=Object.entries(data).filter(([key,value])=>value!==null&&value!==undefined&&String(value).trim()!=="");
 const entries=[
  ["Application ID",a.id],
  ["Applicant",a.applicantFullName],
  ["Application type",a.applicationType==="study_abroad"?"Study Abroad":a.applicationType],
  ["Submission date",formatCaseDate(a.createdAt)],
  ["Last updated",formatCaseDate(a.updatedAt)],
  ...fields.map(([key,value])=>[caseFieldLabel(key),Array.isArray(value)?value.join(", "):String(value)])
 ];
 return '<details class="case-detail"><summary>View full application details</summary><div class="case-detail-grid">'+entries.map(([label,value])=>'<div class="case-detail-item '+(/notes|reason|explain|other/i.test(label)?"wide":"")+'"><span>'+esc(label)+'</span><strong>'+esc(value||"Not provided")+'</strong></div>').join("")+'</div></details>';
}
async function loadCases(){
 const root=$("case-list");root.innerHTML='<p class="muted">Loading applications…</p>';
 try{
  let docs=[];
  if(isAdmin){const all=await getDocs(collection(db,"applications"));docs=all.docs;}
  else{
   const permitted=staffProfile?.services||[];
   const batches=await Promise.all(permitted.map(service=>getDocs(query(collection(db,"applications"),where("assignedCounsellorUid","==",currentUser.uid),where("applicationType","==",service)))));
   docs=batches.flatMap(batch=>batch.docs);
  }
  const records=docs.map(d=>({id:d.id,...d.data()})).filter(a=>["study_abroad","tourism"].includes(a.applicationType));
  const metricTotal=$("metric-total"),metricPending=$("metric-pending"),metricStudy=$("metric-study"),metricTourism=$("metric-tourism");
  if(metricTotal)metricTotal.textContent=records.length;
  if(metricPending)metricPending.textContent=records.filter(a=>!["completed","closed","withdrawn"].includes(a.progressStatus||"registered")).length;
  if(metricStudy)metricStudy.textContent=records.filter(a=>a.applicationType==="study_abroad").length;
  if(metricTourism)metricTourism.textContent=records.filter(a=>a.applicationType==="tourism").length;
  const staffSnap=isAdmin?await getDocs(collection(db,"staff")):null;
  const staff=staffSnap?staffSnap.docs.map(d=>({uid:d.id,...d.data()})).filter(s=>s.active):[];
  let noteDocs=[];
  if(isAdmin){const noteSnap=await getDocs(collection(db,"internal_notes"));noteDocs=noteSnap.docs;}
  else{
   const permitted=staffProfile?.services||[];
   const noteBatches=await Promise.all(permitted.map(service=>getDocs(query(collection(db,"internal_notes"),where("assignedCounsellorUid","==",currentUser.uid),where("applicationType","==",service)))));
   noteDocs=noteBatches.flatMap(batch=>batch.docs);
  }
  const notesByApplication=new Map();
  noteDocs.forEach(noteDoc=>{const note=noteDoc.data();const bucket=notesByApplication.get(note.applicationId)||[];bucket.push(note);notesByApplication.set(note.applicationId,bucket);});

  const search=$("case-search"),statusFilter=$("case-status-filter"),serviceFilter=$("case-service-filter"),assignmentFilter=$("case-assignment-filter"),sortFilter=$("case-sort");
  const render=()=>{
   const term=(search?.value||"").trim().toLowerCase();
   const status=statusFilter?.value||"all",service=serviceFilter?.value||"all",assignment=assignmentFilter?.value||"all",sort=sortFilter?.value||"newest";
   let shown=records.filter(a=>{
    if(status!=="all"&&(a.progressStatus||"registered")!==status)return false;
    if(service!=="all"&&a.applicationType!==service)return false;
    if(assignment==="assigned"&&!a.assignedCounsellorUid)return false;
    if(assignment==="unassigned"&&a.assignedCounsellorUid)return false;
    if(term){
     const haystack=[a.applicantFullName,a.applyingFor,a.applicationType,a.clientUid,a.assignedCounsellorName,a.assignedCounsellorUid,a.progressStatus,a.progressUpdate,JSON.stringify(a.formData||{})].join(" ").toLowerCase();
     if(!haystack.includes(term))return false;
    }
    return true;
   });
   shown.sort((a,b)=>{
    if(sort==="name")return String(a.applicantFullName||"").localeCompare(String(b.applicantFullName||""));
    if(sort==="status")return String(a.progressStatus||"registered").localeCompare(String(b.progressStatus||"submitted"));
    const av=a.createdAt?.toMillis?a.createdAt.toMillis():new Date(a.createdAt||0).getTime();
    const bv=b.createdAt?.toMillis?b.createdAt.toMillis():new Date(b.createdAt||0).getTime();
    return sort==="oldest"?av-bv:bv-av;
   });
   $("case-count").textContent="Showing "+shown.length+" of "+records.length+" registered case"+(records.length===1?"":"s");
   if(!shown.length){root.innerHTML='<div class="empty">'+(records.length?"No applications match these search and filter settings.":"No registered cases are currently assigned to this account.")+'</div>';return;}
   root.innerHTML=shown.map(a=>{
    const choices=staff.filter(s=>(s.services||[]).includes(a.applicationType)).map(s=>'<option value="'+esc(s.uid)+'" '+(a.assignedCounsellorUid===s.uid?'selected':'')+'>'+esc(s.fullName)+' · '+esc(servicesLabel(s.services))+'</option>').join("");
    const assignment=isAdmin?'<label>Assign counsellor<select data-assign="'+esc(a.id)+'"><option value="">Unassigned</option>'+choices+'</select></label>':'';
    const statusGroups=a.applicationType==="tourism"?TOURISM_PROGRESS_STAGES:STUDY_PROGRESS_STAGES;
    const statusOptions=progressStatusOptions(statusGroups,a.progressStatus||"registered");
    const privateNotes=(notesByApplication.get(a.id)||[]).sort((x,y)=>{const xv=x.createdAt?.toMillis?x.createdAt.toMillis():0,yv=y.createdAt?.toMillis?y.createdAt.toMillis():0;return yv-xv;});
    const privateNotesMarkup=privateNotes.length?'<details class="private-notes"><summary>Private counsellor notes ('+privateNotes.length+')</summary>'+privateNotes.map(n=>'<div class="private-note-entry"><p>'+esc(n.note)+'</p><small>'+esc(formatCaseDate(n.createdAt))+'</small></div>').join("")+'</details>':'<p class="private-notes-empty">No internal notes recorded yet.</p>';
    return '<article class="case-item"><div class="item-head"><div><strong>'+esc(a.applicantFullName||"Study Abroad applicant")+'</strong><br><small>'+esc(a.applyingFor||"Myself")+' · '+esc(a.applicationType==="study_abroad"?"Study Abroad":a.applicationType)+'</small></div><span class="pill">'+esc(progressStatusLabel(a.progressStatus||"registered"))+'</span></div><div class="case-meta"><span class="muted">Submitted: '+esc(formatCaseDate(a.createdAt))+'</span><span class="muted">Counsellor: '+esc(a.assignedCounsellorName||"Not assigned")+'</span></div>'+caseDetailsMarkup(a)+privateNotesMarkup+'<details class="case-update-panel"><summary>Update case progress <span>Open to change the client-visible stage, share an update or schedule a follow-up</span></summary><div class="case-controls">'+assignment+
    '<label>Progress status<select data-status="'+esc(a.id)+'">'+statusOptions+'</select></label>'+
    '<div class="case-university-fields '+(UNIVERSITY_PROGRESS_STATUSES.includes(a.progressStatus||"")?"":"hidden")+'" data-university-fields="'+esc(a.id)+'"><strong>University application details</strong>'+
    '<label>University name<input data-university-name="'+esc(a.id)+'" value="'+esc(a.universityDetails?.universityName||"")+'" placeholder="University name"></label>'+
    '<label>Country<input data-university-country="'+esc(a.id)+'" value="'+esc(a.universityDetails?.country||"")+'" placeholder="Country"></label>'+
    '<label>Course / programme<input data-university-level="'+esc(a.id)+'" value="'+esc(a.universityDetails?.programLevel||"")+'" placeholder="e.g. MSc Data Science / BBA"></label>'+
    '<label>Intake<input data-university-intake="'+esc(a.id)+'" value="'+esc(a.universityDetails?.intake||"")+'" placeholder="Month and year"></label></div>'+
    '<label>Client-visible progress update<textarea data-note="'+esc(a.id)+'" placeholder="Leave blank to use the tailored message for this stage, or enter a custom update"></textarea></label>'+
    '<label>Private internal note<textarea data-internal-note="'+esc(a.id)+'" placeholder="Only authorised staff can read this note"></textarea></label>'+
    '<div class="case-followup-fields"><label>Next follow-up date<input type="date" data-followup-date="'+esc(a.id)+'"></label><label>Follow-up action<input data-followup-action="'+esc(a.id)+'" placeholder="Call client / email university / review documents"></label></div>'+
    '<button class="primary case-save-button" data-save="'+esc(a.id)+'">Save case update</button></div></details></article>';
   }).join("");
   root.querySelectorAll("[data-assign]").forEach(el=>el.addEventListener("change",async()=>{
    el.disabled=true;
    try{
     const applicationId=el.dataset.assign;
     const uid=el.value||"";
     const chosen=staff.find(person=>person.uid===uid);
     const application=records.find(item=>item.id===applicationId);
     if(!application?.clientUid)throw new Error("The application is missing its client account link. No changes were saved.");
     const assignment={
      assignedCounsellorUid:uid,
      assignedCounsellorName:chosen?chosen.fullName||"Counsellor":"",
      assignedCounsellorDesignation:chosen?chosen.designation||"Counsellor":"",
      assignedAt:chosen?serverTimestamp():null,
      updatedAt:serverTimestamp()
     };
     const clientApplications=await getDocs(query(collection(db,"applications"),where("clientUid","==",application.clientUid)));
     const batch=writeBatch(db);
     clientApplications.docs.forEach(applicationDoc=>{
      batch.update(doc(db,"applications",applicationDoc.id),assignment);
     });
     batch.set(doc(db,"users",application.clientUid),assignment,{merge:true});
     await batch.commit();
     await loadCases();
    }catch(e){alert("Could not assign this application: "+e.message);el.disabled=false;}
   }));
   root.querySelectorAll("[data-status]").forEach(el=>el.addEventListener("change",()=>{
    const fields=root.querySelector('[data-university-fields="'+el.dataset.status+'"]');
    if(fields)fields.classList.toggle("hidden",!UNIVERSITY_PROGRESS_STATUSES.includes(el.value));
   }));
   root.querySelectorAll("[data-save]").forEach(btn=>btn.addEventListener("click",async()=>{
    const id=btn.dataset.save,record=records.find(item=>item.id===id);btn.disabled=true;btn.textContent="Saving…";
    try{
     const status=root.querySelector('[data-status="'+id+'"]').value;
     const universityDetails={
      universityName:root.querySelector('[data-university-name="'+id+'"]')?.value.trim()||"",
      country:root.querySelector('[data-university-country="'+id+'"]')?.value.trim()||"",
      programLevel:root.querySelector('[data-university-level="'+id+'"]')?.value.trim()||"",
      intake:root.querySelector('[data-university-intake="'+id+'"]')?.value.trim()||""
     };
     const manual=root.querySelector('[data-note="'+id+'"]').value.trim();
     const hasUniversityDetails=UNIVERSITY_PROGRESS_STATUSES.includes(status);
     if(hasUniversityDetails&&(!universityDetails.universityName||!universityDetails.country||!universityDetails.programLevel||!universityDetails.intake))throw new Error("For this university/admission stage, complete the university, country, course / programme and intake details before saving.");
     let clientMessage=manual||CLIENT_STATUS_MESSAGES[status]||"Your case progress has been updated by the Quorista team.";
     if(hasUniversityDetails){
      const levelLabels={bachelors:"Bachelor's",bachelor:"Bachelor's",masters:"Master's",master:"Master's",phd:"PhD",doctorate:"doctoral"};
      const rawLevel=universityDetails.programLevel.trim();
      const level=levelLabels[rawLevel.toLowerCase()]||rawLevel;
      const context="University: "+universityDetails.universityName+" · Country: "+universityDetails.country+" · Course: "+level+" · Intake: "+universityDetails.intake+". ";
      clientMessage=context+clientMessage;
     }
     const followDate=root.querySelector('[data-followup-date="'+id+'"]').value;
     const followAction=root.querySelector('[data-followup-action="'+id+'"]').value.trim();
     if((followDate&&!followAction)||(!followDate&&followAction))throw new Error("Enter both a follow-up date and action, or leave both blank.");
     const internal=root.querySelector('[data-internal-note="'+id+'"]').value.trim();
     const batch=writeBatch(db);
     const patch={progressStatus:status,progressUpdate:clientMessage,lastProgressUpdatedAt:serverTimestamp(),updatedAt:serverTimestamp()};
     if(hasUniversityDetails)patch.universityDetails=universityDetails;
     batch.update(doc(db,"applications",id),patch);
     batch.set(doc(collection(db,"status_updates")),{applicationId:id,clientUid:record.clientUid,applicationType:record.applicationType,status,clientMessage,universityDetails:hasUniversityDetails?universityDetails:null,createdByUid:currentUser.uid,createdAt:serverTimestamp()});
     if(internal)batch.set(doc(collection(db,"internal_notes")),{applicationId:id,clientUid:record.clientUid,applicationType:record.applicationType,assignedCounsellorUid:record.assignedCounsellorUid||currentUser.uid,note:internal,createdByUid:currentUser.uid,createdAt:serverTimestamp()});
     if(followDate&&followAction)batch.set(doc(collection(db,"follow_ups")),{applicationId:id,clientUid:record.clientUid,applicationType:record.applicationType,assignedCounsellorUid:record.assignedCounsellorUid||currentUser.uid,followUpDate:followDate,action:followAction,status:"open",createdByUid:currentUser.uid,createdAt:serverTimestamp()});
     await batch.commit();
     await loadCases();
     showStaffToast("Case update saved successfully. The update panel has been closed.");
    }catch(e){alert("Could not save update: "+e.message);btn.disabled=false;btn.textContent="Save case update";}
   }));
  };
  [search,statusFilter,serviceFilter,assignmentFilter,sortFilter].forEach(control=>{if(control)control.oninput=render;});
  render();
 }catch(e){console.error(e);root.innerHTML='<div class="empty">Applications could not be loaded. Check the published Firestore rules and try again.</div>';}
}

async function loadFollowUps(){
 const root=$("follow-up-list");
 if(!root)return;
 root.innerHTML='<p class="muted">Loading follow-ups…</p>';
 try{
  let docs=[];
  if(isAdmin){
   const snap=await getDocs(collection(db,"follow_ups"));
   docs=snap.docs;
  }else{
   const services=staffProfile?.services||[];
   const batches=await Promise.all(services.map(service=>
    getDocs(query(collection(db,"follow_ups"),
     where("assignedCounsellorUid","==",currentUser.uid),
     where("applicationType","==",service)))
   ));
   docs=batches.flatMap(batch=>batch.docs);
  }
  const items=docs.map(item=>({id:item.id,...item.data()}))
   .sort((a,b)=>String(a.followUpDate||"").localeCompare(String(b.followUpDate||"")));
  if(!items.length){
   root.innerHTML='<div class="empty">No follow-ups have been scheduled yet. Add a follow-up from a case in Case Management.</div>';
   return;
  }
  root.innerHTML=items.map(item=>{
   const serviceLabel=item.applicationType==="study_abroad"?"Study Abroad":"International Tourism";
   const status=item.status||"open";
   const completeButton=status==="completed"?"":'<button class="secondary" type="button" data-followup-complete="'+esc(item.id)+'">Mark complete</button>';
   return '<article class="followup-item"><div><strong>'+esc(item.action||"Follow-up")+'</strong><p>'+esc(item.followUpDate||"Date not set")+' · '+serviceLabel+'</p><small>Application: '+esc(item.applicationId)+'</small></div><span class="pill '+(status==="completed"?"active":"inactive")+'">'+esc(status)+'</span>'+completeButton+'</article>';
  }).join("");
  root.querySelectorAll("[data-followup-complete]").forEach(button=>{
   button.addEventListener("click",async()=>{
    button.disabled=true;
    button.textContent="Updating…";
    try{
     await updateDoc(doc(db,"follow_ups",button.dataset.followupComplete),{
      status:"completed",completedAt:serverTimestamp(),updatedAt:serverTimestamp()
     });
     await loadFollowUps();
    }catch(error){
     alert("Could not complete follow-up: "+error.message);
     button.disabled=false;
     button.textContent="Mark complete";
    }
   });
  });
 }catch(error){
  console.error(error);
  root.innerHTML='<div class="empty">Follow-ups could not be loaded. Check Firestore permissions and try again.</div>';
 }
}

$("login-form").addEventListener("submit",async e=>{e.preventDefault();$("login-button").disabled=true;message("login-message","");try{const c=await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value);await enterWorkspace(c.user);}catch(err){message("login-message",err.message||"Sign-in failed.");if(auth.currentUser)await signOut(auth).catch(()=>{});}finally{$("login-button").disabled=false;}});
$("staff-form").addEventListener("submit",async e=>{e.preventDefault();const services=[...document.querySelectorAll('input[name="service"]:checked')].map(x=>x.value);if(!services.length){message("staff-message","Select at least one permitted service.");return;}const uid=$("staff-uid").value.trim();if(!uid||uid===ADMIN_UID){message("staff-message","Enter the counsellor's own Firebase Authentication UID. Your administrator account is already reserved.");return;}try{const existing=await getDoc(doc(db,"staff",uid));if(existing.exists()){message("staff-message","A profile already exists for this UID. Edit it in the Authorised staff list instead; existing access was not changed.");return;}await setDoc(doc(db,"staff",uid),{fullName:$("staff-name").value.trim(),email:$("staff-email").value.trim(),designation:$("staff-title").value.trim(),role:"counsellor",services,active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});message("staff-message","Counsellor profile created successfully.",true);e.target.reset();$("staff-title").value="Study Abroad Counsellor";await loadStaff();}catch(err){message("staff-message","Could not save: "+err.message);}});
$("activate-owner").addEventListener("click",async()=>{try{await setDoc(doc(db,"staff",currentUser.uid),{fullName:"Adarsh Srivastava",email:currentUser.email||"",designation:"Co-Founder & Immigration Consultant",role:"super_admin",services:["study_abroad"],active:true,createdAt:serverTimestamp(),updatedAt:serverTimestamp()});await enterWorkspace(currentUser);}catch(e){message("owner-message",e.message);}});
$("refresh").addEventListener("click",loadCases);
$("refresh-clients")?.addEventListener("click",loadClientDirectory);
$("refresh-followups")?.addEventListener("click",loadFollowUps);
$("signout").addEventListener("click",async()=>{
 const button=$("signout");
 button.disabled=true;
 button.textContent="Signing out…";
 try{
  await signOut(auth);
  $("workspace").classList.add("hidden");
  $("login-panel").classList.remove("hidden");
  $("login-form").reset();
  message("login-message","You have been signed out successfully.",true);
 }catch(e){
  console.error("Sign-out failed:",e);
  button.disabled=false;
  button.textContent="Sign out";
  alert("Could not sign out. Please try again: "+(e.message||"Unknown error"));
 }
});
onAuthStateChanged(auth,async user=>{
 if(!user){
  currentUser=null;staffProfile=null;isAdmin=false;
  $("workspace").classList.add("hidden");
  $("login-panel").classList.remove("hidden");
  $("signout").disabled=false;
  $("signout").textContent="Sign out";
  return;
 }
 try{await enterWorkspace(user);}
 catch(e){message("login-message",e.message);}
});
