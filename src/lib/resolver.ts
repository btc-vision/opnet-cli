/**
 * BTC Name Resolver contract interactions for OPNet CLI
 *
 * Provides functions for interacting with the on-chain BtcResolver contract
 * for .btc domain management and website publishing.
 *
 * @module lib/resolver
 */

import { getContract } from 'opnet';
import { Address } from '@btc-vision/transaction';

import { NetworkName } from '../types/index.js';
import {
    IBtcResolver,
    CONTENTHASH_TYPE_CIDv0,
    CONTENTHASH_TYPE_CIDv1,
    CONTENTHASH_TYPE_IPNS,
    CONTENTHASH_TYPE_SHA256,
} from '../types/BtcResolver.js';
import { getProvider } from './provider.js';
import { getNetwork } from './wallet.js';
import { loadConfig } from './config.js';
import { BTC_RESOLVER_ABI } from './BtcResolver.abi.js';

/**
 * Domain information
 */
export interface DomainInfo {
    exists: boolean;
    owner: Address;
    createdAt: bigint;
    ttl: bigint;
}

/**
 * Subdomain information
 */
export interface SubdomainInfo {
    exists: boolean;
    owner: Address;
    parentHash: Uint8Array;
    ttl: bigint;
}

/**
 * Contenthash information
 */
export interface ContenthashInfo {
    hashType: number;
    hashData: Uint8Array;
    hashString: string;
}

/**
 * Pending transfer information
 */
export interface PendingTransferInfo {
    pendingOwner: Address;
    initiatedAt: bigint;
}

/**
 * Resolver contract cache
 */
const resolverCache = new Map<string, IBtcResolver>();

/**
 * Get the resolver contract address for a network
 *
 * @param network - Network name (defaults to configured default)
 * @returns The resolver contract address
 */
export function getResolverContractAddress(network?: NetworkName): string {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const address = config.resolverAddresses?.[targetNetwork];

    if (!address) {
        throw new Error(
            `Resolver address not configured for network: ${targetNetwork}\n` +
                `Run: opnet config set resolverAddresses.${targetNetwork} <address>`,
        );
    }

    return address;
}

/**
 * Get the resolver contract instance
 *
 * @param network - Network name (defaults to configured default)
 * @param sender - Optional sender address for write operations
 * @returns Contract instance
 */
export function getResolverContract(network?: NetworkName, sender?: Address): IBtcResolver {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const cacheKey = sender ? `${targetNetwork}:${sender.toHex()}` : targetNetwork;

    const cached = resolverCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const provider = getProvider(targetNetwork);
    const resolverAddress = getResolverContractAddress(targetNetwork);
    const bitcoinNetwork = getNetwork(targetNetwork);

    const contract = getContract<IBtcResolver>(
        resolverAddress,
        BTC_RESOLVER_ABI,
        provider,
        bitcoinNetwork,
        sender,
    );

    resolverCache.set(cacheKey, contract);
    return contract;
}

/**
 * Clear resolver contract cache
 */
export function clearResolverCache(): void {
    resolverCache.clear();
}

/**
 * Get domain information
 *
 * @param domainName - The domain name (without .btc suffix)
 * @param network - Network name
 * @returns Domain information or null if not found
 */
export async function getDomain(
    domainName: string,
    network?: NetworkName,
): Promise<DomainInfo | null> {
    const contract = getResolverContract(network);
    const result = await contract.getDomain(domainName);

    if (!result.properties.exists) {
        return null;
    }

    return {
        exists: result.properties.exists,
        owner: result.properties.owner,
        createdAt: result.properties.createdAt,
        ttl: result.properties.ttl,
    };
}

/**
 * Get subdomain information
 *
 * @param fullName - The full subdomain name (e.g., "sub.domain")
 * @param network - Network name
 * @returns Subdomain information or null if not found
 */
export async function getSubdomain(
    fullName: string,
    network?: NetworkName,
): Promise<SubdomainInfo | null> {
    const contract = getResolverContract(network);
    const result = await contract.getSubdomain(fullName);

    if (!result.properties.exists) {
        return null;
    }

    return {
        exists: result.properties.exists,
        owner: result.properties.owner,
        parentHash: result.properties.parentHash,
        ttl: result.properties.ttl,
    };
}

/**
 * Get contenthash for a domain or subdomain
 *
 * @param name - The domain or subdomain name
 * @param network - Network name
 * @returns Contenthash information
 */
export async function getContenthash(
    name: string,
    network?: NetworkName,
): Promise<ContenthashInfo> {
    const contract = getResolverContract(network);
    const result = await contract.getContenthash(name);

    return {
        hashType: result.properties.hashType,
        hashData: result.properties.hashData,
        hashString: result.properties.hashString,
    };
}

/**
 * Resolve a name to its owner
 *
 * @param name - The domain or subdomain name
 * @param network - Network name
 * @returns Owner address or null if not found
 */
export async function resolveName(name: string, network?: NetworkName): Promise<Address | null> {
    const contract = getResolverContract(network);
    const result = await contract.resolve(name);

    const owner = result.properties.owner;
    if (!owner || owner.toString() === '0'.repeat(64)) {
        return null;
    }

    return owner;
}

/**
 * Get pending transfer information
 *
 * @param domainName - The domain name
 * @param network - Network name
 * @returns Pending transfer info or null
 */
