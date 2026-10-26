// ==UserScript==
// @name         Dreder Client
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  Client for drednot.io
// @author       Dreder
// @match        https://drednot.io/*
// @match        https://test.drednot.io/*
// @icon         https://raw.githubusercontent.com/Dredarker/dreder-client/refs/heads/main/Dreder%20Client%20icon.png
// @downloadURL  https://raw.githubusercontent.com/Dredarker/dreder-client/refs/heads/main/source.js
// @updateURL    https://raw.githubusercontent.com/Dredarker/dreder-client/refs/heads/main/source.js
// @grant        none
// ==/UserScript==

drederClientDebug(`STAGE 1: Initialing client...`);

// JS BRIDGE
drederClientDebug("Loading keyboard controller...")
function sendKey(key, pressed) {
    window.postMessage({
        source: "tm-drednot-keyboard",
        type: "KEY",
        key: String(key),
        pressed: Boolean(pressed)
    }, "*");
}

function pressKey(key) {
    sendKey(key, true);
}

function releaseKey(key) {
    sendKey(key, false);
}

function tapKey(key, duration = 100) {
    pressKey(key);
    setTimeout(() => {
        releaseKey(key);
    }, duration);
}

// Available in the userscript's execution context.
globalThis.drednotKeyboard = {
    pressKey,
    releaseKey,
    tapKey
};

drederClientDebug(`Controller loaded...`);

// CSS
const chatInput2CSS = `
    width: 100%;
    background: none;
    color: white;
    border: 2px solid white;
    box-sizing: border-box;
    padding: 2px;
    font-size: 16pt;
`;
const motdCotext2CSS = `
    font-size: 10pt;
    max-width: 400px;
    max-height: 300px;
    overflow-x: auto;
    overflow-y: auto;
    white-space: pre-wrap;
    word-wrap: break-word;
`;

// HTML TEMPLES
const DCicon = `<img style="height: 16px;" src="https://raw.githubusercontent.com/Dredarker/dreder-client/refs/heads/main/Dreder%20Client%20icon.png"/>`;

// JS MAIN
const DREDERCLIENT_PREFIX = `<b style="color:darkred">[DREDER CLIENT]</b>`;
const chatBox = document.getElementById("chat");
const chatInp = document.getElementById("chat-input");
const chatBtn = document.getElementById("chat-send");
const mychatContent = document.getElementById("chat-content");
const topBar = document.querySelector("#top-bar");
const motdEdit = document.getElementById("motd-edit");
const motdEditCotext = document.getElementById("motd-edit-text");
const motdCotext = document.getElementById("motd-text");
const bigUiContainer = document.querySelector('#big-ui-container');

const motdCotext2 = motdCotext.cloneNode(false);
motdCotext2.id = "motd-text2"
document.querySelector("#motd-content").prepend(motdCotext2);

let teamsearch = document.querySelector("#team_players > input");

document.querySelector("#top-bar > h1").innerHTML = "Dreder's Client";

motdCotext2.style = motdCotext2CSS;
motdCotext.style = "display: none";

const secondchatinput = chatInp.cloneNode(false);
secondchatinput.id = "chat-input2";
secondchatinput.addEventListener('keydown', function(event) {
    if (event.code == 'Enter') {
        event.preventDefault();
        let value = secondchatinput.value;
        localChat(value);
        secondchatinput.value = "";
        chatBtn.click();
    }
});
secondchatinput.style = chatInput2CSS;
chatInp.style = "display: none";
chatInp.after(secondchatinput);

const messagehistory = [];
const logins = [];
const sendingMessages = [];
var database = new Map();
var message;
var logMessage;
var start;
var executor;
var lastJoinedUser;
let rejoinOnInvite = false;
var oldonlineships = {};
var onlineships = getShips(true);
var lastjoinedshipname = "";
let DCusers = [];

// Jukebox by AI
let jukeboxPlayer = null;
let jukeboxReady = false;
let jukeboxQueue = [];
let jukeboxIndex = 0;
let jukeboxPlaying = false;
let jukeboxVolume = 100;

const jukeboxContainer = document.createElement("div");
jukeboxContainer.id = "jukebox-player";
jukeboxContainer.style.cssText = `
    position: fixed;
    width: 1px;
    height: 1px;
    left: -10px;
    top: -10px;
    opacity: 0;
    pointer-events: none;
    overflow: hidden;
`;
document.body.appendChild(jukeboxContainer);

function loadYouTubeAPI() {
    return new Promise(resolve => {
        if (window.YT && window.YT.Player) {
            resolve();
            return;
        }

        const oldCallback = window.onYouTubeIframeAPIReady;

        window.onYouTubeIframeAPIReady = () => {
            oldCallback?.();
            resolve();
        };

        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.appendChild(script);
    });
}

function getYouTubeID(url) {
    try {
        const u = new URL(url);

        if (u.hostname === "youtu.be") {
            return u.pathname.slice(1).split("/")[0];
        }

        if (u.hostname.includes("youtube.com")) {
            if (u.pathname === "/watch") {
                return u.searchParams.get("v");
            }

            if (u.pathname.startsWith("/shorts/")) {
                return u.pathname.split("/")[2];
            }

            if (u.pathname.startsWith("/embed/")) {
                return u.pathname.split("/")[2];
            }
        }
    } catch {}

    return null;
}

async function initJukebox() {
    writeChat(`${DREDERCLIENT_PREFIX} Initialing YouTube API...`, 5000);
    await loadYouTubeAPI();
    writeChat(`${DREDERCLIENT_PREFIX} YouTube API initialed`, 5000);

    jukeboxPlayer = new YT.Player("jukebox-player", {
        width: "1",
        height: "1",
        playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            playsinline: 1
        },
        events: {
            onReady: () => {
                jukeboxReady = true;
                jukeboxPlayer.setVolume(jukeboxVolume);
            },
            onStateChange: event => {
                if (event.data === YT.PlayerState.PLAYING) {
                    writeChat(`${DREDERCLIENT_PREFIX} Playing in Jukebox: <b>${jukeboxPlayer.videoTitle}</b>`, 12000);
                }
                if (event.data === YT.PlayerState.ENDED) {
                    jukeboxNext();
                }
            }
        }
    });
}

function jukeboxPlay(index = jukeboxIndex) {
    if (!jukeboxReady || !jukeboxQueue.length) return;
    jukeboxIndex = index;
    jukeboxPlaying = true;

    jukeboxPlayer.loadVideoById(jukeboxQueue[jukeboxIndex]);
    jukeboxPlayer.setVolume(jukeboxVolume);
    console.log("Jukebox now playing");
}

function jukeboxNext() {
    if (!jukeboxQueue.length) return;
    jukeboxIndex = (jukeboxIndex + 1) % jukeboxQueue.length;
    jukeboxPlay(jukeboxIndex);
}

function jukeboxPrevious() {
    if (!jukeboxQueue.length) return;
    jukeboxIndex = (jukeboxIndex - 1 + jukeboxQueue.length) % jukeboxQueue.length;
    jukeboxPlay(jukeboxIndex);
}

function jukeboxToggle(play) {
    if (!jukeboxReady) return;

    if (play) {
        if (!play) jukeboxPlayer.pauseVideo();
        else jukeboxPlayer.playVideo();
        jukeboxPlaying = play;
        return;
    }
    if (jukeboxPlaying) {
        jukeboxPlayer.pauseVideo();
        jukeboxPlaying = false;
    } else {
        jukeboxPlayer.playVideo();
        jukeboxPlaying = true;
    }
}

function jukeboxSetVolume(value) {
    jukeboxVolume = Math.max(0, Math.min(100, value));
    if (jukeboxReady) {
        jukeboxPlayer.setVolume(jukeboxVolume);
    }
}

function jukeboxSetURL(url) {
    const id = getYouTubeID(url);
    jukeboxToggle(false);
    jukeboxPlaying = false;
    if (!id) return;
    if (jukeboxQueue.length === 1 &&
        jukeboxQueue[0] === id) {
        return;
    }
    jukeboxQueue = [id];
    jukeboxIndex = 0;
    jukeboxPlay(0);
    console.log("Jukebox URL set to",url);
}

drederClientDebug(`Initialing Jukebox...`);
initJukebox();



var myUsername = "";
try {myUsername = document.getElementsByClassName("user")[0].textContent}
catch (err) {
	observeNode(bigUiContainer, () => {
		myUsername = document.getElementsByClassName("user")[0].textContent;
	}, false);
}
drederClientDebug(`Resolved nickname ${myUsername}`);

drederClientDebug(`Loading nihya...`);
if (sessionStorage.getItem("runAsBot") === null) sessionStorage.setItem("runAsBot", false);
if (localStorage.getItem("database") === null) localStorage.setItem("database", JSON.stringify(Object.fromEntries(database.entries())));
else database = new Map(Object.entries(JSON.parse(localStorage.getItem("database"))));

const databaseFunc = {};
databaseFunc.save = function() {
	return localStorage.setItem("database", JSON.stringify(Object.fromEntries(database.entries())));
};
databaseFunc.set = function(who, key, value) {
	if (!database.has(who)) database.set(who, {});
	database.get(who)[key] = value;
	databaseFunc.save();
	return value;
};
databaseFunc.add = function(who, key, value) {
	if (!database.has(who)) {
		database.set(who, {});
		database.get(who)[key] = 0;
	}
	database.get(who)[key] += value;
	databaseFunc.save();
	return value;
};
databaseFunc.addToArray = function(who, key, value) {
	if (!database.has(who)) {
		database.set(who, {});
		database.get(who)[key] = [];
	}
	database.get(who)[key].push(value);
	databaseFunc.save();
	return database.get(who)[key];
};
databaseFunc.createKey = function(who, key, value) {
    if (!database.get(who).hasOwnProperty(key)) databaseFunc.set(who, key, value);
    return value;
};
databaseFunc.createUpdateUser = function(who, isOnline = false) {
    if (!database.has(who)) database.set(who, {});
    databaseFunc.createKey(who, "rep", 0);
    databaseFunc.createKey(who, "money", 0);
    databaseFunc.createKey(who, "isStaff", false);
    databaseFunc.createKey(who, "vipTime", new Date(0));
    databaseFunc.createKey(who, "ai_sysprompt", "");
    databaseFunc.createKey(who, "banmoney", false);
    databaseFunc.createKey(who, "casinoWarned", false);
    databaseFunc.createKey(who, "blacklisted", false);
    databaseFunc.createKey(who, "blacklistedReason", "");
    databaseFunc.createKey(who, "blacklistedProof", "");
    databaseFunc.createKey(who, "achievements", []);
    databaseFunc.createKey(who, "paiditems", []);
    databaseFunc.createKey(who, "aimodel", "stupid")

    if (isOnline) {
        databaseFunc.set(who, "oldlastdetecttime", database.get(who).lastdetecttime || new Date(0))
        databaseFunc.set(who, "lastdetecttime", new Date())
    } else if (!database.get(who).lastdetecttime) {
        databaseFunc.set(who, "lastdetecttime", new Date(0));
    }

    return database.get(who);
};

