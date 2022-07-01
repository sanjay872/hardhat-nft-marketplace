const { developmentChains } = require("../../helper-hardhat-config")
const { network, getNamedAccounts, deployments, ethers } = require("hardhat")
const { assert } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Basic NFT test", () => {
          let deployer, basicNft
          beforeEach(async () => {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture("basicNft")
              basicNft = await ethers.getContract("BasicNft", deployer)
          })
          describe("Constructor", () => {
              it("check if inital token value is zero", async () => {
                  const tokenCounter = await basicNft.getTokenCounter()
                  assert.equal(tokenCounter.toString(), "0")
              })
              it("check if token uri exist", async () => {
                  const tokenUri = await basicNft.tokenURI("0x0")
                  assert(tokenUri)
              })
          })

          describe("token generation", () => {
              it("check if token is mined", async () => {
                  const txtResponse = await basicNft.mintNft()
                  await txtResponse.wait(1)
                  const tokenURI = await basicNft.tokenURI(0)
                  const tokenCounter = await basicNft.getTokenCounter()
                  assert.equal(tokenCounter.toString(), "1")
                  assert.equal(tokenURI, await basicNft.TOKEN_URI())
              })
          })
      })
