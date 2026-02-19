/**
 * Credentials management for OPNet CLI
 *
 * Manages wallet credentials stored in ~/.opnet/credentials.json
 *
 * @module lib/credentials
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLICredentials, CLIMldsaLevel, NetworkName } from '../types/index.js';
import { ensureConfigDir } from './config.js';

/** Credentials file path */
const CREDENTIALS_FILE = path.join(os.homedir(), '.opnet', 'credentials.json');

/**
 * Load credentials from file
 *
 * @returns The stored credentials or null if not found
 */
const VALID_MLDSA_LEVELS: readonly CLIMldsaLevel[] = [44, 65, 87] as const;

/**
 * Parse and validate MLDSA level from environment variable.
 */
function parseEnvMldsaLevel(): CLIMldsaLevel {
    const raw = process.env.OPNET_MLDSA_LEVEL;
    if (!raw) return 44;
    const parsed = parseInt(raw, 10);
    if (!VALID_MLDSA_LEVELS.includes(parsed as CLIMldsaLevel)) {
        throw new Error(
            `Invalid OPNET_MLDSA_LEVEL="${raw}". Must be one of: ${VALID_MLDSA_LEVELS.join(', ')}`,
        );
    }
    return parsed as CLIMldsaLevel;
}

export function loadCredentials(): CLICredentials | null {
    // Check for environment variable overrides first
    if (process.env.OPNET_MNEMONIC) {
        return {
            mnemonic: process.env.OPNET_MNEMONIC,
            mldsaLevel: parseEnvMldsaLevel(),
            network: (process.env.OPNET_NETWORK as NetworkName) || 'mainnet',
        };
    }

    if (process.env.OPNET_PRIVATE_KEY || process.env.OPNET_MLDSA_KEY) {
        return {
            wif: process.env.OPNET_PRIVATE_KEY,
            mldsaPrivateKey: process.env.OPNET_MLDSA_KEY,
            mldsaLevel: parseEnvMldsaLevel(),
            network: (process.env.OPNET_NETWORK as NetworkName) || 'mainnet',
        };
    }

    // Load from file
    if (!fs.existsSync(CREDENTIALS_FILE)) {
        return null;
    }

    // Check file permissions (warn if too open)
    try {
        const stat = fs.statSync(CREDENTIALS_FILE);
        const mode = stat.mode & 0o777;
        if (mode !== 0o600 && mode !== 0o400) {
            process.stderr.write(
                `WARNING: Credentials file ${CREDENTIALS_FILE} has permissions ${mode.toString(8)}. Expected 600 or 400.\n` +
                    `Run: chmod 600 ${CREDENTIALS_FILE}\n`,
            );
        }
    } catch {
        // Ignore stat errors, proceed with read
    }

    try {
        const content = fs.readFileSync(CREDENTIALS_FILE, 'utf-8');
        return JSON.parse(content) as CLICredentials;
    } catch (error) {
        process.stderr.write(
            `WARNING: Failed to parse credentials file: ${error instanceof Error ? error.message : String(error)}\n`,
        );
        return null;
    }
}

/**
 * Save credentials to file with secure permissions
 *
 * @param credentials - The credentials to save
 */
export function saveCredentials(credentials: CLICredentials): void {
    ensureConfigDir();

    // Write with restricted permissions (owner read/write only)
    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(credentials, null, 4), {
        mode: 0o600,
    });
}

/**
 * Delete stored credentials
 *
 * @returns True if credentials were deleted, false if not found
 */
export function deleteCredentials(): boolean {
    if (fs.existsSync(CREDENTIALS_FILE)) {
        fs.unlinkSync(CREDENTIALS_FILE);
        return true;
    }
    return false;
}

/**
 * Check if credentials exist
 *
 * @returns True if credentials are available (file or env)
 */
export function hasCredentials(): boolean {
    // Check environment variables
    if (
        process.env.OPNET_MNEMONIC ||
        process.env.OPNET_PRIVATE_KEY ||
        process.env.OPNET_MLDSA_KEY
    ) {
        return true;
    }

    return fs.existsSync(CREDENTIALS_FILE);
}

/**
 * Validate that credentials are sufficient for signing
 *
 * @param credentials - The credentials to validate
 * @returns True if credentials can be used for signing
 */
export function canSign(credentials: CLICredentials | null): boolean {
    if (!credentials) {
        return false;
    }

    // Mnemonic provides both classical and quantum keys
    if (credentials.mnemonic) {
        return true;
    }

    // WIF + MLDSA key for advanced users
    if (credentials.wif && credentials.mldsaPrivateKey) {
        return true;
    }

    return false;
}

/**
 * Get a user-friendly description of the credential source
 *
 * @returns Description of where credentials are loaded from
 */
export function getCredentialSource(): string {
    if (process.env.OPNET_MNEMONIC) {
        return 'environment (OPNET_MNEMONIC)';
    }
    if (process.env.OPNET_PRIVATE_KEY || process.env.OPNET_MLDSA_KEY) {
        return 'environment (OPNET_PRIVATE_KEY/OPNET_MLDSA_KEY)';
    }
    if (fs.existsSync(CREDENTIALS_FILE)) {
        return CREDENTIALS_FILE;
    }
    return 'none';
}

/**
 * Mask sensitive data for display
 *
 * @param value - The value to mask
 * @param showChars - Number of characters to show at start and end
 * @returns Masked string
 */
export function maskSensitive(value: string, showChars: number = 4): string {
    if (value.length <= showChars * 2) {
        return '*'.repeat(value.length);
    }
    return value.slice(0, showChars) + '...' + value.slice(-showChars);
}

/**
 * Validate MLDSA level
 *
 * @param level - The level to validate
 * @returns True if valid MLDSA level
 */
export function isValidMldsaLevel(level: number): level is CLIMldsaLevel {
    return level === 44 || level === 65 || level === 87;
}

/**
 * Validate network name
 *
 * @param network - The network name to validate
 * @returns True if valid network name
 */
export function isValidNetwork(network: string): network is NetworkName {
    return network === 'mainnet' || network === 'testnet' || network === 'regtest';
}
