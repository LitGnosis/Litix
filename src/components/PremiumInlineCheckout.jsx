"use client";

import React from "react";

/**
 * PayKings/NMI Collect.js hosted fields. Raw card details never touch Litix.
 * The primary CTA remains rendered even while checkout details are incomplete.
 */
export default function PremiumInlineCheckout({
  cardReady,
  busy,
  canPay,
  buttonLabel,
  showFields = false,
  helperText = "",
  walletHandlers = {},
}) {
  return (
    <div className="premium-inline-checkout" aria-label="Secure card checkout">
      {showFields && (
        <>
          <div className="premium-checkout-heading">
            <span className="premium-checkout-mark" aria-hidden="true">◆</span>
            <div>
              <p className="premium-checkout-title">Secure card checkout</p>
              <p className="premium-checkout-subtitle">Encrypted payment fields hosted by PayKings</p>
            </div>
            <span className="premium-checkout-badge">SECURE</span>
          </div>
          <div className="litix-wallets" aria-label="Express wallet options">
            {["apple","google"].map(wallet=>{
              const enabled=typeof walletHandlers[wallet]==="function"&&!busy;
              return <button key={wallet} type="button" className="litix-wallet-option"
                disabled={!enabled} aria-label={(wallet==="apple"?"Apple Pay":"Google Pay")+(enabled?" express checkout":" not activated")}
                onClick={()=>walletHandlers[wallet]?.()}>
                <span>{wallet==="apple"?"Apple Pay":"Google Pay"}</span>
                {!enabled&&<small>Not activated</small>}
              </button>;
            })}
          </div>
          <div className="premium-card-fields">
            <label className="premium-card-field">
              <span>Card number</span>
              <div className="field" id="ccnumber" />
            </label>
            <div className="premium-card-row">
              <label className="premium-card-field">
                <span>Expiration</span>
                <div className="field" id="ccexp" />
              </label>
              <label className="premium-card-field">
                <span>Security code</span>
                <div className="field" id="cvv" />
              </label>
            </div>
          </div>
        </>
      )}
      {helperText && (
        <p className="premium-checkout-helper" role="status" aria-live="polite">
          {helperText}
        </p>
      )}
      <button
        className="primary premium-pay-button"
        type="submit"
        disabled={!canPay || !cardReady || busy}
        aria-busy={busy}
      >
        {busy && <span className="premium-pay-spinner" aria-hidden="true" />}
        <span>{buttonLabel}</span>
      </button>
      <ul className="litix-checkout-trust" aria-label="Checkout safeguards">
        <li><span aria-hidden="true">✓</span> Live service verification</li>
        <li><span aria-hidden="true">✓</span> Private order tracking</li>
        <li><span aria-hidden="true">✓</span> No social passwords required</li>
      </ul>
      <p className="premium-checkout-security">Final price and service availability are verified before payment.</p>
    </div>
  );
}
