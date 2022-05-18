//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Stake {
    using SafeMath for uint;
    using SafeMath for uint256;
    address owner;
    mapping(address => mapping(uint256 =>struct_stake)) stakes;
    mapping(address => uint256) stakeCounts;
    mapping(address => uint256) perStaked;
    uint256 public totalStaked = 0;
    uint256 public totalReward = 0;
    struct struct_stake{
        uint256 amount;
        uint256 rewardAmount;
        uint withdrawableTimeStamp;
        bool withdrawed;
        bool originalWithdrawed;
    }
    uint256 secondsInDay = 1;
    // uint256 secondsInWeek = 604800;
    uint256 secondsInWeek = 5;

    constructor() {
        owner = msg.sender;
    }

    function stake(uint256 _days) payable public{
        require(_days >= 7 , "deposit days should be greater than 7 days");
        require(_days <=21, "Maximum stake period is 21 days");
        if(msg.value > 0){
            uint256 _reward = 0;
            if(_days < 14){
                _reward = _reward.add(_days.mul(62));
            }else if(_days <21){
                _reward = _reward.add(_days.mul(74));

            }else{
                 _reward = _reward.add(_days.mul(93));
 
            }
            _reward = _reward.mul(msg.value).div(1000);
            stakes[msg.sender][stakeCounts[msg.sender]] = struct_stake(
                msg.value,
                _reward,
                block.timestamp + secondsInDay*_days,
                false,
                false
            );
            stakeCounts[msg.sender]++;     
            perStaked[msg.sender] += msg.value;
            totalStaked += msg.value;       
        }
    }

    function getStaked(address user) public view returns(uint256){
        uint256 _amount = 0;
        for(uint256 i =0;i < stakeCounts[user]; i++){
            _amount += stakes[user][i].amount;
        }
        return _amount;
    }

    function getProfitAmount(address user) public view returns(uint256){
        uint256 _profits = 0;
        for(uint256 i =0;i < stakeCounts[user]; i++){
            if(stakes[user][i].withdrawed) continue;
            if(stakes[user][i].withdrawableTimeStamp > block.timestamp) continue;
            _profits = stakes[user][i].rewardAmount.add(_profits);
        }
     
        return _profits;
    }

    function getProfitAmountTotal(address user) public view returns(uint256){
        uint256 _profits = 0;
        for(uint256 i =0;i < stakeCounts[user]; i++){
            if(stakes[user][i].withdrawed) continue;
            if(stakes[user][i].withdrawableTimeStamp > block.timestamp) continue;
            _profits = stakes[user][i].rewardAmount.add(stakes[user][i].amount).add(_profits) ;
        }
     
        return _profits;
    }

    function withdrawProfit() public payable{
        uint256 _profit = getProfitAmount(msg.sender);
        require(address(this).balance >= _profit, "Can't transfer now");     
        for(uint256 i =0;i < stakeCounts[msg.sender]; i++){
            if(!stakes[msg.sender][i].withdrawed){
                perStaked[msg.sender] = perStaked[msg.sender].sub(stakes[msg.sender][i].amount);
                totalStaked = totalStaked.sub(stakes[msg.sender][i].amount);
                stakes[msg.sender][i].withdrawed = true;
            }            
        }
        (bool os, ) = payable(msg.sender).call{value: _profit}("");
        require(os);
    }

    function getPerReward(address user) public view returns (uint256){
        return getProfitAmount(user);
    }

    function getPerRewardTotal(address user) public view returns (uint256){
        return getProfitAmountTotal(user);
    }

    function getPerStaked(address user) public view returns (uint256){
        return perStaked[user];
    }
}