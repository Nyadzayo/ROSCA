// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./interfaces.sol";
import "./ROSCAGroup.sol";

contract ROSCAFactory {
    uint256 public groupCounter;
    mapping(uint256 => address) public groups;
    mapping(address => uint256[]) public creatorGroups;
    mapping(address => uint256[]) public participantGroups;

    // Group metadata for discovery
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

    mapping(uint256 => GroupMetadata) public groupMetadata;
    uint256[] public activeGroups;

    event GroupCreated(
        uint256 indexed groupId,
        address indexed groupAddr,
        address indexed creator,
        string name
    );

    event GroupJoined(uint256 indexed groupId, address indexed participant);

    function createGroup(
        uint256 amount,
        uint256 duration,
        uint8 maxParticipants,
        string memory name,
        string memory description
    ) external payable returns (address) {
        require(amount > 0, "Amount must be greater than 0");
        require(duration > 0, "Duration must be greater than 0");
        require(maxParticipants > 1, "Must have at least 2 participants");
        require(maxParticipants <= 50, "Too many participants");
        require(bytes(name).length > 0, "Name cannot be empty");

        groupCounter++;

        // Deploy new group with payable constructor
        ROSCAGroup newGroup = new ROSCAGroup{value: msg.value}(
            msg.sender,
            amount,
            duration,
            maxParticipants,
            groupCounter
        );

        address groupAddr = address(newGroup);
        groups[groupCounter] = groupAddr;
        creatorGroups[msg.sender].push(groupCounter);
        participantGroups[msg.sender].push(groupCounter);

        // Store metadata
        groupMetadata[groupCounter] = GroupMetadata({
            groupAddress: groupAddr,
            creator: msg.sender,
            contributionAmount: amount,
            cycleDuration: duration,
            maxParticipants: maxParticipants,
            currentParticipants: 1,
            isActive: true,
            name: name,
            description: description,
            createdAt: block.timestamp
        });

        activeGroups.push(groupCounter);

        emit GroupCreated(groupCounter, groupAddr, msg.sender, name);

        return groupAddr;
    }

    function joinGroup(uint256 groupId) external payable {
        require(groupId > 0 && groupId <= groupCounter, "Invalid group ID");
        require(groups[groupId] != address(0), "Group does not exist");

        IROSCAGroup group = IROSCAGroup(payable(groups[groupId]));

        // Check if user is already in this group
        bool alreadyMember = false;
        uint256[] memory userGroups = participantGroups[msg.sender];
        for (uint256 i = 0; i < userGroups.length; i++) {
            if (userGroups[i] == groupId) {
                alreadyMember = true;
                break;
            }
        }
        require(!alreadyMember, "Already a member of this group");

        // Join the group
        group.joinGroup{value: msg.value}();

        // Update participant tracking
        participantGroups[msg.sender].push(groupId);
        groupMetadata[groupId].currentParticipants++;

        emit GroupJoined(groupId, msg.sender);
    }

    /**
     * @dev Get all active groups with pagination
     */
    function getActiveGroups(
        uint256 offset,
        uint256 limit
    ) external view returns (GroupMetadata[] memory) {
        require(offset < activeGroups.length, "Offset out of bounds");

        uint256 end = offset + limit;
        if (end > activeGroups.length) {
            end = activeGroups.length;
        }

        GroupMetadata[] memory result = new GroupMetadata[](end - offset);
        uint256 resultIndex = 0;

        for (uint256 i = offset; i < end; i++) {
            uint256 groupId = activeGroups[i];
            if (groupMetadata[groupId].isActive) {
                result[resultIndex] = groupMetadata[groupId];
                resultIndex++;
            }
        }

        // Resize array to remove empty slots
        if (resultIndex < result.length) {
            GroupMetadata[] memory finalResult = new GroupMetadata[](
                resultIndex
            );
            for (uint256 i = 0; i < resultIndex; i++) {
                finalResult[i] = result[i];
            }
            return finalResult;
        }

        return result;
    }

    /**
     * @dev Get groups for a specific participant
     */
    function getParticipantGroups(
        address participant
    ) external view returns (uint256[] memory) {
        return participantGroups[participant];
    }

    /**
     * @dev Get groups created by a specific creator
     */
    function getCreatorGroups(
        address creator
    ) external view returns (uint256[] memory) {
        return creatorGroups[creator];
    }

    /**
     * @dev Get group metadata by ID
     */
    function getGroupMetadata(
        uint256 groupId
    ) external view returns (GroupMetadata memory) {
        return groupMetadata[groupId];
    }

    /**
     * @dev Get group address by ID
     */
    function getGroupAddress(uint256 groupId) external view returns (address) {
        return groups[groupId];
    }

    /**
     * @dev Update group status (called by group contract)
     */
    function updateGroupStatus(uint256 groupId, bool isActive) external {
        require(
            groups[groupId] == msg.sender,
            "Only group contract can update"
        );
        groupMetadata[groupId].isActive = isActive;
    }
}
