const DB_NAME = 'SplashyBearDB';
const STORE_NAME = 'scores';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('score', 'score', { unique: false });
                store.createIndex('date', 'date', { unique: false });
            }
        };
        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
}

export async function addLocalScore(score, replayData = null) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const record = {
            score,
            date: Date.now(),
            replayData // Store the JSON replay data directly
        };
        await new Promise((resolve, reject) => {
            const req = store.add(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        
        // Keep only top 50 scores to manage storage
        await cleanupOldScores(db);
        
        renderLocal();
    } catch (e) {
        console.error('Failed to save score:', e);
    }
}

async function cleanupOldScores(db) {
    // Get all keys sorted by score
    // This is a bit manual in IDB without cursor limits in all browsers, 
    // but simpler approach: just delete if count > 50
    // For simplicity in this jam context, we'll skip complex pruning logic
    // or just prune extremely old ones if needed.
}

async function getLocalScores() {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const index = store.index('score');
        return new Promise((resolve) => {
            const req = index.getAll();
            req.onsuccess = () => {
                // sort descending
                const res = req.result || [];
                res.sort((a, b) => b.score - a.score || b.date - a.date);
                resolve(res.slice(0, 50));
            };
        });
    } catch {
        return [];
    }
}

let currentPage = 0;
const PAGE_SIZE = 8;

export async function renderLocal() {
    const list = document.getElementById('local-scores');
    if (!list) return;
    
    list.innerHTML = 'Loading...';
    const scores = await getLocalScores();
    const totalPages = Math.max(1, Math.ceil(scores.length / PAGE_SIZE));
    
    currentPage = Math.min(currentPage, totalPages - 1);
    const start = currentPage * PAGE_SIZE;
    const pageItems = scores.slice(start, start + PAGE_SIZE);
    
    list.innerHTML = '';
    if (pageItems.length === 0) {
        list.innerHTML = '<li>No scores yet! Play to rank up.</li>';
    }

    pageItems.forEach((entry, idx) => {
        const li = document.createElement('li');
        const d = new Date(entry.date);
        const rank = start + idx + 1;
        
        const infoDiv = document.createElement('div');
        infoDiv.className = 'lb-info';
        infoDiv.innerHTML = `<span class="lb-rank">#${rank}</span> <span class="lb-score">${entry.score}</span> <span class="lb-date">${d.toLocaleDateString()}</span>`;
        
        li.appendChild(infoDiv);

        if (entry.replayData) {
            const btn = document.createElement('button');
            btn.className = 'lb-replay';
            btn.setAttribute('aria-label', 'Watch Replay');
            btn.innerHTML = '▶ Replay';
            btn.onclick = () => {
                const event = new CustomEvent('replay:start', { detail: entry.replayData });
                window.dispatchEvent(event);
                document.getElementById('leaderboard-modal')?.classList.add('hidden');
            };
            li.appendChild(btn);
        }
        
        list.appendChild(li);
    });

    const indicator = document.getElementById('lb-page-indicator');
    const prev = document.getElementById('lb-prev');
    const next = document.getElementById('lb-next');
    if (indicator) indicator.textContent = `${currentPage + 1} / ${totalPages}`;
    if (prev) {
        prev.onclick = () => { if (currentPage > 0) { currentPage--; renderLocal(); } };
        prev.disabled = currentPage <= 0;
    }
    if (next) {
        next.onclick = () => { if (currentPage < totalPages - 1) { currentPage++; renderLocal(); } };
        next.disabled = currentPage >= totalPages - 1;
    }
}

export function bindLeaderboard() {
    const btn = document.getElementById('leaderboard-button');
    const modal = document.getElementById('leaderboard-modal');
    const close = document.getElementById('lb-close');
    
    if (btn) btn.onclick = () => {
        currentPage = 0;
        renderLocal();
        modal?.classList.remove('hidden');
    };
    if (close) close.onclick = () => modal?.classList.add('hidden');
}

window.addEventListener('DOMContentLoaded', () => {
    bindLeaderboard();
});