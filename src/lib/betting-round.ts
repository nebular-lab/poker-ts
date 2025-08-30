import { pokerAssert } from '../util/assert'
import ChipRange from './chip-range'
import { SeatIndex } from 'types/seat-index'
import { Chips } from 'types/chips'
import Round, { Action as RoundAction } from './round'
import { SeatArray } from 'types/seat-array'

export enum Action {
    LEAVE,
    MATCH,
    RAISE
}

export class ActionRange {
    canRaise: boolean
    chipRange: ChipRange

    constructor(canRaise: boolean, chipRange: ChipRange = new ChipRange(0, 0) ) {
        this.canRaise = canRaise
        this.chipRange = chipRange
    }
}

export default class BettingRound {
    private readonly _players: SeatArray
    private _round: Round
    private _biggestBet: Chips
    private _minRaise: Chips

    constructor(players: SeatArray, firstToAct: SeatIndex, minRaise: Chips, biggestBet: Chips = 0) {
        this._round = new Round(players.map(player => !!player), firstToAct)
        this._players = players
        this._biggestBet = biggestBet
        this._minRaise = minRaise

        pokerAssert(firstToAct < players.length, 'Seat index must be in the valid range')
        pokerAssert(players[firstToAct], 'First player to act must exist')
    }

    inProgress(): boolean {
        return this._round.inProgress()
    }

    isContested(): boolean {
        return this._round.isContested();
    }

    playerToAct(): SeatIndex {
        return this._round.playerToAct()
    }

    biggestBet(): Chips {
        return this._biggestBet
    }

    minRaise(): Chips {
        return this._minRaise
    }

    players(): SeatArray {
        return this._round.activePlayers().map((isActive, index) => {
            return isActive ? this._players[index] : null
        })
    }

    activePlayers(): boolean[] {
        return this._round.activePlayers()
    }

    numActivePlayers(): number {
        return this._round.numActivePlayers()
    }

    legalActions(): ActionRange {
        const player = this._players[this._round.playerToAct()]
        pokerAssert(player !== null, 'Player to act must exist')
        const playerChips = player.totalChips()
        const canRaise = playerChips > this._biggestBet
        if (canRaise) {
            const minBet = this._biggestBet + this._minRaise
            const raiseRange = new ChipRange(Math.min(minBet, playerChips), playerChips)
            return new ActionRange(canRaise, raiseRange)
        } else {
            return new ActionRange(canRaise)
        }
    }

    actionTaken(action: Action, bet: Chips = 0) {
        const player = this._players[this._round.playerToAct()]
        pokerAssert(player !== null, 'Player taking action must exist')
        if (action === Action.RAISE) {
            pokerAssert(this.isRaiseValid(bet), 'Raise amount must be valid')
            player.bet(bet)
            this._minRaise = bet - this._biggestBet
            this._biggestBet = bet
            let actionFlag = RoundAction.AGGRESSIVE
            if (player.stack() === 0) {
                actionFlag |= RoundAction.LEAVE
            }
            this._round.actionTaken(actionFlag)
        } else if (action === Action.MATCH) {
            player.bet(Math.min(this._biggestBet, player.totalChips()))
            let actionFlag = RoundAction.PASSIVE
            if (player.stack() === 0) {
                actionFlag |= RoundAction.LEAVE
            }
            this._round.actionTaken(actionFlag)
        } else {
            pokerAssert(action === Action.LEAVE, 'Action must be LEAVE when not RAISE or MATCH')
            this._round.actionTaken(RoundAction.LEAVE)
        }
    }

    private isRaiseValid(bet: Chips): boolean {
        const player = this._players[this._round.playerToAct()]
        pokerAssert(player !== null, 'Player must exist to validate raise')
        const playerChips = player.stack() + player.betSize()
        const minBet = this._biggestBet + this._minRaise
        if (playerChips > this._biggestBet && playerChips < minBet) {
            return bet === playerChips
        }
        return bet >= minBet && bet <= playerChips
    }
}