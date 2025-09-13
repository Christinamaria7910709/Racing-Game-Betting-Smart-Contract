# Racing Game Betting Smart Contract

A comprehensive Clarity smart contract for virtual racing with real-time betting mechanics on the Stacks blockchain. Experience the thrill of horse racing, car racing, or any competitive racing format with dynamic odds and multiple bet types.

## 🏁 Overview

The Racing Game Betting contract creates a fully-featured betting platform where users can:
- **Bet on virtual races** with up to 8 competitors
- **Enjoy dynamic odds** that change based on betting volume
- **Choose multiple bet types** (Win, Place, Show)
- **Experience fair payouts** with transparent house edge
- **Manage funds securely** through STX deposits/withdrawals

## ⚡ Key Features

### 🎮 Virtual Racing System
- Support for up to 8 racers per event
- Customizable race duration and names
- Real-time race status tracking
- Automated result processing

### 💰 Advanced Betting Mechanics
- **Win Bets**: Highest payout, racer must finish 1st
- **Place Bets**: Medium payout, racer finishes 1st or 2nd
- **Show Bets**: Lower payout, racer finishes 1st, 2nd, or 3rd
- Dynamic odds adjustment based on betting volume
- Configurable bet limits and house edge

### 🔒 Secure Fund Management
- STX-based deposit/withdrawal system
- Protected user balances
- Automatic payout distribution
- House fund management for operators

## 🏗️ Contract Architecture

### Core Data Structures

```clarity
;; Race Structure
{
  name: string-ascii 50,
  racers: list of 8 racers,
  start-time: uint,
  end-time: uint,
  status: "open" | "running" | "finished" | "cancelled",
  winner: uint,
  total-pool: uint,
  house-take: uint
}

;; Bet Structure
{
  race-id: uint,
  bettor: principal,
  racer-index: uint,
  amount: uint,
  potential-payout: uint,
  claimed: bool,
  bet-type: "win" | "place" | "show"
}
```

### Betting Mechanics

| Bet Type | Payout Condition | Payout Amount |
|----------|------------------|---------------|
| **Win** | Racer finishes 1st | Full odds payout |
| **Place** | Racer finishes 1st-2nd | Half odds payout |
| **Show** | Racer finishes 1st-3rd | Third odds payout |

### Default Configuration
- **House Edge**: 2.5%
- **Minimum Bet**: 100 microSTX
- **Maximum Bet**: 100,000 microSTX
- **Max Bets per User per Race**: 20
- **Default Starting Odds**: 2.0x

## 📋 Usage Guide

### For Bettors

#### 1. Deposit Funds
```clarity
(deposit-funds u10000)  ;; Deposit 10,000 microSTX
```

#### 2. Check Available Races
```clarity
(get-race u1)  ;; Get details for race ID 1
```

#### 3. View Current Odds
```clarity
(get-current-odds u1 u0)  ;; Get odds for racer 0 in race 1
```

#### 4. Place Your Bets
```clarity
;; Win bet on racer 2 for 1,000 microSTX
(place-bet u1 u2 u1000 "win")

;; Place bet on racer 0 for 500 microSTX  
(place-bet u1 u0 u500 "place")

;; Show bet on racer 4 for 300 microSTX
(place-bet u1 u4 u300 "show")
```

#### 5. Track Your Bets
```clarity
(get-user-bets tx-sender u1)  ;; Get all your bets for race 1
(get-bet u1)  ;; Get specific bet details
```

#### 6. Claim Winnings
```clarity
(claim-winnings u1)  ;; Claim winnings for bet ID 1
```

#### 7. Withdraw Funds
```clarity
(withdraw-funds u5000)  ;; Withdraw 5,000 microSTX
```

### For Race Operators

#### 1. Create a Race
```clarity
(create-race 
  "Kentucky Derby 2025"
  (list "Thunder Bolt" "Lightning Strike" "Storm Chaser" "Wind Runner")
  u144  ;; Race duration (~24 hours)
)
```

#### 2. Start the Race
```clarity
(start-race u1)  ;; Begin race ID 1
```

