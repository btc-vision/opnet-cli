# OPNet-CLI

![Bitcoin](https://img.shields.io/badge/Bitcoin-000?style=for-the-badge&logo=bitcoin&logoColor=white)
![C#](https://img.shields.io/badge/c%23-%23239120.svg?style=for-the-badge&logo=csharp&logoColor=white)
![.Net](https://img.shields.io/badge/.NET-5C2D91?style=for-the-badge&logo=.net&logoColor=white)
![NodeJS](https://img.shields.io/badge/node.js-6DA55F?style=for-the-badge&logo=node.js&logoColor=white)
![NPM](https://img.shields.io/badge/NPM-%23CB3837.svg?style=for-the-badge&logo=npm&logoColor=white)

## Introduction

**OPNet-cli** is a .NET Core CLI utility designed to streamline the creation, management, and deployment of OP20 contracts and others. It allows developers to initialize projects, create OP20 token contracts, and manage contract deployment through a simple command-line interface. The tool supports cross-platform environments and ensures that contract development is efficient and straightforward.

## Requirements

### Windows:
- .NET Core Framework version 8 [Download here](https://aka.ms/dotnet-core-applaunch?missing_runtime=true&arch=x64&rid=win-x64&os=win10&apphost_version=8.0.6)

## Installation

1. Unzip the `opnetcli.zip` package.

2. For Linux and macOS:
    - Open a terminal.
    - Navigate to the 'publish' folder.
    - Execute the following command:
      ```bash
      chmod +x opnetcli
      ```

## Usage Notes
- When setting a parameter value that contains spaces, enclose the value in double quotation marks `""`.
- Parameters marked with `*` are mandatory.

## Commands

### 1. `createcontract`
Create a generic OP20 contract project. This includes:
- Contract source files.
- Deployment files.
- Unit tests.

**Parameters:**
- `*contractname`: The name of the contract.
- `contractpath`: The path where the contract files will be stored. If not specified, the current directory is used. *(optional)*

**Example:**
```bash
opnetcli createcontract -contractname:test -contractpath:c:/temp/contracts
```

### 2. `createtoken`
Create a basic token project. This includes:
- Contract source files.
- Deployment files.
- Unit tests.

**Parameters:**
- `*contractname`: The name of the contract.
- `contractpath`: The path where the contract files will be stored. *(optional)*
- `*tokenname`: The name of the token.
- `*tokensymbol`: The token symbol.
- `*tokendecimals`: The number of decimals for the token.
- `*tokenmaxsupply`: The maximum supply of the token.

**Example:**
```bash
opnetcli createtoken -contractname:TestToken -contractpath:c:/temp/contracts -tokenname:TestToken -tokensymbol:TSTTKN -tokendecimals:18 -tokenmaxsupply:10000000
```

### 3. `deploy`
Display the deployment steps.

---

## Deployment

To deploy a WebAssembly (WASM) contract using OPNet-cli, follow these steps. The WASM file to be deployed is located in the build folder of your contract.

**Overview of Key Files:**
- `config.ts`: Contains deployment configuration information such as the network provider, the network to deploy on, and the wallet's private key.
- `deploy.ts`: Responsible for launching the deployment process.

**Steps:**

1. **Navigate to the deploy folder:**
    - Open your terminal or command prompt.
    - Change the directory to the deploy folder where the deployment scripts are located.

2. **Configure the Deployment Settings:**
    - Open the `config.ts` file in a text editor.
    - Modify the following settings:
        - `OPNET_PROVIDER`: Set this to the desired provider.
        - `NETWORK`: Set this to the appropriate network.
        - `PRIVATE_KEY`: Replace 'YOUR PRIVATE KEY HERE' with your actual wallet's private key.
    - Save the `config.ts` file.

3. **Install Dependencies:**
   Run the following command to install the necessary dependencies:
   ```bash
   npm install
   ```

4. **Build the Deployment Scripts:**
   After installing dependencies, run the following command to build the deployment scripts:
   ```bash
   gulp
   ```

5. **Deploy the Contract:**
   Change the directory back to the main folder of your contract, and deploy the contract:
   ```bash
   node ./deploy/build/deploy.js
   ```

**Important Warnings:**
- **Private Key Security:** Do not leave your wallet private key in the `config.ts` file. After deploying the contract, remove your private key from this file.
- **Repository Security:** Ensure the `config.ts` file is not pushed to any repository with your private key intact.

---

## Unit Testing

When you generate a contract project using OPNet-cli, a basic unit testing framework is created. This structure provides the initial framework for testing, but it requires manual updates to cover all contract functionality.

### Steps to Complete Unit Tests:

1. **Basic Unit Test Structure:**
    - Placeholder test cases are generated. Manually expand them to cover all contract functionality.
    - Unit tests are located in the `src/tests` folder. You will find a file named after your contract (e.g., `MyContract.ts`), where the tests are written.

2. **Contract WASM File:**
   Ensure the WASM file for your contract is placed in the `bytecode` folder in the `unittests` directory. Unit tests require the compiled WASM file to validate contract behavior.

3. **Update `config.ts`:**
   The `config.ts` file in the `src/contracts` folder must be updated to set the `NETWORK` field for the appropriate test network (e.g., testnet, mainnet).

4. **Implement the Contract Interface:**
   In the `src/contracts` folder, manually code the file named after your contract to reflect the contract’s methods. This interface enables your unit tests to call contract methods.

   **Implementation Steps:**
    - Create interfaces for all event classes and data classes in your smart contract.
    - Implement decoders for all event and data classes.
    - Create selector methods for all exposed methods in the contract.
    - Implement method wrappers for all exposed contract methods.

5. **Write Unit Tests:**
    - Use the initial unit test structure in `src/tests/MyContract.ts` to create comprehensive tests.
    - Refer to the assertion functions in `src/opnet/unit/Assert.ts` and `src/opnet/unit/Assertion.ts` for validating test outcomes.

**Additional Information:**
- More detailed documentation and examples will be published on the website.
- Continuously update your unit tests as the contract evolves to ensure thorough testing of new features.

---

## License

This project is licensed under the MIT License. View the full license [here](https://github.com/your-org/opnet-cli/blob/main/LICENSE).

---

This README provides all necessary details for developers to get started with OPNet-cli, create and deploy OP20 contracts, and manage unit testing for their smart contracts.
