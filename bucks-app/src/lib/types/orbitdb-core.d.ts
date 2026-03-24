declare module "@orbitdb/core" {
  export type OrbitDBAddress = string | { toString(): string };

  export interface OrbitDatabase {
    address: OrbitDBAddress;
    close: () => Promise<void>;
    drop?: () => Promise<void>;
    [key: string]: unknown;
  }

  export interface OrbitDBInstance {
    open: (
      address: string,
      options?: {
        type?: "events" | "keyvalue" | "documents" | string;
        [key: string]: unknown;
      }
    ) => Promise<OrbitDatabase>;
    stop: () => Promise<void>;
    [key: string]: unknown;
  }

  export function createOrbitDB(options: {
    ipfs: unknown;
    [key: string]: unknown;
  }): Promise<OrbitDBInstance>;
}
