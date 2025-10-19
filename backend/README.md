# FishChain Backend Server

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the server:**
   ```bash
   npm start
   ```
   
   Or for development mode:
   ```bash
   npm run dev
   ```

3. **Server will be available at:**
   ```
   http://localhost:8080/api
   ```

## API Endpoints

### Inspector Authorization
- `GET /api/inspector/check/:address` - Check authorization status
- `POST /api/inspector/request-authorization` - Submit registration request
- `POST /api/inspector/authorize` - Authorize inspector (government only)
- `POST /api/inspector/revoke` - Revoke inspector access
- `GET /api/inspector/government` - Get government address

### Fisheries Management
- `POST /api/fisheries/logcatch` - Log fish catch
- `POST /api/fisheries/updatesustainability` - Update sustainability status
- `GET /api/fisheries/batch/:batchId` - Get batch details

### Marketplace
- `POST /api/marketplace/list` - List fish for sale
- `GET /api/marketplace/listings` - Get all listings
- `POST /api/marketplace/buy/:listingId` - Buy fish

## Troubleshooting

If you get "Unexpected token '<'" error:
1. Make sure the server is running on port 8080
2. Check that all dependencies are installed: `npm install`
3. Verify the server started successfully by checking the console output

## Development

The server uses:
- Express.js for the web framework
- Ethers.js for blockchain interactions
- CORS enabled for frontend communication
- Body parser for JSON requests
