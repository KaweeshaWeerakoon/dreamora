const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const KEY = "dreamora.v1";
const CONFIG_KEY = "dreamora.supabase.config.v1";
let cloudClient = null;
let cloudUser = null;
let cloudSaveTimer = null;
let activeStorageKey = KEY;
let isHydratingCloud = false;
let hydratingUserId = null;
const defaultState = () => ({
  profile:{name:"Wanderer",title:"The Wanderer",companion:"Aster the Wisp",dailyGoal:120,defaultDuration:25},
  xp:0, sessions:[], streak:0, lastStudyDate:null, goalDays:[],
  subjects:[
    {id:"math",name:"Combined Mathematics",topics:[{id:"m1",name:"Functions",done:false},{id:"m2",name:"Differentiation",done:false},{id:"m3",name:"Integration",done:false}]},
    {id:"physics",name:"Physics",topics:[{id:"p1",name:"Mechanics",done:false},{id:"p2",name:"Waves",done:false}]},
    {id:"chem",name:"Chemistry",topics:[{id:"c1",name:"Atomic Structure",done:false},{id:"c2",name:"Chemical Bonding",done:false}]}
  ],questClaims:{},sound:"rain",selectedSubject:"math"
});
function normalizeState(raw){
  const base=defaultState();
  const next={...base,...(raw||{})};
  next.profile={...base.profile,...(next.profile||{})};
  next.subjects=Array.isArray(next.subjects)&&next.subjects.length?next.subjects:base.subjects;
  next.sessions=Array.isArray(next.sessions)?next.sessions:[];
  next.goalDays=Array.isArray(next.goalDays)?next.goalDays:[];
  next.questClaims=next.questClaims||{};
  return next;
}
function readLocalState(key){try{return normalizeState(JSON.parse(localStorage.getItem(key)||"{}"));}catch{return defaultState();}}
let state=readLocalState(KEY);
let timer={mode:"pomodoro",duration:25*60,remaining:25*60,elapsed:0,running:false,startedAt:null,interval:null};
let toastTimer;
const today = () => new Date().toISOString().slice(0,10);
const fmt = mins => `${Math.floor(mins/60)}h ${mins%60}m`;
const save = () => {
  localStorage.setItem(activeStorageKey,JSON.stringify(state));
  if(cloudUser && !isHydratingCloud) scheduleCloudSave();
};
function setCloudStatus(message,connected=false){
  const chip=$("#cloudAccountBtn"),label=$("#cloudStatus"),summary=$("#cloudAccountSummary");
  if(label)label.textContent=message;
  if(chip)chip.classList.toggle("connected",connected);
  if(summary)summary.textContent=connected?`Connected as ${cloudUser?.email||"your account"} · Cloud sync enabled`:(message+" · Local storage only");
}
function showAuthMessage(message,isError=false){const el=$("#authMessage");if(el){el.textContent=message;el.style.color=isError?"#e6a3ae":"#91cdbd";}}
function openAuth(){
  const cfg=readCloudConfig();
  $("#supabaseUrl").value=cfg?.url||"";$("#supabaseKey").value=cfg?.key||"";
  $("#signOutBtn").hidden=!cloudUser;
  $("#authModal").classList.add("show");
  if(cloudUser)showAuthMessage(`Signed in as ${cloudUser.email}. Cloud sync is active.`);
  else showAuthMessage(cloudClient?"Your project is connected. Sign in or create your account.":"Add your Supabase project URL and public anon key below to connect.");
}
function readCloudConfig(){try{return JSON.parse(localStorage.getItem(CONFIG_KEY)||"null");}catch{return null;}}
function createCloudClient(config){
  if(!window.supabase?.createClient)throw new Error("Supabase library did not load. Check your internet connection and refresh.");
  cloudClient=window.supabase.createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return cloudClient;
}
async function saveCloudConfig(){
  const url=$("#supabaseUrl").value.trim().replace(/\/$/,""),key=$("#supabaseKey").value.trim();
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)||!key){showAuthMessage("Enter a valid Supabase Project URL and public anon / publishable key.",true);return;}
  try{localStorage.setItem(CONFIG_KEY,JSON.stringify({url,key}));createCloudClient({url,key});showAuthMessage("Project connection saved. You can now sign in or create an account.");setCloudStatus("Project ready");await checkExistingSession();}
  catch(e){showAuthMessage(e.message||"Could not connect to this project.",true);}
}
function scheduleCloudSave(){
  clearTimeout(cloudSaveTimer);
  setCloudStatus("Saving…",true);
  cloudSaveTimer=setTimeout(async()=>{
    if(!cloudClient||!cloudUser||isHydratingCloud)return;
    const {error}=await cloudClient.from("user_state").upsert({user_id:cloudUser.id,state,updated_at:new Date().toISOString()},{onConflict:"user_id"});
    if(error){console.error("DREAMORA cloud save:",error);setCloudStatus("Sync issue",false);}
    else setCloudStatus("Synced",true);
  },900);
}
async function hydrateAccount(user){
  if(cloudUser?.id===user.id||hydratingUserId===user.id)return;
  hydratingUserId=user.id;
  isHydratingCloud=true;
  let cloudReady=true;
  const guestSnapshot=readLocalState(KEY);
  activeStorageKey=KEY+":user:"+user.id;
  const localAccountState=readLocalState(activeStorageKey);
  try{
    const {data,error}=await cloudClient.from("user_state").select("state").eq("user_id",user.id).maybeSingle();
    if(error)throw error;
    state=data?.state?normalizeState(data.state):(localStorage.getItem(activeStorageKey)?localAccountState:guestSnapshot);
    if(!data?.state)localStorage.setItem(activeStorageKey,JSON.stringify(state));
    if(!state.profile.name||state.profile.name==="Wanderer")state.profile.name=user.user_metadata?.display_name||user.email?.split("@")[0]||"Wanderer";
    localStorage.setItem(activeStorageKey,JSON.stringify(state));
    if(!data?.state){const {error:upsertError}=await cloudClient.from("user_state").upsert({user_id:user.id,state,updated_at:new Date().toISOString()},{onConflict:"user_id"});if(upsertError)throw upsertError;}
  }catch(e){
    cloudReady=false;
    console.error("DREAMORA account sync:",e);
    state=localAccountState;
    showAuthMessage("Signed in, but cloud data could not be loaded. Check that the Build 02 SQL setup has been run.",true);
  }finally{isHydratingCloud=false;hydratingUserId=null;}
  cloudUser=user;setCloudStatus(cloudReady?"Synced":"Sync setup needed",cloudReady);render();
}
async function checkExistingSession(){
  if(!cloudClient)return;
  const {data,error}=await cloudClient.auth.getSession();
  if(error){showAuthMessage(error.message,true);return;}
  if(data.session){await hydrateAccount(data.session.user);$("#authModal").classList.remove("show");}
}
async function submitAuth(event){
  event.preventDefault();
  if(!cloudClient){showAuthMessage("Connect your Supabase project first.",true);return;}
  const mode=document.querySelector("[data-auth-mode].active")?.dataset.authMode||"signin";
  const email=$("#authEmail").value.trim(),password=$("#authPassword").value,name=$("#authName").value.trim()||"Wanderer";
  const button=$("#authSubmit");button.disabled=true;button.textContent=mode==="signup"?"Creating account…":"Signing in…";
  try{
    const result=mode==="signup"?await cloudClient.auth.signUp({email,password,options:{data:{display_name:name}}}):await cloudClient.auth.signInWithPassword({email,password});
    if(result.error)throw result.error;
    if(result.data.session){await hydrateAccount(result.data.user);$("#authModal").classList.remove("show");toast("DREAMORA cloud account connected.");}
    else showAuthMessage("Account created. Check your email for the verification link, then return here and sign in.");
  }catch(e){showAuthMessage(e.message||"Authentication failed.",true);}
  finally{button.disabled=false;button.textContent=mode==="signup"?"Create account":"Sign in securely";}
}
async function signOutCloud(){
  if(!cloudClient||!cloudUser)return;
  const {error}=await cloudClient.auth.signOut();if(error){showAuthMessage(error.message,true);return;}
  cloudUser=null;activeStorageKey=KEY;state=readLocalState(KEY);setCloudStatus("Guest mode");$("#authModal").classList.remove("show");render();toast("Signed out. Guest data remains on this device.");
}
function initializeCloud(){
  const cfg=readCloudConfig();
  if(!cfg)return setCloudStatus("Guest mode");
  try{createCloudClient(cfg);setCloudStatus("Connecting…");cloudClient.auth.onAuthStateChange((event,session)=>{if(event==="SIGNED_IN"&&session?.user){if(cloudUser?.id!==session.user.id)setTimeout(()=>hydrateAccount(session.user),0);}else if(event==="SIGNED_OUT"){cloudUser=null;activeStorageKey=KEY;state=readLocalState(KEY);setCloudStatus("Guest mode");render();}});checkExistingSession();}
  catch(e){setCloudStatus("Connection unavailable");console.error(e);}
}
const xpForLevel = level => 100*level*level;
function levelInfo(xp){let level=1,remaining=xp;while(level<100 && remaining>=xpForLevel(level)){remaining-=xpForLevel(level);level++;}return {level,into:remaining,need:xpForLevel(level),progress:Math.min(100,remaining/xpForLevel(level)*100)};}
function rank(level){return level<=10?"Novice Scholar":level<=20?"Apprentice":level<=30?"Arcane Student":level<=40?"Spellcaster":level<=50?"Master Scholar":level<=60?"Grand Scholar":level<=70?"Archon":level<=80?"Celestial Sage":level<=90?"Eternal Luminary":"Archmage of Knowledge";}
function toast(msg){const el=$("#toast");el.textContent=msg;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600);}
function addXP(amount,reason){state.xp+=amount;save();toast(`+${amount} XP · ${reason}`);render();}
function totalMinutes(){return state.sessions.reduce((n,s)=>n+s.minutes,0);}
function todayMinutes(){return state.sessions.filter(s=>s.date===today()).reduce((n,s)=>n+s.minutes,0);}
function updateStreak(){const d=today();if(state.lastStudyDate===d)return;const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);state.streak=state.lastStudyDate===yesterday?state.streak+1:1;state.lastStudyDate=d;if(todayMinutes()>=state.profile.dailyGoal&&!state.goalDays.includes(d))state.goalDays.push(d);}
function questDefs(){return [
 {id:"sessions3",icon:"◷",title:"Three moments of focus",desc:"Complete 3 focus sessions today.",xp:100,progress:()=>state.sessions.filter(s=>s.date===today()).length,target:3},
 {id:"minutes60",icon:"✧",title:"An hour of learning",desc:"Study for 60 focused minutes today.",xp:150,progress:()=>todayMinutes(),target:60},
 {id:"topic1",icon:"▤",title:"Mark a milestone",desc:"Complete one topic in your Learning Hub.",xp:75,progress:()=>state.subjects.reduce((n,s)=>n+s.topics.filter(t=>t.done).length,0),target:1},
 {id:"subject2",icon:"◇",title:"Explore your knowledge",desc:"Study two different subjects today.",xp:100,progress:()=>new Set(state.sessions.filter(s=>s.date===today()).map(s=>s.subject)).size,target:2}
];}
function claimed(id){return state.questClaims[today()+":"+id]===true;}
function claimQuest(id){const q=questDefs().find(x=>x.id===id);if(!q||q.progress()<q.target||claimed(id))return;state.questClaims[today()+":"+id]=true;state.xp+=q.xp;save();toast(`Quest completed · +${q.xp} XP`);render();}
function render(){const l=levelInfo(state.xp),mins=totalMinutes(),todayM=todayMinutes(),goal=state.profile.dailyGoal;
$("#sideName").textContent=$("#topName").textContent=$("#welcomeName").textContent=state.profile.name;
$("#sideLevel").textContent=`Level ${l.level} · ${rank(l.level)}`;$("#rankText").textContent=rank(l.level).toUpperCase();
$("#totalFocus").textContent=$("#analyticsTotal").textContent=fmt(mins);$("#totalXP").textContent=state.xp+" XP";$("#xpToNext").textContent=`${l.need-l.into} XP to next level`;
$("#todayFocus").textContent=todayM>=60?fmt(todayM):todayM+"m";$("#dailyGoalCaption").textContent=`Daily goal: ${goal} min`;
$("#goalPercent").textContent=Math.min(100,Math.round(todayM/goal*100))+"%";$("#goalFill").style.width=Math.min(100,todayM/goal*100)+"%";$("#goalProgressText").textContent=`${todayM} of ${goal} minutes`;
$("#streakValue").textContent=state.streak;$("#questsDone").textContent=Object.values(state.questClaims).filter(Boolean).length;
$("#pageName").textContent=({home:"Overview",focus:"Focus Chamber",quests:"Quest Journal",subjects:"Learning Hub",character:"Character Sanctuary",analytics:"Progress Analytics",settings:"Settings"})[activeView]||"Overview";
$("#todayLabel").textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric"});
$("#questDot").style.display=questDefs().some(q=>q.progress()>=q.target&&!claimed(q.id))?"block":"none";
renderQuests();renderSessions();renderSubjects();renderCharacter();renderAnalytics();
}
function renderQuests(){const qs=questDefs(),done=qs.filter(q=>claimed(q.id)).length;
$("#homeQuests").innerHTML=qs.slice(0,3).map(q=>`<div class="quest-row"><div class="quest-icon">${q.icon}</div><div><b>${q.title}</b><small>${Math.min(q.progress(),q.target)} / ${q.target} progress</small></div><span class="quest-xp">+${q.xp} XP</span></div>`).join("");
$("#dailyQuestList").innerHTML=qs.map(q=>{const p=Math.min(q.progress(),q.target),isDone=claimed(q.id),ready=p>=q.target;return `<div class="quest-card ${isDone?"completed":""}"><div class="q-icon">${q.icon}</div><h4>${q.title}</h4><p>${q.desc}</p><div class="goal-line"><div class="goal-fill" style="width:${p/q.target*100}%"></div></div><div class="quest-card-foot"><b>✧ ${q.xp} XP</b><button data-claim="${q.id}" ${!ready||isDone?"disabled":""}>${isDone?"Completed":ready?"Claim reward":`${p}/${q.target}`}</button></div></div>`}).join("");
$$("[data-claim]").forEach(b=>b.addEventListener("click",()=>claimQuest(b.dataset.claim)));
$("#availableCount").textContent=qs.filter(q=>!claimed(q.id)).length;$("#questCompleteCount").textContent=done;$("#questRewardCount").textContent=qs.filter(q=>claimed(q.id)).reduce((n,q)=>n+q.xp,0)+" XP";
const achievements=[["✧","First Light","Complete your first session",state.sessions.length>=1],["♨","Finding Rhythm","Study on 3 different days",new Set(state.sessions.map(s=>s.date)).size>=3],["◇","A Curious Mind","Complete 5 topics",state.subjects.reduce((n,s)=>n+s.topics.filter(t=>t.done).length,0)>=5],["♜","One Hundred","Earn 1,000 XP",state.xp>=1000],["◷","Timekeeper","Complete 10 sessions",state.sessions.length>=10],["✦","Dedicated","Reach Level 5",levelInfo(state.xp).level>=5],["♧","Deep Roots","Reach 600 focus minutes",totalMinutes()>=600],["☼","Consistent","Study on 7 different days",new Set(state.sessions.map(s=>s.date)).size>=7]];
$("#achievementList").innerHTML=achievements.map(a=>`<div class="achievement ${a[3]?"":"locked"}"><span>${a[0]}</span><b>${a[1]}</b><small>${a[3]?"Unlocked":a[2]}</small></div>`).join("");
const boss=Math.min(100,totalMinutes()/600*100);$("#bossFill").style.width=boss+"%";$("#bossProgress").textContent=`${Math.min(600,totalMinutes())} / 600 focus minutes`;
}
function renderSessions(){const arr=[...state.sessions].reverse();const html=arr.slice(0,5).map(s=>`<div class="session-row"><span class="session-dot"></span><div><b>${escapeHTML(s.topic||s.subjectName||"Focus session")}</b><small>${escapeHTML(s.subjectName||"Personal study")} · ${s.date} · ${s.mode}</small></div><span class="session-duration">${s.minutes} min</span></div>`).join("")||'<p class="muted small">Your completed sessions will appear here. Start with one focused minute.</p>';
$("#recentSessions").innerHTML=html;$("#historyList").innerHTML=arr.map(s=>`<div class="session-row"><span class="session-dot"></span><div><b>${escapeHTML(s.topic||"Focus session")}</b><small>${escapeHTML(s.subjectName||"Personal study")} · ${s.date} · ${s.mode}</small></div><span class="session-duration">${s.minutes} min · +${s.xp} XP</span></div>`).join("")||'<p class="muted small">No sessions recorded yet.</p>';$("#historyCount").textContent=`${arr.length} sessions`;}
function renderSubjects(){const selected=state.subjects.find(s=>s.id===state.selectedSubject)||state.subjects[0];if(!selected)return;
$("#subjectTabs").innerHTML=state.subjects.map(s=>`<button class="subject-tab ${s.id===selected.id?"active":""}" data-subject="${s.id}">${escapeHTML(s.name)}</button>`).join("");
$$("[data-subject]").forEach(b=>b.addEventListener("click",()=>{state.selectedSubject=b.dataset.subject;save();renderSubjects();}));
$("#selectedSubjectName").textContent=selected.name;$("#topicCount").textContent=selected.topics.length+" TOPICS";
const completed=selected.topics.filter(t=>t.done).length,pct=selected.topics.length?completed/selected.topics.length*100:0;
$("#subjectFill").style.width=pct+"%";$("#subjectProgressText").textContent=Math.round(pct)+"% complete";
$("#subjectMinutes").textContent=state.sessions.filter(s=>s.subject===selected.id).reduce((n,s)=>n+s.minutes,0)+" minutes studied";
$("#topicList").innerHTML=selected.topics.map(t=>`<div class="topic-row ${t.done?"done":""}"><button class="topic-check" data-topic="${t.id}">${t.done?"✓":""}</button><div><b>${escapeHTML(t.name)}</b><small>${t.done?"Completed":"Ready to study"}</small></div><button class="topic-delete" data-delete-topic="${t.id}">×</button></div>`).join("")||'<p class="muted small">No topics yet. Add your first chapter below.</p>';
$$("[data-topic]").forEach(b=>b.addEventListener("click",()=>{const t=selected.topics.find(t=>t.id===b.dataset.topic);t.done=!t.done;save();render();}));
$$("[data-delete-topic]").forEach(b=>b.addEventListener("click",()=>{selected.topics=selected.topics.filter(t=>t.id!==b.dataset.deleteTopic);save();render();}));
const sel=$("#focusSubject");const old=sel.value;sel.innerHTML=state.subjects.map(s=>`<option value="${s.id}">${escapeHTML(s.name)}</option>`).join("");if(state.subjects.some(s=>s.id===old))sel.value=old;else sel.value=selected.id;
}
function renderCharacter(){const l=levelInfo(state.xp);$("#characterName").textContent=state.profile.title;$("#characterRank").textContent=`${rank(l.level).toUpperCase()} · LEVEL ${l.level}`;$("#characterFigure").textContent=l.level>=20?"♙":"✧";$("#displayName").value=state.profile.name;$("#characterTitle").value=state.profile.title;$("#companionSelect").value=state.profile.companion;$("#petName").textContent=state.profile.companion;}
function renderAnalytics(){const l=levelInfo(state.xp);$("#analyticsSessions").textContent=state.sessions.length;$("#analyticsAverage").textContent=state.sessions.length?Math.round(totalMinutes()/state.sessions.length)+"m":"0m";$("#goalDays").textContent=state.goalDays.length;const days=[];for(let i=6;i>=0;i--){const d=new Date(Date.now()-i*86400000),key=d.toISOString().slice(0,10);days.push({key,label:d.toLocaleDateString(undefined,{weekday:"short"}),mins:state.sessions.filter(s=>s.date===key).reduce((n,s)=>n+s.minutes,0)});}
const max=Math.max(30,...days.map(d=>d.mins));$("#weeklyChart").innerHTML=days.map(d=>`<div class="bar-item"><em>${d.mins||""}</em><div class="bar" style="height:${Math.max(3,d.mins/max*125)}px"></div><small>${d.label}</small></div>`).join("");
const totals=state.subjects.map(s=>({name:s.name,mins:state.sessions.filter(x=>x.subject===s.id).reduce((n,x)=>n+x.minutes,0)}));const maxS=Math.max(1,...totals.map(x=>x.mins));$("#subjectChart").innerHTML=totals.map(x=>`<div class="dist-row"><span>${escapeHTML(x.name)}</span><div class="dist-track"><div style="width:${x.mins/maxS*100}%"></div></div><b>${x.mins}m</b></div>`).join("")||"No data yet";}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
let activeView="home";
function showView(view){activeView=view;$$(".view").forEach(v=>v.classList.toggle("active",v.id==="view-"+view));$$("[data-view]").forEach(b=>b.classList.toggle("active",b.dataset.view===view));render();window.scrollTo({top:0,behavior:"smooth"});}
$$("[data-view]").forEach(b=>b.addEventListener("click",()=>showView(b.dataset.view)));
function setMode(mode){if(timer.running)return toast("Pause the current session before changing modes.");timer.mode=mode;timer.duration=({pomodoro:25,extended:50,deep:60,stopwatch:0})[mode]*60;timer.remaining=timer.duration;timer.elapsed=0;$$("[data-mode]").forEach(b=>b.classList.toggle("active",b.dataset.mode===mode));$("#modeLabel").textContent=mode.toUpperCase();$("#timerCaption").textContent=mode==="stopwatch"?"ELAPSED TIME":"FOCUS TIME";updateTimerUI();}
$$("[data-mode]").forEach(b=>b.addEventListener("click",()=>setMode(b.dataset.mode)));
function updateTimerUI(){let sec=timer.mode==="stopwatch"?timer.elapsed:timer.remaining;let m=String(Math.floor(sec/60)).padStart(2,"0"),s=String(sec%60).padStart(2,"0");$("#timerDisplay").textContent=m+":"+s;let p=timer.mode==="stopwatch"?Math.min(100,timer.elapsed/(60*60)*100):(timer.duration?((timer.duration-timer.remaining)/timer.duration*100):0);$("#timerRing").style.background=`conic-gradient(#a58af0 ${p*3.6}deg,#5bd0bd ${p*3.6}deg,#29334b ${p*3.6}deg)`;$("#timerStatus").textContent=timer.running?"FOCUS SESSION IN PROGRESS":"READY WHEN YOU ARE";$("#startPause").innerHTML=timer.running?"Pause session":"Begin focus <span>→</span>";}
function startTimer(){if(timer.running){clearInterval(timer.interval);timer.running=false;updateTimerUI();return;}timer.running=true;timer.startedAt=Date.now();updateTimerUI();timer.interval=setInterval(()=>{if(timer.mode==="stopwatch")timer.elapsed++;else timer.remaining--;updateTimerUI();if(timer.mode!=="stopwatch"&&timer.remaining<=0)completeSession();},1000);}
function resetTimer(){clearInterval(timer.interval);timer.running=false;timer.elapsed=0;timer.remaining=timer.duration;updateTimerUI();}
function completeSession(){clearInterval(timer.interval);timer.running=false;const activeSeconds=timer.mode==="stopwatch"?timer.elapsed:timer.duration;const minutes=Math.floor(activeSeconds/60);if(minutes<1){toast("Complete at least one minute to save a session.");resetTimer();return;}
const subjectId=$("#focusSubject").value,subject=state.subjects.find(s=>s.id===subjectId),xp=minutes*10+25;
const session={id:crypto.randomUUID?crypto.randomUUID():String(Date.now()),date:today(),minutes,seconds:activeSeconds,subject:subjectId,subjectName:subject?.name||"Personal study",topic:$("#focusTopic").value.trim()||$("#focusNote").value.trim()||"Focus session",mode:timer.mode,xp};
state.sessions.push(session);state.xp+=xp;updateStreak();if(todayMinutes()>=state.profile.dailyGoal&&!state.goalDays.includes(today()))state.goalDays.push(today());save();
$("#modalText").textContent=`You focused for ${minutes} minutes on ${session.subjectName}. Your effort has been recorded.`;$("#modalReward").textContent=`+${xp} XP`;$("#modal").classList.add("show");resetTimer();render();}
$("#startPause").addEventListener("click",startTimer);$("#resetTimer").addEventListener("click",resetTimer);$("#closeModal").addEventListener("click",()=>$("#modal").classList.remove("show"));
$("#addTopic").addEventListener("click",()=>{const name=$("#newTopic").value.trim();if(!name)return;const s=state.subjects.find(x=>x.id===state.selectedSubject);s.topics.push({id:"t"+Date.now(),name,done:false});$("#newTopic").value="";save();render();toast("Topic added to your learning map.");});
$("#addSubject").addEventListener("click",()=>{const name=prompt("Name your new subject:");if(!name?.trim())return;const id="s"+Date.now();state.subjects.push({id,name:name.trim(),topics:[]});state.selectedSubject=id;save();render();});
$("#saveCharacter").addEventListener("click",()=>{state.profile.name=$("#displayName").value.trim()||"Wanderer";state.profile.title=$("#characterTitle").value;state.profile.companion=$("#companionSelect").value;save();render();toast("Your character has been updated.");});
$("#saveSettings").addEventListener("click",()=>{state.profile.dailyGoal=Number($("#dailyGoal").value);state.profile.defaultDuration=Number($("#defaultDuration").value);save();render();toast("Preferences saved.");});
$("#dailyGoal").value=state.profile.dailyGoal;$("#defaultDuration").value=state.profile.defaultDuration;
$("#exportData").addEventListener("click",()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="dreamora-progress.json";a.click();URL.revokeObjectURL(a.href);});
$("#resetData").addEventListener("click",()=>{if(confirm("Reset all DREAMORA data stored in this browser? This cannot be undone.")){localStorage.removeItem(KEY);state=defaultState();save();render();toast("Local data reset.");}});
$$("[data-sound]").forEach(b=>b.addEventListener("click",()=>{$$("[data-sound]").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.sound=b.dataset.sound;save();toast(b.dataset.sound==="none"?"Ambience turned off":"Atmosphere selected: "+b.dataset.sound);}));
$("#soundToggle").addEventListener("click",()=>toast("Soundscape controls are ready for audio integration."));
render();setMode("pomodoro");
$("#cloudAccountBtn").addEventListener("click",openAuth);
$("#openCloudSettings").addEventListener("click",openAuth);
$("#closeAuth").addEventListener("click",()=>$("#authModal").classList.remove("show"));
$("#saveSupabaseConfig").addEventListener("click",saveCloudConfig);
$("#authForm").addEventListener("submit",submitAuth);
$("#signOutBtn").addEventListener("click",signOutCloud);
$$("[data-auth-mode]").forEach(b=>b.addEventListener("click",()=>{$$("[data-auth-mode]").forEach(x=>x.classList.toggle("active",x===b));const signup=b.dataset.authMode==="signup";$("#authNameWrap").hidden=!signup;$("#authPassword").autocomplete=signup?"new-password":"current-password";$("#authSubmit").textContent=signup?"Create account":"Sign in securely";$("#authTitle").textContent=signup?"Begin your journey.":"Your journey, everywhere.";}));
initializeCloud();
if("serviceWorker" in navigator && location.protocol!=="file:"){window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));}
