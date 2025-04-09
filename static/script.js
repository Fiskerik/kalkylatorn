const vardnadRadios = document.querySelectorAll('input[name="vardnad"]');
const infoText = document.getElementById('vardnad-info');
const block2 = document.getElementById('inkomst-block-2');
const form = document.getElementById('calc-form');
const resultBlock = document.getElementById('result-block');
const vardnadButtons = document.querySelectorAll('#vardnad-group .toggle-btn');
const vardnadInput = document.getElementById('vardnad');
const partnerQuestion = document.getElementById('partner-question');
const partnerButtons = document.querySelectorAll('#partner-group .toggle-btn');
const partnerInput = document.getElementById('berakna-partner');

vardnadButtons.forEach(button => {
    button.addEventListener('click', () => {
        vardnadButtons.forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        vardnadInput.value = button.dataset.value;

        if (button.dataset.value === 'gemensam') {
            infoText.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
            partnerQuestion.style.display = "block";
        } else {
            infoText.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
            partnerQuestion.style.display = "none";
        }
    });
});

partnerButtons.forEach(button => {
button.addEventListener('click', () => {
partnerButtons.forEach(b => b.classList.remove('active'));
button.classList.add('active');
partnerInput.value = button.dataset.value;
});
});

vardnadRadios.forEach(radio => {
    radio.addEventListener('change', function () {
        if (this.value === 'gemensam') {
            infoText.innerHTML = "När du och den andra föräldern har gemensam vårdnad får ni <strong>195 dagar</strong> var på sjukpenningnivå.";
            block2.style.display = 'block';
        } else {
            infoText.innerHTML = "Du som har ensam vårdnad får <strong>390 dagar</strong> på sjukpenningnivå.";
            block2.style.display = 'none';
        }
    });
});

form.addEventListener('submit', function(e) {
    e.preventDefault();

    const vardnad = document.querySelector('input[name="vardnad"]:checked').value;
    const income1 = parseInt(document.getElementById('inkomst1').value);
    const income2 = parseInt(document.getElementById('inkomst2').value || 0);

    const calcDaily = income => {
        const yearly = income * 12;
        if (yearly < 117590) return 250;
        if (yearly > 588000) return 1250;
        const sgi = yearly * 0.97;
        return Math.round((sgi * 0.8) / 365);
    };

    const days = vardnad === 'ensam' ? 390 : 195;
    const daily1 = calcDaily(income1);
    const monthly1 = Math.round((daily1 * 7 * 4.3) / 100) * 100;

    let output = `
        <div class="result-block">
            <h2>Förälder 1</h2>
            <p>Daglig ersättning på sjukpenningnivå: <strong>${daily1} kr</strong></p>
            <div class="progress-container">
                <span>250 kr</span>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${(daily1 / 1250 * 100).toFixed(0)}%"></div>
                </div>
                <span>1250 kr</span>
            </div>
            <p>Preliminär föräldralön: <strong>${monthly1} kr/mån</strong></p>
        </div>
    `;

    if (vardnad === 'gemensam' && income2 > 0) {
        const daily2 = calcDaily(income2);
        const monthly2 = Math.round((daily2 * 7 * 4.3) / 100) * 100;
        output += `
            <div class="result-block">
                <h2>Förälder 2</h2>
                <p>Daglig ersättning på sjukpenningnivå: <strong>${daily2} kr</strong></p>
                <div class="progress-container">
                    <span>250 kr</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${(daily2 / 1250 * 100).toFixed(0)}%"></div>
                    </div>
                    <span>1250 kr</span>
                </div>
                <p>Preliminär föräldralön: <strong>${monthly2} kr/mån</strong></p>
            </div>
        `;
    }

    resultBlock.innerHTML = output;
});
