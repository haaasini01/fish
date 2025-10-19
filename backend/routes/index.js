const express = require("express");
const router = express.Router();
const contracts = require("../config/contracts");
const { ethers } = require("ethers");

// In-memory storage for pending inspector requests
// In a real application, this would be stored in a database
let pendingRequests = [];
let requestIdCounter = 1;
// In-memory list of approved/authorized inspectors (simple cache)
// Each entry: { id, address, timestamp, approvedAt }
let approvedInspectors = [];

// Rebuild approvedInspectors from on-chain events at startup and subscribe to future events
async function rebuildApprovedInspectors() {
  try {
    console.log('Rebuilding approvedInspectors cache from on-chain events...');
    approvedInspectors = []; // reset

    // Try to read past events via contract - ethers v6 doesn't have getPastEvents; rely on scanning listings/holders if available
    // Fallback: query authorizedInspectors mapping for a small set of known accounts is impractical; instead try to subscribe to future events and
    // attempt a best-effort reconstruction by scanning the chain for InspectorAuthorized/InspectorRevoked logs using provider

    const inspectorContract = contracts.inspectorAuthorization; // wrapper
    const rawContract = inspectorContract && inspectorContract._contract ? inspectorContract._contract : null;
    // Our createContractWrapper doesn't expose the raw ethers.Contract, so attempt to recreate one for event scanning
    let provider = null;
    try {
      provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    } catch (e) {
      console.warn('Could not create provider for event scanning:', e.message || e);
    }

    // If we can get an ABI and address, create a temporary contract to query events
    try {
      const inspectorAddr = process.env.INSPECTOR_AUTHORIZATION_CONTRACT_ADDRESS;
      const inspectorABI = require('../artifacts/contracts/InspectorAuthorization.sol/InspectorAuthorization.json').abi;
      if (provider && inspectorAddr && inspectorABI) {
        const ethersContract = new ethers.Contract(inspectorAddr, inspectorABI, provider);

        // Query all InspectorAuthorized events from block 0 to latest (works for local/dev chains)
        const fromBlock = 0;
        const toBlock = 'latest';
        const filterAuth = ethersContract.filters.InspectorAuthorized();
        const logsAuth = await provider.getLogs({ ...filterAuth, fromBlock, toBlock, address: inspectorAddr });
        const iface = new ethers.Interface(inspectorABI);
        for (const log of logsAuth) {
          try {
            const parsed = iface.parseLog(log);
            const inspectorAddrLog = parsed.args.inspector || parsed.args[0];
            if (inspectorAddrLog) {
              const addr = inspectorAddrLog.toString();
              if (!approvedInspectors.find(i => i.address.toLowerCase() === addr.toLowerCase())) {
                approvedInspectors.push({ id: null, address: addr, timestamp: Math.floor(Date.now()/1000), approvedAt: Math.floor(Date.now()/1000) });
              }
            }
          } catch (e) { /* ignore parse errors */ }
        }

        // Remove those which are revoked
        const filterRev = ethersContract.filters.InspectorRevoked();
        const logsRev = await provider.getLogs({ ...filterRev, fromBlock, toBlock, address: inspectorAddr });
        for (const log of logsRev) {
          try {
            const parsed = iface.parseLog(log);
            const addr = (parsed.args.inspector || parsed.args[0]).toString();
            approvedInspectors = approvedInspectors.filter(i => i.address.toLowerCase() !== addr.toLowerCase());
          } catch (e) { /* ignore */ }
        }

        console.log(`Rebuilt approvedInspectors cache: ${approvedInspectors.length} entries`);

        // Subscribe to future events to keep cache updated
        ethersContract.on('InspectorAuthorized', (inspector) => {
          try {
            const addr = inspector.toString();
            if (!approvedInspectors.find(i => i.address.toLowerCase() === addr.toLowerCase())) {
              approvedInspectors.push({ id: null, address: addr, timestamp: Math.floor(Date.now()/1000), approvedAt: Math.floor(Date.now()/1000) });
              console.log(`InspectorAuthorized event: ${addr} -> added to cache`);
            }
          } catch (e) { console.warn('Error handling InspectorAuthorized event', e); }
        });

        ethersContract.on('InspectorRevoked', (inspector) => {
          try {
            const addr = inspector.toString();
            approvedInspectors = approvedInspectors.filter(i => i.address.toLowerCase() !== addr.toLowerCase());
            console.log(`InspectorRevoked event: ${addr} -> removed from cache`);
          } catch (e) { console.warn('Error handling InspectorRevoked event', e); }
        });
      } else {
        console.warn('Skipping event scan: missing provider/inspector contract details');
      }
    } catch (e) {
      console.warn('Error during inspector event scan/subscription:', e && e.message ? e.message : e);
    }
  } catch (e) {
    console.error('Failed to rebuild approvedInspectors:', e && e.message ? e.message : e);
  }
}

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

