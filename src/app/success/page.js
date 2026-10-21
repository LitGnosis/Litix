import CheckoutConfirmation from '../CheckoutConfirmation';
export default async function Success({searchParams}){const p=await searchParams;return <main className="shell"><section className="page"><CheckoutConfirmation allowManualTracking={false} initialSession={String(p?.session_id||'')} initialOrderId={String(p?.order_id||'')} initialToken={String(p?.token||'')}/></section></main>}
