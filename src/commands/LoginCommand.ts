/**
 * Login command - Configure wallet credentials
 *
 * @module commands/LoginCommand
 */

import { Command } from 'commander';
import { input, select, confirm, password } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { saveCredentials, isValidMldsaLevel, isValidNetwork } from '../lib/credentials.js';
import { validateMnemonic } from '../lib/wallet.js';
import { CLICredentials, NetworkName, CLIMldsaLevel } from '../types/index.js';

interface LoginOptions {
    mnemonic?: string;
    wif?: string;
    mldsa?: string;
    mldsaLevel: string;
    network: string;
    yes?: boolean;
}

export class LoginCommand extends BaseCommand {
    constructor() {
        super('login', 'Configure wallet credentials for signing and publishing');
    }

    protected configure(): void {
        this.command
            .option('-m, --mnemonic <phrase>', 'BIP-39 mnemonic phrase (24 words)')
            .option('--wif <key>', 'Bitcoin WIF private key (advanced)')
            .option('--mldsa <key>', 'MLDSA private key hex (advanced, requires --wif)')
            .option('-l, --mldsa-level <level>', 'MLDSA security level (44, 65, 87)', '44')
            .option('-n, --network <network>', 'Network (mainnet, testnet, regtest)', 'mainnet')
            .option('-y, --yes', 'Skip confirmation prompts')
            .action((options: LoginOptions) => this.execute(options));
    }

    private async execute(options: LoginOptions): Promise<void> {
        try {
            const credentials = await this.buildCredentials(options);

            if (!options.yes) {
                this.logger.warn('Credentials will be stored at ~/.opnet/credentials.json');
                this.logger.warn('with restricted permissions (owner read/write only).');

                const confirmed = await confirm({
                    message: 'Save credentials?',
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Login cancelled.');
                    return;
                }
            }

            saveCredentials(credentials);

            this.logger.success('Credentials saved successfully!');
            this.logger.info(`Network: ${credentials.network}`);
            this.logger.info(`MLDSA Level: ${credentials.mldsaLevel}`);
            this.logger.info(`Auth method: ${credentials.mnemonic ? 'mnemonic' : 'WIF + MLDSA'}`);

        } catch (error) {
            if (this.isUserCancelled(error)) {
                this.logger.warn('Login cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }

    private async buildCredentials(options: LoginOptions): Promise<CLICredentials> {
        if (!isValidNetwork(options.network)) {
            this.exitWithError(`Invalid network: ${options.network}. Valid: mainnet, testnet, regtest`);
            throw new Error('Unreachable'); // Helps TypeScript
        }

        const mldsaLevelNum = parseInt(options.mldsaLevel, 10);
        if (!isValidMldsaLevel(mldsaLevelNum)) {
            this.exitWithError(`Invalid MLDSA level: ${options.mldsaLevel}. Valid: 44, 65, 87`);
        }
        const mldsaLevel: CLIMldsaLevel = mldsaLevelNum;

        if (options.mnemonic) {
            if (!validateMnemonic(options.mnemonic)) {
                this.exitWithError('Invalid mnemonic phrase');
            }
            return { mnemonic: options.mnemonic, mldsaLevel, network: options.network };
        }

        if (options.wif && options.mldsa) {
            return {
                wif: options.wif,
                mldsaPrivateKey: options.mldsa,
                mldsaLevel,
                network: options.network,
            };
        }

        return this.interactiveLogin(options.network, mldsaLevel);
    }

    private async interactiveLogin(
        defaultNetwork: NetworkName,
        defaultLevel: CLIMldsaLevel,
    ): Promise<CLICredentials> {
        this.logger.info('OPNet Wallet Configuration\n');

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
            default: defaultNetwork,
        }) as NetworkName;

        const selectedLevel = await select({
            message: 'Select MLDSA security level:',
            choices: [
                { name: 'MLDSA-44 (Level 2, fastest)', value: 44, description: '1312 byte public key' },
                { name: 'MLDSA-65 (Level 3, balanced)', value: 65, description: '1952 byte public key' },
                { name: 'MLDSA-87 (Level 5, most secure)', value: 87, description: '2592 byte public key' },
            ],
            default: defaultLevel,
        }) as CLIMldsaLevel;

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

            return { mnemonic, mldsaLevel: selectedLevel, network: selectedNetwork };
        }

        const wif = await password({ message: 'Enter Bitcoin WIF private key:', mask: '*' });
        const mldsaKey = await password({ message: 'Enter MLDSA private key (hex):', mask: '*' });

        return {
            wif,
            mldsaPrivateKey: mldsaKey,
            mldsaLevel: selectedLevel,
            network: selectedNetwork,
        };
    }
}

export const loginCommand = new LoginCommand().getCommand();