export async function getPendingTransfer(
    domainName: string,
    network?: NetworkName,
): Promise<PendingTransferInfo | null> {
    const contract = getResolverContract(network);
    try {
        const result = await contract.getPendingTransfer(domainName);
        const pendingOwner = result.properties.pendingOwner;

        if (!pendingOwner || pendingOwner.toString() === '0'.repeat(64)) {
            return null;
        }

        return {
            pendingOwner,
            initiatedAt: result.properties.initiatedAt,
        };
    } catch {
        return null;
    }
}

/**
 * Get treasury address
 *
 * @param network - Network name
 * @returns Treasury address string
 */
export async function getTreasuryAddress(network?: NetworkName): Promise<string> {
    const contract = getResolverContract(network);
    const result = await contract.getTreasuryAddress();
    return result.properties.treasuryAddress;
}

/**
 * Get domain price for a specific domain
 *
 * @param domainName - The domain name
 * @param network - Network name
 * @returns Price in satoshis
 */
export async function getDomainPrice(domainName: string, network?: NetworkName): Promise<bigint> {
    const contract = getResolverContract(network);
    const result = await contract.getDomainPrice(domainName);
    return result.properties.priceSats;
}

/**
 * Get base domain price
 *
 * @param network - Network name
 * @returns Base price in satoshis
 */
export async function getBaseDomainPrice(network?: NetworkName): Promise<bigint> {
    const contract = getResolverContract(network);
    const result = await contract.getBaseDomainPrice();
    return result.properties.priceSats;
}

/**
 * Get contenthash type name
 *
 * @param hashType - The contenthash type number
 * @returns Human-readable type name
 */
export function getContenthashTypeName(hashType: number): string {
    switch (hashType) {
        case CONTENTHASH_TYPE_CIDv0:
            return 'CIDv0';
        case CONTENTHASH_TYPE_CIDv1:
            return 'CIDv1';
        case CONTENTHASH_TYPE_IPNS:
            return 'IPNS';
        case CONTENTHASH_TYPE_SHA256:
            return 'SHA256';
        default:
            return 'Unknown';
    }
}

/**
 * Detect contenthash type from string
 *
 * @param content - The contenthash string
 * @returns The detected type or null if invalid
 */
export function detectContenthashType(content: string): number | null {
    if (content.startsWith('Qm') && content.length === 46) {
        return CONTENTHASH_TYPE_CIDv0;
    }
    if (content.startsWith('baf')) {
        return CONTENTHASH_TYPE_CIDv1;
    }
    if (content.startsWith('k')) {
        return CONTENTHASH_TYPE_IPNS;
    }
    // Check if it's a valid hex string for SHA256 (64 chars)
    if (/^[0-9a-fA-F]{64}$/.test(content)) {
        return CONTENTHASH_TYPE_SHA256;
    }
    return null;
}

/**
 * Validate domain name format
 *
 * @param domain - The domain name to validate
 * @returns Error message or null if valid
 */
export function validateDomainName(domain: string): string | null {
    if (domain.length < 3) {
        return 'Domain must be at least 3 characters';
    }
    if (domain.length > 63) {
        return 'Domain must be at most 63 characters';
    }

    // Check first character
    if (!/^[a-zA-Z0-9]/.test(domain)) {
        return 'Domain must start with alphanumeric character';
    }

    // Check last character
    if (!/[a-zA-Z0-9]$/.test(domain)) {
        return 'Domain must end with alphanumeric character';
    }

    // Check for valid characters
    if (!/^[a-zA-Z0-9-]+$/.test(domain)) {
        return 'Domain can only contain letters, numbers, and hyphens';
    }

    // Check for consecutive hyphens
    if (/--/.test(domain)) {
        return 'Domain cannot contain consecutive hyphens';
    }

    return null;
}

/**
 * Validate CIDv0 format
 *
 * @param cid - The CID to validate
 * @returns Error message or null if valid
 */
export function validateCIDv0(cid: string): string | null {
    if (cid.length !== 46) {
        return 'CIDv0 must be 46 characters';
    }
    if (!cid.startsWith('Qm')) {
        return 'CIDv0 must start with "Qm"';
    }
    return null;
}

/**
 * Validate CIDv1 format
 *
 * @param cid - The CID to validate
 * @returns Error message or null if valid
 */
export function validateCIDv1(cid: string): string | null {
    if (cid.length < 50 || cid.length > 128) {
        return 'CIDv1 must be 50-128 characters';
    }
    if (!cid.startsWith('baf')) {
        return 'CIDv1 must start with "baf"';
    }
    return null;
}

/**
 * Validate IPNS ID format
 *
 * @param ipnsId - The IPNS ID to validate
 * @returns Error message or null if valid
 */
export function validateIPNS(ipnsId: string): string | null {
    if (ipnsId.length < 50 || ipnsId.length > 128) {
        return 'IPNS ID must be 50-128 characters';
    }
    if (!ipnsId.startsWith('k')) {
        return 'IPNS ID must start with "k"';
    }
    return null;
}

/**
 * Check if a name is a subdomain
 *
 * @param name - The name to check
 * @returns True if the name is a subdomain
 */
export function isSubdomain(name: string): boolean {
    return name.includes('.');
}

/**
 * Parse a full domain name, removing .btc suffix if present
 *
 * @param fullName - The full name (e.g., "mysite.btc" or "sub.mysite.btc")
 * @returns The name without .btc suffix
 */
export function parseDomainName(fullName: string): string {
    // Remove .btc suffix if present
    if (fullName.endsWith('.btc')) {
        return fullName.slice(0, -4);
    }
    return fullName;
}
