import CheckoutConfirmation from '../CheckoutConfirmation';
export default async function Track({searchParams}){const p=await searchParams;return <main className="shell"><section className="page"><CheckoutConfirmation initialSession={String(p?.session_id||'')} initialOrderId={String(p?.order_id||'')} initialToken={String(p?.token||'')}/></section></main>}
