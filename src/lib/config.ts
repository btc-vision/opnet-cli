/**
 * Configuration management for OPNet CLI
 *
 * Manages CLI configuration stored in ~/.opnet/config.json
 *
 * @module lib/config
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLIConfig, NetworkName, MLDSALevel } from '../types/index.js';

/** Default configuration directory */
const CONFIG_DIR = path.join(os.homedir(), '.opnet');
/** Configuration file path */
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Default CLI configuration
 */
const DEFAULT_CONFIG: CLIConfig = {
    defaultNetwork: 'regtest',
    rpcUrls: {
        mainnet: 'https://api.opnet.org',
        testnet: 'https://testnet.opnet.org',
        regtest: 'https://regtest.opnet.org',
    },
    ipfsGateway: 'https://ipfs.opnet.org/ipfs/',
    ipfsGateways: [
        'https://ipfs.opnet.org/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://cloudflare-ipfs.com/ipfs/',
        'https://dweb.link/ipfs/',
    ],
    ipfsPinningEndpoint: 'https://ipfs.opnet.org/api/v0/add',
    ipfsPinningApiKey: '',
    ipfsPinningAuthHeader: 'Authorization',
    registryAddresses: {
        mainnet: '', // TODO: Set once deployed
        testnet: '', // TODO: Set once deployed
        regtest: '', // TODO: Set once deployed
    },
    defaultMldsaLevel: 44,
    indexerUrl: 'https://indexer.opnet.org',
};

/**
 * Environment variable overrides
 */
function getEnvOverrides(): Partial<CLIConfig> {
    const overrides: Partial<CLIConfig> = {};

    if (process.env.OPNET_NETWORK) {
        const network = process.env.OPNET_NETWORK as NetworkName;
        if (['mainnet', 'testnet', 'regtest'].includes(network)) {
            overrides.defaultNetwork = network;
        }
    }

    if (process.env.OPNET_RPC_URL) {
        // Override the current network's RPC URL
        const config = loadConfig();
        overrides.rpcUrls = {
            ...config.rpcUrls,
            [config.defaultNetwork]: process.env.OPNET_RPC_URL,
        };
    }

    if (process.env.OPNET_IPFS_GATEWAY) {
        overrides.ipfsGateway = process.env.OPNET_IPFS_GATEWAY;
    }

    if (process.env.OPNET_IPFS_PINNING_ENDPOINT) {
        overrides.ipfsPinningEndpoint = process.env.OPNET_IPFS_PINNING_ENDPOINT;
    }

    if (process.env.OPNET_IPFS_PINNING_KEY) {
        overrides.ipfsPinningApiKey = process.env.OPNET_IPFS_PINNING_KEY;
    }

    if (process.env.OPNET_REGISTRY_ADDRESS) {
        const config = loadConfig();
        overrides.registryAddresses = {
            ...config.registryAddresses,
            [config.defaultNetwork]: process.env.OPNET_REGISTRY_ADDRESS,
        };
    }

    if (process.env.OPNET_INDEXER_URL) {
        overrides.indexerUrl = process.env.OPNET_INDEXER_URL;
    }

    return overrides;
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
    if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true, mode: 0o700 });
    }
}

/**
 * Load configuration from file
 *
 * @returns The CLI configuration with defaults and environment overrides applied
 */
export function loadConfig(): CLIConfig {
    ensureConfigDir();

    let fileConfig: Partial<CLIConfig> = {};

    if (fs.existsSync(CONFIG_FILE)) {
        try {
            const content = fs.readFileSync(CONFIG_FILE, 'utf-8');
            fileConfig = JSON.parse(content) as Partial<CLIConfig>;
        } catch {
            // Ignore parse errors, use defaults
        }
    }

    // Merge: defaults < file config < env overrides
    const envOverrides = getEnvOverrides();

    return {
        ...DEFAULT_CONFIG,
        ...fileConfig,
        ...envOverrides,
        rpcUrls: {
            ...DEFAULT_CONFIG.rpcUrls,
            ...fileConfig.rpcUrls,
            ...envOverrides.rpcUrls,
        },
        ipfsGateways: fileConfig.ipfsGateways || DEFAULT_CONFIG.ipfsGateways,
        registryAddresses: {
            ...DEFAULT_CONFIG.registryAddresses,
            ...fileConfig.registryAddresses,
            ...envOverrides.registryAddresses,
        },
    };
}

/**
 * Save configuration to file
 *
 * @param config - The configuration to save
 */
export function saveConfig(config: CLIConfig): void {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 4), { mode: 0o600 });
}

/**
 * Get a specific configuration value
 *
 * @param key - The configuration key (dot notation supported)
 * @returns The configuration value or undefined
 */
export function getConfigValue(key: string): unknown {
    const config = loadConfig();
    const keys = key.split('.');
    let value: unknown = config;

    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = (value as Record<string, unknown>)[k];
        } else {
            return undefined;
        }
    }

    return value;
}

/**
 * Set a specific configuration value
 *
 * @param key - The configuration key (dot notation supported)
 * @param value - The value to set
 */
export function setConfigValue(key: string, value: unknown): void {
    const config = loadConfig();
    const keys = key.split('.');
    let target: Record<string, unknown> = config as unknown as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (!(k in target) || typeof target[k] !== 'object') {
            target[k] = {};
        }
        target = target[k] as Record<string, unknown>;
    }

    const finalKey = keys[keys.length - 1];
    target[finalKey] = value;

    saveConfig(config);
}

/**
 * Get the RPC URL for a specific network
 *
 * @param network - The network name (defaults to configured default)
 * @returns The RPC URL
 */
export function getRpcUrl(network?: NetworkName): string {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    return config.rpcUrls[targetNetwork] || config.rpcUrls.mainnet;
}

/**
 * Get the registry address for a specific network
 *
 * @param network - The network name (defaults to configured default)
 * @returns The registry contract address
 */
export function getRegistryAddress(network?: NetworkName): string {
    const config = loadConfig();
    const targetNetwork = network || config.defaultNetwork;
    const address = config.registryAddresses[targetNetwork];

    if (!address) {
        throw new Error(
            `Registry address not configured for network: ${targetNetwork}\n` +
                `Run: opnet config set registryAddresses.${targetNetwork} <address>`,
        );
    }

    return address;
}

/**
 * Get the default MLDSA level
 *
 * @returns The default MLDSA security level
 */
export function getDefaultMldsaLevel(): MLDSALevel {
    const config = loadConfig();
    return config.defaultMldsaLevel;
}

/**
 * Get the default network
 *
 * @returns The default network name
 */
export function getDefaultNetwork(): NetworkName {
    const config = loadConfig();
    return config.defaultNetwork;
}

/**
 * Display current configuration
 *
 * @returns Formatted configuration string
 */
export function displayConfig(): string {
    const config = loadConfig();
    return JSON.stringify(config, null, 2);
}
