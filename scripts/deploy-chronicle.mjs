import { readFile } from "node:fs/promises";
import { ContractFactory, JsonRpcProvider, Wallet, formatEther } from "ethers";
import solc from "solc";

const EXPECTED_CHAIN_ID = 84532n;
const rpcUrl = process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org";
const privateKey = process.env.FACT_ATLAS_DEPLOYER_PRIVATE_KEY;

if (!privateKey) {
  throw new Error("FACT_ATLAS_DEPLOYER_PRIVATE_KEY is required. Never commit or paste it into project files.");
}

const sourcePath = new URL("../contracts/FactAtlasChronicle.sol", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const compilerInput = {
  language: "Solidity",
  sources: { "FactAtlasChronicle.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};
const compilerOutput = JSON.parse(solc.compile(JSON.stringify(compilerInput)));
const errors = (compilerOutput.errors || []).filter((entry) => entry.severity === "error");
if (errors.length) throw new Error(errors.map((entry) => entry.formattedMessage).join("\n"));

const artifact = compilerOutput.contracts["FactAtlasChronicle.sol"].FactAtlasChronicle;
const provider = new JsonRpcProvider(rpcUrl);
const network = await provider.getNetwork();
if (network.chainId !== EXPECTED_CHAIN_ID) {
  throw new Error(`Refusing deployment: expected Base Sepolia chain 84532, received ${network.chainId}.`);
}

const wallet = new Wallet(privateKey, provider);
const balance = await provider.getBalance(wallet.address);
if (balance === 0n) {
  throw new Error(`Deployer ${wallet.address} has no Base Sepolia ETH.`);
}

const factory = new ContractFactory(artifact.abi, `0x${artifact.evm.bytecode.object}`, wallet);
const contract = await factory.deploy();
const deployment = contract.deploymentTransaction();
if (!deployment) throw new Error("Deployment transaction was not created.");
await contract.waitForDeployment();
const address = await contract.getAddress();

console.log(`Deployer: ${wallet.address}`);
console.log(`Balance before deployment: ${formatEther(balance)} test ETH`);
console.log(`Contract: ${address}`);
console.log(`Transaction: ${deployment.hash}`);
console.log(`Explorer: https://sepolia-explorer.base.org/address/${address}`);
console.log("\nPublic frontend configuration:");
console.log(`VITE_FACT_ATLAS_CONTRACT_ADDRESS=${address}`);
console.log("VITE_FACT_ATLAS_CHAIN_NAME=Base Sepolia");
console.log("VITE_FACT_ATLAS_CHAIN_ID=84532");
console.log("VITE_FACT_ATLAS_RPC_URL=https://sepolia.base.org");
console.log("VITE_FACT_ATLAS_EXPLORER_URL=https://sepolia-explorer.base.org");
