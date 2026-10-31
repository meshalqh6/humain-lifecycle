import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const ROOT=path.resolve(HERE,'../..');
const ASSETS=path.join(ROOT,'submission/presentation_assets');
const BUILD=path.join(ROOT,'tmp/presentation-build');
const MOD=process.env.RUNTIME_NODE_MODULES || 'C:/Users/mesha/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const req=createRequire(path.join(MOD,'__runtime__.cjs'));
const {Presentation,PresentationFile}=await import(pathToFileURL(req.resolve('@oai/artifact-tool')).href);
const {FontLibrary}=await import(pathToFileURL(path.join(MOD,'@oai/artifact-tool/node_modules/skia-canvas/lib/index.mjs')).href);
const sharp=req('sharp');
FontLibrary.use('Inter',['Inter-Regular.ttf','Inter-Medium.ttf','Inter-Bold.ttf'].map(f=>path.join(ASSETS,'fonts',f)));
await fs.mkdir(BUILD,{recursive:true});
await fs.mkdir(path.join(BUILD,'slides'),{recursive:true});
const C={ink:'#102D37',muted:'#4C6770',dark:'#050C10',deep:'#073B3F',teal:'#008C95',green:'#00C9AA',lime:'#CAFF3D',line:'#D9E6E7',paper:'#F5F9F9',white:'#FFFFFF',light:'#B8D5D5',amber:'#FFCF78'};
const deck=Presentation.create({slideSize:{width:1280,height:720}});
const specs=[];
function box(s,x,y,w,h,fill='none',stroke='none',radius=0,name=''){
 return s.shapes.add({geometry:radius?'roundRect':'rect',name,position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1},...(radius?{borderRadius:radius}:{})});
}
function text(s,value,x,y,w,h,size=22,color=C.ink,bold=false,align='left',name=''){
 const q=box(s,x,y,w,h,'none','none',0,name||value.slice(0,45));q.text=value;
 q.text.style={fontSize:size,typeface:'Inter',color,bold,alignment:align,verticalAlignment:'top',autoFit:'none',wrap:'square',insets:0};return q;
}
function line(s,x,y,w,h,color=C.line,width=1){return s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:color,width}});}
function arrow(s,a,b,from='right',to='left',color=C.green){return s.shapes.connect(a,b,{kind:'elbow3',fromSide:from,toSide:to,line:{fill:color,width:2},tail:{type:'triangle',width:'sm',length:'sm'}});}
async function pic(s,file,x,y,w,h,fit='contain',name=''){
 const bytes=await fs.readFile(path.join(ASSETS,file));
 return s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:file.endsWith('.jpg')?'image/jpeg':'image/png',alt:name||file,fit,position:{left:x,top:y,width:w,height:h}});
}
async function prepAssets(){
 const src=path.join(ASSETS,'humain-logo.png');
 const {data,info}=await sharp(src).trim().ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<data.length;i+=4){data[i]=255;data[i+1]=255;data[i+2]=255;}
 await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(path.join(ASSETS,'humain-white.png'));
 await sharp(src).trim().png().toFile(path.join(ASSETS,'humain-trimmed.png'));
 await sharp(path.join(ASSETS,'dashboard.png')).extract({left:790,top:383,width:423,height:278}).png().toFile(path.join(ASSETS,'brand-art-crop.png'));
 // Screenshot crops preserve genuine page pixels. Full captures remain alongside them.
 for(const f of ['employees','contracts','policies']){
  await sharp(path.join(ASSETS,f+'.png')).extract({left:220,top:75,width:1025,height:620}).png().toFile(path.join(ASSETS,f+'-crop.png'));
 }
 await sharp(path.join(ASSETS,'chat.png')).extract({left:438,top:76,width:840,height:638}).png().toFile(path.join(ASSETS,'chat-crop.png'));
 // The original evidence capture is included in presentation_assets.
}
async function brand(s,dark=false){await pic(s,dark?'humain-white.png':'humain-trimmed.png',64,34,145,26);text(s,'LIFECYCLE',223,28.3,225,40,29.3,C.green,true);}
async function slide(title,sub='',dark=false){
 const s=deck.slides.add();s.background.fill=dark?'linear(155deg, #050C10 0%, #073B3F 100%)':C.white;
 const n=deck.slides.items.length;await brand(s,dark);text(s,String(n).padStart(2,'0'),1174,38,42,24,15,dark?C.light:C.muted,false,'right');
 if(title)text(s,title,64,100,1152,70,44,dark?C.white:C.ink,true);
 if(sub)text(s,sub,64,169,1152,54,22,dark?C.light:C.muted);
 specs.push({number:n,title,dark});return s;
}
function notes(s,copy,sources){s.speakerNotes.text=copy+'\n\nSources: '+sources.join('; ');}
function node(s,label,detail,x,y,w,h,{dark=false,accent=false}={}){
 const q=box(s,x,y,w,h,accent?C.teal:dark?'#103C43':C.paper,dark?'#28646A':C.line,10,label);
 text(s,label,x+20,y+18,w-40,h<=110?34:56,24,accent||dark?C.white:C.ink,true);
 if(detail){const dy=h<=110?57:78;text(s,detail,x+20,y+dy,w-40,h-dy-10,18,accent?C.white:dark?C.light:C.muted);}
 return q;
}
await prepAssets();

