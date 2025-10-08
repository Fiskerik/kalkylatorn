/**
 * index.js - Main initialization and form handling for the Föräldrapenningkalkylator
 * Sets up event listeners and orchestrates calculations, UI, and chart rendering.
 */
import {
    vårdnad, beräknaPartner, barnbidragPerPerson, tilläggPerPerson,
    defaultPreferences, förälder1InkomstDagar, förälder2InkomstDagar
} from './config.js';
import {
    beräknaDaglig,
    beräknaBarnbidrag,
    optimizeParentalLeave,
    beräknaFöräldralön,
    beräknaNetto,
    calculateParentalLeaveDays
} from './calculations.js';
import {
    updateProgress, setupInfoBoxToggle, setupHelpTooltips,
    generateParentSection, setupStrategyToggle, updateMonthlyBox
} from './ui.js';
import { renderGanttChart } from './chart.js';

const stickyNettoEl = document.getElementById('sticky-netto');
const stickyDaysEl = document.getElementById('sticky-days');
const stickyCtaButton = document.getElementById('sticky-cta');

function formatCurrency(value) {
    if (!Number.isFinite(value)) return '–';
    return `${Math.round(value).toLocaleString('sv-SE')} kr`;
}

function formatDays(value) {
    if (!Number.isFinite(value)) return '–';
    return value.toLocaleString('sv-SE');
}

function updateStickySummary(netValue, daysValue) {
    if (stickyNettoEl) stickyNettoEl.textContent = formatCurrency(netValue);
    if (stickyDaysEl) stickyDaysEl.textContent = formatDays(daysValue);
}

function resetStickySummary() {
    updateStickySummary(Number.NaN, Number.NaN);
}

document.addEventListener('results-reset', resetStickySummary);

// Initialize on DOM content loaded
document.addEventListener('DOMContentLoaded', () => {
    initializeForm();
    setupEventListeners();
});

/**
 * Initialize form elements and UI
 */
