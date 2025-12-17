/**
 * Website Publish command - Publish a website to a .btc domain
 *
 * Sets the contenthash for a .btc domain to point to IPFS/IPNS content.
 *
 * @module commands/WebsitePublishCommand
 */

import { confirm } from '@inquirer/prompts';
import { BaseCommand } from './BaseCommand.js';
import { CLIWallet } from '../lib/wallet.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import {
    detectContenthashType,
    getContenthash,
    getContenthashTypeName,
    getDomain,
    getResolverContract,
    getSubdomain,
    isSubdomain,
    parseDomainName,
    validateCIDv0,
    validateCIDv1,
    validateIPNS,
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
import {
    CONTENTHASH_TYPE_CIDv0,
    CONTENTHASH_TYPE_CIDv1,
    CONTENTHASH_TYPE_IPNS,
    CONTENTHASH_TYPE_SHA256,
} from '../types/BtcResolver.js';

interface WebsitePublishOptions {
    network: string;
    dryRun?: boolean;
    yes?: boolean;
    type?: string;
}

export class WebsitePublishCommand extends BaseCommand {
    constructor() {
        super('website', 'Publish a website to a .btc domain');
    }

    protected configure(): void {
        this.command
            .argument('<domain>', 'Domain name (e.g., mysite or mysite.btc)')
            .argument('<contenthash>', 'IPFS CID, IPNS ID, or SHA256 hash')
            .option('-n, --network <network>', 'Network to use', 'mainnet')
            .option('--dry-run', 'Show what would be published without publishing')
            .option('-y, --yes', 'Skip confirmation prompts')
            .option(
                '-t, --type <type>',
                'Contenthash type: cidv0, cidv1, ipns, sha256 (auto-detected if not specified)',
            )
            .action((domain: string, contenthash: string, options?: WebsitePublishOptions) =>
                this.execute(domain, contenthash, options || { network: 'mainnet' }),
            );
    }

    private async execute(
        domain: string,
        contenthash: string,
        options: WebsitePublishOptions,
    ): Promise<void> {
        try {
            const network = (options.network || 'mainnet') as NetworkName;

            // Parse domain name (remove .btc suffix if present)
            const name = parseDomainName(domain.toLowerCase());
            const isSubdomainName = isSubdomain(name);
            const displayName = `${name}.btc`;

            this.logger.info(`Publishing website to ${displayName}...`);

            // Detect or validate contenthash type
            let hashType: number;
            if (options.type) {
                switch (options.type.toLowerCase()) {
                    case 'cidv0':
                        hashType = CONTENTHASH_TYPE_CIDv0;
                        break;
                    case 'cidv1':
                        hashType = CONTENTHASH_TYPE_CIDv1;
                        break;
                    case 'ipns':
                        hashType = CONTENTHASH_TYPE_IPNS;
                        break;
                    case 'sha256':
                        hashType = CONTENTHASH_TYPE_SHA256;
                        break;
                    default:
                        this.logger.fail(`Invalid type: ${options.type}`);
                        this.logger.info('Valid types: cidv0, cidv1, ipns, sha256');
                        process.exit(1);
                }
            } else {
                const detected = detectContenthashType(contenthash);
                if (detected === null) {
                    this.logger.fail('Could not detect contenthash type');
                    this.logger.info('Specify the type with --type option');
                    this.logger.info('Valid types: cidv0, cidv1, ipns, sha256');
                    process.exit(1);
                }
                hashType = detected;
            }

            // Validate contenthash format
            let validationError: string | null = null;
            switch (hashType) {
                case CONTENTHASH_TYPE_CIDv0:
                    validationError = validateCIDv0(contenthash);
                    break;
                case CONTENTHASH_TYPE_CIDv1:
                    validationError = validateCIDv1(contenthash);
                    break;
                case CONTENTHASH_TYPE_IPNS:
                    validationError = validateIPNS(contenthash);
                    break;
                case CONTENTHASH_TYPE_SHA256:
                    if (!/^[0-9a-fA-F]{64}$/.test(contenthash)) {
                        validationError = 'SHA256 hash must be 64 hex characters';
                    }
                    break;
            }

            if (validationError) {
                this.logger.fail(`Invalid contenthash: ${validationError}`);
                process.exit(1);
            }

            this.logger.success(`Contenthash type: ${getContenthashTypeName(hashType)}`);

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

            // Check domain/subdomain ownership
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
                    this.logger.info('Register the domain first');
                    process.exit(1);
                }
                ownerAddress = domainInfo.owner.toHex();
            }

