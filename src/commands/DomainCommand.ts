/**
 * Domain command - Manage .btc domains
 *
 * Subcommands for registering and managing .btc domains on the BTC Name Resolver.
 *
 * @module commands/DomainCommand
 */

import { Command } from 'commander';
import { confirm } from '@inquirer/prompts';
import { Logger } from '@btc-vision/logger';
import { CLIWallet } from '../lib/wallet.js';
import { canSign, loadCredentials } from '../lib/credentials.js';
import {
    getContenthash,
    getContenthashTypeName,
    getDomain,
    getDomainPrice,
    getResolverContract,
    getTreasuryAddress,
    parseDomainName,
    validateDomainName,
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
import { PsbtOutputExtended } from '@btc-vision/bitcoin';
import { StrippedTransactionOutput, TransactionOutputFlags } from 'opnet';

const logger = new Logger();

interface DomainRegisterOptions {
    network: string;
    dryRun?: boolean;
    yes?: boolean;
}

interface DomainInfoOptions {
    network: string;
}

/**
 * Register a new .btc domain
 */
async function registerDomain(domain: string, options: DomainRegisterOptions): Promise<void> {
    try {
        const network = (options.network || 'mainnet') as NetworkName;

        // Parse and validate domain name
        const name = parseDomainName(domain.toLowerCase());
        const displayName = `${name}.btc`;

        // Check if it's a subdomain (not allowed for registration)
        if (name.includes('.')) {
            logger.fail('Cannot register subdomains directly');
            logger.info('Register the parent domain first, then create subdomains');
            process.exit(1);
        }

        // Validate domain format
        const validationError = validateDomainName(name);
        if (validationError) {
            logger.fail(`Invalid domain name: ${validationError}`);
            process.exit(1);
        }

        logger.info(`Registering domain: ${displayName}`);

        // Check if domain already exists
        logger.info('Checking domain availability...');
        const existingDomain = await getDomain(name, network);
        if (existingDomain) {
            logger.fail(`Domain ${displayName} is already registered`);
            logger.log(`Owner: ${existingDomain.owner.toHex()}`);
            process.exit(1);
        }
        logger.success(`Domain ${displayName} is available`);

        // Get pricing
        const price = await getDomainPrice(name, network);
        const treasuryAddr = await getTreasuryAddress(network);

        logger.info(`Registration price: ${formatSats(price)}`);
        if (name.length === 3) {
            logger.warn('Premium pricing applied (3-character domain)');
        } else if (name.length === 4) {
            logger.warn('Premium pricing applied (4-character domain)');
        }

        // Load wallet
        logger.info('Loading wallet...');
        const credentials = loadCredentials();
        if (!credentials || !canSign(credentials)) {
            logger.fail('No credentials configured');
            logger.warn('Run `opnet login` to configure your wallet.');
            process.exit(1);
        }

        const wallet = CLIWallet.fromCredentials(credentials);
        logger.success('Wallet loaded');

        // Check wallet balance
        logger.info('Checking wallet balance...');
        const minRequired = price + 10_000n; // Price + some buffer for fees
        const { sufficient, balance } = await checkBalance(wallet, network, minRequired);
        if (!sufficient) {
            logger.fail('Insufficient balance');
            logger.error(`Required: ~${formatSats(minRequired)}`);
            logger.error(`Available: ${formatSats(balance)}`);
            process.exit(1);
        }
        logger.success(`Wallet balance: ${formatSats(balance)}`);

        // Display summary
        logger.log('');
        logger.info('Registration Summary');
        logger.log('-'.repeat(50));
        logger.log(`Domain:       ${displayName}`);
        logger.log(`Price:        ${formatSats(price)}`);
        logger.log(`Treasury:     ${treasuryAddr}`);
        logger.log(`Network:      ${network}`);
        logger.log(`Your wallet:  ${wallet.p2trAddress}`);
        logger.log(`MLDSA Public Key Hash:  ${wallet.address.toHex()}`);
        logger.log('');

        if (options.dryRun) {
            logger.warn('Dry run - no changes made.');
            return;
        }

        // Confirmation
        if (!options.yes) {
            const confirmed = await confirm({
                message: `Register ${displayName} for ${formatSats(price)}?`,
                default: true,
            });

            if (!confirmed) {
                logger.warn('Registration cancelled.');
                return;
            }
        }

        // Prepare transaction with payment to treasury
        logger.info('Preparing transaction...');
        const sender = getWalletAddress(wallet);
        const contract = getResolverContract(network, sender);

        const extraUtxo: PsbtOutputExtended = {
            address: treasuryAddr,
            value: Number(price),
        };

        // Set transaction details for simulation
        const outSimulation: StrippedTransactionOutput[] = [
            {
                index: 1,
                to: treasuryAddr,
                value: price,
                flags: TransactionOutputFlags.hasTo,
                scriptPubKey: undefined,
            },
        ];

        contract.setTransactionDetails({
            inputs: [],
            outputs: outSimulation,
        });

        // Simulate the registration
        const registerResult = await contract.registerDomain(name);

        if (registerResult.revert) {
            logger.fail('Registration would fail');
            logger.error(`Reason: ${registerResult.revert}`);
            process.exit(1);
        }

        if (registerResult.estimatedGas) {
            logger.info(`Estimated gas: ${registerResult.estimatedGas} sats`);
        }

        // Build and send transaction
        const txParams = buildTransactionParams(
            wallet,
            network,
            DEFAULT_MAX_SAT_TO_SPEND + price,
            DEFAULT_FEE_RATE,
            extraUtxo,
        );

        const receipt = await registerResult.sendTransaction(txParams);

        logger.log('');
        logger.success('Domain registration submitted!');
        logger.log('');
        logger.log(`Domain:         ${displayName}`);
        logger.log(`Transaction ID: ${receipt.transactionId}`);
        logger.log(`Fees paid:      ${formatSats(receipt.estimatedFees)}`);
        logger.log('');

        // Wait for confirmation
        const confirmationResult = await waitForTransactionConfirmation(
            receipt.transactionId,
            network,
            {
                message: 'Waiting for registration confirmation',
            },
        );

        if (!confirmationResult.confirmed) {
            if (confirmationResult.revert) {
                logger.fail('Registration failed');
                logger.error(`Reason: ${confirmationResult.revert}`);
            } else if (confirmationResult.error) {
                logger.warn('Registration not yet confirmed');
                logger.warn(confirmationResult.error);
            }
        } else {
            logger.log('');
            logger.success(`You now own ${displayName}!`);
            logger.info('Next step: publish your website with:');
            logger.log(`  opnet website ${name} <ipfs-cid> -n ${network}`);
        }
    } catch (error) {
        logger.fail('Domain registration failed');
        if (error instanceof Error && error.message.includes('User force closed')) {
            logger.warn('Registration cancelled.');
            process.exit(0);
        }
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

/**
 * Get information about a .btc domain
 */
async function domainInfo(domain: string, options: DomainInfoOptions): Promise<void> {
    try {
        const network = (options.network || 'mainnet') as NetworkName;

        // Parse domain name
        const name = parseDomainName(domain.toLowerCase());
        const displayName = `${name}.btc`;

        logger.info(`Looking up: ${displayName}`);

        // Get domain info
        const domainData = await getDomain(name, network);

        if (!domainData) {
            logger.warn(`Domain ${displayName} is not registered`);

            // Show pricing info
            const price = await getDomainPrice(name, network);
            logger.log('');
            logger.info('Registration Info');
            logger.log('-'.repeat(50));
            logger.log(`Domain:       ${displayName}`);
            logger.log(`Status:       Available`);
            logger.log(`Price:        ${formatSats(price)}`);
            if (name.length === 3) {
                logger.log(`Pricing tier: Premium (3-character)`);
            } else if (name.length === 4) {
                logger.log(`Pricing tier: Premium (4-character)`);
            } else {
                logger.log(`Pricing tier: Standard`);
            }
            logger.log('');
            logger.info('Register with:');
            logger.log(`  opnet domain register ${name} -n ${network}`);
            return;
        }

        // Get contenthash info
        const contenthash = await getContenthash(name, network);

        // Display domain info
        logger.log('');
        logger.info('Domain Information');
        logger.log('-'.repeat(50));
        logger.log(`Domain:       ${displayName}`);
        logger.log(`Status:       Registered`);
        logger.log(`Owner:        ${domainData.owner.toHex()}`);
        logger.log(`Created at:   Block #${domainData.createdAt}`);
        logger.log(`TTL:          ${domainData.ttl} seconds`);

        if (contenthash.hashType !== 0) {
            logger.log('');
            logger.info('Website (Contenthash)');
            logger.log('-'.repeat(50));
            logger.log(`Type:         ${getContenthashTypeName(contenthash.hashType)}`);
            if (contenthash.hashString) {
                logger.log(`Value:        ${contenthash.hashString}`);
                if (contenthash.hashType === 1 || contenthash.hashType === 2) {
                    logger.log(
                        `Gateway URL:  https://ipfs.opnet.org/ipfs/${contenthash.hashString}`,
                    );
                } else if (contenthash.hashType === 3) {
                    logger.log(
                        `Gateway URL:  https://ipfs.opnet.org/ipns/${contenthash.hashString}`,
                    );
                }
            } else {
                // SHA256 hash
                const hashHex = Buffer.from(contenthash.hashData).toString('hex');
                logger.log(`Value:        ${hashHex}`);
            }
        } else {
            logger.log('');
            logger.warn('No website published');
            logger.info('Publish with:');
            logger.log(`  opnet website ${name} <ipfs-cid> -n ${network}`);
        }

        logger.log('');
    } catch (error) {
        logger.fail('Failed to get domain info');
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Create the domain command with subcommands
const domainCommand = new Command('domain').description('Manage .btc domains');

// Register subcommand
domainCommand
    .command('register')
    .description('Register a new .btc domain')
    .argument('<name>', 'Domain name to register (without .btc suffix)')
    .option('-n, --network <network>', 'Network to use', 'mainnet')
    .option('--dry-run', 'Show what would happen without registering')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action((name: string, options: DomainRegisterOptions) => registerDomain(name, options));

// Info subcommand
domainCommand
    .command('info')
    .description('Get information about a .btc domain')
    .argument('<name>', 'Domain name to look up (with or without .btc suffix)')
    .option('-n, --network <network>', 'Network to use', 'mainnet')
    .action((name: string, options: DomainInfoOptions) => domainInfo(name, options));

export { domainCommand };
