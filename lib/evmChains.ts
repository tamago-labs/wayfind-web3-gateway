import { defineChain } from 'viem';

// Mezo network details: https://mezo.org/docs/developers/getting-started/
// Testnet id 31611, mainnet id 31612. Native gas is BTC (18 decimals) on both.
// To add another EVM chain in the future: append one defineChain entry here
// with scope + explorer, then add it to SUPPORTED_EVM_CHAINS. Nothing else changes.

export const mezoTestnet = defineChain({
  id: 31611,
  name: 'Mezo Testnet',
  network: 'mezo-testnet',
  nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
  rpcUrls: {
    default: {
      http: ['https://rpc.test.mezo.org'],
      webSocket: ['wss://rpc-ws.test.mezo.org'],
    },
  },
  blockExplorers: {
    default: { name: 'Mezo Test Explorer', url: 'https://explorer.test.mezo.org' },
  },
  testnet: true,
});

export const mezoMainnet = defineChain({
  id: 31612,
  name: 'Mezo Mainnet',
  network: 'mezo-mainnet',
  nativeCurrency: { decimals: 18, name: 'Bitcoin', symbol: 'BTC' },
  rpcUrls: {
    default: {
      // Primary first; Privy/viem fall through on failure.
      http: [
        'https://mezo-mainnet.boar.network',
        'https://rpc_evm-mezo.imperator.co',
        'https://mainnet.mezo.public.validationcloud.io',
        'https://mezo.drpc.org',
      ],
      webSocket: [
        'wss://mezo-mainnet.boar.network',
        'wss://ws_evm-mezo.imperator.co',
        'wss://mainnet.mezo.public.validationcloud.io',
        'wss://mezo.drpc.org',
      ],
    },
  },
  blockExplorers: {
    default: { name: 'Mezo Explorer', url: 'https://explorer.mezo.org' },
  },
});

export type NetScope = 'mainnet' | 'testnet';

// All EVM chains the app may use. Order = preference for defaultChain.
export const SUPPORTED_EVM_CHAINS = [mezoTestnet, mezoMainnet] as const;

export function getEvmChainForScope(scope: NetScope) {
  return scope === 'mainnet' ? mezoMainnet : mezoTestnet;
}

export function explorerAddressUrl(
  chain: { blockExplorers?: { default?: { url?: string } } },
  address: string,
) {
  const base = chain.blockExplorers?.default?.url ?? '';
  return base ? `${base.replace(/\/$/, '')}/address/${address}` : '';
}
