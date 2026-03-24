
import { createHelia } from 'helia';
import { createOrbitDB, OrbitDB, Events, KeyValue } from '@orbitdb/core';
import { createLibp2p } from 'libp2p';
import { webSockets } from '@libp2p/websockets';
import { webTransport } from '@libp2p/webtransport';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { bootstrap } from '@libp2p/bootstrap';
import { LevelBlockstore } from 'blockstore-level';
import { LevelDatastore } from 'datastore-level';

// Types for the databases
export type EventsDatabase = Events<any>;
export type KeyValueDatabase = KeyValue<any>;

export interface BucksDB {
    orbitdb: OrbitDB;
    posts: EventsDatabase;
    users: KeyValueDatabase;
    following: KeyValueDatabase;
    interactions: KeyValueDatabase;
    notifications: EventsDatabase;
    agents: KeyValueDatabase;
    devices: KeyValueDatabase;
}

let bucksDBInstance: BucksDB | null = null;

async function createHeliaNode() {
    const blockstore = new LevelBlockstore('./helia-blockstore');
    const datastore = new LevelDatastore('./helia-datastore');

    const libp2p = await createLibp2p({
        datastore,
        transports: [webSockets(), webTransport()],
        connectionEncryption: [noise()],
        streamMuxers: [yamux()],
        peerDiscovery: [
            bootstrap({
                list: [
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb",
                    "/dnsaddr/bootstrap.libp2p.io/p2p/QmSoLMeWqB7YGVLJN3pNLQpmmEk35v6wYtsMGLzSr5QBU3",
                ],
            }),
        ],
    });

    return await createHelia({
        datastore,
        blockstore,
        libp2p,
    });
}

export async function getBucksDB(): Promise<BucksDB> {
    if (bucksDBInstance) {
        return bucksDBInstance;
    }

    const ipfs = await createHeliaNode();
    const orbitdb = await createOrbitDB({ ipfs });

    const posts = await orbitdb.open('bucks.posts', { type: 'events' });
    const users = await orbitdb.open('bucks.users', { type: 'keyvalue' });
    const following = await orbitdb.open('bucks.following', { type: 'keyvalue' });
    const interactions = await orbitdb.open('bucks.interactions', { type: 'keyvalue' });
    const notifications = await orbitdb.open('bucks.notifications', { type: 'events' });
    const agents = await orbitdb.open('bucks.agents', { type: 'keyvalue' });
    const devices = await orbitdb.open('bucks.devices', { type: 'keyvalue' });

    bucksDBInstance = {
        orbitdb,
        posts,
        users,
        following,
        interactions,
        notifications,
        agents,
        devices,
    };

    return bucksDBInstance;
}

export async function openMessageDB(peerDID: string): Promise<EventsDatabase> {
    if (!bucksDBInstance) {
        await getBucksDB();
    }
    // Use a unique name for the message DB based on the peer DID
    // This is a simplified approach. A better approach would involve a discovery mechanism.
    const dbName = `bucks.messages.${peerDID}`;
    return await bucksDBInstance!.orbitdb.open(dbName, { type: 'events' });
}

export async function getDBAddresses(): Promise<Record<string, string>> {
    if (!bucksDBInstance) {
        await getBucksDB();
    }

    const dbs = bucksDBInstance!;
    const addresses: Record<string, string> = {};

    for (const [name, db] of Object.entries(dbs)) {
        if (name !== 'orbitdb') {
            addresses[name] = (db as EventsDatabase | KeyValueDatabase).address;
        }
    }

    return addresses;
}
