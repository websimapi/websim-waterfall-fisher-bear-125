import * as THREE from 'three';
import { scene, camera } from '../scene.js';
import { bear, activeFishes, gameState, createGameBear } from './game.js';
import { BEARS, FISH, COSMETICS, getPlayerProgress, savePlayerProgress } from '../unlocks.js';
import { showGameOver, showStart, populateUnlocks } from './ui.js';
import { playSFX, sounds } from './audio.js';
import { addLocalScore, renderLocal } from './leaderboard.js';
import { startRecording, stopRecording, startPlayback, stopPlayback } from './recorder.js';
import { createOrUpdateShowcase, showcaseBear, throwShowcaseFish, walkInShowcaseBear, swapShowcaseToCurrentSelection } from './showcase.js';
import { setControlsActive } from './controls.js';
import * as TWEEN from 'tween';

let __startingSequence = false;
const CAM_OFFSET = new THREE.Vector3(0, 12, 9);

export function setupStartScreen(isFirstLoad = false) {
    console.log("[SETUP] Setting up start screen");
    gameState.current = 'IDLE';
    stopPlayback(); // Ensure no replay is running
    setControlsActive(false); // Disable controls in menu
    
    // Hide HUD
    document.getElementById('replay-hud').classList.add('hidden');
    document.getElementById('score-container').classList.add('hidden');
    document.getElementById('streak-container').classList.add('hidden');

    // Hide any active game objects (but not showcase objects)
    scene.children.forEach(child => {
        if ((child.name === 'bear' || child.name === 'fish') && !child.userData?.isShowcase) {
             child.visible = false;
        }
    });

    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;

    if (bear) {
        scene.remove(bear);
    }

    const playerProgress = getPlayerProgress();
    populateUnlocks(playerProgress, (type, id) => {
        if (type === 'bear') playerProgress.selectedBear = id;
        if (type === 'fish') playerProgress.selectedFish = id;
        if (type === 'cosmetic') playerProgress.selectedCosmetic = id;
        savePlayerProgress(playerProgress);

        const quickBearName = document.querySelector('#choose-bear span');
        const quickBearImg = document.querySelector('#choose-bear img');
        const quickFishName = document.querySelector('#choose-fish span');
        const quickFishImg = document.querySelector('#choose-fish img');
        const quickCosmeticName = document.querySelector('#choose-cosmetic span');
        const quickCosmeticImg = document.querySelector('#choose-cosmetic img');

        const selectedBearInfo = BEARS.find(b => b.id === playerProgress.selectedBear);
        const selectedFishInfo = FISH.find(f => f.id === playerProgress.selectedFish);
        const selectedCosmeticInfo = COSMETICS.find(c => c.id === playerProgress.selectedCosmetic) || null;

        if(quickBearName) quickBearName.textContent = selectedBearInfo.name;
        if(quickBearImg) quickBearImg.src = selectedBearInfo.asset;
        if(quickFishName) quickFishName.textContent = selectedFishInfo.name;
        if(quickFishImg) quickFishImg.src = selectedFishInfo.asset;
        if(quickCosmeticName) quickCosmeticName.textContent = selectedCosmeticInfo && selectedCosmeticInfo.id !== 'none' ? selectedCosmeticInfo.name : 'Cosmetic';
        if(quickCosmeticImg) quickCosmeticImg.src = selectedCosmeticInfo && selectedCosmeticInfo.id !== 'none' ? selectedCosmeticInfo.asset : 'scream_mask_unlock.png';

        swapShowcaseToCurrentSelection();
    });

    // animate log back first, then waddle bear in
    window.__canQuickStart = false;
    animateLogReset(() => {
        createOrUpdateShowcase();
        walkInShowcaseBear();
    });
    showStart(isFirstLoad);
    const startButton = document.getElementById('start-button');
    if (startButton) startButton.innerText = 'START';
}

function startGame(isReplay = false) {
    gameState.current = 'PLAYING';
    gameState.score = 0;
    gameState.streak = 1;

    if (showcaseBear) showcaseBear.visible = false;

    createGameBear();
    
    if (isReplay) {
        setControlsActive(false);
        document.getElementById('replay-hud').classList.remove('hidden');
    } else {
        setControlsActive(true);
        document.getElementById('replay-hud').classList.add('hidden');
        startRecording();
    }
    
    window.dispatchEvent(new CustomEvent('game:started'));
}

