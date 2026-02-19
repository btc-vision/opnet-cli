/**
 * Whoami command - Display current identity
 *
 * @module commands/WhoamiCommand
 */

import { BaseCommand } from './BaseCommand.js';
import {
    getCredentialSource,
    hasCredentials,
    loadCredentials,
    maskSensitive,
} from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import { toHex } from '../lib/binary.js';

interface WhoamiOptions {
    verbose?: boolean;
    publicKey?: boolean;
}

export class WhoamiCommand extends BaseCommand {
    constructor() {
        super('whoami', 'Display current wallet identity and configuration');
    }

    protected configure(): void {
        this.command
            .option('-v, --verbose', 'Show detailed information')
            .option('--public-key', 'Show full MLDSA public key')
            .action((options: WhoamiOptions) => this.execute(options));
    }

    private execute(options: WhoamiOptions): void {
        try {
            if (!hasCredentials()) {
                this.logger.warn('Not logged in.');
                this.logger.info('Run `opnet login` to configure your wallet.');
                return;
            }

            const credentials = loadCredentials();
            if (!credentials) {
                this.logger.warn('No credentials found.');
                return;
            }

            const source = getCredentialSource();

            this.logger.info('\nOPNet Identity\n');
            this.logger.log('─'.repeat(50));

            this.logger.log(`Network:        ${credentials.network}`);
            this.logger.log(`MLDSA Level:    ${credentials.mldsaLevel}`);
            this.logger.log(`Auth Source:    ${source}`);

            try {
                const wallet = CLIWallet.fromCredentials(credentials);

                this.logger.log('');
                this.logger.log(`P2TR Address:   ${wallet.p2trAddress}`);
                this.logger.log(`MLDSA PubKey Hash: ${wallet.mldsaPublicKeyHash}`);

                if (options.publicKey) {
                    this.logger.log('');
                    this.logger.log('MLDSA Public Key:');
                    this.logger.log(toHex(wallet.mldsaPublicKey));
                }

                if (options.verbose) {
                    this.logger.log('');
                    this.logger.log('─'.repeat(50));
                    this.logger.log('Details:');
                    this.logger.log(`  Security Level: MLDSA-${credentials.mldsaLevel}`);
                    this.logger.log(`  Public Key Size: ${wallet.mldsaPublicKey.length} bytes`);

                    if (credentials.mnemonic) {
                        this.logger.log('  Auth Method: BIP-39 Mnemonic');
                        this.logger.log(`  Mnemonic: ${maskSensitive(credentials.mnemonic, 8)}`);
                    } else {
                        this.logger.log('  Auth Method: WIF + MLDSA Keys');
                        if (credentials.wif) {
                            this.logger.log(`  WIF: ${maskSensitive(credentials.wif, 4)}`);
                        }
                    }
                }
            } catch (error) {
                this.logger.log('');
                this.logger.warn('Could not load wallet details.');
                if (options.verbose) {
                    this.logger.debug(`  Error: ${this.formatError(error)}`);
                }

                this.logger.log('');
                if (credentials.mnemonic) {
                    this.logger.log(`Auth Method:    BIP-39 Mnemonic`);
                    if (options.verbose) {
                        this.logger.log(
                            `Mnemonic:       ${maskSensitive(credentials.mnemonic, 8)}`,
                        );
                    }
                } else {
                    this.logger.log(`Auth Method:    WIF + MLDSA Keys`);
                }
            }

            this.logger.log('');
        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }
}

export const whoamiCommand = new WhoamiCommand().getCommand();