databaseFunc.set("SYSTEM", "history", []);
database.forEach((player, playerNickname) => {
	if (playerNickname !== "SYSTEM") databaseFunc.createUpdateUser(playerNickname);
});

drederClientDebug(`Loading sounds...`);
const soundpadfile = "https://github.com/Dredarker/Dredarker.github.io/raw/refs/heads/main/sounds/";
const soundpad = {
	//huhChine: new Audio(soundpadfile+"chinese-huh-sound-effect.mp3"),
	//suspence: new Audio(soundpadfile+"attetion.mp3"),
	//achtung: new Audio(soundpadfile+"achtung.mp3"),
	armatura: new Audio(soundpadfile+"арматура.mp3"),
	join: new Audio(soundpadfile+"user_join.mp3"),
	leave: new Audio(soundpadfile+"user_leave.mp3"),
	message: new Audio(soundpadfile+"telegram_message.mp3"),
	messageFromMe: new Audio(soundpadfile+"whatsappIshodashiy.mp3"),
	messageFromSystem: new Audio(soundpadfile+"systemVhodyashiy.mp3"),
};

drederClientDebug(`Loading help book...`);
const helpBook = [
	`Main: !help [number], !stats [(nick)], !achieves [(nick)], !voteban <y/n/(nick)>, !dice, !luck, !ai (question) !aimodel (model), !casino (bet), !paiditems [(nick)]`,
	//`Role Play: SOON`,
	`Vips: !modifyai`,
	`Staff: !kick (nick), !databaseset (nick)/(parameter)/(value), !databaseget (nick)[/(parameter)], !blacklist (nick)/(reason)[/(proof)], !grant (nick)/(achieve), !givepaiditem (nick)/(paid item)`,
	`Dev: !restart, !execute (code), !say (string)`
];

drederClientDebug(`Loading facts...`);
const facts = [
	"а вы знали что если в 3 часа ночи пойти на кухню и 67 раз сказать:\"тунг тунг тунг сахур\" то придет страшное существо под именем мама и даст вам пизды?",
	"а вы знали что зубы не надо чистить самолетом боинг а надо чистить зубной щеткой?",
	"а вы знали что в печенье не надо добавлять уран?",
	"а вы знали что если посрать то увас упадет пиздацелин?",
	"а вы знали что домик 2 выйдет 4 сентября 2734 года?",
	"а вы знали что Екатерина II почесалась в год своего правления?",
	"а вы знали что мухаммед ебал аишу 6 лет?",
// 	"а вы знали что мама драгона настолько большая что образовала чёрную дыру TON-618?",
	"а вы знали что по дождливым четвергам в октябре 09876543210987654321 дрочит на гуро?",
	"а вы знали что майзен берг фурри?",
// 	"а вы знали что 09876543210987654321 перепутал маму габена и маму нолана с мамой драгона?",
	"а вы знали что nishe1e нравятся кинефотрагофичные анимации",
	"а вы знали что у дредера есть игра Cubix?",
	"а вы знали что первый прототип Cubix был создан в Scratch?",
	"а вы знали что до Cubix были ещё 5 прототипов (3 в GDevelop, 2 в Scratch/PenguinMod)?",
	"а вы знали что химан любит помурлычать?",
	"а вы знали что химан ОСОБЕННО любит абьюзить админку?",
	"а вы знали что отчим химана пошёл на сво и сдох как кабан?",
	"а вы знали что тимс имеет скин бургера в бонке.ио?",
	"а вы знали что тимс имеет костюм горничной?",
	"а вы знали что Дредер ИИ создан на *ВЫРЕЗАНО*?",
	"а вы знали что код клиента дредера имеет 10% импорта?",
	"а вы знали что бот использует вкладки как модули?",
	"а вы знали что в клиенте дредера есть Jukebox?",
];

drederClientDebug(`Loading laskovie slova...`);
const laskovieSlova = [
    "Слушаюсь, ",
    "Да, я слушаюсь вас, ",
    "Чем помочь, ",
    "Могу помочь, ",
    "Что у вас, ",
    "Что там, ",
    "Что надо, ",
];

const prettyenglishsymbols = "ᴀʙᴄᴅᴇғɢʜɪᴊᴋʟᴍɴᴏᴘǫʀsᴛᴜᴠᴡxʏᴢ";
const englishsymbols = "abcdefghijklmnopqrstuvwxyz";
const russiantranskriptsymbols = "аб☺дефгхижклмнопкрстювдкуз";

// load last messages of chat
/*
drederClientDebug("Loading last messages of chat...")
for (let message of database.get("SYSTEM").history) {writeChat(message)}
for (let i of mychatContent.children) {
	i.classList.remove("recent");
}
*/

setInterval(() => {if (sendingMessages.length > 0) realsendChat(sendingMessages.shift())}, 1200);

drederClientDebug(`Starting ships anounser...`);
setInterval(async () => {
    if (!getPageTitle().includes(" - ")) return;
    oldonlineships = onlineships;
    onlineships = await getShips(true);
    for (let shipId in onlineships) {
        if (!oldonlineships[shipId]) {
            let thisship = onlineships[shipId];
            writeChat(`${DREDERCLIENT_PREFIX} Opened ship <b style="color:${thisship.color}">${thisship.team_name} {${thisship.hex_code}}</b>`, 10000);
        }
    }
}, 5*60*1000);

drederClientDebug(`Starting shiplist refresher on menu...`);
setInterval(async () => {
    if (getPageTitle().includes(" - ")) return;
    try {document.querySelector("#shipyard > div.window.dark > section:nth-child(4) > button").click()} catch (e) {}
}, 10*1000);



drederClientDebug(`Loading configuration...`);
let antiafk = false;
let antiafkTimer = null;
let votes = 0;
const client = {
    prettyenglish: false,
    russiantranskript: false,
    perms: [
        //"insult-answer",
    ],
};
const bot = {
    active: false,
    cooldown: 0,
    startcooldownms: 5000,
    vote: {
        who: "",
        yes: [],
        no: [],
        timer: null
    },
    perms: [
        //"exam",
        //"viktorina",
        "voteban",
        "greet-joined-players",
        "ai",
        "ai-on-ping",
        //"ban-blacklisted-users",
        //"gjp-say-banned-players-count",
        //"insult-answer",
        //"no-link",
        //"action-on-teamlog",
        "/home-on-zone-switch",
        "movable-by-commands",
    ],
    exam: "",
    examhowmanyoperations: 0,
    exammoneyaward: 0,
    examanswer: null,

    viktorinaanswer: "",
    viktorinawronganswers: [],
    viktorinamoneyaward: 0,
    viktorinatimer: null,

    pollanswers: [],
    pollanswersusers: {},
    polltimer: null,

    ai_answering: false,

    hears: "",
};
const constVarsForStaff = [
    "isStaff",
    "lastdetecttime",
    "rep",
];



// Key binds
drederClientDebug(`Appending keybinds...`);
addEventListener("keydown", () => {
    switch (event.code) {
        case "Escape":
            /*
            const refreshBtn = document.getElementsByClassName("btn-small")[10];
            refreshBtn.click();
            */
            // returnToMenu();
            break;
        case "End":
            bot.active = !bot.active;
            writeChat(`${DREDERCLIENT_PREFIX} Bot ${bot.active ? "":"de"}activated.`, 4000);
            sendChat("[BOT] "+bot.active ? "Bot activated. Say \"!help\" to get commands" : "Bot deactivated");
            sessionStorage.setItem("runAsBot", bot.active);
            if (bot.active) start = new Date();
            document.getElementById("team_manager_button").click();
            setTimeout(() => document.getElementById("team_manager_button").click(), 1000);
            break;
        case "Home":
            antiafk = !antiafk;
            if (antiafk) {
                antiafkTimer = setInterval(() => {
                    if (bot.perms.includes("exam")) {
                        bot.exam = null;
                        bot.examhowmanyoperations = Math.round(Math.random()*5+2);
                        for (let i = 0; i < bot.examhowmanyoperations; i++) {
                            let operation = "+-*/".substr(Math.round(Math.random()*3), 1);
                            if (i!=0) bot.exam += operation;
                            let e = Math.round(Math.random()*3+1);
                            bot.exam += "*/".includes(operation) && i!=0 ? (e==3 ? e-1 : e) : Math.round(Math.random()*98+1);
                        }
                        bot.examanswer = eval(bot.exam);
                        sendChat("[BOT] "+bot.exam+"=?");
                    } else if (bot.perms.includes("viktorina")) {
                        startViktorina();
                    } else {
                        for (let playerNickname of getPlayers()) {databaseFunc.add(playerNickname,"money",1)}
                        sendChat("[BOT] "+facts[Math.floor(Math.random()*facts.length)]);
                    }
                }, 4*60*1000);
            } else {
                clearInterval(antiafkTimer);
            }
            writeChat(`${DREDERCLIENT_PREFIX} AFK now is ${antiafk ? `on (bot says ${bot.perms.includes("exam")?"examples":"facts"})` : "off"}`, 5000);
            break;
        case "Enter":
            setTimeout(() => {
                if (!chatBox.classList.contains('closed')) {
                    secondchatinput.focus();
                }
            }, 100);
            break;
        case "Tab":
            let players = getPlayers();
            if (players.length == 1) {
                writeChat(`${DREDERCLIENT_PREFIX} You're there alone ;-(`, 5000);
                return;
            }
            let displayplayers = ""
            players.forEach((name,idx) => {
                displayplayers += `<b>${name}</b>`
                if (DCusers.includes(name)) displayplayers += DCicon;
                if (idx+1 != players.length) displayplayers += ', ';
            });
            writeChat(`${DREDERCLIENT_PREFIX} There are ${players.length} players: ${displayplayers}`, 10000)
            break;
        case "Insert":
            if (dcsUI.style.display === "block") {
                dcsUI.style.display = "none";
            } else {
                dcsUI.style.display = "block";
            }
            break;
    }
});
async function startViktorina() {
    bot.viktorinaanswer = null;
    sendChat("[BOT] "+"Time to viktorina! (be ready)");

    const res = await fetch("https://opentdb.com/api.php?amount=1&type=multiple");
    const data = await res.json();
    const json = data.results[0];

    bot.viktorinaanswer = json.correct_answer.toLowerCase();
    bot.viktorinawronganswers = json.incorrect_answers;
    for (let wrongansweridx in bot.viktorinawronganswers) {
        bot.viktorinawronganswers[wrongansweridx] = bot.viktorinawronganswers[wrongansweridx].toLowerCase()
    }
    let difvalue = 0;
    if (json.difficulty == "easy") difvalue = 0.5;
    else if (json.difficulty == "medium") difvalue = 1;
    else if (json.difficulty == "hard") difvalue = 2;

    let time = difvalue*20;
    bot.viktorinamoneyaward = difvalue*20;

    bot.viktorinatimer = setTimeout(() => {
        bot.viktorinaanswer = "";
        sendChat("[BOT] "+"No answer got, viktorina is ended.");
    }, time*1000+3500);

    let displayanswers = bot.viktorinawronganswers.concat(bot.viktorinaanswer).sort(compareRandom);
    sendChat("[BOT] "+"QUESTION: "+data.results[0].question);
    sendChat("[BOT] "+`Avaliables answers: ${displayanswers.join(", ")}`);
    sendChat("[BOT] "+`Gives ${time} seconds to give answer.`)
}



