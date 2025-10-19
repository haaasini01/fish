# Government Authentication Setup

## Environment Variables Required

Create a `.env` file in the `backend` directory with the following variables:

```env
# Blockchain Configuration
RPC_URL=http://127.0.0.1:8545

# IMPORTANT: Use the government address's private key
# This should be the private key for the address that will have government access
PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Contract Addresses
FISHERIES_MANAGEMENT_CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
FISH_MARKETPLACE_CONTRACT_ADDRESS=0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
FISH_TRANSFER_CONTRACT_ADDRESS=0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
INSPECTOR_AUTHORIZATION_CONTRACT_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
PRICING_ADJUSTMENT_CONTRACT_ADDRESS=0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9

# Government Contract Address (This is the address that will be authorized for government functions)
# MUST match the address derived from PRIVATE_KEY above
GOVT_CONTRACT_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
```

## How Government Authentication Works

1. **Backend Wallet**: The backend uses the `PRIVATE_KEY` to create a wallet that can call government-only functions
2. **Address Verification**: The wallet address derived from `PRIVATE_KEY` must match `GOVT_CONTRACT_ADDRESS`
3. **Frontend Authentication**: 
   - User clicks "GOVT" tab
   - System shows authentication form
   - User enters government address
   - Backend verifies address against `GOVT_CONTRACT_ADDRESS`
   - If authorized, user gains access to government dashboard
4. **Protected Functions**: Inspector authorization, insurance management, dispute resolution

## Testing

1. Start the backend server: `cd backend && npm start`
2. Check console output - it should show:
   ```
   ✅ Wallet address matches government contract address
   ```
3. Open the frontend in browser
4. Click "GOVT" tab
5. Enter the address from `GOVT_CONTRACT_ADDRESS` environment variable
6. Access government functions

## Security Notes

- The `PRIVATE_KEY` must correspond to the `GOVT_CONTRACT_ADDRESS`
- Only this specific address can access government-only functions
- All government functions are protected by this authentication mechanism
- The backend wallet must have sufficient ETH for transactions

## Troubleshooting

### "Only government can call this function" Error
- Ensure `PRIVATE_KEY` corresponds to `GOVT_CONTRACT_ADDRESS`
- Check that the wallet address matches the government address in console logs
- Verify the backend is using the correct private key

### "Address already has a pending request" Error
- This is now fixed - rejected requests are properly cleaned up
- Only pending requests are checked, not rejected ones
