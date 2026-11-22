// Diagnostic only: never persist raw protocol params, results or error messages.
// Pinned Playwright 1.63.0 emits one JSON message per DEBUG=pw:protocol line.
import fs from 'node:fs';
import path from 'node:path';
import {once} from 'node:events';
import {StringDecoder} from 'node:string_decoder';
import {stripVTControlCharacters} from 'node:util';

const envelopeMethods=new Set(['Target.sendMessageToTarget','Target.dispatchMessageFromTarget']);
const idFields=['sessionId','targetId','pageProxyId'];
const safeId=value=>typeof value==='string' && /^[\w.:-]{1,128}$/.test(value) || Number.isSafeInteger(value);
const safeMethod=value=>typeof value==='string' && /^[A-Za-z][\w]*\.[A-Za-z][\w]*$/.test(value);
const prefix='pw:protocol-meta ';

class ProtocolFilter {
  // WKConnection.nextMessageId is shared by all sessions, including envelopes.
  pending=new Map();
  line(raw){
    if(raw===null)return [prefix+JSON.stringify({diagnostic:'oversized-line-discarded'})];
    const clean=stripVTControlCharacters(raw);
    const index=clean.indexOf('pw:protocol');
    if(index<0)return [raw];
    const timestamp=clean.match(/^\s*(\d{4}-\d\d-\d\dT[\d:.]+Z)\s/)?.[1];
    const base={timestamp:timestamp || new Date().toISOString(),timestampSource:timestamp?'logger':'filter'};
    const match=clean.slice(index).match(/^pw:protocol\s+(SEND\s+►|◀\s+RECV)\s+(\{.*\})(?:\s+\+\d+(?:ms|s|m|h))?\s*$/);
    if(!match)return [prefix+JSON.stringify({...base,diagnostic:'unparsed-protocol-line'})];
    base.direction=match[1].startsWith('SEND')?'send':'receive';
    try{return this.messages(JSON.parse(match[2]),base).map(record=>prefix+JSON.stringify(record));}
    catch{return [prefix+JSON.stringify({...base,diagnostic:'unparsed-protocol-line'})];}
  }
  messages(message,base,context={},envelopeId,depth=0){
    if(!message || typeof message!=='object' || Array.isArray(message) || depth>8)
      return [{...base,diagnostic:'invalid-protocol-envelope'}];
    const id=Number.isSafeInteger(message.id)?message.id:undefined;
    const previous=base.direction==='receive'?this.pending.get(id):undefined;
    const method=safeMethod(message.method)?message.method:previous?.method;
    const ids={};
    for(const key of idFields){
      const value=message[key] ?? context[key] ?? previous?.[key];
      if(safeId(value))ids[key]=value;
    }
    // These are routing identifiers, not the surrounding protocol payload.
    if(envelopeMethods.has(message.method) || message.method==='Target.targetCreated'){
      for(const key of idFields){
        const value=message.params?.[key] ?? message.params?.targetInfo?.[key];
        if(safeId(value))ids[key]=value;
      }
    }
    const record={...base,...ids};
    if(id!==undefined)record.id=id;
    if(method)record.method=method;
    if(envelopeId!==undefined)record.envelopeId=envelopeId;
    if(message.error){
      record.error=true;
      if(Number.isSafeInteger(message.error.code))record.errorCode=message.error.code;
    }
    if(base.direction==='send' && id!==undefined && method){
      if(this.pending.size<20000)this.pending.set(id,record);
      else record.diagnostic='pending-tracking-capacity-reached';
    }else if(base.direction==='receive' && id!==undefined)this.pending.delete(id);
    const records=[record];
    if(envelopeMethods.has(message.method)){
      try{
        const inner=JSON.parse(message.params.message);
        records.push(...this.messages(inner,base,ids,id,depth+1));
      }catch{records.push({...base,...ids,diagnostic:'unparsed-target-envelope'});}
    }
    return records;
  }
  finish(){
    return [...this.pending.values()].map(record=>prefix+JSON.stringify({...record,diagnostic:'outstanding-at-eof'}));
  }
}

async function* lines(input){
  const decoder=new StringDecoder('utf8');
  let pending='',discard=false;
  function* consume(text){
    let start=0;
    while(start<text.length){
      const newline=text.indexOf('\n',start);
      if(!discard){
        pending+=text.slice(start,newline<0?undefined:newline);
        if(pending.length>8*1024*1024){pending='';discard=true;}
      }
      if(newline<0)break;
      yield discard?null:pending.replace(/\r$/,'');
      pending='';discard=false;start=newline+1;
    }
  }
  for await(const chunk of input)yield* consume(decoder.write(chunk));
  yield* consume(decoder.end());
  if(discard || pending)yield discard?null:pending;
}

async function run(logPath){
  if(!logPath)throw new Error('A filtered log path is required');
  fs.mkdirSync(path.dirname(logPath),{recursive:true});
  const file=fs.openSync(logPath,'w');
  const filter=new ProtocolFilter();
  async function emit(line){
    const output=line+'\n';
    fs.writeSync(file,output);
    if(!process.stdout.write(output))await once(process.stdout,'drain');
  }
  try{
    for await(const line of lines(process.stdin))for(const output of filter.line(line))await emit(output);
    for(const output of filter.finish())await emit(output);
  }finally{fs.closeSync(file);}
}

