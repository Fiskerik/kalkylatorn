from flask import Flask, render_template, request
import math

app = Flask(__name__)

def calculate_daily_amount(monthly_income):
    yearly_income = monthly_income * 12
    if yearly_income < 117590:
        return 250
    elif yearly_income > 588000:
        return 1250
    else:
        sgi = yearly_income * 0.97
        daily = (sgi * 0.8) / 365
        return round(daily)

@app.route('/')
def index():
    return render_template('index.html',
        daily_rate_1=0,
        daily_rate_2=0,
        monthly_fp_1=0,
        monthly_fp_2=0,
        dagar_sjukpenning=0,
        dagar_lagstaniva=0,
        shared_care=False
    )


@app.route('/resultat', methods=['POST'])
def resultat():
    income1 = int(request.form.get('income1'))
    income2 = request.form.get('income2')
    income2 = int(income2) if income2 else None

    shared = True if income2 is not None else False
    days_per_parent = 195 if shared else 390

    daily1 = calculate_daily_amount(income1)
    daily2 = calculate_daily_amount(income2) if shared else None

    rows1 = []
    for d in range(1, 8):
        weeks = round(days_per_parent / d, 1)
        monthly = round(daily1 * d * 4.3, -2)
        rows1.append({'days': d, 'weeks': weeks, 'monthly': monthly})

    rows2 = []
    if shared:
        for d in range(1, 8):
            weeks = round(days_per_parent / d, 1)
            monthly = round(daily2 * d * 4.3, -2)
            rows2.append({'days': d, 'weeks': weeks, 'monthly': monthly})

    return render_template('result.html',
                           shared=shared,
                           daily1=daily1,
                           rows1=rows1,
                           daily2=daily2,
                           rows2=rows2)
