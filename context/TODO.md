the following is a list of todo items i want to implement.

- ✅ **COMPLETED: front end framework**
	- Successfully migrated to React + TypeScript SPA with Vite build system
	- See `context/react-migration.md` for full migration details
	- Architecture: React 19, TypeScript, React Router, Context API + useReducer
	- All pages converted to React components with proper type safety
	- Preserves all existing server-side code and Socket.io contracts

- game design
	- rounds should have _variants_. 
		- variants include:
			1. open ended: prompt + short answer (currently implemented)
			2. multiple choice: prompt + n options (radio boxes)
				- the host can choose how many responses: defaults to 2 text fields for them to input the choice, with a button to add another choice. next to each choice there is a 'remove choice' button.
			3. binary: prompt + 2 options (radio boxes)
				- binary is effectively multiple choice but with only 2 options
				- the options are prefilled with player1's name and player2's name 
		- when host is in Round Setup, they should be able to _choose_ which variant they'd like the round to be. 
	- when players submit their answers, we should track their response time in milliseconds.
		- on the player view, they should see a timer (starts at 0.00s, increments upwards). when they submit, this timer should freeze. that value should be stored with their answer. 
		- on the Scoring phase, teams are ordered by their total response time (player1 + player2 response time). players within the team are ordered by their individual response time, in increasing order. when their answer is revealed, we also see their response time, but unveiled with a slight delay to give emphasis to the time. 
		- in the case that the host re-opens the answering round, the response times should reset.

- game ux
	- clicking on the header on any page should send the user to the / page, which then would (or is supposed to, under existing logic) redirect the user to the correct page based on game/player state (/host, /player, /). for example, if the game is already started and the host loads /lobby, redirect to /host.
	- generally, the front end client display should be optimized to be responsive layouts. something to keep in mind is that most players will view the game on a mobile device, while the host will usually (but not always) be on a desktop.
	- when a player has submitted their answer, their "answer submitted" view should show their partner's submission status

- hosting
	- the host should be able to see a "end game" button, which asks the host to confirm before resetting game state and all players, returning everyone to the main page
	- when the host scores a team, the minimized team view should have a button to re-open scoring for that team (with the already-awared score taken off)

