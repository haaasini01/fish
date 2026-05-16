# Smart Fisheries: Leveraging Blockchain for Government Schemes

## Project Overview

This decentralized blockchain application provides a comprehensive solution for managing fisheries, fish trading, and sustainability tracking. The system leverages smart contracts to ensure transparency, traceability, and efficient market operations in the fishing industry.

## Key Contracts

### 1. FisheriesManagement.sol
- Manages fish batch logging and tracking
- Allows government to update sustainability status
- Tracks fish batch details and transfers

### 2. FishMarketplace.sol
- Enables listing and trading of fish batches
- Supports buying fish with weight-based pricing
- Ensures only sustainable fish can be listed

### 3. FishTransfer.sol
- Records transfer stages of fish batches
- Tracks logistical movements and timestamps
- Integrates with FisheriesManagement contract

### 4. InspectorAuthorization.sol
- Manages authorization of fishing inspectors
- Controlled by government address
- Allows adding and revoking inspector permissions

### 5. PriceAdjustment.sol
- Dynamic pricing mechanism
- Adjusts fish prices based on sustainability and freshness factors

## 🔑 Key Features

- **Sustainability Tracking**: Government can mark fish batches as sustainable
- **Transparent Trading**: Open marketplace for fish trading
- **Transfer Logging**: Comprehensive tracking of fish batch movements
- **Price Flexibility**: Dynamic price adjustment based on multiple factors
- **Secure Authorization**: Government-controlled inspector management

## 🛡️ Security Considerations

- Only government can update sustainability status
- Authorized inspectors manage fish batch tracking
- Price adjustments controlled by specific contract
- Built-in checks to prevent unauthorized actions


## Requirements

- **Node.js**: v16 or higher
- **Solidity ^0.8.27**
- **Ethereum-compatible blockchain environment**
- **MetaMask or similar Web3 wallet**
- **Environment Variables**: Configure a `.env` file with the following:

  ```plaintext
  PRIVATE_KEY=<your-private-key>
  ```

  Replace `<your-private-key>` with the private key of your Ethereum wallet. This key will be used for signing transactions during deployment.

---

## Installation and Setup for Backend

1. Clone the repository:
   ```bash
   git clone https://github.com/haaasini01/fish.git
   cd fish
   cd backend
   ```


2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file
    ```bash
   touch .env
   ```
3. Set up the `.env` file in the backend of the project as shown above.

---

## Deployment

Deployment is managed using `hardhat-deploy`. Scripts are stored in the `deploy` directory.

### Deploying to a Local Network

1. Start a local blockchain:
   ```bash
   npx hardhat node
   ```

2. Deploy the contracts:
   ```bash
   npx hardhat deploy --network localhost
   ```
3. Run the backend server 
   ```bash
   nodemon app.js
   ```

4. Url generated for interaction
   ```
   http://localhost:8080/api/function
   ```

### Deploying to Other Networks

1. Ensure the `.env` file is configured with a valid private key.
2. Add RPC URLs for networks in `hardhat.config.js` if necessary.

## Testing

Test scripts are located in the `test` directory.

1. Run all tests:
   ```bash
   npx hardhat test
   ```

2. Run tests with a gas report:
   ```bash
   REPORT_GAS=true npx hardhat test
   ```

3. Run tests on a local blockchain:
   ```bash
   npx hardhat test --network localhost
   ```

---

## Project Structure

```
- backend
├── contracts/             # Solidity smart contracts
├── deploy/                # Deployment scripts
├── test/                  # Tests for the contracts
├── hardhat.config.js      # Hardhat configuration
├── .env                   # Environment variables file
├── routes/                # All the routes are defined
├── scripts/               # mining a block manually
├── app.js                 # Backend server
└── README.md              # Documentation
```

---


## Example Commands

### Common Tasks

- **List Available Tasks:**
  ```bash
  npx hardhat help
  ```

- **Start a Local Node:**
  ```bash
  npx hardhat node
  ```

- **Run a Script:**
  ```bash
  npx hardhat run scripts/<script-name>.js
  ```

### Deployment Examples

- Deploy to the local network:
  ```bash
  npx hardhat deploy --network localhost
  ```

- Deploy to a testnet (e.g., Rinkeby):
  ```bash
  npx hardhat deploy --network rinkeby
  ```

### Testing Examples

- Run all tests:
  ```bash
  npx hardhat test
  ```

- Run tests with gas usage reporting:
  ```bash
  REPORT_GAS=true npx hardhat test
  ```

---

## Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [hardhat-deploy Plugin](https://github.com/wighawag/hardhat-deploy)
- [Ether.js v6](https://docs.ethers.org/v6/getting-started/#starting-glossary)
- [body-parser](https://www.npmjs.com/package/body-parser)
- [cors](https://www.npmjs.com/package/cors)
- [dotenv](https://www.dotenv.org/docs/quickstart)
- [Express](https://expressjs.com/en/5x/api.html)
---

## 📄 License

This project is licensed under the **Apache License**. See the [LICENSE](LICENSE) file for details.
