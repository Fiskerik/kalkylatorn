// Define global variables outside the event listener
let vardnad = '';
let beraknaPartner = '';

function updateProgress(stepNumber) {
    const steps = document.querySelectorAll('#progress-bar .step');

    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed'); // Reset classes

        if (index < stepNumber - 1) {
            // Completed steps (before the current one)
            step.classList.add('completed');
        } else if (index === stepNumber - 1) {
            // Current step
            step.classList.add('active');
        }
        // Steps after stepNumber remain gray (unreached), no class needed
    });
}

document.addEventListener("DOMContentLoaded", function () {
    updateProgress(1); // Initialize with step 1 active

    const vardnadButtons = document.querySelectorAll('#vardnad-group .vardnad-btn');
    const vardnadInput = document.getElementById('vardnad');
    const vardnadInfo = document.getElementById('vardnad-info');
    const partnerQuestion = document.getElementById('partner-question');
    const partnerButtons = document.querySelectorAll('#partner-group .toggle-btn');
    const partnerInput = document.getElementById('berakna-partner');
    const form = document.getElementById('calc-form');
    const resultBlock = document.getElementById('result-block');
    const inkomstBlock2 = document.getElementById('inkomst-block-2');

    // Other variables remain in local scope
    let dag1 = 0;
    let extra1 = 0;
    let barnbidragPerPerson = 0;
    let tillaggPerPerson = 0;
    let dag2 = 0;
    let extra2 = 0;
    let manad1 = 0;
    let manad2 = 0;
    let income2 = 0;

    function setupToggleButtons(groupId, inputId) {
        const group = document.querySelectorAll(`#${groupId} .toggle-btn`);
        const input = document.getElementById(inputId);
        group.forEach(button => {
            button.addEventListener('click', () => {
                group.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                input.value = button.dataset.value;
            });
        });
    }

    setupToggleButtons('barn-tidigare-group', 'barn-tidigare');
    setupToggleButtons('barn-planerade-group', 'barn-planerade');
    setupToggleButtons('avtal-group-1', 'har-avtal-1');
    setupToggleButtons('avtal-group-2', 'har-avtal-2');

    // Vårdnad selection
    vardnadButtons.forEach(button => {
        button.addEventListener('click', () => {
            vardnadButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            vardnadInput.value = button.dataset.value;
            vardnad = button.dataset.value; // Update global

            if (vardnad === 'gemensam') {
                vardnadInfo.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
                partnerQuestion.style.display = "block";
                inkomstBlock2.style.display = "block";
                document.getElementById('avtal-question-2').style.display = "block";
                updateProgress(2); // Step 2: "Beräkna för partner?"
            } else {
                vardnadInfo.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
                partnerQuestion.style.display = "none";
                partnerInput.value = "";
                beraknaPartner = ''; // Reset global
                inkomstBlock2.style.display = "none";
                document.getElementById('avtal-question-2').style.display = "none";
                updateProgress(3); // Skip to Step 3: "Antal barn idag"
            }
        });
    });

    // Partner selection
    partnerButtons.forEach(button => {
        button.addEventListener('click', () => {
            partnerButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            partnerInput.value = button.dataset.value;
            beraknaPartner = button.dataset.value; // Update global
            inkomstBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
            document.getElementById('avtal-question-2').style.display = button.dataset.value === 'ja' ? "block" : "none";
            updateProgress(3); // Step 3: "Antal barn idag"
        });
    });

    // Barn selection
    document.getElementById('barn-tidigare-group').addEventListener('click', () => {
        updateProgress(4); // Step 4: "Antal barn planerade"
    });

    document.getElementById('barn-planerade-group').addEventListener('click', () => {
        updateProgress(5); // Step 5: "Inkomst förälder 1"
    });

    // Income and agreement triggers
    document.getElementById('inkomst1').addEventListener('input', () => {
        if (document.getElementById('inkomst1').value) {
            updateProgress(6); // Step 6: "Inkomst förälder 2" (or next step)
        }
    });

    document.getElementById('avtal-group-1').addEventListener('click', () => {
        if (vardnad === "gemensam" && beraknaPartner === "ja") {
            updateProgress(6); // Step 6: "Inkomst förälder 2"
        } else {
            updateProgress(7); // Step 7: "Beräkna"
        }
    });

    document.getElementById('inkomst2')?.addEventListener('input', () => {
        if (document.getElementById('inkomst2').value) {
            updateProgress(7); // Step 7: "Beräkna"
        }
    });

    document.getElementById('avtal-group-2')?.addEventListener('click', () => {
        updateProgress(7); // Step 7: "Beräkna"
    });

    // Form submission
    form.addEventListener("submit", function (e) {
        e.preventDefault();
        console.log("Formulär submit utlöst");

        vardnad = vardnadInput.value;
        beraknaPartner = partnerInput.value;
        const income1 = parseInt(document.getElementById("inkomst1").value);
        income2 = parseInt(document.getElementById("inkomst2")?.value || "0");
        const barnTidigare = parseInt(document.getElementById("barn-tidigare")?.value || "0");
        const barnPlanerade = parseInt(document.getElementById("barn-planerade")?.value || "0");
        const avtal1 = document.getElementById("har-avtal-1").value === "ja";
        const avtal2 = document.getElementById("har-avtal-2")?.value === "ja";

        if (!vardnad) {
            alert("Välj vårdnadsform (gemensam eller ensam).");
            return;
        }
        if (isNaN(income1) || income1 <= 0) {
            alert("Ange en giltig månadsinkomst för förälder 1.");
            return;
        }
        if (!document.getElementById("har-avtal-1").value) {
            alert("Välj om förälder 1 har kollektivavtal.");
            updateProgress(5); // Stay on step 5
            return;
        }
        if (vardnad === "gemensam" && beraknaPartner === "ja" && (isNaN(income2) || income2 <= 0)) {
            alert("Ange en giltig månadsinkomst för förälder 2.");
            return;
        }
        if (vardnad === "gemensam" && beraknaPartner === "ja" && !document.getElementById("har-avtal-2")?.value) {
            alert("Välj om förälder 2 har kollektivavtal.");
            updateProgress(6); // Stay on step 6
            return;
        }

        updateProgress(7); // All 7 steps completed

        dag1 = 0;
        extra1 = 0;
        barnbidragPerPerson = 0;
        tillaggPerPerson = 0;
        dag2 = 0;
        extra2 = 0;
        manad1 = 0;
        manad2 = 0;

        let output = "<div class='result'>";
        const totalBarn = barnTidigare + barnPlanerade;
        const dagar = vardnad === "ensam" ? 390 : 195;

        const { barnbidrag, tillagg, total, details } = beraknaBarnbidrag(totalBarn, vardnad === "ensam");
        barnbidragPerPerson = vardnad === "ensam" ? barnbidrag : Math.round(barnbidrag / 2);
        tillaggPerPerson = vardnad === "ensam" ? tillagg : Math.round(tillagg / 2);

        const beraknaDaglig = (inkomst) => {
            const ar = inkomst * 12;
            if (ar < 117590) return 250;
            if (ar > 588000) return 1250;
            const sgi = ar * 0.97;
            return Math.round((sgi * 0.8) / 365);
        };
        updateProgress(8)
        const genereraTabell = (dailyRate, dagar, extra = 0) => {
            let rows = '';
            for (let i = 1; i <= 7; i++) {
                const manadsersattning = Math.round((dailyRate * i * 4.3) / 100) * 100;
                const totalDisponibelt = manadsersattning + total + extra;
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
        };

        if (!isNaN(income1)) {
            dag1 = beraknaDaglig(income1);
            extra1 = avtal1 ? (income1 <= 49000 ? Math.round(income1 * 0.10) : 4900) : 0;
            manad1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;

            output += `
                <div class="result-block">
                    <h2>Sammanlagt barnbidrag</h2>
                    <p>${details}</p>
                </div>
                <div class="result-section">
                    <h2>Förälder 1</h2>
                    <h4>Ersättning</h4>
                    <div class="benefit-grid">
                        <div class="benefit-card">
                            <div class="benefit-title">Daglig ersättning på sjukpenningnivå</div>
                            <div class="benefit-value-large">
                                <span>${dag1.toLocaleString()}</span><span class="unit">kr/dag</span>
                            </div>
                            <div class="benefit-bar">
                                <div class="benefit-bar-fill" style="width: ${(dag1 - 250) / (1250 - 250) * 100}%;"></div>
                            </div>
                            <div class="benefit-bar-labels">
                                <span>250 kr</span><span>1 250 kr</span>
                            </div>
                        </div>
                        <div class="benefit-card">
                            <div class="benefit-title">Preliminär föräldralön</div>
                            <div class="benefit-value-large">
                                <span>${extra1.toLocaleString()}</span><span class="unit">kr/månad</span>
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
                                    Eftersom du har kollektivavtal har du sannolikt rätt till föräldrapenningtillägg, även kallat föräldralön, från din arbetsgivare. Detta innebär ofta att du kan få upp till 90 % av din lön under en viss period av din föräldraledighet. Kontakta din arbetsgivare eller fackförening för exakta villkor och belopp, då dessa kan variera beroende på ditt specifika avtal.
                                </p>
                            </div>
                        </div>
                    </div>
                    <h4>Föräldradagar</h4>
                    <div class="benefit-grid">
                        <div class="benefit-card">
                            <div class="benefit-title">Föräldradagar på sjukpenningnivå</div>
                            <div class="benefit-value-large">
                                <span>${vardnad === 'ensam' ? 390 : 195}</span><span class="unit">dagar</span>
                            </div>
                            ${vardnad === 'gemensam' ? `
                            <div class="benefit-details">
                                <div class="benefit-detail-line">
                                    <span>Varav dagar som kan delas:</span>
                                    <span class="benefit-detail-value">105</span>
                                </div>
                                <div class="benefit-detail-line">
                                    <span>Varav reserverade dagar:</span>
                                    <span class="benefit-detail-value">90</span>
                                </div>
                            </div>` : ''}
                        </div>
                        <div class="benefit-card">
                            <div class="benefit-title">Föräldradagar på lägstanivå</div>
                            <div class="benefit-value-large">
                                <span>90</span><span class="unit">dagar</span>
                                <br><div><span class="unit">180 kr/dag</span></div>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag1, dagar, extra1)}
                </div>
                <div class="monthly-wrapper" id="monthly-wrapper-1">
                    <div class="monthly-box">
                        <h3>Förälder 1 – Månatlig ersättning</h3>
                        <div class="monthly-row fp-row">
                            <span>Föräldrapenning*</span>
                            <span class="fp-value">${manad1.toLocaleString()} kr/månad</span>
                        </div>
                        ${avtal1 ? `
                        <div class="monthly-row extra-row">
                            <span>Föräldralön**</span>
                            <span class="extra-value">${extra1.toLocaleString()} kr/månad</span>
                        </div>` : ''}
                        <div class="monthly-row barnbidrag-row">
                            <span>Barnbidrag</span>
                            <span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-row tillagg-row">
                            <span>Flerbarnstillägg</span>
                            <span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-total">
                            <span>Totalt:</span>
                            <span class="total-value">${(manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-info">
                            * Vid ett uttag på 7 föräldradagar/vecka<br>
                            ${avtal1 ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''}
                        </div>
                    </div>
                    <div class="fp-uttagsval">
                        <label for="uttags-dagar-1">Antal uttag av föräldradagar per vecka:</label>
                        <select id="uttags-dagar-1">
                            <option value="1">1 dag</option>
                            <option value="2">2 dagar</option>
                            <option value="3">3 dagar</option>
                            <option value="4">4 dagar</option>
                            <option value="5">5 dagar</option>
                            <option value="6">6 dagar</option>
                            <option value="7" selected>7 dagar</option>
                        </select>
                    </div>
                </div>
            `;
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
            dag2 = beraknaDaglig(income2);
            extra2 = avtal2 ? (income2 <= 49000 ? Math.round(income2 * 0.10) : 4900) : 0;
            manad2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;

            output += `
                <div class="result-section">
                    <h2>Förälder 2</h2>
                    <h4>Ersättning</h4>
                    <div class="benefit-grid">
                        <div class="benefit-card">
                            <div class="benefit-title">Daglig ersättning på sjukpenningnivå</div>
                            <div class="benefit-value-large">
                                <span>${dag2.toLocaleString()}</span><span class="unit">kr/dag</span>
                            </div>
                            <div class="benefit-bar">
                                <div class="benefit-bar-fill" style="width: ${(dag2 - 250) / (1250 - 250) * 100}%;"></div>
                            </div>
                            <div class="benefit-bar-labels">
                                <span>250 kr</span><span>1 250 kr</span>
                            </div>
                        </div>
                        <div class="benefit-card">
                            <div class="benefit-title">Preliminär föräldralön</div>
                            <div class="benefit-value-large">
                                <span>${extra2.toLocaleString()}</span><span class="unit">kr/månad</span>
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
                                <span>195</span><span class="unit">dagar</span>
                            </div>
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
                        </div>
                        <div class="benefit-card">
                            <div class="benefit-title">Föräldradagar på lägstanivå</div>
                            <div class="benefit-value-large">
                                <span>90</span><span class="unit">dagar</span>
                                <br><div><span class="unit">180 kr/dag</span></div>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag2, dagar, extra2)}
                </div>
                <div class="monthly-wrapper" id="monthly-wrapper-2">
                    <div class="monthly-box">
                        <h3>Förälder 2 – Månatlig ersättning</h3>
                        <div class="monthly-row fp-row">
                            <span>Föräldrapenning*</span>
                            <span class="fp-value">${manad2.toLocaleString()} kr/månad</span>
                        </div>
                        ${avtal2 ? `
                        <div class="monthly-row extra-row">
                            <span>Föräldralön**</span>
                            <span class="extra-value">${extra2.toLocaleString()} kr/månad</span>
                        </div>` : ''}
                        <div class="monthly-row barnbidrag-row">
                            <span>Barnbidrag</span>
                            <span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-row tillagg-row">
                            <span>Flerbarnstillägg</span>
                            <span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-total">
                            <span>Totalt:</span>
                            <span class="total-value">${(manad2 + extra2 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()} kr/månad</span>
                        </div>
                        <div class="monthly-info">
                            * Vid ett uttag på 7 föräldradagar/vecka<br>
                            ${avtal2 ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''}
                        </div>
                    </div>
                    <div class="fp-uttagsval">
                        <label for="uttags-dagar-2">Antal uttag av föräldradagar per vecka:</label>
                        <select id="uttags-dagar-2">
                            <option value="1">1 dag</option>
                            <option value="2">2 dagar</option>
                            <option value="3">3 dagar</option>
                            <option value="4">4 dagar</option>
                            <option value="5">5 dagar</option>
                            <option value="6">6 dagar</option>
                            <option value="7" selected>7 dagar</option>
                        </select>
                    </div>
                </div>
            `;
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja") {
            const initialDays1 = 7;
            const initialDays2 = 7;
            output += `
                <div class="total-total-box" id="total-total-box">
                    <div class="total-header">
                        <h3>Totalt för båda föräldrar</h3>
                    </div>
                    <div class="total-content">
                        <div class="total-section parent-1">
                            <h4>Förälder 1</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-1">${initialDays1}</span> dagar/vecka)</span>
                                <span class="fp-value">${manad1.toLocaleString()} kr/månad</span>
                            </div>
                            ${avtal1 ? `
                            <div class="monthly-row extra-row">
                                <span>Föräldralön</span>
                                <span class="extra-value">${extra1.toLocaleString()} kr/månad</span>
                            </div>` : ''}
                            <div class="monthly-row barnbidrag-row">
                                <span>Barnbidrag</span>
                                <span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                            </div>
                            <div class="monthly-row tillagg-row">
                                <span>Flerbarnstillägg</span>
                                <span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span>
                            </div>
                        </div>
                        ${vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0 ? `
                        <div class="total-section parent-2">
                            <h4>Förälder 2</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-2">${initialDays2}</span> dagar/vecka)</span>
                                <span class="fp-value">${manad2.toLocaleString()} kr/månad</span>
                            </div>
                            ${avtal2 ? `
                            <div class="monthly-row extra-row">
                                <span>Föräldralön</span>
                                <span class="extra-value">${extra2.toLocaleString()} kr/månad</span>
                            </div>` : ''}
                            <div class="monthly-row barnbidrag-row">
                                <span>Barnbidrag</span>
                                <span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                            </div>
                            <div class="monthly-row tillagg-row">
                                <span>Flerbarnstillägg</span>
                                <span class="tillagg-value">${tillaggPerPerson.toLocaleString()} kr/månad</span>
                            </div>
                        </div>` : ''}
                    </div>
                    <div class="montly-footer">
                        <div class="monthly-total">
                            <span>Total disponibel inkomst:</span>
                            <span class="total-value">${
                                vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0
                                    ? (manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson + manad2 + extra2 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()
                                    : (manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()
                            } kr/månad</span>
                        </div>
                    </div>
                </div>
            `;
        }

        output += "</div>";
        resultBlock.innerHTML = output;

        setupInfoBoxToggle();
        setupDropdownListeners();

        resultBlock.scrollIntoView({ behavior: 'smooth' });
    });

    function setupInfoBoxToggle() {
        const infoHeaders = document.querySelectorAll('.info-header');
        infoHeaders.forEach(header => {
            header.removeEventListener('click', toggleInfoBox);
            header.addEventListener('click', toggleInfoBox);
        });

        function toggleInfoBox(e) {
            const box = e.currentTarget.closest('.info-box');
            if (box) {
                box.classList.toggle('open');
                console.log('Info-box toggled:', box.classList.contains('open') ? 'Opened' : 'Closed');
            }
        }
    }

    function setupDropdownListeners() {
        function updateMonthlyBox(wrapperId, dagarPerVecka, dag, extra, barnbidrag, tillagg, avtal) {
            console.log(`Updating monthly-box for ${wrapperId} with ${dagarPerVecka} days/week`);
            let wrapper = document.getElementById(wrapperId);
            if (!wrapper) {
                console.warn(`Wrapper #${wrapperId} not found, falling back to dropdown`);
                const dropdownId = wrapperId.replace('monthly-wrapper', 'uttags-dagar');
                const dropdown = document.getElementById(dropdownId);
                wrapper = dropdown?.closest('.monthly-wrapper');
            }
            if (!wrapper) {
                console.error(`Could not find wrapper ${wrapperId}`);
                alert(`Error: Could not find monthly wrapper ${wrapperId}`);
                return;
            }
            const monthlyBox = wrapper.querySelector('.monthly-box');
            if (!monthlyBox) {
                console.error(`monthly-box not found in ${wrapperId}`);
                alert(`Error: monthly-box not found in ${wrapperId}`);
                return;
            }
            const nyFp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
            const nyTotal = nyFp + (extra || 0) + (barnbidrag || 0) + (tillagg || 0);
            console.log(`Calculated: nyFp=${nyFp}, nyTotal=${nyTotal}, dag=${dag}, extra=${extra}, barnbidrag=${barnbidrag}, tillagg=${tillagg}`);
            const fpElement = monthlyBox.querySelector('.fp-row .fp-value');
            const totalElement = monthlyBox.querySelector('.monthly-total .total-value');
            const infoElement = monthlyBox.querySelector('.monthly-info');
            if (!fpElement || !totalElement) {
                console.error(`Could not find fp-value or total-value in ${wrapperId}`);
                alert(`Error: Could not find value elements in ${wrapperId}`);
                return;
            }
            fpElement.textContent = `${nyFp.toLocaleString()} kr/månad`;
            totalElement.textContent = `${nyTotal.toLocaleString()} kr/månad`;
            if (infoElement) {
                infoElement.innerHTML = `* Vid ett uttag på ${dagarPerVecka} föräldradagar/vecka<br>${
                    avtal ? '** Utbetalning av föräldralön regleras i ditt kollektivavtal' : ''
                }`;
            }
            console.log(`Successfully updated ${wrapperId}: Föräldrapenning=${nyFp}, Total=${nyTotal}`);
        }

        function updateTotalTotal() {
            const days1 = parseInt(document.getElementById('uttags-dagar-1')?.value) || 7;
            const days2 = parseInt(document.getElementById('uttags-dagar-2')?.value) || 7;
            const totalBox = document.getElementById('total-total-box');
            if (!totalBox) {
                console.warn('Total-total-box not found');
                return;
            }
            const fp1 = Math.round((dag1 * days1 * 4.3) / 100) * 100;
            const fp2 = vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0
                ? Math.round((dag2 * days2 * 4.3) / 100) * 100
                : 0;
            console.log(`updateTotalTotal: days1=${days1}, fp1=${fp1}, days2=${days2}, fp2=${fp2}`);
            const daysSelected1 = totalBox.querySelector('.days-selected-1');
            const daysSelected2 = totalBox.querySelector('.days-selected-2');
            if (daysSelected1) daysSelected1.textContent = days1;
            if (daysSelected2) daysSelected2.textContent = days2;
            const sections = totalBox.querySelectorAll('.total-section');
            const fpValue1 = sections[0]?.querySelector('.fp-row .fp-value');
            if (fpValue1) {
                fpValue1.textContent = `${fp1.toLocaleString()} kr/månad`;
                console.log(`Updated Förälder 1 Föräldrapenning to ${fp1}`);
            } else {
                console.error('Could not find fp-value for Förälder 1 in total-total-box');
            }
            const fpValue2 = sections[1]?.querySelector('.fp-row .fp-value');
            if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
                if (fpValue2) {
                    fpValue2.textContent = `${fp2.toLocaleString()} kr/månad`;
                    console.log(`Updated Förälder 2 Föräldrapenning to ${fp2}`);
                } else {
                    console.error('Could not find fp-value for Förälder 2 in total-total-box');
                }
            }
            const total1 = fp1 + (extra1 || 0) + (barnbidragPerPerson || 0) + (tillaggPerPerson || 0);
            const total2 = fp2 + (extra2 || 0) + (barnbidragPerPerson || 0) + (tillaggPerPerson || 0);
            const grandTotal = total1 + (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0 ? total2 : 0);
            const totalValue = totalBox.querySelector('.monthly-total .total-value');
            if (totalValue) {
                totalValue.textContent = `${grandTotal.toLocaleString()} kr/månad`;
                console.log(`Updated Grand Total to ${grandTotal}`);
            } else {
                console.error('Could not find total-value in total-total-box');
            }
        }

        const uttagDagar1 = document.getElementById('uttags-dagar-1');
        if (uttagDagar1) {
            console.log('Found uttags-dagar-1, attaching listener');
            uttagDagar1.replaceWith(uttagDagar1.cloneNode(true));
            const newUttagDagar1 = document.getElementById('uttags-dagar-1');
            newUttagDagar1.addEventListener('change', function (e) {
                const dagarPerVecka = parseInt(e.target.value) || 7;
                console.log(`Parent 1 dropdown changed to: ${dagarPerVecka}`);
                if (dag1 === undefined || dag1 <= 0) {
                    console.error('dag1 is undefined or invalid:', dag1);
                    alert('Error: Invalid daily rate for Parent 1');
                    return;
                }
                updateMonthlyBox(
                    'monthly-wrapper-1',
                    dagarPerVecka,
                    dag1,
                    extra1,
                    barnbidragPerPerson,
                    tillaggPerPerson,
                    document.getElementById('har-avtal-1')?.value === 'ja'
                );
                updateTotalTotal();
            });
        } else {
            console.warn('Dropdown uttags-dagar-1 not found');
        }

        const uttagDagar2 = document.getElementById('uttags-dagar-2');
        if (uttagDagar2) {
            console.log('Found uttags-dagar-2, attaching listener');
            uttagDagar2.replaceWith(uttagDagar2.cloneNode(true));
            const newUttagDagar2 = document.getElementById('uttags-dagar-2');
            newUttagDagar2.addEventListener('change', function (e) {
                const dagarPerVecka = parseInt(e.target.value) || 7;
                console.log(`Parent 2 dropdown changed to: ${dagarPerVecka}`);
                if (dag2 === undefined || dag2 <= 0) {
                    console.error('dag2 is undefined or invalid:', dag2);
                    alert('Error: Invalid daily rate for Parent 2');
                    return;
                }
                updateMonthlyBox(
                    'monthly-wrapper-2',
                    dagarPerVecka,
                    dag2,
                    extra2,
                    barnbidragPerPerson,
                    tillaggPerPerson,
                    document.getElementById('har-avtal-2')?.value === 'ja'
                );
                updateTotalTotal();
            });
        } else {
            console.warn('Dropdown uttags-dagar-2 not found');
        }

        updateTotalTotal();
    }
});

function beraknaBarnbidrag(totalBarn, ensamVardnad) {
    const bidragPerBarn = 1250;
    const flerbarnstillägg = {
        2: 150,
        3: 730,
        4: 1740,
        5: 2990,
        6: 4240
    };
    let barnbidrag = bidragPerBarn * totalBarn;
    let tillagg = flerbarnstillägg[totalBarn] || 0;
    const total = barnbidrag + tillagg;
    const details = `${totalBarn} barn ger ${barnbidrag.toLocaleString()} kr barnbidrag${tillagg ? " + " + tillagg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return {
        barnbidrag: Math.round(barnbidrag),
        tillagg: Math.round(tillagg),
        total: Math.round(total),
        details
    };
}