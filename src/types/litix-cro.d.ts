export type LitixSocialPlatform = "instagram" | "tiktok";
export type LitixQualityTier = "standard" | "vip";
export type LitixServiceKind = "followers" | "likes" | "views" | "comments";
export type LitixPaymentStatus = "paid" | "pending" | "failed" | "refunded";
export type LitixDeliveryState = "PENDING_PAYMENT" | "QUEUED" | "DISPATCHING" |
  "SUBMITTED" | "COMPLETED" | "REJECTED" | "UNKNOWN_OUTCOME" |
  "FAILED" | "MANUAL_REVIEW";
export interface LitixPublicPost {
  id: string;
  url: string;
  thumbnail: string;
  kind: string;
  caption: string;
}
export interface LitixPublicProfile {
  username: string;
  avatarUrl: string | null;
  followersCount: number | null;
  likesCount: number | null;
}
export interface LitixProfilePreviewResponse {
  platform: LitixSocialPlatform;
  username: string;
  profile: LitixPublicProfile;
  posts: LitixPublicPost[];
}
export interface LitixOrderTracking {
  id: string;
  service: string;
  quantity: number;
  amount: string;
  payment: LitixPaymentStatus | string;
  fulfillment: LitixDeliveryState | string;
  status: string | null;
  remains: number | null;
  startCount: number | null;
  delivered: number | null;
  refillEligible: boolean;
  liveSupplierStatus: boolean;
  checkedAt: string | null;
}
export interface LitixCuratedQuote {
  serviceId: string;
  quantity: number;
  totalCents: number;
  volumeDiscountPercent: number;
  ready: boolean;
  currency: "USD";
}
export interface LitixWalletHandlers {
  apple?: () => void;
  google?: () => void;
}
