const lines = [
  "Coucou mon amour...",
  "Aujourd'hui, c'est ton anniversaire, et j'ai voulu te faire une surprise un peu spéciale malgré la distance qui nous sépare.",
  "J'ai créé ce petit site (pas très joli mais j'ai fait de mon mieux sah) pour te montrer à quel point tu comptes pour moi, même à des kilomètres, je ne t'oublie pas.",
  "J'espère que tu apprécieras cette surprise, et que ça te fera sourire autant que tu me fais sourire chaque jour.",
  "Je sais que ce n'est pas la même chose que d'être ensemble en personne, mais je voulais que tu saches que tu es toujours dans mes pensées, surtout aujourd'hui.",
  "Je te souhaite un très joyeux anniversaire, rempli de bonheur, d'amour et de moments inoubliables (on en passera plein ensemble tkt pas).",
  "Il y a quelque chose que je voulais te dire, quelque chose de plus personnel...",
  "J'pensais qu'avec le temps on s'habitue, qu'on aime un peu moins fort.",
  "Mais toi... plus les jours passent, plus j'ai mal à l'idée de te perdre.",
  "Je réalise à quel point tu es vitale pour moi. Je t'aime, encore plus qu'hier.",
  "Je t'aime très fort. ❤️",
  "Et surtout... on se revoit dans 1 semaine !!!",
  "Pitié montre pas ça à tes parents (c'est cringe un peu ^^ je passerais pour un puant)",
];

const textEl = document.getElementById("dialogText");
const hintEl = document.getElementById("dialogHint");
const nextButton = document.getElementById("nextStepButton");
const dialogCard = document.getElementById("dialogCard");

nextButton.hidden = true;

let lineIndex = 0;
let typingTimer = null;
let isTyping = false;
let readingDelayTimer = null;
let hasFinished = false;

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTalkBlip() {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = "square";
  osc.frequency.value = 420 + Math.random() * 180;
  gain.gain.value = 0.0001;

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  const now = audioCtx.currentTime;
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.start(now);
  osc.stop(now + 0.065);
}

function finishDiscussion() {
  if (hasFinished) {
    return;
  }

  hasFinished = true;
  hintEl.textContent = "Discussion terminée";
  nextButton.hidden = false;
  dialogCard.removeEventListener("click", nextLine);
}

function typeLine(line) {
  clearInterval(typingTimer);
  clearTimeout(readingDelayTimer);
  isTyping = true;
  textEl.textContent = "";
  hintEl.textContent = "Lecture en cours...";

  let i = 0;
  typingTimer = setInterval(() => {
    textEl.textContent += line[i];

    if (line[i] !== " " && line[i] !== ".") {
      playTalkBlip();
    }

    i += 1;

    if (i >= line.length) {
      clearInterval(typingTimer);
      isTyping = false;
      if (lineIndex === lines.length - 1) {
        hintEl.textContent = "Lis le message...";
        readingDelayTimer = setTimeout(() => {
          finishDiscussion();
        }, 1800);
      } else {
        hintEl.textContent = "Clique pour continuer";
      }
    }
  }, 35);
}

function showCurrentLine() {
  typeLine(lines[lineIndex]);
}

function nextLine() {
  if (hasFinished) {
    return;
  }

  if (isTyping) {
    clearInterval(typingTimer);
    textEl.textContent = lines[lineIndex];
    isTyping = false;
    if (lineIndex === lines.length - 1) {
      hintEl.textContent = "Lis le message...";
      clearTimeout(readingDelayTimer);
      readingDelayTimer = setTimeout(() => {
        finishDiscussion();
      }, 1800);
    } else {
      hintEl.textContent = "Clique pour continuer";
    }
    return;
  }

  if (lineIndex === lines.length - 1) {
    return;
  }

  lineIndex += 1;

  if (lineIndex < lines.length) {
    showCurrentLine();
    return;
  }
}

window.addEventListener(
  "click",
  async () => {
    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
  },
  { once: true }
);

showCurrentLine();
dialogCard.addEventListener("click", nextLine);
dialogCard.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    nextLine();
  }
});
