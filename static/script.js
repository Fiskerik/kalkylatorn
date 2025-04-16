let vårdnad = "gemensam";
let beräknaPartner = "ja";
let barnbidragPerPerson = 0;
let tilläggPerPerson = 0;
let förälder1InkomstDagar = vårdnad === "ensam" ? 390 : 195;
let förälder2InkomstDagar = vårdnad === "ensam" ? 0 : 195;
let förälder1MinDagar = vårdnad === "ensam" ? 90 : 45;
let förälder2MinDagar = vårdnad === "ensam" ? 0 : 45;
let förälder1IckeÖverförbaraDagar = vårdnad === "ensam" ? 0 : 90;
let förälder2IckeÖverförbaraDagar = vårdnad === "ensam" ? 0 : 90;
// State for mandatory barn selections
let barnIdag = 0; // Initialize to 0 instead of null
let barnPlanerat = 0; // Initialize to 0 instead of null
let hasCalculated = false; // Track if the first calculation has been performed

function beräknaMånadsinkomst(dag, dagarPerVecka, extra, barnbidrag = 625, tillägg = 0) {
    const fp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
    const resultat = fp + (extra || 0) + barnbidrag + tillägg;
    console.log("beräknaMånadsinkomst:", { dag, dagarPerVecka, extra, barnbidrag, tillägg, fp, resultat });
    return resultat || 0;
}

function beräknaDaglig(inkomst) {
    if (!inkomst || inkomst <= 0) return 0;
    const sgi = Math.min(inkomst, 49000);
    return Math.round((sgi * 0.8 * 12) / 365);
}

const defaultPreferences = {
    deltid: "nej",
    ledigTid1: 6,
    minInkomst: 10000,
    strategy: "longer"
};

function updateProgress(stepNumber) {
    const steps = document.querySelectorAll('#progress-bar .step');
    steps.forEach((step, index) => {
        step.classList.remove('active', 'completed');
        if (index < stepNumber - 1) step.classList.add('completed');
        else if (index === stepNumber - 1) step.classList.add('active');
    });
}

function setupToggleButtons(groupId, inputId, callback = null) {
    const group = document.querySelectorAll(`#${groupId} .toggle-btn`);
    const input = document.getElementById(inputId);
    group.forEach(button => {
        button.addEventListener('click', () => {
            group.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            input.value = button.dataset.value;
            if (groupId === 'barn-tidigare-group') barnIdag = parseInt(button.dataset.value);
            if (groupId === 'barn-planerade-group') barnPlanerat = parseInt(button.dataset.value);
            if (callback) callback(button.dataset.value);
        });
    });
}

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

