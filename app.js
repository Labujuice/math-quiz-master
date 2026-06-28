// --- CONFIG & STATE ---
const GAME_STATE = {
    playerName: '',
    ops: [],
    difficulty: 1, // 1, 2, 3 digits
    ruleLife: true,
    ruleNegQ: false,
    ruleNegA: false,
    ruleDec: false,
    inputMode: 'choice', // choice, fill
    gameMode: 10, // 10, 20, 30, 'infinite'
    
    currentQ: 1,
    score: 0, // Leaderboard score
    life: 3,
    records: [], // For the test paper
    
    currentQuestionData: null // { qStr, answer }
};

const ADJECTIVES = ['漂亮的', '聰明的', '調皮的', '可愛的', '勇敢的', '快樂的', '害羞的', '神奇的'];
const FRUITS = ['蘋果', '西瓜', '香蕉', '草莓', '葡萄', '橘子', '鳳梨', '芒果'];

// --- DOM ELEMENTS ---
const screens = {
    setup: document.getElementById('setup-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const bgm = document.getElementById('bgm');
const bgmToggle = document.getElementById('bgm-toggle');
let bgmPlaying = false;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    initSetup();
    bindEvents();
    renderLeaderboard();
});

function bindEvents() {
    document.getElementById('btn-start').addEventListener('click', startGame);
    document.getElementById('btn-end-early').addEventListener('click', endGame);
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-restart').addEventListener('click', restartGame);
    
    bgmToggle.addEventListener('click', toggleBgm);

    // Choice mode
    document.querySelectorAll('.btn-choice').forEach(btn => {
        btn.addEventListener('click', (e) => handleAnswer(e.target.textContent));
    });

    // Fill mode (Virtual Keyboard)
    document.querySelectorAll('.vk-btn').forEach(btn => {
        btn.addEventListener('click', handleVKInput);
    });
}

function toggleBgm() {
    if (bgmPlaying) {
        bgm.pause();
        bgmToggle.textContent = '🔇 音樂關';
    } else {
        bgm.play().catch(e => console.log('Auto-play prevented'));
        bgmToggle.textContent = '🎵 音樂開';
    }
    bgmPlaying = !bgmPlaying;
}

// --- SETUP LOGIC ---
function initSetup() {
    // Generate random name if empty
    const nameInput = document.getElementById('player-name');
    nameInput.placeholder = `例如：${getRandomName()}`;
}

function getRandomName() {
    const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
    const fruit = FRUITS[Math.floor(Math.random() * FRUITS.length)];
    return adj + fruit;
}

function startGame() {
    let name = document.getElementById('player-name').value.trim();
    if (!name) name = getRandomName();

    const ops = Array.from(document.querySelectorAll('input[name="op"]:checked')).map(cb => cb.value);
    if (ops.length === 0) {
        alert('請至少勾選一種題型！');
        return;
    }

    GAME_STATE.playerName = name;
    GAME_STATE.ops = ops;
    GAME_STATE.difficulty = parseInt(document.querySelector('input[name="difficulty"]:checked').value);
    GAME_STATE.ruleLife = document.getElementById('rule-life').checked;
    GAME_STATE.ruleNegQ = document.getElementById('rule-neg-q').checked;
    GAME_STATE.ruleNegA = document.getElementById('rule-neg-a').checked;
    GAME_STATE.ruleDec = document.getElementById('rule-dec').checked;
    GAME_STATE.inputMode = document.querySelector('input[name="inputMode"]:checked').value;
    
    const gm = document.querySelector('input[name="gameMode"]:checked').value;
    GAME_STATE.gameMode = gm === 'infinite' ? 'infinite' : parseInt(gm);

    // Reset stats
    GAME_STATE.currentQ = 1;
    GAME_STATE.score = 0;
    GAME_STATE.life = 3;
    GAME_STATE.records = [];

    // UI Updates
    document.getElementById('life-container').style.display = GAME_STATE.ruleLife ? 'block' : 'none';
    document.getElementById('life-container').textContent = '❤️❤️❤️';
    document.getElementById('btn-end-early').style.display = 'block';
    document.getElementById('total-q-num').textContent = GAME_STATE.gameMode === 'infinite' ? '' : `/ ${GAME_STATE.gameMode}`;
    
    if (GAME_STATE.inputMode === 'choice') {
        document.getElementById('choice-container').style.display = 'grid';
        document.getElementById('fill-container').style.display = 'none';
    } else {
        document.getElementById('choice-container').style.display = 'none';
        document.getElementById('fill-container').style.display = 'flex';
        // Prevent native keyboard on tablets if they accidentally focus something
        document.getElementById('fill-display').textContent = '';
    }

    switchScreen('game');
    nextQuestion();
}

