/**
 * index.js - Main initialization and form handling for the Föräldrapenningkalkylator
 * Sets up event listeners and orchestrates calculations, UI, and chart rendering.
 */
import { 
    vårdnad, beräknaPartner, barnbidragPerPerson, tilläggPerPerson, 
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
    setupToggleButtons('barn-tidigare-group', 'barn-tidigare', () => updateProgress(4));
    setupToggleButtons('barn-planerade-group', 'barn-planerade', () => updateProgress(5));
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
    const inkomst1Input = document.getElementById('inkomst1');
    const inkomst2Input = document.getElementById('inkomst2');

    // Form submission
    form.addEventListener('submit', handleFormSubmit);

    // Optimization button
    optimizeBtn.addEventListener('click', handleOptimize);

    // Income input listeners
    inkomst1Input.addEventListener('input', handleInkomst1Change);
    inkomst2Input.addEventListener('input', handleInkomst2Change);

    // Dropdown listeners for uttag
    setupDropdownListeners();
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
    const step6 = document.querySelector('.step-6');

    if (value === 'ensam') {
        partnerQuestion.style.display = 'none';
        inkomstBlock2.style.display = 'none';
        avtalQuestion2.style.display = 'none';
        partnerLedigTid.style.display = 'none';
        document.getElementById('beräkna-partner').value = 'nej';
        if (step6) step6.style.display = 'none';
        updateProgress(3); // Skip partner question
    } else {
        partnerQuestion.style.display = 'block';
        if (step6) step6.style.display = 'block';
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

    updateProgress(3);
}

/**
 * Handle first income field change
 */
function handleInkomst1Change() {
    const inkomst1 = document.getElementById('inkomst1').value;
    if (inkomst1 !== '') {
        const vårdnadValue = document.getElementById('vårdnad').value;
        const partnerValue = document.getElementById('beräkna-partner').value;
        if (vårdnadValue === 'gemensam' && partnerValue === 'ja') {
            updateProgress(6);
        } else {
            updateProgress(7);
        }
    }
}

/**
 * Handle second income field change
 */
function handleInkomst2Change() {
    const inkomst2 = document.getElementById('inkomst2').value;
    if (inkomst2 !== '') {
        updateProgress(7);
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
    updateProgress(7);

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
    updateProgress(8);
    const barnDatumInput = document.getElementById('barn-datum');
    const ledigTid1Input = document.getElementById('ledig-tid-5823');
    const ledigTid2Input = document.getElementById('ledig-tid-2');
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
    const ledigTid1 = parseFloat(ledigTid1Input.value) || 6;
    const ledigTid2 = window.appState.beräknaPartner === 'ja' && ledigTid2Input ? parseFloat(ledigTid2Input.value) || 0 : 0;
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
