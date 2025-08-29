import { updateProgress, setupToggleButtons } from './ui.js';

/**
 * wizard.js - Sequential question wizard for the Föräldrapenningkalkylator
 * Handles navigation between questions, progress bar updates and back navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        vardnad: document.getElementById('vårdnad-group')?.closest('.wizard-step'),
        partner: document.getElementById('partner-question'),
        barnIdag: document.getElementById('barn-tidigare-group')?.closest('.wizard-step'),
        barnPlan: document.getElementById('barn-planerade-group')?.closest('.wizard-step'),
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
        stepSections.forEach(sec => sec?.classList.remove('visible'));
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
            step6?.style.setProperty('display', 'block');
            goTo(idx.partner);
        }
    });

    setupToggleButtons('partner-group', 'beräkna-partner', value => {
        partnerSelected = value === 'ja';
        if (!partnerSelected) step6?.style.setProperty('display', 'none');
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
            container?.classList.remove('hidden');
        } else {
            container?.classList.add('hidden');
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
            container?.classList.remove('hidden');
        } else {
            container?.classList.add('hidden');
            document.getElementById('anstallningstid-2').value = '';
            goTo(idx.calc);
        }
    });

    setupToggleButtons('anstallningstid-group-2', 'anstallningstid-2', () => {
        goTo(idx.calc);
    });
});

