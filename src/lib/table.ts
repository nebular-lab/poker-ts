import { SeatArray } from 'types/seat-array'
import { SeatIndex } from 'types/seat-index'
import { ForcedBets } from 'types/forced-bets'
import Deck from './deck'
import CommunityCards, { RoundOfBetting } from './community-cards'
import Dealer, { Action, ActionRange, ActionRecord } from './dealer'
import { pokerAssert } from '../util/assert';
import Pot from './pot'
import { HoleCards } from 'types/hole-cards'
import { Chips } from 'types/chips'
import { bitCount } from '../util/bit'
import Player from './player'
import Hand from './hand'

export enum AutomaticAction {
    FOLD = 1 << 0,
    CHECK_FOLD = 1 << 1,
    CHECK = 1 << 2,
    CALL = 1 << 3,
    CALL_ANY = 1 << 4,
    ALL_IN = 1 << 5
}

export default class Table {
    private readonly _numSeats: number
    private readonly _tablePlayers: SeatArray // All the players physically present at the table
    private readonly _deck: Deck
    private _handPlayers?: SeatArray
    private _automaticActions?: (AutomaticAction | null)[]
    private _firstTimeButton = true
    private _buttonSetManually = false // has the button been set manually
    private _button: SeatIndex = 0
    private _forcedBets: ForcedBets
    private _communityCards?: CommunityCards
    private _dealer?: Dealer
    private _staged: boolean[] // All players who took a seat or stood up before the .start_hand()

    constructor(forcedBets: ForcedBets, numSeats = 9) {
        pokerAssert(numSeats <= 23, 'Maximum 23 players')

        this._numSeats = numSeats
        this._forcedBets = forcedBets
        this._tablePlayers = new Array(numSeats).fill(null)
        this._staged = new Array(numSeats).fill(false)
        this._deck = new Deck()
    }

    playerToAct(): SeatIndex {
        pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.playerToAct()
    }

    button(): SeatIndex {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.button()
    }

    seats(): SeatArray {
        return this._tablePlayers
    }

    handPlayers(): SeatArray {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.players()
    }

    numActivePlayers(): number {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.numActivePlayers()
    }

    pots(): Pot[] {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.pots()
    }

    forcedBets(): ForcedBets {
        return this._forcedBets
    }

    setForcedBets(forcedBets: ForcedBets): void {
        pokerAssert(!this.handInProgress(), 'Hand must not be in progress')

        this._forcedBets = forcedBets
    }

    numSeats(): number {
        return this._numSeats
    }

    startHand(seat?: number): void {
        pokerAssert(!this.handInProgress(), 'Hand must not be in progress')
        pokerAssert(
            this._tablePlayers.filter(player => player !== null).length >= 2,
            'There must be at least 2 players at the table',
        )

        if (seat !== undefined) {
            this._button = seat
            this._buttonSetManually = true
        }

        this._staged = new Array(this._numSeats).fill(false)
        this._automaticActions = new Array(this._numSeats).fill(null)
        this._handPlayers = this._tablePlayers.map(player => player ? new Player(player) : null)
        this.incrementButton()
        this._deck.fillAndShuffle()
        this._communityCards = new CommunityCards()
        this._dealer = new Dealer(this._handPlayers, this._button, this._forcedBets, this._deck, this._communityCards)
        this._dealer.startHand()
        this.updateTablePlayers()
    }

    handInProgress(): boolean {
        return this._dealer?.handInProgress() ?? false
    }

    bettingRoundInProgress(): boolean {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.bettingRoundInProgress()
    }

    bettingRoundsCompleted(): boolean {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.bettingRoundsCompleted()
    }

    roundOfBetting(): RoundOfBetting {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.roundOfBetting()
    }

    communityCards(): CommunityCards {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._communityCards !== undefined, "Community cards must be defined")

