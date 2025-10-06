/**
 * index.js - Main initialization and form handling for the Föräldrapenningkalkylator
 * Sets up event listeners and orchestrates calculations, UI, and chart rendering.
 */
(function initIndex(global) {
    if (global.__INDEX_MODULE_INITIALIZED__) {
        return;
    }
    global.__INDEX_MODULE_INITIALIZED__ = true;

    const config = global.appConfig || {};
    const {
        vårdnad: defaultVårdnad = 'gemensam',
        beräknaPartner: defaultBeräknaPartner = 'ja',
        barnbidragPerPerson: defaultBarnbidragPerPerson = 625,
        tilläggPerPerson: defaultTilläggPerPerson = 0,
        defaultPreferences = {},
        förälder1InkomstDagar: defaultFörälder1InkomstDagar = 195,
        förälder2InkomstDagar: defaultFörälder2InkomstDagar = 195,
        förälder1MinDagar: defaultFörälder1MinDagar = 45,
        förälder2MinDagar: defaultFörälder2MinDagar = 45
    } = config;

    const calculations = global.calculationUtils || {};
    const {
        beräknaDaglig = () => 0,
        beräknaBarnbidrag = () => ({
            barnbidrag: defaultBarnbidragPerPerson,
            tillägg: defaultTilläggPerPerson,
            total: 0,
            details: ''
        }),
        optimizeParentalLeave = () => ({}),
        beräknaFöräldralön = () => 0,
        beräknaNetto = () => 0
    } = calculations;

    const ui = global.uiUtils || {};
    const {
        updateProgress = () => {},
        setupInfoBoxToggle = () => {},
        generateParentSection = () => '',
        setupStrategyToggle = () => {},
        updateMonthlyBox = () => {}
    } = ui;

    const chart = global.chartUtils || {};
    const { renderGanttChart = () => {} } = chart;

    global.appState = global.appState || {};

    function onReady() {
        initializeForm();
        setupEventListeners();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onReady);
    } else {
        onReady();
    }

    /**
     * Initialize the static UI state before the user interacts with the wizard.
     */
    function initializeForm() {
        updateProgress(1);
        setupStrategyToggle();
        setupInfoBoxToggle();
    }

    /**
     * Setup the top-level event listeners for the calculator flow.
     */
    function setupEventListeners() {
        const form = document.getElementById('calc-form');
        const optimizeBtn = document.getElementById('optimize-btn');

        if (form) {
            form.addEventListener('submit', handleFormSubmit, { once: false });
        }

        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', handleOptimize, { once: false });
        }

        setupDropdownListeners();
        setupLeaveSlider();
    }

    /**
     * Handle the main form submission.
     * @param {Event} event - Form submission event
     */
    function handleFormSubmit(event) {
        event.preventDefault();

        const inkomst1 = parseFloat(document.getElementById('inkomst1')?.value) || 0;
        const inkomst2 = parseFloat(document.getElementById('inkomst2')?.value) || 0;
        const vårdnad = document.getElementById('vårdnad')?.value || defaultVårdnad;
        const beräknaPartner = document.getElementById('beräkna-partner')?.value || defaultBeräknaPartner;
        const barnTidigare = parseInt(document.getElementById('barn-tidigare')?.value, 10) || 0;
        const barnPlanerade = parseInt(document.getElementById('barn-planerade')?.value, 10) || 1;
        const avtal1 = document.getElementById('har-avtal-1')?.value || 'nej';
        const avtal2 = document.getElementById('har-avtal-2')?.value || 'nej';
        const anst1 = document.getElementById('anstallningstid-1')?.value || '';
        const anst2 = document.getElementById('anstallningstid-2')?.value || '';

        if (barnTidigare === 0 && barnPlanerade === 0) {
            const errorElem = document.getElementById('barn-selection-error');
            if (errorElem) {
                errorElem.style.display = 'block';
            }
            return;
        }

        const errorElem = document.getElementById('barn-selection-error');
        if (errorElem) {
            errorElem.style.display = 'none';
        }

        const totalBarn = barnTidigare + barnPlanerade;
        const barnbidragResult = beräknaBarnbidrag(totalBarn, vårdnad === 'ensam');

        const dag1 = beräknaDaglig(inkomst1);
        const extra1 = avtal1 === 'ja' && anst1 !== '0-5' ? beräknaFöräldralön(inkomst1) : 0;
        const dag2 = beräknaPartner === 'ja' && vårdnad === 'gemensam' ? beräknaDaglig(inkomst2) : 0;
        const extra2 = avtal2 === 'ja' && anst2 !== '0-5' && beräknaPartner === 'ja' ? beräknaFöräldralön(inkomst2) : 0;
        const netto1 = beräknaNetto(inkomst1);
        const netto2 = beräknaNetto(inkomst2);

        const resultBlock = document.getElementById('result-block');
        if (!resultBlock) {
            console.error('Result block saknas i DOM: resultat kan inte visas.');
            return;
        }

        const månadsinkomst1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
        let resultHtml = generateParentSection(
            1,
            dag1,
            extra1,
            månadsinkomst1,
            defaultFörälder1InkomstDagar,
            avtal1 === 'ja',
            barnbidragResult.barnbidrag,
            barnbidragResult.tillägg,
            vårdnad === 'ensam',
            inkomst1
        );

        if (vårdnad === 'gemensam' && beräknaPartner === 'ja') {
            const månadsinkomst2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
            resultHtml += generateParentSection(
                2,
                dag2,
                extra2,
                månadsinkomst2,
                defaultFörälder2InkomstDagar,
                avtal2 === 'ja',
                barnbidragResult.barnbidrag,
                barnbidragResult.tillägg,
                false,
                inkomst2
            );
        }

        resultBlock.innerHTML = resultHtml;

        const strategyGroup = document.getElementById('strategy-group');
        if (strategyGroup) {
            strategyGroup.style.display = 'block';
        }

        const preferencesSection = document.getElementById('preferences-section');
        if (preferencesSection) {
            preferencesSection.style.display = 'block';
        }

        const optimizeBtn = document.getElementById('optimize-btn');
        if (optimizeBtn) {
            optimizeBtn.style.display = 'block';
        }
        updateProgress(7);
        setupInfoBoxToggle();

        global.appState = {
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
            anställningstid2: anst2
        };

        const leaveContainer = document.getElementById('leave-slider-container');
        if (leaveContainer && (vårdnad === 'ensam' || beräknaPartner === 'nej')) {
            leaveContainer.style.display = 'none';
        }

        setupDropdownListeners();
    }

    /**
     * Add change listeners to the monthly summary dropdowns. Guards ensure
     * listeners are not duplicated across repeated submissions.
     */
    function setupDropdownListeners() {
        const dropdown1 = document.getElementById('uttags-dagar-1');
        const dropdown2 = document.getElementById('uttags-dagar-2');

        if (dropdown1 && !dropdown1.dataset.listenerAttached) {
            dropdown1.addEventListener('change', () => {
                const dagarPerVecka = parseInt(dropdown1.value, 10) || 7;
                updateMonthlyBox(
                    'monthly-wrapper-1',
                    dagarPerVecka,
                    global.appState.dag1,
                    global.appState.extra1,
                    global.appState.barnbidragPerPerson,
                    global.appState.tilläggPerPerson,
                    global.appState.avtal1,
                    defaultFörälder1InkomstDagar
                );
            });
            dropdown1.dataset.listenerAttached = 'true';
        }

        if (dropdown2 && !dropdown2.dataset.listenerAttached) {
            dropdown2.addEventListener('change', () => {
                const dagarPerVecka = parseInt(dropdown2.value, 10) || 7;
                updateMonthlyBox(
                    'monthly-wrapper-2',
                    dagarPerVecka,
                    global.appState.dag2,
                    global.appState.extra2,
                    global.appState.barnbidragPerPerson,
                    global.appState.tilläggPerPerson,
                    global.appState.avtal2,
                    defaultFörälder2InkomstDagar
                );
            });
            dropdown2.dataset.listenerAttached = 'true';
        }
    }

    /**
     * Handle the optimization step triggered after the summary is visible.
     */
    function handleOptimize() {
        updateProgress(8);

        const barnDatumInput = document.getElementById('barn-datum');
        const ledigTid1Input = document.getElementById('ledig-tid-5823');
        const minInkomstInput = document.getElementById('min-inkomst');
        const strategyInput = document.getElementById('strategy');

        if (!barnDatumInput || !ledigTid1Input || !minInkomstInput || !strategyInput) {
            console.error('Formulärfel: nödvändiga element saknas för optimering.');
            const err = document.getElementById('leave-duration-error');
            if (err) {
                err.style.display = 'block';
                err.textContent = 'Formulärfel: Kontrollera att alla fält är korrekt ifyllda.';
            }
            return;
        }

        const barnDatum = barnDatumInput.value || '2025-05-01';
        const totalMonths = parseFloat(ledigTid1Input.value);
        const minInkomstValue = minInkomstInput.value;
        const leaveErr = document.getElementById('leave-duration-error');
        const minIncomeErr = document.getElementById('min-income-error');

        if (!totalMonths) {
            if (leaveErr) {
                leaveErr.textContent = 'Ange hur länge du vill vara ledig.';
                leaveErr.style.display = 'block';
            }
            if (minIncomeErr) {
                minIncomeErr.style.display = 'none';
            }
            return;
        }

        if (leaveErr) {
            leaveErr.style.display = 'none';
        }

        if (!minInkomstValue) {
            if (minIncomeErr) {
                minIncomeErr.style.display = 'block';
            }
            return;
        }

        if (minIncomeErr) {
            minIncomeErr.style.display = 'none';
        }

        const slider = document.getElementById('leave-slider');
        const ledigTid1 = slider ? parseFloat(slider.value) || 0 : 0;
        const ledigTid2 = Math.max(totalMonths - ledigTid1, 0);
        const minInkomst = parseInt(minInkomstValue, 10);
        const strategy = strategyInput.value || 'longer';
        const deltid = defaultPreferences.deltid;

        const preferences = {
            deltid,
            ledigTid1,
            ledigTid2,
            minInkomst,
            strategy
        };

        const inputs = {
            inkomst1: global.appState.inkomst1,
            inkomst2: global.appState.inkomst2,
            avtal1: global.appState.avtal1 ? 'ja' : 'nej',
            avtal2: global.appState.avtal2 ? 'ja' : 'nej',
            anställningstid1: global.appState.anställningstid1,
            anställningstid2: global.appState.anställningstid2,
            vårdnad: global.appState.vårdnad,
            beräknaPartner: global.appState.beräknaPartner,
            barnbidragPerPerson: global.appState.barnbidragPerPerson,
            tilläggPerPerson: global.appState.tilläggPerPerson,
            barnDatum
        };

        const optimizationResult = document.getElementById('optimization-result');
        if (!optimizationResult) {
            console.error('Elementet optimization-result saknas.');
            return;
        }
        optimizationResult.style.display = 'block';

        try {
            const result = optimizeParentalLeave(preferences, inputs);
            const err = document.getElementById('leave-duration-error');

            if (err) {
                if (!result.genomförbarhet.ärGenomförbar) {
                    err.textContent = result.genomförbarhet.meddelande;
                    err.style.display = 'block';
                } else {
                    err.style.display = 'none';
                }
            }

            const totalDays1 =
                result.plan1.användaInkomstDagar +
                result.plan1.användaMinDagar;
            const totalDays2 =
                result.plan2.användaInkomstDagar +
                result.plan2.användaMinDagar;
            const transferred = result.genomförbarhet.transferredDays || 0;
            const maxDays1 = defaultFörälder1InkomstDagar + defaultFörälder1MinDagar + transferred;
            const maxDays2 = defaultFörälder2InkomstDagar + defaultFörälder2MinDagar - transferred;

            if (totalDays1 > maxDays1 || totalDays2 > maxDays2) {
                if (err) {
                    err.style.display = 'block';
                }
                return;
            }

            renderGanttChart(
                result.plan1,
                result.plan2,
                result.plan1NoExtra,
                result.plan2NoExtra,
                result.plan1MinDagar,
                result.plan2MinDagar,
                result.plan1Overlap,
                global.appState.inkomst1,
                global.appState.inkomst2,
                global.appState.vårdnad,
                global.appState.beräknaPartner,
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
                global.appState.barnbidragPerPerson,
                global.appState.tilläggPerPerson,
                result.maxFöräldralönWeeks1,
                result.maxFöräldralönWeeks2,
                result.unusedFöräldralönWeeks1,
                result.unusedFöräldralönWeeks2
            );
        } catch (error) {
            console.error('Optimization failed:', error);
            const err = document.getElementById('leave-duration-error');
            if (err) {
                err.style.display = 'block';
                err.textContent = 'Fel vid optimering: Kontrollera indata och försök igen.';
            }
        }
    }

    /**
     * Configure the leave distribution slider that appears after results.
     */
    function setupLeaveSlider() {
        const totalInput = document.getElementById('ledig-tid-5823');
        const slider = document.getElementById('leave-slider');
        const container = document.getElementById('leave-slider-container');
        const tickList = document.getElementById('leave-ticks');
        const startLabel = document.getElementById('slider-start');
        const endLabel = document.getElementById('slider-end');

        if (!totalInput || !slider || !container) {
            return;
        }

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
                    const option = document.createElement('option');
                    option.value = i;
                    tickList.appendChild(option);
                }
            }

            if (startLabel) {
                startLabel.textContent = '0';
            }
            if (endLabel) {
                endLabel.textContent = String(total);
            }

            const isSingleParent = global.appState?.vårdnad === 'ensam' || global.appState?.beräknaPartner !== 'ja';
            container.style.display = !isSingleParent && total > 0 ? 'block' : 'none';
        };

        if (!totalInput.dataset.sliderSynced) {
            totalInput.addEventListener('input', syncSlider);
            totalInput.addEventListener('change', syncSlider);
            totalInput.dataset.sliderSynced = 'true';
        }

        if (!slider.dataset.sliderBound) {
            slider.addEventListener('input', () => {
                const total = parseFloat(totalInput.value) || 0;
                updateLeaveDisplay(slider, total);
            });
            slider.dataset.sliderBound = 'true';
        }

        syncSlider();
    }

    /**
     * Update the textual display for the slider showing leave distribution.
     * @param {HTMLInputElement} slider - The range input element
     * @param {number} total - Total leave in months
     */
    function updateLeaveDisplay(slider, total) {
        const p1 = parseFloat(slider.value) || 0;
        const p2 = Math.max(total - p1, 0);
        const p1Elem = document.getElementById('p1-months');
        const p2Elem = document.getElementById('p2-months');
        const format = value => (Number.isInteger(value) ? value : value.toFixed(1));

        if (p1Elem) {
            p1Elem.textContent = format(p1);
        }
        if (p2Elem) {
            p2Elem.textContent = format(p2);
        }

        const percent = total > 0 ? (p1 / total) * 100 : 0;
        slider.style.background = `linear-gradient(to right, #28a745 0%, #28a745 ${percent}%, #007bff ${percent}%, #007bff 100%)`;
    }
})(window);
