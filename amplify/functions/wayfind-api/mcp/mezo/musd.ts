// MUSD read layer — viem only, no ethers. Reads run against the Mezo RPC;
// writes (below) build calldata with viem and send via evmSendTransaction in
// lib/evm.ts on the user's embedded wallet. Contract addresses verified
// against mezo-org/musd deployments (matsnet chain 31611, mainnet 31612).
import { createPublicClient, encodeFunctionData, formatUnits, http, parseAbi } from "viem";
import { evmSendTransaction, findMezoBySymbol, mezoChainId, mezoRpcUrl, type MezoNetwork, type MezoTokenMeta } from "../lib/evm";

const TESTNET_CONTRACTS = {
  borrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  troveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  musdToken: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
  stabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  sortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  hintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  interestRateManager: "0xD4D6c36A592A2c5e86035A6bca1d57747a567f37",
  activePool: "0x143A063F62340DA3A8bEA1C5642d18C6D0F7FF51",
  priceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
} as const;

const MAINNET_CONTRACTS = {
  borrowerOperations: "0x44b1bac67dDA612a41a58AAf779143B181dEe031",
  troveManager: "0x94AfB503dBca74aC3E4929BACEeDfCe19B93c193",
  musdToken: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
  stabilityPool: "0x73245Eff485aB3AAc1158B3c4d8f4b23797B0e32",
  sortedTroves: "0x8C5DB4C62BF29c1C4564390d10c20a47E0b2749f",
  hintHelpers: "0xD267b3bE2514375A075fd03C3D9CBa6b95317DC3",
  interestRateManager: "0x4a453700d157717Fe02fB62E7700ED7845048285",
  activePool: "0x3012C2fE1240e3754E5C200A0946bb0E07474876",
  priceFeed: "0xc5aC5A8892230E0A3e1c473881A2de7353fFcA88",
} as const;

function musdContracts(network: MezoNetwork) {
  return network === "mainnet" ? MAINNET_CONTRACTS : TESTNET_CONTRACTS;
}

const PRICE_FEED_ABI = parseAbi(["function fetchPrice() view returns (uint256)"]);

const TROVE_MANAGER_ABI = parseAbi([
  "function getTCR(uint256 _price) view returns (uint256)",
  "function getTroveStatus(address _borrower) view returns (uint256)",
  "function getTroveColl(address _borrower) view returns (uint256)",
  "function getTroveDebt(address _borrower) view returns (uint256)",
  "function getTrovePrincipal(address _borrower) view returns (uint256)",
  "function getTroveInterestOwed(address _borrower) view returns (uint256)",
  "function getPendingDebt(address _borrower) view returns (uint256)",
  "function getPendingCollateral(address _borrower) view returns (uint256)",
  "function getCurrentICR(address _borrower, uint256 _price) view returns (uint256)",
  "function getNominalICR(address _borrower) view returns (uint256)",
  "function getTroveStake(address _borrower) view returns (uint256)",
  "function getTroveOwnersCount() view returns (uint256)",
  "function getEntireSystemColl() view returns (uint256)",
  "function getEntireSystemDebt() view returns (uint256)",
  "function CCR() view returns (uint256)",
  "function MCR() view returns (uint256)",
  "function getTroveMaxBorrowingCapacity(address _borrower) view returns (uint256)",
]);

const BORROWER_OPS_ABI = parseAbi([
  "function getBorrowingFee(uint256 _MUSDAmount) view returns (uint256)",
  "function redemptionRate() view returns (uint256)",
  "function MUSD_GAS_COMPENSATION() view returns (uint256)",
]);

const INTEREST_RATE_ABI = parseAbi([
  "function interestRate() view returns (uint256)",
  "function MAX_INTEREST_RATE() view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const SORTED_TROVES_ABI = parseAbi([
  "function findInsertPosition(uint256 _NICR, address _prevId, address _nextId) view returns (address, address)",
]);

const HINT_HELPERS_ABI = parseAbi([
  "function getApproxHint(uint256 _NICR, uint256 _numTrials, uint256 _randomSeed) view returns (address hintAddress, uint256 diff, uint256 latestRandomSeed)",
  "function getRedemptionHints(uint256 _MUSDAmount, uint256 _price, uint256 _maxIterations) view returns (address firstRedeemHint, uint256 partialRedemptionHintNICR, uint256 MUSDLot)",
]);

const REDEEM_ABI = parseAbi([
  "function redeemCollateral(uint256 _MUSDAmount, address _firstRedeemHint, address _upperPartialRedemptionHint, address _lowerPartialRedemptionHint, uint256 _partialRedemptionHintNICR, uint256 _maxIterations)",
]);