            // Verify ownership
            if (wallet.address.toHex() !== ownerAddress) {
                this.logger.fail('You are not the owner of this domain');
                this.logger.log(`Domain owner: ${ownerAddress}`);
                this.logger.log(`Your address: ${wallet.p2trAddress}`);
                this.logger.log(`MLDSA Public Key Hash:  ${wallet.address.toHex()}`);
                process.exit(1);
            }
            this.logger.success('Ownership verified');

            // Check current contenthash
            const currentContenthash = await getContenthash(name, network);
            if (currentContenthash.hashType !== 0) {
                this.logger.warn(
                    `Current contenthash: ${currentContenthash.hashString || 'SHA256 hash'} (${getContenthashTypeName(currentContenthash.hashType)})`,
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

            // Display summary
            this.logger.log('');
            this.logger.info('Publishing Summary');
            this.logger.log('-'.repeat(50));
            this.logger.log(`Domain:       ${displayName}`);
            this.logger.log(`Type:         ${getContenthashTypeName(hashType)}`);
            this.logger.log(`Contenthash:  ${contenthash}`);
            this.logger.log(`Network:      ${network}`);
            if (hashType === CONTENTHASH_TYPE_CIDv0 || hashType === CONTENTHASH_TYPE_CIDv1) {
                this.logger.log(`Gateway URL:  https://ipfs.opnet.org/ipfs/${contenthash}`);
            } else if (hashType === CONTENTHASH_TYPE_IPNS) {
                this.logger.log(`Gateway URL:  https://ipfs.opnet.org/ipns/${contenthash}`);
            }
            this.logger.log('');

            if (options.dryRun) {
                this.logger.warn('Dry run - no changes made.');
                return;
            }

            // Confirmation
            if (!options.yes) {
                const confirmed = await confirm({
                    message: 'Publish website to this domain?',
                    default: true,
                });

                if (!confirmed) {
                    this.logger.warn('Publishing cancelled.');
                    return;
                }
            }

            // Get contract and set contenthash
            this.logger.info('Setting contenthash...');
            const sender = getWalletAddress(wallet);
            const contract = getResolverContract(network, sender);

            const txParams = buildTransactionParams(
                wallet,
                network,
                DEFAULT_MAX_SAT_TO_SPEND,
                DEFAULT_FEE_RATE,
            );

            let result;
            if (hashType === CONTENTHASH_TYPE_CIDv0) {
                result = await contract.setContenthashCIDv0(name, contenthash);
            } else if (hashType === CONTENTHASH_TYPE_CIDv1) {
                result = await contract.setContenthashCIDv1(name, contenthash);
            } else if (hashType === CONTENTHASH_TYPE_IPNS) {
                result = await contract.setContenthashIPNS(name, contenthash);
            } else if (hashType === CONTENTHASH_TYPE_SHA256) {
                const hexMatches = contenthash.match(/.{1,2}/g);
                if (!hexMatches) {
                    this.logger.fail('Invalid SHA256 hash format');
                    process.exit(1);
                }
                const hashBytes = new Uint8Array(hexMatches.map((byte) => parseInt(byte, 16)));
                result = await contract.setContenthashSHA256(name, hashBytes);
            } else {
                this.logger.fail('Unknown contenthash type');
                process.exit(1);
            }

            if (result.revert) {
                this.logger.fail('Transaction would fail');
                this.logger.error(`Reason: ${result.revert}`);
                process.exit(1);
            }

            if (result.estimatedGas) {
                this.logger.info(`Estimated gas: ${result.estimatedGas} sats`);
            }

            const receipt = await result.sendTransaction(txParams);

            this.logger.log('');
            this.logger.success('Website published successfully!');
            this.logger.log('');
            this.logger.log(`Domain:         ${displayName}`);
            this.logger.log(`Contenthash:    ${contenthash}`);
            this.logger.log(`Type:           ${getContenthashTypeName(hashType)}`);
            this.logger.log(`Transaction ID: ${receipt.transactionId}`);
            this.logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
            if (hashType === CONTENTHASH_TYPE_CIDv0 || hashType === CONTENTHASH_TYPE_CIDv1) {
                this.logger.log(`Gateway URL:    https://ipfs.opnet.org/ipfs/${contenthash}`);
            } else if (hashType === CONTENTHASH_TYPE_IPNS) {
                this.logger.log(`Gateway URL:    https://ipfs.opnet.org/ipns/${contenthash}`);
            }
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
            }
        } catch (error) {
            this.logger.fail('Website publishing failed');
            if (this.isUserCancelled(error)) {
                this.logger.warn('Publishing cancelled.');
                process.exit(0);
            }
            this.exitWithError(this.formatError(error));
        }
    }
}

export const websitePublishCommand = new WebsitePublishCommand().getCommand();
