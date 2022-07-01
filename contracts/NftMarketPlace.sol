// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

error NftMarketPlace_PriceMustBeAboveZero();
error NftMarketPlace_NotApprovedForMarketPlace();
error NftMarketPlace_AlreadyListed(address nftAddress, uint256 tokenId);
error NftMarketPlace_NotOwner();
error NftMarketPlace_NotListed(address nftAddress, uint256 tokenId);
error NftMarketPlace_PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);
error NftMarketPlace_NoProceeds();
error NftMarketPlace_TransferFailed();

contract NftMarketPlace is ReentrancyGuard {
    //////////////////////
    //    TYPE DEF     //
    /////////////////////

    struct Listing {
        uint256 price;
        address seller;
    }

    //////////////////////
    //     EVENTS      //
    /////////////////////

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );
    event ItemCanceled(
        address indexed sellet,
        address indexed nftAddress,
        uint256 indexed tokenId
    );

    //////////////////////
    //     MAPPING      //
    /////////////////////

    //contract address -> nft token -> listing
    mapping(address => mapping(uint256 => Listing)) s_listings;

    //to track how much earned by selling nft
    //seller address => amount
    mapping(address => uint256) s_proceeds;

    //////////////////////
    //    MODIFIER     //
    /////////////////////

    //check if the token already exist or not
    modifier notListed(
        address nftAddress,
        uint256 tokenId,
        address owner
    ) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price > 0) revert NftMarketPlace_AlreadyListed(nftAddress, tokenId);
        _;
    }

    //only the nft he own can be listed
    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address sender
    ) {
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if (sender != owner) {
            revert NftMarketPlace_NotOwner();
        }
        _;
    }

    //to check if item is in the list of nft
    modifier isListed(address nftAddress, uint256 tokenId) {
        Listing memory listing = s_listings[nftAddress][tokenId];
        if (listing.price <= 0) revert NftMarketPlace_NotListed(nftAddress, tokenId);
        _;
    }

    //////////////////////
    //  Main Function   //
    /////////////////////

    /*
     * @notice Method for listing NFT
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param price sale price for each item
     */
    function listItem(
        address nftAddress,
        uint256 tokenId,
        uint256 price
    )
        external
        notListed(nftAddress, tokenId, msg.sender)
        isOwner(nftAddress, tokenId, msg.sender)
    {
        if (price <= 0) {
            revert NftMarketPlace_PriceMustBeAboveZero();
        }
        /**
            Owner can still hold their NFT, and give the marketplace approval
            to sell the NFT for them
         */

        IERC721 nft = IERC721(nftAddress);
        if (nft.getApproved(tokenId) != address(this)) {
            revert NftMarketPlace_NotApprovedForMarketPlace();
        }
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    /*
     * @notice Method for buying listing
     * @notice The owner of an NFT could unapprove the marketplace,
     * which would cause this function to fail
     * Ideally you'd also have a `createOffer` functionality.
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     */
    function buyItem(address nftAddress, uint256 tokenId)
        external
        payable
        nonReentrant //for preventing reentrant attack
        isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];
        if (msg.value < listedItem.price) {
            revert NftMarketPlace_PriceNotMet(nftAddress, tokenId, msg.value);
        }

        //storing the amount earned by each sell and they can withdraw later
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value;

        //deleting the nft from list after brought by someone
        delete (s_listings[nftAddress][tokenId]);

        //transfer the Nft given by the buyer to seller
        // args-> seller address, buyer address, tokenId
        //for preventing reentrance attack always call external contract function in the end of our function
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);

        //check to make sure the transfer happened
        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }

    /*
     * @notice Method for cancelling listing
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     */
    function cancelListing(address nftAddress, uint256 tokenId)
        external
        isOwner(nftAddress, tokenId, msg.sender)
        isListed(nftAddress, tokenId)
    {
        //deleting the nft in list
        delete (s_listings[nftAddress][tokenId]);
        emit ItemCanceled(msg.sender, nftAddress, tokenId);
    }

    /*
     * @notice Method for updating listing
     * @param nftAddress Address of NFT contract
     * @param tokenId Token ID of NFT
     * @param newPrice Price in Wei of the item
     */
    function updateListing(
        address nftAddress,
        uint256 tokenId,
        uint256 newPrice
    ) external isOwner(nftAddress, tokenId, msg.sender) isListed(nftAddress, tokenId) {
        //updaing the price
        s_listings[nftAddress][tokenId].price = newPrice;
        emit ItemListed(msg.sender, nftAddress, tokenId, newPrice);
    }

    /*
     * @notice Method for withdrawing proceeds from sales
     */
    function withDrawProceeds() external {
        uint256 proceeds = s_proceeds[msg.sender];
        if (proceeds <= 0) {
            revert NftMarketPlace_NoProceeds();
        }
        s_proceeds[msg.sender] = 0;
        (bool success, ) = payable(msg.sender).call{value: proceeds}("");
        if (!success) {
            revert NftMarketPlace_TransferFailed();
        }
    }

    //////////////////////
    // GETTERS/SETTERS //
    /////////////////////

    function getListing(address nftAddress, uint256 tokenId)
        external
        view
        returns (Listing memory)
    {
        return s_listings[nftAddress][tokenId];
    }

    function getProceeds(address seller) external view returns (uint256) {
        return s_proceeds[seller];
    }
}
