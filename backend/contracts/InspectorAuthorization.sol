// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract InspectorAuthorization {
    address public government;
    mapping(address => bool) public authorizedInspectors;

    event InspectorAuthorized(address inspector);
    event InspectorRevoked(address inspector);
    event GovernmentChanged(address newGovernment);

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

    /// @notice Set a new government address. Callable only by current government.
    function setGovernment(address newGovernment) external onlyGovernment {
        require(newGovernment != address(0), "Invalid address");
        government = newGovernment;
        emit GovernmentChanged(newGovernment);
    }

    function authorizeInspector(address inspector) public onlyGovernment {
        authorizedInspectors[inspector] = true;
        emit InspectorAuthorized(inspector);
    }

    function revokeInspector(address inspector) public onlyGovernment {
        authorizedInspectors[inspector] = false;
        emit InspectorRevoked(inspector);
    }
}
