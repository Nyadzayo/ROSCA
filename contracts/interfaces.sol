// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IROSCAGroup {
    struct PayoutRecord {
        address recipient;
        uint256 amount;
        uint256 timestamp;
        uint256 cycle;
    }

    function creator() external view returns (address);
    function contributionAmount() external view returns (uint256);
    function cycleDuration() external view returns (uint256);
    function maxParticipants() external view returns (uint8);
    function groupId() external view returns (uint256);
    function isActive() external view returns (bool);
    function currentCycle() external view returns (uint256);

    function joinGroup() external payable;
    function getGroupInfo()
        external
        view
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
        );
    function getParticipants() external view returns (address[] memory);
    function getPayoutHistory() external view returns (PayoutRecord[] memory);
    function getCurrentCycleInfo()
        external
        view
        returns (
            uint256 _currentCycle,
            uint256 _cycleStartTime,
            uint256 _cycleEndTime,
            uint256 _contributionsThisCycle,
            address _nextRecipient,
            uint256 _timeRemaining
        );
    function getUserStatus(
        address user
    )
        external
        view
        returns (
            bool _isEnrolled,
            bool _hasContributedThisCycle,
            uint256 _totalContributions,
            bool _hasReceivedPayout
        );
    function updateGroupStatus(uint256 groupId, bool isActive) external;
}

interface IROSCAFactory {
    struct GroupMetadata {
        address groupAddress;
        address creator;
        uint256 contributionAmount;
        uint256 cycleDuration;
        uint8 maxParticipants;
        uint8 currentParticipants;
        bool isActive;
        string name;
        string description;
        uint256 createdAt;
    }

    function updateGroupStatus(uint256 groupId, bool isActive) external;
}
