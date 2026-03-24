
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const DEFAULT_BOOTSTRAP_NODES = [
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmbLHAnMoJPWSCR5Zhtx6BHJX9KiKNN6tpvbUcqanj75Nb',
    '/dnsaddr/bootstrap.libp2p.io/p2p/QmcZf59bWwK5XFi76CZX8cbJ4BhTzzA3gU1ZjYZcYW3dwt'
];

const STORAGE_KEY = 'bucks-bootstrap-nodes';

function createBootstrapNodesStore() {
    let initialValue = DEFAULT_BOOTSTRAP_NODES;
    if (browser) {
        const storedValue = localStorage.getItem(STORAGE_KEY);
        if (storedValue) {
            try {
                initialValue = JSON.parse(storedValue);
            } catch (e) {
                // ignore parsing errors
            }
        }
    }
    
    const store = writable<string[]>(initialValue);

    store.subscribe(value => {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        }
    });

    return store;
}

export const bootstrapNodes = createBootstrapNodesStore();
