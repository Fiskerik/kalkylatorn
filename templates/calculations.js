/**
 * calculations.js - Calculation logic for the Föräldrapenningkalkylator
 * Handles parental benefit calculations, child allowances, and leave optimization.
 */
import {
    INCOME_CAP,
    SGI_CAP,
    MINIMUM_RATE,
    FÖRÄLDRALÖN_THRESHOLD,
    DEFAULT_BARNBIDRAG
} from './config.js';

/**
 * Calculate monthly income based on daily rate, days per week, and additional benefits
 * @param {number} dag - Daily parental benefit rate
 * @param {number} dagarPerVecka - Days per week taken
 * @param {number} extra - Parental supplement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional child allowance
 * @returns {number} Rounded monthly income
 */
export function beräknaMånadsinkomst(dag, dagarPerVecka, extra, barnbidrag = DEFAULT_BARNBIDRAG, tillägg = 0) {
    const fp = Math.round((dag * dagarPerVecka * 4.3) / 100) * 100;
    const resultat = fp + (extra || 0) + barnbidrag + tillägg;
    return resultat || 0;
}

/**
 * Calculate monthly income with mixed benefit days
 * @param {number} dagInkomst - Daily rate for income-level days
 * @param {number} inkomstDagarPerVecka - Income-level days per week
 * @param {number} minDagarPerVecka - Minimum-level days per week
 * @param {number} extra - Parental supplement
 * @param {number} barnbidrag - Child allowance
 * @param {number} tillägg - Additional child allowance
 * @returns {number} Rounded monthly income
 */