export function startGameWithTurnaround() {
    if (__startingSequence) return;
    __startingSequence = true;
    TWEEN.removeAll(); 
    const proceed = () => {
        if (showcaseBear && showcaseBear.visible) {
            showcaseBear.rotation.y = 0; 
            const baseY = 4.65, dur = 900;
            const easeRot = TWEEN.Easing?.Cubic?.InOut || ((k)=>k);
            const easeWob = TWEEN.Easing?.Sine?.InOut || ((k)=>k);
            new TWEEN.Tween(showcaseBear.rotation).to({ y: Math.PI }, dur).easing(easeRot).start();
            const wob = { t: 0 };
            new TWEEN.Tween(wob).to({ t: 1 }, dur).easing(easeWob)
              .onUpdate(()=>{ const phase = wob.t * Math.PI * 4; showcaseBear.rotation.z = Math.sin(phase) * 0.15; showcaseBear.position.y = baseY + Math.abs(Math.sin(phase)) * 0.10; })
              .onComplete(()=>{ showcaseBear.rotation.z = 0; showcaseBear.position.y = baseY; throwShowcaseFish(()=>{ TWEEN.removeAll(); startGame(); __startingSequence = false; }); })
              .start();
        } else { TWEEN.removeAll(); startGame(); __startingSequence = false; }
    };
    proceed();
}

// Replay handling
window.addEventListener('replay:start', (e) => {
    const replayData = e.detail;
    if (startPlayback(replayData)) {
        // Cleanup start screen
        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('score-container').classList.remove('hidden');
        document.getElementById('streak-container').classList.remove('hidden');
        
        startGame(true);
    }
});

document.getElementById('exit-replay-btn')?.addEventListener('click', () => {
    stopPlayback();
    setupStartScreen();
});


export function gameOver() {
    gameState.current = 'GAME_OVER';
    const replayData = stopRecording(); // Stop and get data
    
    document.getElementById('final-score').innerText = gameState.score;
    document.getElementById('replay-hud').classList.add('hidden');

    const playerProgress = getPlayerProgress();
    if (gameState.score > playerProgress.highScore) {
        playerProgress.highScore = gameState.score;
    }
    
    // Check unlocks
    let newUnlock = false;
    BEARS.forEach(b => {
        if (!playerProgress.unlockedBears.includes(b.id) && b.unlockCondition.type === 'score' && playerProgress.highScore >= b.unlockCondition.value) {
            playerProgress.unlockedBears.push(b.id);
            newUnlock = true;
        }
    });
    FISH.forEach(f => {
        if (!playerProgress.unlockedFish.includes(f.id) && f.unlockCondition.type === 'score' && playerProgress.highScore >= f.unlockCondition.value) {
            playerProgress.unlockedFish.push(f.id);
            newUnlock = true;
        }
    });
    COSMETICS.forEach(c => {
        if (!(playerProgress.unlockedCosmetics || []).includes(c.id) && c.unlockCondition.type === 'score' && playerProgress.highScore >= c.unlockCondition.value) {
            if (!playerProgress.unlockedCosmetics) playerProgress.unlockedCosmetics = [];
            playerProgress.unlockedCosmetics.push(c.id);
            newUnlock = true;
        }
    });
    if(newUnlock) savePlayerProgress(playerProgress);

    showGameOver();
    playSFX(sounds.splash);
    activeFishes.forEach(f => scene.remove(f));
    activeFishes.length = 0;

    // Save Score Button Logic
    const saveBtn = document.getElementById('save-score-btn');
    const retryBtn = document.getElementById('retry-btn');
    
    // Clone to remove old listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
    const newRetryBtn = retryBtn.cloneNode(true);
    retryBtn.parentNode.replaceChild(newRetryBtn, retryBtn);

    newSaveBtn.addEventListener('click', async () => {
        newSaveBtn.disabled = true;
        newSaveBtn.innerText = 'Saving...';
        await addLocalScore(gameState.score, replayData); // Save to IDB
        newSaveBtn.innerText = 'Saved!';
        setTimeout(() => proceedToStart(), 800);
    });

    newRetryBtn.addEventListener('click', () => {
        proceedToStart();
    });
}

function proceedToStart() {
    const goScreen = document.getElementById('game-over-screen');
    if (!goScreen) return;
    goScreen.classList.add('fade-out');
    const onFadeOut = () => {
        goScreen.removeEventListener('animationend', onFadeOut);
        setupStartScreen();
        const startButton = document.getElementById('start-button');
        if (startButton) startButton.innerText = 'RETRY';
    };
    goScreen.addEventListener('animationend', onFadeOut);
}

function animateLogReset(done) {
    const log = scene.getObjectByName('log');
    if (!log) { done?.(); return; }
    const camOffsetZ = camera.position.z - log.position.z; 
    new TWEEN.Tween(log.position).to({ z: 1 }, 900).easing(TWEEN.Easing.Cubic.Out)
        .onUpdate(() => {
            camera.position.x = 0; camera.position.y = CAM_OFFSET.y;
            camera.position.z = log.position.z + camOffsetZ;
            camera.lookAt(0, 2, log.position.z);
        })
        .start();
    new TWEEN.Tween(log.rotation)
        .to({ x: 0 }, 900)
        .easing(TWEEN.Easing.Cubic.Out)
        .onComplete(() => { try { done?.(); } catch (e) { console.warn('animateLogReset done() error:', e); } })
        .start();
}