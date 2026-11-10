'use client';

import { useEffect, useState } from 'react';

type NodeState='idle'|'busy'|'offline';
type NodeRecord={
  id:string;state:NodeState;cpuPercent:number|null;reportedCarrier:string|null;
  networkHealthy:boolean;networkLatencyMs:number|null;heartbeatAt:string;
};
type Telemetry={asOf:string;source:string;onlineNodes:number;activeNodes:number;nodes:NodeRecord[];note:string};

const safeTime=(date:string)=>new Date(date).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',second:'2-digit'});
const stateStyle:Record<NodeState,string>={
  busy:'border-cyan-500/40 bg-cyan-900/30 text-cyan-200',
  idle:'border-emerald-500/40 bg-emerald-900/25 text-emerald-200',
  offline:'border-amber-500/40 bg-amber-900/25 text-amber-200',
};

export default function LiveFulfillmentTerminal() {
  const [data,setData]=useState<Telemetry|null>(null);
  const [status,setStatus]=useState<'connecting'|'connected'|'locked'|'unavailable'>('connecting');
  useEffect(()=>{
    let mounted=true;
    const aborter=new AbortController();
    const refresh=async()=>{
      try {
        const response=await fetch('/api/fulfillment/terminal',{cache:'no-store',credentials:'same-origin',signal:aborter.signal});
        if(!response.ok){if(mounted){setData(null);setStatus(response.status===401?'locked':'unavailable');}return;}
        const latest=await response.json() as Telemetry;
        if(!Array.isArray(latest.nodes) || latest.source!=='verified_database_snapshot')throw new Error('invalid_telemetry');
        if(mounted){setData(latest);setStatus('connected');}
      }catch{if(mounted){setData(null);setStatus('unavailable');}}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),15_000);
    return ()=>{mounted=false;clearInterval(timer);aborter.abort();};
  },[]);

  return <section aria-label="Litix owned operations telemetry" className="mx-auto max-w-6xl rounded-3xl border border-sky-700/40 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 p-5 text-slate-100 shadow-2xl sm:p-9">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-3 border-b border-sky-700/30 pb-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-cyan-400">Litix · Owner Operations</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">First-Party Node Terminal</h2>
        <p className="mt-2 text-sm text-blue-200/75">Authenticated hardware snapshots from your owned infrastructure.</p>
      </div>
      <span className={`rounded-full border px-3 py-1 text-xs font-bold ${status==='connected'?'border-emerald-500/40 text-emerald-300':'border-amber-500/40 text-amber-300'}`}>
        {status==='connected'?'LIVE DATABASE TELEMETRY':status==='locked'?'OWNER AUTH REQUIRED':status==='connecting'?'CONNECTING':'DATA UNAVAILABLE'}
      </span>
    </div>

    {data ? <>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Metric name="Owned nodes online" value={String(data.onlineNodes)} />
        <Metric name="Nodes handling jobs" value={String(data.activeNodes)} />
        <Metric name="Snapshot" value={safeTime(data.asOf)} />
      </div>
      <div className="space-y-3" aria-live="polite">
        {data.nodes.length===0?<p className="rounded-xl border border-slate-700 p-5 text-slate-300">No verified owned hardware registered. No performance claims are shown.</p>:
          data.nodes.map((node)=><article key={node.id} className="grid gap-3 rounded-xl border border-slate-700/70 bg-white/[0.035] p-4 md:grid-cols-[1.1fr_1.4fr_1fr] md:items-center">
            <div>
              <p className="font-mono text-sm font-bold tracking-wider text-cyan-100">{node.id}</p>
              <p className="mt-1 text-xs text-slate-400">Heartbeat {safeTime(node.heartbeatAt)}</p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-200">{node.reportedCarrier?`Reported carrier: ${node.reportedCarrier}`:'Carrier not verified'}</p>
              <p className="mt-1 text-xs text-slate-400">Owned health-probe latency: {node.networkLatencyMs===null?'Unavailable':`${node.networkLatencyMs} ms`}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${stateStyle[node.state]}`}>{node.state.toUpperCase()}</span>
              <span className="text-xs text-slate-400">CPU {node.cpuPercent===null?'—':`${node.cpuPercent}%`}</span>
            </div>
          </article>)}
      </div>
      <p className="mt-6 text-xs leading-relaxed text-blue-200/70">{data.note}</p>
    </> : <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-300">
      {status==='locked'?'Authenticate through Litix owner access to view hardware identifiers and carrier records.':
       status==='connecting'?'Requesting verified telemetry…':'The monitor is unavailable. No simulated nodes or metrics will be displayed.'}
    </div>}
  </section>;
}

function Metric({name,value}:{name:string;value:string}) {
  return <div className="rounded-xl border border-sky-700/30 bg-cyan-400/[0.06] p-4">
    <p className="text-xs uppercase tracking-wider text-blue-200/70">{name}</p>
    <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-cyan-100">{value}</p>
  </div>;
}
