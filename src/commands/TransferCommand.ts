/**
 * Transfer command - Initiate ownership transfer
 *
 * @module commands/TransferCommand
 */

import { confirm, input } from '@inquirer/prompts';
import { Address } from '@btc-vision/transaction';
import { BaseCommand } from './BaseCommand.js';
import {
    getPackage,
    getPendingScopeTransfer,
    getPendingTransfer,
    getRegistryContract,
    getScope,
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

interface TransferOptions {
    network: string;
    yes?: boolean;
    cancel?: boolean;
}

export class TransferCommand extends BaseCommand {
    constructor() {
        super('transfer', 'Initiate ownership transfer of a package or scope');
    }

    protected configure(): void {
        this.command
            .argument('<name>', 'Package name or @scope')
            .argument('[newOwner]', 'New owner address')
            .option('-n, --network <network>', 'Network', 'mainnet')
            .option('-y, --yes', 'Skip confirmation')
            .option('--cancel', 'Cancel pending transfer')
            .action((name: string, newOwner?: string, options?: TransferOptions) =>
                this.execute(name, newOwner, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        name: string,
        newOwner?: string,
        options?: TransferOptions,
    ): Promise<void> {
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
            const displayName = isScope ? name : `package ${name}`;

            if (options?.cancel) {
                await this.handleCancel(name, isScope, network, options);
                return;
            }

            // Initiate transfer
            let targetOwner = newOwner;
            if (!targetOwner) {
                targetOwner = await input({
                    message: 'New owner address:',
                    validate: (value) => {
                        if (!value || value.length < 20) {
                            return 'Please enter a valid address';
                        }
                        return true;
                    },
                });
            }

            // Verify target exists
            this.logger.info(`Checking ${displayName}...`);

            if (isScope) {
                const scopeName = name.substring(1);
                const scopeInfo = await getScope(scopeName, network);
                if (!scopeInfo) {
                    this.logger.fail('Scope not found');
                    this.logger.error(`Scope "${name}" does not exist.`);
                    process.exit(1);
                }
                this.logger.success(`Found scope ${name}`);
            } else {
                const packageInfo = await getPackage(name, network);
                if (!packageInfo) {
                    this.logger.fail('Package not found');
                    this.logger.error(`Package "${name}" does not exist.`);
                    process.exit(1);
                }
                this.logger.success(`Found package ${name}`);
            }

            // Display summary
            this.logger.log('');
            this.logger.info('Transfer Summary');
            this.logger.log('─'.repeat(50));
            this.logger.log(`Type:       ${isScope ? 'Scope' : 'Package'}`);
            this.logger.log(`Name:       ${name}`);
            this.logger.log(`New Owner: ${targetOwner}`);
            this.logger.log(`Network:    ${options?.network}`);
            this.logger.log('');

            this.logger.warn(
                'Note: The new owner must call `opnet accept` to complete the transfer.',
            );
            this.logger.log('');

            // Confirmation
            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Initiate transfer of ${displayName}?`,
                    default: false,
                });

                if (!confirmed) {
                    this.logger.warn('Transfer cancelled.');
                    return;
                }
            }

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                this.logger.error('Please fund your wallet before initiating transfer.');
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            // Execute transfer
            this.logger.info('Initiating transfer...');

            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);
            const txParams = buildTransactionParams(wallet, network);
            const newOwnerAddress = Address.fromString(targetOwner);

            if (isScope) {
                const scopeName = name.substring(1);
                const transferResult = await contract.initiateScopeTransfer(
                    scopeName,
                    newOwnerAddress,
                );

                if (transferResult.revert) {
                    this.logger.fail('Transfer initiation would fail');
                    this.logger.error(`Reason: ${transferResult.revert}`);
                    process.exit(1);
                }

                if (transferResult.estimatedGas) {
                    this.logger.info(`Estimated gas: ${transferResult.estimatedGas} gas`);
                }

                const receipt = await transferResult.sendTransaction(txParams);

                this.logger.log('');
                this.logger.success('Scope transfer initiated successfully!');
                this.logger.log('');
                this.logger.log(`Scope:          ${name}`);
                this.logger.log(`New Owner:      ${targetOwner}`);
                this.logger.log(`Transaction ID: ${receipt.transactionId}`);
                this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
                this.logger.log('');
                this.logger.warn(
                    'Note: The new owner must call `opnet accept` to complete the transfer.',
                );
            } else {
                const transferResult = await contract.initiateTransfer(name, newOwnerAddress);

                if (transferResult.revert) {
                    this.logger.fail('Transfer initiation would fail');
                    this.logger.error(`Reason: ${transferResult.revert}`);
                    process.exit(1);
                }

                if (transferResult.estimatedGas) {
                    this.logger.info(`Estimated gas: ${transferResult.estimatedGas} gas`);
                }

                const receipt = await transferResult.sendTransaction(txParams);

                this.logger.log('');
                this.logger.success('Package transfer initiated successfully!');
                this.logger.log('');
                this.logger.log(`Package:        ${name}`);
                this.logger.log(`New Owner:      ${targetOwner}`);
                this.logger.log(`Transaction ID: ${receipt.transactionId}`);
                this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
                this.logger.log('');
                this.logger.warn(
                    'Note: The new owner must call `opnet accept` to complete the transfer.',
                );
            }
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Transfer failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Transfer cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }

    private async handleCancel(
        name: string,
        isScope: boolean,
        network: NetworkName,
        options: TransferOptions,
    ): Promise<void> {
        this.logger.info('Checking pending transfer...');

        // Load wallet for cancellation
        const credentials = loadCredentials();
        if (!credentials || !canSign(credentials)) {
            this.logger.fail('No credentials configured');
            this.logger.warn('Run `opnet login` to configure your wallet.');
            process.exit(1);
        }
        const wallet = CLIWallet.fromCredentials(credentials);

        if (isScope) {
            const scopeName = name.substring(1);
            const pending = await getPendingScopeTransfer(scopeName, network);
            if (!pending) {
                this.logger.warn('No pending transfer');
                this.logger.log(`No pending transfer for ${name}.`);
                return;
            }
            this.logger.success(`Found pending transfer to ${pending.pendingOwner}`);

            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Cancel ownership transfer of ${name}?`,
                    default: true,
                });
                if (!confirmed) {
                    this.logger.warn('Cancelled.');
                    return;
                }
            }

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            this.logger.info('Cancelling transfer...');

            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);
            const txParams = buildTransactionParams(wallet, network);

            const cancelResult = await contract.cancelScopeTransfer(scopeName);

            if (cancelResult.revert) {
                this.logger.fail('Cancellation would fail');
                this.logger.error(`Reason: ${cancelResult.revert}`);
                process.exit(1);
            }

            if (cancelResult.estimatedGas) {
                this.logger.info(`Estimated gas: ${cancelResult.estimatedGas} gas`);
            }

            const receipt = await cancelResult.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Scope transfer cancelled successfully!');
            this.logger.log('');
            this.logger.log(`Scope:          ${name}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            this.logger.log('');
        } else {
            const pending = await getPendingTransfer(name, network);
            if (!pending) {
                this.logger.warn('No pending transfer');
                this.logger.log(`No pending transfer for ${name}.`);
                return;
            }
            this.logger.success(`Found pending transfer to ${pending.pendingOwner}`);

            if (!options?.yes) {
                const confirmed = await confirm({
                    message: `Cancel ownership transfer of ${name}?`,
                    default: true,
                });
                if (!confirmed) {
                    this.logger.warn('Cancelled.');
                    return;
                }
            }

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            this.logger.info('Cancelling transfer...');

            const sender = getWalletAddress(wallet);
            const contract = getRegistryContract(network, sender);
            const txParams = buildTransactionParams(wallet, network);

            const cancelResult = await contract.cancelTransfer(name);

            if (cancelResult.revert) {
                this.logger.fail('Cancellation would fail');
                this.logger.error(`Reason: ${cancelResult.revert}`);
                process.exit(1);
            }

            if (cancelResult.estimatedGas) {
                this.logger.info(`Estimated gas: ${cancelResult.estimatedGas} gas`);
            }

            const receipt = await cancelResult.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Package transfer cancelled successfully!');
            this.logger.log('');
            this.logger.log(`Package:        ${name}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            this.logger.log('');
        }
    }
}

export const transferCommand = new TransferCommand().getCommand();