let div = document.createElement("div");
div.textContent = "/4096";
div.id = "lengthOfEditMOTD";
motdEdit.append(div);
let lengthOfEditMOTD = div;
div = undefined;

motdEditCotext.oninput = function() {
    lengthOfEditMOTD.textContent = `${motdEditCotext.value.length}/${motdEditCotext.maxLength}`;
};





function readText(string, symbol = " ", mode = "after") {
    let i = string.indexOf(symbol);
    return mode === "before" ? string.slice(0, i) : mode === "after" ? string.slice(i+1) : undefined;
}
/*
let result = "";
function nextArgument(str) {
    pos++;
    while ((pos = str.indexOf(" ", pos + 1)) === -1) {
        console.log(pos+"; "+str+"; "+str[pos]);
        result = result + str[pos];
    }
}
*/
function sliceRankAndGetUsername(userWithRank) {
    if (userWithRank.startsWith("[Captain] ")) return userWithRank.slice(10);
    else if (userWithRank.startsWith("[Crew] ")) return userWithRank.slice(7);
    else return userWithRank;
}
function sliceUsernameAndGetVisualRank(userWithRank) {
    if (userWithRank.startsWith("[Captain] ")) return "<b>[<b style='color:cyan'>Captain</b>]</b> ";
    else if (userWithRank.startsWith("[Crew] ")) return "<b>[<b style='color:yellow'>Crew</b>]</b> ";
    else return "";
}
function sliceUsernameAndGetRank(userWithRank) {
    if (userWithRank.startsWith("[Captain] ")) return "captain";
    else if (userWithRank.startsWith("[Crew] ")) return "crew";
    else return "guest";
}

function cancelVoting() {
    sendChat("[BOT] "+`Voting to ban ${bot.vote.who} is extreno ended`);
    bot.vote = {
        who: "",
        yes: [],
        no: []
    };
    clearTimeout(bot.vote.timer);
}



drederClientDebug(`Starting MOTD refresher...`);
setInterval(() => {
    if (bot.active) {
        let indexoftag = document.getElementById("motd-text").textContent.indexOf('<BOTSTATS>');
        if (indexoftag != -1) {
            let time = Math.floor(( ( new Date() - start )) / 1000);
            let s = time % 60;
            let m = Math.floor(time / 60) % 60;
            let h = Math.floor(time / 3600) % 60;

            let otherMOTD = motdCotext.textContent.slice(0, indexoftag);
            setMotd(`${otherMOTD}<BOTSTATS>
    Live time: ${h}h ${m}m ${s}s
    Last message: ${message}
    Last log message: ${typeof(logMessage) == "string" ? logMessage : logMessage.previousSibling.textContent}`);
        }
    }
}, 10000);



