/**
 * Accept command - Accept ownership transfer
 *
 * @module commands/AcceptCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import {
    getPendingScopeTransfer,
    getPendingTransfer,
    getRegistryContract,
} from '../lib/registry.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { CLIWallet } from '../lib/wallet.js';
import {
    buildTransactionParams,
    checkBalance,
    formatSats,
    getWalletAddress,
} from '../lib/transaction.js';
import { NetworkName } from '../types/index.js';

interface AcceptOptions {
    network: string;
    yes?: boolean;
}

export class AcceptCommand extends BaseCommand {
    constructor() {
        super('accept', 'Accept pending ownership transfer');
    }

    protected configure(): void {
        this.command
            .argument('<name>', 'Package name or @scope')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .action((name: string, options?: AcceptOptions) =>
                this.execute(name, options || { network: 'mainnet' }),
            );
    }

    private async execute(name: string, options?: AcceptOptions): Promise<void> {
        try {
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
            const isScope = name.startsWith('@') && !name.includes('/');

            // Check for pending transfer
            this.logger.info('Checking pending transfer...');

            if (isScope) {
                const scopeName = name.substring(1);
                const pending = await getPendingScopeTransfer(scopeName, network);

                if (!pending) {
                    this.logger.warn('No pending transfer');
                    this.logger.log(`No pending transfer for ${name}.`);
                    return;
                }

                this.logger.success('Found pending transfer');

                // Display summary
                this.logger.log('');
                this.logger.info('Accept Transfer');
                this.logger.log('─'.repeat(50));
                this.logger.log(`Type:     Scope`);
                this.logger.log(`Name:     ${name}`);
                this.logger.log(`Network:  ${options?.network}`);
                this.logger.log('');

                // Confirmation
                if (!options?.yes) {
                    const confirmed = await confirm({
                        message: `Accept ownership of ${name}?`,
                        default: true,
                    });

                    if (!confirmed) {
                        this.logger.warn('Transfer acceptance cancelled.');
                        return;
                    }
                }

                // Check wallet balance
                this.logger.info('Checking wallet balance...');
                const { sufficient, balance } = await checkBalance(wallet, network);
                if (!sufficient) {
                    this.logger.fail('Insufficient balance');
                    this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                    this.logger.error('Please fund your wallet before accepting transfer.');
                    process.exit(1);
                }
                this.logger.success(`Wallet balance: ${formatSats(balance)}`);

                // Execute acceptance
                this.logger.info('Accepting transfer...');

                const sender = getWalletAddress(wallet);
                const contract = getRegistryContract(network, sender);
                const txParams = buildTransactionParams(wallet, network);

                const acceptResult = await contract.acceptScopeTransfer(scopeName);

                if (acceptResult.revert) {
                    this.logger.fail('Acceptance would fail');
                    this.logger.error(`Reason: ${acceptResult.revert}`);
                    process.exit(1);
                }

                if (acceptResult.estimatedGas) {
                    this.logger.info(`Estimated gas: ${acceptResult.estimatedGas} sats`);
                }

                const receipt = await acceptResult.sendTransaction(txParams);

                this.logger.log('');
                this.logger.success('Scope transfer accepted successfully!');
                this.logger.log('');
                this.logger.log(`Scope:          ${name}`);
                this.logger.log(`Transaction ID: ${receipt.transactionId}`);
                this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
                this.logger.log('');
                return;
            } else {
                const pending = await getPendingTransfer(name, network);

                if (!pending) {
                    this.logger.warn('No pending transfer');
                    this.logger.log(`No pending transfer for ${name}.`);
                    return;
                }

                this.logger.success('Found pending transfer');

                // Display summary
                this.logger.log('');
                this.logger.info('Accept Transfer');
                this.logger.log('─'.repeat(50));
                this.logger.log(`Type:     Package`);
                this.logger.log(`Name:     ${name}`);
                this.logger.log(`Network:  ${options?.network}`);
                this.logger.log('');

                // Confirmation
                if (!options?.yes) {
                    const confirmed = await confirm({
                        message: `Accept ownership of ${name}?`,
                        default: true,
                    });

                    if (!confirmed) {
                        this.logger.warn('Transfer acceptance cancelled.');
                        return;
                    }
                }

                // Check wallet balance
                this.logger.info('Checking wallet balance...');
                const { sufficient: sufficientPkg, balance: balancePkg } = await checkBalance(
                    wallet,
                    network,
                );
                if (!sufficientPkg) {
                    this.logger.fail('Insufficient balance');
                    this.logger.error(`Wallet balance: ${formatSats(balancePkg)}`);
                    this.logger.error('Please fund your wallet before accepting transfer.');
                    process.exit(1);
                }
                this.logger.success(`Wallet balance: ${formatSats(balancePkg)}`);

                // Execute acceptance
                this.logger.info('Accepting transfer...');

                const sender = getWalletAddress(wallet);
                const contract = getRegistryContract(network, sender);
                const txParams = buildTransactionParams(wallet, network);

                const acceptResult = await contract.acceptTransfer(name);

                if (acceptResult.revert) {
                    this.logger.fail('Acceptance would fail');
                    this.logger.error(`Reason: ${acceptResult.revert}`);
                    process.exit(1);
                }

                if (acceptResult.estimatedGas) {
                    this.logger.info(`Estimated gas: ${acceptResult.estimatedGas} sats`);
                }

                const receipt = await acceptResult.sendTransaction(txParams);

                this.logger.log('');
                this.logger.success('Package transfer accepted successfully!');
                this.logger.log('');
                this.logger.log(`Package:        ${name}`);
                this.logger.log(`Transaction ID: ${receipt.transactionId}`);
                this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
                this.logger.log('');
            }
        } catch (error) {
            this.logger.fail('Acceptance failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Acceptance cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const acceptCommand = new AcceptCommand().getCommand();
