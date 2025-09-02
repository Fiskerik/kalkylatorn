/**
 * index.js - Main initialization and form handling for the Föräldrapenningkalkylator
 * Sets up event listeners and orchestrates calculations, UI, and chart rendering.
 */
import { 
    vårdnad, beräknaPartner, barnbidragPerPerson, tilläggPerPerson, 
    barnIdag, barnPlanerat, hasCalculated, defaultPreferences,
    förälder1InkomstDagar, förälder2InkomstDagar, förälder1MinDagar, förälder2MinDagar
} from './config.js';
import {
    beräknaDaglig,
    beräknaBarnbidrag,
    optimizeParentalLeave,
    beräknaFöräldralön,
    beräknaNetto
} from './calculations.js';
import {
    updateProgress, setupInfoBoxToggle,
    generateParentSection, setupStrategyToggle, updateMonthlyBox
} from './ui.js';
import { renderGanttChart } from './chart.js';

/**
 * Retrieve saved scenarios from localStorage.
 * @returns {Array} stored scenarios
 */
function getScenarios() {
    const raw = localStorage.getItem('scenarios');
    return raw ? JSON.parse(raw) : [];
}

/**
 * Save a scenario to localStorage.
 * @param {Object} inputs - Input values for the calculation
 * @param {string} resultHtml - Generated result HTML
 */
function saveScenario(inputs, resultHtml) {
    const scenarios = getScenarios();
    const parser = new DOMParser();
    const doc = parser.parseFromString(resultHtml, 'text/html');
    doc.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    scenarios.push({
        id: Date.now().toString(),
        name: `Scenario ${scenarios.length + 1}`,
        inputs,
        result: doc.body.innerHTML
    });
    localStorage.setItem('scenarios', JSON.stringify(scenarios));
    populateComparison();
}

/**
 * Populate scenario selectors for comparison view.
 */
function populateComparison() {
    const scenarios = getScenarios();
    const selectA = document.getElementById('scenario-select-a');
    const selectB = document.getElementById('scenario-select-b');
    if (!selectA || !selectB) return;
    const fill = select => {
        select.innerHTML = '<option value="">Välj scenario</option>';
        scenarios.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            select.appendChild(opt);
        });
    };
    fill(selectA);
    fill(selectB);
    const view = document.getElementById('comparison-view');
    if (view) view.style.display = scenarios.length ? 'block' : 'none';
}

/**
 * Attach change listeners for scenario comparison selectors.
 */
function setupComparisonHandlers() {
    const attach = (selectId, targetId) => {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.addEventListener('change', () => {
            const scenarios = getScenarios();
            const sc = scenarios.find(s => s.id === select.value);
            const target = document.getElementById(targetId);
            if (target) target.innerHTML = sc ? sc.result : '';
        });
    };
    attach('scenario-select-a', 'scenario-result-a');
    attach('scenario-select-b', 'scenario-result-b');
}

/**
 * Build a shareable URL with query parameters for a scenario.
 * @param {Object} inputs - Input values
 * @returns {string} shareable URL
 */
function createShareLink(inputs) {
    const params = new URLSearchParams(inputs);
    return `${window.location.origin}${window.location.pathname}?${params.toString()}`;
}

/**
 * Load scenario from URL query parameters on page load.
 */
function loadScenarioFromQuery() {
    const params = new URLSearchParams(window.location.search);
    if (!params.toString()) return;
    params.forEach((value, key) => {
        const el = document.getElementById(key);
        if (el) el.value = value;
    });
    handleFormSubmit({ preventDefault: () => {} });
}


// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
    populateComparison();
    setupComparisonHandlers();
    loadScenarioFromQuery();
});

/**
 * Initialize form elements and UI
 */
function initializeForm() {
    // Initialize progress bar
    updateProgress(1);

    // Setup strategy and info boxes
    setupStrategyToggle();
    setupInfoBoxToggle();
}

/**
 * Setup all event listeners
 */
function setupEventListeners() {
    const form = document.getElementById('calc-form');
    const optimizeBtn = document.getElementById('optimize-btn');

    // Form submission
    form.addEventListener('submit', handleFormSubmit);

    // Optimization button
    optimizeBtn.addEventListener('click', handleOptimize);

    // Dropdown listeners for uttag
    setupDropdownListeners();

    // Leave distribution slider
    setupLeaveSlider();
}