// --- MATH ENGINE ---
function generateNumber(digits, allowNegative) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    // For 1 digit, allow 0-9
    if (digits === 1) num = Math.floor(Math.random() * 10);
    
    if (allowNegative && Math.random() > 0.5 && num !== 0) {
        num = -num;
    }
    return num;
}

function generateQuestion() {
    const op = GAME_STATE.ops[Math.floor(Math.random() * GAME_STATE.ops.length)];
    let A, B, answer;

    let valid = false;
    while (!valid) {
        A = generateNumber(GAME_STATE.difficulty, GAME_STATE.ruleNegQ);
        B = generateNumber(GAME_STATE.difficulty, GAME_STATE.ruleNegQ);

        switch (op) {
            case '+':
                answer = A + B;
                break;
            case '-':
                // ruleNegA check
                if (!GAME_STATE.ruleNegA && A - B < 0) {
                    continue; // try again
                }
                answer = A - B;
                break;
            case '*':
                answer = A * B;
                break;
            case '/':
                if (B === 0) continue; // no division by zero
                
                if (!GAME_STATE.ruleDec) {
                    // Must be divisible
                    if (A % B !== 0) {
                        // Easy fix: A = answer * B
                        answer = A;
                        A = answer * B;
                    } else {
                        answer = A / B;
                    }
                } else {
                    // Support decimal to 1 place
                    if ((A * 10) % B !== 0) {
                        continue;
                    }
                    answer = A / B;
                }
                
                // Check if answer is negative and ruleNegA is false
                if (!GAME_STATE.ruleNegA && answer < 0) {
                    continue;
                }
                break;
        }

        // Final check for negative answer rule across all ops just in case
        if (!GAME_STATE.ruleNegA && answer < 0) {
            continue;
        }

        valid = true;
    }

    // Format display strings
    const strA = A < 0 ? `(${A})` : `${A}`;
    const strB = B < 0 ? `(${B})` : `${B}`;
    let opStr = op;
    if (op === '*') opStr = '×';
    if (op === '/') opStr = '÷';

    const qStr = `${strA} ${opStr} ${strB} = ?`;

    return { qStr, answer, op, A, B };
}

function nextQuestion() {
    updateGameUI();
    const qData = generateQuestion();
    GAME_STATE.currentQuestionData = qData;

    document.getElementById('question-text').textContent = qData.qStr;

    if (GAME_STATE.inputMode === 'choice') {
        renderChoices(qData.answer);
    } else {
        document.getElementById('fill-display').textContent = '';
    }
}

function renderChoices(correctAnswer) {
    const buttons = Array.from(document.querySelectorAll('.btn-choice'));
    let choices = new Set([correctAnswer]);

    // Generate 3 distractors
    while (choices.size < 4) {
        // random variance
        let variance = Math.floor(Math.random() * 10) + 1;
        if (Math.random() > 0.5) variance = -variance;
        
        // if decimal answer, variance should be decimal
        if (correctAnswer % 1 !== 0) {
            variance = variance / 10;
        }

        let fake = correctAnswer + variance;
        
        // round to 1 decimal place to avoid JS floating point issues
        fake = Math.round(fake * 10) / 10;

        if (!GAME_STATE.ruleNegA && fake < 0) {
            fake = Math.abs(fake);
        }

        choices.add(fake);
    }

    // Shuffle
    choices = Array.from(choices).sort(() => Math.random() - 0.5);

    buttons.forEach((btn, idx) => {
        btn.textContent = choices[idx];
    });
}

// --- INPUT HANDLING ---
let currentFillInput = '';
function handleVKInput(e) {
    const key = e.target.getAttribute('data-key');
    const display = document.getElementById('fill-display');
    
    if (key === 'enter') {
        if (currentFillInput !== '') {
            handleAnswer(currentFillInput);
            currentFillInput = '';
        }
    } else if (key === 'backspace') {
        currentFillInput = currentFillInput.slice(0, -1);
    } else {
        // limit length
        if (currentFillInput.length < 10) {
            currentFillInput += key;
        }
    }
    display.textContent = currentFillInput;
}

