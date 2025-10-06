/**
 * ui.js - UI interactions for the Föräldrapenningkalkylator
 * Manages progress bar, toggle buttons, info boxes, and result rendering.
 */
import { barnIdag, barnPlanerat } from './config.js';
import { beräknaNetto } from './calculations.js';

/**
 * Update the progress bar based on the current step
 * @param {number} stepNumber - Current step number
 */
export function updateProgress(stepNumber) {
    const steps = document.querySelectorAll('#progress-bar .step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index < stepNumber - 1) step.classList.add('completed');
        else if (index === stepNumber - 1) step.classList.add('active');
    });
}

/**
 * Set up toggle buttons for a group
 * @param {string} groupId - ID of the button group
 * @param {string} inputId - ID of the hidden input
 * @param {Function} callback - Optional callback function
 */
export function setupToggleButtons(groupId, inputId, callback = null) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return;
    groupEl.setAttribute('role', 'group');
    const group = groupEl.querySelectorAll('.toggle-btn');
    const input = document.getElementById(inputId);
    group.forEach((button, index) => {
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('tabindex', '0');
        if (!button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', button.textContent.trim());
        }
        button.addEventListener('click', () => {
            group.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-pressed', 'true');
            input.value = button.dataset.value;
            if (groupId === 'barn-tidigare-group') {
                window.barnIdag = parseInt(button.dataset.value);
            }
            if (groupId === 'barn-planerade-group') {
                window.barnPlanerat = parseInt(button.dataset.value);
            }
            if (callback) callback(button.dataset.value);
        });
        button.addEventListener('keydown', e => {
            if (['ArrowRight', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                group[(index + 1) % group.length].focus();
            } else if (['ArrowLeft', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                group[(index - 1 + group.length) % group.length].focus();
            } else if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                button.click();
            }
        });
    });
}

/**
 * Set up toggle for info boxes
 */
function toggleInfoBox(e) {
    const header = e.currentTarget;
    const box = header.closest('.info-box');
    if (!box) return;
    const isOpen = box.classList.toggle('open');
    if (header instanceof HTMLElement) {
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
}

function handleInfoHeaderKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        const target = event.currentTarget;
        if (target instanceof HTMLElement) {
            target.click();
        }
    }
}

