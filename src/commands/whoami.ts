/**
 * Whoami command - Display current identity
 *
 * @module commands/whoami
 */

import { Command } from 'commander';
import chalk from 'chalk';
import {
    loadCredentials,
    hasCredentials,
    getCredentialSource,
    maskSensitive,
} from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';

export const whoamiCommand = new Command('whoami')
    .description('Display current wallet identity and configuration')
    .option('-v, --verbose', 'Show detailed information')
    .option('--public-key', 'Show full MLDSA public key')
    .action(async (options: { verbose?: boolean; publicKey?: boolean }) => {
        try {
            if (!hasCredentials()) {
                console.log(chalk.yellow('Not logged in.'));
                console.log(chalk.dim('Run `opnet login` to configure your wallet.'));
                return;
            }

            const credentials = loadCredentials();
            if (!credentials) {
                console.log(chalk.yellow('No credentials found.'));
                return;
            }

            const source = getCredentialSource();

            console.log(chalk.cyan('\nOPNet Identity\n'));
            console.log(chalk.dim('─'.repeat(50)));

            // Basic info
            console.log(`${chalk.bold('Network:')}        ${credentials.network}`);
            console.log(`${chalk.bold('MLDSA Level:')}    ${credentials.mldsaLevel}`);
            console.log(`${chalk.bold('Auth Source:')}    ${source}`);

            // Try to load wallet for addresses
            try {
                const wallet = CLIWallet.fromCredentials(credentials);

                console.log('');
                console.log(`${chalk.bold('P2TR Address:')}   ${wallet.p2trAddress}`);
                console.log(`${chalk.bold('MLDSA PubKey Hash:')} ${wallet.mldsaPublicKeyHash}`);

                if (options.publicKey) {
                    console.log('');
                    console.log(chalk.bold('MLDSA Public Key:'));
                    console.log(chalk.dim(wallet.mldsaPublicKey.toString('hex')));
                }

                if (options.verbose) {
                    console.log('');
                    console.log(chalk.dim('─'.repeat(50)));
                    console.log(chalk.bold('Details:'));
                    console.log(`  Security Level: MLDSA-${credentials.mldsaLevel}`);
                    console.log(`  Public Key Size: ${wallet.mldsaPublicKey.length} bytes`);

                    if (credentials.mnemonic) {
                        console.log(`  Auth Method: BIP-39 Mnemonic`);
                        console.log(`  Mnemonic: ${maskSensitive(credentials.mnemonic, 8)}`);
                    } else {
                        console.log(`  Auth Method: WIF + MLDSA Keys`);
                        if (credentials.wif) {
                            console.log(`  WIF: ${maskSensitive(credentials.wif, 4)}`);
                        }
                    }
                }

            } catch (error) {
                console.log('');
                console.log(chalk.yellow('Could not load wallet details.'));
                if (options.verbose) {
                    console.log(chalk.dim(`  Error: ${error instanceof Error ? error.message : String(error)}`));
                }

                // Show basic credential info without wallet
                console.log('');
                if (credentials.mnemonic) {
                    console.log(`${chalk.bold('Auth Method:')}    BIP-39 Mnemonic`);
                    if (options.verbose) {
                        console.log(`${chalk.bold('Mnemonic:')}       ${maskSensitive(credentials.mnemonic, 8)}`);
                    }
                } else {
                    console.log(`${chalk.bold('Auth Method:')}    WIF + MLDSA Keys`);
                }
            }

            console.log('');

        } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
