let currentLang = 'asl';
let searchQuery = '';
const aslVocab = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(word => ({ word }));
let cslVocab = ['កម្ពុជា', 'ត្រូវ', 'ឆ្ងាញ់', 'អរគុណ', 'ខុស'].map(word => ({
    word,
    basePath: `images/csl/${word}`,
    extensions: ['gif']
}));
const availableCslReferenceForms = new Set(['form_aa', 'form_ab', 'form_ac', 'form_u', 'form_v', 'form_x']);

async function loadVocabs() {
    try {
        const response = await fetch('./models/csl/static-landmark-v1.json');
        if (response.ok) {
            const model = await response.json();
            cslVocab.push(...model.classes.flatMap((form, index) => {
                if (!availableCslReferenceForms.has(form)) return [];
                return [{
                    word: model.displayLabels[index] || form,
                    form,
                    basePath: `images/csl/reference/${form}`,
                    extensions: ['jpg']
                }];
            }));
        }
    } catch (error) {
        console.warn('Static CSL reference library is unavailable.', error);
    }

    const requestedLang = new URLSearchParams(window.location.search).get('lang');
    switchLanguage(requestedLang === 'csl' ? 'csl' : 'asl');
}

window.switchLanguage = function(lang) {
    currentLang = lang;
    const isAsl = lang === 'asl';

    // highlight the active language tab
    const aslTab = document.getElementById('tab-asl');
    const cslTab = document.getElementById('tab-csl');
    aslTab.classList.toggle('active', isAsl);
    cslTab.classList.toggle('active', !isAsl);
    aslTab.setAttribute('aria-pressed', String(isAsl));
    cslTab.setAttribute('aria-pressed', String(!isAsl));

    // Keep SignDex as the product name and show the selected language separately.
    const languageCode = isAsl ? 'ASL' : 'CSL';
    document.getElementById('activeLanguageCode').innerText = languageCode;
    document.title = `SignDex | ${languageCode}`;
    const searchInput = document.getElementById('signSearch');
    if (searchInput) {
        searchInput.placeholder = `Search ${languageCode} signs`;
        searchInput.setAttribute('aria-label', `Search ${languageCode} signs`);
    }

    // secretly update the url so sharing the link works, without reloading the page
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('lang', lang);
    window.history.pushState({}, '', newUrl);
    renderDictionary();
};

window.toggleFlashcardMode = function() {
    document.getElementById('dictGrid').classList.toggle(
        'flashcard-active',
        document.getElementById('flashcardToggle').checked
    );
};

function renderDictionary() {
    const grid = document.getElementById('dictGrid');
    grid.innerHTML = '';
    const vocab = currentLang === 'asl' ? aslVocab : cslVocab;
    const normalizedQuery = normalizeSearchValue(searchQuery);
    document.querySelector('.dict-reference-chart')?.remove();

    if (currentLang === 'csl' && !normalizedQuery) {
        const chartCard = document.createElement('div');
        chartCard.className = 'dict-reference-chart';
        chartCard.innerHTML = '<img src="images/csl/csl-reference-chart.png" alt="CSL reference chart">';
        grid.parentElement.insertBefore(chartCard, grid);
    }

    for (const entry of vocab) {
        const word = entry.word;
        const cleanWord = word.trim().toLowerCase();
        if (['idle', 'none', '', 'still'].includes(cleanWord)) continue;
        const searchableText = `${word} ${entry.form || ''}`;
        if (normalizedQuery && !normalizeSearchValue(searchableText).includes(normalizedQuery)) continue;
        const isDynamicAsl = currentLang === 'asl' && ['j', 'z'].includes(cleanWord);
        const extensions = entry.extensions || (isDynamicAsl ? ['gif', 'png', 'jpg'] : ['png', 'jpg', 'gif']);
        const basePath = entry.basePath ?? `images/${currentLang}/${cleanWord}`;
        if (!basePath || !extensions.length) continue;

        const card = document.createElement('div');
        card.className = 'dict-card';
        card.dataset.word = cleanWord;
        if (entry.form) card.dataset.form = entry.form;
        card.addEventListener('click', (event) => {
            if (event.target.closest('.dex-nav-dropdown-item')) return;
            if (!grid.classList.contains('flashcard-active')) return;
            const wasFlipped = card.classList.contains('flipped');
            document.querySelectorAll('.dict-card.flipped').forEach(item => item.classList.remove('flipped'));
            if (!wasFlipped) card.classList.add('flipped');
        });

        card.innerHTML = `
            <div class="dict-card-inner">
                <div class="dict-card-front"><span class="flashcard-text">${word}</span></div>
                <div class="dict-card-back">
                    <div class="dict-img-placeholder loading">
                        <img alt="${word} sign">
                    </div>
                    <div class="dict-label">${word}</div>
                </div>
            </div>`;
        grid.appendChild(card);

        loadBestImage(card, basePath, extensions, updateSearchResultsStatus);
    }

    updateSearchResultsStatus();
}

function normalizeSearchValue(value) {
    return String(value).normalize('NFKC').trim().toLocaleLowerCase();
}

function updateSearchResultsStatus() {
    const grid = document.getElementById('dictGrid');
    const status = document.getElementById('searchResultsStatus');
    const emptyState = document.getElementById('dictionaryEmptyState');
    if (!grid || !status || !emptyState) return;

    const resultCount = grid.querySelectorAll('.dict-card').length;
    const languageCode = currentLang.toUpperCase();
    const trimmedQuery = searchQuery.trim();
    status.textContent = trimmedQuery
        ? `${resultCount} ${resultCount === 1 ? 'sign' : 'signs'} found for “${trimmedQuery}”.`
        : `${resultCount} ${languageCode} ${resultCount === 1 ? 'sign' : 'signs'}.`;
    emptyState.hidden = resultCount !== 0;
}

function loadBestImage(card, basePath, extensions, onUnavailable) {
    const img = card.querySelector('img');
    const placeholder = card.querySelector('.dict-img-placeholder');
    let extensionIndex = 0;

    img.onload = () => {
        img.classList.add('loaded');
        placeholder.classList.remove('loading');
    };
    img.onerror = tryNextExtension;

    function tryNextExtension() {
        if (extensionIndex >= extensions.length) {
            card.remove();
            onUnavailable?.();
            return;
        }
        img.src = `${basePath}.${extensions[extensionIndex++]}`;
    }
    tryNextExtension();
}

function initializeLearnPage() {
    document.getElementById('flashcardToggle')?.addEventListener('change', window.toggleFlashcardMode);
    document.getElementById('tab-asl')?.addEventListener('click', () => window.switchLanguage('asl'));
    document.getElementById('tab-csl')?.addEventListener('click', () => window.switchLanguage('csl'));
    const searchInput = document.getElementById('signSearch');
    searchInput?.addEventListener('input', (event) => {
        searchQuery = event.currentTarget.value;
        renderDictionary();
    });
    searchInput?.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || !event.currentTarget.value) return;
        event.currentTarget.value = '';
        searchQuery = '';
        renderDictionary();
    });
    loadVocabs();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLearnPage, { once: true });
} else {
    initializeLearnPage();
}
