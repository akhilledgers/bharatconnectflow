/**
 * Every mocked BharatConnect/LEDGERS endpoint this prototype pretends to call.
 * See README.md for the full endpoint-to-UI-state map.
 */

export function delay<T>(value: T, minMs = 400, maxMs = 800): Promise<T> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

export async function mockLookupConnectionStatus(): Promise<void> {
  // POST /api/bharatconnect/lookup { pan, gstin } — resolved by the store,
  // this call only stands in for the network round trip.
  await delay(undefined, 300, 600);
}

export async function mockVerifyOwnershipOtp(code: string): Promise<{ ok: boolean }> {
  // POST /api/bharatconnect/ownership/verify { code }
  await delay(undefined);
  return { ok: code.length === 6 };
}

export async function mockLinkExistingId(): Promise<{ ok: boolean }> {
  // POST /api/bharatconnect/ids/link
  await delay(undefined);
  return { ok: true };
}

export async function mockCheckEndingAvailability(ending: string): Promise<{ available: boolean }> {
  // GET /api/bharatconnect/ids/check?ending=
  await delay(undefined, 250, 500);
  return { available: !["USED", "TEST"].includes(ending.toUpperCase()) };
}

export async function mockSaveDraft<T>(payload: T): Promise<T> {
  // PATCH /api/bharatconnect/profile/draft
  return delay(payload, 250, 500);
}

export async function mockOtpSend(): Promise<{ ok: boolean }> {
  // POST /api/contacts/otp/send
  await delay(undefined, 300, 600);
  return { ok: true };
}

export async function mockOtpVerify(code: string): Promise<{ ok: boolean }> {
  // POST /api/contacts/otp/verify
  await delay(undefined, 300, 600);
  return { ok: code === "123456" || code.length === 6 };
}

export async function mockSearchCounterparties(_query: string): Promise<void> {
  // GET /api/bharatconnect/counterparties/search?q=
  await delay(undefined, 300, 700);
}
