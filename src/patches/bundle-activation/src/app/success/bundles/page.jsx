'use client';
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
export default function BundleSuccessPage(){
  const router=useRouter();
  const [countdown,setCountdown]=useState(2);
  useEffect(()=>{
    const interval=setInterval(()=>setCountdown(n=>Math.max(0,n-1)),1000);
    const timeout=setTimeout(()=>router.replace('/'),2000);
    return ()=>{clearInterval(interval);clearTimeout(timeout);};
  },[router]);
  return <main style={{minHeight:'100vh',display:'grid',placeItems:'center'}}><section><h1>Thank you</h1><p>Payment and delivery are confirmed separately by our server.</p><p>Returning home in {countdown}s…</p></section></main>;
}