function handleAnswer(userAnsStr) {
    const correctAns = GAME_STATE.currentQuestionData.answer;
    // Compare as float to avoid string mismatch (e.g. "2.5" vs "2.50")
    const userAnsNum = parseFloat(userAnsStr);
    
    const isCorrect = userAnsNum === correctAns;

    // Record
    GAME_STATE.records.push({
        qNum: GAME_STATE.currentQ,
        qStr: GAME_STATE.currentQuestionData.qStr.replace(' = ?', ''),
        userAns: isCorrect ? correctAns : (isNaN(userAnsNum) ? userAnsStr : userAnsNum), // keep what they entered
        correctAns: correctAns,
        isCorrect: isCorrect
    });

    if (isCorrect) {
        showFeedback(true);
        // Score calculation (difficulty & operation multiplier)
        let baseScore = GAME_STATE.difficulty * 10; // 1位數:10, 2位數:20, 3位數:30
        let opMultiplier = (GAME_STATE.currentQuestionData.op === '*' || GAME_STATE.currentQuestionData.op === '/') ? 2 : 1; // 乘除加倍
        GAME_STATE.score += baseScore * opMultiplier;
    } else {
        showFeedback(false);
        if (GAME_STATE.ruleLife) {
            GAME_STATE.life--;
            updateLifeUI();
        }
    }

    // Check game over
    if (GAME_STATE.ruleLife && GAME_STATE.life <= 0) {
        setTimeout(endGame, 1000);
        return;
    }

    if (GAME_STATE.gameMode !== 'infinite' && GAME_STATE.currentQ >= GAME_STATE.gameMode) {
        setTimeout(endGame, 1000);
        return;
    }

    GAME_STATE.currentQ++;
    setTimeout(nextQuestion, 1000); // 1 sec delay to show feedback
}

function showFeedback(isCorrect) {
    const overlay = document.getElementById('feedback-overlay');
    const icon = document.getElementById('feedback-icon');
    
    icon.textContent = isCorrect ? '⭕' : '❌';
    icon.style.color = isCorrect ? 'var(--primary-color)' : 'var(--danger-color)';
    
    overlay.classList.add('show');
    setTimeout(() => {
        overlay.classList.remove('show');
    }, 800);
}

// --- UI UPDATES ---
function updateGameUI() {
    document.getElementById('current-score').textContent = GAME_STATE.score;
    document.getElementById('current-q-num').textContent = GAME_STATE.currentQ;
}

function updateLifeUI() {
    let hearts = '';
    for(let i=0; i<GAME_STATE.life; i++) hearts += '❤️';
    for(let i=GAME_STATE.life; i<3; i++) hearts += '🖤';
    document.getElementById('life-container').textContent = hearts;
}

function switchScreen(screenId) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenId].classList.add('active');
}

// --- GAME OVER & RESULTS ---
function endGame() {
    switchScreen('result');
    generatePaper();
    saveLeaderboard();
}

function generatePaper() {
    document.getElementById('paper-name').textContent = GAME_STATE.playerName;
    document.getElementById('paper-points').textContent = GAME_STATE.score;
    
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('paper-time').textContent = timeStr;

    // Calculate score / 100
    let totalQuestions = GAME_STATE.gameMode;
    if (GAME_STATE.gameMode === 'infinite' || (GAME_STATE.ruleLife && GAME_STATE.life <= 0)) {
        totalQuestions = GAME_STATE.currentQ;
        if (totalQuestions < 30) totalQuestions = 30; // 防呆
    }
    
    const correctCount = GAME_STATE.records.filter(r => r.isCorrect).length;
    const paperScore = Math.round((correctCount / totalQuestions) * 100);
    document.getElementById('paper-score').textContent = paperScore;

    // Render Table
    const tbody = document.getElementById('paper-tbody');
    tbody.innerHTML = '';

    GAME_STATE.records.forEach(r => {
        const tr = document.createElement('tr');
        
        let correctHtml = '';
        if (r.isCorrect) {
            correctHtml = '<span class="text-correct">✔️</span>';
        } else {
            correctHtml = `<span class="text-wrong">❌</span> <span class="correction text-wrong">更正: ${r.correctAns}</span>`;
        }

        tr.innerHTML = `
            <td>${r.qNum}</td>
            <td>${r.qStr} = </td>
            <td>${r.userAns}</td>
            <td>${r.correctAns}</td>
            <td>${correctHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- LEADERBOARD ---
function saveLeaderboard() {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    
    const record = {
        name: GAME_STATE.playerName,
        score: GAME_STATE.score,
        time: timeStr
    };

    let lb = JSON.parse(localStorage.getItem('mathQuizLeaderboard') || '[]');
    lb.push(record);
    // Sort descending by score
    lb.sort((a, b) => b.score - a.score);
    // Keep top 10
    lb = lb.slice(0, 10);
    
    localStorage.setItem('mathQuizLeaderboard', JSON.stringify(lb));
    renderLeaderboard();
}

function renderLeaderboard() {
    const tbody = document.getElementById('lb-tbody');
    tbody.innerHTML = '';
    
    const lb = JSON.parse(localStorage.getItem('mathQuizLeaderboard') || '[]');
    if (lb.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">目前還沒有紀錄喔！</td></tr>';
        return;
    }

    lb.forEach((item, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td>${item.name}</td>
            <td>${item.score}</td>
            <td>${item.time}</td>
        `;
        tbody.appendChild(tr);
    });
}

function restartGame() {
    switchScreen('setup');
}
