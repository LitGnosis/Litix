"use client";

import { useState } from "react";

const options = [
  ["all", "All digital kits"],
  ["creator-launch-kit", "Creator Launch Kit"],
  ["social-growth-toolkit", "Social Growth Toolkit"],
  ["agency-starter-pack", "Agency Starter Pack"],
];

export default function EarlyAccessForm() {
  const [email, setEmail] = useState("");
  const [interest, setInterest] = useState("all");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("Saving your signup…");
    try {
      const response = await fetch("/api/digital-products/early-access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, productInterest: interest, consent }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Signup could not be saved.");
      setEmail("");
      setConsent(false);
      setStatus(result.message || "You're on the early-access list.");
    } catch (error) {
      setStatus(error.message || "Please try again later.");
    }
  }

  return (
    <form className="digital-waitlist-form" onSubmit={submit}>
      <label htmlFor="digital-waitlist-email">Email address</label>
      <input id="digital-waitlist-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
      <label htmlFor="digital-waitlist-interest">Product interest</label>
      <select id="digital-waitlist-interest" value={interest} onChange={(event) => setInterest(event.target.value)}>
        {options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>
      <label className="digital-consent">
        <input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>Send me email updates about the Litix digital-product launch. I can opt out later.</span>
      </label>
      <button className="digital-primary digital-waitlist-submit" type="submit" disabled={status === "Saving your signup…"}>
        {status === "Saving your signup…" ? "Saving…" : "Join early access"} <span aria-hidden="true">↗</span>
      </button>
      {status ? <p className="digital-form-status" role="status" aria-live="polite">{status}</p> : null}
      <p className="digital-form-privacy">Your address will be used for launch updates about Litix digital products.</p>
    </form>
  );
}