drederClientDebug(`Setting chat observer...`);
let chatObserver = new MutationObserver(async (mutationRecords) => {
    let newNode = mychatContent.lastChild; //mutationRecords[0].addedNodes[0];
    try {
    	message = newNode.innerText;
    } catch (err) {}
    if (message.startsWith("WARNING: Please be careful who you trust!")) {
        newNode.remove();
        return;
    }
    localStorage.setItem("saved-chat", mychatContent.innerHTML);
    let text = readText(message, ":");
    if (message.includes(": ")) text = text.slice(1);
    let executorWithRank = readText(message, ":", "before")
    let executor = sliceRankAndGetUsername(executorWithRank);
    let visualrank = sliceUsernameAndGetVisualRank(executorWithRank);
    let rank = sliceUsernameAndGetRank(executorWithRank);
    let isDCuser = DCusers.includes(executor);

    let executorIsStaff = false;
	let executorVipTime = new Date(0);
    let executorIsVip = false;
	try {
		executorIsStaff = database.get(executor).isStaff;
		executorVipTime = database.get(executor).vipTime;
		executorIsVip = new Date() < executorVipTime;
    } catch (err) {}
    messagehistory.push({role: "user", content: `${executor}: ${text}`});
    if (messagehistory.length >= 500) messagehistory.shift();
    if (
        !message.startsWith("[HISTORY]")
        && !message.startsWith("[DREDER CLIENT]")
    ) databaseFunc.addToArray("SYSTEM", "history", `[HISTORY] ${message}`);
    if (message.startsWith("Joined ship ")) {
        lastjoinedshipname = message.slice("Joined ship '".length, message.length-"' {AAAAAA}".length);
    	setTimeout(() => {
    		for (let playerNickname of getPlayers()) {
    			databaseFunc.createUpdateUser(playerNickname, true);
    		}
    	}, 1850)
    }
    if (message.endsWith(" joined the ship.")) {
		lastJoinedUser = sliceRankAndGetUsername(message.slice(0, message.search(" joined the ship.")));
		databaseFunc.createUpdateUser(lastJoinedUser, true);
    }
    if (!text.startsWith("[ATERNOS]") || executor !== myUsername) {
        broadcastToOtherTab(message, "");
    }
    if (false && executor == "Warning" && "A  Safety Anchor was destroyed!") {
        for (let i = 0; i<15; i++) {
            sendChat("[BOT] "+"ВООООООООООООР")
        }
    }
    if (text.startsWith("!")) {
        if (new Date() > bot.cooldown || executorIsVip || executorIsStaff) {
            bot.cooldown = new Date(Date.now()+bot.startcooldownms);
        } else {
            return;
        }
    }
    if (
        message.includes(": ")
        && !executor.startsWith("[SYSTEM]")
        && !executor.startsWith("[DREDER CLIENT]")
        && executor
    ) replaceHTML(newNode,`${visualrank}<b>${executor}</b>${isDCuser?DCicon:""}: ${text}`);
    if (executor !== myUsername) insultAnswer(text);
    if (isBlacklisted(executor)) {
        replaceHTML(newNode,`<b>${executor}</b> (BLACKLISTED): ${"*".repeat(Math.ceil(text.length/3))}`)
    } else if (bot.active) {
        let args = text.split(' ');
        const command = args[0];

        let stringarg = sliceArgs(args,0);
        let stringarg1 = sliceArgs(args,1);

        stringarg = stringarg.slice(0,200);
        console.debug(`[CHAT] ${executor}: ${args}`);
        if (command === "!help") {
            let msg;
            let arg2 = args[1];
            if (arg2 > 0 && arg2 <= helpBook.length) {
                msg = helpBook[Number(arg2)-1];
            } else if (!arg2) {
                msg = helpBook[0];
            } else {
                msg = `Wrong, use !help (1 to ${helpBook.length})`;
            }
            sendChat("[BOT] "+msg);
        } else if (command === "!voteban" && bot.perms.includes("voteban")) {
        	if (!myPlayerIsCap()) {
        		sendChat("[BOT] "+"This command can't be ran by not having cap");
        		return;
        	}
            let arg = text.slice(9,39);
            if (bot.vote.who === "") {
                if (arg === executor || arg === myUsername) {
                    sendChat("[BOT] "+arg === executor ? "You can't voteban self" : "Nice try :)");
                } else {
                	let foundedPlayer = null;
        			for (let playerNickname of getPlayers()) {if (playerNickname.startsWith(arg)) foundedPlayer = playerNickname}
        			if (!foundedPlayer) {
        				sendChat("[BOT] "+"There are no player with nickname "+arg)
        				return;
        			}
        			arg = foundedPlayer;

                    let targetIsStaff = database.get(arg).isStaff;
                    let targetIsVip = database.get(arg).vipTime > new Date();
                    if (!targetIsStaff && !targetIsVip) {
                        bot.vote.yes = [executor]; bot.vote.no = [];
                        bot.vote.who = arg;
                        sendChat("[BOT] "+`Poll to ban ${bot.vote.who} is started!
                        Say '!voteban y' if agree or '!voteban n', if disagree.
                        You have 60 seconds`);
                        bot.vote.timer = setTimeout(function() {
                            if (votes >= 3) {
                                sendChat("[BOT] "+`/ban ${bot.vote.who}`);
                                sendChat("[BOT] "+`${bot.vote.who} was successfully banned from ship`);
                                bot.vote.who = "";
                            } else {
                                sendChat("[BOT] "+`Not enough ${3-votes} votes to ban ${bot.vote.who}, voting is end`);
                                bot.vote.who = "";
                            }
                        }, 60000);
                    } else {
                        sendChat("[BOT] "+"You can't start poll to ban opposite staff/vip!");
                    }
                }
            } else if (executor == bot.vote.who) sendChat("[BOT] "+"You can't vote to ban while votes opposite you");
            else {
                let isVoted = bot.vote.yes.includes(executor) || bot.vote.no.includes(executor);
                if (isVoted) sendChat("[BOT] "+`You are already voted to ban ${bot.vote.who}!`);
                else {
                    if (arg === "y") {
                        bot.vote.yes.push(executor);
                        votes = bot.vote.yes.length - bot.vote.no.length;
                        sendChat("[BOT] "+`${executor} is agree to ban (${votes}/3)${votes >= 3 ? ". Death is near! :))))" : votes < 0 ? `. I think, chance to ban ${bot.vote.who} equals to 0...` : ""}`);
                    } else if (arg === "n") {
                        bot.vote.no.push(executor);
                        votes = bot.vote.yes.length - bot.vote.no.length;
                        sendChat("[BOT] "+`${executor} is disagree to ban (${votes}/3)${votes < 0 ? ". Bruh, we bug the bot x-x" : votes == 2 ? ". NO NO NO NO NO" : ""}`);
                    } else sendChat("[BOT] "+"Vote pls!");
                }
            }
        } else if (command === "!kick") {
            let arg = stringarg;
            let foundedPlayer = null;
        	for (let playerNickname of getPlayers()) {if (playerNickname.startsWith(arg)) foundedPlayer = playerNickname}
        	if (!foundedPlayer) {
        		sendChat("[BOT] "+"There are no player with nickname "+arg)
        		return;
        	}
        	arg = foundedPlayer;
            if (executorIsStaff) {
                let targetIsStaff = database.get(arg).isStaff;
                if (!targetIsStaff) {
                    sendChat("[BOT] "+"/kick "+arg);
                } else {
                    sendChat("[BOT] "+"You can't kick other staff")
                }
            } else {
                sendChat("[BOT] "+"You aren't staff!")
            }
        } else if (command === "!databaseset") {
            if (!executorIsStaff) {
                sendChat("[BOT] "+"You aren't staff!");
                return;
            }
            let advancedargs = stringarg.split("/");
            let target = advancedargs[0];
            let variable = advancedargs[1];
            let value = advancedargs[2];

            if (!database.has(target)) {
        		sendChat("[BOT] "+`Not found player with nickname "${target}" in database`)
        		return;
        	}
            if (constVarsForStaff.includes(variable) && !isDev(executor)) {
                sendChat("[BOT] "+`You can't set variable "${variable}"`);
                return;
            }

            if (value === "true") {value = true}
            else if (value === "false") {value = false}
            else {try {if (tmp = parseFloat(value)) value = tmp} catch (err) {}};

            if (!database.get(target).isStaff || executor === target || isDev(executor)) {
                databaseFunc.set(target,variable,value)
                sendChat("[BOT] "+`Successfully set ${variable} of ${target} to ${value} (${typeof(value)})`);
            } else {
                sendChat("[BOT] "+"You can't change data of other staff")
            }
        } else if (command === "!databaseget") {
            if (!executorIsStaff) {
                sendChat("[BOT] "+"You aren't staff!");
                return;
            }

            let advancedargs = stringarg.split('/');
            let target = advancedargs[0];

            let targetData = database.get(target);
            let targetDataString = [];
            for (let variable in targetData) {
                let value = targetData[variable];
                if (typeof(value) === "string") value = `"${value}"`;
                targetDataString.push(variable+": "+value);
            }

            sendChat("[BOT] "+target+" | "+targetDataString.join(", "));
        } else if (command === "!grant") {
            if (!executorIsStaff) {
                sendChat("[BOT] "+"You aren't staff!");
                return;
            }

            let advancedargs = stringarg.split('/');
            let target = advancedargs[0];
            let achieve = advancedargs[1];

            databaseFunc.addToArray(target,"achievements",achieve);

            sendChat("[BOT] "+`Successful granted "${achieve}" to ${target}`);
        } else if (command === "!givepaiditem") {
            if (!executorIsStaff) {
                sendChat("[BOT] "+"You aren't staff!");
                return;
            }

            let advancedargs = stringarg.split('/');
            let target = advancedargs[0];
            let paiditem = advancedargs[1];

            databaseFunc.addToArray(target,"paiditems",paiditem);

            sendChat("[BOT] "+`Successful added item "${paiditem}" to ${target}`);
        } else if (command === "!restart") {
            if (isDev(executor)) {
                restartClient();
            } else {
                sendChat("[BOT] "+"Only dev can restart bot!");
            }
        } else if (command === "!why") {
            let target = stringarg;
            if (isBlacklisted(target)) {
                let reason = database.get(target).blacklistedReason;
                if (reason) {
                    sendChat("[BOT] "+`${target} blacklisted by reason "${reason}"`);
                } else {
                    sendChat("[BOT] "+`${target} blacklisted without reason`);
                }
            } else {
                sendChat("[BOT] "+`${target} not blacklisted`);
            }
        } else if (command === "!execute") {
            if (isDev(executor)) {
                let arg = text.slice(8);
                sendChat("[BOT] "+eval(arg));
            } else {
                sendChat("[BOT] "+"Only dev can execute code!");
            }
        } else if (command === "!say") {
            if (isDev(executor)) {
                let arg = text.slice(5);
                sendChat("[BOT] "+arg);
            } else {
                sendChat("[BOT] "+"Only dev can say from bot!");
            }
        } else if (command === "!dice") {
			sendChat("[BOT] "+`${executor} got ${Math.round(Math.random() * 5 + 1)}`);
        } else if (command === "!luck") {
			sendChat("[BOT] "+`${executor} is ${Math.round(Math.random()) ? "lucky" : "unlucky"}`);
        } else if (command === "!transfer") {
            if (isNaN(args[1])) {
                sendChat("[BOT] "+`the argument #1 must be number!`);
                return;
            }

            let user = stringarg1;
            if (!database.has(user)) {
            	sendChat("[BOT] "+`Player "${user}" not found in database`);
            	return;
            } else if (database.get(executor).money < args[1]) {
            	sendChat("[BOT] "+`You have only D$${database.get(user).executor}.`);
            	return;
            } else if (args[1] < 5) {
            	sendChat("[BOT] "+`You can't send to other player less than D$5`);
            	return;
            }
            databaseFunc.add(executor, "money", parseInt(-args[1]));
            databaseFunc.add(user, "money", parseInt(args[1]));
            sendChat("[BOT] "+`Successful spent D$${args[1]} to ${user}. (Now your balance: D$${database.get(executor).money}, balance of target: D$${database.get(user).money})`);
        } else if (command === "!who" || command === "!stats") {
			let user = stringarg;
            if (user === "im" || user === "me" || user === "") user = executor;
            if (!database.has(user)) {
            	sendChat("[BOT] "+`Player "${user}" not found in database`);
            	return;
            }
            let tmpvip = new Date() < database.get(user).vipTime ? ", is VIP" : "";
            let tmpstaff = database.get(user).isStaff ? ", is Staff" : "";
            let tmpblacklisted = isBlacklisted(user) ? ", blacklisted" : "";
			sendChat("[BOT] "+`${user} | D$${database.get(user).money}, AI rep: ${database.get(user).rep}${tmpvip}${tmpstaff}${tmpblacklisted}`);
        } else if (command === "!achieves") {
			let user = stringarg;
            if (user === "im" || user === "me" || user === "") user = executor;
            if (!database.has(user)) {
            	sendChat("[BOT] "+`Player "${user}" not found in database`);
            	return;
            }
			sendChat("[BOT] "+`${user} | ${database.get(user).achievements.join(", ")}`);
        } else if (command === "!paiditems") {
			let user = stringarg;
            if (user === "im" || user === "me" || user === "") user = executor;
            if (!database.has(user)) {
            	sendChat("[BOT] "+`Player "${user}" not found in database`);
            	return;
            }
			sendChat("[BOT] "+`${user} | ${database.get(user).paiditems.join(", ")}`);
        } else if (command === "!casino") {
            if (args[1] === "confirm") {
                databaseFunc.set(executor, "casinoWarned", true);
                sendChat("[BOT] "+`You are warned about no guarantee in casino. Now you can use !casino (bet)`);
            	return;
            } else if (isNaN(args[1])) {
                sendChat("[BOT] "+`the argument #1 must be number/'confirm'!`);
                return;
            } else if (!database.get(executor).casinoWarned) {
            	sendChat("[BOT] "+`WARNING! Problem gambling is bad!
            	There is no guarantee that you won't lose your ENTIRE balance!
            	Heed our warning. If you are certain, type !casino confirm`);
            	return;
            } else if (database.get(executor).money < args[1]) {
            	sendChat("[BOT] "+`You don't have D$${args[1]-database.get(executor).money} to play casino.`);
            	return;
            } else if (args[1] < 50) {
            	sendChat("[BOT] "+`You can't play casino with bet less at D$50.`);
            	return;
            } else if (args[1] > database.get(executor).money/2) {
            	sendChat("[BOT] "+`You can't play casino with bet more at half of your balance.`);
            	return;
            }

            let bet = args[1];
            databaseFunc.add(executor, "money", -bet);

            let factor = 1;
            let random = Math.round(Math.random()*100);
            if (random < 75) factor = 0;
            else if (random < 82) factor = 0.5;
            else if (random < 90) factor = 1;
            else if (random < 95) factor = 2;
            else if (random < 98) factor = 4;
            else if (random < 100) factor = 16;
            else factor = 100;
            bet *= factor;

            if (random < 50) sendChat("[BOT] "+"You Loser...");
            else if (random < 75) sendChat("[BOT] "+"Ow =(");
            else if (random < 90) sendChat("[BOT] "+"fuh");
            else if (random < 95) sendChat("[BOT] "+"YEEEEEEEEEEEES");
            else if (random < 98) sendChat("[BOT] "+"OH MY GOOOOOOD");
            else if (random < 100) sendChat("[BOT] "+"SUIIIIIIIIIIIIIIII");
            else sendChat("[BOT] "+"JACKPOOOOOOOOOOOOOOOOOT!!!!!!!!!!!");

            /*
            for (let i = 0; i < Math.ceil(Math.random()*10); i++) {
                sendChat("[BOT] "+`The factor is ${String(Math.random()*5).slice(0,2)}...`)
            }
            sendChat("[BOT] "+`The factor is ${factor}.`)
            */
            databaseFunc.add(executor, "money", bet)
            sendChat("[BOT] "+`${executor} got D$${args[1]} x ${factor} = D$${args[1]*factor}, chance ${random}% (now balance is D$${database.get(executor).money})`)
        } else if (
            bot.perms.includes("ai")
        	&& (
        		command === "!ai"
        	) || (
                bot.perms.includes("ai")
        		&& bot.perms.includes("ai-on-ping")
        		&& (
        			text.toLowerCase().startsWith("дредерии")
        			|| text.toLowerCase().startsWith("drederai")
        		)
        	)
        ) {
        	if (bot.ai_answering) return;
        	let aiModel = database.get(executor).aimodel;
        	let cost = 200;
        	if (aiModel === "boryart") {
        	    cost = 4000;
        	} else if (aiModel === "stupid") {
        	    cost = 500;
        	}

        	if (database.get(executor).money < cost) {
        	    sendChat("[BOT] "+`You don't have D$${cost-database.get(executor).money} to answer AI`)
        	    return;
        	}
        	let lastmessagecontent = messagehistory.at(-1).content;
        	if (lastmessagecontent.length-executor.length-2 < 5) {
        		sendChat("[BOT] "+"Please, your message must not empty or not less than 5 symbols");
        		return;
        	}
        	database.get(executor).money -= cost;
        	bot.ai_answering = true;
            broadcastToOtherTab({
                messagehistory,
            	executor,
	            database: Object.fromEntries(database.entries()),
            	shipInfo: {players: getPlayers(), MOTD: getMotd()},
            	aiModel,
            }, "sendMessageToAI");
        } else if (command === "!aimodel") {
            let allowedModels = ["boryact","stupid"];
            if (!allowedModels.includes(stringarg)) {
        	    sendChat("[BOT] "+`You can't set model ${stringarg.slice(0,20)}, allowed models: ${allowedModels.join(", ")}`)
        	    return;
        	}
			databaseFunc.set(executor, "aimodel", stringarg.slice(0,20))
			sendChat("[BOT] "+`Successful set AI model to ${stringarg.slice(0,20)}`)
        } else if (command === "!modifyai") {
			if (!executorIsVip) {
				sendChat("[BOT] "+"You don't have vip to execute this command");
				return;
			}
			databaseFunc.set(executor, "ai_systemprompt", stringarg)
        } else if (command === "!соси_нежно") {
            sendChat("[BOT] "+`${executor}. Не триггери`);
        } else if (command === "!burmalda") {
            sendChat("[BOT] "+`БУРМОЛДООООО`);
        } else if (command === "!1488") {
            sendChat("[BOT] "+`ЭЩКЕРЕЕЕЕЕЕЕЕЕЕЕЕЕЕЕЕЕЕЕ`);
        } else if (command === "!svo" || command === "!сво") {
        	if (stringarg) {if (!getPlayers().includes(stringarg)) return};
            sendChat("[BOT] "+`О НЕТ! ${(stringarg ? stringarg.toUpperCase() : executor.toUpperCase())} ТЕПЕРЬ НА ФРОНТЕ!!!`);
        } else if (command === "!zov" || command === "!зов") {
            sendChat("[BOT] "+`zoooov`);
        } else if (command === "!cartel" || command === "!картель") {
            sendChat("[BOT] "+`АААААААААААААААА КАРТЕЛЬ`);
        } else if (command === "!svin" || command === "!свин") {
        	if (!stringarg) return;
            sendChat("[BOT] "+`ОХО! ${executor.toUpperCase()} НАПЭСАЛ ШО ${stringarg.toUpperCase()} УКРАIНЭЦ!!!`);
        } else if (command.startsWith("!")) {
            sendChat("[BOT] "+`Command "${args[0].length > 30 ? text.slice(0, 30)+"..." : args[0]}" not found. Check commands by !help`);
        } else if (message.endsWith(" joined the ship.") && bot.perms.includes("greet-joined-players")) {
            if (isBlacklisted(lastJoinedUser) && bot.perms.includes("ban-blacklisted-users")) {
                banPlayer(lastJoinedUser);
                sendChat("[BOT] "+`${lastJoinedUser} is blacklisted and was banned by reason "${database.get(lastJoinedUser).blacklistedReason}", proof: "${database.get(lastJoinedUser).blacklistedProof}"`);
                return;
            }
            if (!message.includes(":")) {
                let razrivTime = new Date() - database.get(lastJoinedUser).oldlastdetecttime;
                if (razrivTime > 3*24*60*60*1000) {
                    if (bot.perms.includes("gjp-say-banned-players-count")) {
                        let countbanned = 0;
                        for (let i = 1; i<=document.querySelector(`#team_players_inner > table > tbody`).childNodes.length; i++) {
                            let element = document.querySelector(`#team_players_inner > table > tbody > tr:nth-child(${i}) > td:nth-child(5) > b`);
                            if (element != null) {
                                if (element.textContent == "BANNED") countbanned++;
                            }
                        }
                        sendChat("[BOT] "+`Hello ${lastJoinedUser}! I banned ${countbanned} players. Check the rules if you want not be banned. =). Also check commands by using !help`);
                    } else {
                        sendChat("[BOT] "+`Hello ${lastJoinedUser}! Check commands by using !help`);
                    }
                } else if (razrivTime > 4*60*60*1000) {
                    sendChat("[BOT] "+`Hi ${lastJoinedUser}! Nice to see you!`)
                } else if (razrivTime > 1*60*1000) {
                    sendChat("[BOT] "+`Welcome back ${lastJoinedUser}!`)
                }
            }
        } else if (bot.perms.includes("movable-by-commands")) {
            if (args[0] === "робот") {
                if (!args[1] && !bot.hears) {
                    sendChat("[BOT] "+`${laskovieSlova[Math.floor(Math.random()*laskovieSlova.length)]} господин ${executor}`);
                    bot.hears = executor;
                } else if (bot.hears === executor) {
                    if (args[1] === "иди") {
                        args[3] = args[3] || 3000
                        if (args[2] === "влево") {
                            sendChat("[BOT] "+`Иду влево ${args[3]} миллисекунд`)
                            tapKey("a",args[3])
                        } else if (args[2] === "вправо") {
                            sendChat("[BOT] "+`Иду вправо ${args[3]} миллисекунд`)
                            tapKey("d",args[3])
                        } else if (args[2] === "вверх") {
                            sendChat("[BOT] "+`Иду вверх ${args[3]} миллисекунд`)
                            tapKey("w",args[3])
                        } else if (args[2] === "вниз") {
                            sendChat("[BOT] "+`Иду вниз ${args[3]} миллисекунд`)
                            tapKey("s",args[3])
                        } else if (args[2] === "нахуй") {
                            sendChat("[BOT] "+`ыыы я на тибя обиделся`)
                            sendChat("[BOT] "+`всо бын визди`)
                            sendChat("[BOT] "+`/ban ${executor}`)
                            sendChat(`/ban ${executor}`)
                            bot.hears = "";
                        }
                    } else if (args[1] === "скажи") {
                        if (args[2]) {
                            sendChat("[BOT] "+args.slice(2).join(" "))
                        } else {
                            sendChat("[BOT] Что сказать?")
                        }
                    } else if (args[1] === "прыгни") {
                        sendChat("[BOT] Прыгнул.")
                        tapKey("Space",200)
                    } else if (args[1] === "свободен") {
                        sendChat("[BOT] "+`Рад был работать на вас, господин ${executor}!`)
                        bot.hears = "";
                    }
                }
            }
        } else if (bot.perms.includes("no-link") && false && !targetIsStaff && !targetIsVip) {
            sendChat("[BOT] "+executor+" said link");
        } else if (message === "Invalid target.") {sendChat("[BOT] "+"Invalid target (is offine?)")}
        else if (message === "Target's rank is too high to kick.") {sendChat("[BOT] "+"Fail to interact with target (is cap/bot not cap?)")}
    } else {
        /*
        window.postMessage({type: "fromothertab", message}, "*");
        if (!document.hasFocus() && client.notify) {
            notify("Drednot Chat", message, "https://www.google.com/s2/favicons?sz=64&domain=drednot.io", "", () => {
                window.focus();
                sendChat("[BOT] "+`Прочитал ${message.length <= 50 ? message : message.slice(0, 50)+"..."}`);
                reg.getNotifications({ includeTriggered: true })
                    .then((notifications) => {
                        notifications.forEach((notification) => {notification.close()});
                    });
            }
        )};
        */
        if (message.startsWith("Joined ship ")) {
            if (false && sessionStorage.getItem("runAsBot") === "true") {
                bot.active = true;
                sendChat("[BOT] "+"Bot successfull restarted");
                document.getElementById("team_manager_button").click();
                setTimeout(() => document.getElementById("team_manager_button").click(), 1000);
                start = new Date();
                sessionStorage.setItem("runAsBot", false);
            }
        }
    }
	if (message.endsWith("joined the ship.") || text.startsWith("Joined ship")) singlePlay(soundpad.join);
	else if (message.endsWith("left the ship.")) singlePlay(soundpad.leave);
	else if (message.includes("was banned from the ship by")) singlePlay(soundpad.armatura);
	else if (message.startsWith("[SYSTEM]")) singlePlay(soundpad.messageFromSystem)
    else if (message.startsWith("[DREDER CLIENT]")) singlePlay(soundpad.messageFromSystem)
	else if (executor == myUsername) singlePlay(soundpad.messageFromMe)
	else singlePlay(soundpad.message);

    if (text == bot.examanswer && bot.perms.includes("exam")) {
        if (text == null) return;
        if (database.get(executor).banmoney) return;
        sendChat("[BOT] "+`${executor} said right answer and got D$${bot.examhowmanyoperations}!`);
        databaseFunc.add(executor, "money", bot.examhowmanyoperations)
        bot.examanswer = null;
        bot.examhowmanyoperations = 0;
    }
    if (bot.perms.includes("viktorina")) {
        if (text.toLowerCase() == bot.viktorinaanswer.toLowerCase()) {
            if (text === "") return;
            if (database.get(executor).banmoney) return;
            clearTimeout(bot.viktorinatimer);
            sendChat("[BOT] "+`${executor} said right answer and got D$${bot.viktorinamoneyaward}!`);
            databaseFunc.add(executor, "money", bot.viktorinamoneyaward);
            bot.viktorinaanswer = "";
            bot.viktorinawronganswers = [];
            bot.viktorinamoneyaward = 0;
        } else if (bot.viktorinawronganswers.includes(text.toLowerCase())) {
            if (text === "") return;
            if (database.get(executor).banmoney) return;
            clearTimeout(bot.viktorinatimer);
            sendChat("[BOT] "+`${executor} said wrong answer and lose D${bot.viktorinamoneyaward*0.8}...`);
            databaseFunc.add(executor, "money", -bot.viktorinamoneyaward*0.8);
            bot.viktorinaanswer = "";
            bot.viktorinawronganswers = [];
            bot.viktorinamoneyaward = 0;
        }
    }
    let pollAnswer = bot.pollanswers[englishsymbols.indexOf(text.toLowerCase())] || "";
    if (bot.polltimer && bot.pollanswers.includes(pollAnswer)) {
        if (!pollAnswer) return;

        const alreadyvoted = Object.values(bot.pollanswersusers).some(arr => arr.includes(executor));
        if (alreadyvoted) return;

        sendChat("[BOT] "+`${executor} voted variant ${text.toUpperCase()}: ${pollAnswer}`);
        bot.pollanswersusers[pollAnswer].push(executor);
    }
    let url = new URL("https://google.com");
    try {url = new URL(text)} catch (e) {}
    if (
        executor
        && (
            url.pathname.endsWith(".png")
            || url.pathname.endsWith(".jpg")
            || url.pathname.endsWith(".jpeg")
            || url.pathname.endsWith(".gif")
        )
    ) {
        let img = new Image();
        img.src = url;
        img.width = 150;

        replaceHTML(newNode,`<b>${executor}</b> sent an image`);
        writeChat(img.outerHTML, 10000);
    }
    if (/D[oо] [TТ]h[eе] R[oо][aа]r!/.test(text)) {
        // realsendChat("[BOT] "+"ill cum your roar");
        realsendChat("not roar");
    } else if (text.endsWith("meow")) {
        // realsendChat("[BOT] "+"shut up ill fuck your femboy ass");
        realsendChat("not mrrow");
    } else if (text.endsWith("уга-буга")) {
        realsendChat("буга-уга");
    }
});
chatObserver.observe(mychatContent, { attributes: false, childList: true, characterData: false });