/**
 * Handle form submission
 * @param {Event} e - Form submission event
 */
function handleFormSubmit(e) {
    e.preventDefault();

    // Collect form inputs
    const inkomst1 = parseFloat(document.getElementById('inkomst1').value) || 0;
    const inkomst2 = parseFloat(document.getElementById('inkomst2').value) || 0;
    const skattesats = parseFloat(document.getElementById('skattesats').value) || 0;
    const vårdnad = document.getElementById('vårdnad').value || 'gemensam';
    const beräknaPartner = document.getElementById('beräkna-partner').value || 'ja';
    const barnTidigare = parseInt(document.getElementById('barn-tidigare').value) || 0;
    const barnPlanerade = parseInt(document.getElementById('barn-planerade').value) || 1;
    const avtal1 = document.getElementById('har-avtal-1').value || 'nej';
    const avtal2 = document.getElementById('har-avtal-2').value || 'nej';
    const anst1 = document.getElementById('anstallningstid-1').value || '';
    const anst2 = document.getElementById('anstallningstid-2').value || '';

    // Validate inputs
    if (barnTidigare === 0 && barnPlanerade === 0) {
        document.getElementById('barn-selection-error').style.display = 'block';
        return;
    } else {
        document.getElementById('barn-selection-error').style.display = 'none';
    }

    // Calculate child benefits
    const totalBarn = barnTidigare + barnPlanerade;
    const barnbidragResult = beräknaBarnbidrag(totalBarn, vårdnad === 'ensam');

    // Calculate daily rates and parental supplement
    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = avtal1 === 'ja' && anst1 !== '0-5' ? beräknaFöräldralön(inkomst1) : 0;
    const dag2 = beräknaPartner === 'ja' && vårdnad === 'gemensam' ? beräknaDaglig(inkomst2) : 0;
    const extra2 = avtal2 === 'ja' && anst2 !== '0-5' && beräknaPartner === 'ja' ? beräknaFöräldralön(inkomst2) : 0;
    const netto1 = beräknaNetto(inkomst1, skattesats);
    const netto2 = beräknaNetto(inkomst2, skattesats);

    // Generate results
    const resultBlock = document.getElementById('result-block');
    let resultHtml = '';

    // Parent 1 results
    const månadsinkomst1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
        resultHtml += generateParentSection(
            1, dag1, extra1, månadsinkomst1, förälder1InkomstDagar,
            avtal1 === 'ja', barnbidragResult.barnbidrag,
            barnbidragResult.tillägg, vårdnad === 'ensam',
            inkomst1, netto1
        );

    // Parent 2 results (if applicable)
    if (vårdnad === 'gemensam' && beräknaPartner === 'ja') {
        const månadsinkomst2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
        resultHtml += generateParentSection(
            2, dag2, extra2, månadsinkomst2, förälder2InkomstDagar,
            avtal2 === 'ja', barnbidragResult.barnbidrag,
            barnbidragResult.tillägg, false, inkomst2, netto2
        );
    }

    resultBlock.innerHTML = resultHtml;
    document.getElementById('strategy-group').style.display = 'block';
    document.getElementById('preferences-section').style.display = 'block';
    document.getElementById('optimize-btn').style.display = 'block';
    updateProgress(7);

    // Reinitialize info box toggles for dynamically added content
    setupInfoBoxToggle();

    // Store global state for optimization
    window.appState = {
        inkomst1,
        inkomst2,
        skattesats,
        netto1,
        netto2,
        vårdnad,
        beräknaPartner,
        barnbidragPerPerson: barnbidragResult.barnbidrag,
        tilläggPerPerson: barnbidragResult.tillägg,
        dag1,
        extra1,
        dag2,
        extra2,
        avtal1: avtal1 === 'ja',
        avtal2: avtal2 === 'ja',
        anställningstid1: anst1,
        anställningstid2: anst2
    };

    const leaveContainer = document.getElementById('leave-slider-container');
    if (leaveContainer && (vårdnad === 'ensam' || beräknaPartner === 'nej')) {
        leaveContainer.style.display = 'none';
    }

    // Update dropdown listeners for monthly boxes
    setupDropdownListeners();

    const inputs = {
        inkomst1,
        inkomst2,
        vårdnad,
        'beräkna-partner': beräknaPartner,
        'barn-tidigare': barnTidigare,
        'barn-planerade': barnPlanerade,
        'har-avtal-1': avtal1,
        'har-avtal-2': avtal2,
        'anstallningstid-1': anst1,
        'anstallningstid-2': anst2
    };
    const shareLink = document.getElementById('share-link');
    if (shareLink) {
        shareLink.href = createShareLink(inputs);
        shareLink.style.display = 'inline';
        const container = document.getElementById('share-container');
        if (container) container.style.display = 'block';
    }

    saveScenario(inputs, resultHtml);
}

