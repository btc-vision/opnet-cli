/**
 * Sign command - Sign or re-sign a .opnet binary
 *
 * @module commands/sign
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs';
import * as path from 'path';
import { parseOpnetBinary, buildOpnetBinary, computeChecksum, formatFileSize } from '../lib/binary.js';
import { CLIWallet } from '../lib/wallet.js';
import { loadCredentials, canSign } from '../lib/credentials.js';

export const signCommand = new Command('sign')
    .description('Sign or re-sign a .opnet binary with your MLDSA key')
    .argument('<file>', 'Path to .opnet file')
    .option('-o, --output <path>', 'Output file path (default: overwrites input)')
    .option('--force', 'Force re-signing even if already signed by different key')
    .action(async (file: string, options: { output?: string; force?: boolean }) => {
        const spinner = ora();

        try {
            if (!fs.existsSync(file)) {
                console.error(chalk.red(`File not found: ${file}`));
                process.exit(1);
            }

            // Load credentials
            spinner.start('Loading wallet...');
            const credentials = loadCredentials();

            if (!credentials || !canSign(credentials)) {
                spinner.fail('No credentials configured');
                console.log(chalk.yellow('\nTo sign plugins, run: opnet login'));
                process.exit(1);
            }

            const wallet = CLIWallet.fromCredentials(credentials);
            spinner.succeed(`Wallet loaded (MLDSA-${wallet.securityLevel})`);

            // Parse existing binary
            spinner.start('Parsing binary...');
            const data = fs.readFileSync(file);
            const parsed = parseOpnetBinary(data);
            spinner.succeed(`Parsed: ${parsed.metadataObj.name}@${parsed.metadataObj.version}`);

            // Check if already signed by a different key
            const isUnsigned = parsed.publicKey.every((b) => b === 0);
            const currentPkHash = require('crypto')
                .createHash('sha256')
                .update(parsed.publicKey)
                .digest('hex');
            const newPkHash = wallet.mldsaPublicKeyHash;

            if (!isUnsigned && currentPkHash !== newPkHash && !options.force) {
                console.log('');
                console.log(chalk.yellow('Warning: This binary is already signed by a different key.'));
                console.log(chalk.dim(`  Current signer: ${currentPkHash.substring(0, 32)}...`));
                console.log(chalk.dim(`  Your key:       ${newPkHash.substring(0, 32)}...`));
                console.log('');
                console.log('Use --force to re-sign with your key.');
                process.exit(1);
            }

            // Compute new signature
            spinner.start('Signing...');
            const metadataBytes = Buffer.from(parsed.metadata, 'utf-8');
            const checksum = computeChecksum(metadataBytes, parsed.bytecode, parsed.proto);
            const signature = wallet.signMLDSA(checksum);
            spinner.succeed(`Signed (${formatFileSize(signature.length)} signature)`);

            // Rebuild binary
            spinner.start('Rebuilding binary...');
            const newBinary = buildOpnetBinary({
                mldsaLevel: wallet.securityLevel,
                publicKey: wallet.mldsaPublicKey,
                signature,
                metadata: parsed.metadataObj,
                bytecode: parsed.bytecode,
                proto: parsed.proto,
            });
            spinner.succeed(`Binary rebuilt (${formatFileSize(newBinary.length)})`);

            // Write output
            const outputPath = options.output || file;
            fs.writeFileSync(outputPath, newBinary);

            console.log('');
            console.log(chalk.green('Plugin signed successfully!'));
            console.log('');
            console.log(`${chalk.bold('Output:')}       ${outputPath}`);
            console.log(`${chalk.bold('Plugin:')}       ${parsed.metadataObj.name}@${parsed.metadataObj.version}`);
            console.log(`${chalk.bold('MLDSA Level:')}  ${wallet.securityLevel}`);
            console.log(`${chalk.bold('Publisher:')}    ${newPkHash.substring(0, 32)}...`);
            console.log('');

        } catch (error) {
            spinner.fail('Signing failed');
            console.error(chalk.red(`\nError: ${error instanceof Error ? error.message : String(error)}`));
            process.exit(1);
        }
    });
