/**
 * Shared types for the Cloudflare Worker sync backend.
 */

export interface Env {
  SYNC_BUCKET: R2Bucket;
  PAIR_KV: KVNamespace;
  ASSETS: Fetcher;
}

export interface PairCreateRequest {
  otp: string;
  wrappedSecret: string;
  iv: string;
  salt: string;
  nonce: string;
}

export interface PairClaimRequest {
  otp: string;
}

export interface PairClaimResponse {
  wrappedSecret: string;
  iv: string;
  salt: string;
  nonce: string;
}

export interface PairCreateResponse {
  expiresAt: number;
}