#### 3. Submit Race Results
```clarity
;; Final positions: [winner, 2nd place, 3rd place, 4th place]
(finish-race u1 (list u2 u0 u3 u1))
```

#### 4. Manage Operations
```clarity
(set-house-edge u300)  ;; Set 3% house edge
(set-bet-limits u50 u200000)  ;; Set new bet limits
(cancel-race u1)  ;; Cancel a race if needed
```

## 🔍 Query Functions

### Race Information
```clarity
;; Get race details
(get-race race-id)

;; Get racer information
(get-racer race-id racer-index)

;; Get race results
(get-race-results race-id)

;; Get race leaderboard
(get-race-leaderboard race-id)
```

### Betting Information
```clarity
;; Get current odds for a racer
(get-current-odds race-id racer-index)

;; Get bet details
(get-bet bet-id)

;; Get user's bets for a race
(get-user-bets user-principal race-id)

;; Check user balance
(get-balance user-principal)
```

## 💡 Smart Betting Strategies

### Understanding Odds
- **Lower odds** = Higher probability, lower payout
- **Higher odds** = Lower probability, higher payout
- Odds adjust dynamically based on betting volume

### Bet Type Strategy
- **Win bets**: Highest risk/reward - only pays if your racer wins
- **Place bets**: Medium risk/reward - pays for top 2 finishers
- **Show bets**: Lowest risk/reward - pays for top 3 finishers

### Example Betting Scenarios

```clarity
;; Conservative Strategy - Multiple show bets
(place-bet u1 u0 u200 "show")  ;; Racer 0 to finish top 3
(place-bet u1 u1 u200 "show")  ;; Racer 1 to finish top 3  
(place-bet u1 u2 u200 "show")  ;; Racer 2 to finish top 3

;; Aggressive Strategy - High win bet on favorite
(place-bet u1 u3 u1500 "win")  ;; All-in on racer 3 to win

;; Balanced Strategy - Mixed bet types
(place-bet u1 u0 u500 "win")    ;; Win bet on favorite
(place-bet u1 u1 u300 "place")  ;; Place bet on second choice
(place-bet u1 u4 u200 "show")   ;; Show bet on longshot
```

## 🚨 Error Codes Reference

| Code | Constant | Description |
|------|----------|-------------|
| u100 | ERR-OWNER-ONLY | Function restricted to contract owner |
| u101 | ERR-NOT-FOUND | Requested item not found |
| u102 | ERR-RACE-NOT-FOUND | Race ID does not exist |
| u103 | ERR-RACE-ENDED | Race has already ended |
| u104 | ERR-RACE-NOT-ENDED | Race hasn't finished yet |
| u105 | ERR-INSUFFICIENT-FUNDS | Not enough funds for operation |
| u106 | ERR-UNAUTHORIZED | User not authorized for action |
| u107 | ERR-INVALID-BET | Bet parameters are invalid |
| u108 | ERR-RACE-ALREADY-STARTED | Race is no longer accepting bets |
| u109 | ERR-NO-BETS | No bets found for operation |
| u110 | ERR-INVALID-RACER | Racer index is invalid |
| u111 | ERR-ALREADY-CLAIMED | Winnings already claimed |

## 🔧 Deployment Guide

### Prerequisites
- Stacks blockchain access (testnet/mainnet)
- Clarinet CLI installed
- Sufficient STX for deployment

### Deployment Steps

1. **Clone and Setup**
```bash
git clone <repository>
cd racing-betting-contract
clarinet check  # Verify contract syntax
```

2. **Deploy to Testnet**
```bash
clarinet deploy --testnet
```

3. **Initial Configuration** (Contract Owner)
```clarity
;; Set operating parameters
(set-house-edge u250)  ;; 2.5% house edge
(set-bet-limits u100 u100000)  ;; Min/max bet amounts
```

4. **Create First Race**
```clarity
(create-race 
  "Launch Race"
  (list "Racer A" "Racer B" "Racer C" "Racer D")
  u72  ;; 12 hour duration
)
```

### Frontend Integration

