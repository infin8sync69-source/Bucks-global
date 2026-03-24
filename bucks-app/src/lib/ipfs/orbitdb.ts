import { createOrbitDB } from "@orbitdb/core";
import type { OrbitDBInstance, OrbitDatabase } from "@orbitdb/core";
import { getHelia } from "./node";
import type { Identity } from "$lib/crypto/identity";

type EventsDB = OrbitDatabase & {
  add: (value: unknown) => Promise<unknown>;
  all: () => Promise<Array<{ value: unknown }>>;
};

type KeyValueDB = OrbitDatabase & {
  get: (key: string) => Promise<unknown>;
  put: (key: string, value: unknown) => Promise<unknown>;
  set?: (key: string, value: unknown) => Promise<unknown>;
};

export interface BucksDB {
  orbitdb: OrbitDBInstance;
  posts: EventsDB;
  users: KeyValueDB;
  following: KeyValueDB;
  interactions: KeyValueDB;
  notifications: EventsDB;
  agents: KeyValueDB;
  devices: KeyValueDB;
  address: string;
}

let bucksDBPromise: Promise<BucksDB> | null = null;

const DB_NAMES = {
  posts: "bucks.posts",
  users: "bucks.users",
  following: "bucks.following",
  interactions: "bucks.interactions",
  notifications: "bucks.notifications",
  agents: "bucks.agents",
  devices: "bucks.devices",
};

function dbAddress(db: unknown): string {
  const address = (db as { address?: string | { toString(): string } }).address;
  if (typeof address === "string") return address;
  return address?.toString?.() ?? "";
}

async function createBucksDB(identity?: Identity): Promise<BucksDB> {
  const ipfs = await getHelia();
  const orbitdb = await createOrbitDB({
    ipfs,
    id: identity?.did ?? undefined,
  });

  const [posts, users, following, interactions, notifications, agents, devices] =
    await Promise.all([
      orbitdb.open(DB_NAMES.posts, { type: "events" }) as Promise<EventsDB>,
      orbitdb.open(DB_NAMES.users, { type: "keyvalue" }) as Promise<KeyValueDB>,
      orbitdb.open(DB_NAMES.following, {
        type: "keyvalue",
      }) as Promise<KeyValueDB>,
      orbitdb.open(DB_NAMES.interactions, {
        type: "keyvalue",
      }) as Promise<KeyValueDB>,
      orbitdb.open(DB_NAMES.notifications, {
        type: "events",
      }) as Promise<EventsDB>,
      orbitdb.open(DB_NAMES.agents, { type: "keyvalue" }) as Promise<KeyValueDB>,
      orbitdb.open(DB_NAMES.devices, { type: "keyvalue" }) as Promise<KeyValueDB>,
    ]);

  return {
    orbitdb,
    posts,
    users,
    following,
    interactions,
    notifications,
    agents,
    devices,
    address:
      (orbitdb as unknown as { id?: string }).id ??
      identity?.did ??
      "bucks-local",
  };
}

export async function getBucksDB(identity?: Identity): Promise<BucksDB> {
  if (bucksDBPromise == null) {
    bucksDBPromise = createBucksDB(identity).catch((error) => {
      bucksDBPromise = null;
      throw error;
    });
  }
  return bucksDBPromise;
}

export async function openMessageDB(peerDID: string): Promise<EventsDB> {
  const db = await getBucksDB();
  const myId = db.address || "local";
  const dbName = [myId, peerDID].sort().join("-");
  return (await db.orbitdb.open(`bucks.messages.${dbName}`, {
    type: "events",
  })) as EventsDB;
}

export async function getDBAddresses(): Promise<Record<string, string>> {
  const db = await getBucksDB();
  return {
    posts: dbAddress(db.posts),
    users: dbAddress(db.users),
    following: dbAddress(db.following),
    interactions: dbAddress(db.interactions),
    notifications: dbAddress(db.notifications),
    agents: dbAddress(db.agents),
    devices: dbAddress(db.devices),
  };
}
