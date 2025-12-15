/**
 * OPNet CLI Type Definitions
 *
 * @module types
 */

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
    /** IPFS pinning API key */
    ipfsPinningApiKey: string;
    /** Authorization header name for pinning service */
    ipfsPinningAuthHeader: string;
    /** Registry contract addresses per network */
    registryAddresses: Record<NetworkName, string>;
    /** Default MLDSA security level (44, 65, or 87) */
    defaultMldsaLevel: MLDSALevel;
    /** Indexer API URL for search */
    indexerUrl: string;
}

/**
 * Network name type
 */
export type NetworkName = 'mainnet' | 'testnet' | 'regtest';

/**
 * MLDSA security levels
 * - 44: MLDSA44 (NIST Level 2)
 * - 65: MLDSA65 (NIST Level 3)
 * - 87: MLDSA87 (NIST Level 5)
 */
export type MLDSALevel = 44 | 65 | 87;

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
    mldsaLevel: MLDSALevel;
    /** Network the credentials are configured for */
    network: NetworkName;
}

/**
 * Plugin types as defined in OIP-0003
 */
export enum PluginType {
    /** Standalone plugin that runs independently */
    STANDALONE = 1,
    /** Library plugin providing shared functionality */
    LIBRARY = 2,
}

/**
 * Registry plugin type string
 */
export type RegistryPluginType = 'standalone' | 'library';

/**
 * .opnet binary format constants
 */
export const OPNET_BINARY = {
    /** Magic bytes: "OPNETPLG" */
    MAGIC: Buffer.from([0x4f, 0x50, 0x4e, 0x45, 0x54, 0x50, 0x4c, 0x47]),
    /** Current format version */
    FORMAT_VERSION: 1,
    /** MLDSA44 public key size */
    MLDSA44_PUBLIC_KEY_LEN: 1312,
    /** MLDSA65 public key size */
    MLDSA65_PUBLIC_KEY_LEN: 1952,
    /** MLDSA87 public key size */
    MLDSA87_PUBLIC_KEY_LEN: 2592,
    /** MLDSA44 signature size */
    MLDSA44_SIGNATURE_LEN: 2420,
    /** MLDSA65 signature size */
    MLDSA65_SIGNATURE_LEN: 3309,
    /** MLDSA87 signature size */
    MLDSA87_SIGNATURE_LEN: 4627,
} as const;

/**
 * MLDSA level to public key size mapping
 */
export function getPublicKeySize(level: MLDSALevel): number {
    switch (level) {
        case 44:
            return OPNET_BINARY.MLDSA44_PUBLIC_KEY_LEN;
        case 65:
            return OPNET_BINARY.MLDSA65_PUBLIC_KEY_LEN;
        case 87:
            return OPNET_BINARY.MLDSA87_PUBLIC_KEY_LEN;
    }
}

/**
 * MLDSA level to signature size mapping
 */
export function getSignatureSize(level: MLDSALevel): number {
    switch (level) {
        case 44:
            return OPNET_BINARY.MLDSA44_SIGNATURE_LEN;
        case 65:
            return OPNET_BINARY.MLDSA65_SIGNATURE_LEN;
        case 87:
            return OPNET_BINARY.MLDSA87_SIGNATURE_LEN;
    }
}

/**
 * Convert registry MLDSA level (1,2,3) to CLI level (44,65,87)
 */
export function registryLevelToCLI(level: number): MLDSALevel {
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
export function cliLevelToRegistry(level: MLDSALevel): number {
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
 * Plugin manifest (plugin.json) structure per OIP-0003
 */
export interface PluginManifest {
    /** Plugin name (lowercase, alphanumeric with hyphens) */
    name: string;
    /** Semantic version */
    version: string;
    /** OPNet version compatibility range */
    opnetVersion: string;
    /** Main entry point */
    main: string;
    /** Build target */
    target: 'bytenode';
    /** Artifact type */
    type: 'plugin';
    /** SHA-256 checksum with prefix */
    checksum?: string;
    /** Author information */
    author: {
        name: string;
        email?: string;
    };
    /** Plugin description */
    description?: string;
    /** Plugin type */
    pluginType: 'standalone' | 'library';
    /** Signature information */
    signature?: {
        algorithm: string;
        publicKeyHash: string;
    };
    /** Permissions requested */
    permissions: PluginPermissions;
    /** Resource limits */
    resources?: PluginResources;
    /** Plugin dependencies */
    dependencies?: Record<string, string>;
    /** Lifecycle configuration */
    lifecycle?: PluginLifecycle;
}

/**
 * Plugin permissions
 */
export interface PluginPermissions {
    database?: {
        enabled: boolean;
        collections: string[];
    };
    blocks?: {
        preProcess?: boolean;
        postProcess?: boolean;
        onChange?: boolean;
    };
    epochs?: {
        onChange?: boolean;
        onFinalized?: boolean;
    };
    mempool?: {
        txFeed?: boolean;
    };
    api?: {
        addEndpoints?: boolean;
        addWebsocket?: boolean;
    };
    filesystem?: {
        configDir?: boolean;
        tempDir?: boolean;
    };
}

/**
 * Plugin resource limits
 */
export interface PluginResources {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    maxStorageMB?: number;
}

/**
 * Plugin lifecycle configuration
 */
export interface PluginLifecycle {
    autoStart?: boolean;
    restartOnCrash?: boolean;
    maxRestarts?: number;
}

/**
 * Parsed .opnet binary structure
 */
export interface ParsedOpnetBinary {
    /** Format version */
    formatVersion: number;
    /** MLDSA security level (0, 1, or 2 mapping to 44, 65, 87) */
    mldsaLevel: number;
    /** Public key bytes */
    publicKey: Buffer;
    /** Signature bytes */
    signature: Buffer;
    /** Metadata JSON string */
    metadata: string;
    /** Parsed metadata object */
    metadataObj: PluginManifest;
    /** V8 bytecode */
    bytecode: Buffer;
    /** Proto bytes (optional) */
    proto: Buffer;
    /** SHA-256 checksum */
    checksum: Buffer;
}

/**
 * Version information from registry
 */
export interface VersionInfo {
    exists: boolean;
    ipfsCid: string;
    checksum: string;
    sigHash: string;
    mldsaLevel: number;
    opnetVersionRange: string;
    pluginType: number;
    permissionsHash: string;
    depsHash: string;
    publisher: string;
    publishedAt: bigint;
    deprecated: boolean;
}

/**
 * Package information from registry
 */
export interface PackageInfo {
    exists: boolean;
    owner: string;
    createdAt: bigint;
    versionCount: bigint;
    latestVersion: string;
}

/**
 * Scope information from registry
 */
export interface ScopeInfo {
    exists: boolean;
    owner: string;
    createdAt: bigint;
}
