/**
 * OPNet CLI Type Definitions
 *
 * CLI-specific types only. Use @btc-vision/plugin-sdk directly for plugin types.
 *
 * @module types
 */

import { MLDSA_PUBLIC_KEY_SIZES, MLDSA_SIGNATURE_SIZES, MLDSALevel } from '@btc-vision/plugin-sdk';

/**
 * Network name type
 */
export type NetworkName = 'mainnet' | 'testnet' | 'regtest';

/**
 * CLI MLDSA level type (44, 65, 87) - user-facing values
 */
export type CLIMldsaLevel = 44 | 65 | 87;

/**
 * CLI Configuration stored in ~/.opnet/config.json
 */
export interface CLIConfig {
    /** Default network: mainnet, testnet, or regtest */
    defaultNetwork: NetworkName;
    /** RPC URLs for each network */
    rpcUrls: Record<NetworkName, string>;
    /** Default IPFS gateway for downloads */
    ipfsGateway: string;
    /** Fallback IPFS gateways */
    ipfsGateways: string[];
    /** IPFS pinning service endpoint */
    ipfsPinningEndpoint: string;
    /** IPFS pinning API key (or JWT token) */
    ipfsPinningApiKey: string;
    /** IPFS pinning API secret (for services requiring key+secret) */
    ipfsPinningSecret: string;
    /** Authorization header name for pinning service */
    ipfsPinningAuthHeader: string;
    /** Registry contract addresses per network */
    registryAddresses: Record<NetworkName, string>;
    /** BTC Resolver contract addresses per network */
    resolverAddresses?: Record<NetworkName, string>;
    /** Default MLDSA security level (44, 65, or 87) */
    defaultMldsaLevel: CLIMldsaLevel;
    /** Indexer API URL for search */
    indexerUrl: string;
}

/**
 * Credentials stored in ~/.opnet/credentials.json
 */
export interface CLICredentials {
    /** BIP-39 mnemonic phrase (primary method) */
    mnemonic?: string;
    /** Bitcoin private key in WIF format (advanced) */
    wif?: string;
    /** Standalone MLDSA private key hex (advanced) */
    mldsaPrivateKey?: string;
    /** MLDSA security level used for derivation */
    mldsaLevel: CLIMldsaLevel;
    /** Network the credentials are configured for */
    network: NetworkName;
}

/**
 * Plugin types for registry
 */
export type RegistryPluginType = 'standalone' | 'library';

/**
 * Convert CLI level (44, 65, 87) to MLDSALevel enum (0, 1, 2)
 */
export function cliLevelToMLDSALevel(level: CLIMldsaLevel): MLDSALevel {
    switch (level) {
        case 44:
            return MLDSALevel.MLDSA44;
        case 65:
            return MLDSALevel.MLDSA65;
        case 87:
            return MLDSALevel.MLDSA87;
    }
}

/**
 * Convert MLDSALevel enum (0, 1, 2) to CLI level (44, 65, 87)
 */
export function mldsaLevelToCLI(level: MLDSALevel): CLIMldsaLevel {
    switch (level) {
        case MLDSALevel.MLDSA44:
            return 44;
        case MLDSALevel.MLDSA65:
            return 65;
        case MLDSALevel.MLDSA87:
            return 87;
    }
}

/**
 * Convert registry MLDSA level (1,2,3) to CLI level (44,65,87)
 */
export function registryLevelToCLI(level: number): CLIMldsaLevel {
    switch (level) {
        case 1:
            return 44;
        case 2:
            return 65;
        case 3:
            return 87;
        default:
            throw new Error(`Invalid registry MLDSA level: ${level}`);
    }
}

/**
 * Convert CLI MLDSA level (44,65,87) to registry level (1,2,3)
 */
export function cliLevelToRegistry(level: CLIMldsaLevel): number {
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
 * Get public key size for CLI MLDSA level
 */
export function getPublicKeySize(level: CLIMldsaLevel): number {
    return MLDSA_PUBLIC_KEY_SIZES[cliLevelToMLDSALevel(level)];
}

/**
 * Get signature size for CLI MLDSA level
 */
export function getSignatureSize(level: CLIMldsaLevel): number {
    return MLDSA_SIGNATURE_SIZES[cliLevelToMLDSALevel(level)];
}

/**
 * Check if a number is a valid CLI MLDSA level
 */
export function isValidCLIMldsaLevel(level: number): level is CLIMldsaLevel {
    return level === 44 || level === 65 || level === 87;
}
