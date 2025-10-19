const { ethers } = require("ethers");
const path = require('path');
// Load dotenv from the backend folder explicitly and print diagnostics
const envPath = path.resolve(__dirname, '..', '.env');
const dotenv = require('dotenv');
const fs = require('fs');

let dotenvResult = dotenv.config({ path: envPath });
if (dotenvResult.error || !dotenvResult.parsed || Object.keys(dotenvResult.parsed || {}).length === 0) {
  // dotenv failed or returned empty parsed object. Try manual read & parse to handle BOM or encoding issues.
  try {
    const raw = fs.readFileSync(envPath, { encoding: 'utf8' });
    // Remove UTF-8 BOM if present and normalize newlines
    const cleaned = raw.replace(/^[\uFEFF\u200B]+/, '').replace(/\r\n/g, '\n');
    const manualParsed = dotenv.parse(cleaned);
    // Merge parsed keys into process.env if not already set
    for (const [k, v] of Object.entries(manualParsed)) {
      if (!process.env[k]) process.env[k] = v;
    }
    dotenvResult = { parsed: manualParsed };
    console.log(`Manually parsed .env after cleaning BOM. Parsed keys: ${Object.keys(manualParsed).join(', ')}`);
  } catch (err) {
    console.warn('Manual .env parse failed:', err);
  }
  // If manualParsed ended up empty, try detecting BOM/encoding and re-read as utf16le
  if ((!dotenvResult.parsed || Object.keys(dotenvResult.parsed).length === 0)) {
    try {
      const buf = fs.readFileSync(envPath);
      if (buf && buf.length >= 2) {
        // UTF-16 LE BOM
        if (buf[0] === 0xFF && buf[1] === 0xFE) {
          const asUtf16 = buf.toString('utf16le');
          const cleaned2 = asUtf16.replace(/^[\uFEFF\u200B]+/, '').replace(/\r\n/g, '\n');
          const parsed2 = dotenv.parse(cleaned2);
          for (const [k, v] of Object.entries(parsed2)) {
            if (!process.env[k]) process.env[k] = v;
          }
          dotenvResult = { parsed: parsed2 };
          console.log(`Re-parsed .env as utf16le. Parsed keys: ${Object.keys(parsed2).join(', ')}`);
        } else if (buf[0] === 0xFE && buf[1] === 0xFF) {
          // UTF-16 BE
          const asUtf16be = buf.toString('utf16le'); // Node doesn't support utf16be directly; try swap bytes
          // Swap bytes to approximate BE to LE
          const swapped = Buffer.from(asUtf16be, 'utf8').toString('utf8');
          const parsed3 = dotenv.parse(swapped);
          for (const [k, v] of Object.entries(parsed3)) {
            if (!process.env[k]) process.env[k] = v;
          }
          dotenvResult = { parsed: parsed3 };
          console.log(`Re-parsed .env as utf16be-approx. Parsed keys: ${Object.keys(parsed3).join(', ')}`);
        } else {
          // Try latin1 fallback
          const asLatin1 = buf.toString('latin1');
          const cleaned3 = asLatin1.replace(/^[\uFEFF\u200B]+/, '').replace(/\r\n/g, '\n');
          const parsed4 = dotenv.parse(cleaned3);
          for (const [k, v] of Object.entries(parsed4)) {
            if (!process.env[k]) process.env[k] = v;
          }
          if (Object.keys(parsed4).length > 0) {
            dotenvResult = { parsed: parsed4 };
            console.log(`Re-parsed .env as latin1. Parsed keys: ${Object.keys(parsed4).join(', ')}`);
          }
        }
      }
    } catch (reErr) {
      console.warn('Re-parse attempts failed:', reErr);
    }
  }
} else {
  const parsedKeys = dotenvResult.parsed ? Object.keys(dotenvResult.parsed) : [];
  const masked = {
    RPC_URL: process.env.RPC_URL ? 'SET' : 'NOT_SET',
    PRIVATE_KEY: process.env.PRIVATE_KEY ? 'SET' : 'NOT_SET'
  };
  console.log(`Loaded env from ${envPath}. Parsed keys: ${parsedKeys.join(', ')}. RPC_URL=${masked.RPC_URL}, PRIVATE_KEY=${masked.PRIVATE_KEY}`);
}

