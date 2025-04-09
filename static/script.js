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

        let output = "<div class='result'>";

        if (!isNaN(income1)) {
            const dag1 = beraknaDaglig(income1);
            const extra1 = avtal1 ? (income1 <= 49000 ? Math.round(income1 * 0.10) : 4900) : 0;
            const manad1 = Math.round((dag1 * 7 * 4.3) / 100) * 10;

            output += `
                <div class="result-section">
                    <h2>Förälder 1</h2>
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
                                <span>${manad1.toLocaleString()}</span><span class="unit">kr/månad</span>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag1, dagar, extra1)}
                </div>
            `;
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
            const dag2 = beraknaDaglig(income2);
            const extra2 = avtal2 ? (income2 <= 49000 ? Math.round(income2 * 0.10) : 4900) : 0;
            const manad2 = Math.round((dag2 * 7 * 4.3) / 100) * 10;

            output += `
                <div class="result-section">
                    <h2>Förälder 2</h2>
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
                                <span>${manad2.toLocaleString()}</span><span class="unit">kr/månad</span>
                            </div>
                        </div>
                    </div>
                    ${genereraTabell(dag2, dagar, extra2)}
                </div>
            `;
        }

        output += `
            <div class="result-block">
                <h2>Sammanlagt barnbidrag</h2>
                <p>${details}</p>
            </div>
        `;

        resultBlock.innerHTML = output;
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

    if (!ensamVardnad) {
        barnbidrag = barnbidrag / 2;
        tillagg = tillagg / 2;
    }

    const total = barnbidrag + tillagg;
    const details = `${totalBarn} barn ger ${Math.round(barnbidrag)} kr barnbidrag${tillagg ? " + " + tillagg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return {
        barnbidrag: Math.round(barnbidrag),
        tillagg: Math.round(tillagg),
        total: Math.round(total),
        details
    };
}
