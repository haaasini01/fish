// Dedicated login action - redirects only if authorized
async function attemptInspectorLogin(btn) {
    const loginBtn = btn || (typeof event !== 'undefined' ? event.target : null);
    if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.textContent = 'Logging in...';
    }
    try {
        const response = await fetch(`http://localhost:8080/api/inspector/check/${currentUserAddress}`);
        let data = {};
        try { data = await response.json(); } catch (e) { data = {}; }
        if (data.isAuthorized) {
            showNotification('✅ Login successful. Redirecting to dashboard...', 'success');
            setTimeout(() => loadInspectorDashboard(), 1000);
        } else if (data.isPending) {
            showNotification('⏳ Your application is pending government approval.', 'info');
        } else if (data.isRejected) {
            showNotification('❌ Your application was rejected. You can register again.', 'error');
        } else {
            showNotification('❌ You are not authorized by Government. Please register first.', 'error');
        }
    } catch (e) {
        showNotification('⚠️ Cannot reach backend. Please ensure server is running.', 'error');
    } finally {
        if (loginBtn) {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Login';
        }
    }
}
totalBatches = 0;
let currentUserAddress = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Default Hardhat account
let isGovernment = true; // Set as government for testing
// Track which inspector section/tab is currently active to preserve UI across refreshes
let currentInspectorSection = null;

// Initialize user address and check government status
async function initializeUser() {
    try {
        // Use default Hardhat account for local testing
        console.log('Using default Hardhat account for local testing');
        await checkBackendConnectivity();
        await checkGovernmentStatus();
    } catch (error) {
        console.error('Error initializing user:', error);
    }
}

// Check if backend is running
async function checkBackendConnectivity() {
    try {
        const response = await fetch('http://localhost:8080/api/test');
        if (!response.ok) {
            throw new Error(`Backend server returned ${response.status}`);
        }
        const data = await response.json();
        console.log('✅ Backend server is running:', data);
        showNotification('✅ Backend server is running and accessible!', 'success');
    } catch (error) {
        console.error('❌ Backend server is not accessible:', error);
        showNotification('⚠️ Backend server is not running. Please start the server on port 8080.', 'error');
    }
}

// Check if current user is government
async function checkGovernmentStatus() {
    try {
        const response = await fetch('http://localhost:8080/api/inspector/government');
        const data = await response.json();
        isGovernment = (currentUserAddress && currentUserAddress.toLowerCase() === data.government.toLowerCase());
    } catch (error) {
        console.error('Error checking government status:', error);
        isGovernment = false;
    }
}

// Local testing mode - no MetaMask required
function connectWallet() {
    alert('Local Testing Mode: Using Hardhat account\nNo MetaMask connection required!');
}