const WRITE_ABI = parseAbi([
  // Verified against mezo-org/musd deployments/matsnet/BorrowerOperations.json:
  // openTrove takes the NET borrow amount; the contract adds the borrowing fee
  // + 200 MUSD gas compensation itself. (A 4-arg maxFee variant does not exist
  // on-chain — calling it reverts on the selector.)
  "function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) payable",
  "function addColl(address _upperHint, address _lowerHint) payable",
  "function withdrawColl(uint256 _collWithdrawal, address _upperHint, address _lowerHint)",
  "function repayMUSD(uint256 _MUSDamount, address _upperHint, address _lowerHint)",
  "function closeTrove()",
]);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const STABILITY_POOL_ABI = parseAbi([
  "function getCompoundedMUSDDeposit(address _depositor) view returns (uint256)",
  "function getDepositorCollateralGain(address _depositor) view returns (uint256)",
  "function getTotalMUSDDeposits() view returns (uint256)",
  "function getCollateralBalance() view returns (uint256)",
  "function P() view returns (uint256)",
  "function provideToSP(uint256 _amount)",
  "function withdrawFromSP(uint256 _amount)",
]);

// Aerodrome-style pool router (NOT the UniversalRouter — plain
// swapExactTokensForTokens, verified live on testnet).
const SWAP_ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint256 amountIn, (address,address,bool,address)[] routes) view returns (uint256[] memory amounts)",
  "function swapExactTokensForTokens(uint256 amountIn, uint256 amountOutMin, (address,address,bool,address)[] routes, address to, uint256 deadline) returns (uint256[] memory amounts)",
]);

const BTC_TOKEN = "0x7b7C000000000000000000000000000000000000" as const;

function swapRouter(network: MezoNetwork): { router: Address; factory: Address } {
  return network === "mainnet"
    ? {
        router: "0x16A76d3cd3C1e3CE843C6680d6B37E9116b5C706",
        factory: "0x83FE469C636C4081b87bA5b3Ae9991c6Ed104248",
      }
    : {
        router: "0x9a1ff7FE3a0F69959A3fBa1F1e5ee18e1A9CD7E9",
        factory: "0x4947243CC818b627A5D06d14C4eCe7398A23Ce1A",
      };
}

export interface SwapRoute {
  from: Address;
  to: Address;
  stable: boolean;
  factory: Address;
}

/**
 * Single-hop routes only (MUSD is the hub). fromToken must be an ERC-20
 * (MUSD/mUSDC/mUSDT) — native BTC has no approve path. BTC works as output.
 */
export function buildSwapRoute(
  fromSymbol: string,
  toSymbol: string,
  network: MezoNetwork,
): { route: SwapRoute; from: MezoTokenMeta; to: MezoTokenMeta } {
  const { factory } = swapRouter(network);
  const from = findMezoBySymbol(fromSymbol, network);
  const to = findMezoBySymbol(toSymbol, network);
  if (!from || !to) throw new Error(`Unknown token pair '${fromSymbol}' → '${toSymbol}' on Mezo ${network}.`);
  if (from.address === "native") {
    throw new Error("BTC cannot be a swap input yet (no approve path for native gas) — swap from MUSD, mUSDC, or mUSDT. No transaction sent.");
  }
  const fromAddr = (from.address === "native" ? BTC_TOKEN : from.address) as Address;
  const toAddr = (to.address === "native" ? BTC_TOKEN : to.address) as Address;
  const hub = network === "mainnet" ? "MUSD" : "MUSD";
  const involvesHub = from.symbol === hub || to.symbol === hub;
  if (!involvesHub) {
    throw new Error(`No direct pool for '${fromSymbol}' → '${toSymbol}' — only MUSD-hub pairs exist (MUSD/BTC, MUSD/mUSDC, MUSD/mUSDT). No transaction sent.`);
  }
  const stable = !(
    (from.symbol === "MUSD" && to.symbol === "BTC") ||
    (from.symbol === "BTC" && to.symbol === "MUSD")
  );
  return { route: { from: fromAddr, to: toAddr, stable, factory }, from, to };
}

export interface SwapQuote {
  fromSymbol: string;
  toSymbol: string;
  amountIn: string;
  amountOut: string;
  stable: boolean;
  router: string;
}

