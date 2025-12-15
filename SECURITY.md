# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
|---------|--------------------|
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

To report a security vulnerability, please email [anakun@opnet.org](mailto:anakun@opnet.org).

Please include the following information in your report:

- Description of the vulnerability
- Steps to reproduce the vulnerability
- Suggested mitigation or remediation steps
- Your name and contact information
- Your company or organization name (if applicable)
- Your preferred method of contact
- Any other relevant information
- Attach any supporting documents, screenshots, or other files that may help us understand the issue

## Security Best Practices

When using the OPNet CLI:

1. **Protect your mnemonic**: Never share your BIP-39 mnemonic phrase. Store it securely offline.
2. **Use secure networks**: Avoid using public Wi-Fi when performing sensitive operations.
3. **Verify downloads**: Always verify plugin signatures before installing.
4. **Keep credentials secure**: The CLI stores credentials in `~/.opnet/credentials.json` with restricted permissions (0600).
5. **Use testnet first**: Test your plugins on testnet before deploying to mainnet.
