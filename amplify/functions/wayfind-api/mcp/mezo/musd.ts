// MUSD read layer — viem only, no ethers. Reads run against the Mezo RPC;
// writes (later phase) go through evmSendTransaction in lib/evm.ts on the
// user's embedded wallet. Mainnet contract addresses are not published yet —
// queries fail closed on mainnet until they are added below.
import { createPublicClient, formatUnits, http, parseAbi } from "viem";
import { mezoChainId, mezoRpcUrl, type MezoNetwork } from "../lib/evm";

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

function musdContracts(network: MezoNetwork) {
  if (network !== "testnet") {
    throw new Error("MUSD contract addresses are only configured for Mezo testnet so far.");
  }
  return TESTNET_CONTRACTS;
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

async function fetchPrice(c: ReturnType<typeof client>): Promise<bigint> {
  return c.readContract({
    address: TESTNET_CONTRACTS.priceFeed,
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
  const price = await fetchPrice(c);
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
  const price = await fetchPrice(c);
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