```javascript
// Example using Stacks.js
import { openContractCall, uintCV, stringAsciiCV, listCV } from '@stacks/connect';

// Place a bet
const placeBet = async (raceId, racerIndex, amount, betType) => {
  await openContractCall({
    contractAddress: 'SP1234...',
    contractName: 'racing-betting',
    functionName: 'place-bet',
    functionArgs: [
      uintCV(raceId),
      uintCV(racerIndex), 
      uintCV(amount),
      stringAsciiCV(betType)
    ]
  });
};

// Check race status
const getRaceInfo = async (raceId) => {
  const response = await callReadOnlyFunction({
    contractAddress: 'SP1234...',
    contractName: 'racing-betting',
    functionName: 'get-race',
    functionArgs: [uintCV(raceId)]
  });
  return response;
};
```

## 🛡️ Security Features

### Access Controls
- **Owner-only functions** for race management
- **User authentication** for bet placement and claims
- **Balance validation** before allowing bets
- **Race state validation** to prevent invalid operations

### Financial Security
- **Automatic house edge** collection
- **Protected user balances** with withdrawal controls  
- **Overflow protection** in calculations
- **Double-claim prevention** for winnings

### Operational Security
- **Race status validation** prevents betting after start
- **Result immutability** once race is finished
- **Emergency cancellation** capability for operators

## 📈 Economics & Tokenomics

### Revenue Model
- **House Edge**: 2.5% of total betting pool
- **Configurable Rates**: Operators can adjust house edge (max 10%)
- **Sustainable Operation**: Ensures platform profitability

### Payout Structure
- **Win Bets**: Full odds-based payout
- **Place Bets**: 50% of win payout
- **Show Bets**: 33% of win payout
- **Dynamic Odds**: Adjust based on betting volume

### Example Economics
```
Race Pool: 10,000 STX
House Edge: 2.5% = 250 STX
Available for Payouts: 9,750 STX

Winner Bets on Champion: 2,000 STX
Odds: 4.875x (9,750 ÷ 2,000)
Total Payout to Winners: 9,750 STX
```

## 🎯 Advanced Features

### Real-Time Odds Calculation
The contract automatically adjusts odds based on betting volume:
- More bets on a racer = lower odds (higher probability assumed)
- Fewer bets on a racer = higher odds (lower probability assumed)
- Minimum odds floor prevents exploitation

### Multi-Bet Support
Users can place multiple bets per race:
- Different bet types on same racer
- Bets on multiple racers
- Strategic portfolio betting

### Historical Tracking
- Complete betting history per user
- Race result archives
- Performance analytics ready

## 🔮 Future Enhancements

### Potential Upgrades
- **Live Race Simulation**: Real-time race visualization
- **Advanced Bet Types**: Exacta, Trifecta, Superfecta
- **Tournament Modes**: Multi-race championships  
- **Social Features**: Leaderboards, achievements
- **NFT Integration**: Collectible racers and tickets
- **Oracle Integration**: External randomness for race outcomes
- **Mobile SDK**: Direct mobile app integration

### Scaling Considerations
- **Gas Optimization**: Batch operations for large races
- **State Management**: Efficient storage patterns
- **Performance**: Sub-second bet placement
- **Multi-Chain**: Cross-chain betting pools

## 🤝 Community & Support

### Getting Help
- Check error codes for troubleshooting
- Test thoroughly on Stacks testnet
- Review transaction logs for debugging
- Validate all inputs before contract calls

### Contributing
- Follow Clarity best practices
- Include comprehensive unit tests
- Document all modifications
- Consider gas optimization in changes

### Bug Reports
Please include:
- Contract function called
- Input parameters used
- Expected vs actual behavior
- Error messages received

## ⚖️ Legal & Compliance

### Important Notes
- **Gambling Regulations**: Check local laws before deployment
- **Age Restrictions**: Implement appropriate access controls
- **Responsible Gaming**: Consider betting limits and cool-downs
- **Tax Implications**: Users responsible for tax obligations

### Disclaimer
This smart contract is provided for educational and development purposes. Operators must ensure compliance with applicable gambling and financial regulations in their jurisdiction.

---

**Ready to start your virtual racing empire?** 🏁💰

Deploy the contract, create exciting races, and let the betting begin!

*Built with ❤️ on Stacks blockchain using Clarity smart contracts*==========