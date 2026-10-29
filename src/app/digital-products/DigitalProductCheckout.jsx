"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PremiumInlineCheckout from "../../../components/PremiumInlineCheckout";

const newKey = () => {
  try { return globalThis.crypto.randomUUID(); } catch { return ""; }
};

export default function DigitalProductCheckout({ productId, productName }) {
  const [config, setConfig] = useState({ loaded: false, ready: false, publicKey: "" });
  const [email, setEmail] = useState("");
  const [cardReady, setCardReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const completePayment = useRef(null);

  useEffect(() => {
    setIdempotencyKey(newKey());
    let active = true;
    fetch("/api/digital-products/config?productId=" + encodeURIComponent(productId), { cache: "no-store" })
      .then((response) => response.json())
      .then((value) => {
        if (active) setConfig({ loaded: true, ready: value.ready === true, publicKey: value.publicKey || "" });
      })
      .catch(() => {
        if (active) setConfig({ loaded: true, ready: false, publicKey: "" });
      });
    return () => { active = false; };
  }, [productId]);

  const purchase = useCallback(async (paymentToken) => {
    try {
      const response = await fetch("/api/digital-products/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId, email, paymentToken, idempotencyKey }),
      });
      const result = await response.json();
      setReceipt(result);
      setNotice(result.message || result.error || "Checkout response received.");
      if (response.ok && result.ok) {
        setCardReady(false);
      } else if (response.status === 402) {
        setIdempotencyKey(newKey());
      }
    } catch {
      setNotice("We couldn't confirm the payment response. Do not submit a second order; contact support for reconciliation.");
    } finally {
      setBusy(false);
    }
  }, [productId, email, idempotencyKey]);

  useEffect(() => {
    completePayment.current = purchase;
  }, [purchase]);

  useEffect(() => {
    if (!config.ready || !config.publicKey) return undefined;

    let active = true;
    let configured = false;
    let failed = false;
    let pollId = null;
    let timeoutId = null;
    let pollStartedAt = 0;
    let script = document.querySelector('script[data-litix-paykings-collect="true"]');

    const getCollectJS = () => typeof window !== "undefined" ? window.CollectJS : undefined;
    const fail = (message) => {
      if (!active || configured) return;
      failed = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      setCardReady(false);
      setNotice(message);
    };
    const prepareScript = (element) => {
      element.setAttribute("data-litix-paykings-collect", "true");
      element.setAttribute("data-tokenization-key", config.publicKey);
      element.setAttribute("data-variant", "inline");
      element.setAttribute("data-style-sniffer", "false");
      element.setAttribute("data-field-ccnumber-selector", "#ccnumber");
      element.setAttribute("data-field-ccexp-selector", "#ccexp");
      element.setAttribute("data-field-cvv-selector", "#cvv");
    };

    const initialize = () => {
      const collect = getCollectJS();
      if (!active || configured || !collect || typeof collect.configure !== "function") return;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        fail("Secure card fields did not finish initializing. Retry or contact support.");
      }, 15000);
      try {
        collect.configure({
          variant: "inline",
          styleSniffer: false,
          customCss: { "font-size": "16px", "font-family": "sans-serif", color: "#ffffff", "background-color": "transparent" },
          placeholderCss: { color: "#aebfd4" },
          validCss: { color: "#4ade80" },
          invalidCss: { color: "#fb7185" },
          fields: {
            ccnumber: { selector: "#ccnumber", title: "Card Number", placeholder: "Card number" },
            ccexp: { selector: "#ccexp", title: "Expiration Date", placeholder: "MM / YY" },
            cvv: { selector: "#cvv", title: "Security Code", placeholder: "CVV" },
          },
          callback: (result) => {
            if (!active) return;
            if (result?.token) completePayment.current?.(result.token);
            else {
              setNotice("Secure card tokenization failed. Check the card fields and try again.");
              setBusy(false);
            }
          },
          fieldsAvailableCallback: () => {
            if (!active || configured) return;
            configured = true;
            if (timeoutId !== null) window.clearTimeout(timeoutId);
            setCardReady(true);
            setNotice("");
          },
        });
      } catch {
        fail("PayKings could not initialize secure card fields. Check the public tokenization key and retry.");
      }
    };

    const poll = () => {
      if (!active || configured || failed) return;
      const collect = getCollectJS();
      const apiReady = Boolean(collect && typeof collect.configure === "function");
      const fields = ["ccnumber", "ccexp", "cvv"].map((id) => document.getElementById(id));
      const fieldsReady = fields.every((element) => element && element.getClientRects().length > 0 && window.getComputedStyle(element).visibility !== "hidden");
      if (apiReady && fieldsReady) {
        if (pollId !== null) window.clearInterval(pollId);
        pollId = null;
        initialize();
      } else if (Date.now() - pollStartedAt > 12000) {
        if (pollId !== null) window.clearInterval(pollId);
        pollId = null;
        fail(!apiReady ? "PayKings Collect.js did not initialize. Retry secure fields." : "Secure card fields are not visible yet. Please retry.");
      }
    };

    const onLoad = () => poll();
    const onError = () => fail("PayKings Collect.js could not load. Check the gateway connection.");
    const currentCollect = getCollectJS();

    if (currentCollect && typeof currentCollect.configure === "function") {
      if (script?.dataset.tokenizationKey && script.dataset.tokenizationKey !== config.publicKey) {
        fail("A different tokenization key is already loaded. Refresh the page before checkout.");
      } else {
        pollStartedAt = Date.now();
        poll();
        if (!configured && pollId === null) pollId = window.setInterval(poll, 100);
      }
    } else {
      if (script) script.remove();
      document.querySelectorAll('script[src*="secure.nmi.com/token/Collect.js"]').forEach((element) => element.remove());
      script = document.createElement("script");
      script.src = "https://secure.nmi.com/token/Collect.js";
      script.async = true;
      prepareScript(script);
      script.addEventListener("load", onLoad, { once: true });
      script.addEventListener("error", onError, { once: true });
      pollStartedAt = Date.now();
      document.head.appendChild(script);
      poll();
      if (!configured && pollId === null) pollId = window.setInterval(poll, 100);
    }

    return () => {
      active = false;
      if (failed && script && !getCollectJS()?.configure) script.dataset.litixFailed = "true";
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      if (pollId !== null) window.clearInterval(pollId);
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [config.ready, config.publicKey]);

  function submit(event) {
    event.preventDefault();
    if (!cardReady || busy || !email || !idempotencyKey) return;
    setBusy(true);
    setNotice("");
    try {
      const collect = typeof window !== "undefined" ? window.CollectJS : undefined;
      if (!collect || typeof collect.startPaymentRequest !== "function") throw new Error("Secure card fields are not ready. Please retry.");
      collect.startPaymentRequest();
    } catch (error) {
      setBusy(false);
      setNotice(error.message || "Complete the secure card fields before paying.");
    }
  }

  if (!config.loaded || !config.ready) {
    return <section className="digital-checkout-unavailable"><div className="digital-eyebrow">SECURE CHECKOUT</div><p>Purchases are not open yet. The checkout will appear here once the final product bundle and payment safeguards are ready.</p></section>;
  }

  return (
    <section className="digital-checkout-panel" aria-label={"Checkout for " + productName}>
      <div className="digital-eyebrow">SECURE CHECKOUT</div>
      <h2>Get {productName}</h2>
      <p className="digital-checkout-note">Card details are collected by PayKings-hosted secure fields. Litix receives a payment token only.</p>
      <form onSubmit={submit}>
        <label className="digital-checkout-email-label" htmlFor="digital-checkout-email">Email for your receipt and download link</label>
        <input id="digital-checkout-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
        <div className="digital-checkout-card-fields">
          <label><span>Card number</span><div className="field" id="ccnumber" /></label>
          <div className="digital-checkout-card-row">
            <label><span>Expiration</span><div className="field" id="ccexp" /></label>
            <label><span>Security code</span><div className="field" id="cvv" /></label>
          </div>
        </div>
        <button className="digital-primary digital-waitlist-submit" type="submit" disabled={!cardReady || busy || !idempotencyKey}>
          {busy ? "Processing securely…" : "Pay securely"} <span aria-hidden="true">↗</span>
        </button>
      </form>
      {notice ? <p className="digital-form-status" role="status" aria-live="polite">{notice}</p> : null}
      {receipt?.downloadUrl ? <p className="digital-download-result"><a href={receipt.downloadUrl}>Download your product bundle ↗</a><span>Keep this link private. It expires in 30 days and allows up to five downloads.</span></p> : null}
      <p className="digital-form-privacy">Do not submit card details anywhere except the secure hosted fields above. If a payment outcome is uncertain, do not retry; contact support.</p>
    </section>
  );
}
