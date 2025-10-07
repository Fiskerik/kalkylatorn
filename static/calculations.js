/**
 * calculations.js - Calculation logic for the Föräldrapenningkalkylator
 * Handles parental benefit calculations, child allowances, and leave optimization.
 */
import {
    INCOME_CAP,
    SGI_CAP,
    MINIMUM_RATE,
    DEFAULT_BARNBIDRAG,
    PRISBASBELOPP
} from './config.js';

/**
 * Calculate monthly net income based on daily rate, days per week, and additional benefits
 * @param {number} dag - Daily parental benefit rate
 * @param {number} dagarPerVecka - Days per week taken
 * @param {number} extra - Parental supplement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional child allowance
 * @returns {number} Rounded monthly net income
 */
export function beräknaMånadsinkomst(dag, dagarPerVecka, extra, barnbidrag = DEFAULT_BARNBIDRAG, tillägg = 0) {
    const fp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
    const extraBelopp = extra ? Math.round(extra * (dagarPerVecka / 7)) : 0;
    const resultat = beräknaNetto(fp) + beräknaNetto(extraBelopp) + barnbidrag + tillägg;
    return resultat || 0;
}

/**
 * Calculate daily parental benefit based on monthly income
 * @param {number} inkomst - Monthly income
 * @returns {number} Daily benefit rate
 */
export function beräknaDaglig(inkomst) {
    if (!inkomst || inkomst <= 0) return 0;
    const sgi = Math.min(inkomst, SGI_CAP);
    const calculatedDailyRate = Math.round((sgi * 0.8 * 12) / 365);
    return Math.min(calculatedDailyRate, INCOME_CAP);
}

/**
 * Calculate employer-provided parental salary supplement
 * @param {number} inkomst - Monthly income
 * @returns {number} Monthly parental supplement
 */
export function beräknaFöräldralön(inkomst) {
    if (!inkomst || inkomst <= 0) return 0;

    const årsinkomst = inkomst * 12;
    const gräns = PRISBASBELOPP * 10;

    if (årsinkomst <= gräns) {
        return Math.round((årsinkomst * 0.10) / 12);
    }

    const basal = gräns * 0.10;
    const över = (årsinkomst - gräns) * 0.90;
    return Math.round((basal + över) / 12);
}

/**
 * Calculate net monthly income from gross and tax rate
 * @param {number} inkomst - Gross monthly income
 * @param {number} skattesats - Tax rate percentage (default 30)
 * @returns {number} Net monthly income
 */
export function beräknaNetto(inkomst, skattesats = 30) {
    if (!inkomst || inkomst <= 0) return 0;
    const rate = skattesats / 100;
    return Math.round(inkomst * (1 - rate));
}

/**
 * Calculate child allowance and additional benefits
 * @param {number} totalBarn - Total number of children
 * @param {boolean} ensamVårdnad - True if sole custody
 * @returns {Object} Object with barnbidrag, tillägg, total, and details
 */
export function beräknaBarnbidrag(totalBarn, ensamVårdnad) {
    const bidragPerBarn = 1250;
    const flerbarnstillägg = { 2: 150, 3: 730, 4: 1740, 5: 2990, 6: 4240 };
    const barnbidrag = bidragPerBarn * totalBarn;
    const tillägg = flerbarnstillägg[totalBarn] || 0;
    const total = barnbidrag + tillägg;
    const details = `${totalBarn} barn ger ${barnbidrag.toLocaleString()} kr barnbidrag${tillägg ? " + " + tillägg + " kr flerbarnstillägg" : ""} = <strong>${total.toLocaleString()} kr</strong>`;
    return {
        barnbidrag: ensamVårdnad ? barnbidrag : Math.round(barnbidrag / 2),
        tillägg: ensamVårdnad ? tillägg : Math.round(tillägg / 2),
        total: ensamVårdnad ? total : Math.round(total / 2),
        details
    };
}

/**
 * Optimize parental leave based on preferences and inputs
 * @param {Object} preferences - User preferences (deltid, ledigTid1, etc.)
 * @param {Object} inputs - Input data (inkomst1, vårdnad, etc.)
 * @returns {Object} Optimized leave plans and related data
 */
