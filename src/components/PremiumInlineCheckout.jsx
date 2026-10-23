"use client";

import React from "react";

/**
 * Presentation layer for the inline PayKings/NMI Collect.js fields.
 * Card data stays in gateway-hosted/tokenized fields; this component never
 * reads or submits raw card numbers or CVC values.
 *
 * Render inside the checkout form so the parent can start CollectJS
 * tokenization and send only the returned payment token to /api/checkout.
 */
export default function PremiumInlineCheckout({
  cardReady,
  busy,
  canPay,
  buttonLabel,
}) {
  return (
    <div className="premium-inline-checkout" aria-label="Secure card checkout">
      <div className="premium-checkout-heading">
        <span className="premium-checkout-mark" aria-hidden="true">◆</span>
        <div>
          <p className="premium-checkout-title">Secure card checkout</p>
          <p className="premium-checkout-subtitle">
            Encrypted payment fields hosted by PayKings
          </p>
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
            <div className="field" id="ccdate" />
          </label>
          <label className="premium-card-field">
            <span>Security code</span>
            <div className="field" id="ccsecurity" />
          </label>
        </div>
      </div>
      <button
        className="primary premium-pay-button"
        type="submit"
        disabled={!canPay || !cardReady || busy}
      >
        {buttonLabel}
      </button>
      <p className="premium-checkout-footnote">
        Litix receives a payment token only; card details are handled by the payment gateway.
      </p>
    </div>
  );
}