// 01: minimal opening with the user's HUMAIN artwork and matching wordmark.
{
 const s=await slide('', '',true);
 const coverBackground=await pic(s,'BackGround1-logo.png',0,0,1280,720,'cover','HUMAIN artwork filling slide 1 background');
 coverBackground.sendToBack();
 const coverShade=box(s,0,0,1280,720,'linear(0deg, #050C10/94 0%, #050C10/78 47%, #050C10/10 78%, #050C10/0 100%)');
 coverShade.sendToBack();
 coverBackground.sendToBack();
 text(s,'HUMAIN Future AI Builders Hackathon',64,122,900,32,19,C.light);
 text(s,'HUMAIN\nLifecycle',64,198,720,178,80,C.white,true);
 text(s,'Autonomous Enterprise AI',68,392,750,48,32,C.green,true);
 text(s,'Turning incoming employment contracts into verified\nonboarding preparation through autonomous AI.',68,472,750,96,25,C.white);
 text(s,'CHALLENGE 3',68,638,190,24,17,C.green,true);
 text(s,'Autonomous Enterprise',254,637,550,28,19,C.light);
 notes(s,'HUMAIN Lifecycle is an existing local hackathon prototype. Its goal is to prepare onboarding from an incoming authorized contract and verify the resulting records. Final HR decisions remain with people. All product examples in this deck use synthetic employee data.','README.md docs/HACKATHON_DEMO.md docs/UI_DESIGN_SYSTEM.md'.split(' '));
}
// 02: concise visual map of the traditional handoff problem.
{
 const s=await slide('The enterprise onboarding problem','A single employment contract creates work across disconnected teams.');
 const items=[['Manual contract review','Read documents and re-enter the same employee facts.'],['Disconnected HR and IT','Coordinate handoffs across separate requests and inboxes.'],['Policy inconsistencies','Check each contract against the right approved rules.'],['Repetitive administration','Create profiles, tasks and welcome messages by hand.'],['Limited workflow visibility','Find out what ran, what failed and who must act next.'],['Deadline monitoring','Track contract, Iqama and work-permit dates.']];
 items.forEach(([a,b],i)=>{const x=64+(i%3)*397,y=246+Math.floor(i/3)*176;line(s,x,y+5,360,0);text(s,String(i+1).padStart(2,'0'),x,y+24,55,52,35,C.teal,true);text(s,a,x+66,y+24,294,60,25,C.ink,true);text(s,b,x+66,y+91,294,64,19,C.muted);});
 text(s,'The coordination burden continues until someone verifies the outcome.',64,642,1150,34,24,C.teal,true);
 notes(s,'This slide describes the business process targeted by the prototype. These are qualitative workflow challenges, not survey findings or measured cost estimates. The project connects intake, policy checks, HR task preparation, communications and evidence in one workflow.',['docs/WORKFLOWS.md','backend/app/onboarding.py','backend/app/journeys.py']);
}
// 03: objective to verified preparation, with a clear human boundary.
{
 const s=await slide('Our solution: verified onboarding preparation','HUMAIN Lifecycle connects an AI-native employee lifecycle workspace to durable HR workflows.');
 text(s,'BUSINESS OBJECTIVE',64,246,360,25,16,C.teal,true);
 text(s,'“Prepare onboarding\nfrom this contract and\nverify the result.”',64,293,370,156,34,C.ink,true);
 const labels=[['Understand','Interpret the objective'],['Coordinate','Select authorized tools'],['Execute','Persist the work'],['Verify','Inspect saved evidence']];
 const positions=[[490,244],[864,244],[864,414],[490,414]];
 const ns=labels.map(([a,b],i)=>node(s,a,b,...positions[i],350,140));
 arrow(s,ns[0],ns[1]);arrow(s,ns[1],ns[2],'bottom','top');arrow(s,ns[2],ns[3],'left','right');
 text(s,'HUMAIN Chat',64,482,340,42,30,C.teal,true);text(s,'Local Qwen3.5:4b orchestrator',64,528,350,55,20,C.muted);
 box(s,64,607,1152,65,C.deep,'none',8);
 text(s,'Autonomous preparation',84,624,360,30,22,C.white,true);
 text(s,'Human approval of identity, employment terms and official Qiwa actions',442,623,750,44,20,C.white);
 notes(s,'HUMAIN Chat interprets the user objective and invokes registered typed tools. Python owns permission checks, policy gates and durable side effects. Verification checks persisted records. Automation setup can be verified while three human HR tasks remain pending and IT requests remain simulated.',['backend/app/agent.py','backend/app/journeys.py','backend/app/onboarding.py','docs/JOURNEY_LIVE_EVALUATION.json']);
}
// 04: one orchestrator, six coordinated capabilities.
{
 const s=await slide('HUMAIN Chat & specialized capabilities','A local language model coordinates typed tools and backend services.',true);
 const hub=node(s,'HUMAIN Chat','Qwen3.5:4b in host Ollama',420,245,440,125,{accent:true});
 line(s,640,370,0,40,C.green,2);line(s,154,410,970,0,C.green,2);
 const caps=[['Contract\nIntelligence','Extract source facts'],['Policy\nValidation','Check activated rules'],['Onboarding\nAutomation','Create records & tasks'],['Compliance\nMonitoring','Find upcoming dates'],['Communications','Send approved templates'],['Audit &\nVerification','Inspect durable evidence']];
 caps.forEach(([a,b],i)=>{const x=64+i*194;line(s,x+90,410,0,36,C.green,2);box(s,x,446,180,151,'#103C43','#28646A',10,a);text(s,a,x+14,464,152,58,i===4?18:21,C.white,true);text(s,b,x+14,530,152,55,18,C.light);});
 text(s,'Coordinated AI-enabled tools and backend capabilities',64,637,1152,30,24,C.white,true,'center');
 text(s,'These capabilities do not represent six independent language models.',64,674,1152,24,17,C.light,false,'center');
 notes(s,'The registry includes extract_contract, validate_contract, start_onboarding_journey, get_company_policies, create_onboarding, get_expiring_documents, send_authorized_email and get_audit_history. Contract table parsing and policy comparisons use deterministic code where appropriate. This is one locally hosted model coordinating tools, not six independent LLM agents.',['backend/app/agent.py REGISTRY','backend/app/documents.py','backend/app/journeys.py','backend/app/email_agent.py']);
}
// 05: actual implementation topology.
{
 const s=await slide('Technical architecture','Local AI inference with server-enforced permissions and a persistent system of record.');
 const ui=node(s,'React + TypeScript + Vite','Browser UI and streamed chat responses',95,249,655,100);
 const api=node(s,'FastAPI + Python + SQLAlchemy','Tool calling, policy gates and workflow orchestration',95,393,655,100);
 const db=node(s,'PostgreSQL 17 in Docker','Employee records, workflow state and durable audit evidence',95,537,655,100);
 const llm=node(s,'Ollama / Qwen3.5:4b','Host-local AI planning and structured extraction',850,249,366,143,{accent:true});
 const smtp=node(s,'SMTP / Mailpit','Approved real SMTP or local sandbox capture',850,493,366,143);
 arrow(s,ui,api,'bottom','top',C.teal);arrow(s,api,db,'bottom','top',C.teal);
 arrow(s,api,llm,'right','left',C.teal);arrow(s,api,smtp,'right','left',C.teal);
 text(s,'Authentication and permissions',95,363,310,23,17,C.teal,true);
 text(s,'Runtime AI uses local Ollama inference. The implementation does not call the OpenAI API.',64,671,1152,26,19,C.teal,true);
 notes(s,'Vite proxies local /api requests to FastAPI. The backend validates typed requests, checks permissions, orchestrates tool calls and owns transactions. PostgreSQL 17 is authoritative and uses a persistent named Docker volume. Ollama runs on the Windows host. Email uses either Mailpit sandbox capture or explicitly configured and authorized SMTP. Qwen has no arbitrary SQL, shell or SMTP credential access. The independent test database uses a separate Docker service.',['docs/ARCHITECTURE.md','backend/app/main.py','backend/app/security.py','backend/app/database/models.py','backend/app/ollama.py','docker-compose.yml']);
}
// 06: five genuine product captures, with editable labels.
{
 const s=await slide('Real product implementation','Five views from the running application, using synthetic workspace records.');
 text(s,'01  Executive dashboard',64,240,560,36,25,C.ink,true);
 await pic(s,'dashboard.png',64,286,565,318);
 text(s,'Workforce counts, deadlines and recorded activity',64,621,555,48,20,C.muted);
 const tiles=[['employees-crop.png','02  Employee management',654,238],['contracts-crop.png','03  Contract intake',943,238],['policies-crop.png','04  Policy management',654,459],['chat-crop.png','05  HUMAIN Chat',943,459]];
 for(const [f,t,x,y] of tiles){text(s,t,x,y,273,29,18,C.teal,true);await pic(s,f,x,y+37,273,157,'contain',t);}
 notes(s,'All five screenshots were captured from the running local application for this deck on 31 October 2026 Riyadh time. The employee data is synthetic. Policy management shows an existing inactive draft, not an approved corporate policy. Cropped thumbnails preserve the original UI pixels. The source folder includes the full captures. Counts represent the capture moment and may change as the app runs.',['submission/presentation_assets/dashboard.png','submission/presentation_assets/employees.png','submission/presentation_assets/contracts.png','submission/presentation_assets/policies.png','submission/presentation_assets/chat.png']);
}
// 07: nine-step process plus an exception path.
{
 const s=await slide('End-to-end autonomous workflow','One contract becomes a persisted objective with evidence and reviewable exceptions.');
 const labels=[['Incoming contract','PDF text, XLSX or CSV'],['Extraction','Map facts from the source'],['Validation','Check required fields and dates'],['Activated company policy','Apply only when selected'],['HUMAIN Chat orchestration','Coordinate authorized actions'],['Employee & contract records','Commit durable HR records'],['Five onboarding tasks','3 human HR + 2 simulated IT'],['Authorized email','Template and recipient controls'],['Verified automation evidence','Records, outcomes and audit']];
 const pos=[[64,248],[464,248],[864,248],[864,389],[464,389],[64,389],[64,530],[464,530],[864,530]];
 const ns=labels.map(([a,b],i)=>{const[x,y]=pos[i];const q=box(s,x,y,352,112,i===8?C.deep:C.paper,C.line,8);text(s,String(i+1).padStart(2,'0'),x+16,y+13,42,28,18,i===8?C.green:C.teal,true);text(s,a,x+62,y+13,275,52,22,i===8?C.white:C.ink,true);text(s,b,x+16,y+77,320,30,18,i===8?C.light:C.muted);return q;});
 for(let i=0;i<8;i++){const vertical=i===2||i===5;arrow(s,ns[i],ns[i+1],vertical?'bottom':i===3||i===4?'left':'right',vertical?'top':i===3||i===4?'right':'left',C.teal);}
 text(s,'Exception path: missing facts or policy findings pause execution for authorized review, then resume.',64,674,1152,26,18,C.teal,true);
 notes(s,'The diagram groups responsibilities rather than prescribing the exact sequence of LLM calls. The objective is persisted in a journey. Policy validation applies only when the user selects an activated policy. The recorded 37.036-second example used contract fact validation without an activated policy. Unresolved policy findings block creation and communication until an authorized review or recorded exception resolves them. HR remains responsible for official Qiwa approval. IT tasks are simulated requests only.',['backend/app/journeys.py PLAN and policy_gate','backend/app/onboarding.py','backend/app/email_agent.py','docs/JOURNEY_LIVE_EVALUATION.json','tmp/pdfs/journey.json']);
}
// 08: preserve the exact historical milestone while disclosing the newer suite.
{
 const s=await slide('Testing & recorded results','Reproducible checks and one recorded live demonstration.');
 text(s,'LATEST RECORDED TEST RUN',64,245,520,28,17,C.teal,true);
 text(s,'101',64,282,230,113,92,C.ink,true);text(s,'automated tests passed',300,330,340,42,27,C.ink,true);
 text(s,'81 backend    3 frontend unit    17 browser',64,409,580,32,22,C.muted);
 text(s,'Lint, type checking, production build\nand migration checks passed',64,461,540,65,22,C.muted);
 text(s,'Automation setup verified',64,525,550,24,18,C.teal,true);
 line(s,659,249,0,288,C.line,1);
 text(s,'ONE RECORDED LIVE RUN',710,245,506,28,17,C.teal,true);
 text(s,'37.036 s',710,294,506,61,49,C.ink,true);text(s,'Full agent request, including Qwen overhead',710,363,506,42,20,C.muted);
 text(s,'2.074 s',710,418,506,61,49,C.teal,true);text(s,'Core workflow execution',710,488,506,32,20,C.muted);
 box(s,64,554,1152,66,C.deep,'none',8);
 text(s,'5 tasks',84,570,190,31,25,C.white,true);text(s,'3 human pending + 2 simulated IT',245,577,372,27,18,C.light);
 text(s,'SMTP accepted',663,573,264,31,23,C.green,true);text(s,'0 new attempts on retry',944,579,249,29,17,C.light);
 text(s,'Single demonstration, not an average or success rate. SMTP acceptance does not prove inbox delivery.',64,636,1152,26,17,C.muted);
 text(s,'Automated test run: 30 Oct 2026. Live-run timings are separate recorded measurements.',64,675,1152,24,16,C.teal,true);
 notes(s,'The latest full check on 30 October 2026 in docs/SYSTEM_CHECK_2026-10-30.md records 101 passing tests: 81 backend, 3 frontend unit and 17 browser tests, supported by backend-results.xml and browser-results.json. The single saved primary-database journey records 37.036 seconds total, 2074 milliseconds core workflow execution, five tasks, three pending human HR tasks, two simulated IT requests, verified automation setup and SMTP acceptance. An explicit retry produced no new SMTP attempts. The timings are separate recorded measurements, not averages or a benchmark, and there is no measured human baseline. Inbox delivery is unconfirmed for this historical journey. A separate later demo has independently confirmed Gmail receipt, but that is not attributed to this timed example.',['docs/JOURNEY_LIVE_EVALUATION.json','docs/SYSTEM_CHECK_2026-10-30.md','docs/backend-results.xml','docs/browser-results.json']);
}
// 09: truthful differentiation, limitations and future work.
{
 const s=await slide('Innovation, business value & limitations','A working prototype with explicit boundaries and inspectable outcomes.',true);
 text(s,'WHAT THE PROTOTYPE CONTRIBUTES',64,250,560,30,17,C.green,true);
 const strengths=['Business objectives drive tool orchestration','Locally hosted AI inference','Policy-aware execution with review gates','Durable workflows that resume','Duplicate prevention across retries','Human oversight for consequential decisions','Transparent records and audit evidence'];
 strengths.forEach((v,i)=>text(s,v,64,303+i*43,556,34,21,C.white,i===0));
 line(s,648,249,0,355,'#28646A');
 text(s,'CURRENT LIMITATIONS',700,250,516,30,17,C.green,true);
 const limits=['Scanned PDF OCR is unavailable','External IT provisioning remains simulated','Human HR approvals remain necessary','Held-out task accuracy and time savings\nhave not yet been established','The prototype is not production-ready'];
 let yy=303;limits.forEach(v=>{text(s,v,700,yy,516,v.includes('\n')?64:35,21,C.white);yy+=v.includes('\n')?81:49;});
 text(s,'FUTURE WORK',64,648,190,25,16,C.green,true);text(s,'OCR support, real IT connectors, broader held-out evaluation and measured manual baselines',260,646,956,49,19,C.light);
 notes(s,'Business value here is the implemented ability to coordinate preparation, enforce policy and authorization, avoid duplicate effects and expose evidence. No quantified savings or official compliance outcome is claimed. PDF extraction currently depends on extractable document text and has no scanned-document OCR. IT provisioning is simulated. Future OCR, external task/IT connectors, broader unseen test sets and measured manual baselines are proposals, not implemented features. This is a local hackathon prototype rather than a production-ready service.',['backend/app/documents.py','backend/app/journeys.py','backend/app/onboarding.py','docs/SECURITY.md','docs/HACKATHON_DEMO.md']);
}
// 10: close with a real evidence panel and an honest local demo sequence.
{
 const s=await slide('Conclusion & demo','Challenge 3: Autonomous Enterprise',true);
 text(s,'An incoming contract.\nVerified preparation.\nHuman judgment\nretained.',64,255,460,205,36,C.white,true);
 text(s,'HUMAIN Lifecycle prepares onboarding\nand escalates exceptions that require\nhuman judgment.',64,490,460,100,22,C.light);
 const recorded=JSON.parse(await fs.readFile(path.join(ASSETS,'recorded-journey-evidence.json'),'utf8'));
 const e=recorded.evidence;
 box(s,556,237,660,365,C.paper,'none',0);
 text(s,'Verified evidence',576,254,620,31,22,C.ink,true);
 const evidence=[['Employee record',e.employee_id],['Contract record',e.contract_id],['Internal tasks created',String(e.tasks_created)],['Human tasks remaining',String(e.human_tasks_pending)],['IT requests',`${e.it_requests_simulated} simulated · no accounts provisioned`],['Welcome email','SMTP accepted · inbox unverified'],['Automation setup','Verified']];
 evidence.forEach(([label,value],i)=>{const y=300+i*28;text(s,label,576,y,209,27,17,C.muted);text(s,value,794,y,402,27,16,C.muted);});
 text(s,'Automation setup does not mean the employee is ready. Human checks and real IT provisioning remain separate.',576,510,620,49,15,C.muted);
 text(s,'Source fingerprint: '+recorded.source_sha256,576,573,620,20,11,C.muted);
 text(s,'DEMO',64,638,100,27,17,C.green,true);
 const demo=text(s,'Contract intake   /   Journey & tasks   /   Email receipt   /   Audit',166,635,1025,33,22,C.white,true);
 demo.text.get('Contract intake').link={uri:'http://127.0.0.1:5173/contracts',isExternal:true};
 notes(s,'The evidence panel faithfully recreates the original Verified evidence layout as sharp editable text, with the same labels, actual record IDs, results, warning and full source fingerprint. It is a transcription, not a screenshot. The original screenshot and underlying recorded values remain in presentation_assets. SMTP acceptance does not establish inbox delivery for this timed example. Human approvals and real IT provisioning remain separate. The Contract intake link opens the local app.',['docs/JOURNEY_LIVE_EVALUATION.json','submission/presentation_assets/recorded-journey-evidence.json','submission/presentation_assets/journey-evidence.png']);
}

await fs.writeFile(path.join(BUILD,'presentation.json'),JSON.stringify(deck.toProto()));
await fs.writeFile(path.join(HERE,'slides.json'),JSON.stringify(specs,null,2));
for(let i=0;i<deck.slides.items.length;i++){
 const s=deck.slides.items[i];
 const blob=await deck.export({slide:s,format:'png',scale:2});
 await fs.writeFile(path.join(BUILD,'slides',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
 await fs.writeFile(path.join(BUILD,'slides',`slide-${String(i+1).padStart(2,'0')}.layout.json`),await (await s.export({format:'layout'})).text());
 console.log(`Rendered slide ${i+1}`);
}
await (await PresentationFile.exportPptx(deck)).save(path.join(BUILD,'candidate.pptx'));
console.log('Editable candidate exported');
