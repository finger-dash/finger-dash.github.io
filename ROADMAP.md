# Roadmap

Ideas agreed for later phases. Nothing here is implemented yet unless marked.

## Phases

1. AWS infrastructure and connection layer (in progress)
2. Online multiplayer: rooms with a share code, up to 6 players, bots in free
   lanes, server-authoritative start and results
3. Persistence (SQLite on the instance, replicated to S3): player, money, prizes
4. Training and shop
5. Career mode with different endings

## Training and career

- Decisions between races: eat, train, rest or dope.
- They affect stats such as speed, strength, stamina, fatigue and health.
- Doping gives a quick boost with risks: controls, injuries, health damage.
- Winning earns money to buy items.
- Progress and decisions lead to different endings.
- Money, stats, purchases and results are computed by the server only.

## Bothering rivals

- Hand hits and weapons such as bats, against runners in neighbouring lanes
  (in the spirit of Road Rash). Cartoon style, no blood.
- Playful items such as banana peels; more ideas welcome.
- Items are bought in the shop, equipped before the race, and triggered with
  buttons shown beside the runner.
- Define each item as data (range, duration, effect, counter).
