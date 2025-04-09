document.addEventListener("DOMContentLoaded", function () {
    const vardnadButtons = document.querySelectorAll('#vardnad-group .toggle-btn');
    const vardnadInput = document.getElementById('vardnad');
    const vardnadInfo = document.getElementById('vardnad-info');
    const partnerQuestion = document.getElementById('partner-question');
    const partnerButtons = document.querySelectorAll('#partner-group .toggle-btn');
    const partnerInput = document.getElementById('berakna-partner');
    const form = document.getElementById('calc-form');
    const resultBlock = document.getElementById('result-block');
    const inkomstBlock2 = document.getElementById('inkomst-block-2');

    // Vårdnad-knappar
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

    // Partner-knappar
    partnerButtons.forEach(button => {
        button.addEventListener('click', () => {
            partnerButtons.forEach(b => b.classList.remove('active'));
            button.classList.add('active');
            partnerInput.value = button.dataset.value;
            inkomstBlock2.style.display = button.dataset.value === 'ja' ? "block" : "none";
        });
    });

    // Kalkylering
    form.addEventListener("submit", function (e) {
        e.preventDefault();

        const vardnad = vardnadInput.value;
        const beraknaPartner = partnerInput.value;
        const income1 = parseInt(document.getElementById("inkomst1").value);
        const income2 = parseInt(document.getElementById("inkomst2").value) || 0;

        const beraknaDaglig = (inkomst) => {
            const ar = inkomst * 12;
            if (ar < 117590) return 250;
            if (ar > 588000) return 1250;
            const sgi = ar * 0.97;
            return Math.round((sgi * 0.8) / 365);
        };

        const dagar = vardnad === "ensam" ? 390 : 195;

        const genereraTabell = (dailyRate, dagar) => {
            let rows = '';
            for (let i = 1; i <= 7; i++) {
                const veckor = Math.floor(dagar / i);
                const manadsersattning = Math.round((dailyRate * i * 4.3) / 100) * 100;
                rows += `
                    <tr>
                        <td>${i} dag${i > 1 ? 'ar' : ''}</td>
                        <td>${veckor} veckor</td>
                        <td>${manadsersattning.toLocaleString()} kr</td>
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
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            `;
        };

        let output = "<div class='result'>";

        if (!isNaN(income1)) {
            const dag1 = beraknaDaglig(income1);
            output += `<h2>Förälder 1</h2>${genereraTabell(dag1, dagar)}`;
        }

        if (vardnad === "gemensam" && beraknaPartner === "ja" && income2 > 0) {
            const dag2 = beraknaDaglig(income2);
            output += `<h2>Förälder 2</h2>${genereraTabell(dag2, dagar)}`;
        }

        output += "</div>";
        resultBlock.innerHTML = output;
    });
});