export async function quoteSwap(
  fromSymbol: string,
  toSymbol: string,
  amountWei: bigint,
  network: MezoNetwork,
): Promise<SwapQuote> {
  const c = client(network);
  const { router } = swapRouter(network);
  const { route, from, to } = buildSwapRoute(fromSymbol, toSymbol, network);
  const amounts = (await c.readContract({
    address: router,
    abi: SWAP_ROUTER_ABI,
    functionName: "getAmountsOut",
    args: [amountWei, [[route.from, route.to, route.stable, route.factory]]],
  })) as unknown as bigint[];
  return {
    fromSymbol: from.symbol,
    toSymbol: to.symbol,
    amountIn: formatUnits(amountWei, from.decimals),
    amountOut: formatUnits(amounts[1] ?? 0n, to.decimals),
    stable: route.stable,
    router,
  };
}

export async function executeSwap(
  evmWalletId: string,
  owner: string,
  fromSymbol: string,
  toSymbol: string,
  amountWei: bigint,
  minOutWei: bigint,
  network: MezoNetwork,
): Promise<string> {
  const { router } = swapRouter(network);
  const { route } = buildSwapRoute(fromSymbol, toSymbol, network);
  await ensureTokenApproval(evmWalletId, owner, route.from, router, amountWei, network);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const data = encodeFunctionData({
    abi: SWAP_ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [amountWei, minOutWei, [[route.from, route.to, route.stable, route.factory]], owner as Address, deadline],
  });
  return evmSendTransaction(evmWalletId, network, { to: router, data });
}

const LIQUIDATION_DEPOSIT_WEI = 200000000000000000000n;

function client(network: MezoNetwork) {
  const chainId = mezoChainId(network);
  return createPublicClient({
    chain: {
      id: chainId,
      name: network === "mainnet" ? "Mezo Mainnet" : "Mezo Testnet",
      nativeCurrency: { decimals: 18, name: "Bitcoin", symbol: "BTC" },
      rpcUrls: { default: { http: [mezoRpcUrl(network)] } },
    },
    transport: http(),
  });
}

type Address = `0x${string}`;

async function fetchPrice(c: ReturnType<typeof client>, C: ReturnType<typeof musdContracts>): Promise<bigint> {
  return c.readContract({
    address: C.priceFeed as Address,
    abi: PRICE_FEED_ABI,
    functionName: "fetchPrice",
  }) as Promise<bigint>;
}

export interface TroveStatus {
  borrower: string;
  status: "closed" | "open" | "liquidated" | "none";
  collateralBTC: string;
  totalDebtMUSD: string;
  netDebtMUSD: string;
  principalMUSD: string;
  interestOwedMUSD: string;
  pendingDebtMUSD: string;
  pendingCollateralBTC: string;
  icr: string;
  nominalICR: string;
  interestRate: string;
  btcPriceUSD: string;
}

export async function fetchTroveStatus(borrower: string, network: MezoNetwork): Promise<TroveStatus> {
  const c = client(network);
  const C = musdContracts(network);
  const who = borrower as Address;
  const price = await fetchPrice(c, C);
  const tm = C.troveManager as Address;
  const [
    status,
    coll,
    debt,
    principal,
    interestOwed,
    pendingDebt,
    pendingColl,
    nominalICR,
    currentICR,
    apr,
  ] = await Promise.all([
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveStatus", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveColl", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveDebt", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTrovePrincipal", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveInterestOwed", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getPendingDebt", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getPendingCollateral", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getNominalICR", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getCurrentICR", args: [who, price] }),
    c.readContract({ address: C.interestRateManager as Address, abi: INTEREST_RATE_ABI, functionName: "interestRate" }),
  ]);
  const s = Number(status);
  // Closed/empty troves report max-uint ICR from the contract — show N/A.
  const hasTrove = coll > 0n && debt > 0n;
  return {
    borrower,
    status: s === 0 ? "closed" : s === 1 ? "open" : s === 2 ? "liquidated" : "none",
    collateralBTC: formatUnits(coll, 18),
    totalDebtMUSD: formatUnits(debt, 18),
    netDebtMUSD: formatUnits(debt > LIQUIDATION_DEPOSIT_WEI ? debt - LIQUIDATION_DEPOSIT_WEI : 0n, 18),
    principalMUSD: formatUnits(principal, 18),
    interestOwedMUSD: formatUnits(interestOwed, 18),
    pendingDebtMUSD: formatUnits(pendingDebt, 18),
    pendingCollateralBTC: formatUnits(pendingColl, 18),
    icr: hasTrove ? `${(Number(currentICR) / 1e18).toFixed(2)}%` : "N/A",
    nominalICR: hasTrove && nominalICR > 0n ? `${((Number(nominalICR) / 1e20) * 100).toFixed(2)}%` : "N/A",
    interestRate: `${(Number(apr) / 100).toFixed(2)}%`,
    btcPriceUSD: formatUnits(price, 18),
  };
}