async function loadForm(option) {
    const formContainer = document.getElementById("form-container");
    const heroText = document.querySelector(".hero-text");
    const heroSection = document.querySelector(".hero-section");

    // Clear the current content
    formContainer.innerHTML = "";
    
    // Show/hide hero text based on the option
    if (option === "Authorize" || option === "GOVT") {
        // Hide hero text for dashboard pages
        if (heroText) {
            heroText.style.display = "none";
        }
        if (heroSection) {
            heroSection.classList.add("dashboard-mode");
        }
    } else {
        // Show hero text for other pages
        if (heroText) {
            heroText.style.display = "block";
        }
        if (heroSection) {
            heroSection.classList.remove("dashboard-mode");
        }
    }

    // Inject different forms based on the navbar option clicked
    if (option === "Overview") {
        formContainer.innerHTML = `
            <h2>Overview Form</h2>
            <form id="overviewForm">
                <label for="overview-info">Information:</label><br>
                <textarea id="overview-info" name="overview-info" rows="4" cols="30"></textarea><br>
                <button type="submit">Submit</button>
            </form>
        `;
    } else if (option === "Market") {
        const batches = await fetchBatches();

        // If no batches are available
        if (batches.length === 0) {
            formContainer.innerHTML = `
                <div class="no-data">
                    <h3>🛒 Fish Market</h3>
                    <p>No fish batches available for purchase at the moment.</p>
                    <p>Check back later or log a new catch to see it in the market!</p>
                </div>
            `;
            return;
        }

        // Create a table to display batches
        let tableHTML = `
            <div class="market-section">
                <h2>🛒 Fish Market</h2>
                <p>Available fish batches for purchase</p>
                
                <div class="market-table-container">
                    <table class="market-table">
                        <thead>
                            <tr>
                                <th>Listing ID</th>
                                <th>Batch ID</th>
                                <th>Available Weight (kg)</th>
                                <th>Price Per Kg (ETH)</th>
                                <th>Total Price (ETH)</th>
                                <th>Fisherman</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
        `;

        batches.forEach((batch) => {
            const totalPrice = (parseFloat(batch.availableWeight) * parseFloat(batch.pricePerKg)).toFixed(4);
            tableHTML += `
                <tr>
                    <td>${batch.listingId}</td>
                    <td>${batch.batchId || 'N/A'}</td>
                    <td>${batch.availableWeight}</td>
                    <td>${batch.pricePerKg}</td>
                    <td>${totalPrice}</td>
                    <td class="address">${batch.fisher}</td>
                    <td>
                        <button onclick="buyFish(${batch.listingId}, ${batch.availableWeight}, ${batch.pricePerKg})" class="btn-buy">
                            🛒 Buy
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        formContainer.innerHTML = tableHTML;

    } else if (option === "Sell") {
        formContainer.innerHTML = `
            <form id="logCatchForm">
                <label for="weight">Weight</label><br>
                <input type="text" id="weight" name="weight"><br>
                <label for="pricePerKg">Price [Per Kg]</label><br>
                <input type="text" id="pricePerKg" name="pricePerKg"><br>
                <h1 id="logCatchMessage"></h1>
                <button type="submit">Sell</button>
            </form>
        `;
    } else if (option === "Authorize") {
        // Show clean authorization interface
        formContainer.innerHTML = `
            <div class="authorization-section">
                <div class="auth-header">
                    <h2>Inspector Portal</h2>
                    <p>Login or Register as Inspector</p>
                    <button onclick="checkBackendConnectivity()" class="auth-btn" style="margin-top: 10px; background: rgba(255, 255, 255, 0.1); font-size: 0.9rem; padding: 8px 16px;">
                        🔧 Test Backend Connection
                    </button>
                </div>
                
                <div class="auth-tabs">
                    <button onclick="attemptInspectorLoginFromTab()" class="auth-tab active" id="login-tab">Login</button>
                    <button onclick="showAuthTab('register')" class="auth-tab" id="register-tab">Register</button>
                </div>
                
                <div id="auth-content">
                    <div id="login-form" class="auth-form active">
                        <div class="form-group">
                            <label>Wallet Address</label>
                            <input type="text" value="${currentUserAddress}" readonly class="readonly-input">
                        </div>
                        <div class="form-group">
                            <button onclick="checkLoginStatus()" class="auth-btn" style="margin-bottom: 15px;">
                                Check Authorization Status
                            </button>
                        </div>
                        <!-- Status messages appear below when Login tab is clicked -->
                        <div id="login-status"></div>
                    </div>
                    
                    <div id="register-form" class="auth-form">
                        <form id="registerForm">
                            <div class="form-group">
                                <label for="regAddress">Wallet Address</label>
                                <input type="text" id="regAddress" name="address" value="${currentUserAddress}" readonly class="readonly-input">
                                <small style="color: rgba(255, 255, 255, 0.7); font-size: 0.9rem; margin-top: 5px; display: block;">
                                    This is your connected wallet address. Only the address is required for registration.
                                </small>
                            </div>
                            <button type="submit" class="auth-btn">Submit Application</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        // Attach form event listener
        const registerForm = document.getElementById("registerForm");
        if (registerForm) {
            registerForm.addEventListener("submit", handleRegisterSubmit);
        }
    } else if (option === "GOVT") {
        console.log('GOVT tab clicked, isGovernment:', isGovernment, 'currentUserAddress:', currentUserAddress);
        
        // Show government authentication form first
        await loadGovernmentAuthForm();
    }

    // Dynamically attach submit event listener to the newly injected form
    const form = formContainer.querySelector("form");
    if (form) {
        form.addEventListener("submit", handleFormSubmit);
    }
}




async function fetchBatches() {
    try {
        const resp = await fetch('http://localhost:8080/api/marketplace/listings');
        if (!resp.ok) return [];
        const data = await resp.json();
        const listings = Array.isArray(data.listings) ? data.listings : [];
        return listings.filter(l => !l.isSoldOut).map(l => ({
            listingId: l.listingId,
            batchId: l.batchId,
            availableWeight: l.availableWeight,
            fisher: l.fisher,
            pricePerKg: l.pricePerKg,
        }));
    } catch (e) {
        console.error('Error fetching listings:', e);
        return [];
    }
}















function handleFormSubmit(event) {
    event.preventDefault(); // Prevent default form submission (page reload)
    
    // You can add logic here based on the form's ID
    const formId = event.target.id;

    if (formId === "logCatchForm") {
        // Handle Log Catch form submission
        const weight = parseFloat(document.getElementById("weight").value);
        const pricePerKg = parseFloat(document.getElementById("pricePerKg").value);

        if (isNaN(weight) || isNaN(pricePerKg)) {
            alert("Please enter valid numbers for weight and price per kg.");
            return;
        }

        makeApiRequest("http://localhost:8080/api/fisheries/logcatch", "POST", {
            weight,
            pricePerKg,
        }).then((result) => {
            totalBatches += 1;
            document.getElementById("logCatchMessage").textContent = result.message;
            const txDetails = `
                \n<a href="https://etherscan.io/tx/${result.txHash}" target="_blank">${result.txHash}</a><br>
            `;
            document.getElementById("logCatchMessage").innerHTML += txDetails;
            
            // Show success notification and stay on page (no auto-redirect)
            showNotification('✅ Fish catch logged successfully! Batch sent for inspector approval.', 'success');
        }).catch((error) => {
            console.error('Error logging catch:', error);
            showNotification('❌ Failed to log fish catch. Please try again.', 'error');
        });
    } else if (formId === "authorizeForm") {
        // Handle Authorization request form submission
        const name = document.getElementById("name").value;
        const role = document.getElementById("role").value;
        const submitBtn = document.querySelector('button[type="submit"]');

        if (!name || !role) {
            alert("Please fill in all required fields.");
            return;
        }

        // Show loading state
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Submitting...';
        submitBtn.disabled = true;

        makeApiRequest("http://localhost:8080/api/inspector/request-authorization", "POST", {
            name,
            role,
        }).then((result) => {
            alert(`Authorization request submitted successfully! Transaction: ${result.txHash}`);
            // Reload the authorize form to show pending status
            loadForm('Authorize');
        }).catch((error) => {
            console.error('Error submitting authorization request:', error);
            alert('Error submitting authorization request: ' + error.message);
            
            // Reset button state
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        });
    } else {
        // Example: Handle other forms
        alert(`Form submitted: ${formId}`);
    }
}












// Load government authentication form
async function loadGovernmentAuthForm() {
    const formContainer = document.getElementById("form-container");
    
    formContainer.innerHTML = `
        <div class="government-auth-section">
            <div class="auth-header">
                <h2>🏛️ Government Authentication</h2>
                <p>Enter your government address to access administrative functions</p>
            </div>
            
            <div class="auth-form-container">
                <div class="auth-form-card">
                    <div class="form-header">
                        <div class="form-icon">🔐</div>
                        <h3>Government Access</h3>
                        <p>Verify your government credentials</p>
                    </div>
                    
                    <form id="govtAuthForm" class="govt-auth-form">
                        <div class="form-group">
                            <label for="govtAddress">
                                <div class="label-icon">🏛️</div>
                                Government Address
                            </label>
                            <input type="text" id="govtAddress" name="address" placeholder="Enter government contract address" required>
                            <small>Enter the authorized government contract address</small>
                        </div>
                        
                        <button type="submit" class="auth-btn">
                            <span>Authenticate</span>
                        </button>
                    </form>
                    
                    <div class="auth-info">
                        <div class="info-item">
                            <div class="info-icon">ℹ️</div>
                            <div class="info-content">
                                <h4>Access Required</h4>
                                <p>Only authorized government addresses can access inspector management, insurance, and dispute resolution functions.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Attach form event listener
    const authForm = document.getElementById('govtAuthForm');
    if (authForm) {
        authForm.addEventListener('submit', handleGovtAuthSubmit);
    }
}

// Handle government authentication form submission
async function handleGovtAuthSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const address = formData.get('address');
    
    if (!address) {
        showNotification('❌ Please enter a government address', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="btn-icon">⏳</div><span>Verifying...</span>';
    submitBtn.disabled = true;
    
    try {
        // Call backend to verify government address
        const response = await fetch('http://localhost:8080/api/govt/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ address })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const result = await response.json();
        
        if (result.isAuthorized) {
            // Store authenticated address
            window.authenticatedGovtAddress = address;
            
            showNotification('✅ Government access granted! Loading dashboard...', 'success');
            
            // Show success message and redirect to dashboard
            setTimeout(async () => {
                await loadGovernmentDashboard();
            }, 1500);
            
        } else {
            showNotification('❌ Access denied - not authorized government address', 'error');
            
            // Show error message
            const authContainer = document.querySelector('.auth-form-container');
            authContainer.innerHTML = `
                <div class="auth-form-card error-card">
                    <div class="form-header">
                        <div class="form-icon">❌</div>
                        <h3>Access Denied</h3>
                        <p>Government authentication failed</p>
                    </div>
                    
                    <div class="error-info">
                        <div class="info-item">
                            <div class="info-icon">🔗</div>
                            <div class="info-content">
                                <h4>Provided Address</h4>
                                <p>${address}</p>
                            </div>
                        </div>
                        <div class="info-item">
                            <div class="info-icon">🏛️</div>
                            <div class="info-content">
                                <h4>Required Address</h4>
                                <p>${result.govtContractAddress}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-actions">
                        <button onclick="loadGovernmentAuthForm()" class="auth-btn">
                            <div class="btn-icon">🔄</div>
                            <span>Try Again</span>
                        </button>
                    </div>
                </div>
            `;
        }
        
    } catch (error) {
        console.error('Government authentication error:', error);
        showNotification('❌ Error verifying government address: ' + error.message, 'error');
        
        // Reset button state
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}

// Load government dashboard
async function loadGovernmentDashboard() {
    // Check if user is authenticated as government
    if (!window.authenticatedGovtAddress) {
        showNotification('❌ Please authenticate as government first', 'error');
        await loadGovernmentAuthForm();
        return;
    }
    const formContainer = document.getElementById("form-container");
    
    try {
        // Show loading state
        formContainer.innerHTML = `
            <div class="loading-dashboard">
                <h2>🏛️ Loading Government Dashboard...</h2>
                <p>Please wait while we fetch the latest data.</p>
            </div>
        `;
        
        // Fetch pending requests and authorized inspectors
        const [pendingResponse, authorizedResponse] = await Promise.all([
            fetch('http://localhost:8080/api/inspector/pending-requests'),
            fetch('http://localhost:8080/api/inspector/authorized-inspectors')
        ]);
        
        let pendingData = { requests: [], count: 0 };
        let authorizedData = { inspectors: [] };
        
        try {
            pendingData = await pendingResponse.json();
        } catch (e) {
            console.log('No pending requests endpoint available');
        }
        
        try {
            authorizedData = await authorizedResponse.json();
        } catch (e) {
            console.log('No authorized inspectors endpoint yet');
        }
        
        let dashboardHTML = `
            <div class="government-dashboard">
                <div class="dashboard-header">
                    <h2>🏛️ Government Dashboard</h2>
                    <p>Manage inspector authorizations and system oversight</p>
                    <div class="auth-status">
                        <span class="auth-label">Authenticated as:</span>
                        <span class="auth-address">${window.authenticatedGovtAddress}</span>
                        <button onclick="logoutGovernment()" class="logout-btn">🚪 Logout</button>
                    </div>
                </div>
                
                <!-- Navigation Tabs -->
                <div class="dashboard-nav">
                    <button onclick="showDashboardSection('pending')" class="nav-tab active" id="pending-tab">📋 Pending Requests (${pendingData.count || 0})</button>
                    <button onclick="showDashboardSection('authorized')" class="nav-tab" id="authorized-tab">👥 Authorized Inspectors (${authorizedData.inspectors ? authorizedData.inspectors.length : 0})</button>
                    <button onclick="showDashboardSection('disputes')" class="nav-tab" id="disputes-tab">⚠️ In-Dispute Batches</button>
                    <button onclick="showDashboardSection('insurance')" class="nav-tab" id="insurance-tab">🛡️ Insurance</button>
                    <button onclick="showDashboardSection('unsold')" class="nav-tab" id="unsold-tab">📦 Unsold Batches</button>
                </div>
                
                <!-- Pending Requests Section -->
                <div class="dashboard-section" id="pending-section">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>📋 Pending Authorization Requests</h3>
                            <span class="badge">${pendingData.count || 0}</span>
                        </div>
                        <div class="card-content">
        `;
        
        if (pendingData.requests && pendingData.requests.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>📋 No pending requests</p>
                    <p>All inspector applications have been processed</p>
                </div>
            `;
        } else if (pendingData.requests && pendingData.requests.length > 0) {
            pendingData.requests.forEach((request, index) => {
                const requestDate = request.timestamp ? 
                    new Date(parseInt(request.timestamp) * 1000).toLocaleString() : 
                    'Unknown';
                
                dashboardHTML += `
                    <div class="request-item">
                        <div class="request-info">
                            <div class="info-row">
                                <span class="label">🆔 Request ID:</span>
                                <span class="value">${request.id || 'N/A'}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">🔗 Address:</span>
                                <span class="value address">${request.address}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">📅 Requested:</span>
                                <span class="value">${requestDate}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">📊 Status:</span>
                                <span class="value">Pending Review</span>
                            </div>
                        </div>
                        <div class="request-actions">
                            <button onclick="authorizeInspector('${request.address}', 'Request #${request.id}')" class="btn-authorize">
                                ✅ Authorize
                            </button>
                            <button onclick="rejectAuthorization('${request.address}', 'Request #${request.id}')" class="btn-reject">
                                ❌ Reject
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            dashboardHTML += `
                <div class="no-data">
                    <p>📋 No pending requests found</p>
                    <p>Inspector applications will appear here when submitted</p>
                </div>
            `;
        }
        
        dashboardHTML += `
                        </div>
                    </div>
                </div>
                
                <!-- Authorized Inspectors Section -->
                <div class="dashboard-section" id="authorized-section" style="display: none;">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>👥 Authorized Inspectors</h3>
                            <span class="badge">${authorizedData.inspectors ? authorizedData.inspectors.length : 0}</span>
                        </div>
                        <div class="card-content">
        `;
        
        if (authorizedData.inspectors && authorizedData.inspectors.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>👥 No authorized inspectors</p>
                    <p>Authorized inspectors will appear here once approved</p>
                </div>
            `;
        } else if (authorizedData.inspectors && authorizedData.inspectors.length > 0) {
            authorizedData.inspectors.forEach((inspector, index) => {
                const authDate = inspector.timestamp ? 
                    new Date(parseInt(inspector.timestamp) * 1000).toLocaleString() : 
                    'Unknown';
                
                dashboardHTML += `
                    <div class="inspector-item">
                        <div class="inspector-info">
                            <div class="info-row">
                                <span class="label">👤 Name:</span>
                                <span class="value">${inspector.name || 'N/A'}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">🎯 Role:</span>
                                <span class="value">${inspector.role || 'Inspector'}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">🔗 Address:</span>
                                <span class="value address">${inspector.address}</span>
                            </div>
                            <div class="info-row">
                                <span class="label">📅 Authorized:</span>
                                <span class="value">${authDate}</span>
                            </div>
                        </div>
                        <div class="inspector-actions">
                            <button onclick="revokeInspector('${inspector.address}', '${inspector.name || 'N/A'}')" class="btn-revoke">
                                🚫 Revoke Access
                            </button>
                        </div>
                    </div>
                `;
            });
        } else {
            dashboardHTML += `
                <div class="no-data">
                    <p>👥 No authorized inspectors found</p>
                    <p>Inspectors will appear here once they are approved</p>
                </div>
            `;
        }
        
        // Fetch disputed batches
        const batches = await fetchFishBatches();
        const disputedBatches = batches.filter(batch => batch.status === 'disputed');
        
        // Append management sections below authorized inspectors
        dashboardHTML += `
                        </div>
                    </div>
                </div>
                
                <!-- In-Dispute Batches Section -->
                <div class="dashboard-section" id="disputes-section" style="display: none;">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>⚠️ In-Dispute Batches</h3>
                            <span class="badge">${disputedBatches.length}</span>
                        </div>
                        <div class="card-content">
        `;
        
        if (disputedBatches.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>No disputed batches found</p>
                    <p>Batches marked as unsustainable will appear here</p>
                </div>
            `;
        } else {
            dashboardHTML += `
                <div class="disputes-table-container">
                    <table class="disputes-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Fisherman</th>
                                <th>Weight (kg)</th>
                                <th>Price/Kg</th>
                                <th>Reason</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            disputedBatches.forEach((batch, index) => {
                dashboardHTML += `
                    <tr>
                        <td>${batch.id}</td>
                        <td class="address">${batch.fisherman}</td>
                        <td>${batch.weight}</td>
                        <td>${batch.pricePerKg}</td>
                        <td>Marked as Unsustainable</td>
                        <td>
                            <button onclick="resolveDispute(${batch.id})" class="btn-resolve">Resolve</button>
                        </td>
                    </tr>
                `;
            });
            
            dashboardHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        dashboardHTML += `
                        </div>
                    </div>
                </div>
                
                <!-- Insurance Section -->
                <div class="dashboard-section" id="insurance-section" style="display: none;">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>🛡️ Insurance</h3>
                        </div>
                        <div class="card-content">
                            <div class="no-data">
                                <p>Insurance management coming soon</p>
                                <p>This section will handle insurance claims and policies</p>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Unsold Batches Section -->
                <div class="dashboard-section" id="unsold-section" style="display: none;">
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>📦 Unsold Batches</h3>
                        </div>
                        <div class="card-content">
                            <div class="no-data">
                                <p>Unsold batches tracking coming soon</p>
                                <p>This section will show batches that haven't been sold</p>
                            </div>
                        </div>
                    </div>
                </div>
                
            </div>
        `;
        
        formContainer.innerHTML = dashboardHTML;

        // Restore previously active inspector tab (so refresh doesn't force Pending)
        if (currentInspectorSection) {
            try { showInspectorSection(currentInspectorSection); } catch (e) { /* ignore */ }
        }
        
    } catch (error) {
        console.error('Error loading government dashboard:', error);
        formContainer.innerHTML = `
            <div class="error-message">
                <h2>❌ Error</h2>
                <p>Failed to load government dashboard. Please try again.</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// Authorize inspector
async function authorizeInspector(address, name = 'Unknown') {
    if (!confirm(`Are you sure you want to authorize inspector ${name} at address ${address}?`)) {
        return;
    }
    
    try {
        // Show loading state
        const authorizeBtn = event.target;
        const originalText = authorizeBtn.textContent;
        authorizeBtn.textContent = 'Processing...';
        authorizeBtn.disabled = true;
        
        const response = await makeApiRequest('http://localhost:8080/api/inspector/authorize', 'POST', { address });
        
        // Show success notification
        showNotification(`✅ Inspector ${name} Authorized Successfully!`, 'success');
        console.log('Transaction:', response.txHash);
        
        await loadGovernmentDashboard(); // Refresh dashboard
    } catch (error) {
        console.error('Error authorizing inspector:', error);
        showNotification(`❌ Error authorizing inspector ${name}: ` + error.message, 'error');
        
        // Reset button state
        const authorizeBtn = event.target;
        authorizeBtn.textContent = '✅ Authorize';
        authorizeBtn.disabled = false;
    }
}

// Reject authorization
async function rejectAuthorization(address, name = 'Unknown') {
    if (!confirm(`Are you sure you want to reject the authorization request from ${name} at address ${address}?`)) {
        return;
    }
    
    try {
        // Show loading state
        const rejectBtn = event.target;
        const originalText = rejectBtn.textContent;
        rejectBtn.textContent = 'Processing...';
        rejectBtn.disabled = true;
        
        const response = await makeApiRequest('http://localhost:8080/api/inspector/reject', 'POST', { address });
        
        showNotification(`❌ Authorization Request from ${name} Rejected`, 'success');
        
        // Refresh the government dashboard to show updated data
        await loadGovernmentDashboard();
        
    } catch (error) {
        console.error('Error rejecting authorization:', error);
        showNotification(`❌ Error rejecting authorization from ${name}: ` + error.message, 'error');
        
        // Reset button state
        const rejectBtn = event.target;
        rejectBtn.textContent = '❌ Reject';
        rejectBtn.disabled = false;
    }
}

// Inspector Dashboard Action Functions
function toggleSustainability(batchId) {
    if (confirm(`Are you sure you want to toggle sustainability status for batch ${batchId}?`)) {
        showNotification('🔄 Sustainability status updated!', 'success');
        // Here you would call the API to update sustainability
        console.log('Toggling sustainability for batch:', batchId);
    }
}

function addTransferId(batchId) {
    const transferId = prompt('Enter Transfer ID:');
    if (transferId) {
        showNotification(`📦 Transfer ID ${transferId} added to batch ${batchId}`, 'success');
        // Here you would call the API to add transfer ID
        console.log('Adding transfer ID:', transferId, 'to batch:', batchId);
    }
}

function adjustPrice(batchId) {
    const newPrice = prompt('Enter new price per kg:');
    if (newPrice && !isNaN(newPrice)) {
        showNotification(`💰 Price updated to ${newPrice} for batch ${batchId}`, 'success');
        // Here you would call the API to adjust price
        console.log('Adjusting price for batch:', batchId, 'to:', newPrice);
    }
}

function refreshBatches() {
    showNotification('🔄 Refreshing batches...', 'info');
    loadInspectorDashboard();
}

function exportData() {
    showNotification('📊 Data exported successfully!', 'success');
    console.log('Exporting data...');
}

function viewReports() {
    showNotification('📈 Opening reports...', 'info');
    console.log('Opening reports...');
}

// Add Inspector Form Handler
function handleAddInspectorSubmit(event) {
    event.preventDefault();
    const address = document.getElementById('newInspectorAddress').value;
    
    if (!address) {
        showNotification('❌ Please enter a wallet address', 'error');
        return;
    }
    
    if (confirm(`Are you sure you want to authorize inspector at address ${address}?`)) {
        // Call the authorize API
        makeApiRequest('http://localhost:8080/api/inspector/authorize', 'POST', { address })
            .then(response => {
                showNotification('✅ Inspector Authorized Successfully!', 'success');
                document.getElementById('newInspectorAddress').value = '';
                loadGovernmentDashboard(); // Refresh dashboard
            })
            .catch(error => {
                showNotification('❌ Error authorizing inspector: ' + error.message, 'error');
            });
    }
}

// Reject authorization
async function rejectAuthorization(address) {
    if (!confirm(`Are you sure you want to reject the authorization request from ${address}?`)) {
        return;
    }
    
    try {
        // Show loading state
        const rejectBtn = event.target;
        const originalText = rejectBtn.textContent;
        rejectBtn.textContent = 'Processing...';
        rejectBtn.disabled = true;
        
        const response = await makeApiRequest('http://localhost:8080/api/inspector/reject', 'POST', { address });
        
        showNotification('❌ Authorization Request Rejected', 'success');
        
        // Refresh the government dashboard to show updated data
        await loadGovernmentDashboard();
        
    } catch (error) {
        console.error('Error rejecting authorization:', error);
        showNotification('❌ Error rejecting authorization: ' + error.message, 'error');
        
        // Reset button state
        const rejectBtn = event.target;
        rejectBtn.textContent = '❌ Reject';
        rejectBtn.disabled = false;
    }
}

// Revoke Inspector Function
async function revokeInspector(address, name = 'Unknown') {
    if (!confirm(`Are you sure you want to revoke access for inspector ${name} at address ${address}?`)) {
        return;
    }
    
    try {
        // Show loading state
        const revokeBtn = event.target;
        const originalText = revokeBtn.textContent;
        revokeBtn.textContent = 'Processing...';
        revokeBtn.disabled = true;
        
        const response = await makeApiRequest('http://localhost:8080/api/inspector/revoke', 'POST', { address });
        
        showNotification(`🚫 Inspector ${name} Access Revoked Successfully!`, 'success');
        
        // Refresh the government dashboard to show updated data
        await loadGovernmentDashboard();
        
    } catch (error) {
        console.error('Error revoking inspector:', error);
        showNotification(`❌ Error revoking inspector ${name}: ` + error.message, 'error');
        
        // Reset button state
        const revokeBtn = event.target;
        revokeBtn.textContent = '🚫 Revoke Access';
        revokeBtn.disabled = false;
    }
}

// Notification System
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => notification.remove());
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// Placeholder functions for future implementation
function loadDisputedBatches() {
    showNotification('📊 Disputed batches feature coming soon!', 'info');
}

function loadInsuranceClaims() {
    showNotification('🛡️ Insurance claims feature coming soon!', 'info');
}

function loadUnsoldStock() {
    showNotification('📦 Unsold stock feature coming soon!', 'info');
}

async function makeApiRequest(url, method, data) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    
    // Check if response is ok
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    
    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON response but got: ${responseText.substring(0, 100)}...`);
    }
    
    return response.json();
}

// Tab switching function
function showAuthTab(tab) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });
    
    // Remove active class from all tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected form
    document.getElementById(tab + '-form').classList.add('active');
    
    // Add active class to clicked tab
    document.getElementById(tab + '-tab').classList.add('active');
}

