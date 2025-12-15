/**
 * Package Registry contract interactions for OPNet CLI
 *
 * Provides functions for interacting with the on-chain PackageRegistry contract.
 *
 * @module lib/registry
 */

import { Contract, BitcoinInterface, JSONRpcProvider, CallResult } from 'opnet';
import { Network } from '@btc-vision/bitcoin';
import { Address } from '@btc-vision/transaction';
import * as crypto from 'crypto';

import { NetworkName, MLDSALevel, PluginPermissions, RegistryPluginType } from '../types/index.js';
import { getProvider, getRegistryContractAddress } from './provider.js';
import { getNetwork } from './wallet.js';
import { loadConfig } from './config.js';

/**
 * PackageRegistry ABI definition
 */
const REGISTRY_ABI = {
    functions: [
        {
            name: 'registerScope',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'initiateScopeTransfer',
            type: 'Function',
            inputs: [
                { name: 'scopeName', type: 'STRING' },
                { name: 'newOwner', type: 'ADDRESS' },
            ],
            outputs: [],
        },
        {
            name: 'acceptScopeTransfer',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'cancelScopeTransfer',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'registerPackage',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'publishVersion',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
                { name: 'ipfsCid', type: 'STRING' },
                { name: 'checksum', type: 'BYTES32' },
                { name: 'signature', type: 'BYTES' },
                { name: 'mldsaLevel', type: 'UINT8' },
                { name: 'opnetVersionRange', type: 'STRING' },
                { name: 'pluginType', type: 'UINT8' },
                { name: 'permissionsHash', type: 'BYTES32' },
                { name: 'dependencies', type: 'BYTES' },
            ],
            outputs: [],
        },
        {
            name: 'deprecateVersion',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
                { name: 'reason', type: 'STRING' },
            ],
            outputs: [],
        },
        {
            name: 'undeprecateVersion',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
            ],
            outputs: [],
        },
        {
            name: 'initiateTransfer',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'newOwner', type: 'ADDRESS' },
            ],
            outputs: [],
        },
        {
            name: 'acceptTransfer',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'cancelTransfer',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [],
        },
        {
            name: 'getScope',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [
                { name: 'exists', type: 'BOOL' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'createdAt', type: 'UINT64' },
            ],
        },
        {
            name: 'getScopeOwner',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [{ name: 'owner', type: 'ADDRESS' }],
        },
        {
            name: 'getPackage',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [
                { name: 'exists', type: 'BOOL' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'createdAt', type: 'UINT64' },
                { name: 'versionCount', type: 'UINT256' },
                { name: 'latestVersion', type: 'STRING' },
            ],
        },
        {
            name: 'getOwner',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [{ name: 'owner', type: 'ADDRESS' }],
        },
        {
            name: 'getVersion',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
            ],
            outputs: [
                { name: 'exists', type: 'BOOL' },
                { name: 'ipfsCid', type: 'STRING' },
                { name: 'checksum', type: 'BYTES32' },
                { name: 'sigHash', type: 'BYTES32' },
                { name: 'mldsaLevel', type: 'UINT8' },
                { name: 'opnetVersionRange', type: 'STRING' },
                { name: 'pluginType', type: 'UINT8' },
                { name: 'permissionsHash', type: 'BYTES32' },
                { name: 'depsHash', type: 'BYTES32' },
                { name: 'publisher', type: 'ADDRESS' },
                { name: 'publishedAt', type: 'UINT64' },
                { name: 'deprecated', type: 'BOOL' },
            ],
        },
        {
            name: 'isDeprecated',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
            ],
            outputs: [{ name: 'deprecated', type: 'BOOL' }],
        },
        {
            name: 'isImmutable',
            type: 'Function',
            inputs: [
                { name: 'packageName', type: 'STRING' },
                { name: 'version', type: 'STRING' },
            ],
            outputs: [{ name: 'immutable', type: 'BOOL' }],
        },
        {
            name: 'getPendingTransfer',
            type: 'Function',
            inputs: [{ name: 'packageName', type: 'STRING' }],
            outputs: [
                { name: 'pendingOwner', type: 'ADDRESS' },
                { name: 'initiatedAt', type: 'UINT64' },
            ],
        },
        {
            name: 'getPendingScopeTransfer',
            type: 'Function',
            inputs: [{ name: 'scopeName', type: 'STRING' }],
            outputs: [
                { name: 'pendingOwner', type: 'ADDRESS' },
                { name: 'initiatedAt', type: 'UINT64' },
            ],
        },
        {
            name: 'getTreasuryAddress',
            type: 'Function',
            inputs: [],
            outputs: [{ name: 'treasuryAddress', type: 'STRING' }],
        },
        {
            name: 'getScopePrice',
            type: 'Function',
            inputs: [],
            outputs: [{ name: 'priceSats', type: 'UINT64' }],
        },
        {
            name: 'getPackagePrice',
            type: 'Function',
            inputs: [],
            outputs: [{ name: 'priceSats', type: 'UINT64' }],
        },
    ],
    events: [
        {
            name: 'ScopeRegistered',
            values: [
                { name: 'scopeHash', type: 'UINT256' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'PackageRegistered',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'VersionPublished',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'versionHash', type: 'UINT256' },
                { name: 'publisher', type: 'ADDRESS' },
                { name: 'checksum', type: 'UINT256' },
                { name: 'timestamp', type: 'UINT64' },
                { name: 'mldsaLevel', type: 'UINT8' },
                { name: 'pluginType', type: 'UINT8' },
            ],
            type: 'Event',
        },
        {
            name: 'VersionDeprecated',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'versionHash', type: 'UINT256' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'VersionUndeprecated',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'versionHash', type: 'UINT256' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'PackageTransferInitiated',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'currentOwner', type: 'ADDRESS' },
                { name: 'newOwner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'PackageTransferCompleted',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'previousOwner', type: 'ADDRESS' },
                { name: 'newOwner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'PackageTransferCancelled',
            values: [
                { name: 'packageHash', type: 'UINT256' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'ScopeTransferInitiated',
            values: [
                { name: 'scopeHash', type: 'UINT256' },
                { name: 'currentOwner', type: 'ADDRESS' },
                { name: 'newOwner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'ScopeTransferCompleted',
            values: [
                { name: 'scopeHash', type: 'UINT256' },
                { name: 'previousOwner', type: 'ADDRESS' },
                { name: 'newOwner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
        {
            name: 'ScopeTransferCancelled',
            values: [
                { name: 'scopeHash', type: 'UINT256' },
                { name: 'owner', type: 'ADDRESS' },
                { name: 'timestamp', type: 'UINT64' },
            ],
            type: 'Event',
        },
    ],
};

/**
 * Scope information from registry
 */
export interface ScopeInfo {
    exists: boolean;
    owner: Address;
    createdAt: bigint;
}

/**
 * Package information from registry
 */
export interface PackageInfo {
    exists: boolean;
    owner: Address;
    createdAt: bigint;
    versionCount: bigint;
    latestVersion: string;
}

/**
 * Version information from registry
 */
export interface VersionInfo {
    exists: boolean;
    ipfsCid: string;
    checksum: Uint8Array;
    sigHash: Uint8Array;
    mldsaLevel: number;
    opnetVersionRange: string;
    pluginType: number;
    permissionsHash: Uint8Array;
    depsHash: Uint8Array;
    publisher: Address;
    publishedAt: bigint;
    deprecated: boolean;
}

/**
 * Pending transfer information
 */
export interface PendingTransfer {
    pendingOwner: Address;
    initiatedAt: bigint;
}

/**
 * Registry contract interface
 */
interface IPackageRegistry extends BitcoinInterface {
    registerScope(scopeName: string): Promise<CallResult>;
    initiateScopeTransfer(scopeName: string, newOwner: Address): Promise<CallResult>;
    acceptScopeTransfer(scopeName: string): Promise<CallResult>;
    cancelScopeTransfer(scopeName: string): Promise<CallResult>;
    registerPackage(packageName: string): Promise<CallResult>;
    publishVersion(
        packageName: string,
        version: string,
        ipfsCid: string,
        checksum: Uint8Array,
        signature: Uint8Array,
        mldsaLevel: number,
        opnetVersionRange: string,
        pluginType: number,
        permissionsHash: Uint8Array,
        dependencies: Uint8Array,
    ): Promise<CallResult>;
    deprecateVersion(packageName: string, version: string, reason: string): Promise<CallResult>;
    undeprecateVersion(packageName: string, version: string): Promise<CallResult>;
    initiateTransfer(packageName: string, newOwner: Address): Promise<CallResult>;
    acceptTransfer(packageName: string): Promise<CallResult>;
    cancelTransfer(packageName: string): Promise<CallResult>;
    getScope(scopeName: string): Promise<CallResult>;
    getScopeOwner(scopeName: string): Promise<CallResult>;
    getPackage(packageName: string): Promise<CallResult>;
    getOwner(packageName: string): Promise<CallResult>;
    getVersion(packageName: string, version: string): Promise<CallResult>;
    isDeprecated(packageName: string, version: string): Promise<CallResult>;
    isImmutable(packageName: string, version: string): Promise<CallResult>;
    getPendingTransfer(packageName: string): Promise<CallResult>;
    getPendingScopeTransfer(scopeName: string): Promise<CallResult>;
    getTreasuryAddress(): Promise<CallResult>;
    getScopePrice(): Promise<CallResult>;
    getPackagePrice(): Promise<CallResult>;
}

/**
 * Registry contract cache
 */
const registryCache = new Map<string, Contract<IPackageRegistry>>();

/**
 * Get the PackageRegistry contract instance
 *
 * @param network - Network name (defaults to configured default)
 * @returns Contract instance
 */
export function getRegistryContract(network?: NetworkName): Contract<IPackageRegistry> {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const cacheKey = targetNetwork;

    if (registryCache.has(cacheKey)) {
        return registryCache.get(cacheKey)!;
    }

    const provider = getProvider(targetNetwork);
    const registryAddress = getRegistryContractAddress(targetNetwork);
    const bitcoinNetwork = getNetwork(targetNetwork);

    const contract = new Contract<IPackageRegistry>(
        registryAddress,
        REGISTRY_ABI,
        provider,
        bitcoinNetwork,
    );

    registryCache.set(cacheKey, contract);
    return contract;
}

/**
 * Clear registry contract cache
 */
export function clearRegistryCache(): void {
    registryCache.clear();
}

/**
 * Get scope information
 *
 * @param scopeName - The scope name (without @)
 * @param network - Network name
 * @returns Scope information or null if not found
 */
export async function getScope(scopeName: string, network?: NetworkName): Promise<ScopeInfo | null> {
    const contract = getRegistryContract(network);
    const result = await contract.getScope(scopeName);

    const exists = result.decoded.obj['exists'] as boolean;
    if (!exists) {
        return null;
    }

    return {
        exists,
        owner: result.decoded.obj['owner'] as Address,
        createdAt: result.decoded.obj['createdAt'] as bigint,
    };
}

/**
 * Get scope owner
 *
 * @param scopeName - The scope name (without @)
 * @param network - Network name
 * @returns Owner address or null if scope doesn't exist
 */
export async function getScopeOwner(
    scopeName: string,
    network?: NetworkName,
): Promise<Address | null> {
    const contract = getRegistryContract(network);
    try {
        const result = await contract.getScopeOwner(scopeName);
        return result.decoded.obj['owner'] as Address;
    } catch {
        return null;
    }
}

/**
 * Get package information
 *
 * @param packageName - The package name (with @ for scoped)
 * @param network - Network name
 * @returns Package information or null if not found
 */
export async function getPackage(
    packageName: string,
    network?: NetworkName,
): Promise<PackageInfo | null> {
    const contract = getRegistryContract(network);
    const result = await contract.getPackage(packageName);

    const exists = result.decoded.obj['exists'] as boolean;
    if (!exists) {
        return null;
    }

    return {
        exists,
        owner: result.decoded.obj['owner'] as Address,
        createdAt: result.decoded.obj['createdAt'] as bigint,
        versionCount: result.decoded.obj['versionCount'] as bigint,
        latestVersion: result.decoded.obj['latestVersion'] as string,
    };
}

/**
 * Get package owner
 *
 * @param packageName - The package name
 * @param network - Network name
 * @returns Owner address or null if package doesn't exist
 */
export async function getPackageOwner(
    packageName: string,
    network?: NetworkName,
): Promise<Address | null> {
    const contract = getRegistryContract(network);
    try {
        const result = await contract.getOwner(packageName);
        return result.decoded.obj['owner'] as Address;
    } catch {
        return null;
    }
}

/**
 * Get version information
 *
 * @param packageName - The package name
 * @param version - The version string (semver)
 * @param network - Network name
 * @returns Version information or null if not found
 */
export async function getVersion(
    packageName: string,
    version: string,
    network?: NetworkName,
): Promise<VersionInfo | null> {
    const contract = getRegistryContract(network);
    const result = await contract.getVersion(packageName, version);

    const exists = result.decoded.obj['exists'] as boolean;
    if (!exists) {
        return null;
    }

    return {
        exists,
        ipfsCid: result.decoded.obj['ipfsCid'] as string,
        checksum: result.decoded.obj['checksum'] as Uint8Array,
        sigHash: result.decoded.obj['sigHash'] as Uint8Array,
        mldsaLevel: result.decoded.obj['mldsaLevel'] as number,
        opnetVersionRange: result.decoded.obj['opnetVersionRange'] as string,
        pluginType: result.decoded.obj['pluginType'] as number,
        permissionsHash: result.decoded.obj['permissionsHash'] as Uint8Array,
        depsHash: result.decoded.obj['depsHash'] as Uint8Array,
        publisher: result.decoded.obj['publisher'] as Address,
        publishedAt: result.decoded.obj['publishedAt'] as bigint,
        deprecated: result.decoded.obj['deprecated'] as boolean,
    };
}

/**
 * Check if a version is deprecated
 *
 * @param packageName - The package name
 * @param version - The version string
 * @param network - Network name
 * @returns True if deprecated
 */
export async function isVersionDeprecated(
    packageName: string,
    version: string,
    network?: NetworkName,
): Promise<boolean> {
    const contract = getRegistryContract(network);
    const result = await contract.isDeprecated(packageName, version);
    return result.decoded.obj['deprecated'] as boolean;
}

/**
 * Check if a version is immutable (past 72-hour window)
 *
 * @param packageName - The package name
 * @param version - The version string
 * @param network - Network name
 * @returns True if immutable
 */
export async function isVersionImmutable(
    packageName: string,
    version: string,
    network?: NetworkName,
): Promise<boolean> {
    const contract = getRegistryContract(network);
    const result = await contract.isImmutable(packageName, version);
    return result.decoded.obj['immutable'] as boolean;
}

/**
 * Get pending package transfer
 *
 * @param packageName - The package name
 * @param network - Network name
 * @returns Pending transfer info or null
 */
export async function getPendingTransfer(
    packageName: string,
    network?: NetworkName,
): Promise<PendingTransfer | null> {
    const contract = getRegistryContract(network);
    const result = await contract.getPendingTransfer(packageName);

    const initiatedAt = result.decoded.obj['initiatedAt'] as bigint;
    if (initiatedAt === 0n) {
        return null;
    }

    return {
        pendingOwner: result.decoded.obj['pendingOwner'] as Address,
        initiatedAt,
    };
}

/**
 * Get pending scope transfer
 *
 * @param scopeName - The scope name
 * @param network - Network name
 * @returns Pending transfer info or null
 */
export async function getPendingScopeTransfer(
    scopeName: string,
    network?: NetworkName,
): Promise<PendingTransfer | null> {
    const contract = getRegistryContract(network);
    const result = await contract.getPendingScopeTransfer(scopeName);

    const initiatedAt = result.decoded.obj['initiatedAt'] as bigint;
    if (initiatedAt === 0n) {
        return null;
    }

    return {
        pendingOwner: result.decoded.obj['pendingOwner'] as Address,
        initiatedAt,
    };
}

/**
 * Get the treasury address for payments
 *
 * @param network - Network name
 * @returns Treasury address
 */
export async function getTreasuryAddress(network?: NetworkName): Promise<string> {
    const contract = getRegistryContract(network);
    const result = await contract.getTreasuryAddress();
    return result.decoded.obj['treasuryAddress'] as string;
}

/**
 * Get the price to register a scope (in satoshis)
 *
 * @param network - Network name
 * @returns Price in satoshis
 */
export async function getScopePrice(network?: NetworkName): Promise<bigint> {
    const contract = getRegistryContract(network);
    const result = await contract.getScopePrice();
    return result.decoded.obj['priceSats'] as bigint;
}

/**
 * Get the price to register an unscoped package (in satoshis)
 *
 * @param network - Network name
 * @returns Price in satoshis
 */
export async function getPackagePrice(network?: NetworkName): Promise<bigint> {
    const contract = getRegistryContract(network);
    const result = await contract.getPackagePrice();
    return result.decoded.obj['priceSats'] as bigint;
}

/**
 * Parse a package name into scope and name components
 *
 * @param packageName - Full package name
 * @returns Object with scope (or null) and name
 */
export function parsePackageName(packageName: string): { scope: string | null; name: string } {
    if (packageName.startsWith('@')) {
        const slashIndex = packageName.indexOf('/');
        if (slashIndex === -1) {
            throw new Error(`Invalid scoped package name: ${packageName}`);
        }
        return {
            scope: packageName.substring(1, slashIndex),
            name: packageName.substring(slashIndex + 1),
        };
    }
    return { scope: null, name: packageName };
}

/**
 * Compute SHA-256 hash of permissions for storage
 *
 * @param permissions - Plugin permissions object
 * @returns 32-byte hash
 */
export function computePermissionsHash(permissions: PluginPermissions): Uint8Array {
    const json = JSON.stringify(permissions);
    const hash = crypto.createHash('sha256').update(json).digest();
    return new Uint8Array(hash);
}

/**
 * Encode dependencies for storage
 *
 * @param dependencies - Dependencies map (name -> version range)
 * @returns Encoded dependencies bytes
 */
export function encodeDependencies(dependencies: Record<string, string>): Uint8Array {
    const json = JSON.stringify(dependencies);
    return new Uint8Array(Buffer.from(json, 'utf-8'));
}

/**
 * Decode dependencies from storage
 *
 * @param data - Encoded dependencies bytes
 * @returns Dependencies map
 */
export function decodeDependencies(data: Uint8Array): Record<string, string> {
    const json = Buffer.from(data).toString('utf-8');
    return JSON.parse(json) as Record<string, string>;
}

/**
 * Convert CLI plugin type to registry constant
 *
 * @param pluginType - Plugin type string
 * @returns Registry plugin type constant
 */
export function pluginTypeToRegistry(pluginType: 'standalone' | 'library'): RegistryPluginType {
    return pluginType === 'standalone' ? 1 : 2;
}

/**
 * Convert registry plugin type to CLI string
 *
 * @param registryType - Registry plugin type constant
 * @returns Plugin type string
 */
export function registryToPluginType(registryType: number): 'standalone' | 'library' {
    return registryType === 1 ? 'standalone' : 'library';
}

/**
 * Convert CLI MLDSA level to registry constant
 *
 * @param level - CLI MLDSA level (44, 65, 87)
 * @returns Registry MLDSA level constant (1, 2, 3)
 */
export function mldsaLevelToRegistry(level: MLDSALevel): number {
    switch (level) {
        case 44:
            return 1;
        case 65:
            return 2;
        case 87:
            return 3;
    }
}

/**
 * Convert registry MLDSA level to CLI level
 *
 * @param registryLevel - Registry MLDSA level (1, 2, 3)
 * @returns CLI MLDSA level (44, 65, 87)
 */
export function registryToMldsaLevel(registryLevel: number): MLDSALevel {
    switch (registryLevel) {
        case 1:
            return 44;
        case 2:
            return 65;
        case 3:
            return 87;
        default:
            throw new Error(`Invalid registry MLDSA level: ${registryLevel}`);
    }
}
