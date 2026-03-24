// src/lib/stores/peers.ts
import { readable } from 'svelte/store';

export interface Peer {
    did: string;
    name: string;
    avatar: string;
}

const suggestedPeers: Peer[] = [
    { did: 'did:key:z6Mkk7yqnGF44X9a211m2q4nF4', name: 'Alice', avatar: 'A' },
    { did: 'did:key:z6Mkn2n2n2n2n2n2n2n2n2n2n2', name: 'Bob', avatar: 'B' },
    { did: 'did:key:z6Mkfghfghfghfghfghfghfghfg', name: 'Charlie', avatar: 'C' },
];

export const peersStore = readable<Peer[]>(suggestedPeers);
