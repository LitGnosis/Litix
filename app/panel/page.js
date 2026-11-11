import PanelClient from './PanelClient';
export const metadata={title:'Litix Pro | Orders, API & Automation',description:'Litix Pro dashboard for wallet orders, bulk orders, drip feed, refills and reseller API.'};
export default function PanelPage(){return <main className="shell"><div className="topbar"><a className="brand" href="/"><span className="brandMark">L</span><span>LITIX</span></a><nav className="nav"><a href="/">Quick order</a><a href="/track">Track</a><a href="/account">Account</a></nav></div><PanelClient/></main>}
