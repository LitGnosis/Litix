import {NextResponse} from 'next/server';
import {paymentGatewaySummary} from '../../../../lib/paymentGateway';
import {checkPaymentReadiness} from '../../../../lib/checkoutReadiness';
export const dynamic='force-dynamic';
export async function GET(){
  const status=await checkPaymentReadiness(paymentGatewaySummary());
  return NextResponse.json(status,{headers:{'Cache-Control':'no-store'}});
}