function genereraTabell(dailyRate, dagar, extra = 0, barnbidrag = 0, tillägg = 0) {
    let rows = '';
    for (let i = 1; i <= 7; i++) {
        const månadsersättning = Math.round((dailyRate * i * 4.3) / 100) * 100;
        const totalDisponibelt = månadsersättning + barnbidrag + tillägg + extra;
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

function generateParentSection(parentNum, dag, extra, månadsinkomst, dagar, avtal, barnbidrag, tillägg, ärEnsam) {
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
                    ${ärEnsam ? '' : gemensamDetails}
                </div>
                <div class="benefit-card">
                    <div class="benefit-title">Föräldradagar på lägstanivå</div>
                    <div class="benefit-value-large">
                        <span>90</span><span class="unit">dagar</span>
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
                        <span class="fp-value">${månadsinkomst.toLocaleString()} kr/månad</span>
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
                        <span class="total-value">${(månadsinkomst + extra + barnbidrag + tillägg).toLocaleString()} kr/månad</span>
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

function beräknaBarnbidragHelper(totalBarn) {
    const bidragPerBarn = 1250;
    return bidragPerBarn * totalBarn;
}

function beräknaFlerbarnstillägg(totalBarn) {
    const flerbarnstillägg = { 2: 150, 3: 730, 4: 1740, 5: 2990, 6: 4240 };
    return flerbarnstillägg[totalBarn] || 0;
}

function beräknaBarnbidrag(totalBarn, ensamVårdnad) {
    const bidragPerBarn = 1250;
    const flerbarnstillägg = { 2: 150, 3: 730, 4: 1740, 5: 2990, 6: 4240 };
    const barnbidrag = bidragPerBarn * totalBarn;
    const tillägg = flerbarnstillägg[totalBarn] || 0;
    const total = barnbidrag + tillägg;
    const details = `${totalBarn} barn ger ${barnbidrag.toLocaleString()} kr barnbidrag${tillägg ? " + " + tillägg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return { barnbidrag: ensamVårdnad ? barnbidrag : Math.round(barnbidrag / 2), tillägg: ensamVårdnad ? tillägg : Math.round(tillägg / 2), total: ensamVårdnad ? total : Math.round(total / 2), details };
}

function setupDropdownListeners() {
    function updateMonthlyBox(wrapperId, dagarPerVecka, dag, extra, barnbidrag, tillägg, avtal, dagar) {
        const wrapper = document.getElementById(wrapperId) || document.getElementById(wrapperId.replace('monthly-wrapper', 'uttags-dagar'))?.closest('.monthly-wrapper');
        if (!wrapper) return console.error(`Kunde inte hitta wrapper ${wrapperId}`);
        
        const monthlyBox = wrapper.querySelector('.monthly-box');
        if (!monthlyBox) return console.error(`monthly-box hittades inte i ${wrapperId}`);
        
        const nyFp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
        const justeradExtra = avtal ? extra : 0;
        const nyTotal = nyFp + justeradExtra + (barnbidrag || 0) + (tillägg || 0);
        
        const fpElement = monthlyBox.querySelector('.fp-row .fp-value');
        const extraElement = monthlyBox.querySelector('.extra-row .extra-value');
        const totalElement = monthlyBox.querySelector('.monthly-total .total-value');
        const infoElement = monthlyBox.querySelector('.monthly-info');
        
        if (fpElement && totalElement) {
            fpElement.textContent = `${nyFp.toLocaleString()} kr/månad`;
            if (extraElement) {
                extraElement.textContent = `${justeradExtra.toLocaleString()} kr/månad`;
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

    function updateTotalTotal() {
        console.log("updateTotalTotal - dag1:", dag1, "dag2:", dag2, "inkomst1:", inkomst1, "inkomst2:", inkomst2, "vårdnad:", vårdnad, "beräknaPartner:", beräknaPartner);
        
        // Ensure global variables are updated
        inkomst1 = parseFloat(document.getElementById('inkomst1')?.value) || 0;
        inkomst2 = parseFloat(document.getElementById('inkomst2')?.value) || 35000; // Default to 35000
        vårdnad = document.getElementById('vårdnad')?.value || "gemensam";
        beräknaPartner = document.getElementById('beräkna-partner')?.value || "ja";
        deltid = document.getElementById('deltid')?.value || "nej";
        ledigTid1 = parseFloat(document.getElementById('ledig-tid-1')?.value) || 6;
        ledigTid2 = parseFloat(document.getElementById('ledig-tid-2')?.value) || 0;
        minInkomst = parseInt(document.getElementById('min-inkomst')?.value) || 10000;
        strategy = document.getElementById('strategy')?.value || "longer";
        barnDatum = document.getElementById('barn-datum')?.value || "2025-05-01";
        avtal1 = document.getElementById('har-avtal-1')?.value || "nej";
        avtal2 = document.getElementById('har-avtal-2')?.value || "nej";
    
        const preferences = {
            deltid: deltid,
            ledigTid1: Number(ledigTid1),
            ledigTid2: Number(ledigTid2) || 0,
            minInkomst: Number(minInkomst),
            strategy: strategy
        };
        
        const inputs = {
            inkomst1: Number(inkomst1),
            inkomst2: Number(inkomst2),
            avtal1: avtal1 === "ja",
            avtal2: avtal2 === "ja",
            vårdnad: vårdnad,
            beräknaPartner: beräknaPartner,
            barnbidragPerPerson: barnbidragPerPerson || 1250,
            tilläggPerPerson: tilläggPerPerson || 75,
            barnDatum: barnDatum
        };
        
        const result = optimizeParentalLeave(preferences, inputs);
        fp1 = result.plan1.inkomst;
        fp2 = result.plan2.inkomst;
        justeradExtra1 = result.extra1;
        justeradExtra2 = result.extra2;
        
        console.log("updateTotalTotal - fp1:", fp1, "fp2:", fp2, "justeradExtra1:", justeradExtra1, "justeradExtra2:", justeradExtra2);
        
        renderGanttChart(
            result.plan1,
            result.plan2,
            result.plan1NoExtra,
            result.plan2NoExtra,
            result.plan1MinDagar,
            result.plan2MinDagar,
            result.plan1Overlap,
            inputs.inkomst1,
            inputs.inkomst2,
            inputs.vårdnad,
            inputs.beräknaPartner,
            result.genomförbarhet,
            result.dag1,
            result.extra1,
            result.dag2,
            result.extra2,
            result.förälder1InkomstDagar,
            result.förälder2InkomstDagar,
            result.förälder1MinDagar,
            result.förälder2MinDagar,
            inputs.barnDatum,
            result.arbetsInkomst1,
            result.arbetsInkomst2
        );
    }

    [1, 2].forEach(num => {
        const uttagDagar = document.getElementById(`uttags-dagar-${num}`);
        if (uttagDagar) {
            uttagDagar.replaceWith(uttagDagar.cloneNode(true));
            const newUttagDagar = document.getElementById(`uttags-dagar-${num}`);
            newUttagDagar.addEventListener('change', (e) => {
                const dagarPerVecka = parseInt(e.target.value) || 7;
                const dag = num === 1 ? window.dag1 : window.dag2;
                const extra = num === 1 ? window.extra1 : window.extra2;
                const avtal = num === 1 ? document.getElementById('har-avtal-1')?.value === 'ja' : document.getElementById('har-avtal-2')?.value === 'ja';
                const dagar = vårdnad === "ensam" ? 390 : 195;
                const inkomst1 = parseFloat(document.getElementById('inkomst1')?.value) || 0;
                const inkomst2 = parseFloat(document.getElementById('inkomst2')?.value) || 0;
                const barnbidrag = barnbidragPerPerson;
                const tillägg = tilläggPerPerson;

                if (dag > 0) {
                    updateMonthlyBox(`monthly-wrapper-${num}`, dagarPerVecka, dag, extra, barnbidrag, tillägg, avtal, dagar);
                    updateTotalTotal(window.dag1, window.dag2, window.extra1, window.extra2, inkomst1, inkomst2, barnbidrag, tillägg);
                }
            });
    
            const initialDagarPerVecka = parseInt(newUttagDagar.value) || 7;
            const dag = num === 1 ? window.dag1 : window.dag2;
            const extra = num === 1 ? window.extra1 : window.extra2;
            const avtal = num === 1 ? document.getElementById('har-avtal-1')?.value === 'ja' : document.getElementById('har-avtal-2')?.value === 'ja';
            const dagar = vårdnad === "ensam" ? 390 : 195;
            const inkomst1 = parseFloat(document.getElementById('inkomst1')?.value) || 0;
            const inkomst2 = parseFloat(document.getElementById('inkomst2')?.value) || 0;
            const barnbidrag = barnbidragPerPerson;
            const tillägg = tilläggPerPerson;
            if (dag > 0) {
                updateMonthlyBox(`monthly-wrapper-${num}`, initialDagarPerVecka, dag, extra, barnbidrag, tillägg, avtal, dagar);
                updateTotalTotal(window.dag1, window.dag2, window.extra1, window.extra2, inkomst1, inkomst2, barnbidrag, tillägg);
            }
        }
    });
}

function validateLeaveDuration(ledigTid, dagarPerVecka, availableInkomstDagar, availableMinDagar, parentLabel) {
    const totalDagarBehövda = Math.ceil(ledigTid * 4.3 * dagarPerVecka);
    const totalAvailableDagar = availableInkomstDagar + availableMinDagar;
    if (totalDagarBehövda > totalAvailableDagar) {
        const maxVeckor = totalAvailableDagar / dagarPerVecka;
        const maxMånader = maxVeckor / 4.3;
        return {
            isValid: false,
            maxMånader: maxMånader.toFixed(1),
            message: `För ${parentLabel}: Begärd ledighet (${ledigTid} månader med ${dagarPerVecka} dagar/vecka) överskrider tillgängliga dagar (${totalAvailableDagar} dagar). Max ${maxMånader.toFixed(1)} månader är möjligt.`
        };
    }
    return { isValid: true };
}

function optimizeParentalLeave(preferences, inputs) {
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst, strategy } = preferences;
    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1Overlap = { startWeek: 2, weeks: 2, dagarPerVecka: 0, inkomst: 0 };
    let genomförbarhet = { ärGenomförbar: true, meddelande: "", transferredDays: 0 };

    const barnbidrag = inputs.barnbidragPerPerson || 1250;
    const tillägg = inputs.tilläggPerPerson || 75;

    // Ensure inputs.inkomst1 and inputs.inkomst2 are numbers
    const inkomst1 = Number(inputs.inkomst1) || 0;
    const inkomst2 = Number(inputs.inkomst2) || 0;

    const dag1 = beräknaDaglig(inkomst1); // Should be 237 for inkomst1 = 9000
    const extra1 = inputs.avtal1 ? (inkomst1 <= 49000 ? Math.round(inkomst1 * 0.10) : 4900) : 0;
    const dag2 = inkomst2 > 0 ? beräknaDaglig(inkomst2) : 0; // Should be 921 for inkomst2 = 35000
    const extra2 = inputs.avtal2 ? (inkomst2 <= 49000 ? Math.round(inkomst2 * 0.10) : 4900) : 0;

    let förälder1InkomstDagar = inputs.vårdnad === "ensam" ? 390 : 195;
    let förälder2InkomstDagar = inputs.vårdnad === "ensam" ? 0 : 195;
    let förälder1MinDagar = inputs.vårdnad === "ensam" ? 90 : 45;
    let förälder2MinDagar = inputs.vårdnad === "ensam" ? 0 : 45;
    let totalaInkomstDagarAnvända = 0;
    let användaInkomstDagar1 = 0;
    let användaInkomstDagar2 = 0;
    let användaMinDagar1 = 0;
    let användaMinDagar2 = 0;

    const arbetsInkomst1 = inkomst1 + barnbidrag + tillägg;
    const arbetsInkomst2 = inkomst2 > 0 ? inkomst2 + barnbidrag + tillägg : 0;

    let dagarPerVecka1 = 0;
    let dagarPerVecka2 = 0;
    let weeks1 = Math.round(ledigTid1 * 4.3);
    let weeks2 = Math.round(ledigTid2 * 4.3);
    let inkomst1Result = arbetsInkomst1;
    let inkomst2Result = arbetsInkomst2;
    let kombineradInkomst = 0;

    if (weeks1 > 0) {
        dagarPerVecka1 = strategy === "maximize" ? Math.min(deltid === "ja" ? 5 : 7, Math.floor(förälder1InkomstDagar / weeks1) || 1) : 1;
        const validation1 = validateLeaveDuration(weeks1 / 4.3, dagarPerVecka1, förälder1InkomstDagar + förälder1MinDagar, 0, "Förälder 1");
        if (!validation1.isValid) {
            throw new Error(validation1.message);
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        dagarPerVecka2 = strategy === "maximize" ? Math.min(deltid === "ja" ? 5 : 7, Math.floor(förälder2InkomstDagar / weeks2) || 1) : 1;
        const validation2 = validateLeaveDuration(weeks2 / 4.3, dagarPerVecka2, förälder2InkomstDagar + förälder2MinDagar, 0, "Förälder 2");
        if (!validation2.isValid) {
            throw new Error(validation2.message);
        }
    }

    if (strategy === "longer") {
        inkomst2Result = arbetsInkomst2;
        const målInkomst = minInkomst - inkomst2Result;
        if (målInkomst > 0) {
            dagarPerVecka1 = 1;
            inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
            while (inkomst1Result < målInkomst && dagarPerVecka1 < (deltid === "ja" ? 5 : 7)) {
                dagarPerVecka1++;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
            }
        } else {
            dagarPerVecka1 = 1;
            inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
        }
        kombineradInkomst = inkomst1Result + inkomst2Result;
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            genomförbarhet.meddelande = `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad. `;
        }
        weeks1 = Math.round(ledigTid1 * 4.3);
    } else {
        const överförDagar = Math.min(105, förälder2InkomstDagar - förälder2IckeÖverförbaraDagar);
        förälder2InkomstDagar -= överförDagar;
        förälder1InkomstDagar += överförDagar;
        genomförbarhet.transferredDays = överförDagar;

        dagarPerVecka1 = Math.min(deltid === "ja" ? 5 : 7, Math.floor(förälder1InkomstDagar / weeks1) || 1);
        inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
        inkomst2Result = arbetsInkomst2;
        kombineradInkomst = inkomst1Result + inkomst2Result;
        weeks1 = Math.round(ledigTid1 * 4.3);
    }

    let minDagarWeeks1 = 0;
    let weeks1NoExtra = 0;
    if (dagarPerVecka1 > 0) {
        const dagarBehövda1 = weeks1 * dagarPerVecka1;
        const maxFöräldralönWeeks = 6 * 4.3;

        if (weeks1 > maxFöräldralönWeeks) {
            weeks1NoExtra = weeks1 - maxFöräldralönWeeks;
            weeks1 = maxFöräldralönWeeks;
        }

        if (dagarBehövda1 <= förälder1InkomstDagar) {
            användaInkomstDagar1 = dagarBehövda1;
            förälder1InkomstDagar -= användaInkomstDagar1;
        } else {
            användaInkomstDagar1 = förälder1InkomstDagar;
            förälder1InkomstDagar = 0;
            let bristDagar1 = dagarBehövda1 - användaInkomstDagar1;
            if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
                const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - förälder2IckeÖverförbaraDagar);
                const överförDagar1 = Math.min(överförbaraDagar2, bristDagar1);
                användaInkomstDagar1 += överförDagar1;
                förälder2InkomstDagar -= överförDagar1;
                bristDagar1 -= överförDagar1;
                if (överförDagar1 > 0 && strategy !== "maximize") {
                    genomförbarhet.transferredDays += överförDagar1;
                }
            }
            if (bristDagar1 > 0) {
                användaMinDagar1 = Math.min(förälder1MinDagar, bristDagar1);
                förälder1MinDagar -= användaMinDagar1;
                minDagarWeeks1 = (användaMinDagar1 / dagarPerVecka1);
                const minInkomst1 = beräknaMånadsinkomst(180, dagarPerVecka1, 0, barnbidrag, tillägg);
                plan1MinDagar = {
                    startWeek: weeks1 + weeks1NoExtra,
                    weeks: minDagarWeeks1,
                    dagarPerVecka: dagarPerVecka1,
                    inkomst: Math.round(minInkomst1)
                };
                weeks1 -= minDagarWeeks1;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
            }
        }
        totalaInkomstDagarAnvända += användaInkomstDagar1;

        plan1 = {
            startWeek: 0,
            weeks: weeks1,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar1,
            användaMinDagar: 0
        };
        if (weeks1NoExtra > 0) {
            plan1NoExtra = {
                startWeek: weeks1,
                weeks: weeks1NoExtra,
                dagarPerVecka: dagarPerVecka1,
                inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg))
            };
        }

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            plan1Overlap = {
                startWeek: 2,
                weeks: 2,
                dagarPerVecka: dagarPerVecka1,
                inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg))
            };
        }
    }

    let minDagarWeeks2 = 0;
    let weeks2NoExtra = 0;
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        inkomst1Result = arbetsInkomst1;
        if (strategy === "longer") {
            const målInkomst = Math.max(0, minInkomst - inkomst1Result);
            dagarPerVecka2 = 1;
            inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
            if (målInkomst > 0) {
                while (inkomst2Result < målInkomst && dagarPerVecka2 < (deltid === "ja" ? 5 : 7)) {
                    dagarPerVecka2++;
                    inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
                }
            }
            kombineradInkomst = inkomst1Result + inkomst2Result;
            if (kombineradInkomst < minInkomst) {
                genomförbarhet.ärGenomförbar = false;
                genomförbarhet.meddelande = `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad. `;
            }
        } else {
            dagarPerVecka2 = Math.min(deltid === "ja" ? 5 : 7, Math.floor(förälder2InkomstDagar / weeks2) || 1);
            inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
            kombineradInkomst = inkomst1Result + inkomst2Result;
        }
        weeks2 = Math.round(ledigTid2 * 4.3);

        const dagarBehövda2 = weeks2 * dagarPerVecka2;
        const maxFöräldralönWeeks = 6 * 4.3;

        if (weeks2 > maxFöräldralönWeeks) {
            weeks2NoExtra = weeks2 - maxFöräldralönWeeks;
            weeks2 = maxFöräldralönWeeks;
        }

        if (dagarBehövda2 <= förälder2InkomstDagar) {
            användaInkomstDagar2 = dagarBehövda2;
            förälder2InkomstDagar -= användaInkomstDagar2;
        } else {
            användaInkomstDagar2 = förälder2InkomstDagar;
            förälder2InkomstDagar = 0;
            let bristDagar2 = dagarBehövda2 - användaInkomstDagar2;
            const överförbaraDagar1 = Math.max(0, förälder1InkomstDagar - förälder1IckeÖverförbaraDagar);
            const överförDagar2 = Math.min(överförbaraDagar1, bristDagar2);
            användaInkomstDagar2 += överförDagar2;
            förälder1InkomstDagar -= överförDagar2;
            bristDagar2 -= överförDagar2;
            if (överförDagar2 > 0) {
                genomförbarhet.transferredDays += överförDagar2;
            }
            if (bristDagar2 > 0) {
                användaMinDagar2 = Math.min(förälder2MinDagar, bristDagar2);
                förälder2MinDagar -= användaMinDagar2;
                minDagarWeeks2 = (användaMinDagar2 / dagarPerVecka2);
                const minInkomst2 = beräknaMånadsinkomst(180, dagarPerVecka2, 0, barnbidrag, tillägg);
                plan2MinDagar = {
                    startWeek: weeks1 + weeks1NoExtra + minDagarWeeks1 + weeks2,
                    weeks: minDagarWeeks2,
                    dagarPerVecka: dagarPerVecka2,
                    inkomst: Math.round(minInkomst2)
                };
                weeks2 -= minDagarWeeks2;
                inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
            }
        }
        totalaInkomstDagarAnvända += användaInkomstDagar2;

        plan2 = {
            startWeek: weeks1 + weeks1NoExtra + minDagarWeeks1,
            weeks: weeks2,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: 0
        };
        if (weeks2NoExtra > 0) {
            plan2NoExtra = {
                startWeek: weeks1 + weeks1NoExtra + minDagarWeeks1 + weeks2,
                weeks: weeks2NoExtra,
                dagarPerVecka: dagarPerVecka2,
                inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg))
            };
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
        const overlapDays = 10;
        if (overlapDays <= förälder2InkomstDagar) {
            förälder2InkomstDagar -= overlapDays;
        } else {
            const remainingOverlapDays = overlapDays - förälder2InkomstDagar;
            förälder2InkomstDagar = 0;
            förälder2MinDagar = Math.max(0, förälder2MinDagar - remainingOverlapDays);
        }
    }

    if (kombineradInkomst < minInkomst && (dagarPerVecka1 > 0 || dagarPerVecka2 > 0)) {
        genomförbarhet.ärGenomförbar = false;
        genomförbarhet.meddelande = `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad är under kravet ${minInkomst.toLocaleString()} kr/månad. `;
    }

    return {
        plan1,
        plan1NoExtra,
        plan2,
        plan2NoExtra,
        plan1MinDagar,
        plan2MinDagar,
        plan1Overlap,
        genomförbarhet,
        dag1,
        extra1,
        dag2,
        extra2,
        förälder1InkomstDagar,
        förälder2InkomstDagar,
        förälder1MinDagar,
        förälder2MinDagar,
        arbetsInkomst1,
        arbetsInkomst2
    };
}

function renderGanttChart(plan1, plan2, plan1NoExtra, plan2NoExtra, plan1MinDagar, plan2MinDagar, plan1Overlap, inkomst1, inkomst2, vårdnad, beräknaPartner, genomförbarhet, dag1, extra1, dag2, extra2, förälder1InkomstDagar, förälder2InkomstDagar, förälder1MinDagar, förälder2MinDagar, barnDatum, arbetsInkomst1, arbetsInkomst2) {
    const ganttChart = document.getElementById('gantt-chart');
    if (!ganttChart) {
        console.error("renderGanttChart - gantt-chart element hittades inte");
        return;
    }

    console.log("renderGanttChart - Inputs:", {
        inkomst1, inkomst2, vårdnad, beräknaPartner,
        arbetsInkomst1, arbetsInkomst2, dag1, dag2, extra1, extra2
    });

    ganttChart.innerHTML = '';
    const messageDiv = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.id = 'gantt-canvas';
    canvas.style.width = '100%';
    canvas.style.maxWidth = '800px';
    canvas.style.height = '400px';

    const period1Weeks = plan1.weeks || 0;
    const period1NoExtraWeeks = plan1NoExtra.weeks || 0;
    const period1MinWeeks = plan1MinDagar.weeks || 0;
    const period2Weeks = plan2.weeks || 0;
    const period2NoExtraWeeks = plan2NoExtra.weeks || 0;
    const period2MinWeeks = plan2MinDagar.weeks || 0;
    const period1OverlapWeeks = plan1Overlap.weeks || 0;

    const startDate = barnDatum ? new Date(barnDatum) : new Date();
    if (isNaN(startDate.getTime())) {
        console.warn("Invalid date provided, using current date:", barnDatum);
        startDate.setTime(new Date().getTime());
    }
    const chartStartDate = new Date(startDate)-14; // Start on birth date (2025-05-01)
    const dadLeaveStartDate = new Date(startDate);
    dadLeaveStartDate.setDate(dadLeaveStartDate.getDate() + 14);
    const dadLeaveDurationDays = 10;
    const dadLeaveDurationWeeks = 2;
    const dadLeaveStartWeek = 0; // Start at week 2 (2 weeks after birth)

    const totalaWeeks = Math.max(period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks + (beräknaPartner === "ja" ? dadLeaveDurationWeeks : 0), 60);

    const weekLabels = [];
    const date = new Date(chartStartDate);
    for (let i = 0; i < totalaWeeks; i++) {
        const weekStart = new Date(date);
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const label = `${weekStart.toLocaleString('sv-SE', { day: 'numeric', month: 'short' })} - ${weekEnd.toLocaleString('sv-SE', { day: 'numeric', month: 'short' })}`;
        weekLabels.push(label);
        date.setDate(date.getDate() + 7);
    }

    const period1Förälder1Inkomst = plan1.inkomst || 0;
    const period1NoExtraFörälder1Inkomst = plan1NoExtra.inkomst || 0;
    const period1MinFörälder1Inkomst = plan1MinDagar.inkomst || 0;
    const period1OverlapFörälder1Inkomst = plan1Overlap.inkomst || 0;
    const period1Förälder2Inkomst = arbetsInkomst2 || 0;
    const period1Kombinerad = period1Förälder1Inkomst + period1Förälder2Inkomst;

    const period2Förälder1Inkomst = arbetsInkomst1 || 0;
    const period2Förälder2Inkomst = plan2.inkomst || 0;
    const period2NoExtraFörälder2Inkomst = plan2NoExtra.inkomst || 0;
    const period2MinFörälder2Inkomst = plan2MinDagar.inkomst || 0;
    const period2Kombinerad = period2Förälder1Inkomst + period2Förälder2Inkomst;

    const dadLeaveFörälder2Inkomst = dag2 > 0 ? beräknaMånadsinkomst(dag2, 5, extra2, barnbidragPerPerson, tilläggPerPerson) : 0;
    const dadLeaveFörälder1Inkomst = period1OverlapFörälder1Inkomst;
    const dadLeaveKombinerad = dadLeaveFörälder1Inkomst + dadLeaveFörälder2Inkomst;

    const roundedPeriod1Weeks = Math.round(period1Weeks);
    const roundedPeriod1NoExtraWeeks = Math.round(period1NoExtraWeeks);
    const roundedPeriod1MinWeeks = Math.round(period1MinWeeks);
    const roundedPeriod2Weeks = Math.round(period2Weeks);
    const roundedPeriod2NoExtraWeeks = Math.round(period2NoExtraWeeks);
    const roundedPeriod2MinWeeks = Math.round(period2MinWeeks);

    let meddelandeHtml = `
        <div class="feasibility-message" style="background-color: ${genomförbarhet.ärGenomförbar ? '#e6ffe6' : '#ffcccc'}; border: 1px solid ${genomförbarhet.ärGenomförbar ? '#00cc00' : '#ff0000'}; padding: 15px; margin-bottom: 15px; font-family: Inter, sans-serif;">
            <strong style="font-size: 1.2em;">${genomförbarhet.ärGenomförbar ? 'Planen är genomförbar' : 'Varning: Planen är inte fullt genomförbar'}</strong><br><br>
    `;

    if (genomförbarhet.transferredDays > 0 && genomförbarhet.ärGenomförbar) {
        meddelandeHtml += `
            <span style="color: #f28c38;">Överförde ${genomförbarhet.transferredDays} inkomstbaserade dagar från Förälder 2 till Förälder 1 för att maximera inkomst.</span><br><br>
        `;
    }

    if (vårdnad === "ensam" || beräknaPartner !== "ja") {
        meddelandeHtml += `
            <strong>Förälder 1 ledig</strong><br>
            Förälder 1: ${(period1Weeks / 4.3).toFixed(1)} månader (~${roundedPeriod1Weeks} veckor), ${plan1.dagarPerVecka} dagar/vecka, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad.<br>
            ${period1NoExtraWeeks > 0 ? `Förälder 1 (Utan Föräldralön): ${(period1NoExtraWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod1NoExtraWeeks} veckor), ${plan1NoExtra.dagarPerVecka} dagar/vecka, inkomst ${period1NoExtraFörälder1Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            ${period1MinWeeks > 0 ? `Förälder 1 (Lägstanivådagar): ${(period1MinWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod1MinWeeks} veckor), ${plan1MinDagar.dagarPerVecka} dagar/vecka, inkomst ${period1MinFörälder1Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            <br>
        `;
    } else {
        meddelandeHtml += `
            <strong>10 dagar efter barns födsel</strong><br>
            Startar 2 veckor efter födsel: ${dadLeaveDurationDays} dagar (${dadLeaveDurationWeeks} veckor)<br>
            Förälder 1: Inkomst ${dadLeaveFörälder1Inkomst.toLocaleString()} kr/månad.<br>
            Förälder 2: Inkomst ${dadLeaveFörälder2Inkomst.toLocaleString()} kr/månad.<br>
            <strong>Kombinerad inkomst: ${dadLeaveKombinerad.toLocaleString()} kr/månad</strong><br><br>

            <strong>Period 1 (Förälder 1 ledig, Förälder 2 jobbar)</strong><br>
            Förälder 1: ${(period1Weeks / 4.3).toFixed(1)} månader (~${roundedPeriod1Weeks} veckor), ${plan1.dagarPerVecka} dagar/vecka, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad.<br>
            ${period1NoExtraWeeks > 0 ? `Förälder 1 (Utan Föräldralön): ${(period1NoExtraWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod1NoExtraWeeks} veckor), ${plan1NoExtra.dagarPerVecka} dagar/vecka, inkomst ${period1NoExtraFörälder1Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            Förälder 2: Inkomst ${period1Förälder2Inkomst.toLocaleString()} kr/månad.<br>
            <strong>Kombinerad inkomst: ${period1Kombinerad.toLocaleString()} kr/månad</strong><br>
            ${period1MinWeeks > 0 ? `Förälder 1 (Lägstanivådagar): ${(period1MinWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod1MinWeeks} veckor), ${plan1MinDagar.dagarPerVecka} dagar/vecka, inkomst ${period1MinFörälder1Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            <br>
            
            <strong>Period 2 (Förälder 1 jobbar, Förälder 2 ledig)</strong><br>
            Förälder 1: Inkomst ${period2Förälder1Inkomst.toLocaleString()} kr/månad.<br>
            Förälder 2: ${(period2Weeks / 4.3).toFixed(1)} månader (~${roundedPeriod2Weeks} veckor), ${plan2.dagarPerVecka} dagar/vecka, inkomst ${period2Förälder2Inkomst.toLocaleString()} kr/månad.<br>
            ${period2NoExtraWeeks > 0 ? `Förälder 2 (Utan Föräldralön): ${(period2NoExtraWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod2NoExtraWeeks} veckor), ${plan2NoExtra.dagarPerVecka} dagar/vecka, inkomst ${period2NoExtraFörälder2Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            <strong>Kombinerad inkomst: ${period2Kombinerad.toLocaleString()} kr/månad</strong><br>
            ${period2MinWeeks > 0 ? `Förälder 2 (Lägstanivådagar): ${(period2MinWeeks / 4.3).toFixed(1)} månader (~${roundedPeriod2MinWeeks} veckor), ${plan2MinDagar.dagarPerVecka} dagar/vecka, inkomst ${period2MinFörälder2Inkomst.toLocaleString()} kr/månad.<br>` : ''}
            <br>
        `;
    }

    meddelandeHtml += `
        <strong>Återstående dagar:</strong><br>
        Förälder 1: ${förälder1InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder1MinDagar.toLocaleString()} dagar (lägstanivå)<br>
        ${vårdnad === "ensam" ? '' : `Förälder 2: ${förälder2InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder2MinDagar.toLocaleString()} dagar (lägstanivå)`}
        </div>
    `;

    messageDiv.innerHTML = meddelandeHtml;
    ganttChart.appendChild(messageDiv);
    ganttChart.appendChild(canvas);

    const transferredWeeks = genomförbarhet.transferredDays > 0 ? Math.ceil(genomförbarhet.transferredDays / (plan1.dagarPerVecka)) : 0;
    const förälder1OwnWeeks = period1Weeks > 0 ? Math.max(0, period1Weeks - transferredWeeks) : 0;

    const inkomstData = [];
    for (let week = 0; week < totalaWeeks; week++) {
        let kombineradInkomst = 0;
        let förälder1Inkomst = 0;
        let förälder2Inkomst = 0;
        let periodLabel = '';

        console.log(`Week ${week} - Overlap Condition:`, {
            beräknaPartner,
            week,
            dadLeaveStartWeek,
            dadLeaveDurationWeeks,
            vårdnad,
            condition: beräknaPartner === "ja" && week >= dadLeaveStartWeek && week < dadLeaveStartWeek + dadLeaveDurationWeeks && vårdnad === "gemensam"
        });

        if (beräknaPartner === "ja" && week >= dadLeaveStartWeek && week < dadLeaveStartWeek + dadLeaveDurationWeeks && vårdnad === "gemensam") {
            förälder1Inkomst = dadLeaveFörälder1Inkomst;
            förälder2Inkomst = dadLeaveFörälder2Inkomst;
            periodLabel = 'Överlappande Ledighet';
        } else if (week < förälder1OwnWeeks) {
            förälder1Inkomst = period1Förälder1Inkomst;
            förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
            periodLabel = 'Förälder 1 Ledig';
        } else if (week < period1Weeks) {
            förälder1Inkomst = period1Förälder1Inkomst;
            förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
            periodLabel = 'Överförda Dagar';
        } else if (week < period1Weeks + period1NoExtraWeeks) {
            förälder1Inkomst = period1NoExtraFörälder1Inkomst;
            förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
            periodLabel = 'Förälder 1 (Utan Föräldralön)';
        } else if (week < period1Weeks + period1NoExtraWeeks + period1MinWeeks) {
            förälder1Inkomst = period1MinFörälder1Inkomst;
            förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
            periodLabel = 'Förälder 1 (Lägstanivådagar)';
        } else if (week < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks && vårdnad === "gemensam" && beräknaPartner === "ja") {
            förälder1Inkomst = arbetsInkomst1 || 0;
            förälder2Inkomst = period2Förälder2Inkomst;
            periodLabel = 'Förälder 2 Ledig';
        } else if (week < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks && vårdnad === "gemensam" && beräknaPartner === "ja") {
            förälder1Inkomst = arbetsInkomst1 || 0;
            förälder2Inkomst = period2NoExtraFörälder2Inkomst;
            periodLabel = 'Förälder 2 (Utan Föräldralön)';
        } else if (week < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks && vårdnad === "gemensam" && beräknaPartner === "ja") {
            förälder1Inkomst = arbetsInkomst1 || 0;
            förälder2Inkomst = period2MinFörälder2Inkomst;
            periodLabel = 'Förälder 2 (Lägstanivådagar)';
        } else {
            förälder1Inkomst = arbetsInkomst1 || 0;
            förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
            periodLabel = 'Efter Ledighet';
        }

        kombineradInkomst = förälder1Inkomst + förälder2Inkomst;
        inkomstData.push({ x: week, y: kombineradInkomst, förälder1Inkomst, förälder2Inkomst, periodLabel });
    }

    console.log("renderGanttChart - Income Data:", inkomstData);

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [
                {
                    label: 'Kombinerad Inkomst (kr/månad)',
                    data: inkomstData,
                    borderWidth: 2,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    segment: {
                        borderColor: ctx => {
                            const x = ctx.p0.parsed.x;
                            if (beräknaPartner === "ja" && x >= dadLeaveStartWeek && x < dadLeaveStartWeek + dadLeaveDurationWeeks) return '#800080';
                            if (x < förälder1OwnWeeks) return '#28a745';
                            if (x < period1Weeks) return '#f28c38';
                            if (x < period1Weeks + period1NoExtraWeeks) return '#2ecc71';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks) return '#808080';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks) return '#007bff';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks) return '#1e90ff';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks) return '#808080';
                            return 'red';
                        },
                        backgroundColor: ctx => {
                            const x = ctx.p0.parsed.x;
                            if (beräknaPartner === "ja" && x >= dadLeaveStartWeek && x < dadLeaveStartWeek + dadLeaveDurationWeeks) return '#800080';
                            if (x < förälder1OwnWeeks) return '#28a745';
                            if (x < period1Weeks) return '#f28c38';
                            if (x < period1Weeks + period1NoExtraWeeks) return '#2ecc71';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks) return '#808080';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks) return '#007bff';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks) return '#1e90ff';
                            if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks) return '#808080';
                            return 'red';
                        }
                    },
                    pointBackgroundColor: inkomstData.map(data => {
                        const x = data.x;
                        if (beräknaPartner === "ja" && x >= dadLeaveStartWeek && x < dadLeaveStartWeek + dadLeaveDurationWeeks) return '#800080';
                        if (x < förälder1OwnWeeks) return '#28a745';
                        if (x < period1Weeks) return '#f28c38';
                        if (x < period1Weeks + period1NoExtraWeeks) return '#2ecc71';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks) return '#808080';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks) return '#007bff';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks) return '#1e90ff';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks) return '#808080';
                        return 'red';
                    }),
                    pointBorderColor: inkomstData.map(data => {
                        const x = data.x;
                        if (beräknaPartner === "ja" && x >= dadLeaveStartWeek && x < dadLeaveStartWeek + dadLeaveDurationWeeks) return '#800080';
                        if (x < förälder1OwnWeeks) return '#28a745';
                        if (x < period1Weeks) return '#f28c38';
                        if (x < period1Weeks + period1NoExtraWeeks) return '#2ecc71';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks) return '#808080';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks) return '#007bff';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks) return '#1e90ff';
                        if (x < period1Weeks + period1NoExtraWeeks + period1MinWeeks + period2Weeks + period2NoExtraWeeks + period2MinWeeks) return '#808080';
                        return 'red';
                    })
                }
            ]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: totalaWeeks,
                    ticks: {
                        stepSize: 1,
                        callback: function(value) {
                            return weekLabels[value];
                        }
                    },
                    title: { display: true, text: 'Tid (Vecka)' }
                },
                y: {
                    position: 'right',
                    min: 0,
                    suggestedMax: Math.max(...inkomstData.map(d => d.y)) * 1.1,
                    title: { display: true, text: 'Inkomst (kr/månad)' },
                    grid: { drawOnChartArea: true },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kr';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        generateLabels: chart => [
                            { text: 'Förälder 1 Ledig', fillStyle: '#28a745', strokeStyle: '#28a745', hidden: false },
                            { text: 'Överförda Dagar', fillStyle: '#f28c38', strokeStyle: '#f28c38', hidden: false },
                            { text: 'Förälder 1 (Utan Föräldralön)', fillStyle: '#2ecc71', strokeStyle: '#2ecc71', hidden: false },
                            { text: 'Förälder 1 (Lägstanivådagar)', fillStyle: '#808080', strokeStyle: '#808080', hidden: false },
                            { text: 'Överlappande Ledighet', fillStyle: '#800080', strokeStyle: '#800080', hidden: false },
                            { text: 'Förälder 2 Ledig', fillStyle: '#007bff', strokeStyle: '#007bff', hidden: false },
                            { text: 'Förälder 2 (Utan Föräldralön)', fillStyle: '#1e90ff', strokeStyle: '#1e90ff', hidden: false },
                            { text: 'Förälder 2 (Lägstanivådagar)', fillStyle: '#808080', strokeStyle: '#808080', hidden: false },
                            { text: 'Efter Ledighet', fillStyle: 'red', strokeStyle: 'red', hidden: false }
                        ]
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            return weekLabels[context[0].dataIndex];
                        },
                        label: function(context) {
                            const data = inkomstData[context.dataIndex];
                            return [
                                `Period: ${data.periodLabel}`,
                                `Kombinerad: ${data.y.toLocaleString()} kr/månad`,
                                `Förälder 1: ${data.förälder1Inkomst.toLocaleString()} kr/månad`,
                                vårdnad === "ensam" ? '' : `Förälder 2: ${data.förälder2Inkomst.toLocaleString()} kr/månad`
                            ].filter(Boolean);
                        }
                    }
                }
            }
        }
    });
}

