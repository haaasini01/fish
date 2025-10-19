// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./FisheriesManagement.sol";
import "./InspectorAuthorization.sol";
import "./FishMarketplace.sol";

contract Govt{
    address public owner;
    FisheriesManagement public fisheries;
    InspectorAuthorization public inspectorAuth;
    FishMarketplace public marketplace;

    mapping(uint256 => bool) public stolenBatches;
    mapping(uint256 => bool) public InsurancePaid;

    event ReportedStolen(uint256 indexed batchId, address reporter);
    event InsurancePaidForDisputeBatch(uint256 indexed batchId, address fisher, uint256 amount);
    event InsurancePaidForStolenBatch(uint256 indexed batchId, address fisher, uint256 amount);
    // event InspectorAuthorized(address inspectorAdd);
    // event InspectorRevoked(address inspectorAdd);
    event BuyBack(uint256 listingId, uint256 weight, uint256 totalPrice);
    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    // Events used when Govt cannot directly call InspectorAuthorization (e.g. InspectorAuthorization.government != Govt)
    event InspectorAuthorizationRequested(address inspector);
    event InspectorRevocationRequested(address inspector);

    modifier onlyOwner(){
        require(msg.sender == owner, "Only Govt can do this");
        _;
    }

    constructor(address fisheriesAddress, address inspectorAuthAddress, address marketplaceAddress){
        owner = msg.sender;
        fisheries = FisheriesManagement(fisheriesAddress);
        inspectorAuth = InspectorAuthorization(inspectorAuthAddress);
        marketplace = FishMarketplace(marketplaceAddress);
    }

    function setFisheriesManagement(address addr) external onlyOwner {
        fisheries = FisheriesManagement(addr);
    }

    function setInspectorAuthorization(address addr) external onlyOwner {
        inspectorAuth = InspectorAuthorization(addr);
    }

    function setMarketplace(address addr) external onlyOwner {
        marketplace = FishMarketplace(addr);
    }

    function reportStolen(uint256 batchId) external {
        stolenBatches[batchId] = true;
        emit ReportedStolen(batchId, msg.sender);
    }

    function payInsuranceForDisputeBatch(uint256 _batchId, uint256 _amount) external onlyOwner{
        ( uint256 id,
        address fisher,
        ,
        ,
        ,
        bool inDispute,
        bool sustainable,
        ) = fisheries.getFishBatch(_batchId);
        require(id == _batchId, "Batch doesn't exist");
        require(inDispute == true, "Batch not in dispute");
        require(sustainable == false, "Batch is not sustainable");
        require(InsurancePaid[_batchId] == false, "Insurance already paid (insurance can only be given once for a batch)");
        require(address(this).balance >= _amount, "Govt doesn't have enough funds");

        payable(fisher).transfer(_amount);
        InsurancePaid[_batchId] = true;
        emit InsurancePaidForDisputeBatch(_batchId, fisher, _amount);
    }

    function payInsuranceForStolen(uint256 _batchId, uint256 _amount) external onlyOwner{
        require(stolenBatches[_batchId] == true, "Batch not Stolen");
        ( uint256 id,
        address fisher,
        ,
        ,
        ,
        ,
        ,
        ) = fisheries.getFishBatch(_batchId);
        require(id == _batchId, "Batch doesn't exist");
        require(InsurancePaid[_batchId] == false, "Insurance already paid (insurance can only be given once for a batch)");
        require(address(this).balance >= _amount, "Govt doesn't have enoughh funds");

        payable(fisher).transfer(_amount);
        InsurancePaid[_batchId] = true;
        stolenBatches[_batchId] = false;
        emit InsurancePaidForStolenBatch(_batchId, fisher, _amount);      
    }

    function authorizeInspector(address _inspectorAdd) external onlyOwner{
        // Try to call the InspectorAuthorization contract directly. If it reverts (for example because
        // InspectorAuthorization.government != address(this)), emit an event so an off-chain signer
        // (the owner EOA) can fulfill the request by calling InspectorAuthorization.authorizeInspector(...).
        try inspectorAuth.authorizeInspector(_inspectorAdd) {
            // success: InspectorAuthorization contract will emit its own event
        } catch {
            emit InspectorAuthorizationRequested(_inspectorAdd);
        }
    }

    function revokeInspector(address _inspectorAdd) external onlyOwner{
        try inspectorAuth.revokeInspector(_inspectorAdd) {
            // success
        } catch {
            emit InspectorRevocationRequested(_inspectorAdd);
        }
    }

    function buyBackUnsoldBatch(uint256 _listingId, uint256 _weight) external onlyOwner{
        ( uint256 listingId,
        ,
        ,
        , 
        ,
        uint256 pricePerKg,
        ) = marketplace.getListingDetails(_listingId);
        require(listingId == _listingId, "Batch doesn't exist in the marketplace");
        uint256 totalPrice = _weight * pricePerKg;
        require(address(this).balance >= totalPrice, "Govt doesn't have enough funds");
        marketplace.buyFish{value: totalPrice}(_listingId, _weight);
        emit BuyBack(_listingId, _weight, totalPrice);
    }

    receive() external payable{
        emit Deposit(msg.sender, msg.value);
    }

    function deposit() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount, address payable to) external onlyOwner{
        require(address(this).balance >= amount, "Government: insufficient funds");
        to.transfer(amount);
        emit Withdraw(to, amount);
    }
}