const { network } = require("hardhat")

//waits the time for given time
function sleep(timeInMs) {
    return new Promise((resolve) => setTimeout(resolve, timeInMs))
}

//moving the block to make it confirm
/**
 *
 * @param {*} amount //no of block
 * @param {*} sleepAmount  //sleep for each block
 */
async function moveBlocks(amount, sleepAmount = 0) {
    console.log("Moving blocks...")
    for (let index = 0; index < amount; index++) {
        await network.provider.request({
            method: "evm_mine",
            params: [],
        })
        if (sleepAmount) {
            console.log(`Sleeping for ${sleepAmount}`)
            await sleep(sleepAmount)
        }
    }
    console.log(`Moved ${amount} blocks`)
}

module.exports = {
    moveBlocks,
    sleep,
}