export async function fetchBorrowingFee(musdAmountWei: bigint, network: MezoNetwork) {
  const c = client(network);
  const C = musdContracts(network);
  const fee = await c.readContract({
    address: C.borrowerOperations as Address,
    abi: BORROWER_OPS_ABI,
    functionName: "getBorrowingFee",
    args: [musdAmountWei],
  });
  const pct = musdAmountWei > 0n ? ((Number(fee) * 100) / Number(musdAmountWei)).toFixed(2) : "0";
  return {
    amountMUSD: formatUnits(musdAmountWei, 18),
    feeMUSD: formatUnits(fee, 18),
    feePercent: `${pct}%`,
  };
}

export async function fetchSystemOverview(network: MezoNetwork) {
  const c = client(network);
  const C = musdContracts(network);
  const tm = C.troveManager as Address;
  const price = await fetchPrice(c, C);
  const [tcr, systemColl, systemDebt, totalTroves] = await Promise.all([
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTCR", args: [price] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getEntireSystemColl" }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getEntireSystemDebt" }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveOwnersCount" }),
  ]);
  return {
    tcr: tcr > 0n ? `${((Number(tcr) / 1e18) * 100).toFixed(2)}%` : "N/A",
    systemCollateralBTC: formatUnits(systemColl, 18),
    systemDebtMUSD: formatUnits(systemDebt, 18),
    totalTroves: Number(totalTroves),
    recoveryMode: tcr < 1_500_000_000_000_000_000n,
    btcPriceUSD: formatUnits(price, 18),
  };
}

export async function fetchInterestRate(network: MezoNetwork) {
  const c = client(network);
  const C = musdContracts(network);
  const irm = C.interestRateManager as Address;
  const [rate, maxRate] = await Promise.all([
    c.readContract({ address: irm, abi: INTEREST_RATE_ABI, functionName: "interestRate" }),
    c.readContract({ address: irm, abi: INTEREST_RATE_ABI, functionName: "MAX_INTEREST_RATE" }),
  ]);
  return {
    interestRate: `${(Number(rate) / 100).toFixed(2)}%`,
    maxInterestRate: `${(Number(maxRate) / 100).toFixed(2)}%`,
  };
}

export async function fetchProtocolConstants(network: MezoNetwork) {
  const c = client(network);
  const C = musdContracts(network);
  const tm = C.troveManager as Address;
  const [ccr, mcr, redemptionRate, borrowApr] = await Promise.all([
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "CCR" }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "MCR" }),
    c.readContract({ address: C.borrowerOperations as Address, abi: BORROWER_OPS_ABI, functionName: "redemptionRate" }),
    c.readContract({ address: C.interestRateManager as Address, abi: INTEREST_RATE_ABI, functionName: "interestRate" }),
  ]);
  return {
    ccr: `${((Number(ccr) / 1e18) * 100).toFixed(2)}%`,
    mcr: `${((Number(mcr) / 1e18) * 100).toFixed(2)}%`,
    redemptionFeePercent: `${((Number(redemptionRate) / 1e18) * 100).toFixed(2)}%`,
    borrowingInterestRate: `${(Number(borrowApr) / 100).toFixed(2)}%`,
  };
}

export async function fetchMaxBorrowingCapacity(borrower: string, network: MezoNetwork) {
  const c = client(network);
  const C = musdContracts(network);
  const capacity = await c.readContract({
    address: C.troveManager as Address,
    abi: TROVE_MANAGER_ABI,
    functionName: "getTroveMaxBorrowingCapacity",
    args: [borrower as Address],
  });
  return {
    borrower,
    maxNetDebtMUSD: formatUnits(capacity, 18),
    maxTotalDebtMUSD: formatUnits(capacity + LIQUIDATION_DEPOSIT_WEI, 18),
    liquidationDepositMUSD: "200",
  };
}

// ---------------------------------------------------------------------------
// Write layer. Every write is a Privy eth_sendTransaction from the user's
// embedded EVM wallet under the ethereum policy — the Lambda never sees keys.
// Calldata is built with viem; value/approve sequencing mirrors the MUSD dApp.
// ---------------------------------------------------------------------------

