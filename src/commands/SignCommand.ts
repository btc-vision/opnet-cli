/**
 * Sign command - Sign or re-sign a .opnet binary
 *
 * @module commands/SignCommand
 */

import * as fs from 'fs';
import * as crypto from 'crypto';
import { BaseCommand } from './BaseCommand.js';
import { parseOpnetBinary, buildOpnetBinary, computeChecksum, formatFileSize } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { loadCredentials, canSign } from '../lib/credentials.js';

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
            this.logger.success(`Parsed: ${parsed.metadataObj.name}@${parsed.metadataObj.version}`);

            // Check if already signed by a different key
            const isUnsigned = parsed.publicKey.every((b) => b === 0);
            const currentPkHash = crypto.createHash('sha256').update(parsed.publicKey).digest('hex');
            const newPkHash = wallet.mldsaPublicKeyHash;

            if (!isUnsigned && currentPkHash !== newPkHash && !options.force) {
                console.log('');
                this.logger.warn('Warning: This binary is already signed by a different key.');
                console.log(`  Current signer: ${currentPkHash.substring(0, 32)}...`);
                console.log(`  Your key:       ${newPkHash.substring(0, 32)}...`);
                console.log('');
                console.log('Use --force to re-sign with your key.');
                process.exit(1);
            }

            // Compute new signature
            this.logger.info('Signing...');
            const metadataBytes = Buffer.from(parsed.metadata, 'utf-8');
            const checksum = computeChecksum(metadataBytes, parsed.bytecode, parsed.proto);
            const signature = wallet.signMLDSA(checksum);
            this.logger.success(`Signed (${formatFileSize(signature.length)} signature)`);

            // Rebuild binary
            this.logger.info('Rebuilding binary...');
            const newBinary = buildOpnetBinary({
                mldsaLevel: wallet.securityLevel,
                publicKey: wallet.mldsaPublicKey,
                signature,
                metadata: parsed.metadataObj,
                bytecode: parsed.bytecode,
                proto: parsed.proto,
            });
            this.logger.success(`Binary rebuilt (${formatFileSize(newBinary.length)})`);

            // Write output
            const outputPath = options.output || file;
            fs.writeFileSync(outputPath, newBinary);

            console.log('');
            this.logger.success('Plugin signed successfully!');
            console.log('');
            console.log(`Output:       ${outputPath}`);
            console.log(`Plugin:       ${parsed.metadataObj.name}@${parsed.metadataObj.version}`);
            console.log(`MLDSA Level:  ${wallet.securityLevel}`);
            console.log(`Publisher:    ${newPkHash.substring(0, 32)}...`);
            console.log('');
        } catch (error) {
            this.logger.fail('Signing failed');
            this.exitWithError(this.formatError(error));
        }
    }
}

export const signCommand = new SignCommand().getCommand();