/**
 * Setup dropdown listeners for uttag selections
 */
function setupDropdownListeners() {
    const dropdown1 = document.getElementById('uttags-dagar-1');
    const dropdown2 = document.getElementById('uttags-dagar-2');

    if (dropdown1) {
        dropdown1.addEventListener('change', () => {
            const dagarPerVecka = parseInt(dropdown1.value) || 7;
            updateMonthlyBox(
                'monthly-wrapper-1', dagarPerVecka, window.appState.dag1, 
                window.appState.extra1, window.appState.barnbidragPerPerson, 
                window.appState.tilläggPerPerson, window.appState.avtal1, 
                förälder1InkomstDagar
            );
        });
    }

    if (dropdown2) {
        dropdown2.addEventListener('change', () => {
            const dagarPerVecka = parseInt(dropdown2.value) || 7;
            updateMonthlyBox(
                'monthly-wrapper-2', dagarPerVecka, window.appState.dag2, 
                window.appState.extra2, window.appState.barnbidragPerPerson, 
                window.appState.tilläggPerPerson, window.appState.avtal2, 
                förälder2InkomstDagar
            );
        });
    }
}

/**
 * Handle optimization button click
 */
function handleOptimize() {
    updateProgress(8);
    const barnDatumInput = document.getElementById('barn-datum');
    const ledigTid1Input = document.getElementById('ledig-tid-5823');
    const minInkomstInput = document.getElementById('min-inkomst');
    const strategyInput = document.getElementById('strategy');

    // Validate inputs
    if (!barnDatumInput || !ledigTid1Input || !minInkomstInput || !strategyInput) {
        console.error('Required input elements not found');
        document.getElementById('leave-duration-error').style.display = 'block';
        document.getElementById('leave-duration-error').textContent = 'Formulärfel: Kontrollera att alla fält är korrekt ifyllda.';
        return;
    }

    const barnDatum = barnDatumInput.value || '2025-05-01';
    const totalMonths = parseFloat(ledigTid1Input.value) || 0;
    const slider = document.getElementById('leave-slider');
    const ledigTid1 = slider ? parseFloat(slider.value) || 0 : 0;
    const ledigTid2 = Math.max(totalMonths - ledigTid1, 0);
    const minInkomst = parseInt(minInkomstInput.value) || 10000;
    const strategy = strategyInput.value || 'longer';
    const deltid = defaultPreferences.deltid; // From config, could be made dynamic

    const preferences = {
        deltid,
        ledigTid1,
        ledigTid2,
        minInkomst,
        strategy
    };

    const inputs = {
        inkomst1: window.appState.inkomst1,
        inkomst2: window.appState.inkomst2,
        avtal1: window.appState.avtal1 ? 'ja' : 'nej',
        avtal2: window.appState.avtal2 ? 'ja' : 'nej',
        anställningstid1: window.appState.anställningstid1,
        anställningstid2: window.appState.anställningstid2,
        vårdnad: window.appState.vårdnad,
        beräknaPartner: window.appState.beräknaPartner,
        barnbidragPerPerson: window.appState.barnbidragPerPerson,
        tilläggPerPerson: window.appState.tilläggPerPerson,
        barnDatum
    };
    const optimizationResult = document.getElementById('optimization-result');
    if (optimizationResult) {
        optimizationResult.style.display = 'block'; // Ensure the section is visible
    } else {
        console.error('optimization-result element not found');
        return;
    }

    try {
        const result = optimizeParentalLeave(preferences, inputs);

        // Validate leave duration and show message but continue rendering chart
        const err = document.getElementById('leave-duration-error');
        if (!result.genomförbarhet.ärGenomförbar) {
            err.textContent = result.genomförbarhet.meddelande;
            err.style.display = 'block';
        } else {
            err.style.display = 'none';
        }

        // `användaInkomstDagar` already accounts for both periods with and without
        // parental supplement, so avoid double counting by excluding `plan1NoExtra`
        // and `plan2NoExtra` from the totals.
        const totalDays1 =
            result.plan1.användaInkomstDagar +
            result.plan1.användaMinDagar;
        const totalDays2 =
            result.plan2.användaInkomstDagar +
            result.plan2.användaMinDagar;
        const transferred = result.genomförbarhet.transferredDays || 0;
        const maxDays1 = förälder1InkomstDagar + förälder1MinDagar + transferred;
        const maxDays2 = förälder2InkomstDagar + förälder2MinDagar - transferred;

        if (totalDays1 > maxDays1 || totalDays2 > maxDays2) {
            err.style.display = 'block';
            return;
        }

        // Render Gantt chart
        document.getElementById('optimization-result').style.display = 'block';
        renderGanttChart(
            result.plan1,
            result.plan2,
            result.plan1NoExtra,
            result.plan2NoExtra,
            result.plan1MinDagar,
            result.plan2MinDagar,
            result.plan1Overlap,
            window.appState.inkomst1,
            window.appState.inkomst2,
            window.appState.vårdnad,
            window.appState.beräknaPartner,
            result.genomförbarhet,
            result.dag1,
            result.extra1,
            result.dag2,
            result.extra2,
            result.förälder1InkomstDagar,
            result.förälder2InkomstDagar,
            result.förälder1MinDagar,
            result.förälder2MinDagar,
            barnDatum,
            result.arbetsInkomst1,
            result.arbetsInkomst2,
            window.appState.barnbidragPerPerson,
            window.appState.tilläggPerPerson,
            result.maxFöräldralönWeeks1,
            result.maxFöräldralönWeeks2,
            result.unusedFöräldralönWeeks1,
            result.unusedFöräldralönWeeks2
        );


    } catch (error) {
        console.error('Optimization failed:', error);
        document.getElementById('leave-duration-error').style.display = 'block';
        document.getElementById('leave-duration-error').textContent = 
            'Fel vid optimering: Kontrollera indata och försök igen.';
    }
}

