(() => {
"use strict";
const $ = id => document.getElementById(id);
let state=[[],[],[]], selected=null, moves=0, invalid=0, startedAt=null, timer=null;
let busy=false, autoSolving=false, manualMade=false, online=false;
const count=()=>Number($("disk-count").value), optimal=()=>2**count()-1;
const speed=()=>Number($("speed").value), phaseDuration=()=>900/speed();
function status(ok,msg){online=ok;$("server-status").className="server-status "+(ok?"online":"offline");$("status-text").textContent=msg;if(!ok)$("board-hint").textContent="Prolog server unavailable. Moves are disabled until it reconnects."}
async function post(path,data){const r=await fetch(path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data)});if(!r.ok)throw Error(`Server returned ${r.status}`);return r.json()}
async function checkServer(){try{await fetch("/api/move",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({state:[[],[],[]],from:0,to:0})});status(true,"Prolog server connected");$("auto-solve").disabled=manualMade}catch(e){status(false,"Cannot reach Prolog server")}}
function time(){return startedAt===null?0:Math.floor((Date.now()-startedAt)/1000)}
function fmt(s){return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function startTimer(){if(startedAt!==null)return;startedAt=Date.now();timer=setInterval(()=>$("timer").textContent=fmt(time()),250)}
function stopTimer(){if(timer!==null)clearInterval(timer);timer=null}
function stats(){$("timer").textContent=fmt(time());$("move-count").textContent=moves;$("invalid-count").textContent=invalid;$("optimal-count").textContent=optimal()}
function render(){for(let p=0;p<3;p++){const stack=$(`stack-${p}`);stack.replaceChildren();state[p].forEach(n=>{const d=document.createElement("div");d.className=`disk disk-${n}`;d.dataset.size=n;d.setAttribute("role","button");d.setAttribute("aria-label",`Disk ${n} on peg ${"ABC"[p]}`);d.addEventListener("click",e=>{e.stopPropagation();diskClick(p,n,d)});stack.appendChild(d)})}stats()}
function clearSelection(){selected=null;document.querySelectorAll(".disk.selected").forEach(d=>d.classList.remove("selected"))}
function diskClick(peg,size,el){if(busy||!online)return;if(selected===null){if(state[peg].at(-1)!==size)return;selected=peg;el.classList.add("selected");$("board-hint").textContent=`Disk ${size} selected. Choose a different peg.`}else if(selected===peg){clearSelection();$("board-hint").textContent="Selection cleared. Choose a disk."}else move(selected,peg,true)}
document.querySelectorAll(".peg-column").forEach(col=>col.addEventListener("click",()=>{const p=Number(col.dataset.peg);if(!busy&&online&&selected!==null&&p!==selected)move(selected,p,true)}));
async function animate(from,to,size){const source=$(`stack-${from}`),disk=[...source.children].find(d=>Number(d.dataset.size)===size);if(!disk)return;
const start=disk.getBoundingClientRect(),target=document.querySelector(`.peg-column[data-peg="${to}"]`),stage=target.querySelector(".peg-stage").getBoundingClientRect(),base=target.querySelector(".peg-base").getBoundingClientRect();
const dx=stage.left+stage.width/2-(start.left+start.width/2),dy=base.top-(state[to].length+1)*start.height-start.top,lift=Math.max(75,Math.min(125,start.top-30));
const clone=disk.cloneNode(true);clone.classList.add("flying-disk");Object.assign(clone.style,{left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`});document.body.appendChild(clone);disk.style.visibility="hidden";
const opts={duration:phaseDuration(),easing:"linear",fill:"forwards"};
try{await clone.animate([{transform:"translate(0px,0px)"},{transform:`translate(0px,-${lift}px)`}],opts).finished;
await clone.animate([{transform:`translate(0px,-${lift}px)`},{transform:`translate(${dx}px,-${lift}px)`}],opts).finished;
await clone.animate([{transform:`translate(${dx}px,-${lift}px)`},{transform:`translate(${dx}px,${dy}px)`}],opts).finished}
finally{clone.remove();disk.style.visibility=""}}
async function move(from,to,isManual){if(busy||!online)return false;if(isManual&&!autoSolving){manualMade=true;$("auto-solve").disabled=true;$("auto-solve").title="Disabled after a manual move. Start a New Game to re-enable."}
const size=state[from].at(-1);if(!size)return false;busy=true;clearSelection();
try{const result=await post("/api/move",{state,from,to});if(!result.valid){invalid++;stats();$("board-hint").textContent="Invalid move. A larger disk cannot go on a smaller disk.";return false}
startTimer();await animate(from,to,size);state=result.newState;moves++;render();$("board-hint").textContent=autoSolving?"Auto-Solve is running…":"Good move. Keep going!";if(state[2].length===count())victory();return true}
catch(e){status(false,"Prolog server connection lost");$("board-hint").textContent=`Move blocked: ${e.message}`;return false}finally{busy=false}}
async function solve(){if(!online||busy||manualMade||autoSolving)return;autoSolving=true;busy=true;$("auto-solve").disabled=true;$("disk-count").disabled=true;$("board-hint").textContent="Asking Prolog to calculate the optimal solution…";
try{const answer=await post("/api/solve",{disks:count(),pegs:3});for(const m of answer.moves){busy=false;if(!await move(m.from,m.to,false))throw Error("The server rejected a solver move.");await new Promise(requestAnimationFrame)}$("board-hint").textContent="The Prolog solver completed the puzzle."}
catch(e){status(false,"Auto-Solve could not complete");$("board-hint").textContent=e.message}
finally{busy=false;autoSolving=false;$("disk-count").disabled=false;$("auto-solve").disabled=manualMade||!online}}
function victory(){stopTimer();$("final-time").textContent=fmt(time());$("final-moves").textContent=moves;$("final-optimal").textContent=optimal();$("victory-modal").hidden=false}
function newGame(){stopTimer();startedAt=null;state=[Array.from({length:count()},(_,i)=>count()-i),[],[]];moves=0;invalid=0;selected=null;manualMade=false;autoSolving=false;busy=false;$("victory-modal").hidden=true;$("disk-count").disabled=false;$("auto-solve").disabled=!online;$("auto-solve").title="";$("timer").textContent="00:00";$("board-hint").textContent="Choose the top disk on any peg to begin.";render()}
$("new-game").addEventListener("click",newGame);$("play-again").addEventListener("click",newGame);$("auto-solve").addEventListener("click",solve);$("disk-count").addEventListener("change",newGame);$("speed").addEventListener("input",()=>$("speed-value").textContent=`${speed()}x`);
newGame();checkServer();window.addEventListener("online",checkServer);
})();