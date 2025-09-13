import { describe, expect, it, beforeEach } from "vitest";

// Mock contract interaction functions
const mockContractCall = (
  functionName: string,
  args: any[],
  sender?: string
) => {
  // This would normally interact with your Stacks contract
  // For testing purposes, we'll simulate the contract behavior
  return simulateContractFunction(functionName, args, sender);
};

const mockReadOnlyCall = (functionName: string, args: any[]) => {
  return simulateReadOnlyFunction(functionName, args);
};

// Contract state simulation for testing
let contractState = {
  races: new Map(),
  raceRacers: new Map(),
  bets: new Map(),
  userBets: new Map(),
  userBalances: new Map(),
  raceResults: new Map(),
  raceIdCounter: 0,
  betIdCounter: 0,
  houseEdge: 250, // 2.5%
  minBet: 100,
  maxBet: 100000,
  contractOwner: "ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE",
};

// Helper function to simulate contract functions
function simulateContractFunction(
  functionName: string,
  args: any[],
  sender: string = "ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE"
) {
  switch (functionName) {
    case "deposit-funds":
      return simulateDepositFunds(args[0], sender);
    case "withdraw-funds":
      return simulateWithdrawFunds(args[0], sender);
    case "create-race":
      return simulateCreateRace(args[0], args[1], args[2], sender);
    case "start-race":
      return simulateStartRace(args[0], sender);
    case "place-bet":
      return simulatePlaceBet(args[0], args[1], args[2], args[3], sender);
    case "finish-race":
      return simulateFinishRace(args[0], args[1], sender);
    case "claim-winnings":
      return simulateClaimWinnings(args[0], sender);
    case "set-house-edge":
      return simulateSetHouseEdge(args[0], sender);
    case "cancel-race":
      return simulateCancelRace(args[0], sender);
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

function simulateReadOnlyFunction(functionName: string, args: any[]) {
  switch (functionName) {
    case "get-balance":
      return {
        value: contractState.userBalances.get(args[0]) || 0,
        isOk: true,
      };
    case "get-race":
      return { value: contractState.races.get(args[0]) || null, isOk: true };
    case "get-racer":
      return {
        value: contractState.raceRacers.get(`${args[0]}-${args[1]}`) || null,
        isOk: true,
      };
    case "get-bet":
      return { value: contractState.bets.get(args[0]) || null, isOk: true };
    case "get-user-bets":
      return {
        value: contractState.userBets.get(`${args[0]}-${args[1]}`) || [],
        isOk: true,
      };
    case "get-current-odds":
      const racer = contractState.raceRacers.get(`${args[0]}-${args[1]}`);
      return { value: racer ? racer.odds : null, isOk: true };
    default:
      return { value: null, isOk: false };
  }
}

// Simulation helper functions
function simulateDepositFunds(amount: number, sender: string) {
  if (amount <= 0) return { isOk: false, error: 107 };

  const currentBalance = contractState.userBalances.get(sender) || 0;
  contractState.userBalances.set(sender, currentBalance + amount);
  return { value: amount, isOk: true };
}

function simulateWithdrawFunds(amount: number, sender: string) {
  const balance = contractState.userBalances.get(sender) || 0;
  if (balance < amount) return { isOk: false, error: 105 };

  contractState.userBalances.set(sender, balance - amount);
  return { value: amount, isOk: true };
}

function simulateCreateRace(
  name: string,
  racers: string[],
  durationBlocks: number,
  sender: string
) {
  if (sender !== contractState.contractOwner)
    return { isOk: false, error: 100 };
  if (racers.length < 2) return { isOk: false, error: 110 };

  const raceId = ++contractState.raceIdCounter;
  contractState.races.set(raceId, {
    name,
    racers,
    startTime: 1000, // Mock block height
    endTime: 1000 + durationBlocks,
    status: "open",
    winner: 999,
    totalPool: 0,
    houseTake: 0,
  });

  // Initialize racers
  racers.forEach((racerName, index) => {
    if (racerName) {
      contractState.raceRacers.set(`${raceId}-${index}`, {
        name: racerName,
        odds: 200, // 2.0x default odds
        totalBets: 0,
        position: 0,
      });
    }
  });

  return { value: raceId, isOk: true };
}

function simulateStartRace(raceId: number, sender: string) {
  if (sender !== contractState.contractOwner)
    return { isOk: false, error: 100 };

  const race = contractState.races.get(raceId);
  if (!race) return { isOk: false, error: 102 };
  if (race.status !== "open") return { isOk: false, error: 108 };

  race.status = "running";
  return { value: true, isOk: true };
}

function simulatePlaceBet(
  raceId: number,
  racerIndex: number,
  amount: number,
  betType: string,
  sender: string
) {
  const race = contractState.races.get(raceId);
  if (!race) return { isOk: false, error: 102 };
  if (race.status !== "open") return { isOk: false, error: 108 };

  const racer = contractState.raceRacers.get(`${raceId}-${racerIndex}`);
  if (!racer) return { isOk: false, error: 110 };

  const userBalance = contractState.userBalances.get(sender) || 0;
  if (amount < contractState.minBet || amount > contractState.maxBet)
    return { isOk: false, error: 107 };
  if (userBalance < amount) return { isOk: false, error: 105 };

  const betId = ++contractState.betIdCounter;
  const potentialPayout = Math.floor((amount * racer.odds) / 100);

  // Deduct from user balance
  contractState.userBalances.set(sender, userBalance - amount);

  // Create bet
  contractState.bets.set(betId, {
    raceId,
    bettor: sender,
    racerIndex,
    amount,
    potentialPayout,
    claimed: false,
    betType,
  });

  // Update racer and race totals
  racer.totalBets += amount;
  race.totalPool += amount;

  // Update user bets list
  const userBetKey = `${sender}-${raceId}`;
  const currentUserBets = contractState.userBets.get(userBetKey) || [];
  currentUserBets.push(betId);
  contractState.userBets.set(userBetKey, currentUserBets);

  // Update odds (simplified)
  updateRacerOdds(raceId, racerIndex, race.totalPool);

  return { value: betId, isOk: true };
}

function updateRacerOdds(
  raceId: number,
  racerIndex: number,
  totalPool: number
) {
  const racer = contractState.raceRacers.get(`${raceId}-${racerIndex}`);
  if (racer && totalPool > 0) {
    const newOdds = Math.max(
      110,
      Math.floor((totalPool * 100) / Math.max(1, racer.totalBets))
    );
    racer.odds = newOdds;
  }
}

function simulateFinishRace(
  raceId: number,
  finalPositions: number[],
  sender: string
) {
  if (sender !== contractState.contractOwner)
    return { isOk: false, error: 100 };

  const race = contractState.races.get(raceId);
  if (!race) return { isOk: false, error: 102 };
  if (race.status !== "running") return { isOk: false, error: 104 };

  contractState.raceResults.set(raceId, finalPositions);

  const houseTake = Math.floor(
    (race.totalPool * contractState.houseEdge) / 10000
  );
  race.status = "finished";
  race.winner = finalPositions[0];
  race.houseTake = houseTake;

  // Update racer positions
  finalPositions.forEach((racerIndex, position) => {
    const racer = contractState.raceRacers.get(`${raceId}-${racerIndex}`);
    if (racer) {
      racer.position = position + 1; // 1-based position
    }
  });

  return { value: true, isOk: true };
}

function simulateClaimWinnings(betId: number, sender: string) {
  const bet = contractState.bets.get(betId);
  if (!bet) return { isOk: false, error: 101 };
  if (bet.bettor !== sender) return { isOk: false, error: 106 };
  if (bet.claimed) return { isOk: false, error: 111 };

  const race = contractState.races.get(bet.raceId);
  if (!race || race.status !== "finished") return { isOk: false, error: 104 };

  const racer = contractState.raceRacers.get(`${bet.raceId}-${bet.racerIndex}`);
  if (!racer) return { isOk: false, error: 110 };

  let payout = 0;

  if (bet.betType === "win" && racer.position === 1) {
    payout = bet.potentialPayout;
  } else if (bet.betType === "place" && racer.position <= 2) {
    payout = Math.floor(bet.potentialPayout / 2);
  } else if (bet.betType === "show" && racer.position <= 3) {
    payout = Math.floor(bet.potentialPayout / 3);
  }

  bet.claimed = true;

  if (payout > 0) {
    const currentBalance = contractState.userBalances.get(sender) || 0;
    contractState.userBalances.set(sender, currentBalance + payout);
  }

  return { value: payout, isOk: true };
}

function simulateSetHouseEdge(newEdge: number, sender: string) {
  if (sender !== contractState.contractOwner)
    return { isOk: false, error: 100 };
  if (newEdge > 1000) return { isOk: false, error: 107 };

  contractState.houseEdge = newEdge;
  return { value: true, isOk: true };
}

function simulateCancelRace(raceId: number, sender: string) {
  if (sender !== contractState.contractOwner)
    return { isOk: false, error: 100 };

  const race = contractState.races.get(raceId);
  if (!race) return { isOk: false, error: 102 };
  if (race.status === "finished") return { isOk: false, error: 103 };

  race.status = "cancelled";
  return { value: true, isOk: true };
}

// Test Suite
describe("Racing Game Betting Contract", () => {
  const contractOwner = "ST1HTBVD3JG9C05J7HBJTHGR0GGW7KXW28M5JS8QE";
  const user1 = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";
  const user2 = "ST2JHG361ZXG51QTKY2NQCVBPPRRE2KZB1HR05NNC";

  beforeEach(() => {
    // Reset contract state before each test
    contractState = {
      races: new Map(),
      raceRacers: new Map(),
      bets: new Map(),
      userBets: new Map(),
      userBalances: new Map(),
      raceResults: new Map(),
      raceIdCounter: 0,
      betIdCounter: 0,
      houseEdge: 250,
      minBet: 100,
      maxBet: 100000,
      contractOwner,
    };
  });

  describe("Token Management", () => {
    it("should allow users to deposit funds", () => {
      const result = mockContractCall("deposit-funds", [1000], user1);

      expect(result.isOk).toBe(true);
      expect(result.value).toBe(1000);

      const balance = mockReadOnlyCall("get-balance", [user1]);
      expect(balance.value).toBe(1000);
    });

    it("should reject zero or negative deposits", () => {
      const result = mockContractCall("deposit-funds", [0], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(107); // ERR-INVALID-BET
    });

    it("should allow users to withdraw funds", () => {
      mockContractCall("deposit-funds", [1000], user1);
      const result = mockContractCall("withdraw-funds", [500], user1);

      expect(result.isOk).toBe(true);
      expect(result.value).toBe(500);

      const balance = mockReadOnlyCall("get-balance", [user1]);
      expect(balance.value).toBe(500);
    });

    it("should reject withdrawals exceeding balance", () => {
      mockContractCall("deposit-funds", [100], user1);
      const result = mockContractCall("withdraw-funds", [500], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(105); // ERR-INSUFFICIENT-FUNDS
    });
  });

  describe("Race Management", () => {
    it("should allow owner to create a race", () => {
      const racers = ["Lightning", "Thunder", "Storm"];
      const result = mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );

      expect(result.isOk).toBe(true);
      expect(result.value).toBe(1);

      const race = mockReadOnlyCall("get-race", [1]);
      expect(race.value).toBeTruthy();
      expect(race.value.name).toBe("Test Race");
      expect(race.value.status).toBe("open");
    });

    it("should reject race creation by non-owner", () => {
      const racers = ["Lightning", "Thunder"];
      const result = mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        user1
      );

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(100); // ERR-OWNER-ONLY
    });

    it("should reject race creation with insufficient racers", () => {
      const racers = ["Lightning"];
      const result = mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(110); // ERR-INVALID-RACER
    });

    it("should allow owner to start a race", () => {
      const racers = ["Lightning", "Thunder", "Storm"];
      mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );

      const result = mockContractCall("start-race", [1], contractOwner);

      expect(result.isOk).toBe(true);

      const race = mockReadOnlyCall("get-race", [1]);
      expect(race.value.status).toBe("running");
    });

    it("should reject starting non-existent race", () => {
      const result = mockContractCall("start-race", [999], contractOwner);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(102); // ERR-RACE-NOT-FOUND
    });
  });

  describe("Betting System", () => {
    beforeEach(() => {
      // Setup a race for betting tests
      const racers = ["Lightning", "Thunder", "Storm"];
      mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );
      mockContractCall("deposit-funds", [5000], user1);
      mockContractCall("deposit-funds", [3000], user2);
    });

    it("should allow users to place valid bets", () => {
      const result = mockContractCall("place-bet", [1, 0, 500, "win"], user1);

      expect(result.isOk).toBe(true);
      expect(result.value).toBe(1); // bet-id

      const bet = mockReadOnlyCall("get-bet", [1]);
      expect(bet.value).toBeTruthy();
      expect(bet.value.amount).toBe(500);
      expect(bet.value.betType).toBe("win");

      const balance = mockReadOnlyCall("get-balance", [user1]);
      expect(balance.value).toBe(4500); // 5000 - 500
    });

    it("should reject bets on non-existent races", () => {
      const result = mockContractCall("place-bet", [999, 0, 500, "win"], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(102); // ERR-RACE-NOT-FOUND
    });

    it("should reject bets below minimum", () => {
      const result = mockContractCall("place-bet", [1, 0, 50, "win"], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(107); // ERR-INVALID-BET
    });

    it("should reject bets above maximum", () => {
      const result = mockContractCall(
        "place-bet",
        [1, 0, 200000, "win"],
        user1
      );

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(107); // ERR-INVALID-BET
    });

    it("should reject bets exceeding user balance", () => {
      const result = mockContractCall("place-bet", [1, 0, 6000, "win"], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(105); // ERR-INSUFFICIENT-FUNDS
    });

    it("should reject bets on started races", () => {
      mockContractCall("start-race", [1], contractOwner);
      const result = mockContractCall("place-bet", [1, 0, 500, "win"], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(108); // ERR-RACE-ALREADY-STARTED
    });

    it("should update race pool and racer totals", () => {
      mockContractCall("place-bet", [1, 0, 500, "win"], user1);
      mockContractCall("place-bet", [1, 1, 300, "win"], user2);

      const race = mockReadOnlyCall("get-race", [1]);
      expect(race.value.totalPool).toBe(800);

      const racer0 = mockReadOnlyCall("get-racer", [1, 0]);
      expect(racer0.value.totalBets).toBe(500);

      const racer1 = mockReadOnlyCall("get-racer", [1, 1]);
      expect(racer1.value.totalBets).toBe(300);
    });

    it("should track user bets per race", () => {
      mockContractCall("place-bet", [1, 0, 500, "win"], user1);
      mockContractCall("place-bet", [1, 1, 300, "place"], user1);

      const userBets = mockReadOnlyCall("get-user-bets", [user1, 1]);
      expect(userBets.value).toHaveLength(2);
      expect(userBets.value).toContain(1);
      expect(userBets.value).toContain(2);
    });
  });

  describe("Race Finishing and Payouts", () => {
    beforeEach(() => {
      // Setup race with bets
      const racers = ["Lightning", "Thunder", "Storm"];
      mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );
      mockContractCall("deposit-funds", [5000], user1);
      mockContractCall("deposit-funds", [3000], user2);

      // Place some bets
      mockContractCall("place-bet", [1, 0, 1000, "win"], user1); // bet on Lightning to win
      mockContractCall("place-bet", [1, 1, 500, "place"], user2); // bet on Thunder to place
      mockContractCall("place-bet", [1, 2, 300, "show"], user1); // bet on Storm to show

      mockContractCall("start-race", [1], contractOwner);
    });

    it("should allow owner to finish race", () => {
      const finalPositions = [0, 1, 2]; // Lightning 1st, Thunder 2nd, Storm 3rd
      const result = mockContractCall(
        "finish-race",
        [1, finalPositions],
        contractOwner
      );

      expect(result.isOk).toBe(true);

      const race = mockReadOnlyCall("get-race", [1]);
      expect(race.value.status).toBe("finished");
      expect(race.value.winner).toBe(0); // Lightning
    });

    it("should reject finishing race by non-owner", () => {
      const finalPositions = [0, 1, 2];
      const result = mockContractCall(
        "finish-race",
        [1, finalPositions],
        user1
      );

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(100); // ERR-OWNER-ONLY
    });

    it("should allow claiming winning bets", () => {
      const finalPositions = [0, 1, 2]; // Lightning 1st, Thunder 2nd, Storm 3rd
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      // User1's winning bet on Lightning (bet-id 1)
      const claimResult = mockContractCall("claim-winnings", [1], user1);

      expect(claimResult.isOk).toBe(true);
      expect(claimResult.value).toBeGreaterThan(0); // Should have payout

      const bet = mockReadOnlyCall("get-bet", [1]);
      expect(bet.value.claimed).toBe(true);
    });

    it("should handle place bet payouts correctly", () => {
      const finalPositions = [0, 1, 2]; // Lightning 1st, Thunder 2nd, Storm 3rd
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      // User2's place bet on Thunder (bet-id 2) - should win as Thunder placed 2nd
      const claimResult = mockContractCall("claim-winnings", [2], user2);

      expect(claimResult.isOk).toBe(true);
      expect(claimResult.value).toBeGreaterThan(0);
    });

    it("should handle show bet payouts correctly", () => {
      const finalPositions = [0, 1, 2]; // Lightning 1st, Thunder 2nd, Storm 3rd
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      // User1's show bet on Storm (bet-id 3) - should win as Storm placed 3rd
      const claimResult = mockContractCall("claim-winnings", [3], user1);

      expect(claimResult.isOk).toBe(true);
      expect(claimResult.value).toBeGreaterThan(0);
    });

    it("should reject claiming losing bets", () => {
      const finalPositions = [1, 0, 2]; // Thunder 1st, Lightning 2nd, Storm 3rd
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      // User1's win bet on Lightning (bet-id 1) - should lose as Lightning didn't win
      const claimResult = mockContractCall("claim-winnings", [1], user1);

      expect(claimResult.isOk).toBe(true);
      expect(claimResult.value).toBe(0); // No payout for losing bet
    });

    it("should reject double claims", () => {
      const finalPositions = [0, 1, 2];
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      mockContractCall("claim-winnings", [1], user1);
      const secondClaim = mockContractCall("claim-winnings", [1], user1);

      expect(secondClaim.isOk).toBe(false);
      expect(secondClaim.error).toBe(111); // ERR-ALREADY-CLAIMED
    });

    it("should reject claims by wrong user", () => {
      const finalPositions = [0, 1, 2];
      mockContractCall("finish-race", [1, finalPositions], contractOwner);

      const result = mockContractCall("claim-winnings", [1], user2);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(106); // ERR-UNAUTHORIZED
    });

    it("should reject claims on unfinished races", () => {
      const result = mockContractCall("claim-winnings", [1], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(104); // ERR-RACE-NOT-ENDED
    });
  });

  describe("Administrative Functions", () => {
    it("should allow owner to set house edge", () => {
      const result = mockContractCall("set-house-edge", [300], contractOwner);

      expect(result.isOk).toBe(true);
      expect(contractState.houseEdge).toBe(300);
    });

    it("should reject setting house edge above 10%", () => {
      const result = mockContractCall("set-house-edge", [1100], contractOwner);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(107); // ERR-INVALID-BET
    });

    it("should reject house edge changes by non-owner", () => {
      const result = mockContractCall("set-house-edge", [300], user1);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(100); // ERR-OWNER-ONLY
    });

    it("should allow owner to cancel races", () => {
      const racers = ["Lightning", "Thunder"];
      mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );

      const result = mockContractCall("cancel-race", [1], contractOwner);

      expect(result.isOk).toBe(true);

      const race = mockReadOnlyCall("get-race", [1]);
      expect(race.value.status).toBe("cancelled");
    });

    it("should reject cancelling finished races", () => {
      const racers = ["Lightning", "Thunder"];
      mockContractCall(
        "create-race",
        ["Test Race", racers, 100],
        contractOwner
      );
      mockContractCall("start-race", [1], contractOwner);
      mockContractCall("finish-race", [1, [0, 1]], contractOwner);

      const result = mockContractCall("cancel-race", [1], contractOwner);

      expect(result.isOk).toBe(false);
      expect(result.error).toBe(103); // ERR-RACE-ENDED
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle non-existent bet queries", () => {
      const bet = mockReadOnlyCall("get-bet", [999]);
      expect(bet.value).toBeNull();
    });

    it("should handle non-existent race queries", () => {
      const race = mockReadOnlyCall("get-race", [999]);
      expect(race.value).toBeNull();
    });

    it("should handle empty user bet lists", () => {
      const userBets = mockReadOnlyCall("get-user-bets", [user1, 1]);
      expect(userBets.value).toEqual([]);
    });

    it("should handle zero balance users", () => {
      const balance = mockReadOnlyCall("get-balance", [user1]);
      expect(balance.value).toBe(0);
    });

    it("should handle odds queries for non-existent racers", () => {
      const odds = mockReadOnlyCall("get-current-odds", [999, 0]);
      expect(odds.value).toBeNull();
    });
  });
});
