// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces.sol";

/**
 * @title ROSCAGroup
 * @dev Individual ROSCA group contract with enhanced tracking
 */
contract ROSCAGroup is ReentrancyGuard, IROSCAGroup {
    // Group configuration
    address public immutable override creator;
    uint256 public immutable override contributionAmount;
    uint256 public immutable override cycleDuration;
    uint8 public immutable override maxParticipants;
    uint256 public immutable override groupId;
    address public immutable factory;

    // Group state
    bool public override isActive;
    uint256 public override currentCycle;
    uint256 public cycleStartTime;
    uint8 public payoutIndex;
    uint8 public participantCount;

    // Participants tracking
    address[] public participants;
    mapping(address => bool) public isEnrolled;
    mapping(address => bool) public hasContributedThisCycle;
    mapping(address => uint256) public totalContributions;
    mapping(address => bool) public hasReceivedPayout;

    // Cycle tracking
    uint256 public contributionsThisCycle;

    PayoutRecord[] public payoutHistory;

    // Events
    event MemberEnrolled(address indexed groupAddr, address indexed member);
    event ContributionMade(
        address indexed groupAddr,
        address indexed member,
        uint256 cycle,
        uint256 amount
    );
    event CyclePayout(
        address indexed groupAddr,
        address indexed recipient,
        uint256 amount,
        uint256 cycle
    );
    event GroupCompleted(address indexed groupAddr);

    modifier onlyCreator() {
        require(msg.sender == creator, "Only creator can call this");
        _;
    }

    modifier onlyActive() {
        require(isActive, "Group is not active");
        _;
    }

    modifier onlyEnrolled() {
        require(isEnrolled[msg.sender], "Not enrolled in group");
        _;
    }

    /**
     * @dev Constructor for ROSCA group
     */
    constructor(
        address _creator,
        uint256 _contributionAmount,
        uint256 _cycleDuration,
        uint8 _maxParticipants,
        uint256 _groupId
    ) payable {
        creator = _creator;
        contributionAmount = _contributionAmount;
        cycleDuration = _cycleDuration;
        maxParticipants = _maxParticipants;
        groupId = _groupId;
        factory = msg.sender;
        isActive = true;
        currentCycle = 1;
        payoutIndex = 0;

        // Add creator as first participant
        participants.push(_creator);
        isEnrolled[_creator] = true;
        participantCount = 1;

        // Start first cycle
        cycleStartTime = block.timestamp;

        // If initial contribution provided, count it
        if (msg.value > 0) {
            require(
                msg.value == _contributionAmount,
                "Initial contribution must match contribution amount"
            );
            hasContributedThisCycle[_creator] = true;
            totalContributions[_creator] = 1;
            contributionsThisCycle = 1;
            emit ContributionMade(
                address(this),
                _creator,
                currentCycle,
                msg.value
            );
        }

        emit MemberEnrolled(address(this), _creator);
    }

    /**
     * @dev Join group (can only be called by factory)
     */
    function joinGroup() external payable override onlyActive {
        require(msg.sender == factory, "Only factory can add members");
        require(participantCount < maxParticipants, "Group is full");
        require(
            msg.value == contributionAmount,
            "Incorrect contribution amount"
        );

        // Get the actual participant from tx.origin (the user who called factory)
        address participant = tx.origin;
        require(!isEnrolled[participant], "Already enrolled");

        // Register member
        participants.push(participant);
        isEnrolled[participant] = true;
        participantCount++;

        // Count this as a contribution for the current cycle
        hasContributedThisCycle[participant] = true;
        totalContributions[participant] = 1;
        contributionsThisCycle++;

        emit MemberEnrolled(address(this), participant);
        emit ContributionMade(
            address(this),
            participant,
            currentCycle,
            msg.value
        );

        // Try to end cycle if conditions are met
        _tryEndCycle();
    }

    /**
     * @dev Make a contribution for the current cycle
     */
    function contribute()
        external
        payable
        onlyActive
        onlyEnrolled
        nonReentrant
    {
        require(currentCycle > 0, "No active cycle");
        require(
            !hasContributedThisCycle[msg.sender],
            "Already contributed this cycle"
        );
        require(
            msg.value == contributionAmount,
            "Incorrect contribution amount"
        );

        hasContributedThisCycle[msg.sender] = true;
        totalContributions[msg.sender]++;
        contributionsThisCycle++;

        emit ContributionMade(
            address(this),
            msg.sender,
            currentCycle,
            msg.value
        );

        // Try to end cycle if all contributions are in
        _tryEndCycle();
    }

    /**
     * @dev End cycle if due
     */
    function endCycleIfDue() external onlyActive nonReentrant {
        _tryEndCycle();
    }

    /**
     * @dev Internal function to try ending the current cycle
     */
    function _tryEndCycle() internal {
        if (currentCycle == 0 || payoutIndex >= participantCount) {
            return;
        }

        bool allContributed = contributionsThisCycle == participantCount;
        bool timeoutReached = block.timestamp >= cycleStartTime + cycleDuration;

        if (allContributed || timeoutReached) {
            _processPayout();
        }
    }

    /**
     * @dev Process payout for current cycle
     */
    function _processPayout() internal {
        require(payoutIndex < participantCount, "No more payouts");

        uint256 pot = address(this).balance;
        address recipient = participants[payoutIndex];

        // Record payout
        payoutHistory.push(
            PayoutRecord({
                recipient: recipient,
                amount: pot,
                timestamp: block.timestamp,
                cycle: currentCycle
            })
        );

        hasReceivedPayout[recipient] = true;

        // Send payout
        (bool success, ) = recipient.call{value: pot}("");
        require(success, "Payout failed");

        emit CyclePayout(address(this), recipient, pot, currentCycle);

        // Update state for next cycle
        payoutIndex++;

        // Check if group is complete
        if (payoutIndex >= participantCount) {
            isActive = false;
            IROSCAFactory(factory).updateGroupStatus(groupId, false);
            emit GroupCompleted(address(this));
        } else {
            // Start next cycle
            currentCycle++;
            cycleStartTime = block.timestamp;
            contributionsThisCycle = 0;

            // Reset contribution tracking
            for (uint8 i = 0; i < participantCount; i++) {
                hasContributedThisCycle[participants[i]] = false;
            }
        }
    }
    // Add this function to your ROSCAGroup contract
    function updateGroupStatus(
        uint256 groupId,
        bool isActive
    ) external override {
        // This function doesn't need to do anything since the ROSCAGroup contract
        // doesn't need to call this function on itself. The function exists in the interface
        // because it's called on the factory contract.
        // We can add a revert to prevent it from being called
        revert("Function not used in ROSCAGroup");
    }

    /**
     * @dev Get detailed group information
     */
    function getGroupInfo()
        external
        view
        override
        returns (
            address _creator,
            uint256 _contributionAmount,
            uint256 _cycleDuration,
            uint8 _maxParticipants,
            bool _isActive,
            uint256 _currentCycle,
            uint8 _payoutIndex,
            uint8 _participantCount,
            uint256 _balance,
            uint256 _contributionsThisCycle
        )
    {
        return (
            creator,
            contributionAmount,
            cycleDuration,
            maxParticipants,
            isActive,
            currentCycle,
            payoutIndex,
            participantCount,
            address(this).balance,
            contributionsThisCycle
        );
    }

    /**
     * @dev Get all participants
     */
    function getParticipants()
        external
        view
        override
        returns (address[] memory)
    {
        return participants;
    }

    /**
     * @dev Get payout history
     */
    function getPayoutHistory()
        external
        view
        override
        returns (PayoutRecord[] memory)
    {
        return payoutHistory;
    }

    /**
     * @dev Get current cycle information
     */
    function getCurrentCycleInfo()
        external
        view
        override
        returns (
            uint256 _currentCycle,
            uint256 _cycleStartTime,
            uint256 _cycleEndTime,
            uint256 _contributionsThisCycle,
            address _nextRecipient,
            uint256 _timeRemaining
        )
    {
        uint256 timeRemaining = 0;
        if (isActive && cycleStartTime + cycleDuration > block.timestamp) {
            timeRemaining = cycleStartTime + cycleDuration - block.timestamp;
        }

        return (
            currentCycle,
            cycleStartTime,
            cycleStartTime + cycleDuration,
            contributionsThisCycle,
            payoutIndex < participantCount
                ? participants[payoutIndex]
                : address(0),
            timeRemaining
        );
    }

    /**
     * @dev Get user's participation status
     */
    function getUserStatus(
        address user
    )
        external
        view
        override
        returns (
            bool _isEnrolled,
            bool _hasContributedThisCycle,
            uint256 _totalContributions,
            bool _hasReceivedPayout
        )
    {
        return (
            isEnrolled[user],
            hasContributedThisCycle[user],
            totalContributions[user],
            hasReceivedPayout[user]
        );
    }

    /**
     * @dev Emergency function to allow creator to deactivate group
     */
    function emergencyDeactivate() external onlyCreator {
        require(address(this).balance == 0, "Cannot deactivate with funds");
        isActive = false;
        IROSCAFactory(factory).updateGroupStatus(groupId, false);
    }

    /**
     * @dev Allow contract to receive Ether
     */
    receive() external payable {}
}