function optimizeParentalLeaveLegacy(preferences, inputs) {
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst, strategy } = preferences;
    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan1Overlap = {
        startWeek: 0,
        weeks: 2,
        dagarPerVecka: 0,
        inkomst: 0,
        inkomstUtanExtra: 0
    };
    let plan1ExtraWeeks = 0;
    let plan1NoExtraWeeksTotal = 0;
    let plan2ExtraWeeks = 0;
    let plan2NoExtraWeeksTotal = 0;
    let genomförbarhet = {
        ärGenomförbar: true,
        meddelande: "",
        transferredDays: 0,
        status: "ok",
        minInkomst: minInkomst,
        maxShortfallRatio: 0
    };

    const updateStatusFromSeverity = severity => {
        if (severity === "error") {
            genomförbarhet.status = "error";
        } else if (severity === "warning" && genomförbarhet.status !== "error") {
            genomförbarhet.status = "warning";
        }
    };

    const evaluateIncomeSeverity = income => {
        if (minInkomst <= 0 || income >= minInkomst) {
            return null;
        }
        const diff = minInkomst - income;
        const ratio = minInkomst > 0 ? diff / minInkomst : 0;
        const severity = ratio > 0.10 ? "error" : "warning";
        if (ratio > genomförbarhet.maxShortfallRatio) {
            genomförbarhet.maxShortfallRatio = ratio;
        }
        return severity;
    };

    const barnbidrag = inputs.barnbidragPerPerson || 1250;
    const tillägg = inputs.tilläggPerPerson || 75;

    const inkomst1 = Number(inputs.inkomst1) || 0;
    const inkomst2 = Number(inputs.inkomst2) || 0;

    if (isNaN(inkomst1) || isNaN(inkomst2) || isNaN(ledigTid1) || isNaN(ledigTid2)) {
        throw new Error("Invalid input values: incomes and leave durations must be numbers.");
    }

    const anst1 = inputs.anställningstid1 || "";
    const anst2 = inputs.anställningstid2 || "";
    const avtal1Ja = inputs.avtal1 === "ja" || inputs.avtal1 === true;
    const avtal2Ja = inputs.avtal2 === "ja" || inputs.avtal2 === true;
    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = avtal1Ja && anst1 !== "0-5" ? beräknaFöräldralön(inkomst1) : 0;
    const dag2 = inkomst2 > 0 ? beräknaDaglig(inkomst2) : 0;
    const extra2 = avtal2Ja && anst2 !== "0-5" ? beräknaFöräldralön(inkomst2) : 0;

    const maxFöräldralönWeeks1 = avtal1Ja
        ? anst1 === "6-12" ? 2 * 4.3 : anst1 === ">1" ? 6 * 4.3 : 0
        : 0;
    const maxFöräldralönWeeks2 = avtal2Ja
        ? anst2 === "6-12" ? 2 * 4.3 : anst2 === ">1" ? 6 * 4.3 : 0
        : 0;
    let unusedFöräldralönWeeks1 = 0;
    let unusedFöräldralönWeeks2 = 0;

    let förälder1InkomstDagar = inputs.vårdnad === "ensam" ? 390 : 195;
    let förälder2InkomstDagar = inputs.vårdnad === "ensam" ? 0 : 195;
    let förälder1MinDagar = inputs.vårdnad === "ensam" ? 90 : 45;
    let förälder2MinDagar = inputs.vårdnad === "ensam" ? 0 : 45;
    let användaInkomstDagar1 = 0;
    let användaInkomstDagar2 = 0;
    let användaMinDagar1 = 0;
    let användaMinDagar2 = 0;

    const arbetsInkomst1 = beräknaNetto(inkomst1) + barnbidrag + tillägg;
    const arbetsInkomst2 = inkomst2 > 0 ? beräknaNetto(inkomst2) + barnbidrag + tillägg : 0;

    let dagarPerVecka1 = 0;
    let dagarPerVecka1NoExtra = 0;
    let dagarPerVecka2 = 0;
    let weeks1 = Math.round(ledigTid1 * 4.3);
    let weeks2 = Math.round(ledigTid2 * 4.3);
    let inkomst1Result = arbetsInkomst1;
    let inkomst2Result = arbetsInkomst2;
    let kombineradInkomst = 0;

    const maxDagarPerVecka = deltid === "ja" ? 5 : 7;
    if (strategy === "maximize") {
        dagarPerVecka1 = weeks1 > 0 ? Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder1InkomstDagar / weeks1))) : 0;
        dagarPerVecka2 =
            inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0
                ? Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder2InkomstDagar / weeks2)))
                : 0;
    } else {
        dagarPerVecka1 = weeks1 > 0 ? 1 : 0;
        dagarPerVecka2 =
            inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0 ? 1 : 0;
    }

    let totalDagarBehövda1 = weeks1 * dagarPerVecka1;
    let totalDagarBehövda2 = weeks2 * dagarPerVecka2;

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
        const minDagarBehövda2 = weeks2 * dagarPerVecka2;
        const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
        const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
        förälder2InkomstDagar -= överförDagar;
        förälder1InkomstDagar += överförDagar;
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        genomförbarhet.transferredDays += överförDagar;
    }

    if (totalDagarBehövda1 > förälder1InkomstDagar) {
        dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            totalDagarBehövda1 = förälder1InkomstDagar;
            weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda2 > förälder2InkomstDagar) {
        dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            totalDagarBehövda2 = förälder2InkomstDagar;
            weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
        }
    }

    // Step 1: Allocate for Parent 1
    if (weeks1 > 0) {
        inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
        inkomst2Result = arbetsInkomst2;
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (strategy === "longer") {
            while (kombineradInkomst < minInkomst && dagarPerVecka1 < maxDagarPerVecka) {
                dagarPerVecka1++;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst && dagarPerVecka1 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder1InkomstDagar / weeks1));
            if (möjligaDagar > dagarPerVecka1) {
                dagarPerVecka1 = möjligaDagar;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
        }
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
            const minDagarBehövda2 = weeks2 * dagarPerVecka2;
            const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
            const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
            förälder2InkomstDagar -= överförDagar;
            förälder1InkomstDagar += överförDagar;
            genomförbarhet.transferredDays += överförDagar;
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        }
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
            if (totalDagarBehövda1 > förälder1InkomstDagar) {
                totalDagarBehövda1 = förälder1InkomstDagar;
                weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
            }
        }
    }

    // Step 2: Allocate for Parent 2
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        inkomst1Result = arbetsInkomst1;
        inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (strategy === "longer") {
            while (kombineradInkomst < minInkomst && dagarPerVecka2 < maxDagarPerVecka) {
                dagarPerVecka2++;
                inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst && dagarPerVecka2 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder2InkomstDagar / weeks2));
            if (möjligaDagar > dagarPerVecka2) {
                dagarPerVecka2 = möjligaDagar;
                inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka2} dagar/vecka).`;
        }
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
            totalDagarBehövda2 = weeks2 * dagarPerVecka2;
            if (totalDagarBehövda2 > förälder2InkomstDagar) {
                totalDagarBehövda2 = förälder2InkomstDagar;
                weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
            }
        }
    }

    const allocateIncomeDays = ({ totalDays, extraWeeks, noExtraWeeks, maxPerWeek, enforceHighExtra }) => {
        const safeExtraWeeks = Math.max(0, Math.round(extraWeeks));
        const safeNoExtraWeeks = Math.max(0, Math.round(noExtraWeeks));

        if (totalDays <= 0 || (safeExtraWeeks === 0 && safeNoExtraWeeks === 0)) {
            return {
                dagarPerVeckaExtra: 0,
                dagarPerVeckaNoExtra: 0,
                usedExtraDays: 0,
                usedNoExtraDays: 0
            };
        }

        const maxExtraDays = safeExtraWeeks * maxPerWeek;
        const maxNoExtraDays = safeNoExtraWeeks * maxPerWeek;
        const baselineNoExtra = safeNoExtraWeeks > 0 ? Math.min(totalDays, safeNoExtraWeeks) : 0;
        let remaining = totalDays - baselineNoExtra;

        let usedExtraDays = 0;
        if (safeExtraWeeks > 0 && remaining > 0) {
            const minExtraPerWeek = enforceHighExtra ? Math.min(maxPerWeek, 5) : 0;
            const minExtraDays = safeExtraWeeks * minExtraPerWeek;
            usedExtraDays = Math.min(maxExtraDays, remaining);
            if (usedExtraDays < minExtraDays && totalDays >= minExtraDays + baselineNoExtra) {
                usedExtraDays = Math.min(maxExtraDays, Math.min(remaining, minExtraDays));
            }
            remaining -= usedExtraDays;
        }

        let usedNoExtraDays = Math.min(Math.max(0, maxNoExtraDays - baselineNoExtra), Math.max(0, remaining));
        remaining -= usedNoExtraDays;
        usedNoExtraDays += baselineNoExtra;

        if (remaining > 0 && safeExtraWeeks > 0 && usedExtraDays < maxExtraDays) {
            const add = Math.min(maxExtraDays - usedExtraDays, remaining);
            usedExtraDays += add;
            remaining -= add;
        }

        if (remaining > 0 && safeNoExtraWeeks > 0 && usedNoExtraDays < maxNoExtraDays) {
            const add = Math.min(maxNoExtraDays - usedNoExtraDays, remaining);
            usedNoExtraDays += add;
            remaining -= add;
        }

        const dagarPerVeckaExtra = safeExtraWeeks > 0 ? Number((usedExtraDays / safeExtraWeeks).toFixed(2)) : 0;
        const dagarPerVeckaNoExtra = safeNoExtraWeeks > 0 ? Number((usedNoExtraDays / safeNoExtraWeeks).toFixed(2)) : 0;

        return {
            dagarPerVeckaExtra,
            dagarPerVeckaNoExtra,
            usedExtraDays: Math.round(usedExtraDays),
            usedNoExtraDays: Math.round(usedNoExtraDays)
        };
    };

    // Step 3: Allocate days for Period 1 (Förälder 1)
    let minDagarWeeks1 = 0;
    let weeks1NoExtra = 0;
    if (dagarPerVecka1 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks1;
        if (weeks1 > maxFöräldralönWeeks) {
            weeks1NoExtra = Math.round(weeks1 - maxFöräldralönWeeks);
            weeks1 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks1 = weeks1 + weeks1NoExtra;
        const initialInkomstDagar1 = förälder1InkomstDagar;
        const allocation1 = allocateIncomeDays({
            totalDays: initialInkomstDagar1,
            extraWeeks: weeks1,
            noExtraWeeks: totalWeeks1 - weeks1,
            maxPerWeek: maxDagarPerVecka,
            enforceHighExtra: strategy === "maximize" && extra1 > 0
        });

        dagarPerVecka1 = allocation1.dagarPerVeckaExtra;
        dagarPerVecka1NoExtra = allocation1.dagarPerVeckaNoExtra;

        let extraDaysUsed1 = allocation1.usedExtraDays;
        let noExtraDaysUsed1 = allocation1.usedNoExtraDays;
        användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
        förälder1InkomstDagar -= användaInkomstDagar1;
        användaMinDagar1 = 0;
        minDagarWeeks1 = 0;

        plan1ExtraWeeks = extra1 > 0 ? weeks1 : 0;
        plan1NoExtraWeeksTotal = plan1ExtraWeeks > 0 ? weeks1NoExtra : totalWeeks1;

        plan1 = {
            startWeek: 0,
            weeks: plan1ExtraWeeks,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg)),
            användaInkomstDagar: extraDaysUsed1,
            användaMinDagar: användaMinDagar1
        };

        plan1NoExtra = {
            startWeek: plan1ExtraWeeks,
            weeks: plan1NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka1NoExtra,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1NoExtra || dagarPerVecka1, 0, barnbidrag, tillägg))
        };
        plan1NoExtra.användaInkomstDagar = noExtraDaysUsed1;

        if (plan1NoExtraWeeksTotal > 0) {
            const nuInkomst = plan1NoExtra.inkomst + arbetsInkomst2;
            if (nuInkomst < minInkomst) {
                const mål = minInkomst - arbetsInkomst2;
                let önskadeDagar = dagarPerVecka1NoExtra || dagarPerVecka1;
                while (
                    önskadeDagar < maxDagarPerVecka &&
                    beräknaMånadsinkomst(dag1, önskadeDagar, 0, barnbidrag, tillägg) < mål
                ) {
                    önskadeDagar += 1;
                }
                const extraDagar =
                    (önskadeDagar - (dagarPerVecka1NoExtra || dagarPerVecka1)) * plan1NoExtraWeeksTotal;
                if (extraDagar > 0) {
                    const minBehov2 = weeks2 * dagarPerVecka2;
                    const överförbara = Math.max(
                        0,
                        förälder2InkomstDagar - 90 - minBehov2 - 10
                    );
                    const lånade = Math.min(överförbara, extraDagar);
                    förälder2InkomstDagar -= lånade;
                    genomförbarhet.transferredDays += lånade;
                    användaInkomstDagar1 += lånade;
                    const nyaNoExtraDagar = noExtraDaysUsed1 + lånade;
                    dagarPerVecka1NoExtra = Number(
                        (nyaNoExtraDagar / Math.max(1, plan1NoExtraWeeksTotal)).toFixed(2)
                    );
                    plan1NoExtra.dagarPerVecka = dagarPerVecka1NoExtra;
                    plan1NoExtra.inkomst = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1NoExtra,
                            0,
                            barnbidrag,
                            tillägg
                        )
                    );
                    noExtraDaysUsed1 = nyaNoExtraDagar;
                    plan1NoExtra.användaInkomstDagar = nyaNoExtraDagar;
                    användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
                }
                const kombEfter = plan1NoExtra.inkomst + arbetsInkomst2;
                if (kombEfter < minInkomst) {
                    genomförbarhet.ärGenomförbar = false;
                    const severity = evaluateIncomeSeverity(kombEfter);
                    updateStatusFromSeverity(severity || "warning");
                    genomförbarhet.meddelande =
                        `Kombinerad inkomst ${kombEfter.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
                }
            }
        }

        plan1MinDagar = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: minDagarWeeks1,
            dagarPerVecka: dagarPerVecka1NoExtra || dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomst(
                    MINIMUM_RATE,
                    dagarPerVecka1NoExtra || dagarPerVecka1,
                    0,
                    barnbidrag,
                    tillägg
                )
            ),
            användaMinDagar: 0
        };

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            const overlapDaysPerWeek = 5;
            plan1Overlap = {
                startWeek: 0,
                weeks: 2,
                dagarPerVecka: overlapDaysPerWeek,
                inkomst: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, extra1, barnbidrag, tillägg)
                ),
                inkomstUtanExtra: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, 0, barnbidrag, tillägg)
                )
            };
        }
        unusedFöräldralönWeeks1 = Math.max(0, maxFöräldralönWeeks1 - plan1ExtraWeeks);
    }

    // Step 4: Allocate days for Period 2 (Förälder 2)
    let minDagarWeeks2 = 0;
    let weeks2NoExtra = 0;
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks2;
        if (weeks2 > maxFöräldralönWeeks) {
            weeks2NoExtra = Math.round(weeks2 - maxFöräldralönWeeks);
            weeks2 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks2 = weeks2 + weeks2NoExtra;
        const initialInkomstDagar2 = förälder2InkomstDagar;
        const dagarBehövda2 = totalWeeks2 * dagarPerVecka2;

        användaInkomstDagar2 = Math.min(dagarBehövda2, initialInkomstDagar2);
        förälder2InkomstDagar -= användaInkomstDagar2;
        användaMinDagar2 = Math.max(0, Math.min(dagarBehövda2 - initialInkomstDagar2, förälder2MinDagar));
        förälder2MinDagar -= användaMinDagar2;
        minDagarWeeks2 = 0;

        plan2ExtraWeeks = extra2 > 0 ? weeks2 : 0;
        plan2NoExtraWeeksTotal = plan2ExtraWeeks > 0 ? weeks2NoExtra : totalWeeks2;

        plan2 = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: plan2ExtraWeeks,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: användaMinDagar2
        };

        const plan2StartNoExtra = plan2.startWeek + plan2ExtraWeeks;
        const extraDaysUsed2 = Math.min(användaInkomstDagar2, Math.round(plan2ExtraWeeks * dagarPerVecka2));
        const noExtraDaysUsed2 = Math.max(0, användaInkomstDagar2 - extraDaysUsed2);
        plan2NoExtra = {
            startWeek: plan2StartNoExtra,
            weeks: plan2NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: noExtraDaysUsed2
        };

        const minDagarWeeks2Dynamic = användaMinDagar2 > 0
            ? Math.max(1, Math.round(användaMinDagar2 / Math.max(dagarPerVecka2, 1)))
            : minDagarWeeks2;
        plan2MinDagar = {
            startWeek: plan2StartNoExtra + plan2NoExtraWeeksTotal,
            weeks: minDagarWeeks2Dynamic,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaMinDagar: användaMinDagar2
        };
        unusedFöräldralönWeeks2 = Math.max(0, maxFöräldralönWeeks2 - plan2ExtraWeeks);
    }

    // Step 5: Handle overlap days (10 days for Förälder 2)
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
        const overlapDays = 10;
        if (overlapDays <= förälder2InkomstDagar) {
            förälder2InkomstDagar -= overlapDays;
            användaInkomstDagar2 += overlapDays;
        } else {
            const remainingOverlapDays = overlapDays - förälder2InkomstDagar;
            användaInkomstDagar2 += förälder2InkomstDagar;
            förälder2InkomstDagar = 0;
            användaMinDagar2 += remainingOverlapDays;
            förälder2MinDagar -= remainingOverlapDays;
        }
        plan2.användaInkomstDagar = användaInkomstDagar2;
        plan2.användaMinDagar = användaMinDagar2;
        plan2MinDagar.användaMinDagar = användaMinDagar2;
    }

    const phase1Incomes = [];
    if (plan1.weeks > 0) phase1Incomes.push(plan1.inkomst + arbetsInkomst2);
    if (plan1NoExtra.weeks > 0) phase1Incomes.push(plan1NoExtra.inkomst + arbetsInkomst2);
    if (plan1MinDagar.weeks > 0) phase1Incomes.push(plan1MinDagar.inkomst + arbetsInkomst2);
    const phase2Incomes = [];
    if (plan2.weeks > 0) phase2Incomes.push(plan2.inkomst + arbetsInkomst1);
    if (plan2NoExtra.weeks > 0) phase2Incomes.push(plan2NoExtra.inkomst + arbetsInkomst1);
    if (plan2MinDagar.weeks > 0) phase2Incomes.push(plan2MinDagar.inkomst + arbetsInkomst1);

    const minPhase1 = phase1Incomes.length ? Math.min(...phase1Incomes) : null;
    const minPhase2 = phase2Incomes.length ? Math.min(...phase2Incomes) : null;

    if (minPhase1 !== null && minPhase1 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase1);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase1.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan1.dagarPerVecka} dagar/vecka).`;
    } else if (minPhase2 !== null && minPhase2 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase2);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase2.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan2.dagarPerVecka} dagar/vecka).`;
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
        arbetsInkomst2,
        maxFöräldralönWeeks1,
        maxFöräldralönWeeks2,
        unusedFöräldralönWeeks1,
        unusedFöräldralönWeeks2
    };
}