        return this._communityCards
    }

    legalActions(): ActionRange {
        pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.legalActions()
    }

    holeCards(): (HoleCards | null)[] {
        pokerAssert(this.handInProgress() || this.bettingRoundsCompleted(), 'Hand must be in progress or showdown must have ended')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        return this._dealer.holeCards()
    }

    actionTaken(action: Action, bet?: Chips): void {
        pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        pokerAssert(this._automaticActions !== undefined, "Automatic actions must be defined")

        this._dealer.actionTaken(action, bet)
        while (this._dealer.bettingRoundInProgress()) {
            this.amendAutomaticActions()

            const playerToAct = this.playerToAct()
            const automaticAction = this._automaticActions[playerToAct]
            if (automaticAction !== null) {
                this.takeAutomaticAction(automaticAction)
                this._automaticActions[playerToAct] = null
            } else {
                break
            }
        }

        if (this.bettingRoundInProgress() && this.singleActivePlayerRemaining()) {
            // We only need to take action for this one player, and the other automatic actions will unfold automatically.
            this.actPassively()
        }

        this.updateTablePlayers()
    }

    endBettingRound() {
        pokerAssert(!this.bettingRoundInProgress(), 'Betting round must not be in progress')
        pokerAssert(!this.bettingRoundsCompleted(), 'Betting rounds must not be completed')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        this._dealer.endBettingRound()
        this.amendAutomaticActions()
        this.updateTablePlayers()
        this.clearFoldedBets()
    }

    showdown(): void {
        pokerAssert(!this.bettingRoundInProgress(), 'Betting round must not be in progress')
        pokerAssert(this.bettingRoundsCompleted(), 'Betting rounds must be completed')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        this._dealer.showdown()
        this.updateTablePlayers()
        this.standUpBustedPlayers()
    }

    winners(): [SeatIndex, Hand, HoleCards][][] {
        pokerAssert(!this.handInProgress(), 'Hand must not be in progress')

        return this._dealer?.winners() ?? []
    }

    automaticActions(): (AutomaticAction | null)[] {
        pokerAssert(this.handInProgress(), 'Hand must be in progress')
        pokerAssert(this._automaticActions !== undefined, "Automatic actions must be defined")

        return this._automaticActions
    }

    canSetAutomaticAction(seat: SeatIndex): boolean {
        pokerAssert(this.bettingRoundInProgress(), 'Betting round must be in progress')
        pokerAssert(this._staged !== undefined, "Staged array must be defined")

        // (1) This is only ever true for players that have been in the hand since the start.
        // Every following sit-down is accompanied by a _staged[s] = true
        // (2) If a player is not seated at the table, he obviously cannot set his automatic actions.
        return !this._staged[seat] && this._tablePlayers[seat] !== null
    }

    legalAutomaticActions(seat: SeatIndex): AutomaticAction {
        pokerAssert(this.canSetAutomaticAction(seat), 'Player must be allowed to set automatic actions')
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        // fold, all_in -- always viable
        // check, check_fold -- viable when biggest_bet - bet_size == 0
        // call -- when biggest_bet - bet_size > 0 ("else" of the previous case)
        // call_only -- available always except when biggest_bet >= total_chips (no choice/"any" then)
        //
        // fallbacks:
        // check_fold -> fold
        // check -> nullopt
        // call_any -> check
        const biggestBet = this._dealer.biggestBet()
        const player = this._tablePlayers[seat]
        pokerAssert(player !== null, "Player must not be null")
        const betSize = player.betSize()
        const totalChips = player.totalChips()
        let legalActions = AutomaticAction.FOLD | AutomaticAction.ALL_IN
        const canCheck = biggestBet - betSize === 0
        if (canCheck) {
            legalActions |= AutomaticAction.CHECK_FOLD | AutomaticAction.CHECK
        } else {
            legalActions |= AutomaticAction.CALL
        }

        if (biggestBet < totalChips) {
            legalActions |= AutomaticAction.CALL_ANY
        }

        return legalActions
    }

    setAutomaticAction(seat: SeatIndex, action: AutomaticAction | null) {
        pokerAssert(this.canSetAutomaticAction(seat), 'Player must be allowed to set automatic actions')
        pokerAssert(seat !== this.playerToAct(), 'Player must not be the player to act')
        pokerAssert(action === null || bitCount(action) === 1, 'Player must pick one automatic action or null')
        pokerAssert(action === null || action & this.legalAutomaticActions(seat), 'Given automatic action must be legal')
        pokerAssert(this._automaticActions !== undefined, "Automatic actions must be defined")

        this._automaticActions[seat] = action
    }

    sitDown(seat: SeatIndex, buyIn: Chips): void {
        pokerAssert(seat < this._numSeats && seat >= 0, 'Given seat index must be valid')
        pokerAssert(this._tablePlayers[seat] === null, 'Given seat must not be occupied')

        this._tablePlayers[seat] = new Player(buyIn)
        this._staged[seat] = true
    }

    standUp(seat: SeatIndex): void {
        pokerAssert(seat < this._numSeats && seat >= 0, 'Given seat index must be valid')
        pokerAssert(this._tablePlayers[seat] !== null, 'Given seat must be occupied')

        if (this.handInProgress()) {
            pokerAssert(this.bettingRoundInProgress(), "Betting round must be in progress for stand up")
            pokerAssert(this._handPlayers !== undefined, "Hand players must be defined for stand up")
            if (seat === this.playerToAct()) {
                this.actionTaken(Action.FOLD)
                this._tablePlayers[seat] = null
                this._staged[seat] = true
            } else if (this._handPlayers[seat] !== null) {
                this.setAutomaticAction(seat, AutomaticAction.FOLD)
                this._tablePlayers[seat] = null
                this._staged[seat] = true

                if (this.singleActivePlayerRemaining()) {
                    // We only need to take action for this one player, and the other automatic actions will unfold automatically.
                    this.actPassively()
                }
            }
        } else {
            this._tablePlayers[seat] = null
        }
    }

    private takeAutomaticAction(automaticAction: AutomaticAction): void {
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        pokerAssert(this._handPlayers !== undefined, "Hand players must be defined")
        const player = this._handPlayers[this._dealer.playerToAct()]
        pokerAssert(player !== null, "Player must not be null")
        const biggestBet = this._dealer.biggestBet()
        const betGap = biggestBet - player.betSize()
        const totalChips = player.totalChips()
        switch (automaticAction) {
            case AutomaticAction.FOLD:
                return this._dealer.actionTaken(Action.FOLD)
            case AutomaticAction.CHECK_FOLD:
                return this._dealer.actionTaken(betGap === 0 ? Action.CHECK : Action.FOLD)
            case AutomaticAction.CHECK:
                return this._dealer.actionTaken(Action.CHECK)
            case AutomaticAction.CALL:
                return this._dealer.actionTaken(Action.CALL)
            case AutomaticAction.CALL_ANY:
                return this._dealer.actionTaken(betGap === 0 ? Action.CHECK : Action.CALL)
            case AutomaticAction.ALL_IN:
                if (totalChips < biggestBet) {
                    return this._dealer.actionTaken(Action.CALL)
                }
                return this._dealer.actionTaken(Action.RAISE, totalChips)
            default:
                pokerAssert(false, "Invalid automatic action")
        }
    }

    // fold, all_in -- no need to fallback, always legal
    // check_fold, check -- (if the bet_gap becomes >0 then check is no longer legal)
    // call -- you cannot lose your ability to call if you were able to do it in the first place
    // call_any -- you can lose your ability to call_any, which only leaves the normal call (doubt cleared)
    //          condition: biggest_bet >= total_chips
    private amendAutomaticActions(): void {
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        pokerAssert(this._automaticActions !== undefined, "Automatic actions must be defined")
        pokerAssert(this._handPlayers !== undefined, "Hand players must be defined")

        const biggestBet = this._dealer.biggestBet()
        for (let s = 0; s < this._numSeats; s++) {
            const automaticAction = this._automaticActions[s]
            if (automaticAction !== null) {
                const player = this._handPlayers[s]
                pokerAssert(player !== null, "Player must not be null")
                const isContested = this._dealer.isContested()
                const betGap = biggestBet - player.betSize()
                const totalChips = player.totalChips()
                if (automaticAction & AutomaticAction.CHECK_FOLD && betGap > 0) {
                    this._automaticActions[s] = AutomaticAction.FOLD
                } else if (automaticAction & AutomaticAction.CHECK && betGap > 0) {
                    this._automaticActions[s] = null
                }/* else if (automaticAction & AutomaticAction.CALL && isContested) {
                    this._automaticActions[s] = null
                }*/ else if (automaticAction & AutomaticAction.CALL_ANY && biggestBet >= totalChips) {
                    this._automaticActions[s] = AutomaticAction.CALL
                }
            }
        }
    }

    // Make the current player act passively:
    // - check if possible or;
    // - call if possible.
    private actPassively(): void {
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        const legalActions = this._dealer.legalActions()
        if (legalActions.action & Action.BET) {
            this.actionTaken(Action.CHECK)
        } else {
            pokerAssert(legalActions.action & Action.CALL, "Call action must be legal")
            this.actionTaken(Action.CALL)
        }
    }

    private incrementButton(): void {
        pokerAssert(this._handPlayers !== undefined, "Hand players must be defined")

        if (this._buttonSetManually) {
            this._buttonSetManually = false
            this._firstTimeButton = false
            this._button = this._handPlayers[this._button]
                ? this._button
                : this._handPlayers.findIndex(player => player !== null)
            pokerAssert(this._button !== -1, "Button position must be valid")
        } else if (this._firstTimeButton) {
            const seat = this._handPlayers.findIndex(player => player !== null)
            pokerAssert(seat !== -1, "Seat index must be valid")
            this._button = seat
            this._firstTimeButton = false
        } else {
            const offset = this._button + 1
            const seat = this._handPlayers.slice(offset).findIndex(player => player !== null)
            this._button = seat !== -1
                ? seat + offset
                : this._handPlayers.findIndex(player => player !== null)
        }
    }

    private clearFoldedBets(): void {
        pokerAssert(this._handPlayers !== undefined, "Hand players must be defined")
        for (let s = 0; s < this._numSeats; s++) {
            const handPlayer = this._handPlayers[s]
            const tablePlayer = this._tablePlayers[s]
            if (!this._staged[s] && handPlayer === null && tablePlayer !== null && tablePlayer.betSize() > 0) {
                // Has folded bet
                pokerAssert(this._tablePlayers[s] !== null, "Table player must not be null")
                this._tablePlayers[s] = new Player(tablePlayer.stack())
            }
        }
    }

    private updateTablePlayers(): void {
        pokerAssert(this._handPlayers !== undefined, "Hand players must be defined")
        for (let s = 0; s < this._numSeats; s++) {
            const handPlayer = this._handPlayers[s]
            if (!this._staged[s] && handPlayer !== null) {
                pokerAssert(this._tablePlayers[s] !== null, "Table player must not be null")
                this._tablePlayers[s] = new Player(handPlayer)
            }
        }
    }

    // A player is considered active (in class table context) if
    // he started in the current betting round, has not stood up or folded.
    private singleActivePlayerRemaining(): boolean {
        pokerAssert(this.bettingRoundInProgress(), "Betting round must be in progress")
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")

        // What dealer::betting_round_players filter returns is all the players
        // who started the current betting round and have not folded. Players who
        // actually fold are manually discarded internally (to help with pot evaluation).
        const bettingRoundPlayers = this._dealer.bettingRoundPlayers()
        const activePlayers = bettingRoundPlayers.filter((player, index) => {
            return player !== null && !this._staged[index]
        })

        return activePlayers.length === 1
    }

    private standUpBustedPlayers(): void {
        pokerAssert(!this.handInProgress(), "Hand must not be in progress")
        for (let s = 0; s < this._numSeats; s++) {
            const player = this._tablePlayers[s]
            if (player !== null && player.totalChips() === 0) {
                this._tablePlayers[s] = null
            }
        }
    }

    getActionHistory(): ActionRecord[] {
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        return this._dealer.getActionHistory()
    }

    getCurrentSequence(): number {
        pokerAssert(this._dealer !== undefined, "Dealer must be defined")
        return this._dealer.getCurrentSequence()
    }
}