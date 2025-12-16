/**
 * Transaction helper for OPNet CLI
 *
 * Provides utilities for building and executing registry transactions.
 *
 * @module lib/transaction
 */

import { Address } from '@btc-vision/transaction';
import { TransactionParameters } from 'opnet';
import ora, { Ora } from 'ora';

import { CLIWallet, getNetwork } from './wallet.js';
import { NetworkName } from '../types/index.js';
import { getProvider } from './provider.js';
import { PsbtOutputExtended } from '@btc-vision/bitcoin';

/** Default maximum satoshis to spend per transaction */
export const DEFAULT_MAX_SAT_TO_SPEND = 100_000n;

/** Default fee rate in sat/vbyte */
export const DEFAULT_FEE_RATE = 6;

/**
 * Build TransactionParameters from a CLIWallet
 *
 * @param wallet - The CLI wallet instance
 * @param network - Target network name
 * @param maxSatToSpend - Maximum satoshis to spend (optional)
 * @param feeRate - Fee rate in sat/vbyte (optional)
 * @param extra
 * @returns TransactionParameters for contract calls
 */
export function buildTransactionParams(
    wallet: CLIWallet,
    network: NetworkName,
    maxSatToSpend: bigint = DEFAULT_MAX_SAT_TO_SPEND,
    feeRate: number = DEFAULT_FEE_RATE,
    extra?: PsbtOutputExtended,
): TransactionParameters {
    const bitcoinNetwork = getNetwork(network);

    return {
        signer: wallet.keypair,
        mldsaSigner: wallet.mldsaKeypair,
        refundTo: wallet.p2trAddress,
        maximumAllowedSatToSpend: maxSatToSpend,
        network: bitcoinNetwork,
        feeRate,
        extraOutputs: extra ? [extra] : undefined,
    };
}

/**
 * Get the sender Address from a wallet
 *
 * @param wallet - The CLI wallet
 * @returns Address instance for the wallet
 */
export function getWalletAddress(wallet: CLIWallet): Address {
    return wallet.address;
}

/**
 * Format satoshis for display
 *
 * @param sats - Amount in satoshis
 * @returns Formatted string with BTC equivalent
 */
export function formatSats(sats: bigint): string {
    const btc = Number(sats) / 100_000_000;
    if (btc >= 0.001) {
        return `${sats} sats (${btc.toFixed(8)} BTC)`;
    }
    return `${sats} sats`;
}

/**
 * Check if wallet has sufficient balance for transaction
 *
 * @param wallet - The CLI wallet
 * @param network - Target network
 * @param minBalance - Minimum required balance in satoshis
 * @returns True if balance is sufficient
 */
export async function checkBalance(
    wallet: CLIWallet,
    network: NetworkName,
    minBalance: bigint = 10_000n,
): Promise<{ sufficient: boolean; balance: bigint }> {
    const provider = getProvider(network);
    const balance = await provider.getBalance(wallet.p2trAddress);

    return {
        sufficient: balance >= minBalance,
        balance,
    };
}

/** Default polling interval in milliseconds */
export const DEFAULT_POLL_INTERVAL = 10_000;

/** Default maximum wait time in milliseconds (10 minutes) */
export const DEFAULT_MAX_WAIT_TIME = 600_000;

export interface TransactionConfirmationResult {
    confirmed: boolean;
    blockNumber?: bigint;
    revert?: string;
    error?: string;
}

/**
 * Wait for a transaction to be confirmed on-chain
 *
 * Polls the transaction status every pollInterval ms until:
 * - The transaction is confirmed (has a blockNumber)
 * - The transaction fails (has a revert)
 * - The maximum wait time is exceeded
 *
 * @param txHash - The transaction hash to wait for
 * @param network - Target network
 * @param options - Optional configuration
 * @returns Transaction confirmation result
 */
export async function waitForTransactionConfirmation(
    txHash: string,
    network: NetworkName,
    options?: {
        pollInterval?: number;
        maxWaitTime?: number;
        message?: string;
    },
): Promise<TransactionConfirmationResult> {
    const pollInterval = options?.pollInterval ?? DEFAULT_POLL_INTERVAL;
    const maxWaitTime = options?.maxWaitTime ?? DEFAULT_MAX_WAIT_TIME;
    const message = options?.message ?? 'Waiting for transaction confirmation';

    const provider = getProvider(network);
    const startTime = Date.now();

    const spinner: Ora = ora({
        text: `${message} (0s elapsed)`,
        spinner: 'dots',
    }).start();

    const updateSpinnerText = (): void => {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        spinner.text = `${message} (${elapsed}s elapsed)`;
    };

    // Update spinner text every second
    const textUpdateInterval = setInterval(updateSpinnerText, 1000);

    try {
        while (Date.now() - startTime < maxWaitTime) {
            try {
                const tx = await provider.getTransaction(txHash);

                // Check if transaction has a block number (confirmed)
                if (tx.blockNumber !== undefined && tx.blockNumber !== null) {
                    const blockNum =
                        typeof tx.blockNumber === 'bigint'
                            ? tx.blockNumber
                            : BigInt(tx.blockNumber);
                    spinner.succeed(`Transaction confirmed in block ${blockNum}`);
                    return {
                        confirmed: true,
                        blockNumber: blockNum,
                    };
                }

                // Check if transaction reverted
                if (tx.revert) {
                    spinner.fail(`Transaction reverted: ${tx.revert}`);
                    return {
                        confirmed: false,
                        revert: tx.revert,
                    };
                }
            } catch {
                // Transaction not found yet, continue polling
            }

            // Wait before next poll
            await sleep(pollInterval);
        }

        // Timeout reached
        spinner.fail(`Timeout waiting for transaction confirmation`);
        return {
            confirmed: false,
            error: `Transaction not confirmed within ${maxWaitTime / 1000} seconds`,
        };
    } finally {
        clearInterval(textUpdateInterval);
    }
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
