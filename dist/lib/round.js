"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Action = void 0;
var assert_1 = require("../util/assert");
var Action;
(function (Action) {
    Action[Action["LEAVE"] = 1] = "LEAVE";
    Action[Action["PASSIVE"] = 2] = "PASSIVE";
    Action[Action["AGGRESSIVE"] = 4] = "AGGRESSIVE";
})(Action = exports.Action || (exports.Action = {}));
var Round = /** @class */ (function () {
    function Round(activePlayers, firstToAct) {
        this._contested = false;
        this._firstAction = true;
        this._numActivePlayers = 0;
        this._activePlayers = activePlayers;
        this._playerToAct = firstToAct;
        this._lastAggressiveActor = firstToAct;
        this._numActivePlayers = activePlayers.filter(function (player) { return !!player; }).length;
        assert_1.pokerAssert(firstToAct < activePlayers.length, 'First player to act index must be within active players array bounds');
    }
    Round.prototype.activePlayers = function () {
        return this._activePlayers;
    };
    Round.prototype.playerToAct = function () {
        return this._playerToAct;
    };
    Round.prototype.lastAggressiveActor = function () {
        return this._lastAggressiveActor;
    };
    Round.prototype.numActivePlayers = function () {
        return this._numActivePlayers;
    };
    Round.prototype.inProgress = function () {
        return (this._contested || this._numActivePlayers > 1) && (this._firstAction || this._playerToAct !== this._lastAggressiveActor);
    };
    Round.prototype.isContested = function () {
        return this._contested;
    };
    Round.prototype.actionTaken = function (action) {
        assert_1.pokerAssert(this.inProgress(), 'Cannot take action when round is not in progress');
        assert_1.pokerAssert(!(action & Action.PASSIVE && action & Action.AGGRESSIVE), 'Action cannot be both passive and aggressive');
        if (this._firstAction) {
            this._firstAction = false;
        }
        // Implication: if there is aggressive action => the next player is contested
        if (action & Action.AGGRESSIVE) {
            this._lastAggressiveActor = this._playerToAct;
            this._contested = true;
        }
        else if (action & Action.PASSIVE) {
            this._contested = true;
        }
        if (action & Action.LEAVE) {
            this._activePlayers[this._playerToAct] = false;
            --this._numActivePlayers;
        }
        this.incrementPlayer();
    };
    Round.prototype.incrementPlayer = function () {
        do {
            ++this._playerToAct;
            if (this._playerToAct === this._activePlayers.length)
                this._playerToAct = 0;
            if (this._playerToAct === this._lastAggressiveActor)
                break;
        } while (!this._activePlayers[this._playerToAct]);
    };
    return Round;
}());
exports.default = Round;
//# sourceMappingURL=round.js.map