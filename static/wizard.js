import { updateProgress, setupToggleButtons } from './ui.js';

/**
 * wizard.js - Sequential question wizard for the Föräldrapenningkalkylator
 * Presents one question at a time and updates the progress bar accordingly.
 */

document.addEventListener('DOMContentLoaded', () => {
    const sections = {
        vardnad: document.querySelector('#vårdnad-group').closest('.wizard-step'),
        partner: document.getElementById('partner-question'),
        barnIdag: document.querySelector('#barn-tidigare-group').closest('.wizard-step'),
        barnPlan: document.querySelector('#barn-planerade-group').closest('.wizard-step'),
        inkomst1: document.getElementById('inkomst1').closest('.wizard-step'),
        avtal1: document.getElementById('avtal-question-1'),
        inkomst2: document.getElementById('inkomst-block-2'),
        avtal2: document.getElementById('avtal-question-2')
    };
    const calculateBtn = document.getElementById('calculate-btn');
    const step6 = document.querySelector('.step-6');
    let partnerSelected = false;

    // Hide all wizard steps initially
    Object.values(sections).forEach(sec => sec?.classList.remove('visible'));
    calculateBtn.classList.add('hidden');

    // Show first question
    sections.vardnad?.classList.add('visible');
    updateProgress(1);

    setupToggleButtons('vårdnad-group', 'vårdnad', value => {
        sections.vardnad.classList.remove('visible');
        if (value === 'ensam') {
            partnerSelected = false;
            document.getElementById('beräkna-partner').value = 'nej';
            step6?.style.setProperty('display', 'none');
            updateProgress(3);
            sections.barnIdag.classList.add('visible');
        } else {
            step6?.style.setProperty('display', 'block');
            updateProgress(2);
            sections.partner.classList.add('visible');
        }
    });

    setupToggleButtons('partner-group', 'beräkna-partner', value => {
        partnerSelected = value === 'ja';
        if (!partnerSelected) step6?.style.setProperty('display', 'none');
        sections.partner.classList.remove('visible');
        updateProgress(3);
        sections.barnIdag.classList.add('visible');
    });

    setupToggleButtons('barn-tidigare-group', 'barn-tidigare', () => {
        sections.barnIdag.classList.remove('visible');
        updateProgress(4);
        sections.barnPlan.classList.add('visible');
    });

    setupToggleButtons('barn-planerade-group', 'barn-planerade', () => {
        sections.barnPlan.classList.remove('visible');
        updateProgress(5);
        sections.inkomst1.classList.add('visible');
    });

    const inkomst1Input = document.getElementById('inkomst1');
    inkomst1Input.addEventListener('input', () => {
        if (inkomst1Input.value !== '') {
            sections.inkomst1.classList.remove('visible');
            sections.avtal1.classList.add('visible');
        }
    });

    setupToggleButtons('avtal-group-1', 'har-avtal-1', () => {
        sections.avtal1.classList.remove('visible');
        if (partnerSelected) {
            updateProgress(6);
            sections.inkomst2.classList.add('visible');
        } else {
            updateProgress(7);
            calculateBtn.classList.remove('hidden');
        }
    });

    const inkomst2Input = document.getElementById('inkomst2');
    inkomst2Input.addEventListener('input', () => {
        if (inkomst2Input.value !== '') {
            sections.inkomst2.classList.remove('visible');
            sections.avtal2.classList.add('visible');
        }
    });

    setupToggleButtons('avtal-group-2', 'har-avtal-2', () => {
        sections.avtal2.classList.remove('visible');
        updateProgress(7);
        calculateBtn.classList.remove('hidden');
    });
});