drederClientDebug(`Setting disconnect observer...`);
let disconnectObserver = new MutationObserver(mutationRecords => {
    let textDisconnect = mutationRecords[0].addedNodes[0].textContent;
    if (textDisconnect.includes("A Captain saved the ship.")) {
    }
});
disconnectObserver.observe(document.querySelector("#disconnect-popup"), { attributes: false, childList: true, characterData: false })

drederClientDebug(`Setting MOTD observer...`);
let motdObserver = new MutationObserver(mutationRecords => {
    let motdText = mutationRecords[0].addedNodes[0].textContent;
    let jukeboxvalue = getSlicedValue(motdText, "Jukebox: ");
    jukeboxSetURL(jukeboxvalue.trim());
    motdCotext2.innerHTML = motdText;
    const iframes = motdCotext2.querySelectorAll('iframe');
    iframes.forEach(iframe => iframe.remove());
});
motdObserver.observe(motdCotext, { attributes: false, childList: true, characterData: false })

drederClientDebug(`Setting Team Log observer...`);
observeNode(document.querySelector("#team_menu"), () => {
    setTimeout(() => {
        const teamLog = document.querySelector("#team_log_actual > div");
        observeNode(teamLog, () => {
            let logMsgNode = document.querySelector("#team_log_actual > div").lastChild;
            let logMessage = logMsgNode.textContent.slice(2);
            if (bot.active && bot.perms.includes("action-on-teamlog")) {
                executor = logMsgNode.firstChild.lastChild.textContent;
                let executorIsStaff = false;
                try {executorIsStaff = database.get(executor).isStaff} catch (err) {};
                let executorIsVip = false;
                if (logMessage.endsWith("in ejector.")) {
                    sendChat("[BOT] "+"/ban "+executor);
                    sendChat("[BOT] "+executor.toUpperCase()+" PUTTED SOMETHING IN EJECTOR");
                } else if (logMessage.endsWith("placed Cargo Ejector .")) {
                    // sendChat("[BOT] "+`${executor.toUpperCase()}!! IF YOU PLACE ITEM TO EJECTOR, YOU GET BANNED!!!!!!!!!!`);
                    sendChat("[BOT] "+"/ban "+executor);
                    sendChat("[BOT] "+executor.toUpperCase()+" PLACED EJECTOR");
                } else if (logMessage.endsWith("used wrench on Safety Anchor.")) {
                    if (!executorIsStaff && !executorIsVip) {
                        sendChat("[BOT] "+"/ban "+executor);
                        sendChat("[BOT] "+executor.toUpperCase()+" BROKE ANCHOR");
                    }
                } else if (logMessage.endsWith("placed Spawn Point .")) {
                    if (!executorIsStaff) {
                        sendChat("[BOT] "+"/kick "+executor);
                        sendChat("[BOT] "+executor.toUpperCase()+" PLACED SPAWN POINT");
                    }
                }
            }
            if (logMessage.endsWith("teleported the ship to.") && bot.perms.includes("/home-on-zone-switch")) {
                sendChat("[BOT] "+"/home");
                sendChat("[BOT] "+executor+" teleported ship from Freeport");
            }
        }, false, true, false, { attributes: false, childList: true, characterData: false });
    }, 2000)
})

