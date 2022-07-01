const { developmentChains } = require("../../helper-hardhat-config")
const { network, ethers } = require("hardhat")
const { expect, assert } = require("chai")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft MarketPlace", () => {
          let nftMarketPlace, basicNft, deployer, user
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async () => {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              basicNft = await ethers.getContract("BasicNft", deployer)
              nftMarketPlace = await ethers.getContract("NftMarketPlace", deployer)
              await basicNft.mintNft()
              await basicNft.approve(nftMarketPlace.address, TOKEN_ID)
          })

          describe("List item", () => {
              it("adding new nft to the list", async () => {
                  expect(await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })

              it("trying to add item that already exist", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const error = `NftMarketPlace_AlreadyListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })

              it("check only owner is allowed", async () => {
                  const nftContract = await ethers.getContract("NftMarketPlace", user)
                  const error = `NftMarketPlace_NotOwner()`
                  await expect(
                      nftContract.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })

              it("price need to be greater than zero", async () => {
                  const error = `NftMarketPlace_PriceMustBeAboveZero()`
                  await expect(
                      nftMarketPlace.listItem(basicNft.address, TOKEN_ID, "0")
                  ).to.be.revertedWith(error)
              })

              it("check whether the token verified before doing creating item", async () => {
                  //approved fake address and token
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  //trying use different address with same token
                  await expect(
                      nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(`NftMarketPlace_NotApprovedForMarketPlace()`)
              })

              it("check if the listItem is getting updated as new item is added", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listItem = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)
                  assert(listItem.price.toString() == PRICE.toString())
                  assert(listItem.seller.toString() == deployer.address)
              })
          })

          describe("buy Item", () => {
              it("try to buy item not on the list", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketPlace.buyItem(ethers.constants.AddressZero, TOKEN_ID)
                  ).to.be.revertedWith(
                      `NftMarketPlace_NotListed("${ethers.constants.AddressZero}", ${TOKEN_ID})`
                  )
              })

              it("if price is not met", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketPlace.buyItem(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(
                      `NftMarketPlace_PriceNotMet("${basicNft.address}", ${TOKEN_ID}, 0)`
                  )
              })

              it("buying NFT", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const nftMarketPlaceContract = await ethers.getContract("NftMarketPlace", user)
                  expect(
                      await nftMarketPlaceContract.buyItem(basicNft.address, TOKEN_ID, {
                          value: PRICE,
                      })
                  ).to.emit(`ItemBrought`)
                  const newOwnerForNft = await basicNft.ownerOf(TOKEN_ID)
                  const sellerProceeds = await nftMarketPlace.getProceeds(deployer.address)
                  assert(newOwnerForNft.toString() == user.address)
                  assert(sellerProceeds.toString() == PRICE.toString())
              })
          })

          describe("Update Item", () => {
              it("try to update item not in list", async () => {
                  const expectedNewPrice = ethers.utils.parseEther("0.2")
                  await expect(
                      nftMarketPlace.updateListing(basicNft.address, TOKEN_ID, expectedNewPrice)
                  ).to.revertedWith(`NftMarketPlace_NotListed("${basicNft.address}", ${TOKEN_ID})`)
              })
              it("nft only updated by their owner", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const nftContract = await ethers.getContract("NftMarketPlace", user)
                  const error = `NftMarketPlace_NotOwner()`
                  await expect(
                      nftContract.updateListing(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error)
              })
              it("item got updated properly", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const expectedNewPrice = ethers.utils.parseEther("0.2")
                  expect(
                      await nftMarketPlace.updateListing(
                          basicNft.address,
                          TOKEN_ID,
                          expectedNewPrice
                      )
                  ).to.emit("ItemListed")
                  const item = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)
                  assert(expectedNewPrice.toString() == item.price.toString())
              })
          })

          describe("cancel Item", () => {
              it("if item the not in the list", async () => {
                  const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                  await expect(
                      nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error)
              })
              it("reverts if anyone but the owner tries to call", async function () {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const nftMarketPlaceContract = await ethers.getContract("NftMarketPlace", user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketPlaceContract.cancelListing(basicNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotOwner")
              })
              it("emits event and removes listing", async function () {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  expect(await nftMarketPlace.cancelListing(basicNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  )
                  const listing = await nftMarketPlace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == "0")
              })
          })

          describe("WithdrawProceeds", () => {
              it("no withdraw if amount is zero", async () => {
                  await expect(nftMarketPlace.withDrawProceeds()).to.be.revertedWith(
                      "NftMarketPlace_NoProceeds()"
                  )
              })
              it("withdraw success", async () => {
                  await nftMarketPlace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const nftMarketPlaceUser = await ethers.getContract("NftMarketPlace", user)
                  await nftMarketPlaceUser.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })

                  const deployerProceedsBefore = await nftMarketPlace.getProceeds(deployer.address)
                  const deployerBalanceBefore = await deployer.getBalance()
                  const txResponse = await nftMarketPlace.withDrawProceeds()
                  const txResponseRecipt = await txResponse.wait(1)
                  const { gasUsed, effectiveGasPrice } = txResponseRecipt
                  const gasCost = gasUsed.mul(effectiveGasPrice)
                  const deployerBalanceAfter = await deployer.getBalance()

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  )
              })
          })
      })
