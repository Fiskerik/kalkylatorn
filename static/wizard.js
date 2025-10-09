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
    const employmentContainer2 = document.getElementById('anstallningstid-container-2');
    const stickyCTA = document.getElementById('sticky-cta');
    const optimizeButton = document.getElementById('optimize-btn');
    const form = document.getElementById('calc-form');

    let partnerActive = partnerCheckbox ? partnerCheckbox.checked : false;

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
            const avtalButtons = document.querySelectorAll('#avtal-group-2 .toggle-btn');
            avtalButtons.forEach(button => button.classList.remove('active'));
            const avtalInput = document.getElementById('har-avtal-2');
            if (avtalInput) {
                avtalInput.value = '';
            }
            if (employmentContainer2) {
                employmentContainer2.style.display = 'none';
            }
        }
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
            } else {
                if (form && typeof form.requestSubmit === 'function') {
                    form.requestSubmit();
                } else {
                    form?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
                }
            }
        });
    }

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
        if (!employmentContainer2) return;
        if (value === 'ja' && partnerActive) {
            employmentContainer2.style.display = 'block';
        } else {
            employmentContainer2.style.display = 'none';
            const input = document.getElementById('anstallningstid-2');
            if (input) input.value = '';
        }
    });

    setupToggleButtons('anstallningstid-group-2', 'anstallningstid-2');

    setPartnerFieldsVisible(partnerActive);
});