// Additional diagnostics
try {
  console.log('__dirname =', __dirname);
  console.log('process.cwd() =', process.cwd());
  console.log('envPath resolved =', envPath);
  console.log('env file exists =', fs.existsSync(envPath));
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, { encoding: 'utf8' });
    const preview = content.split(/\r?\n/).slice(0, 10).join('\n');
    console.log('env file preview (first 10 lines):\n' + preview.replace(/(PRIVATE_KEY=.*)/, 'PRIVATE_KEY=<REDACTED>'));
  }
} catch (e) {
  console.warn('Error during env diagnostics:', e);
}

// Validate environment variables
const requiredEnvVars = [
  "PRIVATE_KEY",
  "RPC_URL",
  "FISHERIES_MANAGEMENT_CONTRACT_ADDRESS",
  "FISH_MARKETPLACE_CONTRACT_ADDRESS",
  "FISH_TRANSFER_CONTRACT_ADDRESS",
  "INSPECTOR_AUTHORIZATION_CONTRACT_ADDRESS",
  "PRICING_ADJUSTMENT_CONTRACT_ADDRESS",
  "GOVT_CONTRACT_ADDRESS",
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`${envVar} is not defined in your environment variables.`);
  }
}

// Transaction Logger
const logTransaction = async (tx, receipt, contractName, methodName) => {
  console.log(`Contract call:       ${contractName}#${methodName}`);
  console.log(`  Transaction:         ${tx.hash}`);
  console.log(`  From:                ${tx.from}`);
  console.log(`  To:                  ${tx.to}`);
  console.log(`  Value:               ${ethers.formatEther(tx.value || '0')} ETH`);
  console.log(`  Gas used:            ${receipt.gasUsed} of ${tx.gasLimit}`);
  console.log(`  Block #${receipt.blockNumber}:           ${receipt.blockHash}`);
  console.log('\n');
};

// Improved contract wrapper creation with better error handling
const createContractWrapper = (contract, contractName) => {
  if (!contract || !contractName) {
    throw new Error('Contract and contract name are required for wrapper creation');
  }

  const wrapper = {};
  
  const functions = contract.interface.fragments.filter(f => f.type === 'function');
  
  for (const func of functions) {
    const functionName = func.name;
    
    wrapper[functionName] = async (...args) => {
      try {
        const tx = await contract[functionName](...args);
        
        // Check if it's a transaction or a view/pure function
        if (tx && typeof tx.wait === 'function') {
          const receipt = await tx.wait();
          await logTransaction(tx, receipt, contractName, functionName);
          return { tx, receipt };
        } else {
          // For view/pure functions that return a value
          return tx;
        }
      } catch (error) {
        console.error(`Error in ${contractName}#${functionName}:`, error);
        throw error;
      }
    };
  }
  
  return wrapper;
};

// Set up provider and wallet
let provider;
let wallet;
let contracts = {};

try {
  provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  
  // Use the government address's private key (first Hardhat account)
  // This ensures the backend can call government-only functions
  const govtPrivateKey = process.env.PRIVATE_KEY || "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  wallet = new ethers.Wallet(govtPrivateKey, provider);
  
  console.log("Provider and wallet initialized successfully");
  console.log("Connected wallet address:", wallet.address);
  console.log("Government contract address:", process.env.GOVT_CONTRACT_ADDRESS);
  
  // Verify the wallet address matches the government address
  if (wallet.address.toLowerCase() !== process.env.GOVT_CONTRACT_ADDRESS.toLowerCase()) {
    console.warn("⚠️  WARNING: Wallet address does not match GOVT_CONTRACT_ADDRESS");
    console.warn(`   Wallet: ${wallet.address}`);
    console.warn(`   Expected: ${process.env.GOVT_CONTRACT_ADDRESS}`);
  } else {
    console.log("✅ Wallet address matches government contract address");
  }
} catch (error) {
  console.error("Error initializing provider or wallet:", error);
  process.exit(1);
}