// When the top Login tab is pressed, check auth and navigate appropriately
async function attemptInspectorLoginFromTab() {
    // Ensure login tab is visually active
    showAuthTab('login');
    const statusDiv = document.getElementById('login-status');
    if (statusDiv) statusDiv.innerHTML = '';
    // Reuse logic from attemptInspectorLogin
    await attemptInspectorLogin();
}

// Check login status
async function checkLoginStatus(btn) {
    const statusDiv = document.getElementById('login-status');
    const checkBtn = btn || (typeof event !== 'undefined' ? event.target : null);
    if (!statusDiv) return;
    
    if (checkBtn) {
        checkBtn.disabled = true;
        checkBtn.textContent = 'Checking...';
    }
    
    try {
        const response = await fetch(`http://localhost:8080/api/inspector/check/${currentUserAddress}`);
        let data = {};
        try {
            data = await response.json();
        } catch (e) {
            data = {};
        }
        
        if (data.isAuthorized) {
            statusDiv.innerHTML = `
                <div class="status-authorized">
                    ✅ You are authorized as an inspector!<br>
                    <div class="info-row" style="justify-content:center;margin-top:8px;">
                        <span class="label">🔗 Address:</span>
                        <span class="value address">${currentUserAddress}</span>
                    </div>
                    <div style="text-align:center; margin-top:15px;">
                        <button onclick="attemptInspectorLogin()" class="auth-btn" style="background: linear-gradient(135deg, #4CAF50, #45a049); font-weight: bold;">
                            🚀 Login to Dashboard
                        </button>
                    </div>
                </div>
            `;
        } else if (data.isPending) {
            statusDiv.innerHTML = `
                <div class="status-pending">
                    ⏳ Your application is pending government approval.<br>
                    Request ID: ${data.requestId || 'N/A'}<br>
                    Please wait for review.
                </div>
            `;
        } else if (data.isRejected) {
            statusDiv.innerHTML = `
                <div class="status-not-authorized">
                    ❌ Your application was rejected by the government.<br>
                    Request ID: ${data.requestId || 'N/A'}<br>
                    You can register again with a new application.
                    <div class="info-row" style="justify-content:center;margin-top:8px;">
                        <span class="label">🔗 Address:</span>
                        <span class="value address">${currentUserAddress}</span>
                    </div>
                </div>
            `;
        } else {
            statusDiv.innerHTML = `
                <div class="status-not-authorized">
                    ❌ You are not authorized by Government.<br>
                    Please register to apply for authorization.
                    <div class="info-row" style="justify-content:center;margin-top:8px;">
                        <span class="label">🔗 Address:</span>
                        <span class="value address">${currentUserAddress}</span>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        statusDiv.innerHTML = `
            <div class="status-not-authorized">
                ⚠️ Cannot connect to backend server.<br>
                Make sure the server is running on port 8080.
            </div>
        `;
    }
    
    if (checkBtn) {
        checkBtn.disabled = false;
        checkBtn.textContent = 'Check Status';
    }
}

// Handle register form submission
function handleRegisterSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const address = formData.get('address');
    
    if (!address) {
        showNotification('❌ Address is required', 'error');
        return;
    }
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    
    // Submit application
    const requestData = {
        address
    };
    
    console.log('📤 Sending registration request:', requestData);
    
    makeApiRequest('http://localhost:8080/api/inspector/request-authorization', 'POST', requestData)
    .then(response => {
        showNotification('✅ Application submitted successfully! Your request is now pending government approval.', 'success');
        
        // Show success message
        const statusDiv = document.getElementById('login-status');
        if (statusDiv) {
            statusDiv.innerHTML = `
                <div class="status-pending">
                    ✅ Application submitted successfully!<br>
                    Address: ${address}<br>
                    Your request is now pending government approval.<br>
                    <button onclick="showAuthTab('login'); checkLoginStatus();" class="auth-btn" style="margin-top: 10px; width: auto; padding: 8px 16px;">
                        Check Status
                    </button>
                </div>
            `;
        }
        
        // Switch to login tab
        showAuthTab('login');
        
        // Clear form
        event.target.reset();
        const regAddressField = document.getElementById('regAddress');
        if (regAddressField) {
            regAddressField.value = currentUserAddress;
        }
        
    })
    .catch(error => {
        console.error('Registration error:', error);
        if (error.message.includes('Expected JSON response but got')) {
            showNotification('❌ Backend server is not running. Please start the server first.', 'error');
        } else {
            showNotification('❌ Error submitting application: ' + error.message, 'error');
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Application';
    });
}

// Show login form
async function showLoginForm() {
    const authFormContainer = document.getElementById("auth-form-container");
    
    // Clear any existing forms
    authFormContainer.innerHTML = '';
    
    try {
        // Check current authorization status
        const statusResponse = await fetch(`http://localhost:8080/api/inspector/check/${currentUserAddress}`);
        const statusData = await statusResponse.json();

        let loginFormHTML = `
            <div class="auth-form-card login-card active">
                <div class="form-header">
                    <div class="form-icon">🔑</div>
                    <h3>Inspector Login</h3>
                    <p>Access your inspector dashboard</p>
                </div>
        `;

        if (statusData.isAuthorized) {
            loginFormHTML += `
                <div class="auth-status-info">
                    <div class="status-item">
                        <div class="status-icon">✅</div>
                        <div class="status-content">
                            <h4>Login Successful</h4>
                            <p>Welcome! You are authorized as an inspector.</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">🔗</div>
                        <div class="status-content">
                            <h4>Address</h4>
                            <p>${currentUserAddress}</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">👤</div>
                        <div class="status-content">
                            <h4>Status</h4>
                            <p>Authorized Inspector</p>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button onclick="loadInspectorDashboard()" class="dashboard-btn">
                        <div class="btn-icon">📊</div>
                        <span>Go to Inspector Dashboard</span>
                    </button>
                </div>
            `;
        } else if (statusData.isPending) {
            loginFormHTML += `
                <div class="auth-status-info">
                    <div class="status-item">
                        <div class="status-icon">⏳</div>
                        <div class="status-content">
                            <h4>Authorization Pending</h4>
                            <p>Your authorization request is pending government approval.</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">🔗</div>
                        <div class="status-content">
                            <h4>Address</h4>
                            <p>${currentUserAddress}</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">📋</div>
                        <div class="status-content">
                            <h4>Status</h4>
                            <p>Pending Approval</p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            loginFormHTML += `
                <div class="auth-status-info">
                    <div class="status-item">
                        <div class="status-icon">❌</div>
                        <div class="status-content">
                            <h4>Not Authorized</h4>
                            <p>You are not yet authorized as an inspector.</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">🔗</div>
                        <div class="status-content">
                            <h4>Address</h4>
                            <p>${currentUserAddress}</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">📋</div>
                        <div class="status-content">
                            <h4>Status</h4>
                            <p>Not Authorized</p>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button onclick="showSignupForm()" class="signup-btn">
                        <div class="btn-icon">📝</div>
                        <span>Apply for Authorization</span>
                    </button>
                </div>
            `;
        }

        loginFormHTML += `
                <a href="#" onclick="showSignupForm(); return false;" class="toggle-link">
                    Don't have an account? Register here
                </a>
            </div>
        `;

        authFormContainer.innerHTML = loginFormHTML;
        
    } catch (error) {
        console.error('Error checking authorization status:', error);
        authFormContainer.innerHTML = `
            <div class="auth-form-card login-card active">
                <div class="form-header">
                    <div class="form-icon">⚠️</div>
                    <h3>Backend Not Available</h3>
                    <p>Cannot connect to backend server</p>
                </div>
                <div class="auth-status-info">
                    <div class="status-item">
                        <div class="status-icon">🔗</div>
                        <div class="status-content">
                            <h4>Address</h4>
                            <p>${currentUserAddress}</p>
                        </div>
                    </div>
                    <div class="status-item">
                        <div class="status-icon">📋</div>
                        <div class="status-content">
                            <h4>Status</h4>
                            <p>Local Testing Mode</p>
                        </div>
                    </div>
                </div>
                <a href="#" onclick="showSignupForm(); return false;" class="toggle-link">
                    Don't have an account? Register here
                </a>
            </div>
        `;
    }
}

// Show signup form
function showSignupForm() {
    const authFormContainer = document.getElementById("auth-form-container");
    
    // Clear any existing forms
    authFormContainer.innerHTML = '';
    
    authFormContainer.innerHTML = `
        <div class="auth-form-card signup-card active">
            <div class="form-header">
                <div class="form-icon">📝</div>
                <h3>Register as Inspector</h3>
                <p>Submit your application for inspector authorization</p>
            </div>
            
            <form id="signupForm" class="signup-form">
                <div class="form-group">
                    <label for="applicantName">
                        <div class="label-icon">👤</div>
                        Full Name
                    </label>
                    <input type="text" id="applicantName" name="name" placeholder="Enter your full name" required>
                </div>
                
                <div class="form-group">
                    <label for="applicantRole">
                        <div class="label-icon">🎯</div>
                        Role
                    </label>
                    <select id="applicantRole" name="role" required>
                        <option value="">Select your role</option>
                        <option value="Inspector">Inspector</option>
                        <option value="Senior Inspector">Senior Inspector</option>
                        <option value="Quality Control">Quality Control</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="applicantAddress">
                        <div class="label-icon">🔗</div>
                        Wallet Address
                    </label>
                    <input type="text" id="applicantAddress" name="address" value="${currentUserAddress}" readonly>
                    <small>This is your connected wallet address</small>
                </div>
                
                <button type="submit" class="signup-btn">
                    <div class="btn-icon">📤</div>
                    <span>Submit Application</span>
                </button>
            </form>
            
            <a href="#" onclick="showLoginForm(); return false;" class="toggle-link">
                Already have an account? Login here
            </a>
        </div>
    `;
    
    // Attach form event listener
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignupSubmit);
    }
}

// Load inspector dashboard
async function loadInspectorDashboard() {
    const formContainer = document.getElementById("form-container");
    
    try {
        // Show loading state
        formContainer.innerHTML = `
            <div class="loading-dashboard">
                <h2>🔍 Loading Inspector Dashboard...</h2>
                <p>Please wait while we fetch the latest data.</p>
            </div>
        `;
        
    // Preserve currently active inspector section (so polling/refresh doesn't force Pending)
    const currentInspectorTab = document.querySelector('.inspector-tab.active');
    const activeInspectorSection = currentInspectorTab ? currentInspectorTab.id.replace('-tab','') : null;
    // Save to global so other pages (like GOVT) can attempt to restore it safely
    if (activeInspectorSection) currentInspectorSection = activeInspectorSection;

    // Fetch fish batches (this would be a real API call in production)
    const batches = await fetchFishBatches();
        
        let dashboardHTML = `
            <div class="inspector-dashboard">
                <div class="dashboard-header">
                    <h2>🔍 Inspector Dashboard</h2>
                    <p>Manage fish batches, sustainability, and pricing</p>
                </div>
                
                <!-- Inspector Dashboard Navigation -->
                <div class="inspector-nav">
                    <button onclick="showInspectorSection('pending')" class="inspector-tab" id="pending-tab">⏳ Pending Approval</button>
                    <button onclick="showInspectorSection('remaining')" class="inspector-tab" id="remaining-tab">🟦 Remaining Batches</button>
                    <button onclick="showInspectorSection('sold')" class="inspector-tab" id="sold-tab">🟩 Sold Batches</button>
                </div>
                
                <div class="dashboard-content">
                    <!-- Pending Approval Section -->
                    <div class="inspector-section" id="pending-section">
                    <div class="dashboard-card">
                        <div class="card-header">
                                <h3>⏳ Pending Approval Batches</h3>
                                <span class="badge">${batches.filter(b => b.status === 'pending').length}</span>
                        </div>
                        <div class="card-content">
        `;
        
        const pendingBatches = batches.filter(batch => batch.status === 'pending');
        if (pendingBatches.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>No pending batches for approval</p>
                    <p>New fish catches will appear here for inspector review</p>
                </div>
            `;
        } else {
            dashboardHTML += `
                <div class="batches-table-container">
                    <table class="batches-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Fisherman</th>
                                <th>Weight (kg)</th>
                                <th>Price/Kg</th>
                                <th>Species</th>
                                <th>Location</th>
                                <th>Catch Time</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            pendingBatches.forEach((batch, index) => {
                dashboardHTML += `
                    <tr>
                        <td>${batch.id}</td>
                        <td class="address">${batch.fisherman}</td>
                        <td>${batch.weight}</td>
                        <td>${batch.pricePerKg}</td>
                        <td>${batch.species || 'N/A'}</td>
                        <td>${batch.location || 'N/A'}</td>
                        <td>${batch.catchTime || 'N/A'}</td>
                        <td>
                            <div class="action-buttons">
                                <button onclick="setSustainability(${batch.id}, true)" class="btn-sustainable">✅ Approve (Sustainable)</button>
                                <button onclick="setSustainability(${batch.id}, false)" class="btn-unsustainable">❌ Reject (Unsustainable)</button>
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            dashboardHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        dashboardHTML += `
                            </div>
                        </div>
                    </div>
                    
                    <!-- Remaining Batches Section -->
                    <div class="inspector-section" id="remaining-section" style="display: none;">
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3>🐟 Remaining Batches Management</h3>
                                <span class="badge">${batches.filter(b => b.status === 'approved' || b.status === 'listed').length}</span>
                            </div>
                            <div class="card-content">
        `;
        
        const remainingBatches = batches.filter(batch => batch.status === 'approved' || batch.status === 'listed');
        if (remainingBatches.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>No remaining batches found</p>
                    <p>Approved batches will appear here after inspector review</p>
                </div>
            `;
        } else {
            dashboardHTML += `
                <div class="batches-table-container">
                    <table class="batches-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Fisherman</th>
                                <th>Weight (kg)</th>
                                <th>Price/Kg</th>
                                <th>Sustainability</th>
                                <th>Transfer IDs</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            remainingBatches.forEach((batch, index) => {
                dashboardHTML += `
                    <tr>
                        <td>${batch.id}</td>
                        <td class="address">${batch.fisherman}</td>
                        <td>${batch.weight}</td>
                        <td>${batch.pricePerKg}</td>
                        <td>
                            <span class="sustainability-status ${batch.sustainable ? 'sustainable' : 'not-sustainable'}">
                                ${batch.sustainable ? '✅ Sustainable' : '❌ Not Sustainable'}
                            </span>
                        </td>
                        <td>${batch.transferIds ? batch.transferIds.length : 0}</td>
                        <td>
                            <span class="batch-status ${batch.status || 'pending'}">
                                ${batch.status || 'Pending Review'}
                            </span>
                        </td>
                        <td>
                            <div class="action-buttons">
                                <button onclick="addTransferId(${batch.id})" class="btn-transfer">📦 Add Transfer</button>
                                <button onclick="openPriceAdjustment(${batch.id})" class="btn-price">💰 Price Adjustment</button>
                                <!-- Listing happens automatically when batch is approved as sustainable -->
                            </div>
                        </td>
                    </tr>
                `;
            });
            
            dashboardHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        dashboardHTML += `
                            </div>
                        </div>
                    </div>
                    
                    <!-- Sold Batches Section -->
                    <div class="inspector-section" id="sold-section" style="display: none;">
                        <div class="dashboard-card">
                            <div class="card-header">
                                <h3>🟩 Sold Batches</h3>
                                <span class="badge">${batches.filter(b => b.status === 'sold').length}</span>
                            </div>
                            <div class="card-content">
        `;
        
        const soldBatches = batches.filter(batch => batch.status === 'sold');
        if (soldBatches.length === 0) {
            dashboardHTML += `
                <div class="no-data">
                    <p>No sold batches found</p>
                    <p>Sold batches will appear here once buyers purchase fish</p>
                </div>
            `;
        } else {
            dashboardHTML += `
                <div class="batches-table-container">
                    <table class="batches-table">
                        <thead>
                            <tr>
                                <th>Batch ID</th>
                                <th>Fisherman</th>
                                <th>Total Weight</th>
                                <th>Final Price</th>
                                <th>Buyer ID</th>
                                <th>Sale Date</th>
                                <th>Tracking</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            soldBatches.forEach((batch, index) => {
                dashboardHTML += `
                    <tr>
                        <td>${batch.id}</td>
                        <td class="address">${batch.fisherman}</td>
                        <td>${batch.weight}</td>
                        <td>${batch.finalPrice || batch.pricePerKg}</td>
                        <td class="address">${batch.buyerId || 'N/A'}</td>
                        <td>${batch.saleDate || 'N/A'}</td>
                        <td>
                            <button onclick="viewTracking('${batch.id}')" class="btn-tracking">📦 View Tracking</button>
                        </td>
                    </tr>
                `;
            });
            
            dashboardHTML += `
                        </tbody>
                    </table>
                </div>
            `;
        }
        
        dashboardHTML += `
                            </div>
                        </div>
                    </div>
                    
                    <!-- Quick Actions -->
                    <div class="dashboard-card">
                        <div class="card-header">
                            <h3>⚡ Quick Actions</h3>
                        </div>
                        <div class="card-content">
                            <div class="quick-actions">
                                <button onclick="refreshBatches()" class="action-btn">🔄 Refresh Batches</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        formContainer.innerHTML = dashboardHTML;
        
    } catch (error) {
        console.error('Error loading inspector dashboard:', error);
        formContainer.innerHTML = `
            <div class="error-message">
                <h2>❌ Error</h2>
                <p>Failed to load inspector dashboard. Please try again.</p>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// Fetch fish batches from backend (single source of truth)
async function fetchFishBatches() {
    try {
        const resp = await fetch('http://localhost:8080/api/fisheries/batches');
        if (!resp.ok) return [];
        const batches = await resp.json();
        // Normalize for UI
        return (batches || []).map((batch) => ({
            id: batch.id,
            fisherman: batch.fisher,
            weight: batch.weight,
            pricePerKg: batch.pricePerKg,
            species: 'Fish',
            location: 'Ocean',
            catchTime: new Date().toISOString(),
            sustainable: batch.sustainable || false,
            transferIds: batch.transferIds || [],
            isSold: batch.isSold || false,
            inDispute: batch.inDispute || false,
            status: batch.isSold ? 'sold' : batch.inDispute ? 'disputed' : batch.sustainable ? 'approved' : 'pending'
        }));
    } catch (e) {
        console.error('Error fetching batches:', e);
        return [];
    }
}

// Check government status manually
async function checkGovernmentStatus() {
    try {
        const response = await fetch('http://localhost:8080/api/inspector/government');
        const data = await response.json();
        const isGovt = (currentUserAddress && currentUserAddress.toLowerCase() === data.government.toLowerCase());
        
        alert(`Government Address: ${data.government}\nYour Address: ${currentUserAddress}\nIs Government: ${isGovt}`);
        
        // Update the global variable
        isGovernment = isGovt;
        
        // Reload GOVT tab if it's currently open
        if (isGovt) {
            loadForm('GOVT');
        }
    } catch (error) {
        console.error('Error checking government status:', error);
        alert('Error checking government status: ' + error.message);
    }
}

// Removed legacy per-ID fetch; now using /api/fisheries/batches




// Resolve dispute
async function resolveDispute(batchId) {
    try {
        // This would call a backend endpoint to resolve the dispute
        showNotification('✅ Dispute resolved successfully!', 'success');
        loadGovernmentDashboard(); // Refresh the dashboard
    } catch (error) {
        console.error('Error resolving dispute:', error);
        showNotification('❌ Error resolving dispute', 'error');
    }
}

// Buy fish from marketplace
async function buyFish(listingId, availableWeight, pricePerKg) {
    try {
        // Prompt user for amount to buy
        const weightToBuy = prompt(`How much weight do you want to buy? (Available: ${availableWeight} kg)`);
        
        if (!weightToBuy || isNaN(weightToBuy) || parseFloat(weightToBuy) <= 0) {
            showNotification('❌ Please enter a valid weight amount', 'error');
            return;
        }
        
        if (parseFloat(weightToBuy) > parseFloat(availableWeight)) {
            showNotification('❌ Cannot buy more than available weight', 'error');
            return;
        }
        
        if (!confirm(`Buy ${weightToBuy} kg?`)) {
            return;
        }
        showNotification('🛒 Processing purchase...', 'info');
        // Backend computes total wei from on-chain price
        const response = await fetch(`http://localhost:8080/api/marketplace/buy/${listingId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                weight: parseFloat(weightToBuy)
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('✅ Fish purchased successfully!', 'success');
            if (result.isSoldOut) {
                // If sold out, refresh market and govt dashboard sold section will reflect when implemented
                setTimeout(() => { loadForm('Market'); }, 1000);
            } else {
                setTimeout(() => { loadForm('Market'); }, 1000);
            }
        } else {
            const error = await response.json();
            showNotification('❌ Purchase failed: ' + error.message, 'error');
        }
    } catch (error) {
        console.error('Error buying fish:', error);
        showNotification('❌ Error purchasing fish', 'error');
    }
}

// Debug function to check system status
function debugSystem() {
    console.log('=== FishChain Debug Info ===');
    console.log('Current User Address:', currentUserAddress);
    console.log('Is Government:', isGovernment);
    console.log('MetaMask Available:', typeof window.ethereum !== 'undefined');
    console.log('========================');
    
    // Also show in alert for easy debugging
    alert(`Debug Info:
Current Address: ${currentUserAddress || 'Not connected'}
Is Government: ${isGovernment}
MetaMask Available: ${typeof window.ethereum !== 'undefined'}

Check browser console for more details.`);
}

// Authorization Form Functions
function showLoginForm() {
    const authContainer = document.getElementById('auth-form-container');
    authContainer.innerHTML = `
        <div class="auth-form-card login-card">
            <div class="form-header">
                <div class="form-icon">🔐</div>
                <h3>Inspector Login</h3>
                <p>Access your inspector dashboard</p>
            </div>
            
            <div class="form-actions">
                <button onclick="loadInspectorDashboard()" class="dashboard-btn">
                    <div class="btn-icon">📊</div>
                    <span>Go to Inspector Dashboard</span>
                </button>
            </div>
        </div>
    `;
}

function showSignupForm() {
    const authContainer = document.getElementById('auth-form-container');
    authContainer.innerHTML = `
        <div class="auth-form-card signup-card">
            <div class="form-header">
                <div class="form-icon">📝</div>
                <h3>Register as Inspector</h3>
                <p>Submit your application for inspector authorization</p>
            </div>
            
            <form id="signupForm" class="signup-form">
                <div class="form-group">
                    <label for="applicantName">
                        <div class="label-icon">👤</div>
                        Full Name
                    </label>
                    <input type="text" id="applicantName" name="name" placeholder="Enter your full name" required>
                </div>
                
                <div class="form-group">
                    <label for="applicantAddress">
                        <div class="label-icon">🔗</div>
                        Wallet Address
                    </label>
                    <input type="text" id="applicantAddress" name="address" value="${currentUserAddress}" readonly>
                    <small>This is your connected wallet address</small>
                </div>
                
                <button type="submit" class="signup-btn">
                    <div class="btn-icon">📤</div>
                    <span>Submit Application</span>
                </button>
            </form>
        </div>
    `;
    
    // Attach form event listener
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        signupForm.addEventListener('submit', handleSignupSubmit);
    }
}

async function checkAuthStatus() {
    const statusElement = document.getElementById('auth-status');
    if (!statusElement) return;
    
    try {
        statusElement.textContent = 'Checking...';
        
        // Check if user is authorized
        const response = await fetch(`http://localhost:8080/api/inspector/status/${currentUserAddress}`);
        const data = await response.json();
        
        if (data.authorized) {
            statusElement.textContent = '✅ Authorized';
            statusElement.style.color = '#4CAF50';
        } else if (data.pending) {
            statusElement.textContent = '⏳ Pending Review';
            statusElement.style.color = '#ff9800';
        } else {
            statusElement.textContent = '❌ Not Authorized';
            statusElement.style.color = '#f44336';
        }
    } catch (error) {
        statusElement.textContent = '❌ Backend Not Available';
        statusElement.style.color = '#f44336';
        console.error('Error checking auth status:', error);
    }
}

function handleSignupSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const address = formData.get('address');
    
    if (!address) {
        showNotification('❌ Address is required', 'error');
        return;
    }
    
    // Show loading state
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="btn-icon">⏳</div><span>Submitting...</span>';
    submitBtn.disabled = true;
    
    // Submit application
    makeApiRequest('http://localhost:8080/api/inspector/request-authorization', 'POST', {
        address
    })
    .then(response => {
        showNotification('✅ Application submitted successfully! Your request is now pending government approval.', 'success');
        
        // Show success message and redirect option
        const authContainer = document.getElementById('auth-form-container');
        authContainer.innerHTML = `
            <div class="auth-form-card success-card active">
                <div class="form-header">
                    <div class="form-icon">✅</div>
                    <h3>Application Submitted!</h3>
                    <p>Your inspector application has been submitted and is pending government approval.</p>
                </div>
                
                <div class="success-info">
                    <div class="info-item">
                        <div class="info-icon">🔗</div>
                        <div class="info-content">
                            <h4>Wallet Address</h4>
                            <p>${address}</p>
                        </div>
                    </div>
                    <div class="info-item">
                        <div class="info-icon">📋</div>
                        <div class="info-content">
                            <h4>Status</h4>
                            <p>Pending Government Approval</p>
                        </div>
                    </div>
                </div>
                
                <div class="form-actions">
                    <button onclick="loadForm('Authorize')" class="dashboard-btn">
                        <div class="btn-icon">🔙</div>
                        <span>Back to Portal</span>
                    </button>
                    <button onclick="showLoginForm()" class="check-status-btn">
                        <div class="btn-icon">🔍</div>
                        <span>Check Status</span>
                    </button>
                </div>
            </div>
        `;
    })
    .catch(error => {
        showNotification('❌ Error submitting application: ' + error.message, 'error');
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    });
}

// Government Dashboard Navigation
function showDashboardSection(section) {
    // Hide all sections
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(sec => sec.style.display = 'none');
    
    // Remove active class from all tabs
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected section
    const targetSection = document.getElementById(section + '-section');
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Add active class to clicked tab
    const activeTab = document.getElementById(section + '-tab');
    if (activeTab) {
        activeTab.classList.add('active');
    }
    
    // Do not reload the dashboard here; avoid resetting the active tab
}

// Show inspector section (pending/remaining/sold batches)
function showInspectorSection(section) {
    // Update tab states
    document.querySelectorAll('.inspector-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${section}-tab`).classList.add('active');
    
    // Show/hide sections
    document.getElementById('pending-section').style.display = section === 'pending' ? 'block' : 'none';
    document.getElementById('remaining-section').style.display = section === 'remaining' ? 'block' : 'none';
    document.getElementById('sold-section').style.display = section === 'sold' ? 'block' : 'none';
    // Persist the current inspector section so refreshes/polls don't reset it
    try { currentInspectorSection = section; } catch (e) { /* ignore */ }
}

// Refresh batches - called from Quick Actions
async function refreshBatches() {
    showNotification('🔄 Refreshing batches...', 'info');
    await loadInspectorDashboard();
}

// Debug function to check batches data
// Debug Batches removed per requirements

// Set sustainability status (new function for pending batches)
async function setSustainability(batchId, isSustainable) {
    try {
        showNotification(`${isSustainable ? 'Marking as sustainable' : 'Marking as unsustainable'}...`, 'info');
        
        // Call backend API to set sustainability using existing endpoint
        const response = await fetch(`http://localhost:8080/api/fisheries/updatesustainability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                batchId: parseInt(batchId), 
                sustainable: isSustainable 
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`Batch marked as ${isSustainable ? 'sustainable' : 'unsustainable'}!`, 'success');
            if (!isSustainable) {
                await addToDisputeList(batchId);
                await loadInspectorDashboard();
            } else {
                // When marking as sustainable, prompt the inspector for optional pricing factors
                // These factors will be applied immediately after the listing is created.
                try {
                    const wantFactors = confirm('Would you like to apply sustainability/freshness factors to adjust the listing price now?');
                    if (wantFactors) {
                        // Prompt for sustainability factor and freshness factor (numbers, e.g. 0.9, 1.0, 1.1)
                        let sStr = prompt('Enter sustainability factor (e.g. 0.9 for -10%, 1.0 for no change)', '1.0');
                        if (sStr === null) sStr = '1.0';
                        let fStr = prompt('Enter freshness factor (e.g. 0.95 for -5%, 1.0 for no change)', '1.0');
                        if (fStr === null) fStr = '1.0';

                        const s = parseFloat(sStr);
                        const f = parseFloat(fStr);
                        if (!isNaN(s) && !isNaN(f)) {
                            // Save pending factors globally so listToMarket can apply them after the listing appears
                            window.__pendingPriceFactors = { s, f };
                        } else {
                            showNotification('Invalid factors entered; proceeding without factor-based adjustment.', 'warning');
                        }
                    }
                } catch (e) {
                    console.warn('Factor prompt cancelled or failed', e);
                }

                // If marked sustainable, automatically list to market but DO NOT redirect to Market
                // listToMarket will refresh the inspector dashboard when done and apply any pending factors
                await listToMarket(batchId, false);
            }
        } else {
            showNotification('Failed to update sustainability status', 'error');
        }
    } catch (error) {
        console.error('Error setting sustainability:', error);
        showNotification('Error updating sustainability status', 'error');
    }
}

// Add batch to dispute list
async function addToDisputeList(batchId) {
    try {
        // Mark the batch as disputed in the backend
        const response = await fetch(`http://localhost:8080/api/fisheries/updatesustainability`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                batchId: parseInt(batchId), 
                sustainable: false,
                inDispute: true
            })
        });
        
        if (response.ok) {
            showNotification('⚠️ Batch added to Government Dashboard dispute list', 'warning');
            // Refresh government dashboard if it's currently open
            if (document.querySelector('.government-dashboard')) {
                loadGovernmentDashboard();
            }
        } else {
            showNotification('⚠️ Batch marked as unsustainable (will appear in dispute list)', 'warning');
        }
    } catch (error) {
        console.error('Error adding to dispute list:', error);
        showNotification('⚠️ Batch marked as unsustainable (will appear in dispute list)', 'warning');
    }
}

