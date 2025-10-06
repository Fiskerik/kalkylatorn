/**
 * chart.js - Chart rendering for the Föräldrapenningkalkylator
 * Renders an interactive Gantt chart showing parental leave schedules and income.
 */
(function initChart(global) {
    if (global.chartUtils) {
        return;
    }

    const { calculationUtils = {} } = global;
    const { beräknaMånadsinkomst = () => 0 } = calculationUtils;

    /**
     * Render the Gantt chart
     * @param {Object} plan1 - Plan for Parent 1
     * @param {Object} plan2 - Plan for Parent 2
     * @param {Object} plan1NoExtra - Plan 1 without extra
     * @param {Object} plan2NoExtra - Plan 1 without extra
     * @param {Object} plan1MinDagar - Plan 1 minimum days
     * @param {Object} plan2MinDagar - Plan 2 minimum days
     * @param {Object} plan1Overlap - Overlap plan
     * @param {number} inkomst1 - Income for Parent 1
     * @param {number} inkomst2 - Income for Parent 2
     * @param {string} vårdnad - Custody type
     * @param {string} beräknaPartner - Calculate for partner
     * @param {Object} genomförbarhet - Feasibility data
     * @param {number} dag1 - Daily rate for Parent 1
     * @param {number} extra1 - Extra for Parent 1
     * @param {number} dag2 - Daily rate for Parent 2
     * @param {number} extra2 - Extra for Parent 2
     * @param {number} förälder1InkomstDagar - Income days for Parent 1
     * @param {number} förälder2InkomstDagar - Income days for Parent 2
     * @param {number} förälder1MinDagar - Minimum days for Parent 1
     * @param {number} förälder2MinDagar - Minimum days for Parent 2
     * @param {string} barnDatum - Child's birth date
     * @param {number} arbetsInkomst1 - Work income for Parent 1
     * @param {number} arbetsInkomst2 - Work income for Parent 2
     * @param {number} barnbidragPerPerson - Child allowance per parent
     * @param {number} tilläggPerPerson - Additional allowance per parent
     * @param {number} maxFöräldralönWeeks1 - Allowed weeks with parental salary for Parent 1
 * @param {number} maxFöräldralönWeeks2 - Allowed weeks with parental salary for Parent 2
 * @param {number} unusedFöräldralönWeeks1 - Unused parental salary weeks for Parent 1
 * @param {number} unusedFöräldralönWeeks2 - Unused parental salary weeks for Parent 2
 */
    function renderGanttChart(
    plan1,
    plan2,
    plan1NoExtra,
    plan2NoExtra,
    plan1MinDagar,
    plan2MinDagar,
    plan1Overlap,
    inkomst1,
    inkomst2,
    vårdnad,
    beräknaPartner,
    genomförbarhet,
    dag1,
    extra1,
    dag2,
    extra2,
    förälder1InkomstDagar,
    förälder2InkomstDagar,
    förälder1MinDagar,
    förälder2MinDagar,
    barnDatum,
    arbetsInkomst1,
    arbetsInkomst2,
    barnbidragPerPerson,
    tilläggPerPerson,
    maxFöräldralönWeeks1,
    maxFöräldralönWeeks2,
    unusedFöräldralönWeeks1,
    unusedFöräldralönWeeks2,
    maximization = null
) {
    const ganttChart = document.getElementById('gantt-chart');
    if (!ganttChart) {
        console.error("renderGanttChart - gantt-chart element hittades inte");
        return;
    }

    ganttChart.innerHTML = '';
    const messageDiv = document.createElement('div');
    const canvas = document.createElement('canvas');
    canvas.id = 'gantt-canvas';
    canvas.style.width = '100%';
    canvas.style.maxWidth = '1200px';
    canvas.style.height = '400px';

    // Create summary box
    const summaryBox = document.createElement('div');
    summaryBox.id = 'summary-box';
    summaryBox.style.marginTop = '15px';
    summaryBox.style.padding = '10px';
    summaryBox.style.border = '1px solid #ccc';
    summaryBox.style.borderRadius = '5px';
    summaryBox.style.fontFamily = 'Inter, sans-serif';
    summaryBox.style.backgroundColor = '#f9f9f9';
    summaryBox.style.height = '300px'; // Fixed height to fit all data
    summaryBox.style.minHeight = '300px';
    summaryBox.style.overflowY = 'auto'; // Scroll if content overflows
    summaryBox.innerHTML = '<p>Hovra över en punkt för att se detaljer.</p>';

    const maximizationData = maximization || {};
    const parent1Max = maximizationData.parent1 || null;
    const parent2Max = maximizationData.parent2 || null;
    const parent1ForcedDays = parent1Max?.forcedDaysPerWeek || null;
    const parent2ForcedDays = parent2Max?.forcedDaysPerWeek || null;
    const parent1ForcedIncome = parent1Max?.forcedIncome || null;
    const parent2ForcedIncome = parent2Max?.forcedIncome || null;
    const parent1BufferPerMonth = parent1Max?.bufferPerMonth || 0;
    const parent2BufferPerMonth = parent2Max?.bufferPerMonth || 0;
    const parent1BufferWeeks = parent1Max?.bufferWeeks || 0;
    const parent2BufferWeeks = parent2Max?.bufferWeeks || 0;
    const parent1BufferText = parent1Max?.bufferLabel || '';
    const parent2BufferText = parent2Max?.bufferLabel || '';

    const period1ExtraWeeks = plan1.weeks || 0;
    const period1NoExtraWeeks = plan1NoExtra.weeks || 0;
    const period1MinWeeks = plan1MinDagar.weeks || 0;
    const period2ExtraWeeks = plan2.weeks || 0;
    const period2NoExtraWeeks = plan2NoExtra.weeks || 0;
    const period2MinWeeks = plan2MinDagar.weeks || 0;

    const period1OverlapWeeks = plan1Overlap.weeks || 0;

    const baseWeeks1 = period1ExtraWeeks + period1NoExtraWeeks;
    const transferredDays = genomförbarhet.transferredDays || 0;
    const effectivePlan1Days = parent1ForcedDays || plan1.dagarPerVecka;
    const transferredWeeks = transferredDays > 0 && effectivePlan1Days > 0 ? Math.ceil(transferredDays / effectivePlan1Days) : 0;
    const transferredStartWeek = transferredWeeks > 0
        ? dadLeaveDurationWeeks + Math.max(0, baseWeeks1 - transferredWeeks)
        : dadLeaveDurationWeeks + baseWeeks1;
    const parent1BufferStartWeek = dadLeaveDurationWeeks + period1ExtraWeeks;
    const parent1BufferTotalWeeks = parent1BufferWeeks > 0 ? Math.round(parent1BufferWeeks) : 0;
    const parent1BufferEndWeek = parent1BufferStartWeek + parent1BufferTotalWeeks;
    const parent2BufferStartWeek = dadLeaveDurationWeeks + period1TotalWeeks + period2ExtraWeeks;
    const parent2BufferTotalWeeks = parent2BufferWeeks > 0 ? Math.round(parent2BufferWeeks) : 0;
    const parent2BufferEndWeek = parent2BufferStartWeek + parent2BufferTotalWeeks;

    const period1OverlapWeeks = plan1Overlap.weeks || 0;

    const baseWeeks1 = period1ExtraWeeks + period1NoExtraWeeks;
    const transferredDays = genomförbarhet.transferredDays || 0;
    const transferredWeeks = transferredDays > 0 && plan1.dagarPerVecka > 0 ? Math.ceil(transferredDays / plan1.dagarPerVecka) : 0;
    const transferredStartWeek = transferredWeeks > 0 ? Math.max(0, baseWeeks1 - transferredWeeks) : baseWeeks1;
    const savingsColor = '#f28c38';
    const transferredColor = '#c47b34';


    let startDate = barnDatum ? new Date(barnDatum) : new Date();
    if (isNaN(startDate.getTime())) {
        console.warn("Invalid barnDatum provided, using current date:", barnDatum);
        startDate = new Date();
    }
    startDate.setHours(0, 0, 0, 0);

    const period1Start = new Date(startDate);
    let period1TotalWeeks = baseWeeks1 + period1MinWeeks;
    const period1End = new Date(period1Start);
    period1End.setDate(period1End.getDate() + (period1TotalWeeks * 7) - 1);

    const dadLeaveStart = new Date(startDate);
    const dadLeaveDurationDays = 10;
    const dadLeaveEnd = new Date(dadLeaveStart);
    dadLeaveEnd.setDate(dadLeaveEnd.getDate() + dadLeaveDurationDays - 1);
    const dadLeaveDurationWeeks = Math.ceil(dadLeaveDurationDays / 7);

    const period2Start = new Date(period1End);
    period2Start.setDate(period2Start.getDate() + 1);

    const period2TotalWeeks = period2ExtraWeeks + period2NoExtraWeeks + period2MinWeeks;
    const period2End = new Date(period2Start);
    period2End.setDate(period2End.getDate() + (period2TotalWeeks * 7) - 1);

    const totalaWeeks = Math.max(dadLeaveDurationWeeks + period1TotalWeeks + period2TotalWeeks, 60);

    const period2TotalWeeks = period2ExtraWeeks + period2NoExtraWeeks + period2MinWeeks;
    const period2End = new Date(period2Start);
    period2End.setDate(period2End.getDate() + (period2TotalWeeks * 7) - 1);

    const totalaWeeks = Math.max(period1TotalWeeks + period2TotalWeeks, 60);

    const hasSavingsHighlight1 = plan1SavingsPerMonth > 0 && plan1SavingsWeeks > 0;
    const hasSavingsHighlight2 = plan2SavingsPerMonth > 0 && plan2SavingsWeeks > 0;
    const savingsHighlightStart1 = period1ExtraWeeks;
    const savingsHighlightEnd1 = savingsHighlightStart1 + (hasSavingsHighlight1 ? plan1SavingsWeeks : 0);
    const savingsHighlightStart2 = period1TotalWeeks + period2ExtraWeeks;
    const savingsHighlightEnd2 = savingsHighlightStart2 + (hasSavingsHighlight2 ? plan2SavingsWeeks : 0);


    const weekLabels = [];
    const monthLabels = new Array(totalaWeeks).fill('');
    const date = new Date(startDate);
    const weekStartDates = [];

    for (let i = 0; i < totalaWeeks; i++) {
        const weekStart = new Date(date);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(date);
        weekEnd.setDate(weekEnd.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        const weekLabel = `${weekStart.toLocaleString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })} - ${weekEnd.toLocaleString('sv-SE', { day: 'numeric', month: 'short', year: 'numeric' })}`;
        weekLabels.push(weekLabel);
        weekStartDates.push(weekStart);
        date.setDate(date.getDate() + 7);
    }

    let currentMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    currentMonth.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + totalaWeeks * 7 + 7);
    endDate.setHours(0, 0, 0, 0);

    while (currentMonth <= endDate) {
        const monthLabel = currentMonth.toLocaleString('sv-SE', { month: 'long', year: 'numeric' });
        const monthFirst = new Date(currentMonth);
        monthFirst.setHours(0, 0, 0, 0);
        let closestWeekIndex = 0;
        for (let i = 0; i < weekStartDates.length; i++) {
            const weekStart = weekStartDates[i];
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (monthFirst >= weekStart && monthFirst <= weekEnd) {
                closestWeekIndex = i;
                break;
            }
            if (monthFirst > weekEnd && weekEnd >= weekStartDates[closestWeekIndex]) {
                closestWeekIndex = i;
            }
        }
        if (!monthLabels[closestWeekIndex]) {
            monthLabels[closestWeekIndex] = monthLabel;
        }
        currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    const criticalWeeks = [13, 17, 21, 35, 39, 43, 47];
    for (const week of criticalWeeks) {
        if (monthLabels[week] && !monthLabels.slice(0, week).includes(monthLabels[week])) {
            for (let i = week - 1; i >= 0; i--) {
                if (!monthLabels[i]) {
                    monthLabels[i] = monthLabels[week];
                    monthLabels[week] = '';
                    break;
                }
            }
        }
    }

    const safeDagarPerVecka = (value) => value > 0 ? value : 1;
    const normalizeDaysPerWeek = (value, enforceMinimum = false) => {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0) {
            return enforceMinimum ? safeDagarPerVecka(0) : 0;
        }
        return enforceMinimum ? safeDagarPerVecka(numeric) : numeric;
    };

    const calculateLeaveComponents = (dailyRate, dagarPerVecka, extraBelopp, { includeBenefits = true, enforceMinimum = false } = {}) => {
        const daysPerWeek = normalizeDaysPerWeek(dagarPerVecka, enforceMinimum);
        const fpGross = Math.round((dailyRate * daysPerWeek * 4.3) / 100) * 100;
        const extraGross = extraBelopp ? Math.round(extraBelopp * (daysPerWeek / 7)) : 0;
        return {
            fp: beräknaNetto(fpGross),
            extra: beräknaNetto(extraGross),
            barnbidrag: includeBenefits ? barnbidragPerPerson : 0,
            tillägg: includeBenefits ? tilläggPerPerson : 0,
            lön: 0
        };
    };

    const calculateWorkComponents = (arbetsInkomst, { includeBenefits = true } = {}) => {
        const benefitsTotal = includeBenefits ? barnbidragPerPerson + tilläggPerPerson : 0;
        const netSalary = Math.max(0, (arbetsInkomst || 0) - benefitsTotal);
        return {
            fp: 0,
            extra: 0,
            barnbidrag: includeBenefits ? barnbidragPerPerson : 0,
            tillägg: includeBenefits ? tilläggPerPerson : 0,
            lön: netSalary
        };
    };

    const createBaseComponents = (includeBenefits = true) => ({
        fp: 0,
        extra: 0,
        barnbidrag: includeBenefits ? barnbidragPerPerson : 0,
        tillägg: includeBenefits ? tilläggPerPerson : 0,
        lön: 0
    });

    const includePartner = vårdnad === 'gemensam' && beräknaPartner === 'ja';

    const calculateWorkComponents = (arbetsInkomst, { includeBenefits = true } = {}) => {
        const benefitsTotal = includeBenefits ? barnbidragPerPerson + tilläggPerPerson : 0;
        const netSalary = Math.max(0, (arbetsInkomst || 0) - benefitsTotal);
        return {
            fp: 0,
            extra: 0,
            barnbidrag: includeBenefits ? barnbidragPerPerson : 0,
            tillägg: includeBenefits ? tilläggPerPerson : 0,
            lön: netSalary,

            buffert: 0

            sparade: 0

        };
    };

    const createBaseComponents = (includeBenefits = true) => ({
        fp: 0,
        extra: 0,
        barnbidrag: includeBenefits ? barnbidragPerPerson : 0,
        tillägg: includeBenefits ? tilläggPerPerson : 0,
        lön: 0,
        buffert: 0
    });

    const includePartner = vårdnad === 'gemensam' && beräknaPartner === 'ja';

    const overlapDaysPerWeek1 = plan1Overlap?.dagarPerVecka || 5;
    const safePlan1Days = parent1ForcedDays || safeDagarPerVecka(plan1.dagarPerVecka);
    const safePlan1NoExtraDays = safeDagarPerVecka(plan1NoExtra.dagarPerVecka);
    const safePlan1MinDays = safeDagarPerVecka(plan1MinDagar.dagarPerVecka);
    const safePlan2Days = parent2ForcedDays || safeDagarPerVecka(plan2.dagarPerVecka);
    const safePlan2NoExtraDays = safeDagarPerVecka(plan2NoExtra.dagarPerVecka);
    const safePlan2MinDays = safeDagarPerVecka(plan2MinDagar.dagarPerVecka);

    const period1Förälder1Inkomst = parent1ForcedIncome ?? (plan1.inkomst || 0);
    const period1NoExtraFörälder1Inkomst = (plan1NoExtra.inkomst || 0) + parent1BufferPerMonth;
    const period1MinFörälder1Inkomst = beräknaMånadsinkomst(180, safePlan1MinDays, 0, barnbidragPerPerson, tilläggPerPerson) + parent1BufferPerMonth;
    const period1OverlapFörälder1Inkomst = dag1 > 0 ? beräknaMånadsinkomst(dag1, overlapDaysPerWeek1, extra1, barnbidragPerPerson, tilläggPerPerson) : 0;
    const period1Förälder2Inkomst = arbetsInkomst2 || 0;

    const period2Förälder1Inkomst = arbetsInkomst1 || 0;
    const period2Förälder2Inkomst = parent2ForcedIncome ?? (plan2.inkomst || 0);
    const period2NoExtraFörälder2Inkomst = (plan2NoExtra.inkomst || 0) + parent2BufferPerMonth;
    const period2MinFörälder2Inkomst = beräknaMånadsinkomst(180, safePlan2MinDays, 0, barnbidragPerPerson, tilläggPerPerson) + parent2BufferPerMonth;

    const period1KombExtra = period1Förälder1Inkomst + period1Förälder2Inkomst;
    const period1KombNoExtra = period1NoExtraFörälder1Inkomst + period1Förälder2Inkomst;
    const period1KombMin = period1MinFörälder1Inkomst + period1Förälder2Inkomst;
    const period2KombExtra = period2Förälder1Inkomst + period2Förälder2Inkomst;
    const period2KombNoExtra = period2Förälder1Inkomst + period2NoExtraFörälder2Inkomst;
    const period2KombMin = period2Förälder1Inkomst + period2MinFörälder2Inkomst;

    const dadLeaveFörälder2Inkomst = dag2 > 0 ? beräknaMånadsinkomst(dag2, 5, extra2, barnbidragPerPerson, tilläggPerPerson) : 0;
    const dadLeaveFörälder1Inkomst = period1OverlapFörälder1Inkomst || period1Förälder1Inkomst;

    let inkomstData = [];
    let draggablePoints = [];

    function generateInkomstData() {
        inkomstData = [];
        let förälder2DaysUsed = 0;

        for (let week = 0; week < totalaWeeks; week++) {
            let kombineradInkomst = 0;
            let förälder1Inkomst = 0;
            let förälder2Inkomst = 0;
            let periodLabel = '';
            let förälder1Components = createBaseComponents(true);
            let förälder2Components = createBaseComponents(includePartner);

            if (beräknaPartner === "ja" && week < dadLeaveDurationWeeks && vårdnad === "gemensam") {
                förälder1Inkomst = dadLeaveFörälder1Inkomst;
                förälder2Inkomst = dadLeaveFörälder2Inkomst;
                periodLabel = '10-dagar vid barns födelse';
                förälder1Components = calculateLeaveComponents(dag1, plan1.dagarPerVecka, extra1);
                förälder2Components = calculateLeaveComponents(dag2, 5, extra2, { includeBenefits: includePartner });
            } else if (week < period1ExtraWeeks) {
                förälder1Inkomst = period1Förälder1Inkomst;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = week >= transferredStartWeek && transferredWeeks > 0 ? 'Förälder 1 Ledig (Överförda dagar)' : 'Förälder 1 Ledig';
                förälder1Components = calculateLeaveComponents(dag1, plan1.dagarPerVecka, extra1);
                förälder2Components = vårdnad === "ensam" ? createBaseComponents(false) : calculateWorkComponents(arbetsInkomst2, { includeBenefits: includePartner });
            } else if (week < period1ExtraWeeks + period1NoExtraWeeks) {
                förälder1Inkomst = period1NoExtraFörälder1Inkomst;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = 'Förälder 1 Ledig (utan föräldralön)';
                förälder1Components = calculateLeaveComponents(dag1, plan1.dagarPerVecka, 0);
                förälder2Components = vårdnad === "ensam" ? createBaseComponents(false) : calculateWorkComponents(arbetsInkomst2, { includeBenefits: includePartner });
            } else if (week < period1TotalWeeks) {
                förälder1Inkomst = period1MinFörälder1Inkomst;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = 'Förälder 1 Ledig (lägstanivå)';
                förälder1Components = calculateLeaveComponents(180, plan1.dagarPerVecka, 0, { enforceMinimum: true });
                förälder2Components = vårdnad === "ensam" ? createBaseComponents(false) : calculateWorkComponents(arbetsInkomst2, { includeBenefits: includePartner });
            } else if (
                week < period1TotalWeeks + period2ExtraWeeks &&
                vårdnad === "gemensam" &&
                beräknaPartner === "ja"
            ) {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = period2Förälder2Inkomst;
                periodLabel = 'Förälder 2 Ledig';
                förälder1Components = calculateWorkComponents(arbetsInkomst1);
                förälder2Components = calculateLeaveComponents(dag2, plan2.dagarPerVecka, extra2, { includeBenefits: includePartner });
                förälder2DaysUsed += safeDagarPerVecka(plan2.dagarPerVecka);
            } else if (
                week < period1TotalWeeks + period2ExtraWeeks + period2NoExtraWeeks &&
                vårdnad === "gemensam" &&
                beräknaPartner === "ja"
            ) {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = period2NoExtraFörälder2Inkomst;
                periodLabel = 'Förälder 2 Ledig (utan föräldralön)';
                förälder1Components = calculateWorkComponents(arbetsInkomst1);
                förälder2Components = calculateLeaveComponents(dag2, plan2.dagarPerVecka, 0, { includeBenefits: includePartner });
                förälder2DaysUsed += safeDagarPerVecka(plan2.dagarPerVecka);
            } else if (
                week < period1TotalWeeks + period2TotalWeeks &&
                vårdnad === "gemensam" &&
                beräknaPartner === "ja"
            ) {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = period2MinFörälder2Inkomst;
                periodLabel = 'Förälder 2 Ledig (lägstanivå)';
                förälder1Components = calculateWorkComponents(arbetsInkomst1);
                förälder2Components = calculateLeaveComponents(180, plan2.dagarPerVecka, 0, {
                    includeBenefits: includePartner,
                    enforceMinimum: true
                });
                förälder2DaysUsed += safeDagarPerVecka(plan2.dagarPerVecka);
            } else {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = 'Efter Ledighet';
                förälder1Components = calculateWorkComponents(arbetsInkomst1);
                förälder2Components = vårdnad === "ensam"
                    ? createBaseComponents(false)
                    : calculateWorkComponents(arbetsInkomst2, { includeBenefits: includePartner });
            }

            kombineradInkomst = förälder1Inkomst + förälder2Inkomst;
            inkomstData.push({
                x: week,
                y: kombineradInkomst, 
                förälder1Inkomst, 
                förälder2Inkomst, 
                periodLabel,
                förälder1Components,
                förälder2Components
            });

            if (week === dadLeaveDurationWeeks + Math.round(period1TotalWeeks) - 1) {
                draggablePoints.push({ index: week, type: 'period1End' });
            }
            if (week === dadLeaveDurationWeeks + Math.round(period1TotalWeeks)) {
                draggablePoints.push({ index: week, type: 'period2Start' });
            }
        }
    }

    generateInkomstData();

    const formatDate = (date) => {
        if (!(date instanceof Date) || isNaN(date.getTime())) {
            console.warn("Invalid date in formatDate, returning fallback:", date);
            return new Date().toISOString().split('T')[0];
        }
        return date.toISOString().split('T')[0];
    };

    const statusFärger = {
        ok: { bakgrund: '#e6ffe6', kant: '#00cc00', titel: 'Planen är genomförbar' },
        warning: {
            bakgrund: '#fffbe6',
            kant: '#ffcc00',
            titel: 'Varning: Planen är inte fullt genomförbar'
        },
        error: {
            bakgrund: '#ffcccc',
            kant: '#ff0000',
            titel: 'Planen är inte genomförbar'
        }
    };
    const status = statusFärger[genomförbarhet.status || 'ok'];
    let meddelandeHtml = `
        <div class="feasibility-message" style="background-color: ${status.bakgrund}; border: 1px solid ${status.kant}; padding: 15px; margin-bottom: 15px; font-family: Inter, sans-serif;">
            <strong style="font-size: 1.2em;">${status.titel}</strong><br><br>
    `;

    if (transferredDays > 0 && genomförbarhet.status === 'ok' && parent1BufferTotalWeeks === 0 && parent2BufferTotalWeeks === 0) {
        meddelandeHtml += `
            <span style="color: ${transferredColor};">Överförde ${transferredDays} inkomstbaserade dagar till Förälder 1, används under ${transferredWeeks} veckor.</span><br><br>
        `;
    }
    if (!genomförbarhet.ärGenomförbar && genomförbarhet.meddelande) {
        meddelandeHtml += `
            <span style="color: #ff0000;">${genomförbarhet.meddelande}</span><br><br>
        `;
    }

    meddelandeHtml += `
        <strong>10 dagar efter barns födsel (<i>${formatDate(dadLeaveStart)} till ${formatDate(dadLeaveEnd)}</i>)</strong><br>
        Överlappande ledighet: 10 arbetsdagar (${dadLeaveDurationWeeks} veckor)<br>
        <span class="leave-parent parent1">Förälder 1: Inkomst ${dadLeaveFörälder1Inkomst.toLocaleString()} kr/månad (${overlapDaysPerWeek1} dagar/vecka).</span><br>
        <span class="leave-parent parent2">Förälder 2: Inkomst ${dadLeaveFörälder2Inkomst.toLocaleString()} kr/månad (5 dagar/vecka).</span><br>
        <strong>Kombinerad inkomst: ${(dadLeaveFörälder1Inkomst + dadLeaveFörälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

        <strong>Period 1 (Förälder 1 ledig, Förälder 2 jobbar) (<i>${formatDate(period1Start)} till ${formatDate(period1End)}</i>)</strong><br>
        <span class="leave-parent parent1">Förälder 1: ${(period1ExtraWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1ExtraWeeks)} veckor) med föräldralön, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad (${safePlan1Days} dagar/vecka).</span><br>
        <span class="working-parent parent2">Förälder 2: Inkomst ${period1Förälder2Inkomst.toLocaleString()} kr/månad.</span><br>
        <strong>Kombinerad inkomst: ${period1KombExtra.toLocaleString()} kr/månad</strong><br>
        ${period1NoExtraWeeks > 0 ? `<span class="leave-parent parent1">Förälder 1: ${(period1NoExtraWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1NoExtraWeeks)} veckor) utan föräldralön, inkomst ${period1NoExtraFörälder1Inkomst.toLocaleString()} kr/månad (${safePlan1NoExtraDays} dagar/vecka).</span> <strong>Kombinerad inkomst: ${period1KombNoExtra.toLocaleString()} kr/månad</strong><br>` : ''}
        ${period1MinWeeks > 0 ? `<span class="leave-parent parent1">Förälder 1: ${(period1MinWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1MinWeeks)} veckor) på lägstanivå, inkomst ${period1MinFörälder1Inkomst.toLocaleString()} kr/månad (${safePlan1MinDays} dagar/vecka).</span> <strong>Kombinerad inkomst: ${period1KombMin.toLocaleString()} kr/månad</strong><br>` : ''}
        ${parent1BufferText ? `<span class="buffer-info">${parent1BufferText}</span><br>` : ''}<br>

        <strong>Period 2 (Förälder 1 jobbar, Förälder 2 ledig) (<i>${formatDate(period2Start)} till ${formatDate(period2End)}</i>)</strong><br>
        <span class="working-parent parent1">Förälder 1: Inkomst ${period2Förälder1Inkomst.toLocaleString()} kr/månad.</span><br>
        ${extra2 > 0
            ? `<span class="leave-parent parent2">Förälder 2: ${(period2ExtraWeeks / 4.3).toFixed(1)} månader (~${Math.round(period2ExtraWeeks)} veckor) med föräldralön, inkomst ${period2Förälder2Inkomst.toLocaleString()} kr/månad (${safePlan2Days} dagar/vecka).</span><br>`
            : `<span class="leave-parent parent2">Förälder 2: Föräldrapenning ${period2Förälder2Inkomst.toLocaleString()} kr/månad (${safePlan2Days} dagar/vecka).</span><br>`}
        <strong>Kombinerad inkomst: ${period2KombExtra.toLocaleString()} kr/månad</strong><br>
        ${period2NoExtraWeeks > 0 ? `<span class="leave-parent parent2">Förälder 2: ${(period2NoExtraWeeks / 4.3).toFixed(1)} månader (~${Math.round(period2NoExtraWeeks)} veckor) utan föräldralön, inkomst ${period2NoExtraFörälder2Inkomst.toLocaleString()} kr/månad (${safePlan2NoExtraDays} dagar/vecka).</span> <strong>Kombinerad inkomst: ${period2KombNoExtra.toLocaleString()} kr/månad</strong><br>` : ''}
        ${period2MinWeeks > 0 ? `<span class="leave-parent parent2">Förälder 2: ${(period2MinWeeks / 4.3).toFixed(1)} månader (~${Math.round(period2MinWeeks)} veckor) på lägstanivå, inkomst ${period2MinFörälder2Inkomst.toLocaleString()} kr/månad (${safePlan2MinDays} dagar/vecka).</span> <strong>Kombinerad inkomst: ${period2KombMin.toLocaleString()} kr/månad</strong><br>` : ''}
        ${parent2BufferText ? `<span class="buffer-info">${parent2BufferText}</span><br>` : ''}<br>

        <strong>Återstående dagar:</strong><br>
        Förälder 1: ${förälder1InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder1MinDagar.toLocaleString()} dagar (lägstanivå)<br>
        Förälder 2: ${förälder2InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder2MinDagar.toLocaleString()} dagar (lägstanivå)
        </div>
    `;

    messageDiv.innerHTML = meddelandeHtml;
    ganttChart.appendChild(messageDiv);
    ganttChart.appendChild(canvas);
    ganttChart.appendChild(summaryBox);

    const dragPlugin = {
        id: 'dragPlugin',
        afterInit: (chart) => {
            chart.canvas.addEventListener('mousedown', (e) => {
                const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (points.length) {
                    const point = points[0];
                    const dataIndex = point.index;
                    const draggablePoint = draggablePoints.find(p => p.index === dataIndex);
                    if (draggablePoint) {
                        chart.dragging = { point: draggablePoint, index: dataIndex };
                        chart.dragStartX = e.clientX;
                    }
                }
            });

            chart.canvas.addEventListener('mousemove', (e) => {
                if (chart.dragging) {
                    const deltaX = (e.clientX - chart.dragStartX) / chart.scales.x.width * (chart.scales.x.max - chart.scales.x.min);
                    const newX = Math.round(inkomstData[chart.dragging.index].x + deltaX);
                    const minX = dadLeaveDurationWeeks;
                    const maxX = totalaWeeks - period2TotalWeeks - 1;

                    if (chart.dragging.point.type === 'period1End') {
                        const newPeriod1Weeks = Math.max(minX, Math.min(newX + 1, maxX));
                        period1TotalWeeks = newPeriod1Weeks;
                        const period1EndDate = new Date(period1Start);
                        period1EndDate.setDate(period1EndDate.getDate() + (period1TotalWeeks * 7) - 1);
                        const period2StartDate = new Date(period1EndDate);
                        period2StartDate.setDate(period2StartDate.getDate() + 1);
                        const period2EndDate = new Date(period2StartDate);
                        period2EndDate.setDate(period2EndDate.getDate() + (period2TotalWeeks * 7) - 1);

                        const period1TotalDays = period1TotalWeeks * safeDagarPerVecka(plan1.dagarPerVecka);
                        const daysAvailable = förälder1InkomstDagar + förälder1MinDagar;
                        if (period1TotalDays > daysAvailable) {
                            period1TotalWeeks = Math.floor(daysAvailable / safeDagarPerVecka(plan1.dagarPerVecka));
                        }

                        const period1IncomeDaysUsed = Math.min(period1TotalDays, förälder1InkomstDagar);
                        const period1NoExtraAdjustedWeeks = 0;
                        const period1MinAdjustedWeeks = period1TotalDays > period1IncomeDaysUsed ? Math.round((period1TotalDays - period1IncomeDaysUsed) / safeDagarPerVecka(plan1.dagarPerVecka)) : 0;

                        const period2TotalDays = period2TotalWeeks * safeDagarPerVecka(plan2.dagarPerVecka);
                        const period2IncomeDaysUsed = Math.min(period2TotalDays, förälder2InkomstDagar);
                        const period2NoExtraAdjustedWeeks = 0;
                        const period2MinAdjustedWeeks = period2TotalDays > period2IncomeDaysUsed ? Math.round((period2TotalDays - period2IncomeDaysUsed) / safeDagarPerVecka(plan2.dagarPerVecka)) : 0;

                        generateInkomstData();
                        chart.data.datasets[0].data = inkomstData;
                        chart.update();
                        updateMessage();
                    }
                }
            });

            chart.canvas.addEventListener('mouseup', () => {
                if (chart.dragging) {
                    chart.dragging = null;
                    updateMessage();
                }
            });

            chart.canvas.addEventListener('mouseleave', () => {
                if (chart.dragging) {
                    chart.dragging = null;
                    updateMessage();
                }
            });
        }
    };

    function updateMessage() {
        const period1EndDate = new Date(period1Start);
        period1EndDate.setDate(period1EndDate.getDate() + (period1TotalWeeks * 7) - 1);
        const period2StartDate = new Date(period1EndDate);
        period2StartDate.setDate(period2StartDate.getDate() + 1);
        const period2EndDate = new Date(period2StartDate);
        period2EndDate.setDate(period2EndDate.getDate() + (period2TotalWeeks * 7) - 1);
        const period2Weeks = period2ExtraWeeks + period2NoExtraWeeks + period2MinWeeks;

        const status = statusFärger[genomförbarhet.status || 'ok'];
        let newMeddelandeHtml = `
            <div class="feasibility-message" style="background-color: ${status.bakgrund}; border: 1px solid ${status.kant}; padding: 15px; margin-bottom: 15px; font-family: Inter, sans-serif;">
                <strong style="font-size: 1.2em;">${status.titel}</strong><br><br>
        `;

        if (transferredDays > 0) {
            newMeddelandeHtml += `
                <span style="color: ${transferredColor};">Överförde ${transferredDays.toLocaleString()} inkomstbaserade dagar till Förälder 1, används under ${transferredWeeks} veckor.</span><br><br>
            `;
        }


         newMeddelandeHtml += `
            <strong>10 dagar efter barns födsel (<i>${formatDate(dadLeaveStart)} till ${formatDate(dadLeaveEnd)}</i>)</strong><br>
            Överlappande ledighet: 10 arbetsdagar (${dadLeaveDurationWeeks} veckor)<br>
            <span class="leave-parent parent1">Förälder 1: Inkomst ${dadLeaveFörälder1Inkomst.toLocaleString()} kr/månad (5 dagar/vecka).</span><br>
            <span class="leave-parent parent2">Förälder 2: Inkomst ${dadLeaveFörälder2Inkomst.toLocaleString()} kr/månad (5 dagar/vecka).</span><br>
            <strong>Kombinerad inkomst: ${(dadLeaveFörälder1Inkomst + dadLeaveFörälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

            <strong>Period 1 (Förälder 1 ledig, Förälder 2 jobbar) (<i>${formatDate(period1Start)} till ${formatDate(period1EndDate)}</i>)</strong><br>
            <span class="leave-parent parent1">Förälder 1: ${(period1TotalWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1TotalWeeks)} veckor), ${safeDagarPerVecka(plan1.dagarPerVecka)} dagar/vecka, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad.</span><br>
            <span class="working-parent parent2">Förälder 2: Inkomst ${period1Förälder2Inkomst.toLocaleString()} kr/månad.</span><br>
            <strong>Kombinerad inkomst: ${(period1Förälder1Inkomst + period1Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>
            ${plan1SavingsPerMonth > 0 && plan1SavingsWeeks > 0 ? `<span style="color: ${savingsColor};">Sparade medel för Förälder 1: ${plan1SavingsPerMonth.toLocaleString()} kr/månad under ${(plan1SavingsWeeks / 4.3).toFixed(1)} månader.</span><br><br>` : ''}

            <strong>Period 2 (Förälder 1 jobbar, Förälder 2 ledig) (<i>${formatDate(period2StartDate)} till ${formatDate(period2EndDate)}</i>)</strong><br>
            <span class="working-parent parent1">Förälder 1: Inkomst ${period2Förälder1Inkomst.toLocaleString()} kr/månad.</span><br>
            <span class="leave-parent parent2">Förälder 2: ${(period2Weeks / 4.3).toFixed(1)} månader (~${Math.round(period2Weeks)} veckor), ${safeDagarPerVecka(plan2.dagarPerVecka)} dagar/vecka, inkomst ${period2Förälder2Inkomst.toLocaleString()} kr/månad.</span><br>
            <strong>Kombinerad inkomst: ${(period2Förälder1Inkomst + period2Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>
            ${plan2SavingsPerMonth > 0 && plan2SavingsWeeks > 0 ? `<span style="color: ${savingsColor};">Sparade medel för Förälder 2: ${plan2SavingsPerMonth.toLocaleString()} kr/månad under ${(plan2SavingsWeeks / 4.3).toFixed(1)} månader.</span><br><br>` : ''}


            <strong>Återstående dagar:</strong><br>
            Förälder 1: ${förälder1InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder1MinDagar.toLocaleString()} dagar (lägstanivå)<br>
            Förälder 2: ${förälder2InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder2MinDagar.toLocaleString()} dagar (lägstanivå)`;
        if (unusedFöräldralönWeeks1 > 0 && maxFöräldralönWeeks1 > 0) {
            const allowedMonths1 = (maxFöräldralönWeeks1 / 4.3).toFixed(0);
            newMeddelandeHtml += `<br><span style="color: #f28c38;">Förälder 1: Du har möjlighet att ta ut föräldralön i upp till ${allowedMonths1} månader men utnyttjar just nu inte allt.</span>`;
        }
        if (unusedFöräldralönWeeks2 > 0 && maxFöräldralönWeeks2 > 0) {
            const allowedMonths2 = (maxFöräldralönWeeks2 / 4.3).toFixed(0);
            newMeddelandeHtml += `<br><span style="color: #f28c38;">Förälder 2: Du har möjlighet att ta ut föräldralön i upp till ${allowedMonths2} månader men utnyttjar just nu inte allt.</span>`;
        }
        newMeddelandeHtml += `</div>`;

        messageDiv.innerHTML = newMeddelandeHtml;
    }

    // Reusable function to format tooltip/summary data
    function formatSummaryData(index) {
        if (index == null || !inkomstData[index]) {
            return '<p>Hovra över en punkt för att se detaljer.</p>';
        }
        const data = inkomstData[index];
        const weekLabel = weekLabels[index] || 'Okänd vecka';
        let html =
            `<div class="summary-section"><strong>${weekLabel}</strong><br>` +
            `Period: ${data.periodLabel || 'Okänd period'}</div>`;
        html +=
            `<div class="summary-section">Total inkomst: ` +
            `<span class="combined-income">${data.y.toLocaleString()} kr/månad</span></div>`;
        html +=
            `<div class="summary-section"><strong>Förälder 1</strong>: ` +
            `${data.förälder1Inkomst.toLocaleString()} kr/månad<br>`;
        html += `  Föräldrapenning: ` +
            `${data.förälder1Components.fp.toLocaleString()} kr/månad<br>`;
        html += `  Föräldralön: ` +
            `${data.förälder1Components.extra.toLocaleString()} kr/månad<br>`;
        html += `  Lön: ` +
            `${data.förälder1Components.lön.toLocaleString()} kr/månad<br>`;
        html += `  Barnbidrag: ` +
            `${data.förälder1Components.barnbidrag.toLocaleString()} kr/månad<br>`;
        html += `  Flerbarnstillägg: ` +
            `${data.förälder1Components.tillägg.toLocaleString()} kr/månad</div>`;
        const showParent2 = vårdnad !== 'ensam' && beräknaPartner === 'ja';
        if (showParent2) {
            html +=
                `<div class="summary-section"><strong>Förälder 2</strong>: ` +
                `${data.förälder2Inkomst.toLocaleString()} kr/månad<br>`;
            html += `  Föräldrapenning: ` +
                `${data.förälder2Components.fp.toLocaleString()} kr/månad<br>`;
            html += `  Föräldralön: ` +
                `${data.förälder2Components.extra.toLocaleString()} kr/månad<br>`;
            html += `  Lön: ` +
                `${data.förälder2Components.lön.toLocaleString()} kr/månad<br>`;
            html += `  Barnbidrag: ` +
                `${data.förälder2Components.barnbidrag.toLocaleString()} kr/månad<br>`;
            html += `  Flerbarnstillägg: ` +
                `${data.förälder2Components.tillägg.toLocaleString()} kr/månad</div>`;
        }
        return html;
    }

    // Custom plugin for summary box updates
    const summaryPlugin = {
        id: 'summaryPlugin',
        afterInit: (chart) => {
            let lastHoveredIndex = null;
            chart.canvas.addEventListener('mousemove', (e) => {
                const points = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false);
                if (points.length) {
                    const point = points[0];
                    lastHoveredIndex = point.index;
                    summaryBox.innerHTML = formatSummaryData(lastHoveredIndex);
                }
            });
        }
    };

    const ctx = canvas.getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'Kombinerad Inkomst (kr/månad)',
                data: inkomstData,
                borderWidth: 2,
                fill: false,
                pointRadius: inkomstData.map((_, index) => draggablePoints.some(p => p.index === index) ? 6 : 4),
                pointHoverRadius: inkomstData.map((_, index) => draggablePoints.some(p => p.index === index) ? 8 : 6),
                segment: {
                    borderColor: ctx => {
                        const x = ctx.p0.parsed.x;
                        if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                        if (x < dadLeaveDurationWeeks + period1TotalWeeks) {
                            const isBufferWeek = parent1BufferTotalWeeks > 0 && x >= parent1BufferStartWeek && x < parent1BufferEndWeek;
                            const isTransferredWeek = transferredWeeks > 0 && parent1BufferTotalWeeks === 0 && x >= transferredStartWeek && x < transferredStartWeek + transferredWeeks;
                            if (isBufferWeek || isTransferredWeek) return '#f28c38';
                            return '#28a745';
                        }
                        if (x < dadLeaveDurationWeeks + period1TotalWeeks + period2TotalWeeks) {
                            const isPartnerBufferWeek = parent2BufferTotalWeeks > 0 && x >= parent2BufferStartWeek && x < parent2BufferEndWeek;
                            if (isPartnerBufferWeek) return '#f28c38';
                            return '#007bff';
                        }
                        return 'red';
                    },
                    backgroundColor: ctx => {
                        const x = ctx.p0.parsed.x;
                        if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                        if (x < dadLeaveDurationWeeks + period1TotalWeeks) {
                            const isBufferWeek = parent1BufferTotalWeeks > 0 && x >= parent1BufferStartWeek && x < parent1BufferEndWeek;
                            const isTransferredWeek = transferredWeeks > 0 && parent1BufferTotalWeeks === 0 && x >= transferredStartWeek && x < transferredStartWeek + transferredWeeks;
                            if (isBufferWeek || isTransferredWeek) return '#f28c38';
                            return '#28a745';
                        }
                        if (x < dadLeaveDurationWeeks + period1TotalWeeks + period2TotalWeeks) {
                            const isPartnerBufferWeek = parent2BufferTotalWeeks > 0 && x >= parent2BufferStartWeek && x < parent2BufferEndWeek;
                            if (isPartnerBufferWeek) return '#f28c38';
                            return '#007bff';
                        }
                        return 'red';
                    }
                },
                pointBackgroundColor: inkomstData.map(data => {
                    const x = data.x;
                    if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                    if (x < dadLeaveDurationWeeks + period1TotalWeeks) {
                        const isBufferWeek = parent1BufferTotalWeeks > 0 && x >= parent1BufferStartWeek && x < parent1BufferEndWeek;
                        const isTransferredWeek = transferredWeeks > 0 && parent1BufferTotalWeeks === 0 && x >= transferredStartWeek && x < transferredStartWeek + transferredWeeks;
                        if (isBufferWeek || isTransferredWeek) return '#f28c38';
                        return '#28a745';
                    }
                    if (x < dadLeaveDurationWeeks + period1TotalWeeks + period2TotalWeeks) {
                        const isPartnerBufferWeek = parent2BufferTotalWeeks > 0 && x >= parent2BufferStartWeek && x < parent2BufferEndWeek;
                        if (isPartnerBufferWeek) return '#f28c38';
                        return '#007bff';
                    }
                    return 'red';
                }),
                pointBorderColor: inkomstData.map(data => {
                    const x = data.x;
                    if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                    if (x < dadLeaveDurationWeeks + period1TotalWeeks) {
                        const isBufferWeek = parent1BufferTotalWeeks > 0 && x >= parent1BufferStartWeek && x < parent1BufferEndWeek;
                        const isTransferredWeek = transferredWeeks > 0 && parent1BufferTotalWeeks === 0 && x >= transferredStartWeek && x < transferredStartWeek + transferredWeeks;
                        if (isBufferWeek || isTransferredWeek) return '#f28c38';
                        return '#28a745';
                    }
                    if (x < dadLeaveDurationWeeks + period1TotalWeeks + period2TotalWeeks) {
                        const isPartnerBufferWeek = parent2BufferTotalWeeks > 0 && x >= parent2BufferStartWeek && x < parent2BufferEndWeek;
                        if (isPartnerBufferWeek) return '#f28c38';
                        return '#007bff';
                    }
                    return 'red';
                })
            }]
        },
        options: {
            scales: {
                x: {
                    type: 'linear',
                    min: 0,
                    max: totalaWeeks - 1,
                    ticks: {
                        stepSize: 1,
                        autoSkip: false,
                        maxTicksLimit: 60,
                        callback: function(value) {
                            return monthLabels[value] || '';
                        },
                        font: function(context) {
                            const value = context?.tick?.value;
                            return {
                                size: 12,
                                weight: typeof value === 'number' && value >= 0 && value < monthLabels.length && monthLabels[value] ? 'bold' : 'normal'
                            };
                        }
                    },
                    title: { display: true, text: 'Tid (Månad)' }
                },
                y: {
                    position: 'right',
                    min: 0,
                    suggestedMax: Math.max(...inkomstData.map(d => d.y)) * 1.1,
                    title: { display: true, text: 'Inkomst (kr/månad)' },
                    grid: { drawOnChartArea: true },
                    ticks: {
                        callback: function(value) {
                            return value.toLocaleString() + ' kr';
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        generateLabels: chart => {
                            const orangeLabel = [];
                            if (parent1BufferTotalWeeks > 0 || parent2BufferTotalWeeks > 0) {
                                orangeLabel.push({ text: 'Buffert från maximerad föräldralön', fillStyle: '#f28c38', strokeStyle: '#f28c38', hidden: false });
                            } else if (transferredWeeks > 0) {
                                orangeLabel.push({ text: 'Förälder 1 Ledig (Överförda dagar)', fillStyle: '#f28c38', strokeStyle: '#f28c38', hidden: false });
                            }
                            return [
                                { text: 'Överlappande Ledighet', fillStyle: '#800080', strokeStyle: '#800080', hidden: false },
                                { text: 'Förälder 1 Ledig', fillStyle: '#28a745', strokeStyle: '#28a745', hidden: false },
                                ...orangeLabel,
                                { text: 'Förälder 2 Ledig', fillStyle: '#007bff', strokeStyle: '#007bff', hidden: false },
                                { text: 'Efter Ledighet', fillStyle: 'red', strokeStyle: 'red', hidden: false }
                            ];
                        }
                    }
                },
                tooltip: {
                    enabled: false // Disable default tooltip
                }
            }
        },
        plugins: [dragPlugin, summaryPlugin]
    });
    }

    global.chartUtils = {
        renderGanttChart
    };
})(window);