// Load contract ABIs with error handling and validation
const contractABIs = {};
try {
  const loadABI = (name, path) => {
    try {
      const abi = require(path).abi;
      if (!Array.isArray(abi)) {
        throw new Error(`Invalid ABI format for ${name}`);
      }
      console.log(`Loaded ABI for ${name} with ${abi.length} entries`);
      return abi;
    } catch (error) {
      console.error(`Error loading ABI for ${name}:`, error);
      throw error;
    }
  };

  contractABIs.fisheriesManagement = loadABI(
    'FisheriesManagement',
    "../artifacts/contracts/FisheriesManagement.sol/FisheriesManagement.json"
  );
  contractABIs.fishMarketplace = loadABI(
    'FishMarketplace',
    "../artifacts/contracts/FishMarketplace.sol/FishMarketplace.json"
  );
  contractABIs.fishTransfer = loadABI(
    'FishTransfer',
    "../artifacts/contracts/FishTransfer.sol/FishTransfer.json"
  );
  contractABIs.inspectorAuthorization = loadABI(
    'InspectorAuthorization',
    "../artifacts/contracts/InspectorAuthorization.sol/InspectorAuthorization.json"
  );
  contractABIs.pricingAdjustment = loadABI(
    'PricingAdjustment',
    "../artifacts/contracts/PriceAdjustment.sol/PriceAdjustment.json"
  );
  contractABIs.govt = loadABI(
  'Govt',
  "../artifacts/contracts/Govt.sol/Govt.json"
);



} catch (error) {
  console.error("Error loading contract ABIs:", error);
  process.exit(1);
}

// Initialize contract instances with logging wrapper
try {
  const contractConfigs = {
    fisheriesManagement: {
      address: process.env.FISHERIES_MANAGEMENT_CONTRACT_ADDRESS,
      abi: contractABIs.fisheriesManagement
    },
    fishMarketplace: {
      address: process.env.FISH_MARKETPLACE_CONTRACT_ADDRESS,
      abi: contractABIs.fishMarketplace
    },
    fishTransfer: {
      address: process.env.FISH_TRANSFER_CONTRACT_ADDRESS,
      abi: contractABIs.fishTransfer
    },
    inspectorAuthorization: {
      address: process.env.INSPECTOR_AUTHORIZATION_CONTRACT_ADDRESS,
      abi: contractABIs.inspectorAuthorization
    },
    pricingAdjustment: {
      address: process.env.PRICING_ADJUSTMENT_CONTRACT_ADDRESS,
      abi: contractABIs.pricingAdjustment
    },
    govt: {
      address: process.env.GOVT_CONTRACT_ADDRESS,
      abi: contractABIs.govt
    },
  };

  // Create and wrap contracts
  for (const [name, config] of Object.entries(contractConfigs)) {
    console.log(`\nInitializing ${name} contract...`);
    console.log(`Address: ${config.address}`);
    console.log(`ABI length: ${config.abi.length}`);

    if (!config.address || !config.abi) {
      throw new Error(`Missing address or ABI for contract: ${name}`);
    }

    const contract = new ethers.Contract(config.address, config.abi, wallet);
    contracts[name] = createContractWrapper(contract, name);
    console.log(`Contract ${name} initialized successfully`);
  }

  console.log("\nAll contracts initialized successfully with logging enabled");
} catch (error) {
  console.error("Error initializing contracts:", error);
  process.exit(1);
}

module.exports = contracts;