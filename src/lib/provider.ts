/**
 * JSONRpcProvider wrapper for OPNet CLI
 *
 * Provides a unified interface for blockchain interaction using the opnet package.
 *
 * @module lib/provider
 */

import { JSONRpcProvider } from 'opnet';

import { NetworkName } from '../types/index.js';
import { getRpcUrl, getRegistryAddress, loadConfig } from './config.js';
import { getNetwork } from './wallet.js';

/** Provider timeout in milliseconds */
const DEFAULT_TIMEOUT = 30000;

/**
 * Provider instance cache
 */
const providerCache = new Map<string, JSONRpcProvider>();

/**
 * Get a JSONRpcProvider for a network
 *
 * @param network - Network name (defaults to configured default)
 * @returns JSONRpcProvider instance
 */
export function getProvider(network?: NetworkName): JSONRpcProvider {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const rpcUrl = getRpcUrl(targetNetwork);
    const cacheKey = `${targetNetwork}:${rpcUrl}`;

    // Return cached provider if available
    const cached = providerCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    // Create new provider
    const bitcoinNetwork = getNetwork(targetNetwork);
    const provider = new JSONRpcProvider(rpcUrl, bitcoinNetwork, DEFAULT_TIMEOUT);

    providerCache.set(cacheKey, provider);
    return provider;
}

/**
 * Clear provider cache (useful for testing or network changes)
 */
export function clearProviderCache(): void {
    providerCache.clear();
}

/**
 * Get the registry contract address for a network
 *
 * @param network - Network name (defaults to configured default)
 * @returns The registry contract address
 */
export function getRegistryContractAddress(network?: NetworkName): string {
    return getRegistryAddress(network);
}

/**
 * Check if the provider can connect to the RPC endpoint
 *
 * @param network - Network name (defaults to configured default)
 * @returns True if connection successful
 */
export async function checkConnection(network?: NetworkName): Promise<boolean> {
    try {
        const provider = getProvider(network);
        // Try to get the current block to verify connection
        await provider.getBlockNumber();
        return true;
    } catch {
        return false;
    }
}

/**
 * Get the current block number
 *
 * @param network - Network name (defaults to configured default)
 * @returns Current block number
 */
export async function getBlockNumber(network?: NetworkName): Promise<bigint> {
    const provider = getProvider(network);
    return provider.getBlockNumber();
}

/**
 * Get the balance for an address
 *
 * @param address - The address to check
 * @param network - Network name (defaults to configured default)
 * @returns Balance in satoshis
 */
export async function getBalance(address: string, network?: NetworkName): Promise<bigint> {
    const provider = getProvider(network);
    return provider.getBalance(address);
}

/**
 * Broadcast a signed transaction
 *
 * @param rawTx - The raw transaction hex
 * @param network - Network name (defaults to configured default)
 * @returns Transaction hash
 */
export async function broadcastTransaction(
    rawTx: string,
    network?: NetworkName,
    isPsbt: boolean = false,
): Promise<string> {
    const provider = getProvider(network);
    const result = await provider.sendRawTransaction(rawTx, isPsbt);
    return result.result ?? '';
}
