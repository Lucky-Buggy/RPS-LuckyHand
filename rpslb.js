// ===== Game data =====
const CARD_TYPES = ["rock", "paper", "scissors"];
const CARD_NAME = { rock: "Rock", paper: "Paper", scissors: "Scissors" };
const HAND_SIZE = 5;
const DEAL_TIME = 380; // ms for one card to fly from the deck

// Card artwork: one icon image per card type (see the images/ folder)
const CARD_ART = {
  rock: '<div class="art"><img src="rock.png" alt="" draggable="false"></div>',
  paper: '<div class="art"><img src="paper.png" alt="" draggable="false"></div>',
  scissors: '<div class="art"><img src="scissors.png" alt="" draggable="false"></div>'
};

// ===== Game state =====
let playerHand = [];
let computerHand = [];
let score = { player: 0, computer: 0, draws: 0 };
let isProcessing = false;      // a round is being shown
let isDealing = false;         // cards are being dealt
let dealtPlayer = 0;           // how many cards have been dealt so far
let dealtComputer = 0;
let switchUsed = false;        // the one switch per game
let switchMode = false;        // player is choosing a card to replace
let switchTargetIndex = null;  // card chosen for replacing
let freshIndex = null;         // card that was just swapped (for the flip animation)
let gameId = 0;                // lets us ignore old animations after a reset

// ===== Page elements =====
const playerHandEl = document.getElementById("player-hand");
const computerHandEl = document.getElementById("computer-hand");
const playerCountEl = document.getElementById("player-count");
const computerCountEl = document.getElementById("computer-count");
const resultPlaysEl = document.getElementById("result-plays");
const resultOutcomeEl = document.getElementById("result-outcome");
const playAgainButton = document.getElementById("play-again");
const resetButton = document.getElementById("reset");
const switchButton = document.getElementById("switch");
const confirmSwitchButton = document.getElementById("confirm-switch");
const switchHintEl = document.getElementById("switch-hint");
const deckEl = document.getElementById("deck");
const arenaEl = document.getElementById("arena");
const resetModalEl = document.getElementById("reset-modal");
const resetCancelButton = document.getElementById("reset-cancel");
const resetConfirmButton = document.getElementById("reset-confirm");

