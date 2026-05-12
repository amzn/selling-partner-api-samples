# Amazon Selling Partner API Samples

This repository contains sample code in various programming languages for use cases supported by the [Amazon Selling Partner API (SP-API)](https://developer-docs.amazon.com/sp-api/).

## Table of Contents
- [About this Repo](#about-this-repo)
- [SP-API Dev MCP Package](#sp-api-dev-mcp-package)
- [Learning Resources](#learning-resources)
- [Security](#security)
- [License](#license)

## About this Repo
This repository contains two types of sample code:
- [Code Recipes](code-recipes): Easy to read sample code for common use cases of Amazon Selling Partner API. Recipes are written in multiple programming languages, and you can read or browse through them and copy parts of them over into your codebase.
- [Sample Solutions](use-cases): More complex solutions to demonstrate specific use cases in more detail. You can easily deploy them in AWS to learn and explore.
- [Labs](labs): Hands-on resources to help you learn and master flows and scenarios through Jupyter code samples, guided tutorials, and full workshop challenges.

We welcome contributions to this repo in the form of fixes or improvements to existing content. For more information on contributing, please see the [CONTRIBUTING](CONTRIBUTING.md) guide.

This is considered an intermediate learning resource, and should typically be referenced after reading the [SP-API Documentation](https://developer-docs.amazon.com/sp-api). Please see [Learning Resources](#learning-resources) for additional resources.

## SP-API Dev MCP Package

The [`@spectrumtest/sp-api-dev-mcp`](https://www.npmjs.com/package/@spectrumtest/sp-api-dev-mcp) package is a consolidated MCP (Model Context Protocol) server that bundles multiple SP-API MCP servers into a single npm package.

### Installation

```bash
npm install -g @spectrumtest/sp-api-dev-mcp
```

### Available Servers

| Server | Command |
|--------|---------|
| SP-API Dev Assistant | `sp-api-dev-assistant-mcp-server` |
| Amazon Data Kiosk (Seller Central) | `amazon-data-kiosk-sc-mcp-server` |
| Amazon Data Kiosk (Vendor Central) | `amazon-data-kiosk-vc-mcp-server` |
| SP-API MCP Server | `sp-api-mcp-server` |

### Usage with npx

```bash
npx @spectrumtest/sp-api-dev-mcp sp-api-dev-assistant-mcp-server
npx @spectrumtest/sp-api-dev-mcp amazon-data-kiosk-sc-mcp-server
npx @spectrumtest/sp-api-dev-mcp amazon-data-kiosk-vc-mcp-server
npx @spectrumtest/sp-api-dev-mcp sp-api-mcp-server
```

### Releasing a New Version

Releases are published automatically via the [Consolidate MCP Servers](.github/workflows/consolidate.yml) GitHub Actions workflow. To trigger a release:

1. Go to **Actions** → **Consolidate MCP Servers** → **Run workflow**
2. Enter the new version number (e.g. `1.0.0`)
3. The workflow will build, bundle, publish to npm, and create a GitHub release

**Required secret:** `NPM_TOKEN` — a granular npm access token with read/write permission for `@spectrumtest/sp-api-dev-mcp`.

## Learning Resources
* [SP-API Website](https://developer.amazonservices.com)
* [SP-API SDK](https://github.com/amzn/selling-partner-api-sdk)
* [SP-API Documentation](https://developer-docs.amazon.com/sp-api)
* [SP-API Developer Support](https://developer.amazonservices.com/support)

## Security

See [CONTRIBUTING](CONTRIBUTING.md) for more information.

## License

This library is licensed under the MIT-0 License. See the [LICENSE](LICENSE) file.

