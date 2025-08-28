/**
 * index.js - Main initialization and form handling for the Föräldrapenningkalkylator
 * Sets up event listeners and orchestrates calculations, UI, and chart rendering.
 */
import {
    vårdnad, beräknaPartner, setBarnBenefits,
    barnIdag, barnPlanerat, hasCalculated, defaultPreferences,
    förälder1InkomstDagar, förälder2InkomstDagar, förälder1MinDagar, förälder2MinDagar
} from './config.js';
import { beräknaDaglig, beräknaBarnbidrag, optimizeParentalLeave } from './calculations.js';
import { 
    updateProgress, setupToggleButtons, setupInfoBoxToggle, 
    generateParentSection, setupStrategyToggle, updateMonthlyBox 
} from './ui.js';
import { renderGanttChart } from './chart.js';


// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
});

/**
 * Initialize form elements and UI
 */
function initializeForm() {
    // Set default active buttons
    const vårdnadGroup = document.querySelectorAll('#vårdnad-group .toggle-btn');
    vårdnadGroup.forEach(btn => {
        if (btn.dataset.value === 'gemensam') {
            btn.classList.add('active');
            document.getElementById('vårdnad').value = 'gemensam';
        }
    });

    // Initialize progress bar
    updateProgress(1);

    // Setup toggle buttons for all groups
    setupToggleButtons('vårdnad-group', 'vårdnad', handleVårdnadChange);
    setupToggleButtons('partner-group', 'beräkna-partner', handlePartnerChange);
    setupToggleButtons('barn-tidigare-group', 'barn-tidigare');
    setupToggleButtons('barn-planerade-group', 'barn-planerade');
    setupToggleButtons('avtal-group-1', 'har-avtal-1');
    setupToggleButtons('avtal-group-2', 'har-avtal-2');
    setupStrategyToggle();

    // Setup info box toggles
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
 * Handle vårdnad change
 * @param {string} value - Selected vårdnad value
 */
function handleVårdnadChange(value) {
    const partnerQuestion = document.getElementById('partner-question');
    const inkomstBlock2 = document.getElementById('inkomst-block-2');
    const avtalQuestion2 = document.getElementById('avtal-question-2');
    const partnerLedigTid = document.getElementById('partner-ledig-tid');

    if (value === 'ensam') {
        partnerQuestion.style.display = 'none';
        inkomstBlock2.style.display = 'none';
        avtalQuestion2.style.display = 'none';
        partnerLedigTid.style.display = 'none';
        document.getElementById('beräkna-partner').value = 'nej';
        updateProgress(3); // Skip partner question
    } else {
        partnerQuestion.style.display = 'block';
        updateProgress(2);
    }
}

/**
 * Handle partner calculation change
 * @param {string} value - Selected partner calculation value
 */
function handlePartnerChange(value) {
    const inkomstBlock2 = document.getElementById('inkomst-block-2');
    const avtalQuestion2 = document.getElementById('avtal-question-2');
    const parentLedigTid = document.getElementById('parent-ledig-tid'); // Fixed ID

    if (value === 'ja') {
        inkomstBlock2.style.display = 'block';
        avtalQuestion2.style.display = 'block';
        parentLedigTid.style.display = 'block';
    } else {
        inkomstBlock2.style.display = 'none';
        avtalQuestion2.style.display = 'none';
        parentLedigTid.style.display = 'none';
    }
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
    const vårdnad = document.getElementById('vårdnad').value || 'gemensam';
    const beräknaPartner = document.getElementById('beräkna-partner').value || 'ja';
    const barnTidigare = parseInt(document.getElementById('barn-tidigare').value) || 0;
    const barnPlanerade = parseInt(document.getElementById('barn-planerade').value) || 1;
    const avtal1 = document.getElementById('har-avtal-1').value || 'nej';
    const avtal2 = document.getElementById('har-avtal-2').value || 'nej';

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
    setBarnBenefits(barnbidragResult.barnbidrag, barnbidragResult.tillägg);

    // Calculate daily rates and parental supplement
    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = avtal1 === 'ja' ? Math.round(inkomst1 * 0.10) : 0;
    const dag2 = beräknaPartner === 'ja' && vårdnad === 'gemensam' ? beräknaDaglig(inkomst2) : 0;
    const extra2 = avtal2 === 'ja' && beräknaPartner === 'ja' ? Math.round(inkomst2 * 0.10) : 0;

    // Generate results
    const resultBlock = document.getElementById('result-block');
    let resultHtml = '';

    // Parent 1 results
    const månadsinkomst1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
    resultHtml += generateParentSection(
        1, dag1, extra1, månadsinkomst1, förälder1InkomstDagar, 
        avtal1 === 'ja', barnbidragResult.barnbidrag, barnbidragResult.tillägg, 
        vårdnad === 'ensam'
    );

    // Parent 2 results (if applicable)
    if (vårdnad === 'gemensam' && beräknaPartner === 'ja') {
        const månadsinkomst2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
        resultHtml += generateParentSection(
            2, dag2, extra2, månadsinkomst2, förälder2InkomstDagar, 
            avtal2 === 'ja', barnbidragResult.barnbidrag, barnbidragResult.tillägg, 
            false
        );
    }

    resultBlock.innerHTML = resultHtml;
    document.getElementById('strategy-group').style.display = 'block';
    document.getElementById('preferences-section').style.display = 'block';
    document.getElementById('optimize-btn').style.display = 'block';
    updateProgress(8);

    // Reinitialize info box toggles for dynamically added content
    setupInfoBoxToggle();

    // Store global state for optimization
    window.appState = {
        inkomst1, inkomst2, vårdnad, beräknaPartner,
        barnbidragPerPerson: barnbidragResult.barnbidrag,
        tilläggPerPerson: barnbidragResult.tillägg,
        dag1, extra1, dag2, extra2,
        avtal1: avtal1 === 'ja', avtal2: avtal2 === 'ja'
    };

    // Update dropdown listeners for monthly boxes
    setupDropdownListeners();
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
        avtal1: window.appState.avtal1,
        avtal2: window.appState.avtal2,
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

        // Validate leave duration
        const totalDays1 = result.plan1.användaInkomstDagar + result.plan1.användaMinDagar;
        const totalDays2 = result.plan2.användaInkomstDagar + result.plan2.användaMinDagar;
        if (totalDays1 > förälder1InkomstDagar + förälder1MinDagar || 
            totalDays2 > förälder2InkomstDagar + förälder2MinDagar) {
            document.getElementById('leave-duration-error').style.display = 'block';
            return;
        } else {
            document.getElementById('leave-duration-error').style.display = 'none';
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
            result.arbetsInkomst2
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
    const minLabel = document.getElementById('slider-start');
    const maxLabel = document.getElementById('slider-end');
    if (!totalInput || !slider || !container) return;

    const syncSlider = () => {
        const total = parseInt(totalInput.value) || 0;
        slider.max = total;
        const half = Math.floor(total / 2);
        slider.value = half;
        updateLeaveDisplay(slider, total);
        if (minLabel) minLabel.textContent = '0';
        if (maxLabel) maxLabel.textContent = total;
        container.style.display = total > 0 ? 'block' : 'none';
    };

    totalInput.addEventListener('input', syncSlider);
    totalInput.addEventListener('change', syncSlider);

    slider.addEventListener('input', () => {
        const total = parseInt(totalInput.value) || 0;
        updateLeaveDisplay(slider, total);
    });

    syncSlider();
}

function updateLeaveDisplay(slider, total) {
    const p1 = parseInt(slider.value) || 0;
    const p2 = Math.max(total - p1, 0);
    const p1Elem = document.getElementById('p1-months');
    const p2Elem = document.getElementById('p2-months');
    if (p1Elem) p1Elem.textContent = p1;
    if (p2Elem) p2Elem.textContent = p2;
    const percent = total > 0 ? (p1 / total) * 100 : 0;
    const green = '#28a745';
    const blue = '#007bff';
    const base = `linear-gradient(to right, ${green} 0%, ${green} ${percent}%, ${blue} ${percent}%, ${blue} 100%)`;
    if (total > 2) {
        const step = 100 / total;
        const grid =
            `repeating-linear-gradient(to right, transparent, transparent ` +
            `calc(${step}% - 1px), rgba(255,255,255,0.7) calc(${step}% - 1px), ` +
            `rgba(255,255,255,0.7) ${step}%)`;
        slider.style.background = `${grid}, ${base}`;
    } else {
        slider.style.background = base;
    }
}