// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "./InspectorAuthorization.sol";

contract FisheriesManagement {
    address public government;
    uint256 public nextBatchId = 1;
    InspectorAuthorization public inspectorAuth;

    struct FishBatch {
        uint256 id;
        address fisher;
        uint256 weight;
        uint256 pricePerKg;
        bool isSold;
        bool inDispute;
        bool sustainable;
        uint256[] transferIds;
    }

    mapping(uint256 => FishBatch) public batches;

    event FishLogged(
        uint256 batchId,
        address fisher,
        uint256 weight,
        uint256 pricePerKg
    );
    event SustainabilityUpdated(uint256 batchId, bool sustainable);
    event DisputeRaised(uint256 batchId, string reason);

    modifier onlyGovernment() {
        require(
            msg.sender == government,
            "Only government can call this function"
        );
        _;
    }

    constructor() {
        government = msg.sender;
    }

    /// @notice set inspector authorization contract address (only government)
    function setInspectorAuthorization(address addr) external {
        require(msg.sender == government, "Only government can set inspector authorization");
        inspectorAuth = InspectorAuthorization(addr);
    }

    function logCatch(uint256 weight, uint256 pricePerKg) public {
        batches[nextBatchId] = FishBatch(
            nextBatchId,
            msg.sender,
            weight,
            pricePerKg,
            false,
            false,
            false,
            new uint256[](0)
        );
        emit FishLogged(nextBatchId, msg.sender, weight, pricePerKg);
        nextBatchId++;
    }

    function updateSustainability(
        uint256 batchId,
        bool sustainable
    ) public {
        // Allow either government or an authorized inspector to update sustainability
        if (address(inspectorAuth) == address(0)) {
            require(msg.sender == government, "Only government can call this function");
        } else {
            require(msg.sender == government || inspectorAuth.authorizedInspectors(msg.sender), "Unauthorized: only government or authorized inspector");
        }

        batches[batchId].sustainable = sustainable;
        emit SustainabilityUpdated(batchId, sustainable);
    }

    function raiseDispute(
        uint256 batchId,
        string memory reason
    ) public onlyGovernment { // *************************************
        batches[batchId].inDispute = true;
        emit DisputeRaised(batchId, reason);
    }




function getFishBatch(uint256 batchId) external view returns (
        uint256,
        address,
        uint256,
        uint256,
        bool,
        bool,
        bool,
        uint256[] memory
    ){
    require(batches[batchId].id == batchId, "Batch does not exist");
    FishBatch memory batch = batches[batchId];
    return (
        batch.id,
        batch.fisher,
        batch.weight,
        batch.pricePerKg,
        batch.isSold,
        batch.inDispute,
        batch.sustainable,
        batch.transferIds
    );
}



    function getBatchSustainability(
        uint256 batchId
    ) external view returns (bool) {
        return batches[batchId].sustainable;
    }

    function getTransferIds(
        uint256 batchId
    ) external view returns (uint256[] memory) {
        require(batches[batchId].id == batchId, "Batch does not exist");
        return batches[batchId].transferIds;
    }

    function addTransferToBatch(uint256 batchId, uint256 transferId) external {
        require(batches[batchId].id == batchId, "Batch does not exist");
        batches[batchId].transferIds.push(transferId);
    }

    function updateweight(uint256 batchId, uint256 weight) external {
        require(batches[batchId].id == batchId, "Batch does not exist");
        batches[batchId].weight -= weight;
    }
}
