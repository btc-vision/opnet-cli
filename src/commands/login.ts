/**
 * Login command - Configure wallet credentials
 *
 * @module commands/login
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { input, select, confirm, password } from '@inquirer/prompts';
import { saveCredentials, isValidMldsaLevel, isValidNetwork } from '../lib/credentials.js';
import { validateMnemonic } from '../lib/wallet.js';
import { CLICredentials, NetworkName, MLDSALevel } from '../types/index.js';

export const loginCommand = new Command('login')
    .description('Configure wallet credentials for signing and publishing')
    .option('-m, --mnemonic <phrase>', 'BIP-39 mnemonic phrase (24 words)')
    .option('--wif <key>', 'Bitcoin WIF private key (advanced)')
    .option('--mldsa <key>', 'MLDSA private key hex (advanced, requires --wif)')
    .option('-l, --mldsa-level <level>', 'MLDSA security level (44, 65, 87)', '44')
    .option('-n, --network <network>', 'Network (mainnet, testnet, regtest)', 'mainnet')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (options: {
        mnemonic?: string;
        wif?: string;
        mldsa?: string;
        mldsaLevel: string;
        network: string;
        yes?: boolean;
    }) => {
        try {
            let credentials: CLICredentials;

            // Validate network
            if (!isValidNetwork(options.network)) {
                console.error(chalk.red(`Invalid network: ${options.network}`));
                console.error('Valid networks: mainnet, testnet, regtest');
                process.exit(1);
            }
            const network = options.network as NetworkName;

            // Validate MLDSA level
            const mldsaLevelNum = parseInt(options.mldsaLevel, 10);
            if (!isValidMldsaLevel(mldsaLevelNum)) {
                console.error(chalk.red(`Invalid MLDSA level: ${options.mldsaLevel}`));
                console.error('Valid levels: 44, 65, 87');
                process.exit(1);
            }
            const mldsaLevel = mldsaLevelNum as MLDSALevel;

            // Check if credentials provided via options
            if (options.mnemonic) {
                // Mnemonic-based login
                if (!validateMnemonic(options.mnemonic)) {
                    console.error(chalk.red('Invalid mnemonic phrase'));
                    process.exit(1);
                }

                credentials = {
                    mnemonic: options.mnemonic,
                    mldsaLevel,
                    network,
                };
            } else if (options.wif && options.mldsa) {
                // Advanced WIF + MLDSA login
                credentials = {
                    wif: options.wif,
                    mldsaPrivateKey: options.mldsa,
                    mldsaLevel,
                    network,
                };
            } else {
                // Interactive mode
                console.log(chalk.cyan('\nOPNet Wallet Configuration\n'));

                const loginMethod = await select({
                    message: 'How would you like to authenticate?',
                    choices: [
                        {
                            name: 'Mnemonic phrase (recommended)',
                            value: 'mnemonic',
                            description: '24-word BIP-39 phrase for full key derivation',
                        },
                        {
                            name: 'WIF + MLDSA keys (advanced)',
                            value: 'advanced',
                            description: 'Separate Bitcoin WIF and MLDSA private keys',
                        },
                    ],
                });

                const selectedNetwork = await select({
                    message: 'Select network:',
                    choices: [
                        { name: 'Mainnet', value: 'mainnet' },
                        { name: 'Testnet', value: 'testnet' },
                        { name: 'Regtest', value: 'regtest' },
                    ],
                    default: network,
                });

                const selectedLevel = await select({
                    message: 'Select MLDSA security level:',
                    choices: [
                        {
                            name: 'MLDSA-44 (Level 2, fastest)',
                            value: 44,
                            description: '1312 byte public key, 2420 byte signature',
                        },
                        {
                            name: 'MLDSA-65 (Level 3, balanced)',
                            value: 65,
                            description: '1952 byte public key, 3309 byte signature',
                        },
                        {
                            name: 'MLDSA-87 (Level 5, most secure)',
                            value: 87,
                            description: '2592 byte public key, 4627 byte signature',
                        },
                    ],
                    default: mldsaLevel,
                });

                if (loginMethod === 'mnemonic') {
                    const mnemonic = await password({
                        message: 'Enter your 24-word mnemonic phrase:',
                        mask: '*',
                        validate: (value) => {
                            if (!validateMnemonic(value)) {
                                return 'Invalid mnemonic phrase. Please enter a valid 24-word BIP-39 phrase.';
                            }
                            return true;
                        },
                    });

                    credentials = {
                        mnemonic,
                        mldsaLevel: selectedLevel as MLDSALevel,
                        network: selectedNetwork as NetworkName,
                    };
                } else {
                    const wif = await password({
                        message: 'Enter Bitcoin WIF private key:',
                        mask: '*',
                    });

                    const mldsaKey = await password({
                        message: 'Enter MLDSA private key (hex):',
                        mask: '*',
                    });

                    credentials = {
                        wif,
                        mldsaPrivateKey: mldsaKey,
                        mldsaLevel: selectedLevel as MLDSALevel,
                        network: selectedNetwork as NetworkName,
                    };
                }
            }

            // Confirmation
            if (!options.yes) {
                console.log(chalk.yellow('\nCredentials will be stored at ~/.opnet/credentials.json'));
                console.log(chalk.yellow('with restricted permissions (owner read/write only).'));

                const confirmed = await confirm({
                    message: 'Save credentials?',
                    default: true,
                });

                if (!confirmed) {
                    console.log(chalk.yellow('Login cancelled.'));
                    return;
                }
            }

            // Save credentials
            saveCredentials(credentials);

            console.log(chalk.green('\nCredentials saved successfully!'));
            console.log(chalk.dim(`Network: ${credentials.network}`));
            console.log(chalk.dim(`MLDSA Level: ${credentials.mldsaLevel}`));
            console.log(chalk.dim(`Auth method: ${credentials.mnemonic ? 'mnemonic' : 'WIF + MLDSA'}`));

        } catch (error) {
            if (error instanceof Error && error.message.includes('User force closed')) {
                console.log(chalk.yellow('\nLogin cancelled.'));
                process.exit(0);
            }
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
