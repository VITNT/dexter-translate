import { signDictionary } from './sign-dictionary';

let currentLang = 'asl';
let searchQuery = '';
let selectedCategory = 'all';

window.switchLanguage = function(lang) {
    currentLang = lang;
    selectedCategory = 'all';
    const isAsl = lang === 'asl';

    const aslTab = document.getElementById('tab-asl');
    const cslTab = document.getElementById('tab-csl');
    aslTab.classList.toggle('active', isAsl);
    cslTab.classList.toggle('active', !isAsl);
    aslTab.setAttribute('aria-pressed', String(isAsl));
    cslTab.setAttribute('aria-pressed', String(!isAsl));

    const languageCode = isAsl ? 'ASL' : 'CSL';
    document.getElementById('activeLanguageCode').innerText = languageCode;
    document.title = `SignDex | ${languageCode}`;
    const searchInput = document.getElementById('signSearch');
    if (searchInput) {
        searchInput.placeholder = `Search ${languageCode} signs`;
        searchInput.setAttribute('aria-label', `Search ${languageCode} signs`);
    }

    const newUrl = new URL(window.location);
    newUrl.searchParams.set('lang', lang);
    window.history.pushState({}, '', newUrl);
    renderCategoryFilter();
    renderDictionary();
};

window.toggleFlashcardMode = function() {
    document.getElementById('dictGrid').classList.toggle(
        'flashcard-active',
        document.getElementById('flashcardToggle').checked
    );
};

function renderCategoryFilter() {
    const filter = document.getElementById('categoryFilter');
    if (!filter) return;

    const categories = [...new Set(signDictionary[currentLang].map((entry) => entry.category))]
        .sort((a, b) => a.localeCompare(b));
    filter.innerHTML = [
        '<option value="all">All categories</option>',
        ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    ].join('');
    filter.value = selectedCategory;
}

function renderDictionary() {
    const grid = document.getElementById('dictGrid');
    grid.innerHTML = '';
    const normalizedQuery = normalizeSearchValue(searchQuery);
    document.querySelector('.dict-reference-chart')?.remove();

    if (currentLang === 'csl' && !normalizedQuery && selectedCategory === 'all') {
        const chartCard = document.createElement('div');
        chartCard.className = 'dict-reference-chart';
        chartCard.innerHTML = '<img src="/images/csl/csl-reference-chart.png" alt="CSL reference chart">';
        grid.parentElement.insertBefore(chartCard, grid);
    }

    for (const entry of signDictionary[currentLang]) {
        const searchableText = [entry.word, entry.translation, entry.category, ...(entry.aliases || [])].join(' ');
        if (normalizedQuery && !normalizeSearchValue(searchableText).includes(normalizedQuery)) continue;
        if (selectedCategory !== 'all' && entry.category !== selectedCategory) continue;

        const card = document.createElement('article');
        card.className = 'dict-card';
        card.dataset.word = normalizeSearchValue(entry.word);
        card.dataset.category = entry.category;
        card.tabIndex = 0;
        card.setAttribute('aria-label', `${entry.word}${entry.translation ? ` — ${entry.translation}` : ''}`);
        card.addEventListener('click', (event) => {
            if (event.target.closest('a, button')) return;
            if (!grid.classList.contains('flashcard-active')) return;
            flipCard(card);
        });
        card.addEventListener('keydown', (event) => {
            if (!grid.classList.contains('flashcard-active') || !['Enter', ' '].includes(event.key)) return;
            event.preventDefault();
            flipCard(card);
        });

        const stepCount = entry.media.filter((item) => item.type === 'image').length;
        const typeLabel = entry.media.some((item) => item.type === 'video')
            ? 'Word'
            : stepCount > 1
                ? `${stepCount} steps`
                : entry.category;
        card.innerHTML = `
            <div class="dict-card-inner">
                <div class="dict-card-front">
                    <span class="flashcard-text">${escapeHtml(entry.word)}</span>
                    ${entry.translation ? `<span class="flashcard-hint">${escapeHtml(entry.translation)}</span>` : ''}
                </div>
                <div class="dict-card-back">
                    <div class="dict-media" data-media-count="${entry.media.length}"></div>
                    <div class="dict-label">
                        <span class="dict-word">${escapeHtml(entry.word)}</span>
                        ${entry.translation ? `<span class="dict-translation">${escapeHtml(entry.translation)}</span>` : ''}
                        <span class="dict-media-badge">${escapeHtml(typeLabel)}</span>
                    </div>
                </div>
            </div>`;
        grid.appendChild(card);
        loadEntryMedia(card, entry.media, updateSearchResultsStatus);
    }

    updateSearchResultsStatus();
}