export function optimizeParentalLeave(preferences, inputs) {
    const strategy = preferences?.strategy || "longer";
    if (strategy === "maximize_parental_salary") {
        return optimizeParentalLeaveParentalSalary(preferences, inputs);
    }
    return optimizeParentalLeaveLegacy(preferences, inputs);
}

function optimizeParentalLeaveParentalSalary(preferences, inputs) {
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst } = preferences;
    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan1Overlap = {
        startWeek: 0,
        weeks: 2,
        dagarPerVecka: 0,
        inkomst: 0,
        inkomstUtanExtra: 0
    };
    let plan1ExtraWeeks = 0;
    let plan1NoExtraWeeksTotal = 0;
    let plan2ExtraWeeks = 0;
    let plan2NoExtraWeeksTotal = 0;
    let genomförbarhet = {
        ärGenomförbar: true,
        meddelande: "",
        transferredDays: 0,
        status: "ok",
        minInkomst: minInkomst,
        maxShortfallRatio: 0
    };

    const updateStatusFromSeverity = severity => {
        if (severity === "error") {
            genomförbarhet.status = "error";
        } else if (severity === "warning" && genomförbarhet.status !== "error") {
            genomförbarhet.status = "warning";
        }
    };

    const evaluateIncomeSeverity = income => {
        if (minInkomst <= 0 || income >= minInkomst) {
            return null;
        }
        const diff = minInkomst - income;
        const ratio = minInkomst > 0 ? diff / minInkomst : 0;
        const severity = ratio > 0.10 ? "error" : "warning";
        if (ratio > genomförbarhet.maxShortfallRatio) {
            genomförbarhet.maxShortfallRatio = ratio;
        }
        return severity;
    };

    const barnbidrag = inputs.barnbidragPerPerson || 1250;
    const tillägg = inputs.tilläggPerPerson || 75;

    const inkomst1 = Number(inputs.inkomst1) || 0;
    const inkomst2 = Number(inputs.inkomst2) || 0;

    if (isNaN(inkomst1) || isNaN(inkomst2) || isNaN(ledigTid1) || isNaN(ledigTid2)) {
        throw new Error("Invalid input values: incomes and leave durations must be numbers.");
    }

    const anst1 = inputs.anställningstid1 || "";
    const anst2 = inputs.anställningstid2 || "";
    const avtal1Ja = inputs.avtal1 === "ja" || inputs.avtal1 === true;
    const avtal2Ja = inputs.avtal2 === "ja" || inputs.avtal2 === true;
    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = avtal1Ja && anst1 !== "0-5" ? beräknaFöräldralön(inkomst1) : 0;
    const dag2 = inkomst2 > 0 ? beräknaDaglig(inkomst2) : 0;
    const extra2 = avtal2Ja && anst2 !== "0-5" ? beräknaFöräldralön(inkomst2) : 0;

    const maxFöräldralönWeeks1 = avtal1Ja
        ? anst1 === "6-12" ? 2 * 4.3 : anst1 === ">1" ? 6 * 4.3 : 0
        : 0;
    const maxFöräldralönWeeks2 = avtal2Ja
        ? anst2 === "6-12" ? 2 * 4.3 : anst2 === ">1" ? 6 * 4.3 : 0
        : 0;
    let unusedFöräldralönWeeks1 = 0;
    let unusedFöräldralönWeeks2 = 0;

    let förälder1InkomstDagar = inputs.vårdnad === "ensam" ? 390 : 195;
    let förälder2InkomstDagar = inputs.vårdnad === "ensam" ? 0 : 195;
    let förälder1MinDagar = inputs.vårdnad === "ensam" ? 90 : 45;
    let förälder2MinDagar = inputs.vårdnad === "ensam" ? 0 : 45;
    let användaInkomstDagar1 = 0;
    let användaInkomstDagar2 = 0;
    let användaMinDagar1 = 0;
    let användaMinDagar2 = 0;

    const arbetsInkomst1 = beräknaNetto(inkomst1) + barnbidrag + tillägg;
    const arbetsInkomst2 = inkomst2 > 0 ? beräknaNetto(inkomst2) + barnbidrag + tillägg : 0;

    let dagarPerVecka1 = 0;
    let dagarPerVecka1NoExtra = 0;
    let dagarPerVecka2 = 0;
    let weeks1 = Math.round(ledigTid1 * 4.3);
    let weeks2 = Math.round(ledigTid2 * 4.3);
    let inkomst1Result = arbetsInkomst1;
    let inkomst2Result = arbetsInkomst2;
    let kombineradInkomst = 0;

    const maxDagarPerVecka = deltid === "ja" ? 5 : 7;
    if (weeks1 > 0) {
        dagarPerVecka1 = Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder1InkomstDagar / weeks1)));
    }
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        dagarPerVecka2 = Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder2InkomstDagar / weeks2)));
    }

    let totalDagarBehövda1 = weeks1 * dagarPerVecka1;
    let totalDagarBehövda2 = weeks2 * dagarPerVecka2;

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
        const minDagarBehövda2 = weeks2 * dagarPerVecka2;
        const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
        const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
        förälder2InkomstDagar -= överförDagar;
        förälder1InkomstDagar += överförDagar;
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        genomförbarhet.transferredDays += överförDagar;
    }

    if (totalDagarBehövda1 > förälder1InkomstDagar) {
        dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            totalDagarBehövda1 = förälder1InkomstDagar;
            weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda2 > förälder2InkomstDagar) {
        dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            totalDagarBehövda2 = förälder2InkomstDagar;
            weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
        }
    }

    if (weeks1 > 0) {
        inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
        inkomst2Result = arbetsInkomst2;
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (kombineradInkomst < minInkomst && dagarPerVecka1 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder1InkomstDagar / weeks1));
            if (möjligaDagar > dagarPerVecka1) {
                dagarPerVecka1 = möjligaDagar;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
        }
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
            const minDagarBehövda2 = weeks2 * dagarPerVecka2;
            const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
            const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
            förälder2InkomstDagar -= överförDagar;
            förälder1InkomstDagar += överförDagar;
            genomförbarhet.transferredDays += överförDagar;
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        }
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
            if (totalDagarBehövda1 > förälder1InkomstDagar) {
                totalDagarBehövda1 = förälder1InkomstDagar;
                weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
            }
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        inkomst1Result = arbetsInkomst1;
        inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (kombineradInkomst < minInkomst && dagarPerVecka2 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder2InkomstDagar / weeks2));
            if (möjligaDagar > dagarPerVecka2) {
                dagarPerVecka2 = möjligaDagar;
                inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka2} dagar/vecka).`;
        }
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
            totalDagarBehövda2 = weeks2 * dagarPerVecka2;
            if (totalDagarBehövda2 > förälder2InkomstDagar) {
                totalDagarBehövda2 = förälder2InkomstDagar;
                weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
            }
        }
    }

    const allocateIncomeDays = ({ totalDays, extraWeeks, noExtraWeeks, maxPerWeek, enforceHighExtra }) => {
        const safeExtraWeeks = Math.max(0, Math.round(extraWeeks));
        const safeNoExtraWeeks = Math.max(0, Math.round(noExtraWeeks));

        if (totalDays <= 0 || (safeExtraWeeks === 0 && safeNoExtraWeeks === 0)) {
            return {
                dagarPerVeckaExtra: 0,
                dagarPerVeckaNoExtra: 0,
                usedExtraDays: 0,
                usedNoExtraDays: 0
            };
        }

        const maxExtraDays = safeExtraWeeks * maxPerWeek;
        const maxNoExtraDays = safeNoExtraWeeks * maxPerWeek;
        const baselineNoExtra = safeNoExtraWeeks > 0 ? Math.min(totalDays, safeNoExtraWeeks) : 0;
        let remaining = totalDays - baselineNoExtra;

        let usedExtraDays = 0;
        if (safeExtraWeeks > 0 && remaining > 0) {
            const minExtraPerWeek = enforceHighExtra ? Math.min(maxPerWeek, 5) : 0;
            const minExtraDays = safeExtraWeeks * minExtraPerWeek;
            usedExtraDays = Math.min(maxExtraDays, remaining);
            if (usedExtraDays < minExtraDays && totalDays >= minExtraDays + baselineNoExtra) {
                usedExtraDays = Math.min(maxExtraDays, Math.min(remaining, minExtraDays));
            }
            remaining -= usedExtraDays;
        }

        let usedNoExtraDays = Math.min(Math.max(0, maxNoExtraDays - baselineNoExtra), Math.max(0, remaining));
        remaining -= usedNoExtraDays;
        usedNoExtraDays += baselineNoExtra;

        if (remaining > 0 && safeExtraWeeks > 0 && usedExtraDays < maxExtraDays) {
            const add = Math.min(maxExtraDays - usedExtraDays, remaining);
            usedExtraDays += add;
            remaining -= add;
        }

        if (remaining > 0 && safeNoExtraWeeks > 0 && usedNoExtraDays < maxNoExtraDays) {
            const add = Math.min(maxNoExtraDays - usedNoExtraDays, remaining);
            usedNoExtraDays += add;
            remaining -= add;
        }

        const dagarPerVeckaExtra = safeExtraWeeks > 0 ? Number((usedExtraDays / safeExtraWeeks).toFixed(2)) : 0;
        const dagarPerVeckaNoExtra = safeNoExtraWeeks > 0 ? Number((usedNoExtraDays / safeNoExtraWeeks).toFixed(2)) : 0;

        return {
            dagarPerVeckaExtra,
            dagarPerVeckaNoExtra,
            usedExtraDays: Math.round(usedExtraDays),
            usedNoExtraDays: Math.round(usedNoExtraDays)
        };
    };

    let minDagarWeeks1 = 0;
    let weeks1NoExtra = 0;
    if (dagarPerVecka1 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks1;
        if (weeks1 > maxFöräldralönWeeks) {
            weeks1NoExtra = Math.round(weeks1 - maxFöräldralönWeeks);
            weeks1 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks1 = weeks1 + weeks1NoExtra;
        const initialInkomstDagar1 = förälder1InkomstDagar;
        const allocation1 = allocateIncomeDays({
            totalDays: initialInkomstDagar1,
            extraWeeks: weeks1,
            noExtraWeeks: totalWeeks1 - weeks1,
            maxPerWeek: maxDagarPerVecka,
            enforceHighExtra: extra1 > 0
        });

        dagarPerVecka1 = allocation1.dagarPerVeckaExtra;
        dagarPerVecka1NoExtra = allocation1.dagarPerVeckaNoExtra;

        let extraDaysUsed1 = allocation1.usedExtraDays;
        let noExtraDaysUsed1 = allocation1.usedNoExtraDays;
        användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
        förälder1InkomstDagar -= användaInkomstDagar1;
        användaMinDagar1 = 0;
        minDagarWeeks1 = 0;

        plan1ExtraWeeks = extra1 > 0 ? weeks1 : 0;
        plan1NoExtraWeeksTotal = plan1ExtraWeeks > 0 ? weeks1NoExtra : totalWeeks1;

        plan1 = {
            startWeek: 0,
            weeks: plan1ExtraWeeks,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg)),
            användaInkomstDagar: extraDaysUsed1,
            användaMinDagar: användaMinDagar1
        };

        plan1NoExtra = {
            startWeek: plan1ExtraWeeks,
            weeks: plan1NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka1NoExtra,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1NoExtra || dagarPerVecka1, 0, barnbidrag, tillägg))
        };
        plan1NoExtra.användaInkomstDagar = noExtraDaysUsed1;

        if (plan1NoExtraWeeksTotal > 0) {
            const nuInkomst = plan1NoExtra.inkomst + arbetsInkomst2;
            if (nuInkomst < minInkomst) {
                const mål = minInkomst - arbetsInkomst2;
                let önskadeDagar = dagarPerVecka1NoExtra || dagarPerVecka1;
                while (
                    önskadeDagar < maxDagarPerVecka &&
                    beräknaMånadsinkomst(dag1, önskadeDagar, 0, barnbidrag, tillägg) < mål
                ) {
                    önskadeDagar += 1;
                }
                const extraDagar =
                    (önskadeDagar - (dagarPerVecka1NoExtra || dagarPerVecka1)) * plan1NoExtraWeeksTotal;
                if (extraDagar > 0) {
                    const minBehov2 = weeks2 * dagarPerVecka2;
                    const överförbara = Math.max(
                        0,
                        förälder2InkomstDagar - 90 - minBehov2 - 10
                    );
                    const lånade = Math.min(överförbara, extraDagar);
                    förälder2InkomstDagar -= lånade;
                    genomförbarhet.transferredDays += lånade;
                    användaInkomstDagar1 += lånade;
                    const nyaNoExtraDagar = noExtraDaysUsed1 + lånade;
                    dagarPerVecka1NoExtra = Number(
                        (nyaNoExtraDagar / Math.max(1, plan1NoExtraWeeksTotal)).toFixed(2)
                    );
                    plan1NoExtra.dagarPerVecka = dagarPerVecka1NoExtra;
                    plan1NoExtra.inkomst = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1NoExtra,
                            0,
                            barnbidrag,
                            tillägg
                        )
                    );
                    noExtraDaysUsed1 = nyaNoExtraDagar;
                    plan1NoExtra.användaInkomstDagar = nyaNoExtraDagar;
                    användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
                }
                const kombEfter = plan1NoExtra.inkomst + arbetsInkomst2;
                if (kombEfter < minInkomst) {
                    genomförbarhet.ärGenomförbar = false;
                    const severity = evaluateIncomeSeverity(kombEfter);
                    updateStatusFromSeverity(severity || "warning");
                    genomförbarhet.meddelande =
                        `Kombinerad inkomst ${kombEfter.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
                }
            }
        }

        plan1MinDagar = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: minDagarWeeks1,
            dagarPerVecka: dagarPerVecka1NoExtra || dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomst(
                    MINIMUM_RATE,
                    dagarPerVecka1NoExtra || dagarPerVecka1,
                    0,
                    barnbidrag,
                    tillägg
                )
            ),
            användaMinDagar: 0
        };

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            const overlapDaysPerWeek = 5;
            plan1Overlap = {
                startWeek: 0,
                weeks: 2,
                dagarPerVecka: overlapDaysPerWeek,
                inkomst: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, extra1, barnbidrag, tillägg)
                ),
                inkomstUtanExtra: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, 0, barnbidrag, tillägg)
                )
            };
        }
        unusedFöräldralönWeeks1 = Math.max(0, maxFöräldralönWeeks1 - plan1ExtraWeeks);
    }

    let minDagarWeeks2 = 0;
    let weeks2NoExtra = 0;
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks2;
        if (weeks2 > maxFöräldralönWeeks) {
            weeks2NoExtra = Math.round(weeks2 - maxFöräldralönWeeks);
            weeks2 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks2 = weeks2 + weeks2NoExtra;
        const initialInkomstDagar2 = förälder2InkomstDagar;
        const dagarBehövda2 = totalWeeks2 * dagarPerVecka2;

        användaInkomstDagar2 = Math.min(dagarBehövda2, initialInkomstDagar2);
        förälder2InkomstDagar -= användaInkomstDagar2;
        användaMinDagar2 = Math.max(0, Math.min(dagarBehövda2 - initialInkomstDagar2, förälder2MinDagar));
        förälder2MinDagar -= användaMinDagar2;
        minDagarWeeks2 = 0;

        plan2ExtraWeeks = extra2 > 0 ? weeks2 : 0;
        plan2NoExtraWeeksTotal = plan2ExtraWeeks > 0 ? weeks2NoExtra : totalWeeks2;

        plan2 = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: plan2ExtraWeeks,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: användaMinDagar2
        };

        const plan2StartNoExtra = plan2.startWeek + plan2ExtraWeeks;
        const extraDaysUsed2 = Math.min(användaInkomstDagar2, Math.round(plan2ExtraWeeks * dagarPerVecka2));
        const noExtraDaysUsed2 = Math.max(0, användaInkomstDagar2 - extraDaysUsed2);
        plan2NoExtra = {
            startWeek: plan2StartNoExtra,
            weeks: plan2NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: noExtraDaysUsed2
        };

        const minDagarWeeks2Dynamic = användaMinDagar2 > 0
            ? Math.max(1, Math.round(användaMinDagar2 / Math.max(dagarPerVecka2, 1)))
            : minDagarWeeks2;
        plan2MinDagar = {
            startWeek: plan2StartNoExtra + plan2NoExtraWeeksTotal,
            weeks: minDagarWeeks2Dynamic,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaMinDagar: användaMinDagar2
        };
        unusedFöräldralönWeeks2 = Math.max(0, maxFöräldralönWeeks2 - plan2ExtraWeeks);
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
        const overlapDays = 10;
        if (overlapDays <= förälder2InkomstDagar) {
            förälder2InkomstDagar -= overlapDays;
            användaInkomstDagar2 += overlapDays;
        } else {
            const remainingOverlapDays = overlapDays - förälder2InkomstDagar;
            användaInkomstDagar2 += förälder2InkomstDagar;
            förälder2InkomstDagar = 0;
            användaMinDagar2 += remainingOverlapDays;
            förälder2MinDagar -= remainingOverlapDays;
        }
        plan2.användaInkomstDagar = användaInkomstDagar2;
        plan2.användaMinDagar = användaMinDagar2;
        plan2MinDagar.användaMinDagar = användaMinDagar2;
    }

    const phase1Incomes = [];
    if (plan1.weeks > 0) phase1Incomes.push(plan1.inkomst + arbetsInkomst2);
    if (plan1NoExtra.weeks > 0) phase1Incomes.push(plan1NoExtra.inkomst + arbetsInkomst2);
    if (plan1MinDagar.weeks > 0) phase1Incomes.push(plan1MinDagar.inkomst + arbetsInkomst2);
    const phase2Incomes = [];
    if (plan2.weeks > 0) phase2Incomes.push(plan2.inkomst + arbetsInkomst1);
    if (plan2NoExtra.weeks > 0) phase2Incomes.push(plan2NoExtra.inkomst + arbetsInkomst1);
    if (plan2MinDagar.weeks > 0) phase2Incomes.push(plan2MinDagar.inkomst + arbetsInkomst1);

    const minPhase1 = phase1Incomes.length ? Math.min(...phase1Incomes) : null;
    const minPhase2 = phase2Incomes.length ? Math.min(...phase2Incomes) : null;

    if (minPhase1 !== null && minPhase1 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase1);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase1.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan1.dagarPerVecka} dagar/vecka).`;
    } else if (minPhase2 !== null && minPhase2 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase2);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase2.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan2.dagarPerVecka} dagar/vecka).`;
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
        arbetsInkomst2,
        maxFöräldralönWeeks1,
        maxFöräldralönWeeks2,
        unusedFöräldralönWeeks1,
        unusedFöräldralönWeeks2
    };
}