// Helper to safely extract tx hash from wrapper result which may be { tx, receipt } or a raw tx
const getTxHash = (result) => {
  return (result && result.tx && result.tx.hash) ? result.tx.hash : (result && result.hash) ? result.hash : null;
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
      txHash: getTxHash(result)
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
      txHash: getTxHash(result)
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
  const result = await contracts.fisheriesManagement.raiseDispute(Number(batchId), reason || "");
  const txHash = getTxHash(result);
  res.json({ message: 'Dispute raised', batchId, txHash });
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

// list all fish batches (for inspector dashboard)
router.get('/fisheries/batches', async (req, res) => {
  try {
    // optional query params for pagination
    const limit = req.query.limit ? Number(req.query.limit) : null;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const nextIdRaw = await contracts.fisheriesManagement.nextBatchId();
    const nextId = Number(nextIdRaw);
    const results = [];

    // iterate from 1 to nextId-1
    for (let i = 1; i < nextId; i++) {
      if (limit !== null && results.length >= limit) break;
      if (i < offset) continue;

      try {
        const b = await contracts.fisheriesManagement.getFishBatch(i);
        results.push({
          id: Number(b[0].toString()),
          fisher: b[1],
          weight: b[2].toString(),
          pricePerKg: b[3].toString(),
          isSold: b[4],
          inDispute: b[5],
          sustainable: b[6],
          transferIds: Array.isArray(b[7]) ? b[7].map(x => x.toString()) : []
        });
      } catch (err) {
        // skip missing batches
        console.warn('Skipping batch', i, err.message || err);
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch batches' });
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
      txHash: getTxHash(result)
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

    // Try to extract listingId from the transaction receipt events (if the contract emits it)
    const receipt = result && (result.receipt || null);
    // Detailed logging: dump receipt and each event's name + args for debugging
    try {
      if (receipt) {
        console.log('Listing transaction receipt:', JSON.stringify(receipt, (k, v) => {
          // Replace big objects like provider with simple markers to avoid huge output
          if (k === 'transaction' || k === 'logs' || k === 'raw') return '[REDACTED]';
          return v;
        }, 2));
      } else {
        console.log('No transaction receipt available for listFish result. Raw result:', JSON.stringify(result, (k, v) => { try { return (v && typeof v === 'object' && v._isBigNumber) ? v.toString() : v; } catch(e){ return String(v); } }, 2));
      }

      if (receipt && Array.isArray(receipt.events) && receipt.events.length > 0) {
        console.log(`Receipt contains ${receipt.events.length} event(s):`);
        receipt.events.forEach((ev, idx) => {
          try {
            const evName = ev.event || ev.eventName || ev.name || `event_${idx}`;
            const args = ev.args;
            let argsRepr = null;
            try {
              if (Array.isArray(args)) {
                argsRepr = args.map(a => (a && typeof a.toString === 'function') ? a.toString() : JSON.stringify(a)).join(', ');
              } else if (args && typeof args === 'object') {
                const obj = {};
                Object.keys(args).forEach(k => {
                  try { obj[k] = (args[k] && typeof args[k].toString === 'function') ? args[k].toString() : args[k]; } catch(e) { obj[k] = String(args[k]); }
                });
                argsRepr = JSON.stringify(obj);
              } else {
                argsRepr = String(args);
              }
            } catch (e) {
              argsRepr = '<<unserializable>>';
            }
            console.log(`  Event[${idx}] ${evName} -> args: ${argsRepr}`);
          } catch (e) {
            console.warn('Error logging event entry', e && e.message ? e.message : e);
          }
        });
      } else {
        console.log('Receipt contains no events');
      }
    } catch (e) {
      console.warn('Error while logging receipt/events:', e && e.message ? e.message : e);
    }
    let listingId = null;
    if (receipt && receipt.events && Array.isArray(receipt.events)) {
      for (const ev of receipt.events) {
        if (ev && ev.args) {
          // Common pattern: first arg or named 'listingId'
          if (ev.args.listingId) {
            listingId = ev.args.listingId.toString();
            break;
          }
          // fallback to first positional arg
          if (ev.args[0]) {
            try { listingId = ev.args[0].toString(); break; } catch (e) { /* ignore */ }
          }
        }
      }
    }

    const txHash = getTxHash(result);

    // If we couldn't extract listingId from the receipt, try to inspect the latest listing
    if (!listingId) {
      try {
        const nextListing = await contracts.fishMarketplace.nextListingId();
        const lastIndex = Number(nextListing) - 1;
        if (lastIndex > 0) {
          const lastListing = await contracts.fishMarketplace.getListingDetails(lastIndex);
          const lastBatchId = Number(lastListing[1].toString());
          if (lastBatchId === Number(batchId)) {
            listingId = lastIndex.toString();
          }
        }
      } catch (e) {
        console.warn('Could not determine listingId from contract state', e && e.message ? e.message : e);
      }
    }

    // If we have a numeric listingId, fetch and return the parsed listing for frontend convenience
    let parsedListing = null;
    try {
      const numericId = listingId && !isNaN(Number(listingId)) ? Number(listingId) : null;
      if (numericId) {
        const listingDetails = await contracts.fishMarketplace.getListingDetails(numericId);
        parsedListing = {
          listingId: listingDetails[0].toString(),
          batchId: listingDetails[1].toString(),
          fisher: listingDetails[2],
          totalWeight: listingDetails[3].toString(),
          availableWeight: listingDetails[4].toString(),
          pricePerKg: listingDetails[5].toString(),
          isSoldOut: listingDetails[6]
        };
      }
    } catch (e) {
      console.warn('Could not fetch parsed listing after create:', e && e.message ? e.message : e);
    }

    console.debug('Listing result', { batchId, listingId, txHash, parsedListing });

    res.json({
      message: "Fish listed successfully",
      listingId: listingId || txHash,
      txHash,
      parsedListing
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

// Adjust listing price by batchId (helper endpoint)
router.post('/marketplace/adjustByBatch', async (req, res) => {
  // Accept either `newPricePerKg` or `newPrice` (frontend may send `newPrice`)
  const { batchId } = req.body;
  const rawNewPrice = req.body.newPricePerKg ?? req.body.newPrice ?? req.body.new_price;

  if (!batchId) return res.status(400).json({ message: 'batchId required' });
  if (rawNewPrice === undefined || rawNewPrice === null || rawNewPrice === '') return res.status(400).json({ message: 'newPricePerKg (or newPrice) required' });

  const newPriceNum = Number(rawNewPrice);
  if (isNaN(newPriceNum)) return res.status(400).json({ message: 'Invalid new price' });

  try {
    const nextId = await contracts.fishMarketplace.nextListingId();
    const n = Number(nextId);
    let found = false;
    let resultTx = null;
    for (let i = 1; i < n; i++) {
      const listing = await contracts.fishMarketplace.getListingDetails(i);
      const listingBatchId = Number(listing[1].toString());
      if (listingBatchId === Number(batchId)) {
        // Adjust this listing
        resultTx = await contracts.fishMarketplace.adjustListingPrice(i, newPriceNum);
        found = true;
        break;
      }
    }

    if (!found) return res.status(404).json({ message: 'Listing for batchId not found' });

    const txHash = getTxHash(resultTx);
    res.json({ message: 'Price adjusted', txHash });
  } catch (error) {
    console.error('Error adjusting listing by batch:', error);
    res.status(500).json({ message: error.message || 'Failed to adjust listing by batch' });
  }
});

// direct listing price adjustment (marketplace)
router.post('/marketplace/adjustListingPrice', async (req, res) => {
  const { listingId, newPricePerKg } = req.body;
  if (!listingId || isNaN(Number(listingId))) return res.status(400).json({ message: 'Invalid listingId' });
  if (!newPricePerKg || isNaN(Number(newPricePerKg))) return res.status(400).json({ message: 'Invalid newPricePerKg' });
  try {
  const result = await contracts.fishMarketplace.adjustListingPrice(Number(listingId), Number(newPricePerKg));
  const txHash = getTxHash(result);
  res.json({ message: 'Listing price adjusted', txHash });
  } catch (error) {
    console.error('Error adjusting listing price:', error);
    res.status(500).json({ message: error.message || 'Failed to adjust listing price' });
  }
});

// buy
router.post("/marketplace/buy/:listingId", async (req, res) => {
  const { weight, value } = req.body;
  try {
    const result = await contracts.fishMarketplace.buyFish(
      req.params.listingId,
      weight,
      {
        value: ethers.parseEther(value.toString()),
      }
    );
  const txHash = getTxHash(result);
  res.json({ message: "Fish purchased successfully", txHash });
  } catch (error) {
    console.error("Error buying fish:", error);
    res.status(500).json({ message: `Error buying fish: ${error.message}` });
  }
});

// we record the transfer of fish batches through various stages here
router.post("/transfer/record", async (req, res) => {
  const { batchId, stage } = req.body;
  try {
    const result = await contracts.fishTransfer.recordTransfer(batchId, stage);
  const receipt = result && result.receipt ? result.receipt : null;
  const event = receipt?.events?.find((e) => e.event === "TransferRecorded");
  const txHash = getTxHash(result);
    res.json({
      message: "Transfer recorded successfully",
      transferId: event?.args?.transferId?.toString(),
      txHash,
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
  const result = await contracts.inspectorAuthorization.authorizeInspector(address);
  // result may be { tx, receipt } or raw tx; wrapper already waits, so use receipt if needed
  const txHash = getTxHash(result);
    
    // Update request status to approved
    pendingRequests[requestIndex].status = "approved";
    pendingRequests[requestIndex].approvedAt = Math.floor(Date.now() / 1000);
  pendingRequests[requestIndex].txHash = txHash;
    
    // Add to approved inspectors cache if not already present
    if (!approvedInspectors.find(i => i.address.toLowerCase() === address.toLowerCase())) {
      approvedInspectors.push({ id: pendingRequests[requestIndex].id, address, timestamp: pendingRequests[requestIndex].timestamp, approvedAt: pendingRequests[requestIndex].approvedAt });
    }

    console.log(`✅ Inspector authorized: ${address} (TX: ${txHash})`);
    console.log(`📊 Remaining pending requests: ${pendingRequests.filter(r => r.status === "pending").length}`);
    
    res.json({ 
      message: "Inspector authorized successfully", 
      txHash,
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
  const result = await contracts.inspectorAuthorization.revokeInspector(address);
  const txHash = getTxHash(result);

  // Remove from approved inspectors cache
  approvedInspectors = approvedInspectors.filter(i => i.address.toLowerCase() !== address.toLowerCase());

  res.json({ message: "Inspector revoked successfully", txHash });
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
    // Return the in-memory approved inspectors cache
    res.json({ 
      inspectors: approvedInspectors
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
    const governmentAddress = "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707"; // Default Hardhat account
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
    const result = await contracts.priceAdjustment.adjustPrice(
      listingId,
      sustainabilityFactor,
      freshnessFactor
    );
  const txHash = getTxHash(result);

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
      txHash,
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
  const txHash = getTxHash(result);
    res.json({
      message: "Batch reported as stolen",
      batchId,
      txHash
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
  const txHash = getTxHash(result);
    res.json({
      message: "Insurance paid for disputed batch",
      batchId,
      amount,
      txHash
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
      txHash: getTxHash(result)
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
      txHash: getTxHash(result)
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
    const result = await contracts.govt.deposit({ value: ethers.parseEther(value.toString()) });
    const txHash = getTxHash(result);
    res.json({ message: "Funds deposited successfully", txHash });
  } catch (error) {
    console.error("Error depositing funds:", error);
    res.status(500).json({ message: error.message || "Deposit failed" });
  }
});
router.post("/govt/withdraw", async (req, res) => {
  const { amount, to } = req.body;
  try {
    const result = await contracts.govt.withdraw(
      ethers.parseEther(amount.toString()),
      to
    );
    const txHash = getTxHash(result);
    res.json({ message: "Withdrawal successful", txHash });
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

// Rebuild approved inspectors cache at module load
(async () => {
  try {
    await rebuildApprovedInspectors();
  } catch (e) {
    console.warn('rebuildApprovedInspectors failed at startup:', e && e.message ? e.message : e);
  }
})();

// Developer debug: fetch transaction receipt and parse events where possible
router.get('/debug/tx/:txHash', async (req, res) => {
  const txHash = req.params.txHash;
  try {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://127.0.0.1:8545');
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) return res.status(404).json({ message: 'Receipt not found yet' });

    // Try to parse logs using known ABIs
    const parsed = [];
    const tryParseWithAbi = (address, abi) => {
      try {
        const iface = new ethers.Interface(abi);
        for (const log of receipt.logs.filter(l => l.address && l.address.toLowerCase() === (address||'').toLowerCase())) {
          try {
            const p = iface.parseLog(log);
            parsed.push({ address: log.address, name: p.name, args: p.args });
          } catch (e) { /* ignore */ }
        }
      } catch (e) { /* ignore */ }
    };

    // Attempt parse with marketplace ABI
    try {
      const marketAddr = process.env.MARKETPLACE_CONTRACT_ADDRESS || null;
      const marketABI = require('../artifacts/contracts/FishMarketplace.sol/FishMarketplace.json').abi;
      if (marketABI) tryParseWithAbi(marketAddr, marketABI);
    } catch (e) { /* ignore */ }

    res.json({ receipt, parsedLogs: parsed });
  } catch (error) {
    console.error('Error fetching tx receipt:', error);
    res.status(500).json({ message: error.message || 'Failed to fetch tx receipt' });
  }
});