drederClientDebug(`Setting Intertab channel... (Useless)`);
window.addEventListener("message", (async (event) => {
	if (event.data.type === "FORWARD" && event.data.payload.type === "BROADOBHOD") {
		if (event.data.payload.stype === "send-chat") {
		    if (event.data.payload.from === "claude") {
			    bot.ai_answering = false;
			    let json = event.data.payload.data;

			    try {json = JSON.parse(json)}
			    catch (err) {
			        json = "errorToParse";
			        console.error("Error to parse JSON");
			    };
			    if (json === "errorToParse") {
			    	let error = event.data.payload.data;
			    	// sendChat("[BOT] "+"[AI JOB] "+error);
			    	sendChat("[BOT] "+error);
			    } else {
			    	console.debug(json);
			    	try {databaseFunc.add(json.who, "rep", json.rep)}
			    	catch (err) {sendChat("[BOT] "+"[AI JOB] Error to add rep: "+err)};
			    	sendChat("[BOT] "+"[AI] "+json.text);

			    	let actionsmap = new Map();
			    	try {actionsmap = new Map(Object.entries(json.actions))} catch (err) {}

			    	actionsmap.forEach((player,playerName) => {
			    	    if (player.DATABASESET) {
			    	        let databasesetmap = new Map(Object.entries(player.DATABASESET))
			    	        databasesetmap.forEach((value,key) => {
			    	            drederClientDebug(`AI action: set key "${key}" of "${playerName}" to "${value}"`);
			    	            databaseFunc.set(playerName,key,value);
			    	        });
			    	    }
			    	    if (player.KICK) {
			    	        drederClientDebug(`AI action: kick ${playerName}`);
			    	        sendChat("[BOT] "+"/kick "+playerName);
			    	    }
			    	    if (player.BAN) {
			    	        drederClientDebug(`AI action: ban ${playerName}`);
			    	        sendChat("[BOT] "+"/ban "+playerName);
			    	    }
			    	    if (player.BLACKLIST) {
			    	        drederClientDebug(`AI action: blacklist ${playerName} by reason ${reason}`);
			    	        blacklist(playerName, reason);
			    	    }
			    	});

			    	let systemactions = json.systemactions;
			    	if (systemactions) {
			    	    drederClientDebug("Detected system actions on AI answer");
			    	    if (systemactions.MOTD) {
			    	        let ogmotd = motdCotext.textContent.split("\n");
                            let editmotd = systemactions.MOTD;
                            let finalmotd = [];
                            editmotd.forEach((line, idx, array) => {
                                if (line) {
                                    sendChat("[BOT] "+`Line #${idx+1} "${ogmotd[idx].slice(0,50)}" edited to "${line.slice(0,50)}"`);
                                    finalmotd.push(line);
                                } else {finalmotd.push(ogmotd[idx])}
                            })
			    	        sendChat("[BOT] "+`Set MOTD to ${finalmotd.join('\n').slice(0,200)}`)
			    	        setMotd(finalmotd.join('\n'));
			    	    }
			    	}
			    }
		    } else if (event.data.payload.from === "aternos") {
		        drederClientDebug(`got ${event.data.payload.data}`);
		      //  sendChat("[BOT] "+"[ATERNOS] "+event.data.payload.data);
		    }
		} else if (event.data.payload.stype === "eval") eval(event.data.payload.data);
	}
}));

/*
window.addEventListener("message", function(event) {
    console.log(
        +(event.origin === origin)+" "
        +(event.source !== window)+" "
        +(event.data.type === "fromothertab")+" "
        +(Boolean(event.data.message))
    );

    if (event.origin !== origin || event.origin !== origin) {return};
    if (event.source === window) {return};
    if (event.data.type !== "fromothertab") {return};
    if (!event.data.message) {return};
    if (event.data.message.startsWith("[OTHER TAB]")) {return};
    console.log(event);
    writeChat("<b style='color:gray'>[OTHER TAB]</b> "+event.data.data, 10000);
});
*/
/*
observer = new MutationObserver(mutationRecords => {
    var logMessage = mutationRecords[0].addedNodes[0].innerHTML.slice(2);
    console.log(mutationRecords[0].addedNodes[0].textContent);
    writeChat(logMessage);
    if (logMessage.endsWith("in ejector.")) {
        sendChat("[BOT] "+"DETECTED EXPORTING ITEMS");
    }
});
observer.observe(teamLog, { attributes: false, childList: true, characterData: false });
*/

function localChat(value) {
    let args = value.split(' ');
    if (args[0] === "?eval") {
        let eval_result = eval(args.slice(1).join(" "));
        writeChat(`${DREDERCLIENT_PREFIX} ${eval_result}`, 15000);
    } else if (args[0] === "?dceval") {
        let eval_result = eval(args.slice(1).join(" "));
        writeChat(`${DREDERCLIENT_PREFIX} ${eval_result}`, 15000);
    } else if (args[0] === "?lchat") {
        let last_arg = "";
        for (let i = 1; i < args.length; i++) {last_arg += args[i]+" "}
        writeChat(last_arg, 15000);
    } else if (args[0] === "?clientset") {
        if (args[1] !== undefined) {
        	let parsedarg2 = (
        		parseFloat(args[2]) == NaN ? args[2] : parseFloat(args[2])
        	);
        	client[args[1]] = parsedarg2;
            writeChat(`${DREDERCLIENT_PREFIX} ${args[1]} = ${args[2]} (${typeof args[2]})`, 3000);
        } else {
            writeChat(JSON.stringify(client), 5000);
        }
    } else if (args[0] === "?botset") {
        if (args[1] !== undefined) {
        	let parsedarg2 = (
        		parseFloat(args[2]) == NaN ? args[2] : parseFloat(args[2])
        	);
        	bot[args[1]] = parsedarg2;
            writeChat(`${DREDERCLIENT_PREFIX} ${args[1]} = ${args[2]} (${typeof args[2]})`, 3000);
        } else {
            writeChat(JSON.stringify(bot), 5000);
        }
    } else if (value.startsWith("?")) {
        writeChat(`${DREDERCLIENT_PREFIX} <i style="color:red">Invalid local command "${value}"</i>`, 15000);
    } else {
        sendChat(value);
    }
}

