// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title AnalysisReceiptLog
/// @notice Stores compact, verifiable receipts for market-agent decisions.
contract AnalysisReceiptLog {
    uint16 public constant SCHEMA_VERSION = 1;
    uint16 public constant MAX_BPS = 10_000;

    struct Receipt {
        address agent;
        bytes32 marketIdHash;
        bytes32 sourceHash;
        bytes32 runHash;
        uint16 marketProbabilityBps;
        uint16 agentProbabilityBps;
        int16 edgeBps;
        uint16 confidenceBps;
        uint8 decision;
        uint8 riskLevel;
        uint64 createdAt;
    }

    uint256 public nextReceiptId;
    mapping(uint256 receiptId => Receipt receipt) public receipts;

    event ReceiptRecorded(
        uint256 indexed receiptId,
        address indexed agent,
        bytes32 indexed marketIdHash,
        bytes32 sourceHash,
        bytes32 runHash,
        uint16 marketProbabilityBps,
        uint16 agentProbabilityBps,
        int16 edgeBps,
        uint16 confidenceBps,
        uint8 decision,
        uint8 riskLevel
    );

    error InvalidBps();
    error InvalidDecision();
    error InvalidRiskLevel();
    error ReceiptNotFound();

    function recordReceipt(
        bytes32 marketIdHash,
        bytes32 sourceHash,
        bytes32 runHash,
        uint16 marketProbabilityBps,
        uint16 agentProbabilityBps,
        uint16 confidenceBps,
        uint8 decision,
        uint8 riskLevel
    ) external returns (uint256 receiptId) {
        if (
            marketProbabilityBps > MAX_BPS || agentProbabilityBps > MAX_BPS
                || confidenceBps > MAX_BPS
        ) revert InvalidBps();
        if (decision > 5) revert InvalidDecision();
        if (riskLevel > 3) revert InvalidRiskLevel();

        int16 edgeBps = int16(int256(uint256(agentProbabilityBps)) - int256(uint256(marketProbabilityBps)));
        receiptId = nextReceiptId++;

        receipts[receiptId] = Receipt({
            agent: msg.sender,
            marketIdHash: marketIdHash,
            sourceHash: sourceHash,
            runHash: runHash,
            marketProbabilityBps: marketProbabilityBps,
            agentProbabilityBps: agentProbabilityBps,
            edgeBps: edgeBps,
            confidenceBps: confidenceBps,
            decision: decision,
            riskLevel: riskLevel,
            createdAt: uint64(block.timestamp)
        });

        emit ReceiptRecorded(
            receiptId,
            msg.sender,
            marketIdHash,
            sourceHash,
            runHash,
            marketProbabilityBps,
            agentProbabilityBps,
            edgeBps,
            confidenceBps,
            decision,
            riskLevel
        );
    }

    function getReceipt(uint256 receiptId) external view returns (Receipt memory receipt) {
        if (receiptId >= nextReceiptId) revert ReceiptNotFound();
        return receipts[receiptId];
    }
}
