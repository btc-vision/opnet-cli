# @btc-vision/cli

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![NodeJS](https://img.shields.io/badge/Node%20js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=for-the-badge&logo=mongodb&logoColor=white)
![NPM](https://img.shields.io/badge/npm-CB3837?style=for-the-badge&logo=npm&logoColor=white)
![Gulp](https://img.shields.io/badge/GULP-%23CF4647.svg?style=for-the-badge&logo=gulp&logoColor=white)
![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)

Official command-line interface for the OPNet plugin ecosystem. Build, sign, verify, and publish plugins with
quantum-resistant MLDSA signatures.

## Installation

```bash
npm install -g @btc-vision/cli
```

Or use npx:

```bash
npx @btc-vision/cli <command>
```

## Quick Start

```bash
# Initialize a new plugin project
opnet init my-plugin

# Build and compile to .opnet binary
cd my-plugin
npm install
npm run build
opnet compile

# Verify the compiled binary
opnet verify build/my-plugin.opnet

# Configure your wallet for signing
opnet login

# Publish to the registry
opnet publish
```

## Commands

### Configuration

#### `opnet config`

Manage CLI configuration.

```bash
# Show all configuration
opnet config list

# Get a specific value
opnet config get defaultNetwork
opnet config get rpcUrls.mainnet

# Set a value
opnet config set defaultNetwork testnet
opnet config set ipfsPinningApiKey "your-api-key"

# Reset to defaults
opnet config reset --yes

# Show config file path
opnet config path
```

### Authentication

#### `opnet login`

Configure wallet credentials for signing and publishing.

```bash
# Interactive mode
opnet login

# With mnemonic phrase
opnet login --mnemonic "your 24 word phrase..."

# With specific network and MLDSA level
opnet login --network testnet --mldsa-level 65

# Advanced: WIF + standalone MLDSA key
opnet login --wif "KwDiBf..." --mldsa "hex-key..."
```

**Options:**

- `-m, --mnemonic <phrase>` - BIP-39 mnemonic phrase (24 words)
- `--wif <key>` - Bitcoin WIF private key (advanced)
- `--mldsa <key>` - MLDSA private key hex (advanced, requires --wif)
- `-l, --mldsa-level <level>` - MLDSA security level (44, 65, 87) [default: 44]
- `-n, --network <network>` - Network (mainnet, testnet, regtest) [default: mainnet]
- `-y, --yes` - Skip confirmation prompts

#### `opnet logout`

Remove stored wallet credentials.

```bash
opnet logout
opnet logout --yes
```

#### `opnet whoami`

Display current wallet identity and configuration.

```bash
opnet whoami
opnet whoami --verbose
opnet whoami --public-key
```

### Key Generation

#### `opnet keygen`

Generate cryptographic keys.

```bash
# Generate a new mnemonic phrase
opnet keygen mnemonic
opnet keygen mnemonic --output my-mnemonic.txt

# Generate standalone MLDSA keypair
opnet keygen mldsa
opnet keygen mldsa --level 65
opnet keygen mldsa --output my-key --json

# Show MLDSA key size information
opnet keygen info
```

### Plugin Development

#### `opnet init`

Initialize a new OPNet plugin project.

```bash
# Interactive mode
opnet init

# With name
opnet init my-plugin

# With options
opnet init my-plugin --template library --yes

# Force overwrite
opnet init --force
```

**Options:**

- `-t, --template <type>` - Template type (standalone, library) [default: standalone]
- `-y, --yes` - Skip prompts and use defaults
- `--force` - Overwrite existing files

#### `opnet compile`

Compile plugin to .opnet binary format.

```bash
# Compile current directory
opnet compile

# Compile specific directory
opnet compile --dir ./my-plugin

# Custom output path
opnet compile --output ./dist/plugin.opnet

# Skip signing (for testing)
opnet compile --no-sign
```

**Options:**

- `-o, --output <path>` - Output file path
- `-d, --dir <path>` - Plugin directory [default: current]
- `--no-sign` - Skip signing (produce unsigned binary)
- `--minify` - Minify the bundled code [default: true]
- `--sourcemap` - Generate source maps

#### `opnet verify`

Verify a .opnet binary signature and integrity.

```bash
opnet verify plugin.opnet
opnet verify plugin.opnet --verbose
opnet verify plugin.opnet --json
```

**Options:**

- `-v, --verbose` - Show detailed information
- `--json` - Output as JSON

#### `opnet info`

Display information about a plugin or .opnet file.

```bash
# Show project info
opnet info

# Show binary info
opnet info plugin.opnet

# JSON output
opnet info --json
```

#### `opnet sign`

Sign or re-sign a .opnet binary with your MLDSA key.

```bash
opnet sign plugin.opnet
opnet sign plugin.opnet --output signed.opnet
opnet sign plugin.opnet --force  # Re-sign with different key
```

**Options:**

- `-o, --output <path>` - Output file path [default: overwrites input]
- `--force` - Force re-signing even if already signed by different key

### Registry Commands

#### `opnet publish`

Publish a plugin to the OPNet registry.

```bash
# Publish from current directory
opnet publish

# Publish specific file
opnet publish plugin.opnet

# Dry run
opnet publish --dry-run

# Specific network
opnet publish --network testnet
```

**Options:**

- `-n, --network <network>` - Network to publish to [default: mainnet]
- `--dry-run` - Show what would be published without publishing
- `-y, --yes` - Skip confirmation prompts

#### `opnet deprecate`

Mark a package version as deprecated.

```bash
opnet deprecate @scope/plugin
opnet deprecate @scope/plugin 1.0.0
opnet deprecate @scope/plugin 1.0.0 --message "Security vulnerability"
```

**Options:**

- `-m, --message <message>` - Deprecation reason/message
- `-n, --network <network>` - Network [default: mainnet]
- `-y, --yes` - Skip confirmation

#### `opnet undeprecate`

Remove deprecation from a package version.

```bash
opnet undeprecate @scope/plugin 1.0.0
```

#### `opnet transfer`

Initiate ownership transfer of a package or scope.

```bash
# Transfer a package
opnet transfer my-plugin bc1q...

# Transfer a scope
opnet transfer @myscope bc1q...

# Cancel pending transfer
opnet transfer my-plugin --cancel
```

**Options:**

- `-n, --network <network>` - Network [default: mainnet]
- `-y, --yes` - Skip confirmation
- `--cancel` - Cancel pending transfer

#### `opnet accept`

Accept pending ownership transfer.

```bash
opnet accept my-plugin
opnet accept @myscope
```

#### `opnet install`

Download and verify a plugin from the registry.

```bash
# Install latest version
opnet install @scope/plugin

# Install specific version
opnet install @scope/plugin@1.0.0

# Install from IPFS CID
opnet install QmXyz...

# Custom output directory
opnet install @scope/plugin --output ./my-plugins
```

**Options:**

- `-o, --output <path>` - Output directory [default: ./plugins/]
- `-n, --network <network>` - Network [default: mainnet]
- `--skip-verify` - Skip signature verification

#### `opnet update`

Update installed plugins to latest versions.

```bash
# Update all plugins
opnet update

# Update specific plugin
opnet update @scope/plugin

# Custom plugins directory
opnet update --dir ./my-plugins
```

**Options:**

- `-d, --dir <path>` - Plugins directory [default: ./plugins/]
- `-n, --network <network>` - Network [default: mainnet]
- `--skip-verify` - Skip signature verification

#### `opnet list`

List installed plugins.

```bash
opnet list
opnet ls
opnet list --verbose
opnet list --json
opnet list --dir ./my-plugins
```

**Options:**

- `-d, --dir <path>` - Plugins directory [default: ./plugins/]
- `--json` - Output as JSON
- `-v, --verbose` - Show detailed information

#### `opnet search`

Search for plugins in the registry.

```bash
opnet search plugin-name
opnet search @scope/plugin
opnet search plugin-name --json
```

**Options:**

- `-n, --network <network>` - Network [default: mainnet]
- `--json` - Output as JSON

## Configuration

Configuration is stored in `~/.opnet/config.json`:

```json
{
    "defaultNetwork": "mainnet",
    "rpcUrls": {
        "mainnet": "https://api.opnet.org",
        "testnet": "https://testnet.opnet.org",
        "regtest": "https://regtest.opnet.org"
    },
    "ipfsGateway": "https://ipfs.opnet.org/ipfs/",
    "ipfsGateways": [
        "https://ipfs.opnet.org/ipfs/",
        "https://ipfs.io/ipfs/"
    ],
    "ipfsPinningEndpoint": "https://ipfs.opnet.org/api/v0/add",
    "ipfsPinningApiKey": "",
    "registryAddresses": {
        "mainnet": "",
        "testnet": "",
        "regtest": ""
    },
    "defaultMldsaLevel": 44,
    "indexerUrl": "https://indexer.opnet.org"
}
```

## Environment Variables

| Variable                      | Description                         |
|-------------------------------|-------------------------------------|
| `OPNET_MNEMONIC`              | BIP-39 mnemonic phrase              |
| `OPNET_PRIVATE_KEY`           | Bitcoin WIF private key             |
| `OPNET_MLDSA_KEY`             | MLDSA private key (hex)             |
| `OPNET_MLDSA_LEVEL`           | MLDSA security level (44, 65, 87)   |
| `OPNET_NETWORK`               | Network (mainnet, testnet, regtest) |
| `OPNET_RPC_URL`               | RPC endpoint URL                    |
| `OPNET_IPFS_GATEWAY`          | IPFS gateway URL                    |
| `OPNET_IPFS_PINNING_ENDPOINT` | IPFS pinning service endpoint       |
| `OPNET_IPFS_PINNING_KEY`      | IPFS pinning API key                |
| `OPNET_REGISTRY_ADDRESS`      | Registry contract address           |
| `OPNET_INDEXER_URL`           | Indexer API URL                     |

## MLDSA Security Levels

| Level    | Public Key  | Signature   | Security |
|----------|-------------|-------------|----------|
| MLDSA-44 | 1,312 bytes | 2,420 bytes | ~128-bit |
| MLDSA-65 | 1,952 bytes | 3,309 bytes | ~192-bit |
| MLDSA-87 | 2,592 bytes | 4,627 bytes | ~256-bit |

## .opnet Binary Format (OIP-0003)

The `.opnet` binary format consists of:

1. **Magic bytes** (8 bytes): `OPNETPLG`
2. **Format version** (4 bytes): uint32 LE
3. **MLDSA level** (1 byte): 0=44, 1=65, 2=87
4. **Public key** (variable): Based on MLDSA level
5. **Signature** (variable): Based on MLDSA level
6. **Metadata length** (4 bytes): uint32 LE
7. **Metadata** (variable): JSON bytes
8. **Bytecode length** (4 bytes): uint32 LE
9. **Bytecode** (variable): V8 bytecode
10. **Proto length** (4 bytes): uint32 LE
11. **Proto** (variable): Protobuf definitions
12. **Checksum** (32 bytes): SHA-256 of metadata + bytecode + proto

## Plugin Manifest (plugin.json)

```json
{
    "name": "my-plugin",
    "version": "1.0.0",
    "opnetVersion": "^1.0.0",
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
            "txFeed": false
        },
        "api": {
            "addEndpoints": false,
            "addWebsocket": false
        },
        "filesystem": {
            "configDir": false,
            "tempDir": false
        }
    },
    "resources": {
        "maxMemoryMB": 256,
        "maxCpuPercent": 25,
        "maxStorageMB": 100
    },
    "dependencies": {},
    "lifecycle": {
        "autoStart": true,
        "restartOnCrash": true,
        "maxRestarts": 3
    }
}
```

## Security

- Credentials are stored with restricted permissions (0600)
- All binaries are signed with quantum-resistant MLDSA signatures
- Checksums verify binary integrity
- IPFS CIDs provide content-addressed storage

## License

Apache-2.0

## Links

- [OPNet Documentation](https://docs.opnet.org)
- [Plugin SDK](https://github.com/btc-vision/plugin-sdk)
- [OPNet Node](https://github.com/btc-vision/opnet-node)