function setupLeaveSlider() {
    const totalInput = document.getElementById('ledig-tid-5823');
    const slider = document.getElementById('leave-slider');
    const container = document.getElementById('leave-slider-container');
    const tickList = document.getElementById('leave-ticks');
    const startLabel = document.getElementById('slider-start');
    const endLabel = document.getElementById('slider-end');
    if (!totalInput || !slider || !container) return;

    // Sync slider state with total leave and toggle visibility
    const syncSlider = () => {
        const total = parseFloat(totalInput.value) || 0;
        slider.max = total;
        const step = total > 2 ? 1 : 0.5;
        slider.step = step;
        const half = Math.round(total / 2);
        slider.value = half;
        updateLeaveDisplay(slider, total);
        if (tickList) {
            tickList.innerHTML = '';
            for (let i = 0; i <= total; i += step) {
                tickList.innerHTML += `<option value="${i}"></option>`;
            }
        }
        if (startLabel) startLabel.textContent = '0';
        if (endLabel) endLabel.textContent = total;
        const isSingleParent = window.appState?.vårdnad === 'ensam' || window.appState?.beräknaPartner !== 'ja';
        container.style.display = !isSingleParent && total > 0 ? 'block' : 'none';
    };

    totalInput.addEventListener('input', syncSlider);
    totalInput.addEventListener('change', syncSlider);

    slider.addEventListener('input', () => {
        const total = parseFloat(totalInput.value) || 0;
        updateLeaveDisplay(slider, total);
    });

    syncSlider();
}

function updateLeaveDisplay(slider, total) {
    const p1 = parseFloat(slider.value) || 0;
    const p2 = Math.max(total - p1, 0);
    const p1Elem = document.getElementById('p1-months');
    const p2Elem = document.getElementById('p2-months');
    const format = v => Number.isInteger(v) ? v : v.toFixed(1);
    if (p1Elem) p1Elem.textContent = format(p1);
    if (p2Elem) p2Elem.textContent = format(p2);
    const percent = total > 0 ? (p1 / total) * 100 : 0;
    slider.style.background = `linear-gradient(to right, #28a745 0%, #28a745 ${percent}%, #007bff ${percent}%, #007bff 100%)`;
}
