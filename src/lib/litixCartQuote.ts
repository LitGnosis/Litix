export type CartLineKind="followers"|"likes"|"views";
export type CartLineQuote={
 serviceId:string;
 quantity:number;
 mainAmountCents:number;
 totalCents:number;
 bump:null|{
  kind:CartLineKind;
  quantity:number;
  amountCents:number;
  targetRequired:boolean;
 };
};
export type CartQuoteInput={
 serviceId:string;
 quantity:number;
 includeBump?:boolean;
 mainTarget?:string;
 bumpTarget?:string;
};
export {quoteCuratedCart,publicCartQuote,safeCartDestination} from "./litixCartQuote.mjs";
