/**
 * Package Registry contract interactions for OPNet CLI
 *
 * Provides functions for interacting with the on-chain PackageRegistry contract.
 *
 * @module lib/registry
 */

import { getContract, BitcoinInterfaceAbi } from 'opnet';
import { Address } from '@btc-vision/transaction';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import { NetworkName, MLDSALevel, PluginPermissions, RegistryPluginType } from '../types/index.js';
import { IPackageRegistry } from '../types/PackageRegistry.js';
import { getProvider, getRegistryContractAddress } from './provider.js';
import { getNetwork } from './wallet.js';
import { loadConfig } from './config.js';

// Load ABI from JSON file and convert to flat array format
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const abiPath = path.join(__dirname, 'PackageRegistry.abi.json');
interface RawAbiJson {
    functions: Array<{
        name: string;
        type: string;
        inputs: Array<{ name: string; type: string }>;
        outputs: Array<{ name: string; type: string }>;
    }>;
    events: Array<{
        name: string;
        type: string;
        values: Array<{ name: string; type: string }>;
    }>;
}
const rawAbi = JSON.parse(fs.readFileSync(abiPath, 'utf-8')) as RawAbiJson;
// Flatten functions and events into a single array for BitcoinInterfaceAbi
const REGISTRY_ABI = [...rawAbi.functions, ...rawAbi.events] as unknown as BitcoinInterfaceAbi;

/**
 * Scope information
 */
export interface ScopeInfo {
    exists: boolean;
    owner: Address;
    createdAt: bigint;
}

/**
 * Package information
 */
export interface PackageInfo {
    exists: boolean;
    owner: Address;
    createdAt: bigint;
    versionCount: bigint;
    latestVersion: string;
}

/**
 * Version information
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
export interface PendingTransferInfo {
    pendingOwner: Address;
    initiatedAt: bigint;
}

/**
 * Registry contract cache
 */
const registryCache = new Map<string, IPackageRegistry>();

/**
 * Get the registry contract instance
 *
 * @param network - Network name (defaults to configured default)
 * @returns Contract instance
 */
