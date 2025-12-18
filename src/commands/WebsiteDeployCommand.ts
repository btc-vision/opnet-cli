/**
 * Website Deploy command - Upload to IPFS and publish to .btc domain
 *
 * Combines IPFS upload and on-chain contenthash update in one command.
 *
 * @module commands/WebsiteDeployCommand
 */

import * as fs from 'fs';
import * as path from 'path';
import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { CLIWallet } from '../lib/wallet.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import { DirectoryPinResult, PinResult, uploadDirectory, uploadFile } from '../lib/ipfs.js';
import { formatFileSize } from '../lib/binary.js';
import {
    getContenthash,
    getContenthashTypeName,
    getDomain,
    getResolverContract,
    getSubdomain,
    isSubdomain,
    parseDomainName,
} from '../lib/resolver.js';
import {
    buildTransactionParams,
    checkBalance,
    DEFAULT_FEE_RATE,
    DEFAULT_MAX_SAT_TO_SPEND,
    formatSats,
    getWalletAddress,
    waitForTransactionConfirmation,
} from '../lib/transaction.js';
import { NetworkName } from '../types/index.js';

interface WebsiteDeployOptions {
    network: string;
    dryRun?: boolean;
    yes?: boolean;
}

export class WebsiteDeployCommand extends BaseCommand {
    constructor() {
        super('deploy', 'Upload website to IPFS and publish to .btc domain');
    }

