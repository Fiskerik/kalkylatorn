// Define global variables
let vardnad = '';
let beraknaPartner = '';

// Progress bar update
function updateProgress(stepNumber) {
    const steps = document.querySelectorAll('#progress-bar .step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index < stepNumber - 1) step.classList.add('completed');
        else if (index === stepNumber - 1) step.classList.add('active');
    });
}

// Reusable toggle button setup
function setupToggleButtons(groupId, inputId, callback = null) {
    const group = document.querySelectorAll(`#${groupId} .toggle-btn`);
    const input = document.getElementById(inputId);
    group.forEach(button => {
        button.addEventListener('click', () => {
            group.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            input.value = button.dataset.value;
            if (callback) callback(button.dataset.value);
        });
    });
}

// Reusable info box toggle setup
function setupInfoBoxToggle() {
    const infoHeaders = document.querySelectorAll('.info-header');
    infoHeaders.forEach(header => {
        header.removeEventListener('click', toggleInfoBox);
        header.addEventListener('click', toggleInfoBox);
    });

    function toggleInfoBox(e) {
        const box = e.currentTarget.closest('.info-box');
        if (box) box.classList.toggle('open');
    }
}

// Calculate daily benefit
function beraknaDaglig(inkomst) {
    const ar = inkomst * 12;
    if (ar < 117590) return 250;
    if (ar > 588000) return 1250;
    const sgi = ar * 0.97;
    return Math.round((sgi * 0.8) / 365);
}

// Generate table for parental leave days
function genereraTabell(dailyRate, dagar, extra = 0, barnbidrag = 0, tillagg = 0) {
    let rows = '';
    for (let i = 1; i <= 7; i++) {
        const manadsersattning = Math.round((dailyRate * i * 4.3) / 100) * 100;
        const totalDisponibelt = manadsersattning + barnbidrag + tillagg + extra;
        const veckor = Math.floor(dagar / i);
        rows += `
            <tr>
                <td>${i} dag${i > 1 ? 'ar' : ''}</td>
                <td>${veckor} veckor</td>
                <td>${manadsersattning.toLocaleString()} kr</td>
            </tr>
        `;
    }
    return `
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
    `;
}

