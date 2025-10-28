# basic rules:
# every player in the game starts with 5 dice
# dice are rolled randomly, each player can see only their own dice
# player 0 starts the game by making a bid (e.g. "3 4s" means there are at least three dice showing 4)
# the next player can either raise the bid or call "liar"
# if a player calls "liar", all dice are revealed
# if the bid was correct, the player who called "liar" loses a die
# if the bid was incorrect, the player who made the bid loses a die
# the game continues until only one player has dice left

from player import Player
from bid import Bid
from enum import Enum

class GameMode(Enum):
    STANDARD = 1
    ELIMINATION = 2
    COMMON_HAND = 3

IMPLEMENTED_MODES = [GameMode.STANDARD, GameMode.ELIMINATION]

class Game:
    def __init__(self, num_players, mode: GameMode = GameMode.STANDARD):
        self.num_players = num_players
        if mode == GameMode.COMMON_HAND and num_players != 2:
            raise Exception("Common Hand mode requires exactly 2 players.")
        # TODO: Implement logic for other game modes
        if mode not in IMPLEMENTED_MODES:
            raise Exception("Only ELIMINATION and STANDARD modes are implemented currently.")
        self.mode = mode
        self.players = [Player(i, self) for i in range(num_players)]
        self.total_dice = num_players * 5
        self.current_bid = None
        self.current_player = 0
        self.game_over = False
        self.bids = []

    def make_guess(self, player: Player, bid: Bid):
        if player.get_id() != self.current_player:
            raise Exception("It's not your turn!")
        if self.current_bid is not None:
            if bid.get_quantity() < self.current_bid.get_quantity() or (bid.get_quantity() == self.current_bid.get_quantity() and bid.get_face() <= self.current_bid.get_face()):
                raise Exception("Bid must be higher than current bid!")

            if bid.get_quantity() < 1 or bid.get_quantity() > self.total_dice or bid.get_face() < 1 or bid.get_face() > 6:
                raise Exception("Invalid bid!")
        self.bids.append(bid.to_tuple())
        self.current_bid = bid
        self.current_player = (self.current_player + 1) % self.num_players

    def call_bluff(self, player: Player):
        if player.get_id() != self.current_player:
            raise Exception("It's not your turn!")
        
        total_count = 0
        for p in self.players:
            total_count += p.get_dice().count(self.current_bid[1])
        if total_count >= self.current_bid[0]:
            # Bid was correct, caller loses a die
            loser = player
        else:
            loser = self.players[(self.current_player - 1) % self.num_players]
        
        # depending on the game mode, the loser either loses a die or is eliminated
        if self.mode == GameMode.ELIMINATION or loser.numDice == 1:
            print(f"Player {loser.get_id()} is eliminated!")
            self.players.remove(loser)
            self.total_dice -= loser.numDice
            self.num_players -= 1
            if self.current_player >= self.num_players:
                self.current_player = 0
            if self.num_players == 1:
                print(f"Player {self.players[0].get_id()} wins!")
        elif self.mode == GameMode.STANDARD:
            loser.lose_die()
            self.total_dice -= 1
        else:
            raise Exception("Only ELIMINATION and STANDARD modes are implemented currently.")

    def new_round(self):
        self.current_bid = None
        self.bids = []
        for player in self.players:
            player.shuffle()
        # current player is the last loser or the person after the last loser if they were eliminated
    def get_current_player(self):
        return self.players[self.current_player]

    def play(self):
        while self.num_players > 1:
            current_player = self.get_current_player()
            # Here you would implement the logic for the player to make a guess or call bluff
            # For simplicity, we will just print the current player's turn
            print(f"Player {current_player.get_id()}'s turn with dice: {current_player.get_dice()}")
            # This is where you would get input from the player in a real game
            # For now, we will just break the loop to avoid an infinite loop in this example
            break



