
## Project Overview

Tournament of the Couples is a real-time multiplayer party game where pairs of players (teams) answer questions about each other. A host manages the game flow, asks questions, and awards points based on how well partners' answers match.

**Gameplay Flow:**
1. Players join and form pairs (teams) in the lobby
2. Host asks questions (e.g., "What's your partner's favorite movie?")
3. Each player answers independently without seeing their partner's answer
   - A timer starts at 0.00s when the round begins
   - The timer freezes when the player submits their answer
   - Response time is tracked in milliseconds
4. Host reveals both partners' answers one team at a time
   - Teams are presented to the host in order of fastest combined response time (sum of both players)
   - Within each team, players are ordered by fastest individual response time
   - Response times are revealed with a 500ms delay after the answer for emphasis
5. Host decides if answers match well enough to award a point
6. Process repeats for multiple rounds until host ends the game

**Response Time Tracking:**
- Players see a live timer (e.g., "3.42s") while answering
- Timer freezes upon submission
- If host reopens the answering phase, timers reset for all players
- Response times influence the order teams are scored (fastest first)
- This adds a speed element to the game while maintaining the core matching mechanic

## Round Variants

**Open Ended** (default)
- Players type freeform text answers
- Host manually scores based on how well answers match

**Multiple Choice**
- Host defines 2-6 options
- Players select one option
- Host manually scores based on matching selections

**Binary**
- Two options auto-filled with team member names ("Player 1", "Player 2")
- Players choose one partner's name
- Host manually scores based on matching selections

**Pool Selection**
- Players submit freeform text answers
- Once all answers are in, answers are shuffled into an anonymous pool
- Each player tries to guess which answer their partner wrote
- Correct guesses automatically award 1 point
- Host reveals pickers and authors for each answer during scoring
- Phase flow: `answering → [all answers in] → selecting → [all picks in] → scoring → next round`