function initializeForm() {
    // Initialize progress bar
    updateProgress(1);
    document.body.dataset.resultsReady = 'false';
    resetStickySummary();
    document.dispatchEvent(new Event('results-reset'));

    // Setup strategy and info boxes
    setupStrategyToggle();
    setupInfoBoxToggle();
    setupHelpTooltips();

    const birthDateInput = document.getElementById('barn-datum');
    if (birthDateInput && !birthDateInput.value) {
        const today = new Date();
        const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
        birthDateInput.value = localDate.toISOString().split('T')[0];
    }
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
    setupHelpTooltips();

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
    const vårdnad = document.getElementById('vårdnad').value || 'gemensam';
    const beräknaPartner = document.getElementById('beräkna-partner').value || 'ja';
    const barnTidigare = parseInt(document.getElementById('barn-tidigare').value) || 0;
    const barnPlanerade = parseInt(document.getElementById('barn-planerade').value, 10) || 1;
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
    const plannedChildren = Math.max(1, barnPlanerade);
    const leaveAllocation = calculateParentalLeaveDays(vårdnad, plannedChildren);
    const parent1IncomeDays = leaveAllocation.parent1.incomeDays;
    const parent2IncomeDays = leaveAllocation.parent2.incomeDays;
    const parent1LowDays = leaveAllocation.parent1.lowDays;
    const parent2LowDays = leaveAllocation.parent2.lowDays;
    const netto1 = beräknaNetto(inkomst1);
    const netto2 = beräknaNetto(inkomst2);

    // Generate results
    const resultBlock = document.getElementById('result-block');
    let resultHtml = '';

    // Parent 1 results
    const månadsinkomst1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
        resultHtml += generateParentSection(
            1, dag1, extra1, månadsinkomst1, parent1IncomeDays,
            parent1LowDays, avtal1 === 'ja', barnbidragResult.barnbidrag,
            barnbidragResult.tillägg, vårdnad === 'ensam',
            inkomst1
        );

    // Parent 2 results (if applicable)
    if (vårdnad === 'gemensam' && beräknaPartner === 'ja') {
        const månadsinkomst2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
        resultHtml += generateParentSection(
            2, dag2, extra2, månadsinkomst2, parent2IncomeDays,
            parent2LowDays, avtal2 === 'ja', barnbidragResult.barnbidrag,
            barnbidragResult.tillägg, false, inkomst2
        );
    }

    resultBlock.innerHTML = resultHtml;
    document.getElementById('optimize-btn').style.display = 'block';
    updateProgress(4);

    // Reinitialize info box toggles for dynamically added content
    setupInfoBoxToggle();
    setupHelpTooltips();

    // Store global state for optimization
    window.appState = {
        inkomst1,
        inkomst2,
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
        anställningstid2: anst2,
        förälder1InkomstDagar: parent1IncomeDays,
        förälder2InkomstDagar: parent2IncomeDays,
        förälder1MinDagar: parent1LowDays,
        förälder2MinDagar: parent2LowDays,
        planeradeBarn: plannedChildren
    };

    const includePartner = vårdnad === 'gemensam' && beräknaPartner === 'ja';
    const leaveContainer = document.getElementById('leave-slider-container');
    if (leaveContainer) {
        leaveContainer.style.display = includePartner ? 'block' : 'none';
    }

    const hushallsBarnbidrag = vårdnad === 'ensam'
        ? barnbidragResult.total
        : barnbidragResult.total * 2;
    const hushallsNetto = netto1 + (includePartner ? netto2 : 0) + hushallsBarnbidrag;
    const totalRemainingDays = parent1IncomeDays + parent1LowDays +
        (includePartner ? parent2IncomeDays + parent2LowDays : 0);

    updateStickySummary(hushallsNetto, totalRemainingDays);
    document.body.dataset.resultsReady = 'true';
    if (stickyCtaButton) stickyCtaButton.textContent = 'Optimera';
    document.dispatchEvent(new Event('results-ready'));

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
        const parent1Days = window.appState?.förälder1InkomstDagar ?? förälder1InkomstDagar;
        dropdown1.onchange = () => {
            const dagarPerVecka = parseInt(dropdown1.value, 10) || 7;
            updateMonthlyBox(
                'monthly-wrapper-1', dagarPerVecka, window.appState.dag1,
                window.appState.extra1, window.appState.barnbidragPerPerson,
                window.appState.tilläggPerPerson, window.appState.avtal1,
                parent1Days
            );
        };
        if (window.appState) {
            dropdown1.dispatchEvent(new Event('change'));
        }
    }

    if (dropdown2) {
        const parent2Days = window.appState?.förälder2InkomstDagar ?? förälder2InkomstDagar;
        dropdown2.onchange = () => {
            const dagarPerVecka = parseInt(dropdown2.value, 10) || 7;
            updateMonthlyBox(
                'monthly-wrapper-2', dagarPerVecka, window.appState.dag2,
                window.appState.extra2, window.appState.barnbidragPerPerson,
                window.appState.tilläggPerPerson, window.appState.avtal2,
                parent2Days
            );
        };
        if (window.appState) {
            dropdown2.dispatchEvent(new Event('change'));
        }
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
    const totalMonths = parseFloat(ledigTid1Input.value);
    const minInkomstValue = minInkomstInput.value;
    const leaveErr = document.getElementById('leave-duration-error');
    const minIncomeErr = document.getElementById('min-income-error');
    if (!totalMonths) {
        leaveErr.textContent = 'Ange hur länge du vill vara ledig.';
        leaveErr.style.display = 'block';
        if (minIncomeErr) minIncomeErr.style.display = 'none';
        return;
    }
    leaveErr.style.display = 'none';
    if (!minInkomstValue) {
        if (minIncomeErr) minIncomeErr.style.display = 'block';
        return;
    }
    if (minIncomeErr) minIncomeErr.style.display = 'none';
    const slider = document.getElementById('leave-slider');
    const includePartner = window.appState.vårdnad === 'gemensam' && window.appState.beräknaPartner === 'ja';
    let ledigTid1 = totalMonths;
    if (includePartner && slider) {
        const sliderValue = parseFloat(slider.value);
        ledigTid1 = Number.isFinite(sliderValue) ? sliderValue : totalMonths;
    }
    ledigTid1 = Math.max(0, Math.min(ledigTid1, totalMonths));
    const ledigTid2 = includePartner ? Math.max(totalMonths - ledigTid1, 0) : 0;
    const minInkomst = parseInt(minInkomstValue, 10);
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
        barnDatum,
        förälder1InkomstDagar: window.appState.förälder1InkomstDagar,
        förälder2InkomstDagar: window.appState.förälder2InkomstDagar,
        förälder1MinDagar: window.appState.förälder1MinDagar,
        förälder2MinDagar: window.appState.förälder2MinDagar,
        planeradeBarn: window.appState.planeradeBarn
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
        err.style.display = 'none';

        const toNumber = (value) => (Number.isFinite(value) ? value : 0);
        const computeDaysFromPlan = (plan, fallbackDaysPerWeek = 0) => {
            if (!plan) return 0;
            const weeks = toNumber(plan.weeks);
            const daysPerWeek = toNumber(plan.dagarPerVecka || fallbackDaysPerWeek);
            if (weeks <= 0 || daysPerWeek <= 0) {
                return 0;
            }
            return Math.round(weeks * daysPerWeek);
        };
        const extractDays = (plan, property, fallbackDaysPerWeek = 0) => {
            if (!plan) return 0;
            const stored = plan[property];
            if (Number.isFinite(stored) && stored > 0) {
                return Math.round(stored);
            }
            return computeDaysFromPlan(plan, fallbackDaysPerWeek);
        };
        const getInkomstDays = (plan, fallbackDaysPerWeek = 0) =>
            extractDays(plan, 'användaInkomstDagar', fallbackDaysPerWeek);
        const getMinDays = (plan, fallbackDaysPerWeek = 0) =>
            extractDays(plan, 'användaMinDagar', fallbackDaysPerWeek);

        const plan1TotalInkomstDays = getInkomstDays(result.plan1, result.plan1.dagarPerVecka);
        const plan1NoExtraDays = getInkomstDays(
            result.plan1NoExtra,
            result.plan1NoExtra.dagarPerVecka || result.plan1.dagarPerVecka
        );
        const plan1ExtraDays = Math.max(0, plan1TotalInkomstDays - plan1NoExtraDays);
        const plan1MinDays = getMinDays(result.plan1, result.plan1.dagarPerVecka);
        const plan1MinContinuationDays = getMinDays(
            result.plan1MinDagar,
            result.plan1MinDagar.dagarPerVecka || result.plan1.dagarPerVecka
        );

        const plan2TotalInkomstDays = getInkomstDays(result.plan2, result.plan2.dagarPerVecka);
        const plan2NoExtraDays = getInkomstDays(
            result.plan2NoExtra,
            result.plan2NoExtra.dagarPerVecka || result.plan2.dagarPerVecka
        );
        const plan2ExtraDays = Math.max(0, plan2TotalInkomstDays - plan2NoExtraDays);
        const plan2MinDays = getMinDays(result.plan2, result.plan2.dagarPerVecka);
        const plan2MinContinuationDays = getMinDays(
            result.plan2MinDagar,
            result.plan2MinDagar.dagarPerVecka || result.plan2.dagarPerVecka
        );
        const overlapDaysUsed = computeDaysFromPlan(
            result.plan1Overlap,
            result.plan1Overlap?.dagarPerVecka || 0
        );

        const usedInkomstDays1 = plan1ExtraDays + plan1NoExtraDays;
        const usedMinDays1 = plan1MinDays + plan1MinContinuationDays;
        const usedInkomstDays2 = plan2ExtraDays + plan2NoExtraDays + overlapDaysUsed;
        const usedMinDays2 = plan2MinDays + plan2MinContinuationDays;

        const remainingInkomstDays1 = toNumber(result.förälder1InkomstDagar);
        const remainingMinDays1 = toNumber(result.förälder1MinDagar);
        const remainingInkomstDays2 = toNumber(result.förälder2InkomstDagar);
        const remainingMinDays2 = toNumber(result.förälder2MinDagar);

        const shortageInkomst1 = Math.max(0, -remainingInkomstDays1);
        const shortageMin1 = Math.max(0, -remainingMinDays1);
        const shortageInkomst2 = Math.max(0, -remainingInkomstDays2);
        const shortageMin2 = Math.max(0, -remainingMinDays2);

        const totalShortage1 = shortageInkomst1 + shortageMin1;
        const totalShortage2 = shortageInkomst2 + shortageMin2;

        const totalDays1 = usedInkomstDays1 + usedMinDays1;
        const totalDays2 = usedInkomstDays2 + usedMinDays2;
        const maxDays1 =
            usedInkomstDays1 + Math.max(0, remainingInkomstDays1) + usedMinDays1 + Math.max(0, remainingMinDays1);
        const maxDays2 =
            usedInkomstDays2 + Math.max(0, remainingInkomstDays2) + usedMinDays2 + Math.max(0, remainingMinDays2);

        if (totalShortage1 > 0 || totalShortage2 > 0) {
            const buildDetails = (segments) =>
                segments
                    .map(({ label, days }) => ({ label, days: Math.round(days) }))
                    .filter((segment) => segment.days > 0)
                    .map((segment) => `${segment.label}: ${segment.days} dagar`)
                    .join(', ');

            if (totalShortage1 > 0) {
                const segments = [
                    { label: 'Fas 1 (med föräldralön)', days: plan1ExtraDays },
                    { label: 'Fas 1 utan föräldralön', days: plan1NoExtraDays },
                    { label: 'Fas 1 lägstanivå', days: plan1MinDays },
                    { label: 'Fas 1 lägstanivå (forts.)', days: plan1MinContinuationDays }
                ];
                const shortage = Math.round(totalShortage1);
                const details = buildDetails(segments);
                err.textContent = `Förälder 1 behöver ${Math.round(totalDays1)} dagar${
                    details ? ` (${details})` : ''
                } men har bara ${Math.round(maxDays1)} dagar tillgängliga. ${shortage} dagar saknas.`;
            } else {
                const segments = [
                    { label: 'Fas 2 (med föräldralön)', days: plan2ExtraDays },
                    { label: 'Fas 2 utan föräldralön', days: plan2NoExtraDays },
                    { label: 'Fas 2 lägstanivå', days: plan2MinDays },
                    { label: 'Fas 2 lägstanivå (forts.)', days: plan2MinContinuationDays },
                    { label: 'Överlappande dagar', days: overlapDaysUsed }
                ];
                const shortage = Math.round(totalShortage2);
                const details = buildDetails(segments);
                err.textContent = `Förälder 2 behöver ${Math.round(totalDays2)} dagar${
                    details ? ` (${details})` : ''
                } men har bara ${Math.round(maxDays2)} dagar tillgängliga. ${shortage} dagar saknas.`;
            }
            err.style.display = 'block';
            return;
        }

        // Render Gantt chart
        document.getElementById('optimization-result').style.display = 'block';
        const stepFromSlider = slider ? parseFloat(slider.step) : NaN;
        const chartContext = {
            preferences: { ...preferences },
            inputs: { ...inputs },
            totalMonths,
            step: Number.isFinite(stepFromSlider) && stepFromSlider > 0
                ? stepFromSlider
                : (totalMonths > 2 ? 1 : 0.5)
        };
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
            result.unusedFöräldralönWeeks2,
            result.användaInkomstDagar1,
            result.användaMinDagar1,
            result.användaInkomstDagar2,
            result.användaMinDagar2,
            chartContext
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
        const isSingleParent = window.appState?.vårdnad === 'ensam' || window.appState?.beräknaPartner !== 'ja';
        const defaultValue = isSingleParent ? total : Math.round(total / 2);
        slider.value = defaultValue;
        updateLeaveDisplay(slider, total);
        if (tickList) {
            tickList.innerHTML = '';
            for (let i = 0; i <= total; i += step) {
                tickList.innerHTML += `<option value="${i}"></option>`;
            }
        }
        if (startLabel) startLabel.textContent = '0';
        if (endLabel) endLabel.textContent = total;
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
