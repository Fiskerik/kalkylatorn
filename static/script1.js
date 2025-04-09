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
    const avtalBlock2 = document.getElementById('avtal-question-2');

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

    function setupAvtalKnapp(gruppId, inputId) {
        const group = document.getElementById(gruppId);
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
    setupAvtalKnapp('avtal-group-1', 'har-avtal-1');
    setupAvtalKnapp('avtal-group-2', 'har-avtal-2');

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
                avtalBlock2.style.display = "none";
            }
        });
    });

    partnerButtons.forEach(button => {
        button.addEventListener('click', () => {
            partnerButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            partnerInput.value = button.dataset.value;
            inkomstBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
            avtalBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
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
        const totalBarn = barnTidigare + barnPlanerade;

        const avtal1 = document.getElementById("har-avtal-1").value;
        const avtal2 = document.getElementById("har-avtal-2").value;

        const kollektivavtalErs1 = avtal1 === "ja" ? (income1 <= 49000 ? Math.round(income1 * 0.10) : 4900) : 0;
        const kollektivavtalErs2 = (vardnad === "gemensam" && beraknaPartner === "ja" && avtal2 === "ja") ? (income2 <= 49000 ? Math.round(income2 * 0.10) : 4900) : 0;

        const { barnbidrag, tillagg, total, details } = beraknaBarnbidrag(totalBarn, vardnad === "ensam");

        const beraknaDaglig = (inkomst) => {
            const ar = inkomst * 12;
            if (ar < 117590) return 250;
            if (ar > 588000) return 1250;
            const sgi = ar * 0.97;
            return Math.round((sgi * 0.8) / 365);
        };

        const dagar = vardnad === "ensam" ? 390 : 195;

        const genereraTabell = (dailyRate, dagar, arsinkomst, inkomst, extraAvtal) => {
            let rows = '';
            for (let i = 1; i <= 7; i++) {
                const veckor = Math.floor(dagar / i);
                const manadsersattning = Math.round((dailyRate * i * 4.3) / 100) * 100;
                const totalDisponibelt = manadsersattning + total + extraAvtal;
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
                <p>Du kan preliminärt få <strong>${dailyRate} kr</strong> per dag i föräldrapenning</p>
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
            output += genereraTabell(dag1, dagar, income1 * 12, income1, kollektivavtalErs1);
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
            const dag2 = beraknaDaglig(income2);
            output += genereraTabell(dag2, dagar, income2 * 12, income2, kollektivavtalErs2);
        }

        output += `
            <div class="result-block">
                <h2>Sammanlagt barnbidrag</h2>
                <p>${details}</p>
            </div>
        `;

        output += "</div>";
        resultBlock.innerHTML = output;
    });
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
    if (!ensamVardnad) {
        barnbidrag = (bidragPerBarn * totalBarn) / 2;
        tillagg = tillagg / 2;
    }

    const total = barnbidrag + tillagg;
    const details = `${totalBarn} barn ger ${Math.round(barnbidrag)} kr barnbidrag${tillagg > 0 ? " + " + tillagg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return { barnbidrag: Math.round(barnbidrag), tillagg: Math.round(tillagg), total: Math.round(total), details };
}