// Toggle sustainability status (for existing batches)
async function toggleSustainability(batchId) {
    try {
        showNotification('Updating sustainability status...', 'info');
        
        // Call smart contract method
        const response = await fetch(`http://localhost:8080/api/fisheries/toggle-sustainability/${batchId}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification('Sustainability status updated successfully!', 'success');
            
            // If marked unsustainable, add to dispute list
            if (!result.sustainable) {
                await addToDisputeList(batchId);
            }
            
            loadInspectorDashboard();
        } else {
            showNotification('Failed to update sustainability status', 'error');
        }
    } catch (error) {
        console.error('Error toggling sustainability:', error);
        showNotification('Error updating sustainability status', 'error');
    }
}

// Approve batch and add to market
async function approveBatch(batchId) {
    try {
        // Update batch status to approved
        await fetch(`http://localhost:8080/api/fisheries/approve-batch/${batchId}`, {
            method: 'POST'
        });
        
        // Add to marketplace
        await fetch(`http://localhost:8080/api/marketplace/list-batch/${batchId}`, {
            method: 'POST'
        });
        
        showNotification('Batch approved and added to marketplace!', 'success');
    } catch (error) {
        console.error('Error approving batch:', error);
        showNotification('Error approving batch', 'error');
    }
}

// (duplicate addToDisputeList removed — single implementation above is used)