async function getHints(
  c: ReturnType<typeof client>,
  C: ReturnType<typeof musdContracts>,
  nicr: bigint,
): Promise<{ upperHint: Address; lowerHint: Address }> {
  if (nicr > 0n) {
    const seed = BigInt(Math.floor(Math.random() * 1_000_000));
    const [approxHint] = (await c.readContract({
      address: C.hintHelpers as Address,
      abi: HINT_HELPERS_ABI,
      functionName: "getApproxHint",
      args: [nicr, 15n, seed],
    })) as unknown as [Address, bigint, bigint];
    const [upper, lower] = (await c.readContract({
      address: C.sortedTroves as Address,
      abi: SORTED_TROVES_ABI,
      functionName: "findInsertPosition",
      args: [nicr, approxHint, approxHint],
    })) as unknown as [Address, Address];
    return { upperHint: upper, lowerHint: lower };
  }
  return { upperHint: ZERO_ADDRESS, lowerHint: ZERO_ADDRESS };
}

/** Poll for a receipt. Returns true if confirmed successful, false if failed. Throws on timeout. */
export async function waitForConfirmation(
  network: MezoNetwork,
  hash: string,
  timeoutMs = 120_000,
): Promise<boolean> {
  const c = client(network);
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const receipt = await c.getTransactionReceipt({ hash: hash as `0x${string}` }).catch(() => null);
    if (receipt) return receipt.status === "success";
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${hash} confirmation`);
    await new Promise((r) => setTimeout(r, 3000));
  }
}

/** Approve any ERC-20 spender if allowance is short. Returns approve hash or null. */
export async function ensureTokenApproval(
  evmWalletId: string,
  owner: string,
  token: string,
  spender: string,
  amountWei: bigint,
  network: MezoNetwork,
): Promise<string | null> {
  const c = client(network);
  const allowed = await c.readContract({
    address: token as Address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner as Address, spender as Address],
  });
  if (allowed >= amountWei) return null;
  const data = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [spender as Address, amountWei],
  });
  const hash = await evmSendTransaction(evmWalletId, network, { to: token, data });
  const ok = await waitForConfirmation(network, hash);
  if (!ok) throw new Error(`Approve reverted: ${hash}`);
  return hash;
}

export interface OpenTroveResult {
  txHash: string;
  collateralBTC: string;
  musdBorrowed: string;
  borrowingFeeMUSD: string;
  feePercent: string;
  liquidationDepositMUSD: string;
  totalDebtMUSD: string;
}

/**
 * Open a trove. Borrows the RAW musdWei — the contract adds the borrowing fee
 * and the 200 MUSD gas compensation itself (the old code pre-added the fee,
 * so users paid it twice). Requires min 1800 MUSD and ICR >= MCR.
 */
export async function executeOpenTrove(
  evmWalletId: string,
  owner: string,
  musdWei: bigint,
  collateralWei: bigint,
  maxFeePercent: number,
  network: MezoNetwork,
): Promise<OpenTroveResult> {
  const C = musdContracts(network);
  const c = client(network);
  const MIN_DEBT = 1_800_000_000_000_000_000_000n;
  if (musdWei < MIN_DEBT) throw new Error("Minimum borrow is 1800 MUSD.");
  const fee = (await c.readContract({
    address: C.borrowerOperations as Address,
    abi: BORROWER_OPS_ABI,
    functionName: "getBorrowingFee",
    args: [musdWei],
  })) as bigint;
  const feePct = musdWei > 0n ? (Number(fee) * 100) / Number(musdWei) : 0;
  if (feePct > maxFeePercent) {
    throw new Error(`Borrowing fee ${feePct.toFixed(2)}% exceeds max ${maxFeePercent}%. Aborted — no transaction sent.`);
  }
  const totalDebt = musdWei + fee + LIQUIDATION_DEPOSIT_WEI;
  const price = await fetchPrice(c, C);
  const mcr = (await c.readContract({
    address: C.troveManager as Address,
    abi: TROVE_MANAGER_ABI,
    functionName: "MCR",
  })) as bigint;
  // ICR = coll * price / totalDebt, 1e18-based.
  if ((collateralWei * price) / totalDebt < mcr) {
    throw new Error("Collateral too low — ICR would be under 110%. Add more BTC or borrow less. No transaction sent.");
  }
  const nicr = (collateralWei * 10n ** 20n) / totalDebt;
  const { upperHint, lowerHint } = await getHints(c, C, nicr);
  // No on-chain fee cap param exists — maxFeePercent is enforced off-chain
  // above (abort before sending). The raw musdWei is the net borrow.
  const data = encodeFunctionData({
    abi: WRITE_ABI,
    functionName: "openTrove",
    args: [musdWei, upperHint, lowerHint],
  });
  const txHash = await evmSendTransaction(evmWalletId, network, {
    to: C.borrowerOperations,
    valueWei: collateralWei,
    data,
  });
  return {
    txHash,
    collateralBTC: formatUnits(collateralWei, 18),
    musdBorrowed: formatUnits(musdWei, 18),
    borrowingFeeMUSD: formatUnits(fee, 18),
    feePercent: `${feePct.toFixed(2)}%`,
    liquidationDepositMUSD: "200",
    totalDebtMUSD: formatUnits(totalDebt, 18),
  };
}

export async function executeAddCollateral(
  evmWalletId: string,
  collateralWei: bigint,
  network: MezoNetwork,
): Promise<string> {
  const C = musdContracts(network);
  const c = client(network);
  const { upperHint, lowerHint } = await getHints(c, C, 0n);
  const data = encodeFunctionData({ abi: WRITE_ABI, functionName: "addColl", args: [upperHint, lowerHint] });
  return evmSendTransaction(evmWalletId, network, { to: C.borrowerOperations, valueWei: collateralWei, data });
}

export async function executeWithdrawCollateral(
  evmWalletId: string,
  collateralWei: bigint,
  network: MezoNetwork,
): Promise<string> {
  const C = musdContracts(network);
  const c = client(network);
  const { upperHint, lowerHint } = await getHints(c, C, 0n);
  const data = encodeFunctionData({
    abi: WRITE_ABI,
    functionName: "withdrawColl",
    args: [collateralWei, upperHint, lowerHint],
  });
  return evmSendTransaction(evmWalletId, network, { to: C.borrowerOperations, data });
}

export async function executeRepay(
  evmWalletId: string,
  owner: string,
  musdWei: bigint,
  network: MezoNetwork,
): Promise<{ approveHash: string | null; repayHash: string }> {
  const C = musdContracts(network);
  const c = client(network);
  const approveHash = await ensureTokenApproval(evmWalletId, owner, C.musdToken, C.borrowerOperations, musdWei, network);
  const { upperHint, lowerHint } = await getHints(c, C, 0n);
  const data = encodeFunctionData({
    abi: WRITE_ABI,
    functionName: "repayMUSD",
    args: [musdWei, upperHint, lowerHint],
  });
  const repayHash = await evmSendTransaction(evmWalletId, network, { to: C.borrowerOperations, data });
  return { approveHash, repayHash };
}

export async function executeCloseTrove(evmWalletId: string, owner: string, network: MezoNetwork): Promise<string> {
  const C = musdContracts(network);
  const c = client(network);
  const tm = C.troveManager as Address;
  const [debt, status] = await Promise.all([
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveDebt", args: [owner as Address] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveStatus", args: [owner as Address] }),
  ]);
  if (Number(status) !== 1) throw new Error("No open trove to close.");
  if (debt > 0n) {
    throw new Error(
      `Trove still owes ${formatUnits(debt, 18)} MUSD — repay first (mezo_musd_repay), then close. No transaction sent.`,
    );
  }
  const data = encodeFunctionData({ abi: WRITE_ABI, functionName: "closeTrove" });
  return evmSendTransaction(evmWalletId, network, { to: C.borrowerOperations, data });
}

export interface PoolStatus {
  depositor: string;
  stakedMUSD: string;
  collateralGainBTC: string;
  totalPoolDepositsMUSD: string;
  poolShare: string;
  borrowingInterestRate: string;
}

export async function fetchPoolStatus(depositor: string, network: MezoNetwork): Promise<PoolStatus> {
  const C = musdContracts(network);
  const c = client(network);
  const sp = C.stabilityPool as Address;
  const who = depositor as Address;
  const [compounded, gain, total, rate] = await Promise.all([
    c.readContract({ address: sp, abi: STABILITY_POOL_ABI, functionName: "getCompoundedMUSDDeposit", args: [who] }),
    c.readContract({ address: sp, abi: STABILITY_POOL_ABI, functionName: "getDepositorCollateralGain", args: [who] }),
    c.readContract({ address: sp, abi: STABILITY_POOL_ABI, functionName: "getTotalMUSDDeposits" }),
    c.readContract({ address: C.interestRateManager as Address, abi: INTEREST_RATE_ABI, functionName: "interestRate" }),
  ]);
  const share = total > 0n ? ((Number(compounded) * 100) / Number(total)).toFixed(4) : "0";
  return {
    depositor,
    stakedMUSD: formatUnits(compounded, 18),
    collateralGainBTC: formatUnits(gain, 18),
    totalPoolDepositsMUSD: formatUnits(total, 18),
    poolShare: `${share}%`,
    borrowingInterestRate: `${(Number(rate) / 100).toFixed(2)}%`,
  };
}

export async function executeStake(
  evmWalletId: string,
  owner: string,
  musdWei: bigint,
  network: MezoNetwork,
): Promise<{ approveHash: string | null; stakeHash: string }> {
  const C = musdContracts(network);
  const approveHash = await ensureTokenApproval(evmWalletId, owner, C.musdToken, C.stabilityPool, musdWei, network);
  const data = encodeFunctionData({
    abi: STABILITY_POOL_ABI,
    functionName: "provideToSP",
    args: [musdWei],
  });
  const stakeHash = await evmSendTransaction(evmWalletId, network, { to: C.stabilityPool, data });
  return { approveHash, stakeHash };
}

export async function executeUnstake(
  evmWalletId: string,
  musdWei: bigint,
  network: MezoNetwork,
): Promise<string> {
  const C = musdContracts(network);
  const data = encodeFunctionData({
    abi: STABILITY_POOL_ABI,
    functionName: "withdrawFromSP",
    args: [musdWei],
  });
  return evmSendTransaction(evmWalletId, network, { to: C.stabilityPool, data });
}

export interface IcrCheck {
  borrower: string;
  hasTrove: boolean;
  icr: string;
  mcr: string;
  tcr: string;
  recoveryMode: boolean;
  priceDropToLiquidation: string;
  topUpFor150ICR_BTC: string;
  repayFor150ICR_MUSD: string;
  note: string;
}

/** ICR health + exactly what top-up or repay reaches a safer 150% ICR. Read-only. */
export async function checkIcr(borrower: string, network: MezoNetwork): Promise<IcrCheck> {
  const C = musdContracts(network);
  const c = client(network);
  const tm = C.troveManager as Address;
  const who = borrower as Address;
  const price = await fetchPrice(c, C);
  const [coll, debt, mcr, tcr] = await Promise.all([
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveColl", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTroveDebt", args: [who] }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "MCR" }),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTCR", args: [price] }),
  ]);
  if (coll === 0n || debt === 0n) {
    return {
      borrower, hasTrove: false, icr: "N/A",
      mcr: `${((Number(mcr) / 1e18) * 100).toFixed(2)}%`,
      tcr: tcr > 0n ? `${((Number(tcr) / 1e18) * 100).toFixed(2)}%` : "N/A",
      recoveryMode: tcr < 1_500_000_000_000_000_000n,
      priceDropToLiquidation: "N/A", topUpFor150ICR_BTC: "0", repayFor150ICR_MUSD: "0",
      note: "No open trove.",
    };
  }
  const icrWei = (coll * price) / debt; // 1e18-based
  const targetWei = 1_500_000_000_000_000_000n;
  const dropPct = icrWei > mcr ? ((Number(icrWei - mcr) * 100) / Number(icrWei)).toFixed(2) : "0";
  // collNeeded = 1.5 * debt / price; topUp = max(0, needed - coll)
  const needColl = (targetWei * debt) / price;
  const topUp = needColl > coll ? needColl - coll : 0n;
  // repay = debt - coll*price/1.5
  const targetDebt = (coll * price) / targetWei;
  const repay = targetDebt < debt ? debt - targetDebt : 0n;
  return {
    borrower,
    hasTrove: true,
    icr: `${(Number(icrWei) / 1e18).toFixed(2)}%`,
    mcr: `${((Number(mcr) / 1e18) * 100).toFixed(2)}%`,
    tcr: `${((Number(tcr) / 1e18) * 100).toFixed(2)}%`,
    recoveryMode: tcr < 1_500_000_000_000_000_000n,
    priceDropToLiquidation: `${dropPct}%`,
    topUpFor150ICR_BTC: formatUnits(topUp, 18),
    repayFor150ICR_MUSD: formatUnits(repay, 18),
    note: topUp === 0n && repay === 0n
      ? "Already at or above 150% ICR."
      : "Top up BTC or repay MUSD to reach 150% ICR. Auto top-up needs a scheduler — this tool only reports the amounts.",
  };
}

export interface MintAndStakeResult {
  openTxHash: string;
  approveHash: string | null;
  stakeTxHash: string;
  musdBorrowed: string;
  musdStaked: string;
  borrowingFeeMUSD: string;
  totalDebtMUSD: string;
  poolShareAfter: string;
  tcr: string;
  recoveryMode: boolean;
}

/**
 * Mint-and-stake in one flow: open trove → wait → approve SP → stake.
 * Each step confirms before the next starts. Borrows the raw amount (fee
 * charged once by the contract) and stakes up to the borrowed amount.
 */
export async function executeMintAndStake(
  evmWalletId: string,
  owner: string,
  collateralWei: bigint,
  musdWei: bigint,
  stakeWei: bigint,
  maxFeePercent: number,
  network: MezoNetwork,
): Promise<MintAndStakeResult> {
  if (stakeWei > musdWei) throw new Error("Stake amount cannot exceed the borrowed amount. No transaction sent.");
  const open = await executeOpenTrove(evmWalletId, owner, musdWei, collateralWei, maxFeePercent, network);
  const openOk = await waitForConfirmation(network, open.txHash);
  if (!openOk) throw new Error(`Open-trove tx reverted: ${open.txHash}. Stopping before staking.`);
  const stake = await executeStake(evmWalletId, owner, stakeWei, network);
  const stakeOk = await waitForConfirmation(network, stake.stakeHash);
  if (!stakeOk) throw new Error(`Stake tx reverted: ${stake.stakeHash}. Trove is open — MUSD is in your wallet.`);
  const c = client(network);
  const C = musdContracts(network);
  const tm = C.troveManager as Address;
  const price = await fetchPrice(c, C);
  const [pool, tcr] = await Promise.all([
    fetchPoolStatus(owner, network),
    c.readContract({ address: tm, abi: TROVE_MANAGER_ABI, functionName: "getTCR", args: [price] }),
  ]);
  return {
    openTxHash: open.txHash,
    approveHash: stake.approveHash,
    stakeTxHash: stake.stakeHash,
    musdBorrowed: open.musdBorrowed,
    musdStaked: formatUnits(stakeWei, 18),
    borrowingFeeMUSD: open.borrowingFeeMUSD,
    totalDebtMUSD: open.totalDebtMUSD,
    poolShareAfter: pool.poolShare,
    tcr: tcr > 0n ? `${((Number(tcr) / 1e18) * 100).toFixed(2)}%` : "N/A",
    recoveryMode: tcr < 1_500_000_000_000_000_000n,
  };
}

export interface RedeemResult {
  txHash: string;
  requestedMUSD: string;
  redeemedMUSD: string;
  btcReceivedEstimate: string;
}

/**
 * Redeem MUSD for BTC at the $1 peg. No approve step — TroveManager burns
 * caller MUSD directly. Uses REAL hints from getRedemptionHints (zero hints
 * always revert) and the truncated lot (partial redemptions only fill what
 * the first trove can provide). 6-arg signature per the deployed contract.
 */
export async function executeRedeem(
  evmWalletId: string,
  musdWei: bigint,
  network: MezoNetwork,
): Promise<RedeemResult> {
  const C = musdContracts(network);
  const c = client(network);
  const price = await fetchPrice(c, C);
  const [firstHint, partialNICR, musdLot] = (await c.readContract({
    address: C.hintHelpers as Address,
    abi: HINT_HELPERS_ABI,
    functionName: "getRedemptionHints",
    args: [musdWei, price, 0n],
  })) as unknown as [Address, bigint, bigint];
  if (firstHint === ZERO_ADDRESS || musdLot === 0n) {
    throw new Error("No redeemable troves for this amount right now — TCR may be too low or troves too small. No transaction sent.");
  }
  const [upper, lower] = (await c.readContract({
    address: C.sortedTroves as Address,
    abi: SORTED_TROVES_ABI,
    functionName: "findInsertPosition",
    args: [partialNICR, firstHint, firstHint],
  })) as unknown as [Address, Address];
  const data = encodeFunctionData({
    abi: REDEEM_ABI,
    functionName: "redeemCollateral",
    args: [musdLot, firstHint, upper, lower, partialNICR, 0n],
  });
  const txHash = await evmSendTransaction(evmWalletId, network, {
    to: C.troveManager,
    data,
    gasLimit: 5_000_000n,
  });
  return {
    txHash,
    requestedMUSD: formatUnits(musdWei, 18),
    redeemedMUSD: formatUnits(musdLot, 18),
    btcReceivedEstimate: formatUnits((musdLot * 10n ** 18n) / price, 18),
  };
}