function flipCard(card) {
    const wasFlipped = card.classList.contains('flipped');
    document.querySelectorAll('.dict-card.flipped').forEach((item) => item.classList.remove('flipped'));
    if (!wasFlipped) card.classList.add('flipped');
}

function loadEntryMedia(card, media, onUnavailable) {
    const container = card.querySelector('.dict-media');
    let failedCount = 0;

    for (const item of media) {
        const frame = document.createElement('div');
        frame.className = 'dict-media-frame loading';

        const markLoaded = () => frame.classList.remove('loading');
        const markUnavailable = () => {
            failedCount += 1;
            frame.remove();
            if (failedCount === media.length) {
                card.remove();
                onUnavailable?.();
            }
        };

        if (item.type === 'video') {
            const element = document.createElement('video');
            element.src = item.src;
            element.autoplay = true;
            element.loop = true;
            element.muted = true;
            element.playsInline = true;
            element.preload = 'metadata';
            element.setAttribute('aria-label', `${card.getAttribute('aria-label')} sign demonstration`);
            element.addEventListener('loadeddata', markLoaded, { once: true });
            element.addEventListener('error', markUnavailable, { once: true });
            frame.appendChild(element);
        } else {
            const element = document.createElement('img');
            element.src = item.src;
            element.alt = `${card.getAttribute('aria-label')} sign${media.length > 1 ? ' step' : ''}`;
            element.loading = 'lazy';
            element.addEventListener('load', markLoaded, { once: true });
            element.addEventListener('error', markUnavailable, { once: true });
            frame.appendChild(element);
        }

        container.appendChild(frame);
    }
}

function normalizeSearchValue(value) {
    return String(value).normalize('NFKC').trim().toLocaleLowerCase();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function updateSearchResultsStatus() {
    const grid = document.getElementById('dictGrid');
    const status = document.getElementById('searchResultsStatus');
    const emptyState = document.getElementById('dictionaryEmptyState');
    if (!grid || !status || !emptyState) return;

    const resultCount = grid.querySelectorAll('.dict-card').length;
    const languageCode = currentLang.toUpperCase();
    const trimmedQuery = searchQuery.trim();
    const filterSuffix = selectedCategory === 'all' ? '' : ` in ${selectedCategory}`;
    status.textContent = trimmedQuery
        ? `${resultCount} ${resultCount === 1 ? 'sign' : 'signs'} found for “${trimmedQuery}”${filterSuffix}.`
        : `${resultCount} ${languageCode} ${resultCount === 1 ? 'sign' : 'signs'}${filterSuffix}.`;
    emptyState.hidden = resultCount !== 0;
}

function initializeLearnPage() {
    document.getElementById('flashcardToggle')?.addEventListener('change', window.toggleFlashcardMode);
    document.getElementById('tab-asl')?.addEventListener('click', () => window.switchLanguage('asl'));
    document.getElementById('tab-csl')?.addEventListener('click', () => window.switchLanguage('csl'));
    const categoryFilter = document.getElementById('categoryFilter');
    categoryFilter?.addEventListener('change', (event) => {
        selectedCategory = event.currentTarget.value;
        renderDictionary();
    });
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

    const requestedLang = new URLSearchParams(window.location.search).get('lang');
    window.switchLanguage(requestedLang === 'csl' ? 'csl' : 'asl');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLearnPage, { once: true });
} else {
    initializeLearnPage();
}
