#!/usr/bin/env node
/**
 * OPNet CLI - Command Line Interface for OPNet Plugin Ecosystem
 *
 * @module @btc-vision/cli
 */

import { Command } from 'commander';
import { Logger } from '@btc-vision/logger';

// Commands
import { configCommand } from './commands/ConfigCommand.js';
import { loginCommand } from './commands/LoginCommand.js';
import { logoutCommand } from './commands/LogoutCommand.js';
import { whoamiCommand } from './commands/WhoamiCommand.js';
import { keygenCommand } from './commands/KeygenCommand.js';
import { initCommand } from './commands/InitCommand.js';
import { compileCommand } from './commands/CompileCommand.js';
import { verifyCommand } from './commands/VerifyCommand.js';
import { infoCommand } from './commands/InfoCommand.js';
import { signCommand } from './commands/SignCommand.js';
import { publishCommand } from './commands/PublishCommand.js';
import { deprecateCommand } from './commands/DeprecateCommand.js';
import { undeprecateCommand } from './commands/UndeprecateCommand.js';
import { transferCommand } from './commands/TransferCommand.js';
import { acceptCommand } from './commands/AcceptCommand.js';
import { scopeRegisterCommand } from './commands/ScopeRegisterCommand.js';
import { installCommand } from './commands/InstallCommand.js';
import { updateCommand } from './commands/UpdateCommand.js';
import { listCommand } from './commands/ListCommand.js';
import { searchCommand } from './commands/SearchCommand.js';

const logger = new Logger();
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
program.addCommand(scopeRegisterCommand);
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
    logger.error(`Error: ${err.message}`);
    process.exit(1);
});

// Parse command line arguments
program.parseAsync(process.argv).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Error: ${message}`);
    process.exit(1);
});
