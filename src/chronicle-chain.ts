import type { DailyKnowledgeEdition } from "./knowledge-chain";

const CHRONICLE_ABI = [
  "function commitEdition(uint32 day, bytes32 editionRoot, bytes32 previousEditionRoot, bytes32 manifestHash, bytes32 policyRoot, uint32 factCount) returns (uint32 revision)",
] as const;

export interface ChronicleConfiguration {
  contractAddress: string;
  chainName: string;
  chainId: number;
  rpcUrl: string;
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
  const chainId = Number(import.meta.env.VITE_FACT_ATLAS_CHAIN_ID || 84532);
  const rpcUrl = String(import.meta.env.VITE_FACT_ATLAS_RPC_URL || "https://sepolia.base.org").trim();
  return {
    contractAddress,
    chainName: String(import.meta.env.VITE_FACT_ATLAS_CHAIN_NAME || "EVM network").trim(),
    chainId,
    rpcUrl,
    explorerUrl: String(import.meta.env.VITE_FACT_ATLAS_EXPLORER_URL || "").trim().replace(/\/$/, ""),
    ready: /^0x[0-9a-f]{40}$/i.test(contractAddress) && Number.isInteger(chainId) && chainId > 0 && /^https:\/\//.test(rpcUrl),
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
  const ethereum = (window as Window & { ethereum?: {
    request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  } }).ethereum;
  if (!ethereum) throw new Error("Install or open an EVM wallet first. · 请先安装或打开 EVM 钱包。");
  const { BrowserProvider, Contract, getAddress } = await import("ethers");
  const contractAddress = getAddress(config.contractAddress);
  const expectedChainId = `0x${config.chainId.toString(16)}`;
  const currentChainId = await ethereum.request({ method: "eth_chainId" });
  if (currentChainId !== expectedChainId) {
    try {
      await ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: expectedChainId }] });
    } catch (error) {
      const code = Number((error as { code?: unknown })?.code);
      if (code !== 4902) throw error;
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: expectedChainId,
          chainName: config.chainName,
          nativeCurrency: { name: "Ethereum", symbol: "ETH", decimals: 18 },
          rpcUrls: [config.rpcUrl],
          blockExplorerUrls: config.explorerUrl ? [config.explorerUrl] : [],
        }],
      });
    }
  }
  const provider = new BrowserProvider(ethereum);
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
