const express = require("express");
const router = express.Router();
const contracts = require("../config/contracts");
const { ethers } = require("ethers");

// In-memory storage for pending inspector requests
// In a real application, this would be stored in a database
let pendingRequests = [];
let requestIdCounter = 1;

// Test route to verify server is working
router.get("/test", (req, res) => {
  res.json({ 
    message: "Backend server is running!", 
    timestamp: new Date().toISOString(),
    routes: [
      "GET /api/test",
      "POST /api/inspector/request-authorization (requires: address only)",
      "GET /api/inspector/check/:address",
      "GET /api/inspector/government"
    ],
    note: "Inspector registration now only requires wallet address"
  });
});

const validateAddress = (req, res, next) => {
  const address = req.body.address || req.params.address;
  if (address && !ethers.isAddress(address)) {
    return res.status(400).json({ message: "Invalid Ethereum address" });
  }
  next();
};

async function checkSyncStatus() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  const syncStatus = await provider.send('eth_syncing');
  console.log(syncStatus);
}

checkSyncStatus();

async function trackBlockNumber() {
  const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545');
  let currentBlock = await provider.getBlockNumber();
  console.log(`Current Block Number: ${currentBlock}`);

  // Continuously track, but with a delay
  setInterval(async () => {
    const newBlock = await provider.getBlockNumber();
    if (newBlock !== currentBlock) {
      currentBlock = newBlock;
      console.log(`New Block: ${currentBlock}`);
    }
  }, 10000); // Poll every 10 seconds
}

trackBlockNumber();


// logs new batches
router.post("/fisheries/logcatch", async (req, res) => {
  console.log("Received request for /fisheries/logcatch");
  let { weight, pricePerKg } = req.body;
  weight = Number(weight);
  pricePerKg = Number(pricePerKg);

  if (isNaN(weight) || weight <= 0) {
    return res.status(400).json({ message: "Invalid weight. Must be a positive integer." });
  }

  if (isNaN(pricePerKg) || pricePerKg <= 0) {
    return res.status(400).json({ message: "Invalid pricePerKg. Must be a positive integer." });
  }

  try {
    const result = await contracts.fisheriesManagement.logCatch(weight, pricePerKg);
    
    res.json({
      message: "Fish catch logged successfully",
      txHash: result.tx.hash
    });

  } catch (error) {
    console.error("Error logging catch:", error);
    res.status(500).json({ 
      message: error.message || "Error logging catch" 
    });
  }
});

