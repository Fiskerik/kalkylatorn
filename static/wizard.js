import { updateProgress, setupToggleButtons } from './ui.js';

/**
 * wizard.js - Sequential question wizard for the Föräldrapenningkalkylator
 * Handles navigation between wizard steps, progress bar updates and developer shortcuts.
 */

document.addEventListener('DOMContentLoaded', () => {
    const steps = Array.from(document.querySelectorAll('fieldset.wizard-step'));
    const idx = {
        household: 0,
        income: 1,
        preferences: 2,
        summary: 3
    };

    let currentIndex = idx.household;
    let history = [];
    let partnerActive = true;
    let hasDisplayedInitially = false;

    const calculateBtn = document.getElementById('calculate-btn');
    const backBtn = document.getElementById('back-btn');
    const nextBtn = document.getElementById('next-btn');
    const stickyCTA = document.getElementById('sticky-cta');
    const mobileSummary = document.getElementById('mobile-summary');
    const partnerCheckbox = document.getElementById('beräkna-partner-checkbox');
    const partnerHidden = document.getElementById('beräkna-partner');
    const partnerFields = document.querySelectorAll('[data-partner-field]');
    const barnError = document.getElementById('barn-selection-error');
    const progressSteps = document.querySelectorAll('#progress-bar .step');
    const progressBar = document.getElementById('progress-bar');
    const wizardForm = document.getElementById('calc-form');

    const COMPACT_SCROLL_THRESHOLD = 120;
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    const handleScroll = () => {
        if (!progressBar) return;
        if (!mobileQuery.matches) {
            progressBar.classList.remove('compact');
            return;
        }
        const shouldCompact = window.scrollY > COMPACT_SCROLL_THRESHOLD;
        progressBar.classList.toggle('compact', shouldCompact);
    };

    const scrollToWizardTop = () => {
        const target = wizardForm || document.querySelector('.container');
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const offset = Math.max(0, window.scrollY + rect.top - 32);
        window.scrollTo({ top: offset, behavior: 'smooth' });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    if (typeof mobileQuery.addEventListener === 'function') {
        mobileQuery.addEventListener('change', handleScroll);
    } else if (typeof mobileQuery.addListener === 'function') {
        mobileQuery.addListener(handleScroll);
    }

    function setPartnerFieldsVisible(visible) {
        partnerActive = visible;
        partnerFields.forEach(field => {
            if (field instanceof HTMLElement) {
                field.style.display = visible ? '' : 'none';
            }
        });
        if (partnerHidden) {
            partnerHidden.value = visible ? 'ja' : 'nej';
        }
    }

    function shouldShowStickySummary() {
        return (
            document.body.dataset.resultsReady === 'true' &&
            currentIndex === idx.summary
        );
    }

    function updateStickyCtaLabel() {
        if (!stickyCTA) return;
        const resultsReady = document.body.dataset.resultsReady === 'true';
        stickyCTA.textContent = resultsReady ? 'Optimera' : 'Visa resultat';
        if (mobileSummary) {
            mobileSummary.classList.toggle('is-visible', shouldShowStickySummary());
        }
    }

    function updateNavigation() {
        backBtn.classList.toggle('hidden', currentIndex === idx.household);
        const onSummary = currentIndex === idx.summary;
        nextBtn.classList.toggle('hidden', onSummary);
        calculateBtn.classList.toggle('hidden', !onSummary);
        nextBtn.textContent = currentIndex === idx.preferences ? 'Gå till resultat' : 'Nästa steg';
        updateStickyCtaLabel();
    }

    function displayStep(index, recordHistory = false) {
        if (index < 0 || index >= steps.length) return;
        if (recordHistory) {
            history.push(currentIndex);
        }
        steps.forEach((step, i) => step.classList.toggle('visible', i === index));
        currentIndex = index;
        updateProgress(index + 1);
        updateNavigation();
        if (hasDisplayedInitially) {
            scrollToWizardTop();
        } else {
            hasDisplayedInitially = true;
        }
    }

    function validateStep(index) {
        if (index === idx.household) {
            const custodyInput = document.getElementById('vårdnad');
            const custodyValue = custodyInput ? custodyInput.value : '';
            const info = document.getElementById('vårdnad-info');
            if (!custodyValue) {
                if (info) info.textContent = 'Välj vårdnadstyp för att fortsätta.';
                return false;
            }
            if (info && info.textContent) info.textContent = '';
            const plannedValue = Number.parseInt(document.getElementById('barn-planerade').value, 10);
            const validPlanned = Number.isFinite(plannedValue) && plannedValue > 0;
            if (barnError) {
                barnError.style.display = validPlanned ? 'none' : 'block';
            }
            return validPlanned;
        }
        if (index === idx.income) {
            const income1 = document.getElementById('inkomst1');
            if (income1 && (!income1.value || Number(income1.value) <= 0)) {
                income1.focus();
                if (typeof income1.reportValidity === 'function') {
                    income1.reportValidity();
                }
                return false;
            }
        }
        return true;
    }

    backBtn.addEventListener('click', () => {
        if (history.length === 0) return;
        const previous = history.pop();
        displayStep(previous, false);
    });

    nextBtn.addEventListener('click', () => {
        if (!validateStep(currentIndex)) return;
        const nextIndex = Math.min(currentIndex + 1, steps.length - 1);
        displayStep(nextIndex, true);
    });

    if (stickyCTA) {
        stickyCTA.addEventListener('click', () => {
            if (document.body.dataset.resultsReady === 'true') {
                document.getElementById('optimize-btn')?.click();
                return;
            }
            if (currentIndex !== idx.summary) {
                nextBtn.click();
            } else if (!calculateBtn.classList.contains('hidden')) {
                calculateBtn.click();
            }
        });
    }

    progressSteps.forEach((stepEl, index) => {
        stepEl.addEventListener('click', () => {
            if (index > currentIndex) return;
            displayStep(index, true);
        });
    });

    document.addEventListener('results-ready', updateStickyCtaLabel);
    document.addEventListener('results-reset', updateStickyCtaLabel);

    setPartnerFieldsVisible(true);
    displayStep(idx.household);
    handleScroll();

    setupToggleButtons('vårdnad-group', 'vårdnad', value => {
        const isEnsam = value === 'ensam';
        if (partnerCheckbox) {
            partnerCheckbox.disabled = isEnsam;
            if (isEnsam) {
                partnerCheckbox.checked = false;
                setPartnerFieldsVisible(false);
            } else {
                setPartnerFieldsVisible(partnerCheckbox.checked);
            }
        } else if (isEnsam) {
            setPartnerFieldsVisible(false);
        }
    });

    if (partnerCheckbox) {
        partnerCheckbox.addEventListener('change', () => {
            if (partnerCheckbox.disabled) return;
            setPartnerFieldsVisible(partnerCheckbox.checked);
        });
    }

    setupToggleButtons('barn-tidigare-group', 'barn-tidigare', () => {
        if (barnError) barnError.style.display = 'none';
    });
    setupToggleButtons('barn-planerade-group', 'barn-planerade', () => {
        if (barnError) barnError.style.display = 'none';
    });

    setupToggleButtons('avtal-group-1', 'har-avtal-1', value => {
        const container = document.getElementById('anstallningstid-container-1');
        if (!container) return;
        if (value === 'ja') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            const input = document.getElementById('anstallningstid-1');
            if (input) input.value = '';
        }
    });

    setupToggleButtons('anstallningstid-group-1', 'anstallningstid-1');

    setupToggleButtons('avtal-group-2', 'har-avtal-2', value => {
        const container = document.getElementById('anstallningstid-container-2');
        if (!container) return;
        if (value === 'ja' && partnerActive) {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            const input = document.getElementById('anstallningstid-2');
            if (input) input.value = '';
        }
    });

    setupToggleButtons('anstallningstid-group-2', 'anstallningstid-2');

    const toggleInputMap = {
        'vårdnad-group': 'vårdnad',
        'barn-tidigare-group': 'barn-tidigare',
        'barn-planerade-group': 'barn-planerade',
        'avtal-group-1': 'har-avtal-1',
        'avtal-group-2': 'har-avtal-2',
        'anstallningstid-group-1': 'anstallningstid-1',
        'anstallningstid-group-2': 'anstallningstid-2'
    };

    function applyToggleValue(groupId, value) {
        const groupEl = document.getElementById(groupId);
        if (!groupEl) return;
        const inputId = toggleInputMap[groupId];
        const inputEl = inputId ? document.getElementById(inputId) : null;
        const buttons = groupEl.querySelectorAll('.toggle-btn');
        buttons.forEach(button => {
            const isActive = button.dataset.value === value;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (inputEl) {
            inputEl.value = value ?? '';
        }
        if (groupId === 'barn-tidigare-group') {
            window.barnIdag = Number.parseInt(value ?? '0', 10);
        }
        if (groupId === 'barn-planerade-group') {
            window.barnPlanerat = Number.parseInt(value ?? '0', 10);
        }
    }

    function resetFormState() {
        Object.keys(toggleInputMap).forEach(groupId => applyToggleValue(groupId, null));

        const inputsToClear = [
            'inkomst1',
            'inkomst2',
            'ledig-tid-5823',
            'ledig-tid-2',
            'min-inkomst'
        ];
        inputsToClear.forEach(id => {
            const input = document.getElementById(id);
            if (input) input.value = '';
        });

        const birthDateInput = document.getElementById('barn-datum');
        if (birthDateInput) birthDateInput.value = '';

        const strategyInput = document.getElementById('strategy');
        const strategyButtons = document.querySelectorAll('#strategy-group .toggle-btn');
        strategyButtons.forEach((button, index) => {
            const isDefault = index === 0;
            button.classList.toggle('active', isDefault);
            button.setAttribute('aria-pressed', isDefault ? 'true' : 'false');
        });
        if (strategyInput) strategyInput.value = 'longer';

        const container1 = document.getElementById('anstallningstid-container-1');
        if (container1) container1.style.display = 'none';
        const container2 = document.getElementById('anstallningstid-container-2');
        if (container2) container2.style.display = 'none';

        const slider = document.getElementById('leave-slider');
        if (slider) {
            slider.value = 0;
            slider.dispatchEvent(new Event('input', { bubbles: true }));
        }
        const leaveContainer = document.getElementById('leave-slider-container');
        if (leaveContainer) leaveContainer.style.display = 'none';

        if (partnerCheckbox) {
            partnerCheckbox.disabled = false;
            partnerCheckbox.checked = true;
        }
        setPartnerFieldsVisible(true);
        document.body.dataset.resultsReady = 'false';
        window.appState = undefined;
        document.dispatchEvent(new Event('results-reset'));
        history = [];
        hasDisplayedInitially = false;
        displayStep(idx.household);
    }

    function employmentOptionForParent(parent) {
        if (!parent) return null;
        if (typeof parent.anstalld_mer_an_ett_ar === 'boolean') {
            return parent.anstalld_mer_an_ett_ar ? '>1' : '6-12';
        }
        if (typeof parent.anstalld_manader === 'number') {
            if (parent.anstalld_manader <= 5) return '0-5';
            if (parent.anstalld_manader <= 12) return '6-12';
            return '>1';
        }
        return null;
    }

    function populateFamilyData(family) {
        if (!family) return;
        resetFormState();
        const custodyType = (family.custody?.typ || '').toString().toLowerCase().trim();
        const isGemensam = /\bgemensam\b/.test(custodyType);
        const isEnsam = /\bensam\b/.test(custodyType);
        const custodyValue = isEnsam && !isGemensam ? 'ensam' : 'gemensam';
        applyToggleValue('vårdnad-group', custodyValue);

        const partnerPref = family.custody?.berakna_for_bada_foraldrarna;
        const partnerFallback = family.custody?.berakna_for_partner;
        const shouldIncludePartner = typeof partnerPref === 'boolean'
            ? partnerPref
            : (typeof partnerFallback === 'boolean' ? partnerFallback : true);
        const parents = Array.isArray(family.parents) ? family.parents : [];
        const hasSecondParent = parents.length > 1;
        const includePartner = custodyValue === 'gemensam' && shouldIncludePartner && hasSecondParent;

        if (partnerCheckbox) {
            partnerCheckbox.disabled = custodyValue === 'ensam';
            partnerCheckbox.checked = includePartner;
        }
        setPartnerFieldsVisible(includePartner);

        const existingChildren = family.barn?.befintliga ?? 0;
        applyToggleValue('barn-tidigare-group', existingChildren.toString());
        const plannedChildren = family.barn?.forvantade ?? 0;
        applyToggleValue('barn-planerade-group', plannedChildren.toString());

        const parent1 = parents[0] || {};
        const parent2 = includePartner ? parents[1] || {} : null;

        const preferences = family.preferenser || {};
        const parseMonths = value => {
            const parsed = Number(value);
            return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
        };
        const normalizedStrategy = (() => {
            const raw = (preferences.strategi || '').toString().toLowerCase();
            if (raw === 'maximize' || raw === 'maximize_parental_salary') return 'maximize';
            return 'longer';
        })();

        const income1Input = document.getElementById('inkomst1');
        const income2Input = document.getElementById('inkomst2');
        if (income1Input) income1Input.value = parent1.salary_sek_per_month ?? '';
        if (income2Input) income2Input.value = parent2?.salary_sek_per_month ?? '';

        const minIncomeInput = document.getElementById('min-inkomst');
        if (minIncomeInput) {
            const minIncome = preferences.minimi_netto_sek_per_manad ?? family.miniminkomst_sek_per_manad;
            minIncomeInput.value = (minIncome ?? '').toString();
        }

        const avtal1Value = parent1.kollektivavtal ? 'ja' : 'nej';
        applyToggleValue('avtal-group-1', avtal1Value);
        const employment1 = employmentOptionForParent(parent1);
        const container1 = document.getElementById('anstallningstid-container-1');
        if (container1) {
            if (avtal1Value === 'ja' && employment1) {
                container1.style.display = 'block';
                applyToggleValue('anstallningstid-group-1', employment1);
            } else {
                container1.style.display = 'none';
                applyToggleValue('anstallningstid-group-1', null);
            }
        }

        const avtal2Value = parent2?.kollektivavtal ? 'ja' : 'nej';
        applyToggleValue('avtal-group-2', includePartner ? avtal2Value : null);
        const container2 = document.getElementById('anstallningstid-container-2');
        const employment2 = employmentOptionForParent(parent2);
        if (container2) {
            if (includePartner && avtal2Value === 'ja' && employment2) {
                container2.style.display = 'block';
                applyToggleValue('anstallningstid-group-2', employment2);
            } else {
                container2.style.display = 'none';
                applyToggleValue('anstallningstid-group-2', null);
            }
        }

        const birthDateInput = document.getElementById('barn-datum');
        if (birthDateInput) {
            if (preferences.beraknat_fodelsedatum) {
                birthDateInput.value = preferences.beraknat_fodelsedatum;
            } else {
                const today = new Date();
                const local = new Date(today.getTime() - today.getTimezoneOffset() * 60000);
                birthDateInput.value = local.toISOString().split('T')[0];
            }
        }

        const totalLeaveInput = document.getElementById('ledig-tid-5823');
        const partnerLeaveInput = document.getElementById('ledig-tid-2');
        const parentMonths = parseMonths(preferences.foralder1_manader);
        const partnerMonths = parseMonths(preferences.foralder2_manader);
        if (totalLeaveInput && parentMonths !== null) {
            totalLeaveInput.value = parentMonths;
        }
        if (partnerLeaveInput) {
            if (includePartner && partnerMonths !== null) {
                partnerLeaveInput.value = partnerMonths;
            } else {
                partnerLeaveInput.value = '';
            }
        }

        const strategyInput = document.getElementById('strategy');
        const strategyButtons = document.querySelectorAll('#strategy-group .toggle-btn');
        strategyButtons.forEach(button => {
            const isActive = button.dataset.value === normalizedStrategy;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        if (strategyInput) strategyInput.value = normalizedStrategy;

        totalLeaveInput?.dispatchEvent(new Event('input', { bubbles: true }));
        partnerLeaveInput?.dispatchEvent(new Event('input', { bubbles: true }));

        history = [idx.household, idx.income, idx.preferences];
        displayStep(idx.summary, false);
    }

    const devFamilyButtons = document.querySelectorAll('.dev-family-btn');
    let familiesRequest;

    function fetchFamilies() {
        if (!familiesRequest) {
            familiesRequest = fetch('/dev/families', { cache: 'no-store' })
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Failed to load families: ${response.status}`);
                    }
                    return response.json();
                })
                .catch(error => {
                    console.error(error);
                    return [];
                });
        }
        return familiesRequest;
    }

    devFamilyButtons.forEach(button => {
        button.addEventListener('click', () => {
            const index = Number.parseInt(button.dataset.familyIndex, 10);
            fetchFamilies().then(families => {
                if (!Array.isArray(families) || !families[index]) return;
                populateFamilyData(families[index]);
            });
        });
    });
});
 
