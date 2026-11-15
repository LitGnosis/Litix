export type LitixOrderProof={
 orderId:string;
 buyerIp:string|null;
 userAgent:string;
 checkoutEmail:string;
 paymentTransactionId:string|null;
 targetUrl:string;
 capturedAt:string;
};
export type ProofEvent={
 ordinal:number|null;
 eventType:string;
 details:Record<string,unknown>;
 occurredAt:string;
};
export {litixClientEvidence,recordOrderProof,recordProofEvent} from "./litixOrderProof.mjs";
