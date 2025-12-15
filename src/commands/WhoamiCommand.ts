/**
 * Whoami command - Display current identity
 *
 * @module commands/WhoamiCommand
 */

import { BaseCommand } from './BaseCommand.js';
import {
    loadCredentials,
    hasCredentials,
    getCredentialSource,
    maskSensitive,
} from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';

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
            console.log('─'.repeat(50));

            console.log(`Network:        ${credentials.network}`);
            console.log(`MLDSA Level:    ${credentials.mldsaLevel}`);
            console.log(`Auth Source:    ${source}`);

            try {
                const wallet = CLIWallet.fromCredentials(credentials);

                console.log('');
                console.log(`P2TR Address:   ${wallet.p2trAddress}`);
                console.log(`MLDSA PubKey Hash: ${wallet.mldsaPublicKeyHash}`);

                if (options.publicKey) {
                    console.log('');
                    console.log('MLDSA Public Key:');
                    console.log(wallet.mldsaPublicKey.toString('hex'));
                }

                if (options.verbose) {
                    console.log('');
                    console.log('─'.repeat(50));
                    console.log('Details:');
                    console.log(`  Security Level: MLDSA-${credentials.mldsaLevel}`);
                    console.log(`  Public Key Size: ${wallet.mldsaPublicKey.length} bytes`);

                    if (credentials.mnemonic) {
                        console.log('  Auth Method: BIP-39 Mnemonic');
                        console.log(`  Mnemonic: ${maskSensitive(credentials.mnemonic, 8)}`);
                    } else {
                        console.log('  Auth Method: WIF + MLDSA Keys');
                        if (credentials.wif) {
                            console.log(`  WIF: ${maskSensitive(credentials.wif, 4)}`);
                        }
                    }
                }

            } catch (error) {
                console.log('');
                this.logger.warn('Could not load wallet details.');
                if (options.verbose) {
                    this.logger.debug(`  Error: ${this.formatError(error)}`);
                }

                console.log('');
                if (credentials.mnemonic) {
                    console.log(`Auth Method:    BIP-39 Mnemonic`);
                    if (options.verbose) {
                        console.log(`Mnemonic:       ${maskSensitive(credentials.mnemonic, 8)}`);
                    }
                } else {
                    console.log(`Auth Method:    WIF + MLDSA Keys`);
                }
            }

            console.log('');

        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }
}

export const whoamiCommand = new WhoamiCommand().getCommand();
