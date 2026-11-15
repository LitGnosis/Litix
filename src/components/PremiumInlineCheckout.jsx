"use client";

import React from "react";
import LitixIcon from "./LitixIcon";

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
  totalLabel = "",
  selectedLabel = "",
  showSticky = false,
}) {
  return (
    <div id="litix-secure-payment" className="premium-inline-checkout" aria-label="Secure card checkout">
      {showFields && (
        <>
          <div className="premium-checkout-heading">
            <span className="premium-checkout-mark" aria-hidden="true"><LitixIcon name="lock" size={20}/></span>
            <div>
              <p className="premium-checkout-title">Secure card checkout</p>
              <p className="premium-checkout-subtitle">Encrypted payment fields hosted by PayKings</p>
            </div>
            <span className="premium-checkout-badge">SECURE</span>
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
        <li><LitixIcon name="shield-check" size={15}/> Live service verification</li>
        <li><LitixIcon name="receipt" size={15}/> Private order tracking</li>
        <li><LitixIcon name="lock" size={15}/> PayKings-hosted card fields · No social passwords required</li>
      </ul>
      {showSticky&&<aside className="litix-mobile-checkout-bar" aria-label="Mobile checkout shortcut">
        <div className="litix-mobile-checkout-total">
          <small>{selectedLabel||"Selected service"}</small>
          <strong>{totalLabel}</strong>
        </div>
        {canPay&&cardReady?
          <button type="submit" className="litix-mobile-checkout-button" disabled={busy} aria-busy={busy}>
           {busy?"Processing…":"Pay securely"}
          </button>:
          <button type="button" className="litix-mobile-checkout-button" disabled={busy}
           onClick={()=>document.getElementById("litix-secure-payment")?.scrollIntoView({behavior:"smooth",block:"center"})}>
           Continue to checkout
          </button>}
      </aside>}
    </div>
  );
}