export function optimizeParentalLeave(preferences, inputs) {
    const strategy = preferences?.strategy || "longer";
    if (strategy === "maximize_parental_salary") {
        return optimizeParentalLeaveParentalSalary(preferences, inputs);
    }
    return optimizeParentalLeaveLegacy(preferences, inputs);
}

function optimizeParentalLeaveParentalSalary(preferences, inputs) {
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst } = preferences;
    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaInkomstDagar: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, användaMinDagar: 0 };
    let plan1Overlap = {
        startWeek: 0,
        weeks: 2,
        dagarPerVecka: 0,
        inkomst: 0,
        inkomstUtanExtra: 0
    };
    let plan1ExtraWeeks = 0;
    let plan1NoExtraWeeksTotal = 0;
    let plan2ExtraWeeks = 0;
    let plan2NoExtraWeeksTotal = 0;
    let genomförbarhet = {
        ärGenomförbar: true,
        meddelande: "",
        transferredDays: 0,
        status: "ok",
        minInkomst: minInkomst,
        maxShortfallRatio: 0
    };

    const updateStatusFromSeverity = severity => {
        if (severity === "error") {
            genomförbarhet.status = "error";
        } else if (severity === "warning" && genomförbarhet.status !== "error") {
            genomförbarhet.status = "warning";
        }
    };

    const evaluateIncomeSeverity = income => {
        if (minInkomst <= 0 || income >= minInkomst) {
            return null;
        }
        const diff = minInkomst - income;
        const ratio = minInkomst > 0 ? diff / minInkomst : 0;
        const severity = ratio > 0.10 ? "error" : "warning";
        if (ratio > genomförbarhet.maxShortfallRatio) {
            genomförbarhet.maxShortfallRatio = ratio;
        }
        return severity;
    };

    const barnbidrag = inputs.barnbidragPerPerson || 1250;
    const tillägg = inputs.tilläggPerPerson || 75;

    const inkomst1 = Number(inputs.inkomst1) || 0;
    const inkomst2 = Number(inputs.inkomst2) || 0;

    if (isNaN(inkomst1) || isNaN(inkomst2) || isNaN(ledigTid1) || isNaN(ledigTid2)) {
        throw new Error("Invalid input values: incomes and leave durations must be numbers.");
    }

    const anst1 = inputs.anställningstid1 || "";
    const anst2 = inputs.anställningstid2 || "";
    const avtal1Ja = inputs.avtal1 === "ja" || inputs.avtal1 === true;
    const avtal2Ja = inputs.avtal2 === "ja" || inputs.avtal2 === true;
    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = avtal1Ja && anst1 !== "0-5" ? beräknaFöräldralön(inkomst1) : 0;
    const dag2 = inkomst2 > 0 ? beräknaDaglig(inkomst2) : 0;
    const extra2 = avtal2Ja && anst2 !== "0-5" ? beräknaFöräldralön(inkomst2) : 0;

    const maxFöräldralönWeeks1 = avtal1Ja
        ? anst1 === "6-12" ? 2 * 4.3 : anst1 === ">1" ? 6 * 4.3 : 0
        : 0;
    const maxFöräldralönWeeks2 = avtal2Ja
        ? anst2 === "6-12" ? 2 * 4.3 : anst2 === ">1" ? 6 * 4.3 : 0
        : 0;
    let unusedFöräldralönWeeks1 = 0;
    let unusedFöräldralönWeeks2 = 0;

    let förälder1InkomstDagar = inputs.vårdnad === "ensam" ? 390 : 195;
    let förälder2InkomstDagar = inputs.vårdnad === "ensam" ? 0 : 195;
    let förälder1MinDagar = inputs.vårdnad === "ensam" ? 90 : 45;
    let förälder2MinDagar = inputs.vårdnad === "ensam" ? 0 : 45;
    let användaInkomstDagar1 = 0;
    let användaInkomstDagar2 = 0;
    let användaMinDagar1 = 0;
    let användaMinDagar2 = 0;

    const arbetsInkomst1 = beräknaNetto(inkomst1) + barnbidrag + tillägg;
    const arbetsInkomst2 = inkomst2 > 0 ? beräknaNetto(inkomst2) + barnbidrag + tillägg : 0;

    let dagarPerVecka1 = 0;
    let dagarPerVecka1NoExtra = 0;
    let dagarPerVecka2 = 0;
    let weeks1 = Math.round(ledigTid1 * 4.3);
    let weeks2 = Math.round(ledigTid2 * 4.3);
    let inkomst1Result = arbetsInkomst1;
    let inkomst2Result = arbetsInkomst2;
    let kombineradInkomst = 0;

    const maxDagarPerVecka = deltid === "ja" ? 5 : 7;
    if (weeks1 > 0) {
        dagarPerVecka1 = Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder1InkomstDagar / weeks1)));
    }
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        dagarPerVecka2 = Math.min(maxDagarPerVecka, Math.max(1, Math.floor(förälder2InkomstDagar / weeks2)));
    }

    let totalDagarBehövda1 = weeks1 * dagarPerVecka1;
    let totalDagarBehövda2 = weeks2 * dagarPerVecka2;

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
        const minDagarBehövda2 = weeks2 * dagarPerVecka2;
        const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
        const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
        förälder2InkomstDagar -= överförDagar;
        förälder1InkomstDagar += överförDagar;
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        genomförbarhet.transferredDays += överförDagar;
    }

    if (totalDagarBehövda1 > förälder1InkomstDagar) {
        dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            totalDagarBehövda1 = förälder1InkomstDagar;
            weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda2 > förälder2InkomstDagar) {
        dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            totalDagarBehövda2 = förälder2InkomstDagar;
            weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
        }
    }

    if (weeks1 > 0) {
        inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
        inkomst2Result = arbetsInkomst2;
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (kombineradInkomst < minInkomst && dagarPerVecka1 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder1InkomstDagar / weeks1));
            if (möjligaDagar > dagarPerVecka1) {
                dagarPerVecka1 = möjligaDagar;
                inkomst1Result = beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
        }
        totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && totalDagarBehövda1 > förälder1InkomstDagar) {
            const minDagarBehövda2 = weeks2 * dagarPerVecka2;
            const överförbaraDagar2 = Math.max(0, förälder2InkomstDagar - 90 - minDagarBehövda2 - 10);
            const överförDagar = Math.min(överförbaraDagar2, totalDagarBehövda1 - förälder1InkomstDagar);
            förälder2InkomstDagar -= överförDagar;
            förälder1InkomstDagar += överförDagar;
            genomförbarhet.transferredDays += överförDagar;
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
        }
        if (totalDagarBehövda1 > förälder1InkomstDagar) {
            dagarPerVecka1 = Math.max(1, Math.floor(förälder1InkomstDagar / weeks1));
            totalDagarBehövda1 = weeks1 * dagarPerVecka1;
            if (totalDagarBehövda1 > förälder1InkomstDagar) {
                totalDagarBehövda1 = förälder1InkomstDagar;
                weeks1 = Math.floor(totalDagarBehövda1 / dagarPerVecka1) || 1;
            }
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        inkomst1Result = arbetsInkomst1;
        inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
        kombineradInkomst = inkomst1Result + inkomst2Result;

        if (kombineradInkomst < minInkomst && dagarPerVecka2 < 7) {
            const möjligaDagar = Math.min(7, Math.floor(förälder2InkomstDagar / weeks2));
            if (möjligaDagar > dagarPerVecka2) {
                dagarPerVecka2 = möjligaDagar;
                inkomst2Result = beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg);
                kombineradInkomst = inkomst1Result + inkomst2Result;
            }
        }
        if (kombineradInkomst < minInkomst) {
            genomförbarhet.ärGenomförbar = false;
            const severity = evaluateIncomeSeverity(kombineradInkomst);
            updateStatusFromSeverity(severity || "warning");
            genomförbarhet.meddelande =
                `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka2} dagar/vecka).`;
        }
        totalDagarBehövda2 = weeks2 * dagarPerVecka2;
        if (totalDagarBehövda2 > förälder2InkomstDagar) {
            dagarPerVecka2 = Math.max(1, Math.floor(förälder2InkomstDagar / weeks2));
            totalDagarBehövda2 = weeks2 * dagarPerVecka2;
            if (totalDagarBehövda2 > förälder2InkomstDagar) {
                totalDagarBehövda2 = förälder2InkomstDagar;
                weeks2 = Math.floor(totalDagarBehövda2 / dagarPerVecka2) || 1;
            }
        }
    }

    const allocateIncomeDays = ({ totalDays, extraWeeks, noExtraWeeks, maxPerWeek, enforceHighExtra }) => {
        const safeExtraWeeks = Math.max(0, Math.round(extraWeeks));
        const safeNoExtraWeeks = Math.max(0, Math.round(noExtraWeeks));

        if (totalDays <= 0 || (safeExtraWeeks === 0 && safeNoExtraWeeks === 0)) {
            return {
                dagarPerVeckaExtra: 0,
                dagarPerVeckaNoExtra: 0,
                usedExtraDays: 0,
                usedNoExtraDays: 0
            };
        }

        const maxExtraDays = safeExtraWeeks * maxPerWeek;
        const maxNoExtraDays = safeNoExtraWeeks * maxPerWeek;
        const baselineNoExtra = safeNoExtraWeeks > 0 ? Math.min(totalDays, safeNoExtraWeeks) : 0;
        let remaining = totalDays - baselineNoExtra;

        let usedExtraDays = 0;
        if (safeExtraWeeks > 0 && remaining > 0) {
            const minExtraPerWeek = enforceHighExtra ? Math.min(maxPerWeek, 5) : 0;
            const minExtraDays = safeExtraWeeks * minExtraPerWeek;
            usedExtraDays = Math.min(maxExtraDays, remaining);
            if (usedExtraDays < minExtraDays && totalDays >= minExtraDays + baselineNoExtra) {
                usedExtraDays = Math.min(maxExtraDays, Math.min(remaining, minExtraDays));
            }
            remaining -= usedExtraDays;
        }

        let usedNoExtraDays = Math.min(Math.max(0, maxNoExtraDays - baselineNoExtra), Math.max(0, remaining));
        remaining -= usedNoExtraDays;
        usedNoExtraDays += baselineNoExtra;

        if (remaining > 0 && safeExtraWeeks > 0 && usedExtraDays < maxExtraDays) {
            const add = Math.min(maxExtraDays - usedExtraDays, remaining);
            usedExtraDays += add;
            remaining -= add;
        }

        if (remaining > 0 && safeNoExtraWeeks > 0 && usedNoExtraDays < maxNoExtraDays) {
            const add = Math.min(maxNoExtraDays - usedNoExtraDays, remaining);
            usedNoExtraDays += add;
            remaining -= add;
        }

        const dagarPerVeckaExtra = safeExtraWeeks > 0 ? Number((usedExtraDays / safeExtraWeeks).toFixed(2)) : 0;
        const dagarPerVeckaNoExtra = safeNoExtraWeeks > 0 ? Number((usedNoExtraDays / safeNoExtraWeeks).toFixed(2)) : 0;

        return {
            dagarPerVeckaExtra,
            dagarPerVeckaNoExtra,
            usedExtraDays: Math.round(usedExtraDays),
            usedNoExtraDays: Math.round(usedNoExtraDays)
        };
    };

    let minDagarWeeks1 = 0;
    let weeks1NoExtra = 0;
    if (dagarPerVecka1 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks1;
        if (weeks1 > maxFöräldralönWeeks) {
            weeks1NoExtra = Math.round(weeks1 - maxFöräldralönWeeks);
            weeks1 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks1 = weeks1 + weeks1NoExtra;
        const initialInkomstDagar1 = förälder1InkomstDagar;
        const allocation1 = allocateIncomeDays({
            totalDays: initialInkomstDagar1,
            extraWeeks: weeks1,
            noExtraWeeks: totalWeeks1 - weeks1,
            maxPerWeek: maxDagarPerVecka,
            enforceHighExtra: extra1 > 0
        });

        dagarPerVecka1 = allocation1.dagarPerVeckaExtra;
        dagarPerVecka1NoExtra = allocation1.dagarPerVeckaNoExtra;

        let extraDaysUsed1 = allocation1.usedExtraDays;
        let noExtraDaysUsed1 = allocation1.usedNoExtraDays;
        användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
        förälder1InkomstDagar -= användaInkomstDagar1;
        användaMinDagar1 = 0;
        minDagarWeeks1 = 0;

        plan1ExtraWeeks = extra1 > 0 ? weeks1 : 0;
        plan1NoExtraWeeksTotal = plan1ExtraWeeks > 0 ? weeks1NoExtra : totalWeeks1;

        plan1 = {
            startWeek: 0,
            weeks: plan1ExtraWeeks,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg)),
            användaInkomstDagar: extraDaysUsed1,
            användaMinDagar: användaMinDagar1
        };

        plan1NoExtra = {
            startWeek: plan1ExtraWeeks,
            weeks: plan1NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka1NoExtra,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1NoExtra || dagarPerVecka1, 0, barnbidrag, tillägg))
        };
        plan1NoExtra.användaInkomstDagar = noExtraDaysUsed1;

        if (plan1NoExtraWeeksTotal > 0) {
            const nuInkomst = plan1NoExtra.inkomst + arbetsInkomst2;
            if (nuInkomst < minInkomst) {
                const mål = minInkomst - arbetsInkomst2;
                let önskadeDagar = dagarPerVecka1NoExtra || dagarPerVecka1;
                while (
                    önskadeDagar < maxDagarPerVecka &&
                    beräknaMånadsinkomst(dag1, önskadeDagar, 0, barnbidrag, tillägg) < mål
                ) {
                    önskadeDagar += 1;
                }
                const extraDagar =
                    (önskadeDagar - (dagarPerVecka1NoExtra || dagarPerVecka1)) * plan1NoExtraWeeksTotal;
                if (extraDagar > 0) {
                    const minBehov2 = weeks2 * dagarPerVecka2;
                    const överförbara = Math.max(
                        0,
                        förälder2InkomstDagar - 90 - minBehov2 - 10
                    );
                    const lånade = Math.min(överförbara, extraDagar);
                    förälder2InkomstDagar -= lånade;
                    genomförbarhet.transferredDays += lånade;
                    användaInkomstDagar1 += lånade;
                    const nyaNoExtraDagar = noExtraDaysUsed1 + lånade;
                    dagarPerVecka1NoExtra = Number(
                        (nyaNoExtraDagar / Math.max(1, plan1NoExtraWeeksTotal)).toFixed(2)
                    );
                    plan1NoExtra.dagarPerVecka = dagarPerVecka1NoExtra;
                    plan1NoExtra.inkomst = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1NoExtra,
                            0,
                            barnbidrag,
                            tillägg
                        )
                    );
                    noExtraDaysUsed1 = nyaNoExtraDagar;
                    plan1NoExtra.användaInkomstDagar = nyaNoExtraDagar;
                    användaInkomstDagar1 = extraDaysUsed1 + noExtraDaysUsed1;
                }
                const kombEfter = plan1NoExtra.inkomst + arbetsInkomst2;
                if (kombEfter < minInkomst) {
                    genomförbarhet.ärGenomförbar = false;
                    const severity = evaluateIncomeSeverity(kombEfter);
                    updateStatusFromSeverity(severity || "warning");
                    genomförbarhet.meddelande =
                        `Kombinerad inkomst ${kombEfter.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
                }
            }
        }

        plan1MinDagar = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: minDagarWeeks1,
            dagarPerVecka: dagarPerVecka1NoExtra || dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomst(
                    MINIMUM_RATE,
                    dagarPerVecka1NoExtra || dagarPerVecka1,
                    0,
                    barnbidrag,
                    tillägg
                )
            ),
            användaMinDagar: 0
        };

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            const overlapDaysPerWeek = 5;
            plan1Overlap = {
                startWeek: 0,
                weeks: 2,
                dagarPerVecka: overlapDaysPerWeek,
                inkomst: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, extra1, barnbidrag, tillägg)
                ),
                inkomstUtanExtra: Math.round(
                    beräknaMånadsinkomst(dag1, overlapDaysPerWeek, 0, barnbidrag, tillägg)
                )
            };
        }
        unusedFöräldralönWeeks1 = Math.max(0, maxFöräldralönWeeks1 - plan1ExtraWeeks);
    }

    let minDagarWeeks2 = 0;
    let weeks2NoExtra = 0;
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        const maxFöräldralönWeeks = maxFöräldralönWeeks2;
        if (weeks2 > maxFöräldralönWeeks) {
            weeks2NoExtra = Math.round(weeks2 - maxFöräldralönWeeks);
            weeks2 = Math.round(maxFöräldralönWeeks);
        }
        const totalWeeks2 = weeks2 + weeks2NoExtra;
        const initialInkomstDagar2 = förälder2InkomstDagar;
        const dagarBehövda2 = totalWeeks2 * dagarPerVecka2;

        användaInkomstDagar2 = Math.min(dagarBehövda2, initialInkomstDagar2);
        förälder2InkomstDagar -= användaInkomstDagar2;
        användaMinDagar2 = Math.max(0, Math.min(dagarBehövda2 - initialInkomstDagar2, förälder2MinDagar));
        förälder2MinDagar -= användaMinDagar2;
        minDagarWeeks2 = 0;

        plan2ExtraWeeks = extra2 > 0 ? weeks2 : 0;
        plan2NoExtraWeeksTotal = plan2ExtraWeeks > 0 ? weeks2NoExtra : totalWeeks2;

        plan2 = {
            startWeek: plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: plan2ExtraWeeks,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: användaMinDagar2
        };

        const plan2StartNoExtra = plan2.startWeek + plan2ExtraWeeks;
        const extraDaysUsed2 = Math.min(användaInkomstDagar2, Math.round(plan2ExtraWeeks * dagarPerVecka2));
        const noExtraDaysUsed2 = Math.max(0, användaInkomstDagar2 - extraDaysUsed2);
        plan2NoExtra = {
            startWeek: plan2StartNoExtra,
            weeks: plan2NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: noExtraDaysUsed2
        };

        const minDagarWeeks2Dynamic = användaMinDagar2 > 0
            ? Math.max(1, Math.round(användaMinDagar2 / Math.max(dagarPerVecka2, 1)))
            : minDagarWeeks2;
        plan2MinDagar = {
            startWeek: plan2StartNoExtra + plan2NoExtraWeeksTotal,
            weeks: minDagarWeeks2Dynamic,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaMinDagar: användaMinDagar2
        };
        unusedFöräldralönWeeks2 = Math.max(0, maxFöräldralönWeeks2 - plan2ExtraWeeks);
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
        const overlapDays = 10;
        if (overlapDays <= förälder2InkomstDagar) {
            förälder2InkomstDagar -= overlapDays;
            användaInkomstDagar2 += overlapDays;
        } else {
            const remainingOverlapDays = overlapDays - förälder2InkomstDagar;
            användaInkomstDagar2 += förälder2InkomstDagar;
            förälder2InkomstDagar = 0;
            användaMinDagar2 += remainingOverlapDays;
            förälder2MinDagar -= remainingOverlapDays;
        }
        plan2.användaInkomstDagar = användaInkomstDagar2;
        plan2.användaMinDagar = användaMinDagar2;
        plan2MinDagar.användaMinDagar = användaMinDagar2;
    }

    const phase1Incomes = [];
    if (plan1.weeks > 0) phase1Incomes.push(plan1.inkomst + arbetsInkomst2);
    if (plan1NoExtra.weeks > 0) phase1Incomes.push(plan1NoExtra.inkomst + arbetsInkomst2);
    if (plan1MinDagar.weeks > 0) phase1Incomes.push(plan1MinDagar.inkomst + arbetsInkomst2);
    const phase2Incomes = [];
    if (plan2.weeks > 0) phase2Incomes.push(plan2.inkomst + arbetsInkomst1);
    if (plan2NoExtra.weeks > 0) phase2Incomes.push(plan2NoExtra.inkomst + arbetsInkomst1);
    if (plan2MinDagar.weeks > 0) phase2Incomes.push(plan2MinDagar.inkomst + arbetsInkomst1);

    const minPhase1 = phase1Incomes.length ? Math.min(...phase1Incomes) : null;
    const minPhase2 = phase2Incomes.length ? Math.min(...phase2Incomes) : null;

    if (minPhase1 !== null && minPhase1 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase1);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase1.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan1.dagarPerVecka} dagar/vecka).`;
    } else if (minPhase2 !== null && minPhase2 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        const severity = evaluateIncomeSeverity(minPhase2);
        updateStatusFromSeverity(severity || "warning");
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase2.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan2.dagarPerVecka} dagar/vecka).`;
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
        arbetsInkomst2,
        maxFöräldralönWeeks1,
        maxFöräldralönWeeks2,
        unusedFöräldralönWeeks1,
        unusedFöräldralönWeeks2
    };
}