// Generate result section for a parent
function generateParentSection(parentNum, dag, extra, manad, dagar, avtal, barnbidrag, tillagg, isEnsam) {
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
                    <div class="benefit-title">Preliminär föräldralön</div>
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
                    ${isEnsam ? '' : gemensamDetails}
                </div>
                <div class="benefit-card">
                    <div class="benefit-title">Föräldradagar på lägstanivå</div>
                    <div class="benefit-value-large">
                        <span>90</span><span class="unit">dagar</span>
                        <br><div><span class="unit">180 kr/dag</span></div>
                    </div>
                </div>
            </div>
            ${genereraTabell(dag, dagar, extra, barnbidrag, tillagg)}

            <div class="monthly-wrapper" id="monthly-wrapper-${parentNum}">
                <div class="monthly-box">
                    <h3>Förälder ${parentNum} – Månatlig ersättning</h3>
                    <div class="monthly-row fp-row">
                        <span>Föräldrapenning*</span>
                        <span class="fp-value">${manad.toLocaleString()} kr/månad</span>
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
                        <span class="tillagg-value">${tillagg.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-total">
                        <span>Totalt:</span>
                        <span class="total-value">${(manad + extra + barnbidrag + tillagg).toLocaleString()} kr/månad</span>
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

document.addEventListener("DOMContentLoaded", function () {
    updateProgress(1);

    const elements = {
        vardnadButtons: document.querySelectorAll('#vardnad-group .vardnad-btn'),
        vardnadInput: document.getElementById('vardnad'),
        vardnadInfo: document.getElementById('vardnad-info'),
        partnerQuestion: document.getElementById('partner-question'),
        partnerButtons: document.querySelectorAll('#partner-group .toggle-btn'),
        partnerInput: document.getElementById('berakna-partner'),
        form: document.getElementById('calc-form'),
        resultBlock: document.getElementById('result-block'),
        inkomstBlock2: document.getElementById('inkomst-block-2'),
        avtalQuestion2: document.getElementById('avtal-question-2')
    };

    // Define state variables individually instead of as an object
    let dag1 = 0, extra1 = 0, manad1 = 0;
    let dag2 = 0, extra2 = 0, manad2 = 0;
    let barnbidragPerPerson = 0, tillaggPerPerson = 0;
    let income2 = 0;

    // Setup toggle buttons
    setupToggleButtons('barn-tidigare-group', 'barn-tidigare');
    setupToggleButtons('barn-planerade-group', 'barn-planerade');
    setupToggleButtons('avtal-group-1', 'har-avtal-1', () => {
        updateProgress(vardnad === "gemensam" && beraknaPartner === "ja" ? 6 : 7);
    });
    setupToggleButtons('avtal-group-2', 'har-avtal-2', () => updateProgress(7));

    // Vårdnad selection
    setupToggleButtons('vardnad-group', 'vardnad', (value) => {
        vardnad = value;
        if (vardnad === 'gemensam') {
            elements.vardnadInfo.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
            elements.partnerQuestion.style.display = "block";
            elements.inkomstBlock2.style.display = "block";
            elements.avtalQuestion2.style.display = "block";
            updateProgress(2);
        } else {
            elements.vardnadInfo.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
            elements.partnerQuestion.style.display = "none";
            elements.partnerInput.value = "";
            beraknaPartner = '';
            elements.inkomstBlock2.style.display = "none";
            elements.avtalQuestion2.style.display = "none";
            updateProgress(3);
        }
    });

    // Partner selection
    setupToggleButtons('partner-group', 'berakna-partner', (value) => {
        beraknaPartner = value;
        elements.inkomstBlock2.style.display = value === 'ja' ? "block" : "none";
        elements.avtalQuestion2.style.display = value === 'ja' ? "block" : "none";
        updateProgress(3);
    });

    // Barn selection
    document.getElementById('barn-tidigare-group').addEventListener('click', () => updateProgress(4));
    document.getElementById('barn-planerade-group').addEventListener('click', () => updateProgress(5));

    // Income triggers
    document.getElementById('inkomst1').addEventListener('input', () => {
        if (document.getElementById('inkomst1').value) updateProgress(6);
    });
    document.getElementById('inkomst2')?.addEventListener('input', () => {
        if (document.getElementById('inkomst2').value) updateProgress(7);
    });

    // Form submission
    elements.form.addEventListener("submit", function (e) {
        e.preventDefault();

        const inputs = {
            vardnad: elements.vardnadInput.value,
            beraknaPartner: elements.partnerInput.value,
            income1: parseInt(document.getElementById("inkomst1").value),
            income2: parseInt(document.getElementById("inkomst2")?.value || "0"),
            barnTidigare: parseInt(document.getElementById("barn-tidigare")?.value || "0"),
            barnPlanerade: parseInt(document.getElementById("barn-planerade")?.value || "0"),
            avtal1: document.getElementById("har-avtal-1").value === "ja",
            avtal2: document.getElementById("har-avtal-2")?.value === "ja"
        };

        // Validation
        if (!inputs.vardnad) return alert("Välj vårdnadsform (gemensam eller ensam).");
        if (isNaN(inputs.income1) || inputs.income1 <= 0) return alert("Ange en giltig månadsinkomst för förälder 1.");
        if (!document.getElementById("har-avtal-1").value) {
            alert("Välj om förälder 1 har kollektivavtal.");
            updateProgress(5);
            return;
        }
        if (inputs.vardnad === "gemensam" && inputs.beraknaPartner === "ja") {
            if (isNaN(inputs.income2) || inputs.income2 <= 0) return alert("Ange en giltig månadsinkomst för förälder 2.");
            if (!document.getElementById("har-avtal-2")?.value) {
                alert("Välj om förälder 2 har kollektivavtal.");
                updateProgress(6);
                return;
            }
        }

        updateProgress(7);
        vardnad = inputs.vardnad;
        beraknaPartner = inputs.beraknaPartner;
        income2 = inputs.income2; // Update global income2

        const totalBarn = inputs.barnTidigare + inputs.barnPlanerade;
        const dagar = vardnad === "ensam" ? 390 : 195;
        const { barnbidrag, tillagg, total, details } = beraknaBarnbidrag(totalBarn, vardnad === "ensam");
        barnbidragPerPerson = vardnad === "ensam" ? barnbidrag : Math.round(barnbidrag / 2);
        tillaggPerPerson = vardnad === "ensam" ? tillagg : Math.round(tillagg / 2);

        let output = "<div class='result'>";
        output += `<div class="result-block"><h2>Sammanlagt barnbidrag</h2><p>${details}</p></div>`;

        if (!isNaN(inputs.income1)) {
            dag1 = beraknaDaglig(inputs.income1);
            extra1 = inputs.avtal1 ? (inputs.income1 <= 49000 ? Math.round(inputs.income1 * 0.10) : 4900) : 0;
            manad1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
            output += generateParentSection(1, dag1, extra1, manad1, dagar, inputs.avtal1, barnbidragPerPerson, tillaggPerPerson, vardnad === "ensam");
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && inputs.income2 > 0) {
            dag2 = beraknaDaglig(inputs.income2);
            extra2 = inputs.avtal2 ? (inputs.income2 <= 49000 ? Math.round(inputs.income2 * 0.10) : 4900) : 0;
            manad2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
            output += generateParentSection(2, dag2, extra2, manad2, dagar, inputs.avtal2, barnbidragPerPerson, tillaggPerPerson, false);
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja") {
            const initialDays = 7;
            output += `
                <div class="total-total-box" id="total-total-box">
                    <div class="total-header"><h3>Totalt för båda föräldrar</h3></div>
                    <div class="total-content">
                        <div class="total-section parent-1">
                            <h4>Förälder 1</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-1">${initialDays}</span> dagar/vecka)</span>
                                <span class="fp-value">${manad1.toLocaleString()} kr/månad</span>
                            </div>
                            ${inputs.avtal1 ? `<div class="monthly-row extra-row"><span>Föräldralön</span><span class="extra-value">${extra1.toLocaleString()} kr/månad</span></div>` : ''}
                            <div class="monthly-row barnbidrag-row"><span>Barnbidrag</span><span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span></div>
                            <div class="monthly-row tillagg-row"><span>Flerbarnstillägg</span><span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span></div>
                        </div>
                        ${vardnad === "gemensam" && beraknaPartner === "ja" && inputs.income2 > 0 ? `
                        <div class="total-section parent-2">
                            <h4>Förälder 2</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-2">${initialDays}</span> dagar/vecka)</span>
                                <span class="fp-value">${manad2.toLocaleString()} kr/månad</span>
                            </div>
                            ${inputs.avtal2 ? `<div class="monthly-row extra-row"><span>Föräldralön</span><span class="extra-value">${extra2.toLocaleString()} kr/månad</span></div>` : ''}
                            <div class="monthly-row barnbidrag-row"><span>Barnbidrag</span><span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span></div>
                            <div class="monthly-row tillagg-row"><span>Flerbarnstillägg</span><span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span></div>
                        </div>` : ''}
                    </div>
                    <div class="montly-footer">
                        <div class="monthly-total">
                            <span>Total disponibel inkomst:</span>
                            <span class="total-value">${
                                vardnad === "gemensam" && beraknaPartner === "ja" && inputs.income2 > 0
                                    ? (manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson + manad2 + extra2 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()
                                    : (manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()
                            } kr/månad</span>
                        </div>
                    </div>
                </div>
            `;
        }

        output += "</div>";
        elements.resultBlock.innerHTML = output;

        setupInfoBoxToggle();
        setupDropdownListeners();

        elements.resultBlock.scrollIntoView({ behavior: 'smooth' });
    });

    // Dropdown listeners for monthly updates
    function setupDropdownListeners() {
        function updateMonthlyBox(wrapperId, dagarPerVecka, dag, extra, barnbidrag, tillagg, avtal, dagar) {
            const wrapper = document.getElementById(wrapperId) || document.getElementById(wrapperId.replace('monthly-wrapper', 'uttags-dagar'))?.closest('.monthly-wrapper');
            if (!wrapper) return console.error(`Could not find wrapper ${wrapperId}`);
    
            const monthlyBox = wrapper.querySelector('.monthly-box');
            if (!monthlyBox) return console.error(`monthly-box not found in ${wrapperId}`);
    
            const nyFp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
            const nyTotal = nyFp + (extra || 0) + (barnbidrag || 0) + (tillagg || 0);
    
            const fpElement = monthlyBox.querySelector('.fp-row .fp-value');
            const totalElement = monthlyBox.querySelector('.monthly-total .total-value');
            const infoElement = monthlyBox.querySelector('.monthly-info');
    
            if (fpElement && totalElement) {
                fpElement.textContent = `${nyFp.toLocaleString()} kr/månad`;
                totalElement.textContent = `${nyTotal.toLocaleString()} kr/månad`;
                if (infoElement) {
                    infoElement.innerHTML = `* Vid ett uttag på ${dagarPerVecka} föräldradagar/vecka<br>${avtal ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''}`;
                }
            }
    
            // Calculate and display duration in months
            const durationElement = wrapper.querySelector('.duration-info .duration-value');
            if (durationElement) {
                const weeks = Math.floor(dagar / dagarPerVecka);
                const months = (weeks / 4.3).toFixed(1); // Round to 1 decimal place
                durationElement.textContent = months;
            }
        }
    
        function updateTotalTotal() {
            const days1 = parseInt(document.getElementById('uttags-dagar-1')?.value) || 7;
            const days2 = parseInt(document.getElementById('uttags-dagar-2')?.value) || 7;
            const totalBox = document.getElementById('total-total-box');
            if (!totalBox) return;
    
            const fp1 = Math.round((dag1 * days1 * 4.3) / 100) * 100;
            const fp2 = vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0 ? Math.round((dag2 * days2 * 4.3) / 100) * 100 : 0;
    
            const daysSelected1 = totalBox.querySelector('.days-selected-1');
            if (daysSelected1) daysSelected1.textContent = days1;
    
            const daysSelected2 = totalBox.querySelector('.days-selected-2');
            if (daysSelected2) daysSelected2.textContent = days2;
    
            const sections = totalBox.querySelectorAll('.total-section');
            if (sections[0]) sections[0].querySelector('.fp-row .fp-value').textContent = `${fp1.toLocaleString()} kr/månad`;
            if (sections[1]) sections[1].querySelector('.fp-row .fp-value').textContent = `${fp2.toLocaleString()} kr/månad`;
    
            const total1 = fp1 + (extra1 || 0) + (barnbidragPerPerson || 0) + (tillaggPerPerson || 0);
            const total2 = fp2 + (extra2 || 0) + (barnbidragPerPerson || 0) + (tillaggPerPerson || 0);
            const grandTotal = total1 + (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0 ? total2 : 0);
    
            const totalValue = totalBox.querySelector('.monthly-total .total-value');
            if (totalValue) totalValue.textContent = `${grandTotal.toLocaleString()} kr/månad`;
        }
    
        [1, 2].forEach(num => {
            const uttagDagar = document.getElementById(`uttags-dagar-${num}`);
            if (uttagDagar) {
                uttagDagar.replaceWith(uttagDagar.cloneNode(true));
                const newUttagDagar = document.getElementById(`uttags-dagar-${num}`);
                newUttagDagar.addEventListener('change', (e) => {
                    const dagarPerVecka = parseInt(e.target.value) || 7;
                    const dag = num === 1 ? dag1 : dag2;
                    const extra = num === 1 ? extra1 : extra2;
                    const avtal = num === 1 ? document.getElementById('har-avtal-1')?.value === 'ja' : document.getElementById('har-avtal-2')?.value === 'ja';
                    const dagar = vardnad === "ensam" ? 390 : 195; // Pass total days
                    if (dag > 0) {
                        updateMonthlyBox(`monthly-wrapper-${num}`, dagarPerVecka, dag, extra, barnbidragPerPerson, tillaggPerPerson, avtal, dagar);
                        updateTotalTotal();
                    }
                });
    
                // Set initial duration value on load
                const initialDagarPerVecka = parseInt(newUttagDagar.value) || 7;
                const dag = num === 1 ? dag1 : dag2;
                const extra = num === 1 ? extra1 : extra2;
                const avtal = num === 1 ? document.getElementById('har-avtal-1')?.value === 'ja' : document.getElementById('har-avtal-2')?.value === 'ja';
                const dagar = vardnad === "ensam" ? 390 : 195;
                if (dag > 0) {
                    updateMonthlyBox(`monthly-wrapper-${num}`, initialDagarPerVecka, dag, extra, barnbidragPerPerson, tillaggPerPerson, avtal, dagar);
                }
            }
        });
    
        updateTotalTotal();
    }
});

function beraknaBarnbidrag(totalBarn, ensamVardnad) {
    const bidragPerBarn = 1250;
    const flerbarnstillägg = { 2: 150, 3: 730, 4: 1740, 5: 2990, 6: 4240 };
    const barnbidrag = bidragPerBarn * totalBarn;
    const tillagg = flerbarnstillägg[totalBarn] || 0;
    const total = barnbidrag + tillagg;
    const details = `${totalBarn} barn ger ${barnbidrag.toLocaleString()} kr barnbidrag${tillagg ? " + " + tillagg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return { barnbidrag: Math.round(barnbidrag), tillagg: Math.round(tillagg), total: Math.round(total), details };
}