function insultAnswer(text) {
    if (checkInsultAnswer(executor)) {
        if (text == "300" || text == "триста") {
            const rifma1 = [
                "Отсоси у",
                "Пососи у",
                "Подрочи у",
                "Подрочи на",
                "Выеби",
                "Наеби",
            ];
            const rifma2 = [
                "тракториста",
                "програмиста",
                "анархиста",
                "афериста",
                "мазохиста",
                "баяниста",
            ];
            sendChat("[BOT] "+
                rifma1[Math.ceil(Math.random()*rifma1.length-1)]
                +" "
                +rifma2[Math.ceil(Math.random()*rifma2.length-1)]);
        } else if (/[йуy]+[ьъ]?[aа]+/.test(text.toLowerCase()) || text.toLowerCase() === "я") {
            sendChat("[BOT] "+"Толстожопая свинь"+text.toLowerCase());
        } else if (text.toLowerCase() === "три") {
            sendChat("[BOT] "+"Жопу подотpи");
        } else if (text.toLowerCase() === "пять") {
            sendChat("[BOT] "+"Выебал тебя опять");
        } else if (text.toLowerCase() === "мы") {
            sendChat("[BOT] "+"Надень панамы");
        } else if (text.toLowerCase() === "да") {
            sendChat("[BOT] "+"Пизда");
        } else if (text.toLowerCase() === "нет") {
            sendChat("[BOT] "+"Минет");
        } else if (text.toLowerCase() === "ладно") {
            sendChat("[BOT] "+"В жопе прохладно");
        } else if (text.toLowerCase() === "ты") {
            sendChat("[BOT] "+"Жопой нюхаешь цветы");
        } else if (text.toLowerCase() === "так") {
            sendChat("[BOT] "+"Сказал мудак");
        } else if (/([cс][aао][мm][аaоo0]|[vbв[еeё][pр][tт][oо0])[лl]ё[тt]/.test(text.toLowerCase())) {
            sendChat("[BOT] "+"Снимай трусы и иди в полёт");
        } else if (/[мm]яч[иi][кk][иi]/.test(text.toLowerCase())) {
            sendChat("[BOT] "+"Тебе нравятся мальчики");
        } else if (text.toLowerCase() === "ебать") {
            sendChat("[BOT] "+"Твою жопу");
        } else if (text.toLowerCase() === "ура") {
            sendChat("[BOT] "+"В жопе дыра");
        } else if (text.toLowerCase() === "карапуз") {
            sendChat("[BOT] "+"Запустил семя в арбуз");
        }
    }
}

function observeNode(node, func, isLogMessage = false, loop = false, wait = false, conf = {childList: true,attributes: true,subtree: true}) {
    if (!wait) {
        let observer = new MutationObserver(mutationRecords => {
            func(mutationRecords);
            if (!loop) {
                observer.disconnect();
            }
        });
        observer.observe(node, conf);
    } else {
        return new Promise((resolve, reject) => {
            let observer = new MutationObserver(mutationRecords => {
                let returned = func();
                if (!loop) {
                    observer.disconnect();
                }
                resolve(returned);
            });
            observer.observe(node, conf);
        })
    }
}

function realsendChat(message) {
    message = message.slice(0,300);
    let chatClosed = chatBox.classList.contains('closed');
    if (chatClosed) chatBtn.click();
    chatInp.value = message;
    chatBtn.click();
    if (!chatClosed) chatBtn.click();
}

function sendChat(message) {
	for (let i = 0; i < message.length; i += 300) {
		let slicedmessage = message.slice(i,i+300);
		sendingMessages.push(client.prettyenglish ? prettyText(slicedmessage) : slicedmessage);
	}
}

function broadcastToOtherTab(data, stype = "eval") {
	window.postMessage({
	    from: "drednot",
		type: "BROADOBHOD",
		stype,
		data,
	}, "*");
}

function startPoll(question, answersInArr = ["yes","no"], secs = 30, options = {
    ignoredPlayers: [],
}) {
    bot.polltimer = setTimeout(() => {
        bot.polltimer = null;
        let allCount = 0;
        let bestAnswer = answersInArr[0];
        let countThenDraw = 0;
        for (let readyAnswer in bot.pollanswersusers) {
            let votersReadyAnswer = bot.pollanswersusers[readyAnswer];
            if (votersReadyAnswer.length > bot.pollanswersusers[bestAnswer].length) {
                bestAnswer = readyAnswer;
                countThenDraw=1;
            } else if (votersReadyAnswer.length == bot.pollanswersusers[bestAnswer].length) {
                countThenDraw++;
            }
            allCount += votersReadyAnswer.length;
        }

        let msg = "Poll ended, ";
        if (countThenDraw>1) msg += `drawed with ${countThenDraw} answers`;
        else msg += `won "${bestAnswer}" (${Math.round((bot.pollanswersusers[bestAnswer].length/allCount)*100)}%)`;
        sendChat("[BOT] "+msg)
    }, secs*1000+3500);

    let displayanswers = "";
    bot.pollanswers = [];
    bot.pollanswersusers = {};
    answersInArr.forEach((ans, idx, arr) => {
        bot.pollanswers.push(ans);
        bot.pollanswersusers[ans] = [];
        displayanswers += `${englishsymbols[idx]}) ${ans}` + (idx<answersInArr.length-1?'; ':'');
    })

    sendChat("[BOT] "+"POLL: "+question);
    sendChat("[BOT] "+`Avaliables answers: ${displayanswers}`);
    sendChat("[BOT] "+`Gives ${secs} seconds to give answer.`);
}

function checkInsultAnswer(executor) {
	return (
        (!bot.active && client.perms.includes("insult-answer"))
        || (bot.active && bot.perms.includes("insult-answer"))
    )
    && executor !== "Dreder"
}

function writeChat(html, time = 15000) {
	const p = document.createElement("p");
	p.className = "recent";
	p.innerHTML = html;
	mychatContent.append(p);
	setTimeout(() => {
		p.classList.remove("recent");
	}, time);
	return p;
} // From SDT

function replaceHTML(node, html) {
    node.innerHTML = html;
}

async function getPlayersOnShip() {
    document.querySelector("#team_manager_button").click()
    const players = await observeNode(document.querySelector("#team_players_inner"), () => {
        const offlinePlayers = {};
        for (let elem of document.querySelector("#team_players_inner > table > tbody").children) {
            let playerCount = parseInt(elem.children[0].textContent) || 0;
            let playerName = elem.children[1].children[0].textContent;
            let inventory = [];
            let playtime = elem.children[3].textContent;
            let rank = elem.children[4];
            if (rank.children[0].tagName === "SELECT") {
                for (let item of rank.children[0]) {
                    if (item.selected) rank = item.textContent
                }
            } else {
                if (rank.textContent.includes("BANNED")) {
                    rank = "Banned"
                } else {
                    rank = rank.textContent
                }
            }

            for (let item of elem.children[2].children) {
                if (item.source === origin+"/x/83e3f8047f65af03add4dd86fa9bb823.png") {inventory.push("")}
            }

            offlinePlayers[playerName] = {
                playerCount,
                inventory,
                playtime,
                rank: rank.slice(0,7),
                captainLevel: rank.includes("Captain") ? rank.match(/\d+/) : null,
                html: elem,
                idx: elem.rowIndex,
            };
        }
        return offlinePlayers;
    }, false, false, true)
    document.querySelector("#team_manager_button").click()
    return players;
}

function getPlayers() {
	if (chatBox.classList.contains('closed')) chatBtn.click();
	chatInp.value = '/kick ';
	chatInp.dispatchEvent(new Event('input'));
	const playersList = [...document.querySelectorAll('#chat-autocomplete p')];
	const players = [];
	players.push(myUsername);
	for (let p of playersList) {
		players.push(p.textContent)
	}
	document.querySelector('#chat-close').click();
	return players;
} // From ShrekDark

function getMotd() {
	return motdCotext.textContent;
}

function setMotd(text) {
    let washidden = motdCotext.parent.style.display == "none";
    motdEditCotext.value = text;
    saveMotd(true);
    if (washidden) motdCotext.parent.style.display = "none"
    return motdEditCotext.value;
}

function getSlicedValue(text, parameter) {
    let indexOfString = text.indexOf(parameter)+parameter.length;
    return text.slice(indexOfString,text.indexOf("\n",indexOfString));
}

function parsePlayTimeToMs(time) {
    let arrTime = time.match(/\d+/g);
    arrTime.reverse();
    let ms = 0;
    for (let i in arrTime) {
        ms += arrTime[i]*Math.pow(60,i)
    }
    return ms*1000;
}

function setAsyncTimeout(func, ms) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            let result = func();
            resolve(result);
        }, ms)
    })
}

function prettyText(text) {
    let newtext = "";
    for (let symbol of text) {
        newtext += prettyenglishsymbols[englishsymbols.indexOf(symbol.toLowerCase())] ?? symbol;
    }
    return newtext;
}

function russianTextToRusssianTranskript(text) {
    let newtext = "";
    for (let symbol of text) {
        newtext += prettyenglishsymbols[englishsymbols.indexOf(symbol.toLowerCase())] ?? symbol;
    }
    return newtext;
}

function myPlayerIsCap() {
    return true;
	//return manage.getAttribute("style") == "";
}

async function kickPlayer(target) {
    return new Promise(async (resolve, reject) => {
        let playersOnShip = await getPlayersOnShip();
        if (!playersOnShip[target]) reject(`${target} not found on ship`);
        let isCap = false;
        if (playersOnShip[target].rank.includes("Captain")) {
            isCap = true
            await setRank(target, 0);
            playersOnShip = await getPlayersOnShip();
        };
        playersOnShip[target].html.children[4].lastChild.firstChild.click()
        let stop = false
        while (!stop) {
            await observeNode(mychatContent, () => {
                if (mychatContent.lastChild.textContent.startsWith(`${target} was `)) stop = true
            },false,false,true)
        }
        writeChat("kick")
        if (isCap) await setRank(target, 3);
        document.querySelector("#team_players > button").click();
        resolve(target);
    })
}

async function softbanPlayer(target) {
    return new Promise(async (resolve, reject) => {
        let playersOnShip = await getPlayersOnShip();
        if (!playersOnShip[target]) reject(`${target} not found on ship`);

        let oldRank = 0;
        if (playersOnShip[target].rank.includes("Captain")) oldRank = 3;
        else if (playersOnShip[target].rank === "Crew") oldRank = 1;

        writeChat("stage 1 - ban")
        await banPlayer(target);
        writeChat("stage 2 - unban")
        await unbanPlayer(target);
        if (oldRank) await setRank(target, oldRank);

        document.querySelector("#team_players > button").click();
        resolve(target);
    })
}

async function banPlayer(target) {
    return new Promise(async (resolve, reject) => {
        let playersOnShip = await getPlayersOnShip();
        if (!playersOnShip[target]) reject(`${target} not found on ship`);
        if (playersOnShip[target].html.children[4].firstChild.tagName === 'B') {
            resolve(null)
        }
        if (playersOnShip[target].rank === "Captain") {
            await setRank(target, 0);
            playersOnShip = await getPlayersOnShip();
        }
        playersOnShip[target].html.children[4].lastChild.lastChild.click()
        writeChat(playersOnShip[target].html.textContent);
        let stop = false
        while (!stop) {
            await observeNode(mychatContent, () => {
                if (mychatContent.lastChild.textContent.startsWith(`${target} was banned`)) stop = true
            },false,false,true)
        }
        writeChat("ban")
        document.querySelector("#team_players > button").click();
        resolve(target);
    })
}