export function beräknaMånadsinkomstMix(
    dagInkomst,
    inkomstDagarPerVecka,
    minDagarPerVecka,
    extra,
    barnbidrag = DEFAULT_BARNBIDRAG,
    tillägg = 0
) {
    const totalFp =
        dagInkomst * inkomstDagarPerVecka +
        MINIMUM_RATE * minDagarPerVecka;
    const fp = Math.round((totalFp * 4.3) / 100) * 100;
    const resultat = fp + (extra || 0) + barnbidrag + tillägg;
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

    if (inkomst <= FÖRÄLDRALÖN_THRESHOLD) {
        return Math.round(inkomst * 0.10);
    }

    const basal = FÖRÄLDRALÖN_THRESHOLD * 0.10;
    const över = (inkomst - FÖRÄLDRALÖN_THRESHOLD) * 0.90;
    return Math.round(basal + över);
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
export function optimizeParentalLeave(preferences, inputs) {
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst, strategy } = preferences;
    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1Overlap = { startWeek: 0, weeks: 2, dagarPerVecka: 0, inkomst: 0 };
    let genomförbarhet = { ärGenomförbar: true, meddelande: "", transferredDays: 0 };

    const barnbidrag = inputs.barnbidragPerPerson || 1250;
    const tillägg = inputs.tilläggPerPerson || 75;

    const inkomst1 = Number(inputs.inkomst1) || 0;
    const inkomst2 = Number(inputs.inkomst2) || 0;

    if (isNaN(inkomst1) || isNaN(inkomst2) || isNaN(ledigTid1) || isNaN(ledigTid2)) {
        throw new Error("Invalid input values: incomes and leave durations must be numbers.");
    }

    const dag1 = beräknaDaglig(inkomst1);
    const extra1 = inputs.avtal1 === "ja" ? beräknaFöräldralön(inkomst1) : 0;
    const dag2 = inkomst2 > 0 ? beräknaDaglig(inkomst2) : 0;
    const extra2 = inputs.avtal2 === "ja" ? beräknaFöräldralön(inkomst2) : 0;

    let förälder1InkomstDagar = inputs.vårdnad === "ensam" ? 390 : 195;
    let förälder2InkomstDagar = inputs.vårdnad === "ensam" ? 0 : 195;
    let förälder1MinDagar = inputs.vårdnad === "ensam" ? 90 : 45;
    let förälder2MinDagar = inputs.vårdnad === "ensam" ? 0 : 45;
    let användaInkomstDagar1 = 0;
    let användaInkomstDagar2 = 0;
    let användaMinDagar1 = 0;
    let användaMinDagar2 = 0;

    const arbetsInkomst1 = inkomst1 + barnbidrag + tillägg;
    const arbetsInkomst2 = inkomst2 > 0 ? inkomst2 + barnbidrag + tillägg : 0;

    let dagarPerVecka1 = 0;
    let dagarPerVecka2 = 0;
    let inkomstDagarPerVecka1 = 0;
    let minDagarPerVecka1 = 0;
    let inkomstDagarPerVecka2 = 0;
    let minDagarPerVecka2 = 0;
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

    if (weeks1 > 0) {
        let found = false;
        for (let dpv = 1; dpv <= maxDagarPerVecka && !found; dpv++) {
            const maxMin = Math.min(dpv, Math.floor(förälder1MinDagar / weeks1));
            for (let minPer = maxMin; minPer >= 0; minPer--) {
                const incPer = dpv - minPer;
                const inkomstTemp = beräknaMånadsinkomstMix(
                    dag1,
                    incPer,
                    minPer,
                    extra1,
                    barnbidrag,
                    tillägg
                );
                const kombTemp = inkomstTemp + arbetsInkomst2;
                if (kombTemp >= minInkomst) {
                    dagarPerVecka1 = dpv;
                    inkomstDagarPerVecka1 = incPer;
                    minDagarPerVecka1 = minPer;
                    inkomst1Result = inkomstTemp;
                    kombineradInkomst = kombTemp;
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            dagarPerVecka1 = Math.min(maxDagarPerVecka, dagarPerVecka1 || maxDagarPerVecka);
            inkomstDagarPerVecka1 = dagarPerVecka1;
            minDagarPerVecka1 = 0;
            inkomst1Result = beräknaMånadsinkomstMix(
                dag1,
                inkomstDagarPerVecka1,
                0,
                extra1,
                barnbidrag,
                tillägg
            );
            kombineradInkomst = inkomst1Result + arbetsInkomst2;
            if (kombineradInkomst < minInkomst) {
                genomförbarhet.ärGenomförbar = false;
                genomförbarhet.meddelande =
                    `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad ` +
                    `i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad.`;
            }
        }
    }

    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        let found = false;
        for (let dpv = 1; dpv <= maxDagarPerVecka && !found; dpv++) {
            const maxMin = Math.min(dpv, Math.floor(förälder2MinDagar / weeks2));
            for (let minPer = maxMin; minPer >= 0; minPer--) {
                const incPer = dpv - minPer;
                const inkomstTemp = beräknaMånadsinkomstMix(
                    dag2,
                    incPer,
                    minPer,
                    extra2,
                    barnbidrag,
                    tillägg
                );
                const kombTemp = inkomstTemp + arbetsInkomst1;
                if (kombTemp >= minInkomst) {
                    dagarPerVecka2 = dpv;
                    inkomstDagarPerVecka2 = incPer;
                    minDagarPerVecka2 = minPer;
                    inkomst2Result = inkomstTemp;
                    kombineradInkomst = kombTemp;
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            dagarPerVecka2 = Math.min(maxDagarPerVecka, dagarPerVecka2 || maxDagarPerVecka);
            inkomstDagarPerVecka2 = dagarPerVecka2;
            minDagarPerVecka2 = 0;
            inkomst2Result = beräknaMånadsinkomstMix(
                dag2,
                inkomstDagarPerVecka2,
                0,
                extra2,
                barnbidrag,
                tillägg
            );
            kombineradInkomst = inkomst1Result + inkomst2Result;
            if (kombineradInkomst < minInkomst) {
                genomförbarhet.ärGenomförbar = false;
                genomförbarhet.meddelande =
                    `Kombinerad inkomst ${kombineradInkomst.toLocaleString()} kr/månad ` +
                    `i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad.`;
            }
        }
    }

    // Step 3: Allocate days for Period 1 (Förälder 1)
    let minDagarWeeks1 = 0;
    let weeks1NoExtra = 0;
    if (dagarPerVecka1 > 0) {
        const maxFöräldralönWeeks = 6 * 4.3;
        if (weeks1 > maxFöräldralönWeeks) {
            weeks1NoExtra = Math.round(weeks1 - maxFöräldralönWeeks);
            weeks1 = Math.round(maxFöräldralönWeeks);
        }
        const totWeeks1 = weeks1 + weeks1NoExtra;
        användaInkomstDagar1 = inkomstDagarPerVecka1 * totWeeks1;
        användaMinDagar1 = minDagarPerVecka1 * totWeeks1;
        förälder1InkomstDagar -= användaInkomstDagar1;
        förälder1MinDagar -= användaMinDagar1;

        plan1 = {
            startWeek: 0,
            weeks: totWeeks1,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomstMix(
                    dag1,
                    inkomstDagarPerVecka1,
                    minDagarPerVecka1,
                    extra1,
                    barnbidrag,
                    tillägg
                )
            ),
            inkomstUtanExtra: Math.round(
                beräknaMånadsinkomstMix(
                    dag1,
                    inkomstDagarPerVecka1,
                    minDagarPerVecka1,
                    0,
                    barnbidrag,
                    tillägg
                )
            ),
            användaInkomstDagar: användaInkomstDagar1,
            användaMinDagar: användaMinDagar1
        };

        plan1NoExtra = {
            startWeek: weeks1,
            weeks: weeks1NoExtra,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomstMix(
                    dag1,
                    inkomstDagarPerVecka1,
                    minDagarPerVecka1,
                    0,
                    barnbidrag,
                    tillägg
                )
            )
        };

        plan1MinDagar = {
            startWeek: weeks1 + weeks1NoExtra,
            weeks: minDagarWeeks1,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(
                beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka1, 0, barnbidrag, tillägg)
            )
        };

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            plan1Overlap = {
                startWeek: 0,
                weeks: 2,
                dagarPerVecka: dagarPerVecka1,
                inkomst: Math.round(
                    beräknaMånadsinkomstMix(
                        dag1,
                        inkomstDagarPerVecka1,
                        minDagarPerVecka1,
                        extra1,
                        barnbidrag,
                        tillägg
                    )
                )
            };
        }
    }

    // Step 4: Allocate days for Period 2 (Förälder 2)
    let minDagarWeeks2 = 0;
    let weeks2NoExtra = 0;
    if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja" && weeks2 > 0) {
        const maxFöräldralönWeeks = 6 * 4.3;
        if (weeks2 > maxFöräldralönWeeks) {
            weeks2NoExtra = Math.round(weeks2 - maxFöräldralönWeeks);
            weeks2 = Math.round(maxFöräldralönWeeks);
        }
        const totWeeks2 = weeks2 + weeks2NoExtra;
        användaInkomstDagar2 = inkomstDagarPerVecka2 * totWeeks2;
        användaMinDagar2 = minDagarPerVecka2 * totWeeks2;
        förälder2InkomstDagar -= användaInkomstDagar2;
        förälder2MinDagar -= användaMinDagar2;

        plan2 = {
            startWeek: weeks1 + weeks1NoExtra,
            weeks: totWeeks2,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(
                beräknaMånadsinkomstMix(
                    dag2,
                    inkomstDagarPerVecka2,
                    minDagarPerVecka2,
                    extra2,
                    barnbidrag,
                    tillägg
                )
            ),
            inkomstUtanExtra: Math.round(
                beräknaMånadsinkomstMix(
                    dag2,
                    inkomstDagarPerVecka2,
                    minDagarPerVecka2,
                    0,
                    barnbidrag,
                    tillägg
                )
            ),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: användaMinDagar2
        };

        plan2NoExtra = {
            startWeek: weeks1 + weeks1NoExtra + weeks2,
            weeks: weeks2NoExtra,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(
                beräknaMånadsinkomstMix(
                    dag2,
                    inkomstDagarPerVecka2,
                    minDagarPerVecka2,
                    0,
                    barnbidrag,
                    tillägg
                )
            )
        };

        plan2MinDagar = {
            startWeek: weeks1 + weeks1NoExtra + weeks2 + weeks2NoExtra,
            weeks: minDagarWeeks2,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(
                beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka2, 0, barnbidrag, tillägg)
            )
        };
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
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase1.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad.`;
    } else if (minPhase2 !== null && minPhase2 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase2.toLocaleString()} kr/månad i fas 2 är under kravet ${minInkomst.toLocaleString()} kr/månad.`;
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
        arbetsInkomst2
    };
}
