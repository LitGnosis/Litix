export type CartPaymentResult={
 orderId:string;
 payment:"paid"|"review"|"declined";
 fulfillment?:string;
 message:string;
 secret?:string;
};
export type CartLineStatus=
 "PENDING_PAYMENT"|"QUEUED"|"DISPATCHING"|"SUBMITTED"|
 "COMPLETED"|"FAILED"|"UNKNOWN_OUTCOME"|"MANUAL_REVIEW";
export {dispatchCartLine,dispatchCart,handleCartPurchase} from "./litixCartCheckout.mjs";
