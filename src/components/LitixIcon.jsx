"use client";
import React from "react";

const paths=Object.freeze({
 "lock":"M5 11V7a7 7 0 0 1 14 0v4 M4 11h16v10H4z M12 15v3",
 "shield-check":"M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z M8.5 12l2.4 2.4 4.8-4.8",
 "receipt":"M4 3h16v18l-3-2-3 2-2-2-3 2-2-2-3 2z M8 8h8 M8 12h8 M8 16h4",
 "badge-check":"M12 2l3 2 4-.1.8 4 2.2 4.1-2.2 3.2-.8 4.9-4-.1-3 2-3-2-4 .1-.8-4.9L2 12l2.2-4.1.8-4 4 .1z M8.5 12l2.3 2.3 4.9-4.9",
 "layers":"M12 2l10 6-10 6L2 8z M2 12l10 6 10-6 M2 16l10 6 10-6",
 "phone":"M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.6 2.7a2 2 0 0 1-.6 1.8L7.2 9.9a16 16 0 0 0 6.9 6.9l1.7-1.9a2 2 0 0 1 1.8-.6l2.7.6a2 2 0 0 1 1.7 2Z",
 "info":"M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z M12 11v6 M12 7h.01"
});
export default function LitixIcon({name,size=18,className=""}){
 const d=paths[name]||paths.info;
 return <svg width={size} height={size} viewBox="0 0 24 24"
  fill="none" stroke="currentColor" strokeWidth="1.8"
  strokeLinecap="round" strokeLinejoin="round"
  aria-hidden="true" focusable="false" className={className}><path d={d}/></svg>;
}