// Open price adjustment: prompt for a new absolute price and call backend to adjust by batchId
async function openPriceAdjustment(batchId) {
    try {
        showNotification('Locating listing for batch...', 'info');

        // Prompt the inspector for the new price per kg (absolute value in ETH)
        const newPriceStr = prompt('Enter new price per kg (in ETH), e.g. 0.05', '0.00');
        if (newPriceStr === null) return; // user cancelled
        const newPrice = parseFloat(newPriceStr);
        if (isNaN(newPrice) || newPrice < 0) {
            showNotification('Invalid price entered', 'error');
            return;
        }

        showNotification('Submitting price update...', 'info');

        // Call backend endpoint which attempts to find the listing by batch and adjust its price
        const resp = await fetch('http://localhost:8080/api/marketplace/adjustByBatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId: parseInt(batchId), newPrice: parseFloat(newPrice) })
        });

        if (!resp.ok) {
            const txt = await resp.text();
            console.error('adjustByBatch failed:', txt);
            showNotification('Failed to adjust listing price: ' + (txt || resp.statusText), 'error');
            return;
        }

        const result = await resp.json();
        console.debug('openPriceAdjustment - backend response:', result);

        if (result.success) {
            showNotification('✅ Listing price updated', 'success');
        } else {
            // If backend couldn't find listing by batch, it may have adjusted by listingId; show message
            showNotification(result.message || 'Listing price update submitted', 'info');
        }

        // Refresh UI: Market and inspector dashboard
        setTimeout(() => loadForm('Market'), 700);
        await loadInspectorDashboard();

    } catch (error) {
        console.error('Error in openPriceAdjustment:', error);
        showNotification('Error updating price: ' + error.message, 'error');
    }
}