// update sustainability status of batch (done by inspector)
router.post("/fisheries/updatesustainability", async (req, res) => {
  const { batchId, sustainable } = req.body;

  try {
    const result = await contracts.fisheriesManagement.updateSustainability(
      batchId,
      sustainable
    );

    res.json({
      message: "Sustainability updated successfully",
      batchId,
      sustainable,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error updating sustainability:", error);
    res.status(500).json({ 
      message: error.message || "Error updating sustainability" 
    });
  }
});

// raise dispute (govt only)
router.post('/fisheries/raiseDispute', async (req, res) => {
  const { batchId, reason } = req.body;
  if (!batchId) return res.status(400).json({ message: 'batchId required' });
  try {
    const tx = await contracts.fisheriesManagement.raiseDispute(Number(batchId), reason || "");
    await tx.wait();
    res.json({ message: 'Dispute raised', batchId, txHash: tx.hash });
  } catch (error) {
    console.error('Error raising dispute:', error);
    res.status(500).json({ message: error.message || 'Failed to raise dispute' });
  }
});

// get batch info
router.get("/fisheries/batch/:batchId", async (req, res) => {
  try {
    const batchId = Number(req.params.batchId);
    const batch = await contracts.fisheriesManagement.getFishBatch(batchId);

    const parsedBatch = {
      id: batch[0].toString(), 
      fisher: batch[1],
      weight: batch[2].toString(), 
      pricePerKg: batch[3].toString(), 
      isSold: batch[4],
      inDispute: batch[5],
      sustainable: batch[6],
      transferIds: batch[7].map((id) => id.toString()) 
    };

    res.json(parsedBatch);
  } catch (error) {
    console.error("Error fetching batch:", error);
    res.status(500).json({ message: `Error fetching batch: ${error.message}` });
  }
});

// update weight of batch
// ***************************************************************
router.put("/fisheries/updateweight/:batchId", async (req, res) => {
  const { weight } = req.body;
  const batchId = Number(req.params.batchId);

  if (isNaN(weight) || weight <= 0) {
    return res.status(400).json({ message: "Invalid weight" });
  }

  try {
    const result = await contracts.fisheriesManagement.updateweight(batchId, weight);
    
    res.json({
      message: "Weight updated successfully",
      batchId: batchId,
      newWeight: weight,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error updating weight:", error);
    res.status(500).json({ 
      message: error.message || "Error updating weight" 
    });
  }
});


// list fish on marketplace for sale
router.post("/marketplace/list", async (req, res) => {
  const { batchId, weight, pricePerKg } = req.body;

  if (isNaN(batchId) || batchId < 0) {
    return res.status(400).json({ message: "Invalid batch ID" });
  }

  if (isNaN(weight) || weight < 0) {
    return res.status(400).json({ message: "Invalid weight" });
  }

  if (isNaN(pricePerKg) || pricePerKg < 0) {
    return res.status(400).json({ message: "Invalid price per kg" });
  }

  try {
    const result = await contracts.fishMarketplace.listFish(
      batchId,
      weight,
      pricePerKg
    );

    res.json({
      message: "Fish listed successfully",
      listingId: result.tx.hash, // Adjust this based on how you want to track listing ID
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error listing fish:", error);
    res.status(500).json({ 
      message: error.message || "Error listing fish" 
    });
  }
});

// get that listing details
router.get("/marketplace/listing/:listingId", async (req, res) => {
  try {
    const listingId = Number(req.params.listingId); // Extract listingId from the request params
    const listing = await contracts.fishMarketplace.getListingDetails(listingId); // Call the contract function

    // Parse the returned listing data
    const parsedListing = {
      listingId: listing[0].toString(),
      batchId: listing[1].toString(),
      fisher: listing[2],
      totalWeight: listing[3].toString(),
      availableWeight: listing[4].toString(),
      pricePerKg: listing[5].toString(),
      isSoldOut: listing[6],
    };

    // Respond with the parsed listing details as JSON
    res.json(parsedListing);
  } catch (error) {
    console.error("Error fetching listing details:", error); // Log the error
    res.status(500).json({ message: `Error fetching listing details: ${error.message}` }); // Return an error response
  }
});

// list all marketplace listings
router.get('/marketplace/listings', async (req, res) => {
  try {
    const nextId = await contracts.fishMarketplace.nextListingId();
    const n = Number(nextId);
    const calls = [];
    for (let i = 1; i < n; i++) calls.push(contracts.fishMarketplace.getListingDetails(i));
    const results = await Promise.all(calls);
    const parsed = results.map(listing => ({
      listingId: listing[0].toString(),
      batchId: listing[1].toString(),
      fisher: listing[2],
      totalWeight: listing[3].toString(),
      availableWeight: listing[4].toString(),
      pricePerKg: listing[5].toString(),
      isSoldOut: listing[6]
    }));
    res.json(parsed);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch listings' });
  }
});

// direct listing price adjustment (marketplace)
router.post('/marketplace/adjustListingPrice', async (req, res) => {
  const { listingId, newPricePerKg } = req.body;
  if (!listingId || isNaN(Number(listingId))) return res.status(400).json({ message: 'Invalid listingId' });
  if (!newPricePerKg || isNaN(Number(newPricePerKg))) return res.status(400).json({ message: 'Invalid newPricePerKg' });
  try {
    const tx = await contracts.fishMarketplace.adjustListingPrice(Number(listingId), Number(newPricePerKg));
    await tx.wait();
    res.json({ message: 'Listing price adjusted', txHash: tx.hash });
  } catch (error) {
    console.error('Error adjusting listing price:', error);
    res.status(500).json({ message: error.message || 'Failed to adjust listing price' });
  }
});

// buy
router.post("/marketplace/buy/:listingId", async (req, res) => {
  const { weight, value } = req.body;
  try {
    const tx = await contracts.fishMarketplace.buyFish(
      req.params.listingId,
      weight,
      {
        value: ethers.parseEther(value.toString()),
      }
    );
    // await tx.wait();
    res.json({ message: "Fish purchased successfully", txHash: tx.hash });
  } catch (error) {
    console.error("Error buying fish:", error);
    res.status(500).json({ message: `Error buying fish: ${error.message}` });
  }
});

// we record the transfer of fish batches through various stages here
router.post("/transfer/record", async (req, res) => {
  const { batchId, stage } = req.body;
  try {
    const tx = await contracts.fishTransfer.recordTransfer(batchId, stage);
    const receipt = await tx.wait();
    const event = receipt.events?.find((e) => e.event === "TransferRecorded");
    res.json({
      message: "Transfer recorded successfully",
      transferId: event?.args?.transferId.toString(),
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Error recording transfer:", error);
    res
      .status(500)
      .json({ message: `Error recording transfer: ${error.message}` });
  }
});

// get transfer by id
router.get('/transfer/:transferId', async (req, res) => {
  try {
    const id = Number(req.params.transferId);
    if (isNaN(id) || id <= 0) return res.status(400).json({ message: 'Invalid transferId' });
    const t = await contracts.fishTransfer.transfers(id);
    // Transfer struct: transferId, batchId, stage, timestamp
    res.json({ transferId: t[0].toString(), batchId: t[1].toString(), stage: t[2], timestamp: t[3].toString() });
  } catch (error) {
    console.error('Error fetching transfer:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch transfer' });
  }
});

// to grant inspection permissions to new inspectors
router.post("/inspector/authorize", validateAddress, async (req, res) => {
  const { address } = req.body;
  try {
    // Find the pending request
    const requestIndex = pendingRequests.findIndex(req => 
      req.address.toLowerCase() === address.toLowerCase() && req.status === "pending"
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: "No pending request found for this address" });
    }
    
    // Call smart contract to authorize inspector
    const tx = await contracts.inspectorAuthorization.authorizeInspector(address);
    await tx.wait();
    
    // Update request status to approved
    pendingRequests[requestIndex].status = "approved";
    pendingRequests[requestIndex].approvedAt = Math.floor(Date.now() / 1000);
    pendingRequests[requestIndex].txHash = tx.hash;
    
    console.log(`✅ Inspector authorized: ${address} (TX: ${tx.hash})`);
    console.log(`📊 Remaining pending requests: ${pendingRequests.filter(r => r.status === "pending").length}`);
    
    res.json({ 
      message: "Inspector authorized successfully", 
      txHash: tx.hash,
      requestId: pendingRequests[requestIndex].id
    });
  } catch (error) {
    console.error("Error authorizing inspector:", error);
    res
      .status(500)
      .json({ message: `Error authorizing inspector: ${error.message}` });
  }
});

// revoke inspector
router.post("/inspector/revoke", validateAddress, async (req, res) => {
  const { address } = req.body;
  try {
    const tx = await contracts.inspectorAuthorization.revokeInspector(address);
    await tx.wait();
    res.json({ message: "Inspector revoked successfully", txHash: tx.hash });
  } catch (error) {
    console.error("Error revoking inspector:", error);
    res.status(500).json({ message: `Error revoking inspector: ${error.message}` });
  }
});

// reject authorization request (government only)
router.post("/inspector/reject", validateAddress, async (req, res) => {
  const { address } = req.body;
  try {
    // Find the pending request
    const requestIndex = pendingRequests.findIndex(req => 
      req.address.toLowerCase() === address.toLowerCase() && req.status === "pending"
    );
    
    if (requestIndex === -1) {
      return res.status(404).json({ message: "No pending request found for this address" });
    }
    
    // Update request status to rejected
    pendingRequests[requestIndex].status = "rejected";
    pendingRequests[requestIndex].rejectedAt = Math.floor(Date.now() / 1000);
    
    console.log(`❌ Authorization request rejected for ${address}`);
    console.log(`📊 Remaining pending requests: ${pendingRequests.filter(r => r.status === "pending").length}`);
    
    res.json({ 
      message: "Authorization request rejected", 
      address,
      requestId: pendingRequests[requestIndex].id
    });
  } catch (error) {
    console.error("Error rejecting authorization:", error);
    res.status(500).json({ message: error.message || "Failed to reject authorization" });
  }
});

// check inspector status
router.get("/inspector/status/:address", async (req, res) => {
  const address = req.params.address;
  if (!ethers.isAddress(address)) return res.status(400).json({ message: "Invalid address" });
  try {
    const status = await contracts.inspectorAuthorization.authorizedInspectors(address);
    res.json({ address, authorized: Boolean(status) });
  } catch (error) {
    console.error("Error checking inspector status:", error);
    res.status(500).json({ message: error.message || "Failed to check inspector status" });
  }
});

// check inspector authorization status (for login)
router.get("/inspector/check/:address", async (req, res) => {
  const address = req.params.address;
  if (!ethers.isAddress(address)) return res.status(400).json({ message: "Invalid address" });
  try {
    const isAuthorized = await contracts.inspectorAuthorization.authorizedInspectors(address);
    
    // Check for pending request
    const pendingRequest = pendingRequests.find(req => 
      req.address.toLowerCase() === address.toLowerCase() && req.status === "pending"
    );
    
    // Check for rejected request
    const rejectedRequest = pendingRequests.find(req => 
      req.address.toLowerCase() === address.toLowerCase() && req.status === "rejected"
    );
    
    res.json({ 
      address, 
      isAuthorized: Boolean(isAuthorized),
      isPending: Boolean(pendingRequest),
      isRejected: Boolean(rejectedRequest),
      requestId: pendingRequest?.id || rejectedRequest?.id
    });
  } catch (error) {
    console.error("Error checking inspector authorization:", error);
    res.status(500).json({ message: error.message || "Failed to check authorization" });
  }
});

// request authorization (register as inspector)
router.post("/inspector/request-authorization", validateAddress, async (req, res) => {
  console.log("📝 Received authorization request:", req.body);
  const { address } = req.body;
  
  if (!address) {
    console.log("❌ Missing required field: address");
    return res.status(400).json({ message: "Address is required" });
  }
  
  try {
    // Check if address already has a pending request
    const existingRequest = pendingRequests.find(req => 
      req.address.toLowerCase() === address.toLowerCase() && req.status === "pending"
    );
    if (existingRequest) {
      return res.status(400).json({ message: "Address already has a pending request" });
    }
    
    // Check if address is already authorized
    const isAlreadyAuthorized = await contracts.inspectorAuthorization.authorizedInspectors(address);
    if (isAlreadyAuthorized) {
      return res.status(400).json({ message: "Address is already authorized as an inspector" });
    }
    
    // Create new pending request
    const newRequest = {
      id: requestIdCounter++,
      address: address,
      timestamp: Math.floor(Date.now() / 1000), // Unix timestamp
      status: "pending"
    };
    
    pendingRequests.push(newRequest);
    
    console.log(`✅ Authorization request from address: ${address} (ID: ${newRequest.id})`);
    console.log(`📊 Total pending requests: ${pendingRequests.length}`);
    
    res.json({
      message: "Authorization request submitted successfully",
      requestId: newRequest.id,
      address,
      status: "pending"
    });
  } catch (error) {
    console.error("❌ Error submitting authorization request:", error);
    res.status(500).json({ message: error.message || "Failed to submit authorization request" });
  }
});

// get pending authorization requests (government only)
router.get("/inspector/pending-requests", async (req, res) => {
  try {
    // Filter only pending requests
    const pendingOnly = pendingRequests.filter(req => req.status === "pending");
    
    console.log(`📋 Returning ${pendingOnly.length} pending requests`);
    
    res.json({ 
      requests: pendingOnly,
      count: pendingOnly.length
    });
  } catch (error) {
    console.error("Error fetching pending requests:", error);
    res.status(500).json({ message: error.message || "Failed to fetch pending requests" });
  }
});

// get authorized inspectors
router.get("/inspector/authorized-inspectors", async (req, res) => {
  try {
    // In a real application, you'd maintain a list of authorized inspectors
    // For now, return empty array
    res.json({ 
      inspectors: []
    });
  } catch (error) {
    console.error("Error fetching authorized inspectors:", error);
    res.status(500).json({ message: error.message || "Failed to fetch authorized inspectors" });
  }
});

// get government address
router.get("/inspector/government", async (req, res) => {
  try {
    // This would typically come from the contract or environment
    const governmentAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Default Hardhat account
    res.json({ government: governmentAddress });
  } catch (error) {
    console.error("Error fetching government address:", error);
    res.status(500).json({ message: error.message || "Failed to fetch government address" });
  }
});

// verify government address authentication
router.post("/govt/verify", validateAddress, async (req, res) => {
  const { address } = req.body;
  try {
    // Get the government contract address from environment
    const govtContractAddress = process.env.GOVT_CONTRACT_ADDRESS || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    
    // Check if the provided address matches the government contract address
    const isAuthorized = address && address.toLowerCase() === govtContractAddress.toLowerCase();
    
    console.log(`Government verification attempt: ${address} vs ${govtContractAddress} = ${isAuthorized}`);
    
    res.json({ 
      address,
      govtContractAddress,
      isAuthorized,
      message: isAuthorized ? "Government access granted" : "Access denied - not authorized government address"
    });
  } catch (error) {
    console.error("Error verifying government address:", error);
    res.status(500).json({ message: error.message || "Failed to verify government address" });
  }
});

// adjust pricing based on sustainability and freshness of a specific listing
// router.post("/pricing/adjust/:listingId", async (req, res) => {
//   const { sustainabilityFactor, freshnessFactor } = req.body;
//   try {
//     const tx = await contracts.pricingAdjustment.adjustPrice(
//       req.params.listingId,
//       sustainabilityFactor,
//       freshnessFactor
//     );
//     await tx.wait();
//     res.json({ message: "Price adjusted successfully", txHash: tx.hash });
//   } catch (error) {
//     console.error("Error adjusting price:", error);
//     res
//       .status(500)
//       .json({ message: `Error adjusting price: ${error.message}` });
//   }
// });

router.post("/pricing/adjust/:listingId", async (req, res) => {
  const { listingId } = req.params;
  const { sustainabilityFactor, freshnessFactor } = req.body;

  try {
    // Input validation
    if (
      sustainabilityFactor === undefined ||
      freshnessFactor === undefined
    ) {
      return res.status(400).json({
        message: "Both sustainabilityFactor and freshnessFactor are required",
      });
    }

    // Fetch listing details for reference (optional, just to show user info)
    const listing = await contracts.fishMarketplace.getListingDetails(listingId);
    const basePrice = Number(listing[5]); // pricePerKg

    // Call the smart contract
    const tx = await contracts.priceAdjustment.adjustPrice(
      listingId,
      sustainabilityFactor,
      freshnessFactor
    );
    await tx.wait();

    // Optional: Fetch new price to confirm adjustment
    const updatedListing = await contracts.fishMarketplace.getListingDetails(listingId);
    const newPrice = Number(updatedListing[5]);

    res.json({
      message: "Price adjusted successfully",
      listingId,
      basePrice,
      sustainabilityFactor,
      freshnessFactor,
      newPrice,
      txHash: tx.hash,
    });
  } catch (error) {
    console.error("Error adjusting price:", error);
    res.status(500).json({
      message: error.reason || error.message || "Failed to adjust price",
    });
  }
});



// Report Stolen Batch
router.post("/govt/reportStolen", async (req, res) => {
  const { batchId } = req.body;

  try {
    const result = await contracts.govt.reportStolen(batchId);
    res.json({
      message: "Batch reported as stolen",
      batchId,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error reporting stolen batch:", error);
    res.status(500).json({ message: error.message || "Failed to report stolen batch" });
  }
});

// Pay Insurance for Dispute Batch
router.post("/govt/payInsurance/dispute", async (req, res) => {
  const { batchId, amount } = req.body;

  try {
    const result = await contracts.govt.payInsuranceForDisputeBatch(batchId, amount);
    res.json({
      message: "Insurance paid for disputed batch",
      batchId,
      amount,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error paying insurance for dispute:", error);
    res.status(500).json({ message: error.message || "Failed to pay insurance" });
  }
});

// Pay Insurance for Stolen Batch
router.post("/govt/payInsurance/stolen", async (req, res) => {
  const { batchId, amount } = req.body;

  try {
    const result = await contracts.govt.payInsuranceForStolen(batchId, amount);
    res.json({
      message: "Insurance paid for stolen batch",
      batchId,
      amount,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error paying insurance for stolen batch:", error);
    res.status(500).json({ message: error.message || "Failed to pay insurance" });
  }
});

// Buy Back Unsold Batch
router.post("/govt/buyBack", async (req, res) => {
  const { listingId, weight } = req.body;

  try {
    const result = await contracts.govt.buyBackUnsoldBatch(listingId, weight);
    res.json({
      message: "Government buyback executed",
      listingId,
      weight,
      txHash: result.tx.hash
    });
  } catch (error) {
    console.error("Error executing buyback:", error);
    res.status(500).json({ message: error.message || "Failed to execute buyback" });
  }
});

// Fund Management
router.post("/govt/deposit", async (req, res) => {
  const { value } = req.body;
  try {
    const tx = await contracts.govt.deposit({ value: ethers.parseEther(value.toString()) });
    res.json({ message: "Funds deposited successfully", txHash: tx.hash });
  } catch (error) {
    console.error("Error depositing funds:", error);
    res.status(500).json({ message: error.message || "Deposit failed" });
  }
});
router.post("/govt/withdraw", async (req, res) => {
  const { amount, to } = req.body;
  try {
    const tx = await contracts.govt.withdraw(
      ethers.parseEther(amount.toString()),
      to
    );
    res.json({ message: "Withdrawal successful", txHash: tx.hash });
  } catch (error) {
    console.error("Error withdrawing funds:", error);
    res.status(500).json({ message: error.message || "Withdrawal failed" });
  }
});


// Set Linked Contracts (admin-only)
router.post("/govt/setContracts", async (req, res) => {
  const { fisheriesAddress, inspectorAuthAddress, marketplaceAddress } = req.body;

  try {
    await contracts.govt.setFisheriesManagement(fisheriesAddress);
    await contracts.govt.setInspectorAuthorization(inspectorAuthAddress);
    await contracts.govt.setMarketplace(marketplaceAddress);

    res.json({ message: "Linked contracts updated successfully" });
  } catch (error) {
    console.error("Error setting linked contracts:", error);
    res.status(500).json({ message: error.message || "Failed to set linked contracts" });
  }
});

// get government contract balance
router.get('/govt/balance', async (req, res) => {
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    const govtAddress = process.env.GOVT_CONTRACT_ADDRESS;
    if (!govtAddress) return res.status(500).json({ message: 'Govt contract address not configured' });
    const balance = await provider.getBalance(govtAddress);
    res.json({ govtAddress, balance: ethers.formatEther(balance) });
  } catch (error) {
    console.error('Error fetching govt balance:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch govt balance' });
  }
});

// get linked contract addresses from Govt
router.get('/govt/addresses', async (req, res) => {
  try {
    const fisheriesAddr = await contracts.govt.fisheries();
    const inspectorAddr = await contracts.govt.inspectorAuth();
    const marketplaceAddr = await contracts.govt.marketplace();
    res.json({ fisheriesAddr, inspectorAddr, marketplaceAddr });
  } catch (error) {
    console.error('Error fetching govt linked addresses:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch linked addresses' });
  }
});





module.exports = router;