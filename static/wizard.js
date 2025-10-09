import { setupToggleButtons } from './ui.js';

/**
 * wizard.js - Input helpers for the single-step Föräldrapenningkalkylator
 * Handles partner visibility toggles and setup for button groups.
 */
document.addEventListener('DOMContentLoaded', () => {
    const partnerCheckbox = document.getElementById('beräkna-partner-checkbox');
    const partnerHiddenInput = document.getElementById('beräkna-partner');
    const partnerFields = document.querySelectorAll('[data-partner-field]');
    const partnerInputs = document.querySelectorAll('[data-partner-field] input');
    const employmentContainer1 = document.getElementById('anstallningstid-container-1');
    const employmentContainer2 = document.getElementById('anstallningstid-container-2');
    const stickyCTA = document.getElementById('sticky-cta');
    const optimizeButton = document.getElementById('optimize-btn');
    const form = document.getElementById('calc-form');
    const avtal1Checkbox = document.getElementById('har-avtal-1-checkbox');
    const avtal2Checkbox = document.getElementById('har-avtal-2-checkbox');

    let partnerActive = partnerCheckbox ? partnerCheckbox.checked : false;

    const resetEmploymentSelection = (container, inputId) => {
        if (!container) return;
        container.style.display = 'none';
        const input = document.getElementById(inputId);
        if (input) input.value = '';
        const buttons = container.querySelectorAll('.toggle-btn');
        buttons.forEach(button => button.classList.remove('active'));
    };

    const updateEmploymentVisibility = (container, inputId, checked) => {
        if (!container) return;
        if (checked) {
            container.style.display = 'block';
        } else {
            resetEmploymentSelection(container, inputId);
        }
    };

    function setPartnerFieldsVisible(visible) {
        partnerActive = visible;
        partnerFields.forEach(field => {
            if (field instanceof HTMLElement) {
                field.style.display = visible ? '' : 'none';
            }
        });
        if (partnerHiddenInput) {
            partnerHiddenInput.value = visible ? 'ja' : 'nej';
        }
        if (!visible) {
            partnerInputs.forEach(input => {
                if (input instanceof HTMLInputElement) {
                    input.value = '';
                }
            });
            if (avtal2Checkbox) {
                avtal2Checkbox.checked = false;
            }
            resetEmploymentSelection(employmentContainer2, 'anstallningstid-2');
        } else if (avtal2Checkbox) {
            updateEmploymentVisibility(
                employmentContainer2,
                'anstallningstid-2',
                avtal2Checkbox.checked
            );
        }
        document.dispatchEvent(new CustomEvent('partner-visibility-changed', {
            detail: { active: visible }
        }));
    }

    if (partnerCheckbox) {
        partnerCheckbox.addEventListener('change', () => {
            setPartnerFieldsVisible(partnerCheckbox.checked);
            document.body.dataset.resultsReady = 'false';
            window.appState = undefined;
            document.dispatchEvent(new Event('results-reset'));
        });
    }

    if (stickyCTA) {
        stickyCTA.addEventListener('click', () => {
            if (document.body.dataset.resultsReady === 'true') {
                optimizeButton?.click();
            } else if (form) {
                if (typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        });
    }

    if (avtal1Checkbox) {
        avtal1Checkbox.addEventListener('change', () => {
            updateEmploymentVisibility(
                employmentContainer1,
                'anstallningstid-1',
                avtal1Checkbox.checked
            );
        });
    }

    if (avtal2Checkbox) {
        avtal2Checkbox.addEventListener('change', () => {
            updateEmploymentVisibility(
                employmentContainer2,
                'anstallningstid-2',
                partnerActive && avtal2Checkbox.checked
            );
        });
    }

    setupToggleButtons('anstallningstid-group-1', 'anstallningstid-1');
    setupToggleButtons('anstallningstid-group-2', 'anstallningstid-2');

    setPartnerFieldsVisible(partnerActive);
    updateEmploymentVisibility(
        employmentContainer1,
        'anstallningstid-1',
        Boolean(avtal1Checkbox?.checked)
    );
    updateEmploymentVisibility(
        employmentContainer2,
        'anstallningstid-2',
        partnerActive && Boolean(avtal2Checkbox?.checked)
    );
});
