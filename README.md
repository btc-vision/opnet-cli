# @btc-vision/cli

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Official command-line interface for the OPNet plugin ecosystem. Build, sign, verify, and publish plugins with
quantum-resistant MLDSA signatures. Register `.btc` domains and deploy decentralized websites on Bitcoin L1.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Commands](#commands)
  - [Configuration](#configuration)
    - [`opnet config`](#opnet-config)
  - [Authentication](#authentication)
    - [`opnet login`](#opnet-login)
    - [`opnet logout`](#opnet-logout)
    - [`opnet whoami`](#opnet-whoami)
  - [Key Generation](#key-generation)
    - [`opnet keygen`](#opnet-keygen)
  - [Plugin Development](#plugin-development)
    - [`opnet init`](#opnet-init)
    - [`opnet compile`](#opnet-compile)
    - [`opnet verify`](#opnet-verify)
    - [`opnet info`](#opnet-info)
    - [`opnet sign`](#opnet-sign)
  - [Registry - Publishing](#registry---publishing)
    - [`opnet publish`](#opnet-publish)
    - [`opnet deprecate`](#opnet-deprecate)
    - [`opnet undeprecate`](#opnet-undeprecate)
  - [Registry - Package Management](#registry---package-management)
    - [`opnet install`](#opnet-install)
    - [`opnet update`](#opnet-update)
    - [`opnet list`](#opnet-list)
    - [`opnet search`](#opnet-search)
  - [Registry - Ownership](#registry---ownership)
    - [`opnet scope:register`](#opnet-scoperegister)
    - [`opnet transfer`](#opnet-transfer)
    - [`opnet accept`](#opnet-accept)
  - [Domains & Websites](#domains--websites)
    - [`opnet domain register`](#opnet-domain-register)
    - [`opnet domain info`](#opnet-domain-info)
    - [`opnet website`](#opnet-website)
    - [`opnet deploy`](#opnet-deploy)
- [Configuration Reference](#configuration-reference)
- [Environment Variables](#environment-variables)
- [Credential Storage](#credential-storage)
- [MLDSA Security Levels](#mldsa-security-levels)
- [.opnet Binary Format (OIP-0003)](#opnet-binary-format-oip-0003)
- [Plugin Manifest (plugin.json)](#plugin-manifest-pluginjson)
- [Workflow Examples](#workflow-examples)
- [Security](#security)
- [License](#license)
- [Links](#links)

## Installation

```bash
npm install -g @btc-vision/cli
```

Or use npx without installing:

```bash
npx @btc-vision/cli <command>
```

**Requirements:** Node.js >= 20.0.0

## Quick Start

```bash
# 1. Generate a new wallet mnemonic
opnet keygen mnemonic

# 2. Configure your wallet
opnet login

# 3. Initialize a new plugin project
opnet init my-plugin

# 4. Build and compile
cd my-plugin
npm install
npm run build
opnet compile

# 5. Verify the compiled binary
opnet verify build/my-plugin.opnet

# 6. Publish to the registry
opnet publish
```

## Commands

### Configuration

#### `opnet config`

Manage CLI configuration stored in `~/.opnet/config.json`.

| Subcommand | Description |
|---|---|
| `config get [key]` | Get a configuration value (or all config if no key) |
| `config set <key> <value>` | Set a configuration value |
| `config list` | Display all configuration values |
| `config reset` | Reset configuration to defaults |
| `config path` | Show configuration file path |

**Examples:**

```bash
# Show all configuration
opnet config list

# Get a specific value (dot notation supported)
opnet config get defaultNetwork
opnet config get rpcUrls.mainnet

# Set a value
opnet config set defaultNetwork testnet
opnet config set rpcUrls.regtest "http://localhost:9001"
opnet config set ipfsPinningApiKey "your-api-key"

# Reset to defaults (requires confirmation)
opnet config reset
opnet config reset --yes

# Show config file path
opnet config path
```

**Options for `config reset`:**

| Option | Description |
|---|---|
| `-y, --yes` | Skip confirmation prompt |

---

### Authentication

#### `opnet login`

Configure wallet credentials for signing and publishing. Credentials are stored in `~/.opnet/credentials.json` with restricted permissions (owner read/write only).

**Syntax:** `opnet login [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `-m, --mnemonic <phrase>` | BIP-39 mnemonic phrase (12 or 24 words) | — |
| `--wif <key>` | Bitcoin WIF private key (advanced) | — |
| `--mldsa <key>` | MLDSA private key hex (advanced, requires `--wif`) | — |
| `-l, --mldsa-level <level>` | MLDSA security level: `44`, `65`, or `87` | `44` |
| `-n, --network <network>` | Network: `mainnet`, `testnet`, or `regtest` | `mainnet` |

**Examples:**

```bash
# Interactive mode (recommended) - prompts for mnemonic and network
opnet login

# With mnemonic phrase directly
opnet login --mnemonic "your twelve or twenty four word phrase here ..."

# With specific network
opnet login --mnemonic "your phrase ..." --network regtest

# Advanced: WIF + standalone MLDSA key
opnet login --wif "KwDiBf..." --mldsa "hex-private-key..."
```

After login, the CLI displays your wallet identity (P2TR address and MLDSA public key hash) for verification before saving.

---

#### `opnet logout`

Remove stored wallet credentials from `~/.opnet/credentials.json`. If credentials are set via environment variables, it displays instructions for unsetting them instead.

**Syntax:** `opnet logout [options]`

**Options:**

| Option | Description |
|---|---|
| `-y, --yes` | Skip confirmation prompt |

**Examples:**

```bash
opnet logout
opnet logout --yes
```

---

#### `opnet whoami`

Display current wallet identity and configuration details.

**Syntax:** `opnet whoami [options]`

**Options:**

| Option | Description |
|---|---|
| `-v, --verbose` | Show detailed information (auth method, masked mnemonic/WIF, public key size) |
| `--public-key` | Show full MLDSA public key (hex) |

**Examples:**

```bash
# Basic identity
opnet whoami

# Detailed info including auth method and masked secrets
opnet whoami --verbose

# Include full MLDSA public key
opnet whoami --public-key
```

**Output includes:**
- Network
- MLDSA security level
- Auth source (file or environment variable)
- P2TR address
- MLDSA public key hash

---

### Key Generation

#### `opnet keygen`

Generate cryptographic keys. Has three subcommands: `mnemonic`, `mldsa`, and `info`.

##### `opnet keygen mnemonic`

Generate a new BIP-39 mnemonic phrase.

**Options:**

| Option | Description |
|---|---|
| `-o, --output <file>` | Write mnemonic to file (with secure 0600 permissions) |

```bash
# Display mnemonic in terminal
opnet keygen mnemonic

# Save to file
opnet keygen mnemonic --output my-mnemonic.txt
```

##### `opnet keygen mldsa`

Generate a standalone MLDSA keypair.

**Options:**

| Option | Description | Default |
|---|---|---|
| `-l, --level <level>` | MLDSA security level: `44`, `65`, or `87` | `44` |
| `-o, --output <prefix>` | Write keys to `<prefix>.private.key` and `<prefix>.public.key` | — |
| `--json` | Output as JSON | — |

```bash
# Generate and display MLDSA-44 keypair
opnet keygen mldsa

# Generate MLDSA-65 keypair
opnet keygen mldsa --level 65

# Save to files
opnet keygen mldsa --output my-key
# Creates: my-key.private.key (0600) and my-key.public.key (0644)

# JSON output
opnet keygen mldsa --json
```

##### `opnet keygen info`

Display information about MLDSA key sizes across all security levels.

```bash
opnet keygen info
```

Output:

```
Level        Public Key     Private Key    Signature
────────────────────────────────────────────────────────────
MLDSA-44     1,312 bytes    2,560 bytes    2,420 bytes
MLDSA-65     1,952 bytes    4,032 bytes    3,309 bytes
MLDSA-87     2,592 bytes    4,896 bytes    4,627 bytes
```

---

### Plugin Development

#### `opnet init`

Scaffold a new OPNet plugin project in the current directory.

**Syntax:** `opnet init [name] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `[name]` | Plugin name | Current directory name (interactive prompt) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-t, --template <type>` | Template type: `standalone` or `library` | `standalone` |
| `-y, --yes` | Skip prompts and use defaults | — |
| `--force` | Overwrite existing files | — |

**Examples:**

```bash
# Interactive mode - prompts for name, description, author, type
opnet init

# With name
opnet init my-plugin

# Library template with defaults
opnet init my-lib --template library --yes

# Overwrite existing project files
opnet init my-plugin --force
```

**Generated files:**

| File | Description |
|---|---|
| `plugin.json` | Plugin manifest with permissions, resources, and lifecycle configuration |
| `package.json` | Node.js package configuration with OPNet dependencies |
| `tsconfig.json` | TypeScript configuration (ES2022, NodeNext) |
| `src/index.ts` | Entry point (extends `PluginBase` for standalone, exports for library) |
| `eslint.config.js` | ESLint configuration with typescript-eslint |
| `.prettierrc.json` | Prettier formatting configuration |
| `.gitignore` | Git ignore rules |
| `README.md` | Basic readme |

**Created directories:** `src/`, `dist/`, `build/`, `test/`

---

#### `opnet compile`

Compile a plugin to the `.opnet` binary format. This command:
1. Loads and validates `plugin.json`
2. Bundles TypeScript with esbuild (CJS format)
3. Compiles to V8 bytecode via bytenode
4. Optionally signs the binary with your MLDSA key
5. Assembles the final `.opnet` binary

**Syntax:** `opnet compile [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file path | `./build/<name>.opnet` |
| `-d, --dir <path>` | Plugin directory | Current directory |
| `--no-sign` | Skip signing (produce unsigned binary) | Signs by default |
| `--minify` | Minify the bundled code | `true` |
| `--sourcemap` | Generate source maps | `false` |

**Examples:**

```bash
# Compile current directory (signed)
opnet compile

# Compile a specific directory
opnet compile --dir ./my-plugin

# Custom output path
opnet compile --output ./dist/plugin.opnet

# Unsigned binary (for testing)
opnet compile --no-sign

# With source maps, no minification
opnet compile --sourcemap --no-minify
```

**Prerequisites:**
- `plugin.json` must exist in the project directory
- `src/index.ts` must exist as the entry point
- For signed binaries, wallet must be configured (`opnet login`)

**Output information:**
- Output file path and size
- Plugin name, version, and type
- MLDSA level, SHA-256 checksum, and signing status

> **Note:** Unsigned binaries cannot be published to the registry. Use `opnet sign` to sign them later.

---

#### `opnet verify`

Verify a `.opnet` binary's signature and integrity. Checks both the SHA-256 checksum and the MLDSA signature.

**Syntax:** `opnet verify <file> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<file>` | Path to `.opnet` file |

**Options:**

| Option | Description |
|---|---|
| `-v, --verbose` | Show detailed information (sizes, checksums, author, permissions) |
| `--json` | Output results as JSON |

**Examples:**

```bash
# Basic verification
opnet verify build/my-plugin.opnet

# Detailed output
opnet verify build/my-plugin.opnet --verbose

# JSON output (useful for CI/CD)
opnet verify build/my-plugin.opnet --json
```

**Exit codes:**
- `0` - Binary is valid and properly signed
- `1` - Verification failed (invalid checksum, invalid signature, or unsigned)

**Verification checks:**
- SHA-256 checksum integrity
- MLDSA signature validity
- Unsigned binary detection

---

#### `opnet info`

Display information about a plugin project or a compiled `.opnet` file.

**Syntax:** `opnet info [path] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `[path]` | Path to plugin directory, `plugin.json`, or `.opnet` file | Current directory |

**Options:**

| Option | Description |
|---|---|
| `--json` | Output as JSON |

**Examples:**

```bash
# Show project info (current directory)
opnet info

# Show info for a specific directory
opnet info ./my-plugin

# Show compiled binary info
opnet info build/my-plugin.opnet

# JSON output
opnet info --json
opnet info build/my-plugin.opnet --json
```

**For project directories, shows:**
- Plugin name, version, type, OPNet version compatibility
- Author information
- Source/dependencies/compiled status
- Permissions, resources, and lifecycle configuration
- Plugin dependencies

**For `.opnet` files, shows:**
- File size and format version
- Plugin metadata (name, version, type)
- Cryptographic info (MLDSA level, signing status, publisher hash)
- Component sizes (bytecode, metadata, proto)
- Permissions and dependencies

---

#### `opnet sign`

Sign or re-sign a `.opnet` binary with your MLDSA key. This rebuilds the binary with your key and signature.

**Syntax:** `opnet sign <file> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<file>` | Path to `.opnet` file |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output file path | Overwrites input file |
| `--force` | Force re-signing even if already signed by a different key | — |

**Examples:**

```bash
# Sign an unsigned binary (overwrites in-place)
opnet sign build/my-plugin.opnet

# Sign and save to a different file
opnet sign build/my-plugin.opnet --output build/signed.opnet

# Re-sign a binary that was signed by someone else
opnet sign build/plugin.opnet --force
```

**Behavior:**
- If the binary is unsigned, it signs it with your key
- If already signed by the same key, it re-signs (refreshes the signature)
- If signed by a different key, it refuses unless `--force` is used
- Requires wallet credentials (`opnet login`)

---

### Registry - Publishing

#### `opnet publish`

Publish a plugin to the OPNet on-chain registry. This command:
1. Parses and validates the `.opnet` binary
2. Verifies checksum and signature
3. Confirms your wallet matches the signer
4. Checks scope registration (for scoped packages)
5. Uploads the binary to IPFS
6. Registers the package on-chain (if new)
7. Publishes the version on-chain

**Syntax:** `opnet publish [file] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `[file]` | Path to `.opnet` file | Auto-detected from `plugin.json` (`./build/<name>.opnet`) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network to publish to | `mainnet` |
| `--dry-run` | Show what would be published without actually publishing | — |
| `-y, --yes` | Skip confirmation prompts | — |

**Examples:**

```bash
# Publish from current directory (auto-detects .opnet file)
opnet publish

# Publish specific file
opnet publish build/my-plugin.opnet

# Dry run to preview
opnet publish --dry-run

# Publish to regtest
opnet publish --network regtest

# Non-interactive
opnet publish --yes --network regtest
```

**Prerequisites:**
- Binary must be signed (run `opnet compile` or `opnet sign`)
- Wallet must match the binary signer
- For scoped packages (`@scope/name`), the scope must be registered first
- Wallet must have sufficient balance for transaction fees

---

#### `opnet deprecate`

Mark a package version as deprecated. Only works within the 72-hour mutability window after publishing.

**Syntax:** `opnet deprecate <package> [version] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `<package>` | Package name (e.g., `@scope/name` or `name`) | — |
| `[version]` | Version to deprecate | Latest version |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-m, --message <message>` | Deprecation reason/message | Interactive prompt (or "No reason provided") |
| `-n, --network <network>` | Network | `mainnet` |
| `-y, --yes` | Skip confirmation | — |

**Examples:**

```bash
# Deprecate latest version (prompts for reason)
opnet deprecate @myscope/plugin

# Deprecate specific version with reason
opnet deprecate @myscope/plugin 1.0.0 --message "Security vulnerability found"

# Non-interactive
opnet deprecate @myscope/plugin 1.0.0 -m "Use v2.0.0 instead" --yes
```

> **Note:** Versions past the 72-hour mutability window cannot be deprecated.

---

#### `opnet undeprecate`

Remove deprecation from a package version. Only works within the 72-hour mutability window.

**Syntax:** `opnet undeprecate <package> <version> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<package>` | Package name (e.g., `@scope/name` or `name`) |
| `<version>` | Version to undeprecate |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `-y, --yes` | Skip confirmation | — |

**Examples:**

```bash
opnet undeprecate @myscope/plugin 1.0.0
opnet undeprecate @myscope/plugin 1.0.0 --network regtest --yes
```

---

### Registry - Package Management

#### `opnet install`

Download and verify a plugin from the registry. Automatically removes older versions of the same plugin from the output directory.

**Syntax:** `opnet install <package> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<package>` | Package name (optionally with `@version`), or a raw IPFS CID |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-o, --output <path>` | Output directory | `./plugins/` |
| `-n, --network <network>` | Network | `mainnet` |
| `--skip-verify` | Skip signature verification | — |

**Examples:**

```bash
# Install latest version
opnet install @scope/plugin

# Install specific version
opnet install @scope/plugin@1.0.0

# Install an unscoped package
opnet install my-plugin

# Install directly from IPFS CID
opnet install QmXyz...

# Custom output directory
opnet install @scope/plugin --output ./my-plugins

# Skip signature verification (not recommended)
opnet install @scope/plugin --skip-verify
```

**What happens:**
1. Resolves the package and version from the on-chain registry
2. Downloads the binary from IPFS
3. Verifies checksum integrity
4. Verifies MLDSA signature (unless `--skip-verify`)
5. Removes older versions of the same plugin from the output directory
6. Saves to `<output>/<package>-<version>.opnet`

---

#### `opnet update`

Check and update installed plugins to their latest versions.

**Syntax:** `opnet update [package] [options]`

**Arguments:**

| Argument | Description | Default |
|---|---|---|
| `[package]` | Specific package to update | All installed plugins |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-d, --dir <path>` | Plugins directory | `./plugins/` |
| `-n, --network <network>` | Network | `mainnet` |
| `--skip-verify` | Skip signature verification | — |

**Examples:**

```bash
# Update all installed plugins
opnet update

# Update a specific plugin
opnet update @scope/plugin

# Custom plugins directory
opnet update --dir ./my-plugins

# Different network
opnet update --network regtest
```

---

#### `opnet list`

List all installed plugins in a directory. Alias: `opnet ls`.

**Syntax:** `opnet list [options]`

**Options:**

| Option | Description | Default |
|---|---|---|
| `-d, --dir <path>` | Plugins directory | `./plugins/` |
| `--json` | Output as JSON | — |
| `-v, --verbose` | Show detailed information per plugin | — |

**Examples:**

```bash
# List plugins (table view)
opnet list
opnet ls

# Detailed list
opnet list --verbose

# JSON output
opnet list --json

# Custom directory
opnet list --dir ./my-plugins
```

**Table output columns:** Name, Version, Type, Size, Signed

---

#### `opnet search`

Search for a plugin in the on-chain registry by exact package name.

**Syntax:** `opnet search <query> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<query>` | Package name or `@scope/name` |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `--json` | Output as JSON | — |

**Examples:**

```bash
opnet search my-plugin
opnet search @scope/plugin
opnet search @scope/plugin --json
opnet search my-plugin --network regtest
```

**Output includes:**
- Package name, latest version, total version count
- Owner address
- Latest version details: type, MLDSA level, OPNet version range, IPFS CID, deprecation status, publish block
- Install command

---

### Registry - Ownership

#### `opnet scope:register`

Register a new scope (namespace) in the on-chain registry. Scopes are required for publishing scoped packages (`@scope/name`). Registration has a one-time fee.

**Syntax:** `opnet scope:register <name> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<name>` | Scope name (without `@` prefix) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `-y, --yes` | Skip confirmation | — |

**Scope name rules:**
- Must start with a lowercase letter
- Can contain only lowercase letters, numbers, and hyphens
- Must end with a letter or number

**Examples:**

```bash
# Register a scope
opnet scope:register myscope

# With @ prefix (auto-stripped)
opnet scope:register @myscope

# On regtest
opnet scope:register myscope --network regtest --yes
```

---

#### `opnet transfer`

Initiate ownership transfer of a package or scope. The new owner must call `opnet accept` to complete the transfer. You can also cancel a pending transfer.

**Syntax:** `opnet transfer <name> [newOwner] [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<name>` | Package name or `@scope` (scope if starts with `@` and no `/`) |
| `[newOwner]` | New owner address (prompted if not provided) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `-y, --yes` | Skip confirmation | — |
| `--cancel` | Cancel a pending transfer instead of initiating one | — |

**Examples:**

```bash
# Transfer a package
opnet transfer my-plugin bc1p...

# Transfer a scope
opnet transfer @myscope bc1p...

# Interactive (prompts for new owner address)
opnet transfer my-plugin

# Cancel a pending transfer
opnet transfer my-plugin --cancel
opnet transfer @myscope --cancel
```

---

#### `opnet accept`

Accept a pending ownership transfer for a package or scope.

**Syntax:** `opnet accept <name> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<name>` | Package name or `@scope` |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `-y, --yes` | Skip confirmation | — |

**Examples:**

```bash
# Accept package transfer
opnet accept my-plugin

# Accept scope transfer
opnet accept @myscope

# Non-interactive
opnet accept my-plugin --network regtest --yes
```

---

### Domains & Websites

#### `opnet domain register`

Register a new `.btc` domain on the BTC Name Resolver. Domain pricing is tiered based on name length and keyword value.

**Syntax:** `opnet domain register <name> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<name>` | Domain name to register (without `.btc` suffix) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `--dry-run` | Show what would happen without registering | — |
| `-y, --yes` | Skip confirmation prompts | — |

**Pricing tiers:**

| Tier | Price | Description |
|---|---|---|
| Ultra Legendary (Tier 0) | 10 BTC | Iconic crypto/tech names |
| Legendary (Tier 1) | 1 BTC | Single character or top keywords |
| Premium (Tier 2) | 0.25 BTC | Two character or major protocols |
| High Value (Tier 3) | 0.1 BTC | Three character or valuable keywords |
| Valuable (Tier 4) | 0.05 BTC | Four character or common keywords |
| Common Premium (Tier 5) | 0.01 BTC | Five character domains |
| Notable (Tier 6) | 0.005 BTC | Notable keywords |
| Standard | 0.001 BTC | Standard domains (6+ characters) |

**Examples:**

```bash
# Register a domain
opnet domain register mysite

# Preview without registering
opnet domain register mysite --dry-run

# Register on regtest
opnet domain register mysite --network regtest --yes
```

> **Note:** Subdomains cannot be registered directly. Register the parent domain first.

---

#### `opnet domain info`

Look up information about a `.btc` domain. Shows registration status, owner, contenthash (website), and pricing for available domains.

**Syntax:** `opnet domain info <name> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<name>` | Domain name (with or without `.btc` suffix) |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |

**Examples:**

```bash
# Look up a domain
opnet domain info mysite
opnet domain info mysite.btc

# Check on regtest
opnet domain info mysite --network regtest
```

**For registered domains, shows:**
- Owner address
- Creation block
- TTL
- Website contenthash (if set) with IPFS/IPNS gateway URL

**For unregistered domains, shows:**
- Availability status
- Registration price and pricing tier
- Registration command

---

#### `opnet website`

Publish a website to a `.btc` domain by setting its contenthash. Supports IPFS CIDv0, CIDv1, IPNS, and SHA256 content hashes.

**Syntax:** `opnet website <domain> <contenthash> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<domain>` | Domain name (e.g., `mysite` or `mysite.btc`) |
| `<contenthash>` | IPFS CID, IPNS ID, or SHA256 hash |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `--dry-run` | Show what would be published without publishing | — |
| `-y, --yes` | Skip confirmation prompts | — |
| `-t, --type <type>` | Contenthash type: `cidv0`, `cidv1`, `ipns`, `sha256` | Auto-detected |

**Examples:**

```bash
# Publish with IPFS CID (auto-detected type)
opnet website mysite QmXyz...abc
opnet website mysite bafybeiabc...

# Publish with IPNS
opnet website mysite k51qzi5uqu5d... --type ipns

# Publish with SHA256 hash
opnet website mysite abc123...def --type sha256

# Dry run
opnet website mysite QmXyz... --dry-run

# Subdomain support
opnet website blog.mysite QmXyz...
```

**Contenthash type auto-detection:**
- Starts with `Qm` → CIDv0
- Starts with `bafy` → CIDv1
- Starts with `k51` or `12D3` → IPNS
- 64 hex characters → SHA256

---

#### `opnet deploy`

Upload a website directory or file to IPFS and publish the resulting CID to a `.btc` domain in a single command. Combines IPFS upload + on-chain contenthash update.

**Syntax:** `opnet deploy <domain> <path> [options]`

**Arguments:**

| Argument | Description |
|---|---|
| `<domain>` | Domain name (e.g., `mysite` or `mysite.btc`) |
| `<path>` | Path to website directory or HTML file |

**Options:**

| Option | Description | Default |
|---|---|---|
| `-n, --network <network>` | Network | `mainnet` |
| `--dry-run` | Upload to IPFS but don't update on-chain | — |
| `-y, --yes` | Skip confirmation prompts | — |

**Examples:**

```bash
# Deploy a directory
opnet deploy mysite ./dist

# Deploy a single HTML file
opnet deploy mysite ./index.html

# Upload to IPFS only (no on-chain update)
opnet deploy mysite ./dist --dry-run

# Non-interactive deployment to regtest
opnet deploy mysite ./dist --network regtest --yes
```

**What happens:**
1. Validates domain ownership
2. Uploads the directory/file to IPFS
3. Sets the CIDv1 contenthash on-chain
4. Waits for transaction confirmation

---

## Configuration Reference

Configuration is stored in `~/.opnet/config.json`. All values can be set with `opnet config set` or overridden with environment variables.

```json
{
    "defaultNetwork": "regtest",
    "rpcUrls": {
        "mainnet": "https://api.opnet.org",
        "testnet": "https://testnet.opnet.org",
        "regtest": "https://regtest.opnet.org"
    },
    "ipfsGateway": "https://ipfs.opnet.org/ipfs/",
    "ipfsGateways": ["https://ipfs.opnet.org/ipfs/"],
    "ipfsPinningEndpoint": "https://ipfs.opnet.org/api/v0/add",
    "ipfsPinningApiKey": "",
    "ipfsPinningSecret": "",
    "ipfsPinningAuthHeader": "Authorization",
    "registryAddresses": {
        "mainnet": "",
        "testnet": "",
        "regtest": "0x0737..."
    },
    "resolverAddresses": {
        "mainnet": "",
        "testnet": "",
        "regtest": "0x271e..."
    },
    "defaultMldsaLevel": 44,
    "indexerUrl": "https://indexer.opnet.org"
}
```

| Key | Description |
|---|---|
| `defaultNetwork` | Default network for all commands (`mainnet`, `testnet`, `regtest`) |
| `rpcUrls.<network>` | JSON-RPC endpoint for each network |
| `ipfsGateway` | Primary IPFS gateway for downloads |
| `ipfsGateways` | Fallback IPFS gateways |
| `ipfsPinningEndpoint` | IPFS pinning service URL |
| `ipfsPinningApiKey` | IPFS pinning API key or JWT token |
| `ipfsPinningSecret` | IPFS pinning API secret (for key+secret auth) |
| `ipfsPinningAuthHeader` | Authorization header name for pinning service |
| `registryAddresses.<network>` | On-chain package registry contract address |
| `resolverAddresses.<network>` | On-chain BTC Name Resolver contract address |
| `defaultMldsaLevel` | Default MLDSA security level for key generation |
| `indexerUrl` | Indexer API URL for search operations |

## Environment Variables

Environment variables override file-based configuration and credentials. Useful for CI/CD pipelines.

| Variable | Description | Overrides |
|---|---|---|
| `OPNET_MNEMONIC` | BIP-39 mnemonic phrase | Credentials file |
| `OPNET_PRIVATE_KEY` | Bitcoin WIF private key | Credentials file |
| `OPNET_MLDSA_KEY` | MLDSA private key (hex) | Credentials file |
| `OPNET_MLDSA_LEVEL` | MLDSA security level (`44`, `65`, `87`) | Credentials file |
| `OPNET_NETWORK` | Network (`mainnet`, `testnet`, `regtest`) | `defaultNetwork` config |
| `OPNET_RPC_URL` | RPC endpoint URL | `rpcUrls.<network>` config |
| `OPNET_IPFS_GATEWAY` | IPFS gateway URL | `ipfsGateway` config |
| `OPNET_IPFS_PINNING_ENDPOINT` | IPFS pinning service endpoint | `ipfsPinningEndpoint` config |
| `OPNET_IPFS_PINNING_KEY` | IPFS pinning API key | `ipfsPinningApiKey` config |
| `OPNET_REGISTRY_ADDRESS` | Registry contract address | `registryAddresses.<network>` config |
| `OPNET_INDEXER_URL` | Indexer API URL | `indexerUrl` config |

**CI/CD example:**

```bash
export OPNET_MNEMONIC="your mnemonic phrase here"
export OPNET_NETWORK="regtest"
opnet compile && opnet publish --yes
```

## Credential Storage

Credentials are stored in `~/.opnet/credentials.json` with restricted permissions (`0600` - owner read/write only).

**Two authentication methods:**

1. **BIP-39 Mnemonic** (recommended) - Derives both Bitcoin (secp256k1) and MLDSA keys from a single phrase
2. **WIF + MLDSA key** (advanced) - Separate Bitcoin private key and standalone MLDSA private key

**Priority order:** Environment variables > credentials file

## MLDSA Security Levels

OPNet uses ML-DSA (Module-Lattice-Based Digital Signature Algorithm) for quantum-resistant signatures.

| Level | Public Key | Private Key | Signature | Security |
|---|---|---|---|---|
| MLDSA-44 | 1,312 bytes | 2,560 bytes | 2,420 bytes | ~128-bit |
| MLDSA-65 | 1,952 bytes | 4,032 bytes | 3,309 bytes | ~192-bit |
| MLDSA-87 | 2,592 bytes | 4,896 bytes | 4,627 bytes | ~256-bit |

> **Note:** OPNet currently only supports MLDSA-44 on-chain.

## .opnet Binary Format (OIP-0003)

The `.opnet` binary format consists of:

| Section | Size | Description |
|---|---|---|
| Magic bytes | 8 bytes | `OPNETPLG` |
| Format version | 4 bytes | uint32 LE |
| MLDSA level | 1 byte | `0`=MLDSA-44, `1`=MLDSA-65, `2`=MLDSA-87 |
| Public key | Variable | Size depends on MLDSA level |
| Signature | Variable | Size depends on MLDSA level |
| Metadata length | 4 bytes | uint32 LE |
| Metadata | Variable | JSON-encoded plugin manifest |
| Bytecode length | 4 bytes | uint32 LE |
| Bytecode | Variable | V8 bytecode (bytenode compiled) |
| Proto length | 4 bytes | uint32 LE |
| Proto | Variable | Protobuf definitions (optional) |
| Checksum | 32 bytes | SHA-256 of metadata + bytecode + proto |

## Plugin Manifest (plugin.json)

The `plugin.json` file defines your plugin's metadata, permissions, resource limits, and lifecycle configuration.

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "opnetVersion": ">=0.0.1",
    "main": "dist/index.jsc",
    "target": "bytenode",
    "type": "plugin",
    "author": {
        "name": "Developer Name",
        "email": "dev@example.com"
    },
    "description": "My OPNet plugin",
    "pluginType": "standalone",
    "permissions": {
        "database": {
            "enabled": false,
            "collections": []
        },
        "blocks": {
            "preProcess": false,
            "postProcess": false,
            "onChange": false
        },
        "epochs": {
            "onChange": false,
            "onFinalized": false
        },
        "mempool": {
            "txFeed": false,
            "txSubmit": false
        },
        "api": {
            "addEndpoints": false,
            "addWebsocket": false
        },
        "threading": {
            "maxWorkers": 1,
            "maxMemoryMB": 256
        },
        "filesystem": {
            "configDir": false,
            "tempDir": false
        }
    },
    "resources": {
        "memory": {
            "maxHeapMB": 256,
            "maxOldGenMB": 128,
            "maxYoungGenMB": 64
        },
        "cpu": {
            "maxThreads": 2,
            "priority": "normal"
        },
        "timeout": {
            "initMs": 30000,
            "hookMs": 5000,
            "shutdownMs": 10000
        }
    },
    "lifecycle": {
        "loadPriority": 100,
        "enabledByDefault": true,
        "requiresRestart": false
    },
    "dependencies": {}
}
```

**Permissions reference:**

| Permission | Description |
|---|---|
| `database.enabled` | Access to plugin database |
| `database.collections` | Allowed collection names |
| `blocks.preProcess` | Hook before block processing |
| `blocks.postProcess` | Hook after block processing |
| `blocks.onChange` | Hook on block changes |
| `epochs.onChange` | Hook on epoch changes |
| `epochs.onFinalized` | Hook on epoch finalization |
| `mempool.txFeed` | Subscribe to mempool transactions |
| `mempool.txSubmit` | Submit transactions to mempool |
| `api.addEndpoints` | Register custom API endpoints |
| `api.addWebsocket` | Register WebSocket handlers |
| `threading.maxWorkers` | Maximum worker threads |
| `threading.maxMemoryMB` | Maximum memory per worker |
| `filesystem.configDir` | Access to config directory |
| `filesystem.tempDir` | Access to temp directory |

## Workflow Examples

### Publish a new plugin

```bash
# Create project
opnet init my-plugin
cd my-plugin
npm install

# Develop your plugin
# Edit src/index.ts

# Build and compile
npm run build
opnet compile

# Verify
opnet verify build/my-plugin.opnet

# Register scope (if using scoped name)
opnet scope:register myscope --network regtest

# Publish
opnet publish --network regtest
```

### Register a domain and deploy a website

```bash
# Register a .btc domain
opnet domain register mysite --network regtest

# Option A: Deploy from a directory (upload + publish in one step)
opnet deploy mysite ./dist --network regtest

# Option B: Manual two-step process
# 1. Upload to IPFS separately, get the CID
# 2. Set the contenthash
opnet website mysite QmXyz... --network regtest
```

### Transfer ownership

```bash
# Current owner initiates transfer
opnet transfer @myscope bc1p...newowner

# New owner accepts
opnet accept @myscope
```

### CI/CD pipeline

```bash
export OPNET_MNEMONIC="your mnemonic"
export OPNET_NETWORK="mainnet"

npm run build
opnet compile
opnet verify build/my-plugin.opnet --json
opnet publish --yes
```

## Security

- Credentials are stored with restricted permissions (`0600` - owner read/write only)
- All plugin binaries are signed with quantum-resistant MLDSA signatures
- SHA-256 checksums verify binary integrity
- IPFS CIDs provide content-addressed storage
- On-chain registry ensures immutable publishing records
- 72-hour mutability window for deprecation/undeprecation after publishing

## License

Apache-2.0

## Links

- [OPNet Documentation](https://docs.opnet.org)
- [Plugin SDK](https://github.com/btc-vision/plugin-sdk)
- [OPNet Node](https://github.com/btc-vision/opnet-node)
- [Report Issues](https://github.com/btc-vision/opnet-cli/issues)
