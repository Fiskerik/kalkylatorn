from flask import Flask, render_template, request
import math

app = Flask(__name__)

def berakna_daglig_ersattning(inkomst):
    if not inkomst:
        return None

    arsinkomst = inkomst * 12
    if arsinkomst < 117590:
        return 250
    elif arsinkomst > 588000:
        return 1250
    else:
        sgi = arsinkomst * 0.97
        ersattning = sgi * 0.80 / 365
        return min(1250, max(250, round(ersattning)))

@app.route("/", methods=["GET", "POST"])
def index():
    daily_rate_1 = None
    daily_rate_2 = None
    monthly_fp_1 = None
    monthly_fp_2 = None

    if request.method == "POST":
        vardnad = request.form.get("vardnad")
        inkomst1 = request.form.get("inkomst1")
        inkomst2 = request.form.get("inkomst2")

        try:
            inkomst1 = int(inkomst1)
        except:
            inkomst1 = 0
        try:
            inkomst2 = int(inkomst2)
        except:
            inkomst2 = 0

        daily_rate_1 = berakna_daglig_ersattning(inkomst1)
        if vardnad == "gemensam":
            daily_rate_2 = berakna_daglig_ersattning(inkomst2)

        if daily_rate_1:
            monthly_fp_1 = round(daily_rate_1 * 4.3 * 7 / 100) * 100  # avrundat till 100-tal
        if daily_rate_2:
            monthly_fp_2 = round(daily_rate_2 * 4.3 * 7 / 100) * 100

    return render_template("index.html",
                           daily_rate_1=daily_rate_1,
                           daily_rate_2=daily_rate_2,
                           monthly_fp_1=monthly_fp_1,
                           monthly_fp_2=monthly_fp_2)

if __name__ == "__main__":
    app.run(debug=True)