const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const handlers={}, nodes=new Map(), storage=new Map();
function node(){return {innerHTML:'',textContent:'',open:false,classList:{add(){},remove(){},toggle(){}},showModal(){this.open=true;},close(){this.open=false;},addEventListener(){}};}
const context=vm.createContext({
 console, Date, Blob, URL, setTimeout:()=>0,clearTimeout(){},
 document:{querySelector:s=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},body:node(),addEventListener:(k,f)=>handlers[k]=f},
 window:{scrollTo(){}},localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
 FormData:class{constructor(form){this.form=form;}[Symbol.iterator](){return Object.entries(this.form.values)[Symbol.iterator]();}}
});
vm.runInContext(fs.readFileSync(__dirname+'/app.js','utf8'),context);
const run=s=>vm.runInContext(s,context);
const submit=(id,values,dataset={})=>handlers.submit({preventDefault(){},target:{id,values,dataset,reportValidity:()=>true}});
const click=(action,id)=>handlers.click({target:{closest:sel=>sel==='[data-action]'?{dataset:{action,id}}:null}});
assert.equal(run("workingDays('2026-12-04','2026-12-11')"),5);
assert.equal(run("addWorking('2026-12-11',9)"),'2026-12-24');
assert.equal(run("packages().length"),5);
submit('package-form',{forecast:'2026-12-09',reported:'75',reason:'Recovery reference R1'},{id:'VP-001'});
assert.equal(run("state.packages[0].baseline"),'2026-12-04');
assert.equal(run("state.packages[0].actual"),64);
assert.equal(run("state.packages[0].reported"),75);
submit('review-form',{evidence:'Verified shop record'},{id:'VP-001'});
assert.equal(run("state.packages[0].actual"),75);
const before=run('state.tasks.length');
submit('note-form',{pkg:'VP-001',type:'Concern',title:'Test production concern',body:'Inspection evidence',severity:'High',due:'2026-11-12'});
assert.equal(run('state.tasks.length'),before+1);
const tid=run('state.tasks[0].id'), nid=run('state.notes[0].id');
click('task-step',tid);click('task-step',tid);
assert.equal(run('state.tasks[0].status'),'Submitted');
assert.equal(run('state.notes[0].status'),'Open');
submit('close-note-form',{evidence:'Independent closure verification'},{id:nid});
assert.equal(run('state.tasks[0].status'),'Completed');
assert.equal(run('state.notes[0].status'),'Closed');
submit('note-form',{pkg:'VP-001',type:'Highlight',title:'Test highlight',body:'Positive news',severity:'Low',due:'2026-11-12'});
assert.equal(run('state.tasks.length'),before+1);
submit('task-form',{scope:'private',title:'PRIVATE_SENTINEL',due:'2026-11-12'});
assert.equal(run("taskMode='project'; tasks().some(t=>t.title==='PRIVATE_SENTINEL')"),false);
assert.equal(run("state.log.some(l=>l.message.includes('PRIVATE_SENTINEL'))"),false);
assert.equal(run("taskMode='personal'; tasks().some(t=>t.title==='PRIVATE_SENTINEL')"),true);
run("state.project='delta'");
assert.equal(run('packages().length'),1);
assert.equal(run("taskMode='project'; tasks().some(t=>t.project==='coral')"),false);
run("state.project='coral';state.role='client'");
assert.equal(run("packages().some(p=>p.vendor==='Emerson')"),false);
assert.equal(run('notes().length'),0);
assert.equal(run('tasks().length'),0);
assert.equal(run("logPanel().includes('Recovery reference R1')"),false);
const snapshot=run('JSON.stringify(state)');
submit('package-form',{forecast:'2027-01-10',reported:'100',reason:'forbidden'},{id:'VP-001'});
assert.equal(run('JSON.stringify(state)'),snapshot);
run("state.role='manager'");
assert.equal(run("state.docs.find(d=>d.id==='D2').mws"),'Pending');
submit('doc-form',{evidence:'MWS sample response'},{id:'D2',party:'mws'});
assert.equal(run("state.docs.find(d=>d.id==='D2').mws"),'Accepted');
assert.equal(run("state.docs.find(d=>d.id==='D2').rev"),'B');
assert.ok(storage.size>0);
assert.equal(run("esc('<script>alert(1)</script>')"),'&lt;script&gt;alert(1)&lt;/script&gt;');
console.log('PASS: working dates, forecast/baseline separation, accepted progress, linked concern verification, highlight behavior, private-task isolation, project switching, client preview filtering, document review, persistence, and output escaping.');
