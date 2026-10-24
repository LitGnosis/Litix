// Draft validation only. No provider requests, billing, or persistence.
export const blockers = [
 'Verified subscription service IDs, limits, and pricing',
 'Verified account ownership and authenticated customer session',
 'Payment settlement bound to an immutable USD quote',
 'Durable per-leg dispatch claims and reconciliation after unknown outcomes',
 'Supplier status and cancellation support'
];
export function validateDraft(input) {
 if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('Invalid draft.');
 const username = typeof input.username === 'string' ? input.username.trim().replace(/^@/, '') : '';
 if (!/^[A-Za-z0-9_][A-Za-z0-9_.]{0,29}$/.test(username)) throw Error('Enter a username, not a profile URL (up to 30 letters, digits, dots or underscores).');
 if (!['Instagram', 'TikTok'].includes(input.platform)) throw Error('Choose Instagram or TikTok.');
 // Reject coercion, fractions, non-finite values and excessive requests.
 const { minLikes, maxLikes, posts } = input;
 if (![minLikes, maxLikes, posts].every(Number.isSafeInteger) || minLikes < 1 || maxLikes < minLikes || maxLikes > 100000 || posts < 1 || posts > 100) throw Error('Use whole numbers: likes 1–100,000, maximum at least minimum, and 1–100 future posts.');
 return { platform: input.platform, username, posts,
  likes: { min: minLikes, max: maxLikes, state: 'not_submitted', supplierId: null },
  views: { min: minLikes * 3, max: maxLikes * 3, state: 'not_submitted', supplierId: null },
  ratio: '3:1', currency: 'USD', amountCents: null,
  state: 'draft_only', canPurchase: false,
  blockers: [...blockers] };
}
