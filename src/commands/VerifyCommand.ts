/**
 * Verify command - Verify .opnet binary signature
 *
 * @module commands/VerifyCommand
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, verifyChecksum, formatFileSize } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { MLDSALevel } from '../types/index.js';

interface VerifyOptions {
    verbose?: boolean;
    json?: boolean;
}

export class VerifyCommand extends BaseCommand {
    constructor() {
        super('verify', 'Verify a .opnet binary signature and integrity');
    }

    protected configure(): void {
        this.command
            .argument('<file>', 'Path to .opnet file')
            .option('-v, --verbose', 'Show detailed information')
            .option('--json', 'Output as JSON')
            .action((file: string, options: VerifyOptions) => this.execute(file, options));
    }

    private execute(file: string, options: VerifyOptions): void {
        try {
            if (!fs.existsSync(file)) {
                if (options.json) {
                    console.log(JSON.stringify({ valid: false, error: `File not found: ${file}` }));
                    process.exit(1);
                }
                this.exitWithError(`File not found: ${file}`);
            }

            const data = fs.readFileSync(file);
            const fileSize = data.length;

            // Parse binary
            let parsed;
            try {
                parsed = parseOpnetBinary(data);
            } catch (error) {
                if (options.json) {
                    console.log(
                        JSON.stringify({
                            valid: false,
                            error: `Parse error: ${error instanceof Error ? error.message : String(error)}`,
                        }),
                    );
                    process.exit(1);
                }
                this.exitWithError(
                    `Parse error: ${error instanceof Error ? error.message : String(error)}`,
                );
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
                    signatureValid = CLIWallet.verifyMLDSA(
                        parsed.checksum,
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
                    publicKeyHash: crypto.createHash('sha256').update(parsed.publicKey).digest('hex'),
                    bytecodeSize: parsed.bytecode.length,
                    protoSize: parsed.proto.length,
                };
                console.log(JSON.stringify(output, null, 2));
                process.exit(isValid ? 0 : 1);
            }

            // Display results
            this.logger.info('\nOPNet Binary Verification\n');
            console.log('─'.repeat(60));

            // File info
            console.log(`File:            ${file}`);
            console.log(`Size:            ${formatFileSize(fileSize)}`);
            console.log(`Format Version:  ${parsed.formatVersion}`);
            console.log('');

            // Plugin info
            console.log('Plugin:');
            console.log(`  Name:           ${parsed.metadataObj.name}`);
            console.log(`  Version:        ${parsed.metadataObj.version}`);
            console.log(`  Type:           ${parsed.metadataObj.pluginType}`);
            console.log(`  OPNet Version:  ${parsed.metadataObj.opnetVersion}`);
            console.log('');

            // Cryptographic info
            console.log('Cryptography:');
            console.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
            console.log(`  Public Key:     ${formatFileSize(parsed.publicKey.length)}`);
            console.log(`  Signature:      ${formatFileSize(parsed.signature.length)}`);

            if (!isUnsigned) {
                const pkHash = crypto.createHash('sha256').update(parsed.publicKey).digest('hex');
                console.log(`  PubKey Hash:    ${pkHash.substring(0, 16)}...`);
            }
            console.log('');

            // Verification results
            console.log('Verification:');
            console.log(`  Checksum:       ${checksumValid ? 'VALID' : 'INVALID'}`);

            if (isUnsigned) {
                console.log(`  Signature:      UNSIGNED`);
            } else if (signatureError) {
                console.log(`  Signature:      ERROR - ${signatureError}`);
            } else {
                console.log(`  Signature:      ${signatureValid ? 'VALID' : 'INVALID'}`);
            }

            console.log('');
            console.log('─'.repeat(60));

            if (isUnsigned) {
                this.logger.warn('WARNING: This binary is unsigned and cannot be published.');
                this.logger.warn('Use `opnet sign` to sign it.');
            } else if (isValid) {
                this.logger.success('VERIFIED: Binary is valid and properly signed.');
            } else {
                this.logger.fail('FAILED: Binary verification failed.');
                if (!checksumValid) {
                    this.logger.error('  - Checksum mismatch (binary may be corrupted)');
                }
                if (!signatureValid && !signatureError) {
                    this.logger.error('  - Signature invalid (binary may be tampered)');
                }
            }
            console.log('');

            // Verbose output
            if (options.verbose) {
                console.log('Sizes:');
                console.log(`  Metadata:       ${formatFileSize(Buffer.from(parsed.metadata).length)}`);
                console.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
                console.log(`  Proto:          ${formatFileSize(parsed.proto.length)}`);
                console.log('');

                console.log('Checksums:');
                console.log(`  Stored:         ${parsed.checksum.toString('hex')}`);
                console.log('');

                console.log('Author:');
                console.log(`  Name:           ${parsed.metadataObj.author.name}`);
                if (parsed.metadataObj.author.email) {
                    console.log(`  Email:          ${parsed.metadataObj.author.email}`);
                }
                console.log('');

                console.log('Permissions:');
                const perms = parsed.metadataObj.permissions;
                console.log(`  Database:       ${perms.database.enabled ? 'Yes' : 'No'}`);
                console.log(
                    `  Block Hooks:    ${perms.blocks.preProcess || perms.blocks.postProcess || perms.blocks.onChange ? 'Yes' : 'No'}`,
                );
                console.log(
                    `  Epoch Hooks:    ${perms.epochs.onChange || perms.epochs.onFinalized ? 'Yes' : 'No'}`,
                );
                console.log(`  Mempool Feed:   ${perms.mempool.txFeed ? 'Yes' : 'No'}`);
                console.log(`  API Endpoints:  ${perms.api.addEndpoints ? 'Yes' : 'No'}`);
                console.log(`  Websocket:      ${perms.api.addWebsocket ? 'Yes' : 'No'}`);
                console.log(
                    `  Filesystem:     ${perms.filesystem.configDir || perms.filesystem.tempDir ? 'Yes' : 'No'}`,
                );
                console.log('');
            }

            process.exit(isValid ? 0 : 1);
        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }
}

export const verifyCommand = new VerifyCommand().getCommand();
