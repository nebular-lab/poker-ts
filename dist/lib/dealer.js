"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = exports.ActionRange = void 0;
var community_cards_1 = require("./community-cards");
var betting_round_1 = __importStar(require("./betting-round"));
var pot_manager_1 = __importDefault(require("./pot-manager"));
var assert_1 = require("../util/assert");
var hand_1 = __importDefault(require("./hand"));
var array_1 = require("../util/array");
var ActionRange = /** @class */ (function () {
    function ActionRange(chipRange) {
        this.action = Action.FOLD; // You can always fold
        this.chipRange = chipRange;
    }
    ActionRange.prototype.contains = function (action, bet) {
        var _a, _b;
        if (bet === void 0) { bet = 0; }
        assert_1.pokerAssert(Dealer.isValid(action), 'The action representation must be valid');
        return action && Dealer.isAggressive(action)
            ? (_b = (_a = this.chipRange) === null || _a === void 0 ? void 0 : _a.contains(bet)) !== null && _b !== void 0 ? _b : false
            : true;
    };
    return ActionRange;
}());
exports.ActionRange = ActionRange;
var Action;
(function (Action) {
    Action[Action["FOLD"] = 1] = "FOLD";
    Action[Action["CHECK"] = 2] = "CHECK";
    Action[Action["CALL"] = 4] = "CALL";
    Action[Action["BET"] = 8] = "BET";
    Action[Action["RAISE"] = 16] = "RAISE";
})(Action = exports.Action || (exports.Action = {}));
var Dealer = /** @class */ (function () {
    function Dealer(players, button, forcedBets, deck, communityCards, numSeats) {
        if (numSeats === void 0) { numSeats = 9; }
        this._button = 0;
        this._bettingRound = null;
        this._handInProgress = false;
        this._roundOfBetting = community_cards_1.RoundOfBetting.PREFLOP;
        this._bettingRoundsCompleted = false;
        this._actionHistory = [];
        this._sequenceCounter = 0;
        this._players = players;
        this._button = button;
        this._forcedBets = forcedBets;
        this._deck = deck;
        this._communityCards = communityCards;
        this._potManager = new pot_manager_1.default();
        this._holeCards = new Array(numSeats).fill(null);
        this._winners = [];
        assert_1.pokerAssert(deck.length === 52, 'Deck must be whole');
        assert_1.pokerAssert(communityCards.cards().length === 0, 'No community cards should have been dealt');
    }
    Dealer.isValid = function (action) {
        // Method for counting bits in a 32-bit integer from https://graphics.stanford.edu/~seander/bithacks.html
        action = action - ((action >> 1) & 0x55555555);
        action = (action & 0x33333333) + ((action >> 2) & 0x33333333);
        var bitCount = ((action + (action >> 4) & 0xF0F0F0F) * 0x1010101) >> 24;
        return bitCount === 1;
    };
    Dealer.isAggressive = function (action) {
        return !!(action & Action.BET) || !!(action & Action.RAISE);
    };
    Dealer.prototype.handInProgress = function () {
        return this._handInProgress;
    };
    Dealer.prototype.bettingRoundsCompleted = function () {
        assert_1.pokerAssert(this.handInProgress(), 'Hand must be in progress');
        return this._bettingRoundsCompleted;
    };
    Dealer.prototype.playerToAct = function () {
        assert_1.pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress');
        assert_1.pokerAssert(this._bettingRound !== null, "Betting round must not be null");
        return this._bettingRound.playerToAct();
    };
    Dealer.prototype.players = function () {
        var _a, _b;
        return (_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.players()) !== null && _b !== void 0 ? _b : [];
    };
    // All the players who started in the current betting round
    Dealer.prototype.bettingRoundPlayers = function () {
        return this._players;
    };
    Dealer.prototype.roundOfBetting = function () {
        assert_1.pokerAssert(this.handInProgress(), 'Hand must be in progress');
        return this._roundOfBetting;
    };
    Dealer.prototype.numActivePlayers = function () {
        var _a, _b;
        return (_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.numActivePlayers()) !== null && _b !== void 0 ? _b : 0;
    };
    Dealer.prototype.biggestBet = function () {
        var _a, _b;
        return (_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.biggestBet()) !== null && _b !== void 0 ? _b : 0;
    };
    Dealer.prototype.bettingRoundInProgress = function () {
        var _a, _b;
        return (_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.inProgress()) !== null && _b !== void 0 ? _b : false;
    };
    Dealer.prototype.isContested = function () {
        var _a, _b;
        return (_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.isContested()) !== null && _b !== void 0 ? _b : false;
    };
    Dealer.prototype.legalActions = function () {
        assert_1.pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress');
        assert_1.pokerAssert(this._bettingRound !== null, "Betting round must not be null");
        var player = this._players[this._bettingRound.playerToAct()];
        var actions = this._bettingRound.legalActions();
        var actionRange = new ActionRange(actions.chipRange);
        // Below we take care of differentiating between check/call and bet/raise,
        // which the betting_round treats as just "match" and "raise".
        assert_1.pokerAssert(player !== null, "Player must not be null");
        if (this._bettingRound.biggestBet() - player.betSize() === 0) {
            actionRange.action |= Action.CHECK;
            // Typically you can always bet or raise if you can check. Exception is if you are the big blind and have no
            // chips left after the blind has been paid, in which case you should be allowed to check but not bet or
            // raise.
            if (actions.canRaise) {
                // If this guy can check, with his existing bet_size, he is the big blind.
                if (player.betSize() > 0) {
                    actionRange.action |= Action.RAISE;
                }
                else {
                    actionRange.action |= Action.BET;
                }
            }
        }
        else {
            actionRange.action |= Action.CALL;
            // If you can call, you may or may not be able to raise.
            if (actions.canRaise) {
                actionRange.action |= Action.RAISE;
            }
        }
        return actionRange;
    };
    Dealer.prototype.pots = function () {
        assert_1.pokerAssert(this.handInProgress(), 'Hand must be in progress');
        return this._potManager.pots();
    };
    Dealer.prototype.button = function () {
        return this._button;
    };
    Dealer.prototype.holeCards = function () {
        assert_1.pokerAssert(this.handInProgress() || this.bettingRoundInProgress(), 'Hand must be in progress or showdown must have ended');
        return this._holeCards;
    };
    Dealer.prototype.startHand = function () {
        assert_1.pokerAssert(!this.handInProgress(), 'Hand must not be in progress');
        this._bettingRoundsCompleted = false;
        this._roundOfBetting = community_cards_1.RoundOfBetting.PREFLOP;
        this._winners = [];
        this._actionHistory = [];
        this._sequenceCounter = 0;
        this.collectAnte();
        var bigBlindSeat = this.postBlinds();
        var firstAction = this.nextOrWrap(bigBlindSeat);
        this.dealHoleCards();
        if (this._players.filter(function (player, seat) { return player !== null && (player.stack() !== 0 || seat === bigBlindSeat); }).length > 1) {
            this._bettingRound = new betting_round_1.default(__spreadArray([], this._players), firstAction, this._forcedBets.blinds.big, this._forcedBets.blinds.big);
        }
        this._handInProgress = true;
    };
    Dealer.prototype.actionTaken = function (action, bet) {
        assert_1.pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress');
        assert_1.pokerAssert(this.legalActions().contains(action, bet), 'Action must be legal');
        assert_1.pokerAssert(this._bettingRound !== null, "Betting round must not be null");
        var seatIndex = this.playerToAct();
        var street = this.getStreetName();
        var amount = bet !== null && bet !== void 0 ? bet : 0;
        var pot = this.pots()[0];
        var meta = {
            pot: { size: pot.size(), eligiblePlayers: pot.eligiblePlayers() },
        };
        var actionType = this.getActionTypeName(action);
        if (actionType === 'bet' && amount > 0 && pot.size() > 0) {
            meta.betPercentage = Number.parseFloat(((amount / pot.size()) * 100).toFixed(2));
        }
        else if (actionType === 'raise' && amount > 0) {
            var callAmount = this.calculateCallAmount(seatIndex);
            var sumBetSize = this._players.reduce(function (acc, p) { return acc + ((p === null || p === void 0 ? void 0 : p.betSize()) || 0); }, 0);
            var potAfterCall = pot.size() + sumBetSize + callAmount;
            var additional = amount - callAmount;
            if (additional > 0) {
                meta.raisePercentage = Number.parseFloat(((additional / potAfterCall) * 100).toFixed(2));
            }
        }
        this._actionHistory.push({
            seatIndex: seatIndex,
            street: street,
            seq: this._sequenceCounter++,
            actionType: actionType,
            amount: amount,
            meta: meta,
        });
        if (action & Action.CHECK || action & Action.CALL) {
            this._bettingRound.actionTaken(betting_round_1.Action.MATCH);
        }
        else if (action & Action.BET || action & Action.RAISE) {
            this._bettingRound.actionTaken(betting_round_1.Action.RAISE, bet);
        }
        else {
            assert_1.pokerAssert(action & Action.FOLD, "Action must include fold");
            var foldingPlayer = this._players[this.playerToAct()];
            assert_1.pokerAssert(foldingPlayer !== null, "Folding player must not be null");
            this._potManager.betFolded(foldingPlayer.betSize());
            foldingPlayer.takeFromBet(foldingPlayer.betSize());
            this._players[this.playerToAct()] = null;
            this._bettingRound.actionTaken(betting_round_1.Action.LEAVE);
        }
    };
    Dealer.prototype.endBettingRound = function () {
        var _a, _b, _c, _d;
        assert_1.pokerAssert(!this._bettingRoundsCompleted, 'Betting rounds must not be completed');
        assert_1.pokerAssert(!this.bettingRoundInProgress(), 'Betting round must not be in progress');
        this._potManager.collectBetsForm(this._players);
        if (((_b = (_a = this._bettingRound) === null || _a === void 0 ? void 0 : _a.numActivePlayers()) !== null && _b !== void 0 ? _b : 0) <= 1) {
            this._roundOfBetting = community_cards_1.RoundOfBetting.RIVER;
            // If there is only one pot, and there is only one player in it...
            if (this._potManager.pots().length === 1 && this._potManager.pots()[0].eligiblePlayers().length === 1) {
                // ...there is no need to deal the undealt community cards.
            }
            else {
                this.dealCommunityCards();
            }
            this._bettingRoundsCompleted = true;
            // Now you call showdown()
        }
        else if (this._roundOfBetting < community_cards_1.RoundOfBetting.RIVER) {
            // Start the next betting round.
            this._roundOfBetting = community_cards_1.next(this._roundOfBetting);
            this._players = (_d = (_c = this._bettingRound) === null || _c === void 0 ? void 0 : _c.players()) !== null && _d !== void 0 ? _d : [];
            this._bettingRound = new betting_round_1.default(__spreadArray([], this._players), this.nextOrWrap(this._button), this._forcedBets.blinds.big);
            this.dealCommunityCards();
            assert_1.pokerAssert(!this._bettingRoundsCompleted, "Betting rounds must not be completed");
        }
        else {
            assert_1.pokerAssert(this._roundOfBetting === community_cards_1.RoundOfBetting.RIVER, "Round of betting must be river");
            this._bettingRoundsCompleted = true;
            // Now you call showdown()
        }
    };
    Dealer.prototype.winners = function () {
        assert_1.pokerAssert(!this.handInProgress(), 'Hand must not be in progress');
        return this._winners;
    };
    Dealer.prototype.showdown = function () {
        var _this = this;
        assert_1.pokerAssert(this._roundOfBetting === community_cards_1.RoundOfBetting.RIVER, 'Round of betting must be river');
        assert_1.pokerAssert(!this.bettingRoundInProgress(), 'Betting round must not be in progress');
        assert_1.pokerAssert(this.bettingRoundsCompleted(), 'Betting rounds must be completed');
        this._handInProgress = false;
        if (this._potManager.pots().length === 1 && this._potManager.pots()[0].eligiblePlayers().length === 1) {
            // No need to evaluate the hand. There is only one player.
            var index = this._potManager.pots()[0].eligiblePlayers()[0];
            var player = this._players[index];
            assert_1.pokerAssert(player !== null, "Player must not be null");
            player.addToStack(this._potManager.pots()[0].size());
            return;
            // TODO: Also, no reveals in this case. Reveals are only necessary when there is >=2 players.
        }
        var _loop_1 = function (pot) {
            var playerResults = pot.eligiblePlayers().map(function (seatIndex) {
                return [seatIndex, hand_1.default.create(_this._holeCards[seatIndex], _this._communityCards)];
            });
            playerResults.sort(function (_a, _b) {
                var first = _a[1];
                var second = _b[1];
                return hand_1.default.compare(first, second);
            });
            var lastWinnerIndex = array_1.findIndexAdjacent(playerResults, function (_a, _b) {
                var first = _a[1];
                var second = _b[1];
                return hand_1.default.compare(first, second) !== 0;
            });
            var numberOfWinners = lastWinnerIndex === -1 ? playerResults.length : lastWinnerIndex + 1;
            var oddChips = pot.size() % numberOfWinners;
            var payout = (pot.size() - oddChips) / numberOfWinners;
            var winningPlayerResults = playerResults.slice(0, numberOfWinners);
            winningPlayerResults.forEach(function (playerResult) {
                var _a;
                var seatIndex = playerResult[0];
                (_a = _this._players[seatIndex]) === null || _a === void 0 ? void 0 : _a.addToStack(payout);
            });
            this_1._winners.push(winningPlayerResults.map(function (playerResult) {
                var seatIndex = playerResult[0];
                var holeCards = _this._holeCards[seatIndex];
                return __spreadArray(__spreadArray([], playerResult), [holeCards]);
            }));
            if (oddChips !== 0) {
                // Distribute the odd chips to the first players, counting clockwise, after the dealer button
                var winners_1 = new Array(this_1._players.length).fill(null);
                winningPlayerResults.forEach(function (playerResult) {
                    var seatIndex = playerResult[0];
                    winners_1[seatIndex] = _this._players[seatIndex];
                });
                var seat = this_1._button;
                while (oddChips !== 0) {
                    seat = array_1.nextOrWrap(winners_1, seat);
                    var winner = winners_1[seat];
                    assert_1.pokerAssert(winner !== null, "Winner must not be null");
                    winner.addToStack(1);
                    oddChips--;
                }
            }
        };
        var this_1 = this;
        for (var _i = 0, _a = this._potManager.pots(); _i < _a.length; _i++) {
            var pot = _a[_i];
            _loop_1(pot);
        }
    };
    Dealer.prototype.nextOrWrap = function (seat) {
        return array_1.nextOrWrap(this._players, seat);
    };
    Dealer.prototype.collectAnte = function () {
        if (this._forcedBets.ante === undefined) {
            return;
        }
        // Any ante goes into the pot
        var total = 0;
        for (var _i = 0, _a = this._players; _i < _a.length; _i++) {
            var player = _a[_i];
            if (player !== null) {
                var ante = Math.min(this._forcedBets.ante, player.totalChips());
                player.takeFromStack(ante);
                total += ante;
            }
        }
        this._potManager.pots()[0].add(total);
    };
    Dealer.prototype.postBlinds = function () {
        var seat = this._button;
        var numPlayers = this._players.filter(function (player) { return player !== null; }).length;
        if (numPlayers !== 2) {
            seat = this.nextOrWrap(seat);
        }
        var smallBlind = this._players[seat];
        assert_1.pokerAssert(smallBlind !== null, "Small blind player must not be null");
        smallBlind.bet(Math.min(this._forcedBets.blinds.small, smallBlind.totalChips()));
        seat = this.nextOrWrap(seat);
        var bigBlind = this._players[seat];
        assert_1.pokerAssert(bigBlind !== null, "Big blind player must not be null");
        bigBlind.bet(Math.min(this._forcedBets.blinds.big, bigBlind.totalChips()));
        return seat;
    };
    Dealer.prototype.dealHoleCards = function () {
        var _this = this;
        this._players.forEach(function (player, index) {
            if (player !== null) {
                _this._holeCards[index] = [_this._deck.draw(), _this._deck.draw()];
            }
        });
    };
    // Deals community cards up until the current round of betting.
    Dealer.prototype.dealCommunityCards = function () {
        var cards = [];
        var numCardsToDeal = this._roundOfBetting - this._communityCards.cards().length;
        for (var index = 0; index < numCardsToDeal; index++) {
            cards.push(this._deck.draw());
        }
        this._communityCards.deal(cards);
    };
    Dealer.prototype.getStreetName = function () {
        switch (this._roundOfBetting) {
            case community_cards_1.RoundOfBetting.PREFLOP:
                return 'preflop';
            case community_cards_1.RoundOfBetting.FLOP:
                return 'flop';
            case community_cards_1.RoundOfBetting.TURN:
                return 'turn';
            case community_cards_1.RoundOfBetting.RIVER:
                return 'river';
            default:
                return 'preflop';
        }
    };
    Dealer.prototype.getActionTypeName = function (action) {
        if (action & Action.FOLD)
            return 'fold';
        if (action & Action.CHECK)
            return 'check';
        if (action & Action.CALL)
            return 'call';
        if (action & Action.BET)
            return 'bet';
        if (action & Action.RAISE)
            return 'raise';
        return 'fold';
    };
    Dealer.prototype.calculateCallAmount = function (seatIndex) {
        var seat = this._players[seatIndex];
        if (!seat)
            return 0;
        var currentMaxBet = this._players
            .filter(function (p) { return p !== null; })
            .map(function (p) { return p.betSize(); })
            .reduce(function (max, b) { return Math.max(max, b); }, 0);
        var needed = currentMaxBet - seat.betSize();
        if (needed <= 0)
            return 0;
        return Math.min(needed, seat.stack());
    };
    Dealer.prototype.getActionHistory = function () {
        return this._actionHistory;
    };
    Dealer.prototype.getCurrentSequence = function () {
        return this._sequenceCounter - 1;
    };
    return Dealer;
}());
exports.default = Dealer;
//# sourceMappingURL=dealer.js.map