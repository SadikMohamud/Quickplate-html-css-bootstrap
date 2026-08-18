// ================================================================
// v2 STUB: Apple Wallet and Google Wallet passes
//
// Not implemented in v1. Nothing imports this module yet.
//
// v2 plan:
// - Apple: generate a signed .pkpass (PassKit) from the card state,
//   served from a route handler. Requires an Apple Pass Type ID
//   certificate stored in env vars.
// - Google: create a loyalty class and object via the Google Wallet
//   API, then issue a "Save to Google Wallet" JWT link.
// - Push updates to passes when a stamp event lands, via a database
//   webhook on stamp_events.
// ================================================================

export interface WalletPassPayload {
  customerId: string;
  displayName: string | null;
  stampsOnCard: number;
  stampsRequired: number;
  rewardDescription: string;
}

export async function generateApplePass(
  _payload: WalletPassPayload
): Promise<Buffer> {
  throw new Error("Apple Wallet passes are planned for v2");
}

export async function generateGoogleWalletLink(
  _payload: WalletPassPayload
): Promise<string> {
  throw new Error("Google Wallet passes are planned for v2");
}
