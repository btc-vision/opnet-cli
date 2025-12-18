/**
 * Scope Register command - Register a new scope in the registry
 *
 * @module commands/ScopeRegisterCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { getRegistryContract, getScope, getScopePrice } from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import {
    buildTransactionParams,
    checkBalance,
    formatSats,
    getWalletAddress,
} from '../lib/transaction.js';
import { NetworkName } from '../types/index.js';

interface ScopeRegisterOptions {
    network: string;
    yes?: boolean;
}

export class ScopeRegisterCommand extends BaseCommand {
    constructor() {
        super('scope:register', 'Register a new scope in the registry');
    }

    protected configure(): void {
        this.command
            .argument('<name>', 'Scope name (without @)')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .action((name: string, options?: ScopeRegisterOptions) =>
                this.execute(name, options || { network: 'mainnet' }),
            );
    }

    private async execute(name: string, options?: ScopeRegisterOptions): Promise<void> {
        try {
            // Remove @ prefix if provided
            const scopeName = name.startsWith('@') ? name.substring(1) : name;

            // Validate scope name
            if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(scopeName) && !/^[a-z]$/.test(scopeName)) {
                this.logger.fail('Invalid scope name');
                this.logger.error('Scope name must:');
                this.logger.error('  - Start with a lowercase letter');
                this.logger.error('  - Contain only lowercase letters, numbers, and hyphens');
                this.logger.error('  - End with a letter or number');
                process.exit(1);
            }

            // Load credentials
            this.logger.info('Loading wallet...');
            const credentials = loadCredentials();
            if (!credentials || !canSign(credentials)) {
                this.logger.fail('No credentials configured');
                this.logger.warn('Run `opnet login` to configure your wallet.');
                process.exit(1);
            }
            const wallet = CLIWallet.fromCredentials(credentials);
            this.logger.success('Wallet loaded');

            const network = (options?.network || 'mainnet') as NetworkName;

            // Check if scope already exists
            this.logger.info(`Checking if @${scopeName} is available...`);
            const existingScope = await getScope(scopeName, network);
            if (existingScope) {
                this.logger.fail('Scope already registered');
                this.logger.error(`Scope @${scopeName} is already registered.`);
                this.logger.log(`Owner: ${existingScope.owner}`);
                process.exit(1);
            }
            this.logger.success(`Scope @${scopeName} is available`);

            // Get scope registration price
            this.logger.info('Fetching registration price...');
            const scopePrice = await getScopePrice(network);
            this.logger.success(`Registration price: ${formatSats(scopePrice)}`);

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const minRequired = scopePrice + 50_000n; // Price + estimated fees
            const { sufficient, balance } = await checkBalance(wallet, network, minRequired);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                this.logger.error(`Required (approx): ${formatSats(minRequired)}`);
                this.logger.error('Please fund your wallet before registering a scope.');
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            // Display summary
            this.logger.log('');
            this.logger.info('Scope Registration Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Scope:    @${scopeName}`);
            this.logger.log(`Price:    ${formatSats(scopePrice)}`);
            this.logger.log(`Network:  ${options?.network}`);
            this.logger.log(`Address:  ${wallet.p2trAddress}`);
            this.logger.log('');

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Register scope @${scopeName}?`,
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Registration cancelled.');
                    return;
                }
            }

            // Execute registration
            this.logger.info('Registering scope...');

            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);
            const txParams = buildTransactionParams(wallet, network);

            const registerResult = await contract.registerScope(scopeName);

            if (registerResult.revert) {
                this.logger.fail('Registration would fail');
                this.logger.error(`Reason: ${registerResult.revert}`);
                process.exit(1);
            }

            if (registerResult.estimatedGas) {
                this.logger.info(`Estimated gas: ${registerResult.estimatedGas} gas`);
            }

            const receipt = await registerResult.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Scope registered successfully!');
            this.logger.log('');
            this.logger.log(`Scope:          @${scopeName}`);
            this.logger.log(`Owner:          ${wallet.p2trAddress}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            this.logger.log('');
            this.logger.info('You can now publish packages under this scope using: opnet publish');
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Scope registration failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Registration cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const scopeRegisterCommand = new ScopeRegisterCommand().getCommand();
