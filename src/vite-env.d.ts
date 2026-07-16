/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACT_ATLAS_CONTRACT_ADDRESS?: string;
  readonly VITE_FACT_ATLAS_CHAIN_NAME?: string;
  readonly VITE_FACT_ATLAS_CHAIN_ID?: string;
  readonly VITE_FACT_ATLAS_RPC_URL?: string;
  readonly VITE_FACT_ATLAS_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
