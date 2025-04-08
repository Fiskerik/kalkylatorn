from flask import Flask, render_template, request
import math

app = Flask(__name__)

SGI_TAK = 573000  # 2024 års SGI-tak
MAX_DAGAR = 480
MAX_SJUKPENNING_DAGAR = 390
MAX_LAGSTANIVA_DAGAR = 90
LAGSTANIVA = 180
NETTO_FAKTOR = 0.97  # Efter preliminär skatt

@app.route('/', methods=['GET', 'POST'])
def index():
    result = None

    if request.method == 'POST':
        income = float(request.form['income'])
        parent = request.form.get('parent', 'Förälder 1')

        dagar_80 = int(request.form['days_80'])
        dagar_180 = int(request.form['days_180'])

        sgi = min(income, SGI_TAK)
        sgi_per_day = round(sgi * 0.8 / 365 * NETTO_FAKTOR, 2)

        ers_80 = dagar_80 * sgi_per_day
        ers_180 = dagar_180 * LAGSTANIVA
        total_ers = ers_80 + ers_180

        remaining = MAX_DAGAR - dagar_80 - dagar_180

        result = {
            'parent': parent,
            'income': income,
            'sgi_per_day': sgi_per_day,
            'dagar_80': dagar_80,
            'dagar_180': dagar_180,
            'ers_80': ers_80,
            'ers_180': ers_180,
            'total': total_ers,
            'remaining': remaining
        }

    return render_template('index.html', result=result)

if __name__ == '__main__':
    app.run(debug=True)
