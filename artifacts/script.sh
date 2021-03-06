#!/bin/bash
# Copyright London Stock Exchange Group All Rights Reserved.
#
# SPDX-License-Identifier: Apache-2.0
set -e
# This script expedites the chaincode development process by automating the
# requisite channel create/join commands

# We use a pre-generated orderer.block and channel transaction artifact (myc.tx),
# both of which are created using the configtxgen tool

sleep 10s

# first we create the channel against the specified configuration in myc.tx
# this call returns a channel configuration block - myc.block - to the CLI container
CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/zhigui.com/users/admin@zhigui/msp peer channel create -c mychannel -f mychannel.tx -o orderer:7050

# now we will join the channel and start the chain with myc.block serving as the
# channel's first block (i.e. the genesis block)
CORE_PEER_MSPCONFIGPATH=/etc/hyperledger/ca-clients/zhigui.com/users/admin@zhigui/msp peer channel join -b mychannel.block

# Now the user can proceed to build and start chaincode in one terminal
# And leverage the CLI container to issue install instantiate invoke query commands in another

#we should have bailed if above commands failed.
#we are here, so they worked
sleep 600000
exit 0