async function unbanPlayer(target) {
    return new Promise(async (resolve, reject) => {
        let playersOnShip = await getPlayersOnShip();
        if (!playersOnShip[target]) reject(`${target} not found on ship`);
        if (playersOnShip[target].rank === "Captain") {
            await setRank(target, 0);
            playersOnShip = await getPlayersOnShip();
        }
        playersOnShip[target].html.children[4].lastChild.click();
        writeChat(playersOnShip[target].html.textContent);
        let stop = false
        while (!stop) {
            await observeNode(mychatContent, () => {
                if (mychatContent.lastChild.textContent.startsWith(`${target} was un-banned`)) stop = true
            },false,false,true)
        }
        writeChat("unban");
        document.querySelector("#team_players > button").click();
        resolve(target);
    })
}

async function setRank(target, rank) {
    return new Promise(async (resolve, reject) => {
        let playersOnShip = await getPlayersOnShip();
        if (!playersOnShip[target]) reject(`${target} not found on ship`);
        if (playersOnShip[target].html.children[4].firstChild.tagName === 'B') {
            reject(`Can't change rank of ${target}`)
        }
        let select = playersOnShip[target].html.children[4].firstChild;
        select.value = rank;
        select.dispatchEvent(new Event('change'));
        let stop = false;
        while (!stop) {
            await observeNode(mychatContent, () => {
                if (mychatContent.lastChild.textContent.startsWith(`${target} was `)) stop = true
            },false,false,true)
        }
        writeChat("set rank");
        document.querySelector("#team_players > button").click();
        resolve(target);
    })
}

async function softsaveShip() {
    let playersOnShip = getPlayers();
    for (let playerName of playersOnShip) {
        writeChat(playerName);
        kickPlayer(playerName);
    }
}

function getPlayerInShip(target) {
    teamsearch = document.querySelector("#team_players > input");
    teamsearch.value = target;
    teamsearch.dispatchEvent(new Event('input'));
    if (document.querySelector("#team_players_inner > table > tbody").children.length == 0) return null;
    else if (document.querySelector("#team_players_inner > table > tbody").children.length > 1) return document.querySelector("#team_players_inner > table > tbody").children.length;
    else return document.querySelector("#team_players_inner > table > tbody").firstChild;
}

function isBlacklisted(nickname) {
    let value = null;
    try {
        value = database.get(nickname).blacklisted;
    } catch (err) {
        value = false
    }
    return value;
}

function sliceArgs(araryArgs = [], from = 0, to = Infinity) {
    let stringarg = "";
    for (let i in araryArgs) {
        if (i > from && i <= to) stringarg += araryArgs[i]+(i==araryArgs.length-1?"":" ");
    }
    return stringarg;
}

function compareRandom(a, b) {
  return Math.round((Math.random()-0.5)*10)
}

function notify(title, mess, ico, img, click) {
    let notification;
    const options = {
        body: mess,
        icon: ico,
        image: img,
    };
    if (Notification.permission === "granted") {notification = new Notification(title, options)};
    notification.onclick = click;
}

function singlePlay(sound) {
    try {
	    sound.currentTime = 0;
	    sound.volume = 0.33;
	    sound.play();
	} catch (err) {}
}

function restartClient() {
	if (bot.active) sessionStorage.setItem("runAsBot", true);
	window.location = "https://drednot.io/invite/0PNtxvepewixAOs45rSrJyFT";
}

function isDev(username) {
    return username === "Dreder" || username === "ilya2000matveev" || username === "Dreder №2"
}

async function getShips(onlineOnly) {
	let response = await fetch(origin+'/shiplist?server=0');
    let result = await response.json();
    let ships = {};
    Object.entries(result.ships).map(([key, value]) => {
        if (!(onlineOnly && value.saved)) {
            ships[key] = value;
        }
    });
    return ships;
}

function getPageTitle() {
    return document.querySelector("head > title").textContent;
}

function drederClientDebug(message) {
    console.debug(`%c DREDERCLIENT %c ${message}`,"color: white; background-color: darkred; border-radius: 8px","");
}

drederClientDebug("STAGE 2: Initialing Dreder UI API...");

let drederUIapi = {};

drederUIapi.newDiv = function(elementid, position, x = "", y = "", width = "", height = "", divLikeAsDrednot = false) {
    let newelement = document.createElement('div');
    newelement.id = elementid;
    if (divLikeAsDrednot) newelement.className = "dark ui-should-hide";
    newelement.style = `
        display: block;
        ${position ? `position: ${position};` : ""}
        ${width ? `width: ${width};` : ""}
        ${height ? `height: ${height};` : ""}
        ${x ? `left: ${x};` : ""}
        ${y ? `top: ${y};` : ""}
        z-index: 10000;
    `;
    return newelement;
};
drederUIapi.newText = function(elementid, text = "") {
    let newelement = document.createElement("p");
    newelement.id = elementid;
    newelement.className = "";
    newelement.style = `display: inline;`;
    newelement.textContent = ` ${text} `
    return newelement;
};
drederUIapi.newInput = function(elementid, onchange) {
    let newelement = document.createElement("input");
    newelement.id = elementid;
    newelement.className = "dark ui-should-hide";
    newelement.style = `display: inline;`;
    return newelement;
};
drederUIapi.newButton = function(elementid, onclick, text = "") {
    let newelement = document.createElement("input");
    newelement.id = elementid;
    newelement.className = "dark btn btn-small";
    newelement.type = "button";
    newelement.style = `display: inline;`;
    newelement.onclick = onclick;
    newelement.value = text;
    return newelement;
};
drederUIapi.newRange = function(elementid, min = 0, max = 1, step = 0.01) {
    let newelement = document.createElement("input");
    newelement.id = elementid;
    newelement.type = "range";
    newelement.min = min;
    newelement.max = max;
    newelement.step = step;
    newelement.style = `display: inline;`;
    return newelement;
};

drederClientDebug("Creaiting dreder's client's settings UI...");
let dcsUI = drederUIapi.newDiv("","absolute","5%","5%","90%","90%",true);
document.body.append(dcsUI);
dcsUI.style.display = "none";

let dcsUI1 = drederUIapi.newDiv("div1","","","","100%","",true);
dcsUI.append(dcsUI1);
let dcsUIclose = drederUIapi.newButton("close",() => {
    dcsUI.style.display = "none";
},"Close");
dcsUI1.append(dcsUIclose);

let dcsUI2 = drederUIapi.newDiv("div2","","","","100%","",true);
dcsUI.append(dcsUI2);
let dcsUIit = drederUIapi.newText("it","Test Input");
dcsUI2.append(dcsUIit);
let dcsUIi = drederUIapi.newInput("some input");
dcsUI2.append(dcsUIi);

let dcsUI3 = drederUIapi.newDiv("div3","","","","100%","",true);
dcsUI.append(dcsUI3);
let dcsUIrQualt = drederUIapi.newText("rQualt","Quality of render");
dcsUI3.append(dcsUIrQualt);
let dcsUIrQual = drederUIapi.newRange("range-quality",0.1,1,0.05);
dcsUIrQual.value = 1;
dcsUIrQual.oninput = () => {
    const canvas = document.querySelector("#canvas-game");
    canvas.style = `
width: ${document.body.clientWidth}px;
height: ${document.body.clientHeight}px;
`;
    // Задаем внутреннее разрешение меньше реального (например, в 2 раза)
    const scaleFactor = dcsUIrQual.value;
    canvas.width = canvas.clientWidth * scaleFactor;
    canvas.height = canvas.clientHeight * scaleFactor;

    // Не забываем обновить viewport для WebGL
    const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
    if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
};
dcsUI3.append(dcsUIrQual);

drederClientDebug(`STAGE 3: Initialing WebSocket connection to DC server...`);
let myclosereason = "";
let triesleft = 0;
let maxtries = 3;

initConToDC()
function initConToDC() {
    const DCws = new WebSocket("wss://dreder-client-server.onrender.com");
    function sendObjToDCws(obj) {
        DCws.send(JSON.stringify(obj))
    }

    DCws.onmessage = (event) => {
        let obj = JSON.parse(event.data);
        if (obj.type === "waitingForData") {
            sendObjToDCws({
                type: "givingData",
                username: myUsername,
                password: "",
            })
        } else if (obj.type === "getPlayers") {
            DCusers = obj.array;
        } else if (obj.type === "connected") {
            writeChat(`${DREDERCLIENT_PREFIX} Connected to DC server`);
            sendObjToDCws({type: "getPlayers"});
        } else if (obj.type === "userIsOnline") {
            if (obj.username === myUsername) return;
            writeChat(`${DREDERCLIENT_PREFIX} <b>${obj.username}</b> joined DC server`);
            DCusers.push(obj.username);
        } else if (obj.type === "userIsOffline") {
            writeChat(`${DREDERCLIENT_PREFIX} <b>${obj.username}</b> left DC server by reason '<b>${obj.reason}</b>'`);
            if (DCusers.includes(obj.username)) DCusers.splice(DCusers.indexOf(obj.username),1);
        } else if (obj.type === "exec_client") {
            if (false) eval(obj.code);
        } else if (obj.type === "exec_server_result") {
            writeChat(`${DREDERCLIENT_PREFIX} Evaluted server result: ${obj.result}`);
        } else if (obj.type === "pong") {
            if (triesleft>0) triesleft--;
            sendObjToDCws({type: "ping"});
        } else if (obj.type === "close") {
            myclosereason = obj.reason;
        }
    };
    DCws.onclose = (event) => {
        writeChat(`${DREDERCLIENT_PREFIX} Connection to DC server closed by reason <b>'${myclosereason}'</b>`);
        if (myclosereason === "timeout") {
            if (triesleft < maxtries) {
                writeChat(`${DREDERCLIENT_PREFIX} Try #${++triesleft}/${maxtries} to connect DC server...`);
                initConToDC();
            } else {
                writeChat(`${DREDERCLIENT_PREFIX} DC server doesn't want you joined. Try later.`)
            }
        }
    };
    DCws.onerror = (e) => {
        writeChat(`${DREDERCLIENT_PREFIX} Got error with DC server`);
    };
}

drederClientDebug(`Client is fully loaded!`);
