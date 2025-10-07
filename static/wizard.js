import { updateProgress, setupToggleButtons } from './ui.js';

/**
 * wizard.js - Sequential question wizard for the Föräldrapenningkalkylator
 * Handles navigation between questions, progress bar updates and back navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        vardnad: document.querySelector('#vårdnad-group').closest('.wizard-step'),
        partner: document.getElementById('partner-question'),
        barnIdag: document.querySelector('#barn-tidigare-group').closest('.wizard-step'),
        barnPlan: document.querySelector('#barn-planerade-group').closest('.wizard-step'),
        inkomst1: document.getElementById('inkomst-avtal-1'),
        inkomst2: document.getElementById('inkomst-block-2')
    };

    const stepSections = [
        sections.vardnad,
        sections.partner,
        sections.barnIdag,
        sections.barnPlan,
        sections.inkomst1,
        sections.inkomst2
    ];

    const idx = {
        vardnad: 0,
        partner: 1,
        barnIdag: 2,
        barnPlan: 3,
        inkomst1: 4,
        inkomst2: 5,
        calc: 6
    };

    const calculateBtn = document.getElementById('calculate-btn');
    const backBtn = document.getElementById('back-btn');
    const step6 = document.querySelector('.step-6');
    let partnerSelected = false;

    let currentIndex = idx.vardnad;
    let history = [];

    function progressStepForIndex(i) {
        if (i === idx.calc) return 7;
        if (i <= idx.barnPlan) return i + 1;
        if (i === idx.inkomst1) return 5;
        if (i === idx.inkomst2) return 6;
        return 1;
    }

    function showCurrent() {
        stepSections.forEach(sec => sec.classList.remove('visible'));
        calculateBtn.classList.add('hidden');

        if (currentIndex !== idx.calc) {
            stepSections[currentIndex]?.classList.add('visible');
        }

        updateProgress(progressStepForIndex(currentIndex));
        backBtn.classList.toggle('hidden', history.length === 0);

        if (currentIndex === idx.calc) calculateBtn.classList.remove('hidden');
    }

    function goTo(nextIndex) {
        history.push(currentIndex);
        currentIndex = nextIndex;
        showCurrent();
    }

    backBtn.addEventListener('click', () => {
        if (history.length === 0) return;
        currentIndex = history.pop();
        showCurrent();
    });

    const progressSteps = document.querySelectorAll('#progress-bar .step');
    progressSteps.forEach((stepEl, i) => {
        stepEl.addEventListener('click', () => {
            if (!stepEl.classList.contains('completed') && !stepEl.classList.contains('active')) return;
            const stepNum = i + 1;
            const combined = history.concat(currentIndex);
            let targetPos = -1;
            for (let j = combined.length - 1; j >= 0; j--) {
                if (progressStepForIndex(combined[j]) === stepNum) {
                    targetPos = j;
                    break;
                }
            }
            if (targetPos !== -1) {
                history = combined.slice(0, targetPos);
                currentIndex = combined[targetPos];
                showCurrent();
            }
        });
    });

    showCurrent();

    setupToggleButtons('vårdnad-group', 'vårdnad', value => {
        if (value === 'ensam') {
            partnerSelected = false;
            document.getElementById('beräkna-partner').value = 'nej';
            step6?.style.setProperty('display', 'none');
            goTo(idx.barnIdag);
        } else {
            partnerSelected = true;
            step6?.style.setProperty('display', 'flex');
            goTo(idx.partner);
        }
    });

    setupToggleButtons('partner-group', 'beräkna-partner', value => {
        partnerSelected = value === 'ja';
        if (partnerSelected) {
            step6?.style.setProperty('display', 'flex');
        } else {
            step6?.style.setProperty('display', 'none');
        }
        goTo(idx.barnIdag);
    });

    setupToggleButtons('barn-tidigare-group', 'barn-tidigare', () => {
        goTo(idx.barnPlan);
    });

    setupToggleButtons('barn-planerade-group', 'barn-planerade', () => {
        goTo(idx.inkomst1);
    });

    setupToggleButtons('avtal-group-1', 'har-avtal-1', value => {
        const container = document.getElementById('anstallningstid-container-1');
        if (value === 'ja') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            document.getElementById('anstallningstid-1').value = '';
            if (partnerSelected) {
                goTo(idx.inkomst2);
            } else {
                goTo(idx.calc);
            }
        }
    });

    setupToggleButtons('anstallningstid-group-1', 'anstallningstid-1', () => {
        if (partnerSelected) {
            goTo(idx.inkomst2);
        } else {
            goTo(idx.calc);
        }
    });

    setupToggleButtons('avtal-group-2', 'har-avtal-2', value => {
        const container = document.getElementById('anstallningstid-container-2');
        if (value === 'ja') {
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
            document.getElementById('anstallningstid-2').value = '';
            goTo(idx.calc);
        }
    });

    setupToggleButtons('anstallningstid-group-2', 'anstallningstid-2', () => {
        goTo(idx.calc);
    });

    const toggleInputMap = {
        'vårdnad-group': 'vårdnad',
        'partner-group': 'beräkna-partner',
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
        const custodyType = (family.custody?.typ || '').toString().toLowerCase();
        const custodyValue = custodyType.includes('ensam') ? 'ensam' : 'gemensam';
        applyToggleValue('vårdnad-group', custodyValue);

        const partnerPref = family.custody?.berakna_for_bada_foraldrarna;
        const partnerFallback = family.custody?.berakna_for_partner;
        const shouldIncludePartner = typeof partnerPref === 'boolean'
            ? partnerPref
            : (typeof partnerFallback === 'boolean' ? partnerFallback : true);
        const parents = Array.isArray(family.parents) ? family.parents : [];
        const hasSecondParent = parents.length > 1;
        partnerSelected = custodyValue === 'gemensam' && shouldIncludePartner && hasSecondParent;

        const partnerValue = partnerSelected ? 'ja' : 'nej';
        applyToggleValue('partner-group', partnerValue);
        document.getElementById('beräkna-partner').value = partnerValue;
        step6?.style.setProperty('display', partnerSelected ? 'flex' : 'none');

        const existingChildren = family.barn?.befintliga ?? 0;
        applyToggleValue('barn-tidigare-group', existingChildren.toString());
        const plannedChildren = family.barn?.forvantade ?? 0;
        applyToggleValue('barn-planerade-group', plannedChildren.toString());

        const parent1 = parents[0] || {};
        const parent2 = partnerSelected ? parents[1] || {} : null;

        const income1Input = document.getElementById('inkomst1');
        const income2Input = document.getElementById('inkomst2');
        if (income1Input) {
            income1Input.value = parent1.salary_sek_per_month ?? '';
        }
        if (income2Input) {
            income2Input.value = parent2?.salary_sek_per_month ?? '';
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
        applyToggleValue('avtal-group-2', partnerSelected ? avtal2Value : null);
        const container2 = document.getElementById('anstallningstid-container-2');
        const employment2 = employmentOptionForParent(parent2);
        if (container2) {
            if (partnerSelected && avtal2Value === 'ja' && employment2) {
                container2.style.display = 'block';
                applyToggleValue('anstallningstid-group-2', employment2);
            } else {
                container2.style.display = 'none';
                applyToggleValue('anstallningstid-group-2', null);
            }
        }

        const historyPath = [idx.vardnad];
        if (custodyValue === 'gemensam') {
            historyPath.push(idx.partner);
        }
        historyPath.push(idx.barnIdag, idx.barnPlan, idx.inkomst1);
        if (partnerSelected) {
            historyPath.push(idx.inkomst2);
        }
        history = [...historyPath];
        currentIndex = idx.calc;
        showCurrent();
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