export function getRegistryContract(network?: NetworkName): IPackageRegistry {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const cacheKey = targetNetwork;

    const cached = registryCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const provider = getProvider(targetNetwork);
    const registryAddress = getRegistryContractAddress(targetNetwork);
    const bitcoinNetwork = getNetwork(targetNetwork);

    const contract = getContract<IPackageRegistry>(
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

    if (!result.properties.exists) {
        return null;
    }

    return {
        exists: result.properties.exists,
        owner: result.properties.owner,
        createdAt: result.properties.createdAt,
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
        return result.properties.owner;
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

    if (!result.properties.exists) {
        return null;
    }

    return {
        exists: result.properties.exists,
        owner: result.properties.owner,
        createdAt: result.properties.createdAt,
        versionCount: result.properties.versionCount,
        latestVersion: result.properties.latestVersion,
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
        return result.properties.owner;
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

    if (!result.properties.exists) {
        return null;
    }

    return {
        exists: result.properties.exists,
        ipfsCid: result.properties.ipfsCid,
        checksum: result.properties.checksum,
        sigHash: result.properties.sigHash,
        mldsaLevel: result.properties.mldsaLevel,
        opnetVersionRange: result.properties.opnetVersionRange,
        pluginType: result.properties.pluginType,
        permissionsHash: result.properties.permissionsHash,
        depsHash: result.properties.depsHash,
        publisher: result.properties.publisher,
        publishedAt: result.properties.publishedAt,
        deprecated: result.properties.deprecated,
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
    return result.properties.deprecated;
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
    return result.properties.immutable;
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
): Promise<PendingTransferInfo | null> {
    const contract = getRegistryContract(network);
    try {
        const result = await contract.getPendingTransfer(packageName);
        const pendingOwner = result.properties.pendingOwner;

        // Check if there's actually a pending transfer (address not zero)
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
 * Get pending scope transfer
 *
 * @param scopeName - The scope name
 * @param network - Network name
 * @returns Pending transfer info or null
 */
export async function getPendingScopeTransfer(
    scopeName: string,
    network?: NetworkName,
): Promise<PendingTransferInfo | null> {
    const contract = getRegistryContract(network);
    try {
        const result = await contract.getPendingScopeTransfer(scopeName);
        const pendingOwner = result.properties.pendingOwner;

        // Check if there's actually a pending transfer (address not zero)
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
    const contract = getRegistryContract(network);
    const result = await contract.getTreasuryAddress();
    return result.properties.treasuryAddress;
}

/**
 * Get scope registration price
 *
 * @param network - Network name
 * @returns Price in satoshis
 */
export async function getScopePrice(network?: NetworkName): Promise<bigint> {
    const contract = getRegistryContract(network);
    const result = await contract.getScopePrice();
    return result.properties.priceSats;
}

/**
 * Get package registration price
 *
 * @param network - Network name
 * @returns Price in satoshis
 */
export async function getPackagePrice(network?: NetworkName): Promise<bigint> {
    const contract = getRegistryContract(network);
    const result = await contract.getPackagePrice();
    return result.properties.priceSats;
}

/**
 * Parse a package name into scope and name
 *
 * @param fullName - Full package name (e.g., "@scope/name" or "name")
 * @returns Object with scope (or null) and name
 */
export function parsePackageName(fullName: string): { scope: string | null; name: string } {
    if (fullName.startsWith('@')) {
        const slashIndex = fullName.indexOf('/');
        if (slashIndex > 0) {
            return {
                scope: fullName.substring(1, slashIndex),
                name: fullName.substring(slashIndex + 1),
            };
        }
    }
    return { scope: null, name: fullName };
}

/**
 * Compute permissions hash from permissions object
 *
 * @param permissions - Plugin permissions
 * @returns SHA-256 hash as Uint8Array
 */
export function computePermissionsHash(permissions: PluginPermissions): Uint8Array {
    const json = JSON.stringify(permissions);
    const hash = crypto.createHash('sha256').update(json).digest();
    return new Uint8Array(hash);
}

/**
 * Encode dependencies for publishing
 *
 * @param dependencies - Dependencies map { name: version }
 * @returns Encoded dependencies as Uint8Array
 */
export function encodeDependencies(dependencies: Record<string, string>): Uint8Array {
    if (Object.keys(dependencies).length === 0) {
        return new Uint8Array(0);
    }

    const json = JSON.stringify(dependencies);
    return new Uint8Array(Buffer.from(json, 'utf-8'));
}

/**
 * Convert registry MLDSA level (1, 2, 3) to actual level (44, 65, 87)
 *
 * @param registryLevel - Registry level (1, 2, 3)
 * @returns MLDSA level (44, 65, 87)
 */
export function registryToMldsaLevel(registryLevel: number): MLDSALevel {
    const levels: Record<number, MLDSALevel> = {
        1: 44,
        2: 65,
        3: 87,
    };
    return levels[registryLevel] || 44;
}

/**
 * Convert MLDSA level (44, 65, 87) to registry level (1, 2, 3)
 *
 * @param mldsaLevel - MLDSA level (44, 65, 87)
 * @returns Registry level (1, 2, 3)
 */
export function mldsaLevelToRegistry(mldsaLevel: MLDSALevel): number {
    const levels: Record<MLDSALevel, number> = {
        44: 1,
        65: 2,
        87: 3,
    };
    return levels[mldsaLevel] || 1;
}

/**
 * Convert registry plugin type (1, 2) to string
 *
 * @param registryType - Registry plugin type (1, 2)
 * @returns Plugin type string
 */
export function registryToPluginType(registryType: number): RegistryPluginType {
    return registryType === 2 ? 'library' : 'standalone';
}

/**
 * Convert plugin type string to registry value
 *
 * @param pluginType - Plugin type string
 * @returns Registry plugin type (1, 2)
 */
export function pluginTypeToRegistry(pluginType: RegistryPluginType): number {
    return pluginType === 'library' ? 2 : 1;
}
