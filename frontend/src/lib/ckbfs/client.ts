import { ccc } from '@ckb-ccc/ccc';

// Ordered list of CKB Testnet RPC endpoints — tried in sequence on failure.
export const RPC_URLS = [
  'https://testnet.ckb.dev/rpc',
  'https://testnet.ckbapp.dev/rpc',
];

// Default client using the primary RPC.
export const client = new ccc.ClientPublicTestnet({
  url: RPC_URLS[0],
});

// Factory: create a fresh client pointed at a specific URL.
export function createClientWithUrl(url: string): ccc.ClientPublicTestnet {
  return new ccc.ClientPublicTestnet({ url });
}

