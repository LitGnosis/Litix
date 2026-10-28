// Owner-provided, fixed-amount Bluevine payment links. Never infer an amount from a query string.
export const BLUEVINE_BUNDLE_LINKS=Object.freeze({
 launch:"https://pay.bluevine.com/p/ecd2c080f8a74e33ac834ed0e9eedc92",
 momentum:"https://pay.bluevine.com/p/23d4ce5549c846b6b50dd4ce233b7723",
 power:"https://pay.bluevine.com/p/5583a248578d48649bb5151c76eb7d4d",
 apex:"https://pay.bluevine.com/p/ae9473e7c1d44aa6bbed123843d945c5"
});
export const bluevineBundleLink=pkg=>pkg&&BLUEVINE_BUNDLE_LINKS[pkg.tier.toLowerCase()]||null;
