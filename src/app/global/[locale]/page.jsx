import Link from "next/link";
import {notFound} from "next/navigation";
import {GLOBAL_CODES,GLOBAL_LOCALES,GLOBAL_LANG_ALTERNATES,getGlobalLocale,isRTLGlobalLocale} from "../../../lib/globalLocales.mjs";
import "../global.css";

export const dynamicParams=false;
export function generateStaticParams(){return GLOBAL_CODES.map(locale=>({locale}));}
export async function generateMetadata({params}){
  const {locale}=await params;
  const t=getGlobalLocale(locale);
  if(!t)notFound();
  return {
    title:t.metaTitle,description:t.metaDescription,
    alternates:{canonical:"/global/"+locale,languages:GLOBAL_LANG_ALTERNATES},
    openGraph:{
      title:t.metaTitle,description:t.metaDescription,
      url:"https://litix.net/global/"+locale,
      locale:{en:"en_US",es:"es_ES",pt:"pt_BR",fr:"fr_FR",de:"de_DE",ar:"ar_SA"}[locale],
      siteName:"Litix",type:"website"
    },
    robots:{index:true,follow:true},
  };
}
export default async function GlobalLanding({params}){
  const {locale}=await params;
  const t=getGlobalLocale(locale);
  if(!t)notFound();
  const rtl=isRTLGlobalLocale(locale);
  const cards=[
    {heading:t.servicesTitle,copy:t.services,href:"/#services",cta:t.start,number:"01"},
    {heading:t.toolsTitle,copy:t.tools,href:"/#growth-studio",cta:t.planning,number:"02"},
    {heading:t.trackTitle,copy:t.track,href:"/track",cta:t.tracking,number:"03"},
  ];
  return <main className="lxglobal" lang={locale} dir={rtl?"rtl":"ltr"}>
    <div className="lxglobal-container">
      <header className="lxglobal-header">
        <Link href="/" className="lxglobal-brand" aria-label="Litix home">
          <img src="/assets/brand/litix-logo.webp" width="146" height="46" alt="Litix"/>
        </Link>
        <nav aria-label={t.language} className="lxglobal-languages">
          {GLOBAL_CODES.map(code=><Link key={code} href={"/global/"+code}
            lang={code} dir={isRTLGlobalLocale(code)?"rtl":"ltr"}
            aria-current={code===locale?"page":undefined}>{GLOBAL_LOCALES[code].name}</Link>)}
        </nav>
      </header>
      <section className="lxglobal-hero" aria-labelledby="lxglobal-title">
        <p className="lxglobal-kicker">{t.eyebrow}</p>
        <h1 id="lxglobal-title">{t.title}</h1>
        <p className="lxglobal-intro">{t.intro}</p>
        <div className="lxglobal-actions">
          <Link className="lxglobal-primary" href="/#services">{t.start}</Link>
          <Link className="lxglobal-secondary" href="/#growth-studio">{t.planning}</Link>
        </div>
        <ul className="lxglobal-badges">
          <li>{t.badge1}</li><li>{t.badge2}</li><li>{t.badge3}</li>
        </ul>
      </section>
      <section className="lxglobal-cards" aria-label={t.servicesTitle}>
        {cards.map(card=><article key={card.number} className="lxglobal-card">
          <span className="lxglobal-number" aria-hidden="true">{card.number}</span>
          <h2>{card.heading}</h2><p>{card.copy}</p>
          <Link href={card.href}>{card.cta}<span aria-hidden="true"> →</span></Link>
        </article>)}
      </section>
      <section className="lxglobal-trust" aria-labelledby="lxglobal-trust-title">
        <h2 id="lxglobal-trust-title">{t.trustTitle}</h2>
        <p>{t.trustCopy}</p>
        <p>{t.paymentNote}</p>
        <p className="lxglobal-disclaimer">{t.translationNote}</p>
        <div className="lxglobal-policies">
          <Link href="/terms" hrefLang="en">{t.policy}: Terms</Link>
          <Link href="/refunds" hrefLang="en">Refunds</Link>
          <Link href="/privacy" hrefLang="en">Privacy</Link>
        </div>
      </section>
      <section className="lxglobal-support" aria-labelledby="lxglobal-support-title">
        <div><h2 id="lxglobal-support-title">{t.support}</h2><p>{t.supportCopy}</p></div>
        <a href="mailto:litixsocial@gmail.com">litixsocial@gmail.com</a>
      </section>
      <footer className="lxglobal-footer">
        <span>© Litix · Global</span>
        <Link href="/">{t.home}</Link>
      </footer>
    </div>
  </main>;
}
