class Bid:
    def __init__(self, quantity: int, face: int, player_id: int):
        self.quantity = quantity
        self.face = face
        self.player_id = player_id

    def get_quantity(self):
        return self.quantity

    def get_face(self):
        return self.face

    def to_tuple(self):
        return (self.quantity, self.face, self.player_id)

    def from_tuple(cls, bid_tuple):
        quantity, face, player_id = bid_tuple
        return cls(quantity, face, player_id)

    def __repr__(self):
        return f"Bid(quantity={self.quantity}, face={self.face}, player_id={self.player_id})"
