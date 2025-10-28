
from numpy import random
from bid import Bid
class Player:
    def __init__(self, id: int, game: Game):
        self.id = id
        self.numDice = 5
        self.dice = random.randint(1,6,size=self.numDice).tolist()

    def get_id(self):
        return self.id

    def shuffle(self):
        self.dice = random.randint(1,6,size=self.numDice).tolist()

    def lose_die(self):
        if self.numDice > 0:
            self.numDice -= 1

    def get_dice(self):
        return self.dice

    def guess(self, bid: Tuple[int, int]):
        bid = Bid(bid[0], bid[1], self.id)
        self.game.make_guess(self, bid)

    def call_bluff(self):
        self.game.call_bluff(self)