function setupStrategyToggle() {
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

document.addEventListener("DOMContentLoaded", function () {
    updateProgress(1);

    const elements = {
        vårdnadButtons: document.querySelectorAll('#vårdnad-group .toggle-btn'),
        vårdnadInput: document.getElementById('vårdnad'),
        vårdnadInfo: document.getElementById('vårdnad-info'),
        partnerQuestion: document.getElementById('partner-question'),
        partnerButtons: document.querySelectorAll('#partner-group .toggle-btn'),
        partnerInput: document.getElementById('beräkna-partner'),
        form: document.getElementById('calc-form'),
        resultBlock: document.getElementById('result-block'),
        inkomstBlock2: document.getElementById('inkomst-block-2'),
        avtalQuestion2: document.getElementById('avtal-question-2'),
        inkomst1: document.getElementById('inkomst1'),
        avtal1: document.getElementById('har-avtal-1'),
        inkomst2: document.getElementById('inkomst2'),
        avtal2: document.getElementById('har-avtal-2'),
        children: document.getElementById('barn-tidigare'),
        plannedChildren: document.getElementById('barn-planerade'),
        preferencesSection: document.getElementById('preferences-section'),
        deltid: document.getElementById('deltid'),
        ledigTid1: document.getElementById('ledig-tid-1'),
        ledigTid2: document.getElementById('ledig-tid-2'),
        minInkomst: document.getElementById('min-inkomst'),
        partnerLedigTid: document.getElementById('partner-ledig-tid'),
        optimizeBtn: document.getElementById('optimize-btn'),
        barnDatum: document.getElementById('barn-datum'),
        leaveDurationError: document.getElementById('leave-duration-error'),
        barnSelectionError: document.getElementById('barn-selection-error'),
        strategyGroup: document.getElementById('strategy-group'),
        optimizationResult: document.getElementById('optimization-result')
    };

    setupToggleButtons('barn-tidigare-group', 'barn-tidigare');
    setupToggleButtons('barn-planerade-group', 'barn-planerade');
    setupToggleButtons('avtal-group-1', 'har-avtal-1', () => updateProgress(6));
    setupToggleButtons('avtal-group-2', 'har-avtal-2', () => updateProgress(7));
    setupToggleButtons('deltid-group', 'deltid');
    setupStrategyToggle();

    function updatePartnerPreferencesVisibility() {
        if (vårdnad === "gemensam" && beräknaPartner === "ja") {
            elements.partnerLedigTid.style.display = "block";
        } else {
            elements.partnerLedigTid.style.display = "none";
        }
    }

    setupToggleButtons('vårdnad-group', 'vårdnad', (value) => {
        vårdnad = value;
        if (vårdnad === 'gemensam') {
            elements.vårdnadInfo.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
            elements.partnerQuestion.style.display = "block";
            updateProgress(2);
        } else {
            elements.vårdnadInfo.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
            elements.partnerQuestion.style.display = "none";
            elements.partnerInput.value = "";
            beräknaPartner = '';
            elements.inkomstBlock2.style.display = "none";
            elements.avtalQuestion2.style.display = "none";
            elements.partnerLedigTid.style.display = "none";
            updateProgress(3);
        }
        updatePartnerPreferencesVisibility();
    });

    setupToggleButtons('partner-group', 'beräkna-partner', (value) => {
        beräknaPartner = value;
        elements.inkomstBlock2.style.display = value === 'ja' ? "block" : "none";
        elements.avtalQuestion2.style.display = value === 'ja' ? "block" : "none";
        updatePartnerPreferencesVisibility();
        updateProgress(3);
    });

    document.getElementById('barn-tidigare-group').addEventListener('click', () => updateProgress(4));
    document.getElementById('barn-planerade-group').addEventListener('click', () => updateProgress(5));

    elements.inkomst1.addEventListener('input', () => {
        if (elements.inkomst1.value) updateProgress(6);
    });
    elements.inkomst2?.addEventListener('input', () => {
        if (elements.inkomst2.value) updateProgress(7);
    });

    elements.form.addEventListener("submit", function (event) {
        event.preventDefault();
    
        // Validate barnIdag and barnPlanerat on form submission
        if (barnIdag === 0 && barnPlanerat === 0) {
            elements.barnSelectionError.style.display = "block";
            return;
        } else {
            elements.barnSelectionError.style.display = "none";
        }
    
        const inputs = {
            vårdnad: elements.vårdnadInput.value || "gemensam",
            inkomst1: parseFloat(elements.inkomst1.value) || 0,
            avtal1: elements.avtal1.value === 'ja',
            beräknaPartner: elements.partnerInput.value || "ja",
            inkomst2: parseFloat(elements.inkomst2?.value) || 35000, // Default to 35000
            avtal2: elements.avtal2 ? elements.avtal2.value === 'ja' : false,
            children: parseInt(elements.children.value) || 0,
            plannedChildren: parseInt(elements.plannedChildren.value) || 0,
            barnbidragPerPerson,
            tilläggPerPerson,
            barnDatum: elements.barnDatum.value || "2025-05-01"
        };
    
        if (!inputs.vårdnad) return alert("Välj vårdnadsform (gemensam eller ensam).");
        if (inputs.inkomst1 <= 0) return alert("Vänligen ange en giltig inkomst för Förälder 1.");
        if (!elements.avtal1.value) return alert("Välj om förälder 1 har kollektivavtal.");
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            if (inputs.inkomst2 <= 0) return alert("Vänligen ange en giltig inkomst för Förälder 2.");
            if (!elements.avtal2?.value) return alert("Välj om förälder 2 har kollektivavtal.");
        }
    
        const totalChildren = inputs.children + inputs.plannedChildren;
        const { barnbidrag, tillägg, details } = beräknaBarnbidrag(totalChildren, inputs.vårdnad === "ensam");
        barnbidragPerPerson = barnbidrag;
        tilläggPerPerson = tillägg;
        inputs.barnbidragPerPerson = barnbidragPerPerson;
        inputs.tilläggPerPerson = tilläggPerPerson;
    
        updateProgress(7);
    
        const dagar = inputs.vårdnad === "ensam" ? 390 : 195;
        let output = "<div class='result'>";
        output += `<div class="result-block"><h2>Sammanlagt barnbidrag</h2><p>${details}</p></div>`;
    
        const dag1 = beräknaDaglig(inputs.inkomst1);
        const extra1 = inputs.avtal1 ? (inputs.inkomst1 <= 49000 ? Math.round(inputs.inkomst1 * 0.10) : 4900) : 0;
        const månadsinkomst1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;
        console.log("Form submission - dag1:", dag1, "extra1:", extra1, "månadsinkomst1:", månadsinkomst1);
        output += generateParentSection(1, dag1, extra1, månadsinkomst1, dagar, inputs.avtal1, barnbidragPerPerson, tilläggPerPerson, inputs.vårdnad === "ensam");
    
        let dag2 = 0, extra2 = 0, månadsinkomst2 = 0;
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && inputs.inkomst2 > 0) {
            dag2 = beräknaDaglig(inputs.inkomst2);
            extra2 = inputs.avtal2 ? (inputs.inkomst2 <= 49000 ? Math.round(inputs.inkomst2 * 0.10) : 4900) : 0;
            månadsinkomst2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;
            console.log("Form submission - dag2:", dag2, "extra2:", extra2, "månadsinkomst2:", månadsinkomst2);
            output += generateParentSection(2, dag2, extra2, månadsinkomst2, dagar, inputs.avtal2, barnbidragPerPerson, tilläggPerPerson, false);
        }
    
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            const initialDays = 7;
            output += `
                <div class="total-total-box" id="total-total-box">
                    <div class="total-header"><h3>Totalt för båda föräldrar</h3></div>
                    <div class="total-content">
                        <div class="total-section parent-1">
                            <h4>Förälder 1</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-1">${initialDays}</span> dagar/vecka)</span>
                                <span class="fp-value">${månadsinkomst1.toLocaleString()} kr/månad</span>
                            </div>
                            ${inputs.avtal1 ? `<div class="monthly-row extra-row"><span>Föräldralön</span><span class="extra-value">${extra1.toLocaleString()} kr/månad</span></div>` : ''}
                            <div class="monthly-row barnbidrag-row"><span>Barnbidrag</span><span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span></div>
                            <div class="monthly-row tillagg-row"><span>Flerbarnstillägg</span><span class="tillagg-value">${tilläggPerPerson.toLocaleString()} kr/månad</span></div>
                        </div>
                        ${inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && inputs.inkomst2 > 0 ? `
                        <div class="total-section parent-2">
                            <h4>Förälder 2</h4>
                            <div class="monthly-row fp-row">
                                <span>Föräldrapenning (<span class="days-selected-2">${initialDays}</span> dagar/vecka)</span>
                                <span class="fp-value">${månadsinkomst2.toLocaleString()} kr/månad</span>
                            </div>
                            ${inputs.avtal2 ? `<div class="monthly-row extra-row"><span>Föräldralön</span><span class="extra-value">${extra2.toLocaleString()} kr/månad</span></div>` : ''}
                            <div class="monthly-row barnbidrag-row"><span>Barnbidrag</span><span class="barnbidrag-value">${barnbidragPerPerson.toLocaleString()} kr/månad</span></div>
                            <div class="monthly-row tillagg-row"><span>Flerbarnstillägg</span><span class="tillagg-value">${tilläggPerPerson.toLocaleString()} kr/månad</span></div>
                        </div>` : ''}
                    </div>
                    <div class="montly-footer">
                        <div class="monthly-total">
                            <span>Total disponibel inkomst:</span>
                            <span class="total-value">${
                                inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && inputs.inkomst2 > 0
                                    ? (månadsinkomst1 + extra1 + barnbidragPerPerson + tilläggPerPerson + månadsinkomst2 + extra2 + barnbidragPerPerson + tilläggPerPerson).toLocaleString()
                                    : (månadsinkomst1 + extra1 + barnbidragPerPerson + tilläggPerPerson).toLocaleString()
                            } kr/månad</span>
                        </div>
                    </div>
                </div>
            `;
        }
    
        output += "</div>";
        elements.resultBlock.innerHTML = output;
    
        // Show the sections after TotalTotalBox is calculated
        elements.strategyGroup.style.display = "block";
        elements.preferencesSection.style.display = "block";
        elements.optimizationResult.style.display = "block";
        updatePartnerPreferencesVisibility();
    
        // Show the "Optimera" button after calculation
        elements.optimizeBtn.style.display = "block";
        hasCalculated = true; // Mark that the first calculation has been performed
    
        setupInfoBoxToggle();
        window.dag1 = dag1;
        window.extra1 = extra1;
        window.dag2 = dag2;
        window.extra2 = extra2;
        setupDropdownListeners();
    
        // Update global variables
        inkomst1 = inputs.inkomst1;
        inkomst2 = inputs.inkomst2;
        vårdnad = inputs.vårdnad;
        beräknaPartner = inputs.beräknaPartner;
        deltid = elements.deltid?.value || "nej";
        ledigTid1 = parseFloat(elements.ledigTid1?.value) || 6;
        ledigTid2 = (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") ? (parseFloat(elements.ledigTid2?.value) || 0) : 0;
        minInkomst = parseInt(elements.minInkomst?.value) || 10000;
        strategy = document.getElementById('strategy')?.value || "longer";
        barnDatum = elements.barnDatum.value || "2025-05-01";
        avtal1 = elements.avtal1.value;
        avtal2 = elements.avtal2?.value || "nej";
    
        const preferences = {
            deltid: elements.deltid?.value || "nej",
            ledigTid1: parseFloat(elements.ledigTid1?.value) || 6,
            ledigTid2: (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") ? (parseFloat(elements.ledigTid2?.value) || 0) : 0,
            minInkomst: parseInt(elements.minInkomst?.value) || 10000,
            strategy: document.getElementById('strategy')?.value || "longer"
        };
        try {
            const result = optimizeParentalLeave(preferences, inputs);
            renderGanttChart(
                result.plan1,
                result.plan2,
                result.plan1NoExtra,
                result.plan2NoExtra,
                result.plan1MinDagar,
                result.plan2MinDagar,
                result.plan1Overlap, // Added missing parameter
                inputs.inkomst1,
                inputs.inkomst2,
                inputs.vårdnad,
                inputs.beräknaPartner,
                result.genomförbarhet,
                result.dag1,
                result.extra1,
                result.dag2,
                result.extra2,
                result.förälder1InkomstDagar,
                result.förälder2InkomstDagar,
                result.förälder1MinDagar,
                result.förälder2MinDagar,
                inputs.barnDatum,
                result.arbetsInkomst1,
                result.arbetsInkomst2
            );
        } catch (e) {
            console.error("Optimeringsfel vid första rendering:", e);
            elements.leaveDurationError.textContent = e.message;
            elements.leaveDurationError.style.display = "block";
        }
    
        elements.resultBlock.scrollIntoView({ behavior: 'smooth' });
    });

    let isOptimizing = false;
    elements.optimizeBtn.addEventListener('click', () => {
        if (isOptimizing) return;
        isOptimizing = true;
        elements.leaveDurationError.style.display = "none"; // Clear previous error messages
        try {
            const inputs = {
                vårdnad: elements.vårdnadInput.value || "gemensam",
                beräknaPartner: elements.partnerInput.value || "ja",
                inkomst1: parseInt(elements.inkomst1.value) || 0,
                inkomst2: parseInt(elements.inkomst2?.value) || 35000,
                barnTidigare: parseInt(elements.children?.value) || 0,
                barnPlanerade: parseInt(elements.plannedChildren?.value) || 0,
                avtal1: elements.avtal1.value === "ja",
                avtal2: elements.avtal2?.value === "ja",
                barnbidragPerPerson,
                tilläggPerPerson,
                barnDatum: elements.barnDatum.value || "2025-05-01"
            };
            const preferences = {
                deltid: elements.deltid?.value || "nej",
                ledigTid1: parseFloat(elements.ledigTid1?.value) || 0,
                ledigTid2: (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") ? (parseFloat(elements.ledigTid2?.value) || 0) : 0,
                minInkomst: parseInt(elements.minInkomst?.value) || 0,
                strategy: document.getElementById('strategy')?.value || "longer"
            };
    
            if (!preferences.deltid) return alert("Välj om du vill jobba deltid.");
            if (!preferences.ledigTid1) return alert("Ange hur länge du vill vara ledig.");
            if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && preferences.ledigTid2 === undefined) {
                return alert("Ange hur länge din partner vill vara ledig.");
            }
            if (!preferences.minInkomst) return alert("Ange en minimigräns för månadsinkomst.");
    
            const result = optimizeParentalLeave(preferences, inputs);
            renderGanttChart(
                result.plan1,
                result.plan2,
                result.plan1NoExtra,
                result.plan2NoExtra,
                result.plan1MinDagar,
                result.plan2MinDagar,
                result.plan1Overlap,
                inputs.inkomst1,
                inputs.inkomst2,
                inputs.vårdnad,
                inputs.beräknaPartner,
                result.genomförbarhet,
                result.dag1,
                result.extra1,
                result.dag2,
                result.extra2,
                result.förälder1InkomstDagar,
                result.förälder2InkomstDagar,
                result.förälder1MinDagar,
                result.förälder2MinDagar,
                inputs.barnDatum,
                result.arbetsInkomst1,
                result.arbetsInkomst2
            );
        } catch (e) {
            console.error("Optimeringsfel:", e);
            elements.leaveDurationError.textContent = e.message;
            elements.leaveDurationError.style.display = "block";
        } finally {
            isOptimizing = false;
        }
    });
});