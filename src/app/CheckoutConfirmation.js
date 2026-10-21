'use client';
import {useEffect,useState} from 'react';
import OrderStatus from './OrderStatus';
import {checkoutReferenceKey,confirmationState,savedCheckoutReference} from '../lib/orderConfirmation.mjs';
export default function CheckoutConfirmation({initialSession='',initialOrderId='',initialToken=''}) {
  const [state,setState]=useState('loading');
  useEffect(()=>{
    let stopped=false,timer,redirect,controller;
    const reference=initialSession?{session_id:initialSession}:initialOrderId&&initialToken?{order_id:initialOrderId,token:initialToken}:null;
    let payload=reference;
    if(!payload)try{payload=savedCheckoutReference(sessionStorage.getItem(checkoutReferenceKey))}catch{}
    if(!payload){setState('manual');return}
    const started=Date.now();
    async function poll(){
      controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),15000);
      try{
        const response=await fetch('/api/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload),cache:'no-store',signal:controller.signal});
        const data=await response.json();
        if(stopped)return;
        const next=response.ok?confirmationState(data.order):'pending';
        setState(next);
        if(next==='confirmed'||next==='completed'){
          redirect=setTimeout(()=>{window.location.replace('/')},4000);
          return;
        }
        if(next==='failed')return;
      }catch{if(stopped)return;setState('pending')}
      finally{clearTimeout(timeout)}
      if(Date.now()-started<300000)timer=setTimeout(poll,5000);
      else setState('delayed');
    }
    poll();
    return()=>{stopped=true;clearTimeout(timer);clearTimeout(redirect);controller?.abort()};
  },[initialSession,initialOrderId,initialToken]);
  if(state==='manual')return <><h1>Track your order</h1><p>Open your receipt link to check automatically, or enter your details below.</p><OrderStatus/></>;
  return <div className="pageCard" role="status" aria-live="polite">
    <h1>{state==='completed'?'Order completed':state==='confirmed'?'Order confirmed':state==='failed'?'Payment not completed':state==='delayed'?'Confirmation is taking longer':'Confirming your order…'}</h1>
    <p>{state==='completed'?'Delivery is complete. Returning you to the home page…':state==='confirmed'?'Payment received. Delivery will continue automatically. Returning you to the home page…':state==='failed'?'Your payment has not been confirmed. Please contact support before trying again.':state==='delayed'?'Please check your receipt or contact support. Do not pay again.':'No need to enter anything. We are checking your payment automatically.'}</p>
    <a href="/">Back to home</a> · <a href="/support">Support</a>
  </div>;
}
