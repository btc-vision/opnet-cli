#!/usr/bin/env node
/**
 * OPNet CLI - Command Line Interface for OPNet Plugin Ecosystem
 *
 * @module @btc-vision/cli
 */

import { Command } from 'commander';
import chalk from 'chalk';

// Commands
import { configCommand } from './commands/config.js';
import { loginCommand } from './commands/login.js';
import { logoutCommand } from './commands/logout.js';
import { whoamiCommand } from './commands/whoami.js';
import { keygenCommand } from './commands/keygen.js';
import { initCommand } from './commands/init.js';
import { compileCommand } from './commands/compile.js';
import { verifyCommand } from './commands/verify.js';
import { infoCommand } from './commands/info.js';
import { signCommand } from './commands/sign.js';
import { publishCommand } from './commands/publish.js';
import { deprecateCommand } from './commands/deprecate.js';
import { undeprecateCommand } from './commands/undeprecate.js';
import { transferCommand } from './commands/transfer.js';
import { acceptCommand } from './commands/accept.js';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { listCommand } from './commands/list.js';
import { searchCommand } from './commands/search.js';

const program = new Command();

program
    .name('opnet')
    .description('OPNet CLI - Build, sign, and publish plugins for the OPNet ecosystem')
    .version('1.0.0');

// Configuration commands
program.addCommand(configCommand);
program.addCommand(loginCommand);
program.addCommand(logoutCommand);
program.addCommand(whoamiCommand);
program.addCommand(keygenCommand);

// Plugin development commands
program.addCommand(initCommand);
program.addCommand(compileCommand);
program.addCommand(verifyCommand);
program.addCommand(infoCommand);
program.addCommand(signCommand);

// Registry commands
program.addCommand(publishCommand);
program.addCommand(deprecateCommand);
program.addCommand(undeprecateCommand);
program.addCommand(transferCommand);
program.addCommand(acceptCommand);
program.addCommand(installCommand);
program.addCommand(updateCommand);
program.addCommand(listCommand);
program.addCommand(searchCommand);

// Error handling
program.showHelpAfterError();
program.showSuggestionAfterError();

// Custom error handling
program.exitOverride((err) => {
    if (err.code === 'commander.help') {
        process.exit(0);
    }
    if (err.code === 'commander.version') {
        process.exit(0);
    }
    console.error(chalk.red(`Error: ${err.message}`));
    process.exit(1);
});

// Parse command line arguments
program.parseAsync(process.argv).catch((error: Error) => {
    console.error(chalk.red(`Error: ${error.message}`));
    process.exit(1);
});