// List batch to market
async function listToMarket(batchId, doRedirect = true) {
    try {
        showNotification('Listing batch to market...', 'info');
        // Fetch batch details
        const batchResp = await fetch(`http://localhost:8080/api/fisheries/batch/${batchId}`);
        if (!batchResp.ok) { showNotification('Failed to fetch batch details', 'error'); return; }
        const batch = await batchResp.json();
        // Create listing
        const listResp = await fetch(`http://localhost:8080/api/marketplace/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ batchId: parseInt(batchId), weight: parseFloat(batch.weight), pricePerKg: parseFloat(batch.pricePerKg) })
        });
        if (!listResp.ok) { showNotification('Failed to list batch to market', 'error'); return; }
    const listResult = await listResp.json();
    console.debug('listToMarket - backend response:', listResult);
    let listingIdRaw = listResult.listingId || listResult.txHash || null;
    const parsedListing = listResult.parsedListing || null;

    // Try to derive a numeric listingId in multiple ways:
    // 1) parsedListing.listingId (preferred)
    // 2) numeric listingIdRaw
    // 3) search marketplace listings for one with matching batchId
    let numericListingId = null;
    if (parsedListing && parsedListing.listingId && !isNaN(Number(parsedListing.listingId))) {
        numericListingId = Number(parsedListing.listingId);
    } else if (listingIdRaw && !isNaN(Number(listingIdRaw))) {
        numericListingId = Number(listingIdRaw);
    }

    // If still not found, attempt to find a listing that matches this batchId
    if (!numericListingId) {
        try {
            const allResp = await fetch('http://localhost:8080/api/marketplace/listings');
            if (allResp.ok) {
                const all = await allResp.json();
                const listings = Array.isArray(all) ? all : (all.listings || all);
                // Prefer listings that match batchId and are not sold out, newest first
                const matches = (listings || []).filter(l => Number(l.batchId) === Number(batchId) && !l.isSoldOut).sort((a,b)=> Number(b.listingId)-Number(a.listingId));
                if (matches.length > 0) {
                    numericListingId = Number(matches[0].listingId);
                }
            }
        } catch (e) {
            console.warn('Could not search listings to determine listingId:', e);
        }
    }

    // Apply price adjustment if factors saved and we have a numeric listing id
    const factors = window.__pendingPriceFactors;
    if (numericListingId && factors) {
        try {
            const adjResp = await fetch(`http://localhost:8080/api/pricing/adjust/${numericListingId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sustainabilityFactor: factors.s, freshnessFactor: factors.f })
            });
            if (adjResp.ok) {
                delete window.__pendingPriceFactors;
                showNotification('✅ Listed and price adjusted. Redirecting to Market...', 'success');
                // Prefer redirecting to market so fetched listings include the new one
                setTimeout(() => loadForm('Market'), 1200);
            } else {
                const txt = await adjResp.text();
                console.warn('Price adjust returned non-ok:', txt);
                showNotification('Listed, but price adjustment failed', 'error');
            }
        } catch (e) {
            console.error('Error applying price factors:', e);
            showNotification('Listed, but price adjustment request failed', 'error');
        }
    } else {
        showNotification('✅ Listed.', 'success');
        // Only redirect to Market if caller requested it (default true). For inspector flows we pass false.
        if (doRedirect) setTimeout(() => loadForm('Market'), 800);
    }

    // Refresh inspector dashboard after short delay
    setTimeout(() => { loadInspectorDashboard(); }, 1400);
    } catch (error) {
        console.error('Error listing to market:', error);
        showNotification('Error listing to market', 'error');
    }
}

