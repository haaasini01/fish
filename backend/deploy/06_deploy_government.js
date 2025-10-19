module.exports = async ({ deployments, getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();
  const { deploy, get } = deployments;

  console.log("Deploying Government contract...");

  // Get addresses of already deployed contracts (will throw if not found)
  const fisheries = await get("FisheriesManagement");
  const inspectorAuth = await get("InspectorAuthorization");
  const marketplace = await get("FishMarketplace");

  // The contract in source is named `Govt` (Govt.sol). Deploy that contract.
  const government = await deploy("Govt", {
    from: deployer,
    args: [fisheries.address, inspectorAuth.address, marketplace.address],
    log: true,
  });

  console.log("Govt deployed to:", government.address);
};

module.exports.tags = ["Govt"];