    protected configure(): void {
        this.command
            .argument('<domain>', 'Domain name (e.g., mysite or mysite.btc)')
            .argument('<path>', 'Path to website directory or HTML file')
            .option('-n, --network <network>', 'Network to use', 'mainnet')
            .option('--dry-run', "Upload to IPFS but don't update on-chain")
            .option('-y, --yes', 'Skip confirmation prompts')
            .action((domain: string, websitePath: string, options?: WebsiteDeployOptions) =>
                this.execute(domain, websitePath, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        domain: string,
        websitePath: string,
        options: WebsiteDeployOptions,
    ): Promise<void> {
        try {
            const network = (options.network || 'mainnet') as NetworkName;

            // Parse domain name
            const name = parseDomainName(domain.toLowerCase());
            const isSubdomainName = isSubdomain(name);
            const displayName = `${name}.btc`;

            // Resolve the path
            const resolvedPath = path.resolve(websitePath);

            // Check if path exists
            if (!fs.existsSync(resolvedPath)) {
                this.logger.fail(`Path not found: ${resolvedPath}`);
                process.exit(1);
            }

            const stats = fs.statSync(resolvedPath);
            const isDirectory = stats.isDirectory();

            this.logger.info(`Deploying to ${displayName}...`);
            this.logger.log('');

            // Show what we're uploading
            if (isDirectory) {
                const files = this.countFiles(resolvedPath);
                const totalSize = this.getDirectorySize(resolvedPath);
                this.logger.info('Website Directory');
                this.logger.log('-'.repeat(50));
                this.logger.log(`Path:         ${resolvedPath}`);
                this.logger.log(`Files:        ${files}`);
                this.logger.log(`Total size:   ${formatFileSize(totalSize)}`);
            } else {
                this.logger.info('Website File');
                this.logger.log('-'.repeat(50));
                this.logger.log(`Path:         ${resolvedPath}`);
                this.logger.log(`Size:         ${formatFileSize(stats.size)}`);
            }
            this.logger.log('');

            // Load wallet
            this.logger.info('Loading wallet...');
            const credentials = loadCredentials();
            if (!credentials || !canSign(credentials)) {
                this.logger.fail('No credentials configured');
                this.logger.warn('Run `opnet login` to configure your wallet.');
                process.exit(1);
            }

            const wallet = CLIWallet.fromCredentials(credentials);
            this.logger.success('Wallet loaded');

            // Check domain ownership
            this.logger.info('Checking domain ownership...');
            let ownerAddress: string;

            if (isSubdomainName) {
                const subdomainInfo = await getSubdomain(name, network);
                if (!subdomainInfo) {
                    this.logger.fail(`Subdomain ${displayName} does not exist`);
                    process.exit(1);
                }
                ownerAddress = subdomainInfo.owner.toHex();
            } else {
                const domainInfo = await getDomain(name, network);
                if (!domainInfo) {
                    this.logger.fail(`Domain ${displayName} does not exist`);
                    this.logger.info('Register the domain first with:');
                    this.logger.log(`  opnet domain register ${name} -n ${network}`);
                    process.exit(1);
                }
                ownerAddress = domainInfo.owner.toHex();
            }

            // Verify ownership
            if (wallet.address.toHex() !== ownerAddress) {
                this.logger.fail('You are not the owner of this domain');
                this.logger.log(`Domain owner: ${ownerAddress}`);
                this.logger.log(`Your address: ${wallet.address.toHex()}`);
                process.exit(1);
            }
            this.logger.success('Ownership verified');

            // Check current contenthash
            const currentContenthash = await getContenthash(name, network);
            if (currentContenthash.hashType !== 0) {
                this.logger.warn(
                    `Current website: ${currentContenthash.hashString || 'SHA256 hash'} (${getContenthashTypeName(currentContenthash.hashType)})`,
                );
            }

            // Check wallet balance
            this.logger.info('Checking wallet balance...');
            const { sufficient, balance } = await checkBalance(wallet, network);
            if (!sufficient) {
                this.logger.fail('Insufficient balance');
                this.logger.error(`Wallet balance: ${formatSats(balance)}`);
                this.logger.error('Please fund your wallet to pay for gas fees.');
                process.exit(1);
            }
            this.logger.success(`Wallet balance: ${formatSats(balance)}`);

            // Confirmation before upload
            if (!options.yes) {
                const confirmed = await confirm({
                    message: `Upload and deploy to ${displayName}?`,
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Deployment cancelled.');
                    return;
                }
            }

            // Upload to IPFS
            this.logger.log('');
            this.logger.info('Uploading to IPFS...');

            let cid: string;
            if (isDirectory) {
                const result: DirectoryPinResult = await uploadDirectory(resolvedPath);
                cid = result.cid;
                this.logger.success(
                    `Uploaded ${result.files} files (${formatFileSize(result.totalSize)})`,
                );
            } else {
                const result: PinResult = await uploadFile(resolvedPath);
                cid = result.cid;
                this.logger.success(`Uploaded file (${formatFileSize(result.size)})`);
            }

            this.logger.success(`IPFS CID: ${cid}`);
            this.logger.log(`Gateway URL: https://ipfs.opnet.org/ipfs/${cid}`);
            this.logger.log('');

            if (options.dryRun) {
                this.logger.warn('Dry run - website uploaded to IPFS but not published on-chain.');
                this.logger.info('To publish on-chain, run:');
                this.logger.log(`  opnet website ${name} ${cid} -n ${network}`);
                return;
            }

            // Update contenthash on-chain
            this.logger.info('Publishing to blockchain...');
            const sender = getWalletAddress(wallet);
            const contract = getResolverContract(network, sender);

            const txParams = buildTransactionParams(
                wallet,
                network,
                DEFAULT_MAX_SAT_TO_SPEND,
                DEFAULT_FEE_RATE,
            );

            // Use CIDv1 method (modern IPFS CID format)
            const result = await contract.setContenthashCIDv1(name, cid);

            if (result.revert) {
                this.logger.fail('Transaction would fail');
                this.logger.error(`Reason: ${result.revert}`);
                process.exit(1);
            }

            if (result.estimatedGas) {
                this.logger.info(`Estimated gas: ${result.estimatedGas} gas`);
            }

            const receipt = await result.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Website deployed successfully!');
            this.logger.log('');
            this.logger.log(`Domain:         ${displayName}`);
            this.logger.log(`IPFS CID:       ${cid}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            this.logger.log(`Gateway URL:    https://ipfs.opnet.org/ipfs/${cid}`);
            this.logger.log('');

            // Wait for confirmation
            const confirmationResult = await waitForTransactionConfirmation(
                receipt.transactionId,
                network,
                {
                    message: 'Waiting for transaction confirmation',
                },
            );

            if (!confirmationResult.confirmed) {
                if (confirmationResult.revert) {
                    this.logger.fail('Transaction failed');
                    this.logger.error(`Reason: ${confirmationResult.revert}`);
                } else if (confirmationResult.error) {
                    this.logger.warn('Transaction not yet confirmed');
                    this.logger.warn(confirmationResult.error);
                }
            } else {
                this.logger.log('');
                this.logger.success(`${displayName} is now live!`);
            }
        } catch (error) {
            this.logger.fail('Deployment failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Deployment cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }

    /**
     * Count files in a directory recursively
     */
    private countFiles(dirPath: string): number {
        let count = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.isDirectory()) {
                count += this.countFiles(path.join(dirPath, entry.name));
            } else if (entry.isFile()) {
                count++;
            }
        }

        return count;
    }

    /**
     * Get total size of a directory
     */
    private getDirectorySize(dirPath: string): number {
        let size = 0;
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                size += this.getDirectorySize(fullPath);
            } else if (entry.isFile()) {
                size += fs.statSync(fullPath).size;
            }
        }

        return size;
    }
}

export const websiteDeployCommand = new WebsiteDeployCommand().getCommand();
