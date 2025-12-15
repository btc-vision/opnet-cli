/**
 * Verify command - Verify .opnet binary signature
 *
 * @module commands/verify
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs';
import { parseOpnetBinary, verifyChecksum, formatFileSize } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { MLDSALevel, getPublicKeySize, getSignatureSize } from '../types/index.js';

export const verifyCommand = new Command('verify')
    .description('Verify a .opnet binary signature and integrity')
    .argument('<file>', 'Path to .opnet file')
    .option('-v, --verbose', 'Show detailed information')
    .option('--json', 'Output as JSON')
    .action(async (file: string, options: { verbose?: boolean; json?: boolean }) => {
        try {
            if (!fs.existsSync(file)) {
                console.error(chalk.red(`File not found: ${file}`));
                process.exit(1);
            }

            const data = fs.readFileSync(file);
            const fileSize = data.length;

            // Parse binary
            let parsed;
            try {
                parsed = parseOpnetBinary(data);
            } catch (error) {
                if (options.json) {
                    console.log(JSON.stringify({
                        valid: false,
                        error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
                    }));
                } else {
                    console.error(chalk.red(`Parse error: ${error instanceof Error ? error.message : String(error)}`));
                }
                process.exit(1);
            }

            // Get MLDSA level from binary
            const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel] as MLDSALevel;

            // Verify checksum
            const checksumValid = verifyChecksum(parsed);

            // Verify signature
            let signatureValid = false;
            let signatureError: string | undefined;

            // Check if public key is all zeros (unsigned)
            const isUnsigned = parsed.publicKey.every((b) => b === 0);

            if (isUnsigned) {
                signatureError = 'Binary is unsigned (public key is empty)';
            } else {
                try {
                    // Compute what should have been signed
                    const metadataBytes = Buffer.from(parsed.metadata, 'utf-8');
                    const checksum = parsed.checksum;

                    signatureValid = CLIWallet.verifyMLDSA(
                        checksum,
                        parsed.signature,
                        parsed.publicKey,
                        mldsaLevel,
                    );
                } catch (error) {
                    signatureError = error instanceof Error ? error.message : String(error);
                }
            }

            const isValid = checksumValid && signatureValid;

            if (options.json) {
                const output = {
                    valid: isValid,
                    file,
                    fileSize,
                    formatVersion: parsed.formatVersion,
                    mldsaLevel,
                    checksumValid,
                    signatureValid,
                    signatureError,
                    isUnsigned,
                    metadata: parsed.metadataObj,
                    publicKeyHash: require('crypto')
                        .createHash('sha256')
                        .update(parsed.publicKey)
                        .digest('hex'),
                    bytecodeSize: parsed.bytecode.length,
                    protoSize: parsed.proto.length,
                };
                console.log(JSON.stringify(output, null, 2));
                process.exit(isValid ? 0 : 1);
            }

            // Display results
            console.log(chalk.cyan('\nOPNet Binary Verification\n'));
            console.log(chalk.dim('─'.repeat(60)));

            // File info
            console.log(`${chalk.bold('File:')}            ${file}`);
            console.log(`${chalk.bold('Size:')}            ${formatFileSize(fileSize)}`);
            console.log(`${chalk.bold('Format Version:')}  ${parsed.formatVersion}`);
            console.log('');

            // Plugin info
            console.log(chalk.bold('Plugin:'));
            console.log(`  Name:           ${parsed.metadataObj.name}`);
            console.log(`  Version:        ${parsed.metadataObj.version}`);
            console.log(`  Type:           ${parsed.metadataObj.pluginType}`);
            console.log(`  OPNet Version:  ${parsed.metadataObj.opnetVersion}`);
            console.log('');

            // Cryptographic info
            console.log(chalk.bold('Cryptography:'));
            console.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
            console.log(`  Public Key:     ${formatFileSize(parsed.publicKey.length)}`);
            console.log(`  Signature:      ${formatFileSize(parsed.signature.length)}`);

            if (!isUnsigned) {
                const pkHash = require('crypto')
                    .createHash('sha256')
                    .update(parsed.publicKey)
                    .digest('hex');
                console.log(`  PubKey Hash:    ${pkHash.substring(0, 16)}...`);
            }
            console.log('');

            // Verification results
            console.log(chalk.bold('Verification:'));
            console.log(`  Checksum:       ${checksumValid ? chalk.green('VALID') : chalk.red('INVALID')}`);

            if (isUnsigned) {
                console.log(`  Signature:      ${chalk.yellow('UNSIGNED')}`);
            } else if (signatureError) {
                console.log(`  Signature:      ${chalk.red('ERROR')} - ${signatureError}`);
            } else {
                console.log(`  Signature:      ${signatureValid ? chalk.green('VALID') : chalk.red('INVALID')}`);
            }

            console.log('');
            console.log(chalk.dim('─'.repeat(60)));

            if (isUnsigned) {
                console.log(chalk.yellow('WARNING: This binary is unsigned and cannot be published.'));
                console.log(chalk.yellow('Use `opnet sign` to sign it.'));
            } else if (isValid) {
                console.log(chalk.green('VERIFIED: Binary is valid and properly signed.'));
            } else {
                console.log(chalk.red('FAILED: Binary verification failed.'));
                if (!checksumValid) {
                    console.log(chalk.red('  - Checksum mismatch (binary may be corrupted)'));
                }
                if (!signatureValid && !signatureError) {
                    console.log(chalk.red('  - Signature invalid (binary may be tampered)'));
                }
            }
            console.log('');

            // Verbose output
            if (options.verbose) {
                console.log(chalk.bold('Sizes:'));
                console.log(`  Metadata:       ${formatFileSize(Buffer.from(parsed.metadata).length)}`);
                console.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
                console.log(`  Proto:          ${formatFileSize(parsed.proto.length)}`);
                console.log('');

                console.log(chalk.bold('Checksums:'));
                console.log(`  Stored:         ${parsed.checksum.toString('hex')}`);
                console.log('');

                console.log(chalk.bold('Author:'));
                console.log(`  Name:           ${parsed.metadataObj.author.name}`);
                if (parsed.metadataObj.author.email) {
                    console.log(`  Email:          ${parsed.metadataObj.author.email}`);
                }
                console.log('');

                console.log(chalk.bold('Permissions:'));
                const perms = parsed.metadataObj.permissions;
                console.log(`  Database:       ${perms.database.enabled ? 'Yes' : 'No'}`);
                console.log(`  Block Hooks:    ${perms.blocks.preProcess || perms.blocks.postProcess || perms.blocks.onChange ? 'Yes' : 'No'}`);
                console.log(`  Epoch Hooks:    ${perms.epochs.onChange || perms.epochs.onFinalized ? 'Yes' : 'No'}`);
                console.log(`  Mempool Feed:   ${perms.mempool.txFeed ? 'Yes' : 'No'}`);
                console.log(`  API Endpoints:  ${perms.api.addEndpoints ? 'Yes' : 'No'}`);
                console.log(`  Websocket:      ${perms.api.addWebsocket ? 'Yes' : 'No'}`);
                console.log(`  Filesystem:     ${perms.filesystem.configDir || perms.filesystem.tempDir ? 'Yes' : 'No'}`);
                console.log('');
            }

            process.exit(isValid ? 0 : 1);

        } catch (error) {
            console.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
