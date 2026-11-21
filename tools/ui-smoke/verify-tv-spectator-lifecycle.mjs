import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute the actual viewer source with browser lifecycle and channel fixtures.
// An optional source path allows the same regression to be replayed before a fix.
const sourcePath=process.argv[2] || new URL('../../assets/tv/arcade.js',import.meta.url);
const source=fs.readFileSync(sourcePath,'utf8');
const channelId='12345678-1234-1234-1234-123456789abc';

function viewer({hash='#'+channelId,embedded=false,available=true}={}){
  const listeners=new Map(),channels=[],live=new Set(),frames=[];
  const screen={hidden:true,addEventListener(){}},status={hidden:false,textContent:''};
  class Channel {
    constructor(name){
      this.name=name;this.closed=false;this.messages=[];this.onmessage=null;
      channels.push(this);live.add(this);
      assert.equal(live.size,1,'a viewer must have only one live channel');
    }
    postMessage(value){
      if(this.closed)throw new DOMException('BroadcastChannel is closed','InvalidStateError');
      this.messages.push(value);
    }
    close(){this.closed=true;live.delete(this);}
    receive(data){if(!this.closed)this.onmessage?.({data:structuredClone(data)});}
  }
  const sandbox={
    console,setTimeout,clearTimeout,requestAnimationFrame:()=>1,cancelAnimationFrame(){},
    location:{hash},BroadcastChannel:available?Channel:undefined,
    matchMedia:()=>({matches:true,addEventListener(){}}),
    document:{
      querySelector:selector=>selector==='#screen'?screen:status,
      addEventListener(){},fonts:{ready:Promise.resolve()}
    },
    addEventListener(type,handler,options){
      const handlers=listeners.get(type)||[];
      handlers.push({handler,once:!!options?.once});listeners.set(type,handlers);
    }
  };
  sandbox.window=sandbox;sandbox.top=embedded?{}:sandbox;
  vm.runInNewContext(source,sandbox,{filename:String(sourcePath)});
  // Rendering has separate browser coverage; observe the real channel handoff.
  sandbox.showTvFrame=frame=>frames.push(frame);
  const dispatch=(type,persisted)=>{
    for(const entry of [...(listeners.get(type)||[])]){
      if(entry.once)listeners.set(type,listeners.get(type).filter(item=>item!==entry));
      entry.handler({type,persisted});
    }
  };
  return {channels,live,frames,screen,status,dispatch};
}

const page=viewer();
assert.equal(page.channels.length,1);
assert.equal(page.channels[0].name,'sq-tv-'+channelId);
assert.deepEqual(page.channels[0].messages,['ready']);
page.dispatch('pageshow',false);
page.dispatch('pageshow',false);
assert.equal(page.channels.length,1,'initial/repeated pageshow must reuse the open channel');
page.channels[0].receive({frame:{totals:[10,0]}});
assert.deepEqual(page.frames,[{totals:[10,0]}]);

for(let cycle=0;cycle<3;cycle++){
  const old=page.channels.at(-1),received=page.frames.length;
  page.dispatch('pagehide',true);
  page.dispatch('pagehide',true);
  assert.equal(page.live.size,0);
  assert.equal(old.closed,true);
  old.receive({frame:{totals:[999,999]}});
  assert.equal(page.frames.length,received,'closed receivers must not deliver stale frames');
  page.dispatch('pageshow',true);
  const current=page.channels.at(-1);
  assert.notEqual(current,old,'restore must create a usable receiver');
  assert.equal(current.name,'sq-tv-'+channelId,'restore must retain the scorer channel identity');
  assert.equal(page.live.size,1);
  assert.deepEqual(current.messages,['ready']);
  page.dispatch('pageshow',true);
  assert.equal(page.channels.at(-1),current,'duplicate pageshow must not create another channel');
  current.receive({frame:{totals:[cycle+11,0]}});
  assert.deepEqual(page.frames.at(-1),{totals:[cycle+11,0]});
  const count=page.frames.length;
  current.receive({score:'Treble'});
  assert.equal(page.frames.length,count,'spectator ignores incoming scoring commands');
  assert.ok(current.messages.every(message=>message==='ready'),'spectator sends only readiness');
}
page.channels.at(-1).receive({closed:true});
assert.equal(page.screen.hidden,true);
assert.equal(page.status.hidden,false);
assert.equal(page.status.textContent,'Waiting for the scorer to reopen TV mode');
page.dispatch('pagehide',false);
assert.equal(page.live.size,0,'normal unload must release the channel');
const reloaded=viewer();
reloaded.dispatch('pageshow',false);
reloaded.channels[0].receive({frame:{totals:[20,0]}});
assert.deepEqual(reloaded.frames,[{totals:[20,0]}]);
reloaded.dispatch('pagehide',false);
assert.equal(reloaded.live.size,0);

for(const options of [{embedded:true},{hash:'#invalid'},{available:false}]){
  const inactive=viewer(options);
  inactive.dispatch('pageshow',false);
  inactive.dispatch('pagehide',true);
  inactive.dispatch('pageshow',true);
  assert.equal(inactive.channels.length,0,'only a standalone valid spectator opens a channel');
}
console.log('PASS spectator initial load, repeated bfcache restore, single channel, frame delivery, read-only messages and normal reload');