export function setupInfoBoxToggle() {
    const infoHeaders = document.querySelectorAll('.info-header');
    infoHeaders.forEach(header => {
        header.removeEventListener('click', toggleInfoBox);
        header.addEventListener('click', toggleInfoBox);

        if (header.tagName !== 'BUTTON') {
            header.setAttribute('role', 'button');
            header.setAttribute('tabindex', '0');
            header.removeEventListener('keydown', handleInfoHeaderKeydown);
            header.addEventListener('keydown', handleInfoHeaderKeydown);
        } else {
            header.removeEventListener('keydown', handleInfoHeaderKeydown);
        }

        const parentBox = header.closest('.info-box');
        const isOpen = parentBox?.classList.contains('open') ?? false;
        header.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
}

/**
 * Generate a table showing benefit details
 * @param {number} dailyRate - Daily benefit rate
 * @param {number} dagar - Number of available days
 * @param {number} extra - Parental supplement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional child allowance
 * @returns {string} HTML table string
 */
export function genereraTabell(dailyRate, dagar, extra = 0, barnbidrag = 0, tillägg = 0) {
    let rows = '';
    for (let i = 1; i <= 7; i++) {
        const månadsersättning = Math.round((dailyRate * i * 4.3) / 100) * 100;
        const veckor = Math.floor(dagar / i);
        rows += `
            <tr>
                <td>${i} dag${i > 1 ? 'ar' : ''}</td>
                <td>${veckor} veckor</td>
                <td>${månadsersättning.toLocaleString()} kr</td>
            </tr>
        `;
    }
    return `
        <div class="info-box benefit-table">
            <button type="button" class="info-header" aria-expanded="false">
                <span class="info-icon">📊</span>
                <span><strong>Tabell för uttag och ersättning</strong></span>
                <span class="info-arrow">▾</span>
            </button>
            <div class="info-content">
                <div class="table-wrapper">
                    <table>
                        <thead>
                            <tr>
                                <th>Dagar per vecka</th>
                                <th>Så länge räcker dagarna</th>
                                <th>Föräldrapenning per månad</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

/**
 * Generate a parent section for results
 * @param {number} parentNum - Parent number (1 or 2)
 * @param {number} dag - Daily benefit rate
 * @param {number} extra - Parental supplement
 * @param {number} månadsinkomst - Monthly parental benefit (gross)
 * @param {number} dagar - Available days
 * @param {boolean} avtal - Has collective agreement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional child allowance
 * @param {boolean} ärEnsam - True if sole custody
 * @param {number} inkomst - Reported salary
 * @returns {string} HTML section string
*/
export function generateParentSection(parentNum, dag, extra, månadsinkomst,
    dagar, avtal, barnbidrag, tillägg, ärEnsam, inkomst) {
    const lagstanivådagar = Math.round(dagar * 0.23076923);
    const fpNet = beräknaNetto(månadsinkomst);
    const gemensamDetails = `
        <div class="benefit-details">
            <div class="benefit-detail-line">
                <span>Varav dagar som kan delas:</span>
                <span class="benefit-detail-value">105</span>
            </div>
            <div class="benefit-detail-line">
                <span>Varav reserverade dagar:</span>
                <span class="benefit-detail-value">90</span>
            </div>
        </div>
    `;
    return `
        <div class="result-section">
            <h2>Förälder ${parentNum}</h2>
            <h4>Ersättning</h4>
            <div class="benefit-grid">
                <div class="benefit-card">
                    <div class="benefit-title">Daglig ersättning på sjukpenningnivå</div>
                    <div class="benefit-value-large">
                        <span>${dag.toLocaleString()}</span><span class="unit">kr/dag</span>
                    </div>
                    <div class="benefit-bar">
                        <div class="benefit-bar-fill" style="width: ${(dag - 250) / (1250 - 250) * 100}%;"></div>
                    </div>
                    <div class="benefit-bar-labels">
                        <span>250 kr</span><span>1 250 kr</span>
                    </div>
                </div>
                <div class="benefit-card">
                    <div class="benefit-title">Bruttoinkomst</div>
                    <div class="benefit-value-large">
                        <span>${inkomst.toLocaleString()}</span><span class="unit">kr/månad</span>
                    </div>
                    <div class="benefit-title" style="margin-top: 0.5rem;">Preliminär föräldralön</div>
                    <div class="benefit-value-large">
                        <span>${extra.toLocaleString()}</span><span class="unit">kr/månad</span>
                    </div>
                </div>
                <div class="info-box">
                    <div class="info-header">
                        <span class="info-icon">ℹ️</span>
                        <span><strong>Information om föräldralön</strong></span>
                        <span class="info-arrow">▾</span>
                    </div>
                    <div class="info-content">
                        <p>
                            Eftersom du har kollektivavtal har du sannolikt rätt till föräldrapenningtillägg, även kallat föräldralön, från din arbetsgivare. Detta innebär ofta att du kan få upp till 90 % av din lön under en viss period av din föräldraledighet.
                        </p>
                    </div>
                </div>
            </div>
            <h4>Föräldradagar</h4>
            <div class="benefit-grid">
                <div class="benefit-card">
                    <div class="benefit-title">Föräldradagar på sjukpenningnivå</div>
                    <div class="benefit-value-large">
                        <span>${dagar}</span><span class="unit">dagar</span>
                    </div>
                    ${ärEnsam ? '' : gemensamDetails}
                </div>
                <div class="benefit-card">
                    <div class="benefit-title">Föräldradagar på lägstanivå</div>
                    <div class="benefit-value-large">
                        <span>${lagstanivådagar}</span><span class="unit">dagar</span>
                        <br><div><span class="unit">180 kr/dag</span></div>
                    </div>
                </div>
            </div>
            ${genereraTabell(dag, dagar, extra, barnbidrag, tillägg)}

            <div class="monthly-wrapper" id="monthly-wrapper-${parentNum}">
                <div class="monthly-box">
                    <h3>Förälder ${parentNum} – Månatlig ersättning</h3>
                    <div class="monthly-row fp-row">
                        <span>Föräldrapenning*</span>
                        <span class="fp-brutto">${månadsinkomst.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-row fp-net-row">
                        <span>Föräldrapenning efter skatt</span>
                        <span class="fp-value">${fpNet.toLocaleString()} kr/månad</span>
                    </div>
                    ${avtal ? `
                    <div class="monthly-row extra-row">
                        <span>Föräldralön**</span>
                        <span class="extra-value">${extra.toLocaleString()} kr/månad</span>
                    </div>` : ''}
                    <div class="monthly-row barnbidrag-row">
                        <span>Barnbidrag</span>
                        <span class="barnbidrag-value">${barnbidrag.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-row tillagg-row">
                        <span>Flerbarnstillägg</span>
                        <span class="tillagg-value">${tillägg.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-total">
                        <span>Totalt:</span>
                        <span class="total-value">${(fpNet + extra + barnbidrag + tillägg).toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-info">
                        * Vid ett uttag på 7 föräldradagar/vecka<br>
                        ${avtal ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''}
                    </div>
                </div>
                <div class="uttag-container">
                    <div class="fp-uttagsval">
                        <label for="uttags-dagar-${parentNum}">Antal uttag av föräldradagar per vecka:</label>
                        <select id="uttags-dagar-${parentNum}">
                            <option value="1">1 dag</option>
                            <option value="2">2 dagar</option>
                            <option value="3">3 dagar</option>
                            <option value="4">4 dagar</option>
                            <option value="5">5 dagar</option>
                            <option value="6">6 dagar</option>
                            <option value="7" selected>7 dagar</option>
                        </select>
                    </div>
                    <div class="duration-info">
                        <p>I denna takt kan du vara ledig i:</p><br><p class="duration-text" align="left"><span class="duration-value"></span> månader</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Set up strategy toggle buttons
 */
export function setupStrategyToggle() {
    const strategyGroup = document.querySelectorAll('#strategy-group .toggle-btn');
    const strategyInput = document.getElementById('strategy');
    strategyGroup.forEach(button => {
        button.addEventListener('click', () => {
            strategyGroup.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            strategyInput.value = button.dataset.value;
        });
    });
}

/**
 * Update monthly box with new calculations
 * @param {string} wrapperId - ID of the monthly wrapper
 * @param {number} dagarPerVecka - Days per week
 * @param {number} dag - Daily rate
 * @param {number} extra - Parental supplement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional allowance
 * @param {boolean} avtal - Has collective agreement
 * @param {number} dagar - Available days
 */
export function updateMonthlyBox(wrapperId, dagarPerVecka, dag, extra, barnbidrag, tillägg, avtal, dagar) {
    const wrapper = document.getElementById(wrapperId) || document.getElementById(wrapperId.replace('monthly-wrapper', 'uttags-dagar'))?.closest('.monthly-wrapper');
    if (!wrapper) return console.error(`Kunde inte hitta wrapper ${wrapperId}`);
    
    const monthlyBox = wrapper.querySelector('.monthly-box');
    if (!monthlyBox) return console.error(`monthly-box hittades inte i ${wrapperId}`);
    
    const nyFpBrutto = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
    const nyFp = beräknaNetto(nyFpBrutto);
    const justeradExtraBrutto = avtal ? Math.round(extra * (dagarPerVecka / 7)) : 0;
    const nyTotal = nyFp + justeradExtraBrutto + (barnbidrag || 0) + (tillägg || 0);

    const fpBruttoElement = monthlyBox.querySelector('.fp-row .fp-brutto');
    const fpElement = monthlyBox.querySelector('.fp-net-row .fp-value');
    const extraElement = monthlyBox.querySelector('.extra-row .extra-value');
    const totalElement = monthlyBox.querySelector('.monthly-total .total-value');
    const infoElement = monthlyBox.querySelector('.monthly-info');

    if (fpElement && fpBruttoElement && totalElement) {
        fpBruttoElement.textContent = `${nyFpBrutto.toLocaleString()} kr/månad`;
        fpElement.textContent = `${nyFp.toLocaleString()} kr/månad`;
        if (extraElement) {
            extraElement.textContent = `${justeradExtraBrutto.toLocaleString()} kr/månad`;
        }
        totalElement.textContent = `${nyTotal.toLocaleString()} kr/månad`;
        if (infoElement) {
            infoElement.innerHTML = `* Vid ett uttag på ${dagarPerVecka} föräldradagar/vecka<br>${avtal ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''}`;
        }
    }
    
    const durationElement = wrapper.querySelector('.duration-info .duration-value');
    if (durationElement) {
        const weeks = Math.floor(dagar / dagarPerVecka);
        const months = (weeks / 4.3).toFixed(1);
        durationElement.textContent = months;
    }
}