async function selfTest(){
  const {default:assert}=await import('node:assert/strict');
  const {Readable}=await import('node:stream');
  const {spawnSync}=await import('node:child_process');
  const {fileURLToPath}=await import('node:url');
  const {tmpdir}=await import('node:os');
  const secret='DO_NOT_RETAIN_AUTH_BODY_OR_RESULT';
  const stamp='2026-11-21T18:00:00.000Z';
  const wire=(direction,message)=>`${stamp} pw:protocol ${direction==='send'?'SEND ►':'◀ RECV'} ${JSON.stringify(message)}`;
  const decode=output=>output.map(line=>JSON.parse(line.slice(prefix.length)));
  const filter=new ProtocolFilter();
  const inner={id:41,method:'DOM.getContentQuads',params:{objectId:secret,headers:{Authorization:secret},body:secret}};
  const outer={id:42,method:'Target.sendMessageToTarget',pageProxyId:'page-proxy-1',params:{targetId:'page-2',message:JSON.stringify(inner)}};
  const sent=decode(filter.line(wire('send',outer)));
  assert.deepEqual(sent.map(item=>[item.id,item.method,item.targetId]),[[42,'Target.sendMessageToTarget','page-2'],[41,'DOM.getContentQuads','page-2']]);
  assert.equal(sent[1].envelopeId,42);
  const acknowledged=decode(filter.line(wire('receive',{id:42,result:{body:secret}})));
  assert.equal(acknowledged.length,1);
  assert.equal(acknowledged[0].method,'Target.sendMessageToTarget');
  assert.deepEqual(decode(filter.finish()).map(item=>item.id),[41]);
  const received=decode(filter.line(wire('receive',{method:'Target.dispatchMessageFromTarget',pageProxyId:'page-proxy-1',params:{targetId:'page-2',message:JSON.stringify({id:41,error:{code:-32000,message:secret,data:secret}})}})));
  assert.equal(received[1].method,'DOM.getContentQuads');
  assert.equal(received[1].errorCode,-32000);
  assert.equal(received[1].pageProxyId,'page-proxy-1');
  assert.equal(filter.finish().length,0);
  assert(!JSON.stringify([...sent,...received]).includes(secret));
  const malformed=filter.line(`${stamp} pw:protocol SEND ► {"params":"${secret}" <<<<<( LOG TRUNCATED )>>>>>`);
  assert(!malformed.join('').includes(secret));
  assert.equal(decode(malformed)[0].diagnostic,'unparsed-protocol-line');
  const deep={id:44,method:'Target.sendMessageToTarget',sessionId:'session-3',params:{targetId:'frame-4',message:JSON.stringify(outer)}};
  const nested=decode(filter.line(wire('send',deep)));
  assert.equal(nested.length,3);
  assert.equal(nested[2].id,41);
  assert.equal(nested[2].sessionId,'session-3');
  assert(!JSON.stringify(nested).includes(secret));
  assert.deepEqual(filter.line('ordinary test PASS — preserved'),['ordinary test PASS — preserved']);
  const colored=decode(filter.line('\u001b[32m'+wire('send',{id:45,method:'Runtime.evaluate',params:{expression:secret}})+'\u001b[0m +1ms'));
  assert.equal(colored[0].id,45);
  assert.equal(colored[0].timestamp,stamp);
  const source=Buffer.from(wire('send',outer)+'\r\nordinary Ω log\nlast line');
  const chunks=Array.from({length:Math.ceil(source.length/13)},(_,i)=>source.subarray(i*13,(i+1)*13));
  const framed=[];for await(const line of lines(Readable.from(chunks)))framed.push(line);
  assert.deepEqual(framed,[wire('send',outer),'ordinary Ω log','last line']);
  const oversized=[];for await(const line of lines(Readable.from([Buffer.from('x'.repeat(8*1024*1024+1)+'\nnext\n')])))oversized.push(line);
  assert.deepEqual(oversized,[null,'next']);
  const dir=fs.mkdtempSync(path.join(tmpdir(),'sq-protocol-filter-'));
  const helper=fileURLToPath(import.meta.url);
  const fixture=`process.stdout.write(${JSON.stringify(wire('send',outer)+'\n')});process.stderr.write('ordinary fixture log\\n');process.exit(7)`;
  const result=spawnSync('bash',['-c','set -o pipefail; "$1" -e "$3" 2>&1 | "$1" "$2" "$4"','filter-check',process.execPath,helper,fixture,path.join(dir,'exit.log')],{encoding:'utf8'});
  assert.equal(result.status,7);
  assert(result.stdout.includes('ordinary fixture log'));
  assert(!result.stdout.includes(secret));
  assert.equal(fs.readFileSync(path.join(dir,'exit.log'),'utf8'),result.stdout);
  const timed=spawnSync('bash',['-c','set -o pipefail; timeout 0.2s "$1" -e "setInterval(()=>{},1000)" 2>&1 | "$1" "$2" "$3"','timeout-check',process.execPath,helper,path.join(dir,'timeout.log')],{encoding:'utf8'});
  assert.equal(timed.status,124);
  console.log('PASS protocol filter: nested correlation, payload exclusion, malformed/oversized input, chunk framing, ordinary logs, failure and timeout exit codes');
}

try{if(process.argv[2]==='--self-test')await selfTest();else await run(process.argv[2]);}
catch{console.error('Playwright protocol diagnostic filter failed');process.exitCode=1;}
