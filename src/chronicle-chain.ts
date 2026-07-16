import type { DailyKnowledgeEdition } from "./knowledge-chain";

const CHRONICLE_ABI = [
  "function commitEdition(uint32 day, bytes32 editionRoot, bytes32 previousEditionRoot, bytes32 manifestHash, bytes32 policyRoot, uint32 factCount) returns (uint32 revision)",
] as const;

export interface ChronicleConfiguration {
  contractAddress: string;
  chainName: string;
  explorerUrl: string;
  ready: boolean;
}

export interface ChronicleTransaction {
  account: string;
  contractAddress: string;
  chainName: string;
  txHash: string;
  explorerUrl: string | null;
}

function configuredAddress(): string {
  return String(import.meta.env.VITE_FACT_ATLAS_CONTRACT_ADDRESS || "").trim();
}

export function getChronicleConfiguration(): ChronicleConfiguration {
  const contractAddress = configuredAddress();
  return {
    contractAddress,
    chainName: String(import.meta.env.VITE_FACT_ATLAS_CHAIN_NAME || "EVM network").trim(),
    explorerUrl: String(import.meta.env.VITE_FACT_ATLAS_EXPLORER_URL || "").trim().replace(/\/$/, ""),
    ready: /^0x[0-9a-f]{40}$/i.test(contractAddress),
  };
}

export function hasInjectedWallet(): boolean {
  return typeof window !== "undefined" && Boolean((window as Window & { ethereum?: unknown }).ethereum);
}

export async function commitDailyEdition(edition: DailyKnowledgeEdition): Promise<ChronicleTransaction> {
  const config = getChronicleConfiguration();
  if (!config.ready) {
    throw new Error("Chronicle contract address is not configured. · 公共知识链合约地址尚未配置。");
  }
  const ethereum = (window as Window & { ethereum?: unknown }).ethereum;
  if (!ethereum) throw new Error("Install or open an EVM wallet first. · 请先安装或打开 EVM 钱包。");
  const { BrowserProvider, Contract, getAddress } = await import("ethers");
  const contractAddress = getAddress(config.contractAddress);
  const provider = new BrowserProvider(ethereum as never);
  await provider.send("eth_requestAccounts", []);
  const signer = await provider.getSigner();
  const account = await signer.getAddress();
  const contract = new Contract(contractAddress, CHRONICLE_ABI, signer);
  const transaction = await contract.commitEdition(
    edition.day,
    edition.editionRoot,
    edition.previousEditionRoot,
    edition.manifestHash,
    edition.policyRoot,
    edition.factCount,
  );
  await transaction.wait();
  return {
    account,
    contractAddress,
    chainName: config.chainName,
    txHash: transaction.hash,
    explorerUrl: config.explorerUrl ? `${config.explorerUrl}/tx/${transaction.hash}` : null,
  };
}
