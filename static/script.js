document.addEventListener("DOMContentLoaded", function () {
    const vardnadButtons = document.querySelectorAll('#vardnad-group .vardnad-btn');
    const vardnadInput = document.getElementById('vardnad');
    const vardnadInfo = document.getElementById('vardnad-info');
    const partnerQuestion = document.getElementById('partner-question');
    const partnerButtons = document.querySelectorAll('#partner-group .toggle-btn');
    const partnerInput = document.getElementById('berakna-partner');
    const form = document.getElementById('calc-form');
    const resultBlock = document.getElementById('result-block');
    const inkomstBlock2 = document.getElementById('inkomst-block-2');

    let dag1 = 0;
    let dag2 = 0;
    let extra1 = 0;
    let extra2 = 0;
    let barnbidragPerPerson = 0;
    let tillaggPerPerson = 0;


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

    function setupBarnval(groupId, inputId) {
        setupToggleButtons(groupId, inputId);
    }

    setupBarnval('barn-tidigare-group', 'barn-tidigare');
    setupBarnval('barn-planerade-group', 'barn-planerade');
    setupToggleButtons('avtal-group-1', 'har-avtal-1');
    setupToggleButtons('avtal-group-2', 'har-avtal-2');

            // Förälder 1
            document.addEventListener('change', function(e) {
                if(e.target && e.target.id === 'uttags-dagar-1') {
                    const dagarPerVecka = parseInt(e.target.value);
                    const nyFp = Math.round((dag1 * dagarPerVecka * 4.3) / 100) * 100;
                    const nyTotal = nyFp + extra1 + barnbidragPerPerson + tillaggPerPerson;
            
                    document.querySelector('.monthly-wrapper:nth-of-type(1) .monthly-box .monthly-row:nth-child(2) span:last-child').innerHTML = `${nyFp.toLocaleString()} kr/månad`;
                    document.querySelector('.monthly-wrapper:nth-of-type(1) .monthly-box .monthly-total span:last-child').innerHTML = `${nyTotal.toLocaleString()} kr/månad`;
                }

                // Förälder 2
                if(e.target && e.target.id === 'uttags-dagar-2') {
                    const dagarPerVecka = parseInt(e.target.value);
                    const nyFp2 = Math.round((dag2 * dagarPerVecka * 4.3) / 100) * 100;
                    const nyTotal2 = nyFp2 + extra2 + barnbidragPerPerson + tillaggPerPerson;
            
                    document.querySelector('.monthly-wrapper:nth-of-type(2) .monthly-box .monthly-row:nth-child(2) span:last-child').innerHTML = `${nyFp2.toLocaleString()} kr/månad`;
                    document.querySelector('.monthly-wrapper:nth-of-type(2) .monthly-box .monthly-total span:last-child').innerHTML = `${nyTotal2.toLocaleString()} kr/månad`;
                }
            });

    vardnadButtons.forEach(button => {
        button.addEventListener('click', () => {
            vardnadButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            vardnadInput.value = button.dataset.value;

            if (button.dataset.value === 'gemensam') {
                vardnadInfo.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
                partnerQuestion.style.display = "block";
                inkomstBlock2.style.display = "block";
                document.getElementById('avtal-question-2').style.display = "block";
            } else {
                vardnadInfo.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
                partnerQuestion.style.display = "none";
                partnerInput.value = "";
                inkomstBlock2.style.display = "none";
                document.getElementById('avtal-question-2').style.display = "none";
            }
        });
    });

    partnerButtons.forEach(button => {
        button.addEventListener('click', () => {
            partnerButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            partnerInput.value = button.dataset.value;
            inkomstBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
            document.getElementById('avtal-question-2').style.display = button.dataset.value === 'ja' ? "block" : "none";
        });
    });

    form.addEventListener("submit", function (e) {
        e.preventDefault();
    
        const vardnad = vardnadInput.value;
        const beraknaPartner = partnerInput.value;
        const income1 = parseInt(document.getElementById("inkomst1").value);
        const income2 = parseInt(document.getElementById("inkomst2")?.value || "0");
        const barnTidigare = parseInt(document.getElementById("barn-tidigare")?.value || "0");
        const barnPlanerade = parseInt(document.getElementById("barn-planerade")?.value || "0");
        const avtal1 = document.getElementById("har-avtal-1").value === "ja";
        const avtal2 = document.getElementById("har-avtal-2")?.value === "ja";
    
        let output = "<div class='result'>";
    
        const totalBarn = barnTidigare + barnPlanerade;
    
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
    
        const dagar = vardnad === "ensam" ? 390 : 195;

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
                        <td>${totalDisponibelt.toLocaleString()} kr</td>
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
                            <th>Disponibel inkomst / månad</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        };
         

        

        if (!isNaN(income1)) {
            dag1 = beraknaDaglig(income1);
            extra1 = avtal1 ? (income1 <= 49000 ? Math.round(income1 * 0.10) : 4900) : 0;
            
            const manad1 = Math.round((dag1 * 7 * 4.3) / 100) * 100;

            output += `
            <div class="result-block">
                <h2>Sammanlagt barnbidrag</h2>
                <p>${details}</p>
            </div>
            `;

            output += `
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
                                <span>195</span><span class="unit">dagar</span>
                            </div>

                            <div class="days-split">
                                <div class="split-row">
                                    <span class="split-label">Varav dagar som kan delas</span>
                                    <span class="split-value">105 dagar</span>
                                </div>
                                <div class="split-row">
                                    <span class="split-label">Varav reserverade dagar</span>
                                    <span class="split-value">90 dagar</span>
                                </div>
                            </div>
                        </div>

                        <div class="benefit-card">
                            <div class="benefit-title">Föräldradagar på lägstanivå</div>
                            <div class="benefit-value-large">
                                <span>90 </span><span class="unit">dagar</span>
                                 <br><div><span class="unit">180 kr/dag</span></div>
                            </div>
                        </div>
                        <div class="info-box">
                            <div class="info-header">
                                <span class="info-icon">ℹ️</span>
                                <span><strong>Information om föräldradagar</strong></span>
                                <span class="info-arrow">▾</span>
                            </div>
                            <div class="info-content">
                                <p>
                                    Föräldrapenningen omfattar totalt 480 dagar för ett barn. Av dessa baseras 390 dagar på din inkomst och betalas ut på sjukpenningnivå, medan de resterande 90 dagarna ger en fast ersättning på 180 kr/dag, vilket är den så kallade lägstanivån.
                                </p>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag1, dagar, extra1)}
                </div>
            `;
            const barnbidragPerPerson = vardnad === "ensam" ? barnbidrag : Math.round(barnbidrag / 2);
            const tillaggPerPerson = vardnad === "ensam" ? tillagg : Math.round(tillagg / 2);

                   // Förälder 1 - Månatlig ersättning
            output += `
            <div class="monthly-wrapper">
                <div class="monthly-box">
                    <h3>Förälder 1 – Månatlig ersättning</h3>
                    <div class="monthly-row">
                        <span>Föräldrapenning*</span>
                        <span>${manad1.toLocaleString()} kr/månad</span>
                    </div>
                    ${avtal1 ? `
                    <div class="monthly-row">
                        <span>Föräldralön**</span>
                        <span>${extra1.toLocaleString()} kr/månad</span>
                    </div>` : ''}
                    <div class="monthly-row">
                        <span>Barnbidrag</span>
                        <span>${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-row">
                        <span>Flerbarnstillägg</span>
                        <span>${tillaggPerPerson.toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-total">
                        <span>Totalt:</span>
                        <span>${(manad1 + extra1 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()} kr/månad</span>
                    </div>
                    <div class="monthly-info">
                        * Vid ett uttag på 7 föräldradagar/vecka<br>
                        ${avtal1 ? `** Utbetalning av föräldralön regleras i ditt kollektivavtal` : ''}
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
            const dag2 = beraknaDaglig(income2);
            const extra2 = avtal2 ? (income2 <= 49000 ? Math.round(income2 * 0.10) : 4900) : 0;
            const manad2 = Math.round((dag2 * 7 * 4.3) / 100) * 100;

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
                                <span>390 </span><span class="unit">dagar</span>
                            </div>
                        </div>
                        <div class="benefit-card">
                            <div class="benefit-title">Föräldradagar på lägstanivå</div>
                            <div class="benefit-value-large">
                                <span>90 </span><span class="unit">dagar</span>
                                <br><div><span class="unit">180 kr/dag</span></div>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag2, dagar, extra2)}
                </div>
            `;
            const barnbidragPerPerson = vardnad === "ensam" ? barnbidrag : Math.round(barnbidrag / 2);
            const tillaggPerPerson = vardnad === "ensam" ? tillagg : Math.round(tillagg / 2);

                               // Förälder 2 - Månatlig ersättning
                               output += `
                               <div class="monthly-wrapper">
                                    <div class="monthly-box">
                                        <h3>Förälder 2 – Månatlig ersättning</h3>
                                        <div class="monthly-row">
                                            <span>Föräldrapenning*</span>
                                            <span>${manad2.toLocaleString()} kr/månad</span>
                                        </div>
                                        ${avtal2 ? `
                                        <div class="monthly-row">
                                            <span>Föräldralön**</span>
                                            <span>${extra2.toLocaleString()} kr/månad</span>
                                        </div>` : ''}
                                        <div class="monthly-row">
                                            <span>Barnbidrag</span>
                                            <span>${barnbidragPerPerson.toLocaleString()} kr/månad</span>
                                        </div>
                                        <div class="monthly-row">
                                            <span>Flerbarnstillägg</span>
                                            <span>${tillaggPerPerson.toLocaleString()} kr/månad</span>
                                        </div>
                                        <div class="monthly-total">
                                            <span>Totalt:</span>
                                            <span>${(manad2 + extra2 + barnbidragPerPerson + tillaggPerPerson).toLocaleString()} kr/månad</span>
                                        </div>
                                        <div class="monthly-info">
                                            * Vid ett uttag på 7 föräldradagar/vecka<br>
                                            ${avtal2 ? `** Utbetalning av föräldralön regleras i ditt kollektivavtal` : ''}
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


        
        resultBlock.innerHTML = output;
        setupInfoBoxToggle();
    
       


    });

    document.addEventListener('click', function(e) {
        if (e.target.closest('.info-header')) {
            const box = e.target.closest('.info-box');
            box.classList.toggle('open');
        }
    });
    
});

// Barnbidrag
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

function setupInfoBoxToggle() {
    const infoHeaders = document.querySelectorAll('.info-header');
    infoHeaders.forEach(header => {
        header.addEventListener('click', () => {
            const box = header.closest('.info-box');
            box.classList.toggle('open');
        });
    });
}

  // Event delegation för info-box toggling
document.addEventListener('click', function(e) {
    if (e.target.closest('.info-header')) {
        const box = e.target.closest('.info-box');
        box.classList.toggle('open');
    }
});

