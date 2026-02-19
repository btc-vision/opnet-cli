/**
 * Sign command - Sign or re-sign a .opnet binary
 *
 * @module commands/SignCommand
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { BaseCommand } from './BaseCommand.js';
import { buildOpnetBinary, formatFileSize, parseOpnetBinary, toHex } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { canSign, loadCredentials } from '../lib/credentials.js';

interface SignOptions {
    output?: string;
    force?: boolean;
}

export class SignCommand extends BaseCommand {
    constructor() {
        super('sign', 'Sign or re-sign a .opnet binary with your MLDSA key');
    }

    protected configure(): void {
        this.command
            .argument('<file>', 'Path to .opnet file')
            .option('-o, --output <path>', 'Output file path (default: overwrites input)')
            .option('--force', 'Force re-signing even if already signed by different key')
            .action((file: string, options: SignOptions) => this.execute(file, options));
    }

    private execute(file: string, options: SignOptions): void {
        try {
            if (!fs.existsSync(file)) {
                this.exitWithError(`File not found: ${file}`);
            }

            // Load credentials
            this.logger.info('Loading wallet...');
            const credentials = loadCredentials();

            if (!credentials || !canSign(credentials)) {
                this.logger.fail('No credentials configured');
                this.logger.warn('To sign plugins, run: opnet login');
                process.exit(1);
            }

            const wallet = CLIWallet.fromCredentials(credentials);
            this.logger.success(`Wallet loaded (MLDSA-${wallet.securityLevel})`);

            // Parse existing binary
            this.logger.info('Parsing binary...');
            const data = fs.readFileSync(file);
            const parsed = parseOpnetBinary(data);
            this.logger.success(`Parsed: ${parsed.metadata.name}@${parsed.metadata.version}`);

            // Check if already signed by a different key
            const isUnsigned = parsed.publicKey.every((b) => b === 0);
            const currentPkHash = crypto
                .createHash('sha256')
                .update(parsed.publicKey)
                .digest('hex');
            const newPkHash = wallet.mldsaPublicKeyHash;

            if (!isUnsigned && currentPkHash !== newPkHash && !options.force) {
                this.logger.log('');
                this.logger.warn('Warning: This binary is already signed by a different key.');
                this.logger.log(`  Current signer: ${currentPkHash.substring(0, 32)}...`);
                this.logger.log(`  Your key:       ${newPkHash.substring(0, 32)}...`);
                this.logger.log('');
                this.logger.log('Use --force to re-sign with your key.');
                process.exit(1);
            }

            // Rebuild binary with signing
            this.logger.info('Signing and rebuilding binary...');
            const signFn = (checksum: Uint8Array) => wallet.signMLDSA(checksum);
            const { binary: newBinary, checksum } = buildOpnetBinary({
                mldsaLevel: wallet.securityLevel,
                publicKey: wallet.mldsaPublicKey,
                metadata: parsed.metadata,
                bytecode: parsed.bytecode,
                proto: parsed.proto,
                signFn,
            });
            this.logger.success(
                `Signed (checksum: sha256:${toHex(checksum).substring(0, 16)}...)`,
            );
            this.logger.success(`Binary rebuilt (${formatFileSize(newBinary.length)})`);

            // Write output
            const outputPath = options.output || file;
            fs.writeFileSync(outputPath, newBinary);

            this.logger.log('');
            this.logger.success('Plugin signed successfully!');
            this.logger.log('');
            this.logger.log(`Output:       ${outputPath}`);
            this.logger.log(`Plugin:       ${parsed.metadata.name}@${parsed.metadata.version}`);
            this.logger.log(`MLDSA Level:  ${wallet.securityLevel}`);
            this.logger.log(`Publisher:    ${newPkHash.substring(0, 32)}...`);
            this.logger.log('');
        } catch (error) {
            this.logger.fail('Signing failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const signCommand = new SignCommand().getCommand();