function wait(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

// ===== Card generation =====
function getRandomCard() {
  return CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
}

function generateHand() {
  const hand = [];
  for (let i = 0; i < HAND_SIZE; i++) hand.push(getRandomCard());
  return hand;
}

// ===== RPS comparison =====
// Returns "win", "lose" or "draw" from the player's point of view
function compareCards(playerCard, computerCard) {
  if (playerCard === computerCard) return "draw";
  const playerWins =
    (playerCard === "rock" && computerCard === "scissors") ||
    (playerCard === "scissors" && computerCard === "paper") ||
    (playerCard === "paper" && computerCard === "rock");
  return playerWins ? "win" : "lose";
}

// ===== Computer selection =====
function pickComputerCardIndex() {
  return Math.floor(Math.random() * computerHand.length);
}

// ===== Rendering =====
// Every card has a back face and a front face; the "up" class flips it
function createCardElement(cardType, faceUp, tag) {
  const card = document.createElement(tag || "div");
  card.className = "card" + (faceUp ? " up" : "");
  card.innerHTML =
    '<div class="inner">' +
      '<div class="face back"></div>' +
      '<div class="face front">' + CARD_ART[cardType] +
        '<div class="name">' + CARD_NAME[cardType] + '</div></div>' +
    '</div>';
  return card;
}

function renderPlayerHand() {
  playerHandEl.innerHTML = "";
  playerHandEl.classList.toggle("switching", switchMode);

  playerHand.forEach(function (cardType, index) {
    const card = createCardElement(cardType, !isDealing, "button");
    card.type = "button";
    card.setAttribute("aria-label", CARD_NAME[cardType] + " card");
    if (isDealing) card.classList.add("undealt");
    if (index === switchTargetIndex) card.classList.add("selected");
    if (index === freshIndex) card.classList.add("fresh");
    card.addEventListener("click", function () { onPlayerCardClick(index); });
    playerHandEl.appendChild(card);
  });
}

function renderComputerHand() {
  computerHandEl.innerHTML = "";
  computerHand.forEach(function () {
    const card = createCardElement("rock", false); // face never shown
    if (isDealing) card.classList.add("undealt");
    computerHandEl.appendChild(card);
  });
}

function renderCounts() {
  playerCountEl.textContent = (isDealing ? dealtPlayer : playerHand.length) + " cards";
  computerCountEl.textContent = (isDealing ? dealtComputer : computerHand.length) + " cards";
}

function renderScore() {
  document.getElementById("score-player").textContent = score.player;
  document.getElementById("score-computer").textContent = score.computer;
  document.getElementById("score-draws").textContent = score.draws;
}

function renderSwitchControls() {
  if (switchUsed) switchButton.textContent = "Switch Card (Used)";
  else if (switchMode) switchButton.textContent = "Cancel Switch";
  else switchButton.textContent = "Switch Card (1 available)";

  switchButton.disabled = switchUsed || isDealing || isProcessing || playerHand.length === 0;
  confirmSwitchButton.hidden = !switchMode;
  confirmSwitchButton.disabled = switchTargetIndex === null;

  if (!switchMode) switchHintEl.textContent = "";
  else if (switchTargetIndex === null) switchHintEl.textContent = "Tap the card you want to replace.";
  else switchHintEl.textContent = "Replace " + CARD_NAME[playerHand[switchTargetIndex]] + "? Confirm below.";
}

function renderAll() {
  renderPlayerHand();
  renderComputerHand();
  renderCounts();
  renderScore();
  renderSwitchControls();
}

function showResult(playsText, outcomeText, outcomeClass) {
  resultPlaysEl.textContent = playsText;
  resultOutcomeEl.textContent = outcomeText;
  resultOutcomeEl.className = outcomeClass || "";
}

// ===== Score / result handling =====
function updateScore(outcome) {
  if (outcome === "win") score.player++;
  else if (outcome === "lose") score.computer++;
  else score.draws++;
}

function getRoundMessage(outcome) {
  if (outcome === "win") return "You Win!";
  if (outcome === "lose") return "Computer Wins!";
  return "Draw!";
}

function showFinalResult() {
  let message = "The game is a draw!";
  let outcomeClass = "draw";
  if (score.player > score.computer) { message = "You won the game!"; outcomeClass = "win"; }
  else if (score.computer > score.player) { message = "Computer won the game!"; outcomeClass = "lose"; }

  showResult(
    "Final score: " + score.player + " - " + score.computer + " (" + score.draws + " draws)",
    message,
    outcomeClass
  );
  playAgainButton.hidden = false;
}

// ===== Player interaction =====
// Clicking a card either plays it or (in switch mode) selects it for replacing
function onPlayerCardClick(index) {
  if (isDealing || isProcessing) return;
  if (switchMode) {
    switchTargetIndex = index;
    renderPlayerHand();
    renderSwitchControls();
  } else {
    playRound(index);
  }
}

async function playRound(playerIndex) {
  isProcessing = true;
  const myGame = gameId;

  // Remove exactly the two chosen cards from the hands
  const computerIndex = pickComputerCardIndex();
  const playerCard = playerHand.splice(playerIndex, 1)[0];
  const computerCard = computerHand.splice(computerIndex, 1)[0];
  const outcome = compareCards(playerCard, computerCard);

  // Show both cards side by side; the computer's starts face down
  arenaEl.innerHTML = "";
  const playerEl = createCardElement(playerCard, true);
  const computerEl = createCardElement(computerCard, false);
  playerEl.classList.add("selected");
  arenaEl.append(playerEl, computerEl);
  showResult("", "", "");
  renderAll();

  await wait(500);
  if (myGame !== gameId) return;
  computerEl.classList.add("up"); // flip the computer's card

  await wait(800);
  if (myGame !== gameId) return;
  playerEl.classList.remove("selected");
  playerEl.classList.add(outcome === "win" ? "winner" : outcome === "lose" ? "loser" : "tie");
  computerEl.classList.add(outcome === "lose" ? "winner" : outcome === "win" ? "loser" : "tie");
  updateScore(outcome);
  renderScore();
  showResult(
    "You played " + CARD_NAME[playerCard] + "  ·  Computer played " + CARD_NAME[computerCard],
    getRoundMessage(outcome),
    outcome
  );

  await wait(700);
  if (myGame !== gameId) return;
  isProcessing = false;
  renderSwitchControls();
  if (playerHand.length === 0 || computerHand.length === 0) showFinalResult();
}

// ===== Switch card =====
function toggleSwitchMode() {
  if (switchUsed || isDealing || isProcessing) return;
  switchMode = !switchMode;
  switchTargetIndex = null;
  renderPlayerHand();
  renderSwitchControls();
}

function confirmSwitch() {
  if (switchTargetIndex === null) return;
  const oldCard = playerHand[switchTargetIndex];
  const newCard = getRandomCard(); // may be the same type again - that's allowed
  playerHand[switchTargetIndex] = newCard;

  freshIndex = switchTargetIndex; // flip animation on the new card
  switchUsed = true;
  switchMode = false;
  switchTargetIndex = null;
  renderAll();
  freshIndex = null;
  showResult("Switched " + CARD_NAME[oldCard] + " for " + CARD_NAME[newCard] + ".", "", "");
}

// ===== Dealing =====
// Sends one card from the deck to a hand, then flips it if it's the player's
function dealOne(who) {
  return new Promise(function (resolve) {
    const handEl = who === "player" ? playerHandEl : computerHandEl;
    const card = handEl.children[who === "player" ? dealtPlayer : dealtComputer];
    if (who === "player") dealtPlayer++; else dealtComputer++;
    renderCounts();

    // A temporary card back flies from the deck to the empty slot
    const from = deckEl.getBoundingClientRect();
    const to = card.getBoundingClientRect();
    const flying = document.createElement("div");
    flying.className = "flying back-design";
    flying.style.left = from.left + "px";
    flying.style.top = from.top + "px";
    flying.style.width = to.width + "px";
    flying.style.height = to.height + "px";
    document.body.appendChild(flying);

    const tilt = Math.random() * 16 - 8; // slight random rotation
    const move = flying.animate(
      [
        { transform: "translate(0, 0) rotate(0deg)" },
        { transform: "translate(" + (to.left - from.left) + "px, " + (to.top - from.top) + "px) rotate(" + tilt + "deg)" }
      ],
      { duration: DEAL_TIME, easing: "ease-out", fill: "forwards" }
    );
    move.onfinish = function () {
      flying.remove();
      card.classList.remove("undealt");
      if (who === "player") card.classList.add("up");
      resolve();
    };
  });
}

async function dealCards(myGame) {
  isDealing = true;
  dealtPlayer = 0;
  dealtComputer = 0;
  deckEl.classList.remove("empty");
  renderAll();

  deckEl.classList.add("shuffling");
  await wait(950);
  deckEl.classList.remove("shuffling");

  for (let i = 0; i < HAND_SIZE; i++) {
    if (myGame !== gameId) return;
    await dealOne("player");
    if (myGame !== gameId) return;
    await dealOne("computer");
  }
  if (myGame !== gameId) return;

  isDealing = false;
  deckEl.classList.add("empty");
  renderAll();
  showResult("Play a card, or use your one switch first.", "", "");
}

// ===== Game reset =====
function startNewGame() {
  gameId++; // any animation from the previous game stops itself
  playerHand = generateHand();
  computerHand = generateHand();
  score = { player: 0, computer: 0, draws: 0 };
  isProcessing = false;
  switchUsed = false;
  switchMode = false;
  switchTargetIndex = null;
  arenaEl.innerHTML = "";
  playAgainButton.hidden = true;
  showResult("Dealing...", "", "");
  dealCards(gameId);
}

// ===== Reset confirmation dialog =====
function openResetModal() {
  resetModalEl.hidden = false;
  resetCancelButton.focus(); // safest choice is focused by default
}

function closeResetModal() {
  resetModalEl.hidden = true;
  resetButton.focus();
}

resetButton.addEventListener("click", openResetModal);
resetCancelButton.addEventListener("click", closeResetModal);
resetConfirmButton.addEventListener("click", function () {
  resetModalEl.hidden = true;
  startNewGame();
});
// click on the dark backdrop closes the dialog
resetModalEl.addEventListener("click", function (e) {
  if (e.target === resetModalEl) closeResetModal();
});
document.addEventListener("keydown", function (e) {
  if (resetModalEl.hidden) return;
  if (e.key === "Escape") closeResetModal();
  if (e.key === "Tab") { // keep keyboard focus inside the dialog
    const first = resetCancelButton, last = resetConfirmButton;
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

playAgainButton.addEventListener("click", startNewGame);
switchButton.addEventListener("click", toggleSwitchMode);
confirmSwitchButton.addEventListener("click", confirmSwitch);

startNewGame();
