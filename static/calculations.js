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

export function optimizeParentalLeave(preferences, inputs, options = {}) {
    const { maximizeFöräldralön = false } = options;
    const { deltid, ledigTid1, ledigTid2 = 0, minInkomst, strategy } = preferences;

export function optimizeParentalLeave(preferences, inputs) {
    const {
        deltid,
        ledigTid1,
        ledigTid2 = 0,
        minInkomst,
        strategy,
        maximizeFöräldralön = false
    } = preferences;

    let plan1 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan1NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2 = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0, inkomstUtanExtra: 0, användaInkomstDagar: 0, användaMinDagar: 0 };
    let plan2NoExtra = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan2MinDagar = { startWeek: 0, weeks: 0, dagarPerVecka: 0, inkomst: 0 };
    let plan1Overlap = { startWeek: 0, weeks: 2, dagarPerVecka: 5, inkomst: 0 };
    let plan1ExtraWeeks = 0;
    let plan1NoExtraWeeksTotal = 0;
    let plan2ExtraWeeks = 0;
    let plan2NoExtraWeeksTotal = 0;
    let plan1Savings = { total: 0, perMonth: 0, weeks: 0, months: 0 };
    let plan2Savings = { total: 0, perMonth: 0, weeks: 0, months: 0 };
    let genomförbarhet = {
        ärGenomförbar: true,
        meddelande: "",
        transferredDays: 0,
        status: "ok"
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
    let dagarPerVecka2 = 0;

    const totalWeeks1 = Math.max(Math.round(ledigTid1 * 4.3), 0);
    const totalWeeks2 = Math.max(Math.round(ledigTid2 * 4.3), 0);
    const overlapWeeks1 = 2;
    const overlapDays1 = overlapWeeks1 * 5;
    let overlapInkomstDagar1 = 0;
    let weeks1 = Math.max(totalWeeks1 - overlapWeeks1, 0);
    let weeks2 = totalWeeks2;
    if (overlapDays1 > 0) {
        overlapInkomstDagar1 = Math.min(overlapDays1, förälder1InkomstDagar);
        förälder1InkomstDagar -= overlapInkomstDagar1;
        användaInkomstDagar1 += overlapInkomstDagar1;
    }

    let plan1OriginalDaysPerWeek = 0;
    let plan2OriginalDaysPerWeek = 0;
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
            genomförbarhet.status = "warning";
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
            genomförbarhet.status = "warning";
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
        const dagarBehövda1 = totalWeeks1 * dagarPerVecka1;

        användaInkomstDagar1 = dagarBehövda1;
        förälder1InkomstDagar -= användaInkomstDagar1;
        användaMinDagar1 = 0;
        minDagarWeeks1 = 0;

        plan1ExtraWeeks = extra1 > 0 ? weeks1 : 0;
        plan1NoExtraWeeksTotal = plan1ExtraWeeks > 0 ? weeks1NoExtra : totalWeeks1;

        plan1 = {
            startWeek: overlapWeeks1,
            weeks: plan1ExtraWeeks,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, extra1, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar1,
            användaMinDagar: användaMinDagar1
        };
        plan1OriginalDaysPerWeek = plan1.dagarPerVecka;

        if (overlapInkomstDagar1 > 0) {
            plan1.användaInkomstDagar += overlapInkomstDagar1;
        }

        plan1NoExtra = {
            startWeek: overlapWeeks1 + plan1ExtraWeeks,
            weeks: plan1NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(dag1, dagarPerVecka1, 0, barnbidrag, tillägg))
        };

        if (plan1NoExtraWeeksTotal > 0) {
            const nuInkomst = plan1NoExtra.inkomst + arbetsInkomst2;
            if (nuInkomst < minInkomst) {
                const mål = minInkomst - arbetsInkomst2;
                let önskadeDagar = dagarPerVecka1;
                while (
                    önskadeDagar < maxDagarPerVecka &&
                    beräknaMånadsinkomst(dag1, önskadeDagar, 0, barnbidrag, tillägg) < mål
                ) {
                    önskadeDagar += 1;
                }
                const extraDagar =
                    (önskadeDagar - dagarPerVecka1) * plan1NoExtraWeeksTotal;
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
                    dagarPerVecka1 += Math.floor(
                        lånade / plan1NoExtraWeeksTotal
                    );
                    plan1.dagarPerVecka = dagarPerVecka1;
                    plan1.inkomst = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1,
                            extra1,
                            barnbidrag,
                            tillägg
                        )
                    );
                    plan1.inkomstUtanExtra = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1,
                            0,
                            barnbidrag,
                            tillägg
                        )
                    );
                    plan1NoExtra.dagarPerVecka = dagarPerVecka1;
                    plan1NoExtra.inkomst = Math.round(
                        beräknaMånadsinkomst(
                            dag1,
                            dagarPerVecka1,
                            0,
                            barnbidrag,
                            tillägg
                        )
                    );
                    plan1.användaInkomstDagar = användaInkomstDagar1;
                }
                const kombEfter = plan1NoExtra.inkomst + arbetsInkomst2;
                if (kombEfter < minInkomst) {
                    genomförbarhet.ärGenomförbar = false;
                    genomförbarhet.status = "warning";
                    genomförbarhet.meddelande =
                        `Kombinerad inkomst ${kombEfter.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${dagarPerVecka1} dagar/vecka).`;
                }
            }
        }

        plan1MinDagar = {
            startWeek: overlapWeeks1 + plan1ExtraWeeks + plan1NoExtraWeeksTotal,
            weeks: minDagarWeeks1,
            dagarPerVecka: dagarPerVecka1,
            inkomst: Math.round(beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka1, 0, barnbidrag, tillägg))
        };


        plan1Overlap = {
            startWeek: 0,
            weeks: overlapWeeks1,
            dagarPerVecka: overlapWeeks1 > 0 ? 5 : 0,
            inkomst: overlapWeeks1 > 0 && dag1 > 0
                ? Math.round(beräknaMånadsinkomst(dag1, 5, extra1, barnbidrag, tillägg))
                : 0,
            användaInkomstDagar: overlapInkomstDagar1
        };

        if (inputs.vårdnad === "gemensam" && inputs.beräknaPartner === "ja") {
            const overlapDaysPerWeek = 5;
            plan1Overlap = {
                startWeek: 0,
                weeks: 2,
                dagarPerVecka: overlapDaysPerWeek,
                inkomst: Math.round(beräknaMånadsinkomst(dag1, overlapDaysPerWeek, extra1, barnbidrag, tillägg))
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
        const dagarBehövda2 = totalWeeks2 * dagarPerVecka2;

        användaInkomstDagar2 = dagarBehövda2;
        förälder2InkomstDagar -= användaInkomstDagar2;
        användaMinDagar2 = 0;
        minDagarWeeks2 = 0;

        plan2ExtraWeeks = extra2 > 0 ? weeks2 : 0;
        plan2NoExtraWeeksTotal = plan2ExtraWeeks > 0 ? weeks2NoExtra : totalWeeks2;

        plan2 = {
            startWeek: overlapWeeks1 + plan1ExtraWeeks + plan1NoExtraWeeksTotal + minDagarWeeks1,
            weeks: plan2ExtraWeeks,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, extra2, barnbidrag, tillägg)),
            inkomstUtanExtra: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg)),
            användaInkomstDagar: användaInkomstDagar2,
            användaMinDagar: användaMinDagar2
        };
        plan2OriginalDaysPerWeek = plan2.dagarPerVecka;

        const plan2StartNoExtra = plan2.startWeek + plan2ExtraWeeks;
        plan2NoExtra = {
            startWeek: plan2StartNoExtra,
            weeks: plan2NoExtraWeeksTotal,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(dag2, dagarPerVecka2, 0, barnbidrag, tillägg))
        };

        plan2MinDagar = {
            startWeek: plan2StartNoExtra + plan2NoExtraWeeksTotal,
            weeks: minDagarWeeks2,
            dagarPerVecka: dagarPerVecka2,
            inkomst: Math.round(beräknaMånadsinkomst(MINIMUM_RATE, dagarPerVecka2, 0, barnbidrag, tillägg))
        };
        unusedFöräldralönWeeks2 = Math.max(0, maxFöräldralönWeeks2 - plan2ExtraWeeks);
    }

    if (
        maximizeFöräldralön &&
        plan1.weeks > 0 &&
        extra1 > 0 &&
        maxFöräldralönWeeks1 > 0
    ) {
        const baselineDaysPerWeek = Math.max(1, plan1OriginalDaysPerWeek || plan1.dagarPerVecka || 1);
        const targetWeeks = Math.min(plan1.weeks, Math.round(maxFöräldralönWeeks1));
        const maximizedIncome = Math.round(
            beräknaMånadsinkomst(dag1, 7, extra1, barnbidrag, tillägg)
        );
        const baselineIncome = Math.round(
            beräknaMånadsinkomst(dag1, baselineDaysPerWeek, extra1, barnbidrag, tillägg)
        );
        const additionalDays = Math.max(0, targetWeeks * (7 - baselineDaysPerWeek));
        if (additionalDays > 0) {
            plan1.dagarPerVecka = 7;
            plan1.inkomst = maximizedIncome;
            plan1.inkomstUtanExtra = Math.round(
                beräknaMånadsinkomst(dag1, 7, 0, barnbidrag, tillägg)
            );
            plan1.användaInkomstDagar += additionalDays;
            förälder1InkomstDagar = Math.max(0, förälder1InkomstDagar - additionalDays);
        }
        const totalSavings = Math.max(0, maximizedIncome - baselineIncome) * (targetWeeks / 4.3);
        const savingsWeeks = (plan1NoExtra.weeks || 0) + (plan1MinDagar.weeks || 0);
        const savingsMonths = savingsWeeks / 4.3;
        const perMonth = savingsMonths > 0 ? Math.round(totalSavings / savingsMonths) : 0;
        plan1Savings = {
            total: Math.round(totalSavings),
            perMonth,
            weeks: savingsWeeks,
            months: savingsMonths
        };
        if (plan1NoExtra.weeks > 0) {
            plan1NoExtra.dagarPerVecka = baselineDaysPerWeek;
            plan1NoExtra.inkomst = Math.round(
                beräknaMånadsinkomst(dag1, baselineDaysPerWeek, 0, barnbidrag, tillägg)
            );
        }
        if (plan1MinDagar.weeks > 0) {
            plan1MinDagar.dagarPerVecka = baselineDaysPerWeek;
            plan1MinDagar.inkomst = Math.round(
                beräknaMånadsinkomst(MINIMUM_RATE, baselineDaysPerWeek, 0, barnbidrag, tillägg)
            );
        }
        if (perMonth > 0) {
            plan1NoExtra.savingsPerMonth = perMonth;
            plan1MinDagar.savingsPerMonth = perMonth;
        }
    }

    if (
        maximizeFöräldralön &&
        plan2.weeks > 0 &&
        extra2 > 0 &&
        maxFöräldralönWeeks2 > 0
    ) {
        const baselineDaysPerWeek = Math.max(1, plan2OriginalDaysPerWeek || plan2.dagarPerVecka || 1);
        const targetWeeks = Math.min(plan2.weeks, Math.round(maxFöräldralönWeeks2));
        const maximizedIncome = Math.round(
            beräknaMånadsinkomst(dag2, 7, extra2, barnbidrag, tillägg)
        );
        const baselineIncome = Math.round(
            beräknaMånadsinkomst(dag2, baselineDaysPerWeek, extra2, barnbidrag, tillägg)
        );
        const additionalDays = Math.max(0, targetWeeks * (7 - baselineDaysPerWeek));
        if (additionalDays > 0) {
            plan2.dagarPerVecka = 7;
            plan2.inkomst = maximizedIncome;
            plan2.inkomstUtanExtra = Math.round(
                beräknaMånadsinkomst(dag2, 7, 0, barnbidrag, tillägg)
            );
            plan2.användaInkomstDagar += additionalDays;
            förälder2InkomstDagar = Math.max(0, förälder2InkomstDagar - additionalDays);
        }
        const totalSavings = Math.max(0, maximizedIncome - baselineIncome) * (targetWeeks / 4.3);
        const savingsWeeks = (plan2NoExtra.weeks || 0) + (plan2MinDagar.weeks || 0);
        const savingsMonths = savingsWeeks / 4.3;
        const perMonth = savingsMonths > 0 ? Math.round(totalSavings / savingsMonths) : 0;
        plan2Savings = {
            total: Math.round(totalSavings),
            perMonth,
            weeks: savingsWeeks,
            months: savingsMonths
        };
        if (plan2NoExtra.weeks > 0) {
            plan2NoExtra.dagarPerVecka = baselineDaysPerWeek;
            plan2NoExtra.inkomst = Math.round(
                beräknaMånadsinkomst(dag2, baselineDaysPerWeek, 0, barnbidrag, tillägg)
            );
        }
        if (plan2MinDagar.weeks > 0) {
            plan2MinDagar.dagarPerVecka = baselineDaysPerWeek;
            plan2MinDagar.inkomst = Math.round(
                beräknaMånadsinkomst(MINIMUM_RATE, baselineDaysPerWeek, 0, barnbidrag, tillägg)
            );
        }
        if (perMonth > 0) {
            plan2NoExtra.savingsPerMonth = perMonth;
            plan2MinDagar.savingsPerMonth = perMonth;
        }
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

    const maximizationResult = { parent1: null, parent2: null };

    if (maximizeFöräldralön) {
        if (extra1 > 0 && plan1.weeks > 0) {
            const forcedDays = 7;
            const forcedIncome = Math.round(beräknaMånadsinkomst(dag1, forcedDays, extra1, barnbidrag, tillägg));
            const baseIncome = plan1.inkomst || 0;
            const extraPerMonth = forcedIncome - baseIncome;
            const monthsExtra = plan1.weeks / 4.3;
            const totalExtra = Math.round(extraPerMonth * monthsExtra);
            const remainingWeeks = (plan1NoExtra.weeks || 0) + (plan1MinDagar.weeks || 0);
            const monthsRemaining = remainingWeeks / 4.3;
            const bufferPerMonth = monthsRemaining > 0 && totalExtra > 0
                ? Math.round(totalExtra / monthsRemaining)
                : 0;
            const bufferLabel = bufferPerMonth > 0
                ? `Förälder 1: ${bufferPerMonth.toLocaleString('sv-SE')} kr/månad i buffert under ${monthsRemaining.toFixed(1)} månader.`
                : '';
            maximizationResult.parent1 = {
                forcedDaysPerWeek: forcedDays,
                forcedIncome,
                extraPerMonth,
                totalExtra,
                bufferPerMonth,
                bufferWeeks: remainingWeeks,
                bufferLabel
            };
        }

        if (extra2 > 0 && plan2.weeks > 0) {
            const forcedDays = 7;
            const forcedIncome = Math.round(beräknaMånadsinkomst(dag2, forcedDays, extra2, barnbidrag, tillägg));
            const baseIncome = plan2.inkomst || 0;
            const extraPerMonth = forcedIncome - baseIncome;
            const monthsExtra = plan2.weeks / 4.3;
            const totalExtra = Math.round(extraPerMonth * monthsExtra);
            const remainingWeeks = (plan2NoExtra.weeks || 0) + (plan2MinDagar.weeks || 0);
            const monthsRemaining = remainingWeeks / 4.3;
            const bufferPerMonth = monthsRemaining > 0 && totalExtra > 0
                ? Math.round(totalExtra / monthsRemaining)
                : 0;
            const bufferLabel = bufferPerMonth > 0
                ? `Förälder 2: ${bufferPerMonth.toLocaleString('sv-SE')} kr/månad i buffert under ${monthsRemaining.toFixed(1)} månader.`
                : '';
            maximizationResult.parent2 = {
                forcedDaysPerWeek: forcedDays,
                forcedIncome,
                extraPerMonth,
                totalExtra,
                bufferPerMonth,
                bufferWeeks: remainingWeeks,
                bufferLabel
            };
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
        genomförbarhet.meddelande = `Kombinerad inkomst ${minPhase1.toLocaleString()} kr/månad i fas 1 är under kravet ${minInkomst.toLocaleString()} kr/månad (med ${plan1.dagarPerVecka} dagar/vecka).`;
    } else if (minPhase2 !== null && minPhase2 < minInkomst) {
        genomförbarhet.ärGenomförbar = false;
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
        unusedFöräldralönWeeks2,

        maximization: maximizationResult

        plan1Savings,
        plan2Savings

    };
}
