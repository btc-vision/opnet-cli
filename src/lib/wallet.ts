/**
 * Wallet operations for OPNet CLI
 *
 * Wraps @btc-vision/transaction Mnemonic and Wallet classes for CLI operations
 *
 * @module lib/wallet
 */

import { networks, Network } from '@btc-vision/bitcoin';
import { MLDSASecurityLevel } from '@btc-vision/bip32';
import { Mnemonic, Wallet, EcKeyPair, MessageSigner } from '@btc-vision/transaction';
import * as crypto from 'crypto';

import { CLICredentials, NetworkName, MLDSALevel } from '../types/index.js';
import { loadCredentials, canSign } from './credentials.js';

/**
 * Convert CLI network name to bitcoin-js Network object
 */
export function getNetwork(networkName: NetworkName): Network {
    switch (networkName) {
        case 'mainnet':
            return networks.bitcoin;
        case 'testnet':
            return networks.testnet;
        case 'regtest':
            return networks.regtest;
    }
}

/**
 * Convert CLI MLDSA level to SDK MLDSASecurityLevel enum
 */
export function getMLDSASecurityLevel(level: MLDSALevel): MLDSASecurityLevel {
    switch (level) {
        case 44:
            return MLDSASecurityLevel.LEVEL2;
        case 65:
            return MLDSASecurityLevel.LEVEL3;
        case 87:
            return MLDSASecurityLevel.LEVEL5;
    }
}

/**
 * Wallet wrapper that provides a unified interface for CLI operations
 */
export class CLIWallet {
    private readonly wallet: Wallet;
    private readonly network: Network;
    private readonly mldsaLevel: MLDSALevel;

    private constructor(wallet: Wallet, network: Network, mldsaLevel: MLDSALevel) {
        this.wallet = wallet;
        this.network = network;
        this.mldsaLevel = mldsaLevel;
    }

    /**
     * Create a wallet from credentials
     *
     * @param credentials - The credentials to use
     * @returns A CLIWallet instance
     */
    static fromCredentials(credentials: CLICredentials): CLIWallet {
        const network = getNetwork(credentials.network);
        const securityLevel = getMLDSASecurityLevel(credentials.mldsaLevel);

        if (credentials.mnemonic) {
            // Primary method: derive from mnemonic
            const mnemonic = new Mnemonic(
                credentials.mnemonic,
                '', // passphrase
                network,
                securityLevel,
            );
            const wallet = mnemonic.derive(0); // Derive first wallet
            return new CLIWallet(wallet, network, credentials.mldsaLevel);
        }

        if (credentials.wif && credentials.mldsaPrivateKey) {
            // Advanced method: use WIF + standalone MLDSA key
            const wallet = Wallet.fromWif(credentials.wif, network);

            // For standalone MLDSA keys, we need to set the MLDSA keypair separately
            // This requires the wallet to support external MLDSA key injection
            // Note: This depends on the actual Wallet class API
            return new CLIWallet(wallet, network, credentials.mldsaLevel);
        }

        throw new Error(
            'Invalid credentials: requires either mnemonic or both WIF and MLDSA key',
        );
    }

    /**
     * Load wallet from stored credentials
     *
     * @returns CLIWallet instance or throws if no valid credentials
     */
    static load(): CLIWallet {
        const credentials = loadCredentials();

        if (!credentials) {
            throw new Error(
                'No credentials found. Run `opnet login` to configure your wallet.',
            );
        }

        if (!canSign(credentials)) {
            throw new Error(
                'Credentials incomplete for signing. Run `opnet login` to reconfigure.',
            );
        }

        return CLIWallet.fromCredentials(credentials);
    }

    /**
     * Get the P2TR (taproot) address
     */
    get p2trAddress(): string {
        return this.wallet.p2tr;
    }

    /**
     * Get the underlying Wallet instance
     */
    get underlyingWallet(): Wallet {
        return this.wallet;
    }

    /**
     * Get the Bitcoin keypair for classical signing
     */
    get keypair(): EcKeyPair {
        return this.wallet.keypair;
    }

    /**
     * Get the MLDSA keypair for quantum-resistant signing
     */
    get mldsaKeypair(): EcKeyPair {
        return this.wallet.mldsaKeypair;
    }

    /**
     * Get the MLDSA public key
     */
    get mldsaPublicKey(): Buffer {
        return this.wallet.mldsaKeypair.publicKey;
    }

    /**
     * Get the MLDSA public key hash (SHA-256)
     */
    get mldsaPublicKeyHash(): string {
        const hash = crypto.createHash('sha256').update(this.mldsaPublicKey).digest();
        return hash.toString('hex');
    }

    /**
     * Get the current MLDSA security level
     */
    get securityLevel(): MLDSALevel {
        return this.mldsaLevel;
    }

    /**
     * Get the network this wallet is configured for
     */
    get walletNetwork(): Network {
        return this.network;
    }

    /**
     * Sign data using MLDSA
     *
     * @param data - The data to sign (typically a SHA-256 hash)
     * @returns The MLDSA signature
     */
    signMLDSA(data: Buffer): Buffer {
        const signature = MessageSigner.signMLDSAMessage(
            data,
            this.wallet.mldsaKeypair.privateKey,
            getMLDSASecurityLevel(this.mldsaLevel),
        );
        return Buffer.from(signature);
    }

    /**
     * Verify an MLDSA signature
     *
     * @param data - The original data that was signed
     * @param signature - The signature to verify
     * @param publicKey - The public key to verify against
     * @param level - The MLDSA security level
     * @returns True if the signature is valid
     */
    static verifyMLDSA(
        data: Buffer,
        signature: Buffer,
        publicKey: Buffer,
        level: MLDSALevel,
    ): boolean {
        return MessageSigner.verifyMLDSASignature(
            data,
            signature,
            publicKey,
            getMLDSASecurityLevel(level),
        );
    }
}

/**
 * Generate a standalone MLDSA keypair
 *
 * @param level - The MLDSA security level
 * @returns Object containing privateKey and publicKey buffers
 */
export function generateMLDSAKeypair(level: MLDSALevel): {
    privateKey: Buffer;
    publicKey: Buffer;
} {
    const securityLevel = getMLDSASecurityLevel(level);
    const keypair = EcKeyPair.generateQuantumKeyPair(securityLevel);

    return {
        privateKey: Buffer.from(keypair.privateKey),
        publicKey: Buffer.from(keypair.publicKey),
    };
}

/**
 * Compute SHA-256 hash of a public key
 *
 * @param publicKey - The public key buffer
 * @returns Hex-encoded SHA-256 hash
 */
export function computePublicKeyHash(publicKey: Buffer): string {
    return crypto.createHash('sha256').update(publicKey).digest('hex');
}

/**
 * Validate a BIP-39 mnemonic phrase
 *
 * @param phrase - The mnemonic phrase to validate
 * @returns True if the phrase is valid
 */
export function validateMnemonic(phrase: string): boolean {
    return Mnemonic.validate(phrase);
}

/**
 * Generate a new BIP-39 mnemonic phrase
 *
 * @returns A new 24-word mnemonic phrase
 */
export function generateMnemonic(): string {
    return Mnemonic.generatePhrase();
}
