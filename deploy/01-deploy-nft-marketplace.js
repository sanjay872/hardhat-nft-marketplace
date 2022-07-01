const { developmentChains, networkConfig } = require("../helper-hardhat-config")
const { network, ethers } = require("hardhat")
const { verify } = require("../utils/verify")

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()

    let nftMarketPlace

    const args = []

    nftMarketPlace = await deploy("NftMarketPlace", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 1,
    })

    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("verifying....")
        await verify(nftMarketPlace.address, args)
    }
    log("----------------------------------------------")
}

module.exports.tags = ["all", "nftmarketplace", "main"]