// View tracking for sold batches
function viewTracking(batchId) {
    showNotification(`Viewing tracking for batch ${batchId}...`, 'info');
    // This would open a modal or redirect to tracking page
    alert(`Tracking details for batch ${batchId}:\n\nTransfer IDs: T001, T002, T003\nStatus: In Transit\nLocation: Port of Mumbai\nETA: 2 days`);
}


// Blockchain Event Listeners for Real-time Updates
let eventListeners = {
    batchLogged: null,
    sustainabilityUpdated: null,
    priceAdjusted: null,
    batchSold: null,
    batchDisputed: null
};

// Initialize blockchain event listeners (disabled until backend endpoints are ready)
async function initializeEventListeners() {
    try {
        // Event listeners disabled until backend endpoints are implemented
        console.log('Event listeners disabled - backend endpoints not ready yet');
        
        // Simple polling for new batches every 10 seconds
        eventListeners.batchLogged = setInterval(async () => {
            await checkForNewBatches();
        }, 10000);

    } catch (error) {
        console.error('Error initializing event listeners:', error);
    }
}

// Check for new batches (simplified - just check if inspector dashboard is open)
async function checkForNewBatches() {
    try {
        // Only check if inspector dashboard is currently open
        const inspectorDashboard = document.querySelector('.inspector-dashboard');
        if (inspectorDashboard) {
            // Silently refresh the dashboard to check for new batches
            await loadInspectorDashboard();
        }
    } catch (error) {
        console.error('Error checking for new batches:', error);
    }
}

// Event checking functions removed - endpoints not implemented in backend yet

// Clean up event listeners
function cleanupEventListeners() {
    Object.values(eventListeners).forEach(listener => {
        if (listener) {
            clearInterval(listener);
        }
    });
    eventListeners = {
        batchLogged: null,
        sustainabilityUpdated: null,
        priceAdjusted: null,
        batchSold: null,
        batchDisputed: null
    };
}

// Initialize event listeners when page loads
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

// Clean up when page unloads
window.addEventListener('beforeunload', cleanupEventListeners);

// Logout government user
function logoutGovernment() {
    if (confirm('Are you sure you want to logout from government access?')) {
        window.authenticatedGovtAddress = null;
        showNotification('🚪 Logged out from government access', 'info');
        loadGovernmentAuthForm();
    }
}

// Make debug function globally available
window.debugSystem = debugSystem;