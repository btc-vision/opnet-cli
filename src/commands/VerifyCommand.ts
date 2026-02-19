/**
 * Verify command - Verify .opnet binary signature
 *
 * @module commands/VerifyCommand
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { BaseCommand } from './BaseCommand.js';
import { formatFileSize, parseOpnetBinary, toHex, verifyChecksum } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { CLIMldsaLevel } from '../types/index.js';

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
                    this.logger.log(
                        JSON.stringify({ valid: false, error: `File not found: ${file}` }),
                    );
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
                    this.logger.log(
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
            const mldsaLevel = ([44, 65, 87] as const)[parsed.mldsaLevel] as CLIMldsaLevel;

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
                    metadata: parsed.metadata,
                    publicKeyHash: crypto
                        .createHash('sha256')
                        .update(parsed.publicKey)
                        .digest('hex'),
                    bytecodeSize: parsed.bytecode.length,
                    protoSize: parsed.proto?.length ?? 0,
                };
                this.logger.log(JSON.stringify(output, null, 2));
                process.exit(isValid ? 0 : 1);
            }

            // Display results
            this.logger.info('\nOPNet Binary Verification\n');
            this.logger.log('─'.repeat(60));

            // File info
            this.logger.log(`File:            ${file}`);
            this.logger.log(`Size:            ${formatFileSize(fileSize)}`);
            this.logger.log(`Format Version:  ${parsed.formatVersion}`);
            this.logger.log('');

            // Plugin info
            this.logger.log('Plugin:');
            this.logger.log(`  Name:           ${parsed.metadata.name}`);
            this.logger.log(`  Version:        ${parsed.metadata.version}`);
            this.logger.log(`  Type:           ${parsed.metadata.pluginType}`);
            this.logger.log(`  OPNet Version:  ${parsed.metadata.opnetVersion}`);
            this.logger.log('');

            // Cryptographic info
            this.logger.log('Cryptography:');
            this.logger.log(`  MLDSA Level:    MLDSA-${mldsaLevel}`);
            this.logger.log(`  Public Key:     ${formatFileSize(parsed.publicKey.length)}`);
            this.logger.log(`  Signature:      ${formatFileSize(parsed.signature.length)}`);

            if (!isUnsigned) {
                const pkHash = crypto.createHash('sha256').update(parsed.publicKey).digest('hex');
                this.logger.log(`  PubKey Hash:    ${pkHash.substring(0, 16)}...`);
            }
            this.logger.log('');

            // Verification results
            this.logger.log('Verification:');
            this.logger.log(`  Checksum:       ${checksumValid ? 'VALID' : 'INVALID'}`);

            if (isUnsigned) {
                this.logger.log(`  Signature:      UNSIGNED`);
            } else if (signatureError) {
                this.logger.log(`  Signature:      ERROR - ${signatureError}`);
            } else {
                this.logger.log(`  Signature:      ${signatureValid ? 'VALID' : 'INVALID'}`);
            }

            this.logger.log('');
            this.logger.log('─'.repeat(60));

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
            this.logger.log('');

            // Verbose output
            if (options.verbose) {
                this.logger.log('Sizes:');
                this.logger.log(`  Metadata:       ${formatFileSize(parsed.rawMetadata.length)}`);
                this.logger.log(`  Bytecode:       ${formatFileSize(parsed.bytecode.length)}`);
                this.logger.log(`  Proto:          ${formatFileSize(parsed.proto?.length ?? 0)}`);
                this.logger.log('');

                this.logger.log('Checksums:');
                this.logger.log(`  Stored:         ${toHex(parsed.checksum)}`);
                this.logger.log('');

                this.logger.log('Author:');
                this.logger.log(`  Name:           ${parsed.metadata.author.name}`);
                if (parsed.metadata.author.email) {
                    this.logger.log(`  Email:          ${parsed.metadata.author.email}`);
                }
                this.logger.log('');

                this.logger.log('Permissions:');
                const perms = parsed.metadata.permissions;
                if (perms) {
                    this.logger.log(`  Database:       ${perms.database?.enabled ? 'Yes' : 'No'}`);
                    this.logger.log(
                        `  Block Hooks:    ${perms.blocks?.preProcess || perms.blocks?.postProcess || perms.blocks?.onChange ? 'Yes' : 'No'}`,
                    );
                    this.logger.log(
                        `  Epoch Hooks:    ${perms.epochs?.onChange || perms.epochs?.onFinalized ? 'Yes' : 'No'}`,
                    );
                    this.logger.log(`  Mempool Feed:   ${perms.mempool?.txFeed ? 'Yes' : 'No'}`);
                    this.logger.log(`  API Endpoints:  ${perms.api?.addEndpoints ? 'Yes' : 'No'}`);
                    this.logger.log(`  Websocket:      ${perms.api?.addWebsocket ? 'Yes' : 'No'}`);
                    this.logger.log(
                        `  Filesystem:     ${perms.filesystem?.configDir || perms.filesystem?.tempDir ? 'Yes' : 'No'}`,
                    );
                } else {
                    this.logger.log('  (none configured)');
                }
                this.logger.log('');
            }

            process.exit(isValid ? 0 : 1);
        } catch (error) {
            this.exitWithError(this.formatError(error));
        }
    }
}

export const verifyCommand = new VerifyCommand().getCommand();
