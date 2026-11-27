/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ORDERING_BASE?: string;
  readonly VITE_CATALOG_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
