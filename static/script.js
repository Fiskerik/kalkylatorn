document.addEventListener("DOMContentLoaded", function () {

document.getElementById('monthly-payment-parent-1').textContent = monthly1.toLocaleString();
document.getElementById('daily-fill-parent-1').style.width = ((dag1 - 250) / (1250 - 250) * 100) + "%";


    const vardnadButtons = document.querySelectorAll('#vardnad-group .vardnad-btn');
    const vardnadInput = document.getElementById('vardnad');
    const vardnadInfo = document.getElementById('vardnad-info');
    const partnerQuestion = document.getElementById('partner-question');
    const partnerButtons = document.querySelectorAll('#partner-group .toggle-btn');
    const partnerInput = document.getElementById('berakna-partner');
    const form = document.getElementById('calc-form');
    const resultBlock = document.getElementById('result-block');
    const inkomstBlock2 = document.getElementById('inkomst-block-2');

    
    // Vårdnad
    vardnadButtons.forEach(button => {
        button.addEventListener('click', () => {
            vardnadButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            vardnadInput.value = button.dataset.value;

            if (button.dataset.value === 'gemensam') {
                vardnadInfo.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
                partnerQuestion.style.display = "block";
            } else {
                vardnadInfo.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
                partnerQuestion.style.display = "none";
                partnerInput.value = "";
                inkomstBlock2.style.display = "none";
            }
        });
    });

    // Partner
    partnerButtons.forEach(button => {
        button.addEventListener('click', () => {
            partnerButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            partnerInput.value = button.dataset.value;
            inkomstBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
        });
    });

    // Barnval
    function setupBarnval(groupId, inputId) {
        const group = document.getElementById(groupId);
        const input = document.getElementById(inputId);
        group.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                button.classList.add('active');
                input.value = button.dataset.value;
            });
        });
    }
    
    setupBarnval('barn-tidigare-group', 'barn-tidigare');
    setupBarnval('barn-planerade-group', 'barn-planerade');
    

    // Form-submit
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const vardnad = vardnadInput.value;
        const beraknaPartner = partnerInput.value;
        const income1 = parseInt(document.getElementById("inkomst1").value);
        const income2 = parseInt(document.getElementById("inkomst2")?.value || "0");
        const barnTidigare = parseInt(document.getElementById("barn-tidigare")?.value || "0");
        const barnPlanerade = parseInt(document.getElementById("barn-planerade")?.value || "0");
        const totalBarn = barnTidigare + barnPlanerade;

        const { barnbidrag, tillagg, total, details } = beraknaBarnbidrag(totalBarn, vardnad === "ensam");

        const beraknaDaglig = (inkomst) => {
            const ar = inkomst * 12;
            if (ar < 117590) return 250;
            if (ar > 588000) return 1250;
            const sgi = ar * 0.97;
            return Math.round((sgi * 0.8) / 365);
        };

        const dagar = vardnad === "ensam" ? 390 : 195;

        const genereraTabell = (dailyRate, dagar, arsinkomst, inkomst) => {
            let rows = '';
            for (let i = 1; i <= 7; i++) {
                const veckor = Math.floor(dagar / i);
                const manadsersattning = Math.round((dailyRate * i * 4.3) / 100) * 100;
                const totalDisponibelt = manadsersattning + total;
                rows += `
                    <tr>
                        <td>${i} dag${i > 1 ? 'ar' : ''}</td>
                        <td>${veckor} veckor</td>
                        <td>${manadsersattning.toLocaleString()} kr</td>
                        <td>${totalDisponibelt.toLocaleString()} kr</td>
                    </tr>
                `;
            }
            if (arsinkomst > 588000)
            return `
                <p>Du kan preliminärt få <strong>${dailyRate} kr</strong> per dag i föräldrapenning</p>
                <p>Eftersom du tjänar mer än 588 000 kronor per år får du maxbeloppet (1250 kronor) för föräldrapenning.</p>
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
            else if (arsinkomst < 117590)
            return `
                <p>Du kan preliminärt få <strong>${dailyRate} kr</strong> per dag i föräldrapenning</p>
                <p>Eftersom du tjänar mer än 588 000 kronor per år får du minimibeloppet (250 kronor) för föräldrapenning.</p>
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
            else
                return `
                    <p>Du kan preliminärt få <strong>${dailyRate} kr</strong> per dag i föräldrapenning</p>
                    <p>Eftersom du har en årsinkomst på <strong>${arsinkomst.toLocaleString()} kr</strong> får du en dagsersättning på <strong>${dailyRate} kr</strong>.</p>
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

        let output = "<div class='result'>";

        if (!isNaN(income1)) {
            const dag1 = beraknaDaglig(income1);
            output += `
            <div class="result-section">
                <h2>Förälder 1</h2>
                <p>Nedan sammanfattas hur mycket föräldrapenning på sjukpenningnivå du kan få under din föräldraledighet</p>
          
                <div class="benefit-grid">
                    <!-- Daglig ersättning -->
                    <div class="benefit-card">
                        <div class="benefit-title">Daglig ersättning på sjukpenningnivå</div>
                        <div class="benefit-value-large">
                            <span id="daily-payment-parent-1">${dag1.toLocaleString()}</span>
                            <span class="unit">kr/dag</span>
                        </div>
                        <div class="benefit-bar">
                            <div class="benefit-bar-fill" style="width: ${(dag1 - 250) / (1250 - 250) * 100}%;"></div>
                        </div>
                        <div class="benefit-bar-labels">
                            <span>250 kr</span>
                            <span>1 250 kr</span>
                        </div>
                    </div>
          
                    <!-- Månadslön -->
                    <div class="benefit-card">
                        <div class="benefit-title">Preliminär föräldralön</div>
                        <div class="benefit-value-large">
                            <span>${Math.round((dag1 * 7 * 4.3) / 100) * 100}</span>
                            <span class="unit">kr/månad</span>
                        </div>
                    </div>
                </div>
            </div>
          `;
          
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
            const dag2 = beraknaDaglig(income2);
            output += `
            <div class="result-section">
                <h2>Förälder 1</h2>
                <p>Nedan sammanfattas hur mycket föräldrapenning på sjukpenningnivå du kan få under din föräldraledighet</p>
          
                <div class="benefit-grid">
                    <!-- Daglig ersättning -->
                    <div class="benefit-card">
                        <div class="benefit-title">Daglig ersättning på sjukpenningnivå</div>
                        <div class="benefit-value-large">
                            <span id="daily-payment-parent-2">${dag2.toLocaleString()}</span>
                            <span class="unit">kr/dag</span>
                        </div>
                        <div class="benefit-bar">
                            <div class="benefit-bar-fill" style="width: ${(dag2 - 250) / (1250 - 250) * 100}%;"></div>
                        </div>
                        <div class="benefit-bar-labels">
                            <span>250 kr</span>
                            <span>1 250 kr</span>
                        </div>
                    </div>
          
                    <!-- Månadslön -->
                    <div class="benefit-card">
                        <div class="benefit-title">Preliminär föräldralön</div>
                        <div class="benefit-value-large">
                            <span>${Math.round((dag2 * 7 * 4.3) / 100) * 100}</span>
                            <span class="unit">kr/månad</span>
                        </div>
                    </div>
                </div>
            </div>
          `;
          
        }

        output += `
            <div class="result-block">
                <h2>Sammanlagt barnbidrag</h2>
                <p>${details}</p>
            </div>`;

        if (vardnad === "gemensam") {
            output += `
                <div class="result-block">
                    <h2>Partnerns barnbidrag</h2>
                    <p>Din partner kommer att få ${barnbidrag.toLocaleString()} kr i barnbidrag och ${tillagg.toLocaleString()} kr i flerbarnstillägg.</p>
                </div>`;
        }

        output += "</div>";
        resultBlock.innerHTML = output;
    });
});

// Funktion för att räkna barnbidrag + tillägg
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
    if (!ensamVardnad) {
        barnbidrag = (bidragPerBarn * totalBarn) / 2;
        tillagg = tillagg / 2;
    }

    const total = barnbidrag + tillagg;
    const details = `${totalBarn} barn ger ${Math.round(barnbidrag)} kr barnbidrag${tillagg > 0 ? " + " + tillagg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return { barnbidrag: Math.round(barnbidrag), tillagg: Math.round(tillagg), total: Math.round(total), details };
}
