/**
 * chart.js - Chart rendering for the Föräldrapenningkalkylator
 * Renders an interactive Gantt chart showing parental leave schedules and income.
 */
import { beräknaMånadsinkomst } from './calculations.js';

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
 */
export function renderGanttChart(
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
    tilläggPerPerson
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

    const period1Weeks = plan1.weeks || 0;
    const period1NoExtraWeeks = plan1NoExtra.weeks || 0;
    const period1MinWeeks = plan1MinDagar.weeks || 0;
    const period2Weeks = plan2.weeks || 0;
    const period2NoExtraWeeks = plan2NoExtra.weeks || 0;
    const period2MinWeeks = plan2MinDagar.weeks || 0;
    const period1OverlapWeeks = plan1Overlap.weeks || 0;

    const transferredDays = genomförbarhet.transferredDays || 0;
    const transferredWeeks = transferredDays > 0 && plan1.dagarPerVecka > 0 ? Math.ceil(transferredDays / plan1.dagarPerVecka) : 0;
    const transferredStartWeek = transferredWeeks > 0 ? Math.max(0, period1Weeks - transferredWeeks) : period1Weeks;

    let startDate = barnDatum ? new Date(barnDatum) : new Date();
    if (isNaN(startDate.getTime())) {
        console.warn("Invalid barnDatum provided, using current date:", barnDatum);
        startDate = new Date();
    }
    startDate.setHours(0, 0, 0, 0);

    const period1Start = new Date(startDate);
    let period1TotalWeeks = period1Weeks;
    const period1End = new Date(period1Start);
    period1End.setDate(period1End.getDate() + (period1TotalWeeks * 7) - 1);

    const dadLeaveStart = new Date(startDate);
    const dadLeaveDurationDays = 10;
    const dadLeaveEnd = new Date(dadLeaveStart);
    dadLeaveEnd.setDate(dadLeaveEnd.getDate() + dadLeaveDurationDays - 1);
    const dadLeaveDurationWeeks = Math.ceil(dadLeaveDurationDays / 7);

    const period2Start = new Date(period1End);
    period2Start.setDate(period2Start.getDate() + 1);
    const period2End = new Date(period2Start);
    period2End.setDate(period2End.getDate() + (period2Weeks * 7) - 1);

    const totalaWeeks = Math.max(period1TotalWeeks + period2Weeks, 60);

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

    const period1Förälder1Inkomst = plan1.inkomst || 0;
    const period1NoExtraFörälder1Inkomst = plan1NoExtra.inkomst || 0;
    const period1MinFörälder1Inkomst = beräknaMånadsinkomst(180, safeDagarPerVecka(plan1.dagarPerVecka), 0, barnbidragPerPerson, tilläggPerPerson);
    const period1OverlapFörälder1Inkomst = plan1Overlap.inkomst || 0;
    const period1Förälder2Inkomst = arbetsInkomst2 || 0;

    const period2Förälder1Inkomst = arbetsInkomst1 || 0;
    const period2Förälder2Inkomst = plan2.inkomst || 0;
    const period2NoExtraFörälder2Inkomst = plan2NoExtra.inkomst || 0;
    const period2MinFörälder2Inkomst = beräknaMånadsinkomst(180, safeDagarPerVecka(plan2.dagarPerVecka), 0, barnbidragPerPerson, tilläggPerPerson);

    const dadLeaveFörälder2Inkomst = dag2 > 0 ? beräknaMånadsinkomst(dag2, 5, extra2, barnbidragPerPerson, tilläggPerPerson) : 0;
    const dadLeaveFörälder1Inkomst = period1Förälder1Inkomst;

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
            let förälder1Components = { fp: 0, extra: 0, barnbidrag: 0, tillägg: 0 };
            let förälder2Components = { fp: 0, extra: 0, barnbidrag: 0, tillägg: 0 };

            if (beräknaPartner === "ja" && week < dadLeaveDurationWeeks && vårdnad === "gemensam") {
                förälder1Inkomst = dadLeaveFörälder1Inkomst;
                förälder2Inkomst = dadLeaveFörälder2Inkomst;
                periodLabel = '10-dagar vid barns födelse';
                förälder1Components = {
                    fp: Math.round((dag1 * safeDagarPerVecka(plan1.dagarPerVecka) * 4.3) / 100) * 100,
                    extra: extra1,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
                förälder2Components = {
                    fp: Math.round((dag2 * 5 * 4.3) / 100) * 100,
                    extra: extra2,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
            } else if (week < period1TotalWeeks) {
                förälder1Inkomst = period1Förälder1Inkomst;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = week >= transferredStartWeek && transferredWeeks > 0 ? 'Förälder 1 Ledig (Överförda dagar)' : 'Förälder 1 Ledig';
                förälder1Components = {
                    fp: Math.round((dag1 * safeDagarPerVecka(plan1.dagarPerVecka) * 4.3) / 100) * 100,
                    extra: extra1,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
                förälder2Components = {
                    fp: 0,
                    extra: 0,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
            } else if (week < period1TotalWeeks + period2Weeks && vårdnad === "gemensam" && beräknaPartner === "ja") {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = period2Förälder2Inkomst;
                periodLabel = 'Förälder 2 Ledig';
                förälder1Components = {
                    fp: 0,
                    extra: 0,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
                förälder2Components = {
                    fp: Math.round((dag2 * safeDagarPerVecka(plan2.dagarPerVecka) * 4.3) / 100) * 100,
                    extra: extra2,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
                förälder2DaysUsed += safeDagarPerVecka(plan2.dagarPerVecka);
            } else {
                förälder1Inkomst = arbetsInkomst1 || 0;
                förälder2Inkomst = vårdnad === "ensam" ? 0 : (arbetsInkomst2 || 0);
                periodLabel = 'Efter Ledighet';
                förälder1Components = {
                    fp: 0,
                    extra: 0,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
                förälder2Components = {
                    fp: 0,
                    extra: 0,
                    barnbidrag: barnbidragPerPerson,
                    tillägg: tilläggPerPerson
                };
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

            if (week === Math.round(period1TotalWeeks) - 1) {
                draggablePoints.push({ index: week, type: 'period1End' });
            }
            if (week === period1TotalWeeks) {
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

    let meddelandeHtml = `
        <div class="feasibility-message" style="background-color: ${genomförbarhet.ärGenomförbar ? '#e6ffe6' : '#ffcccc'}; border: 1px solid ${genomförbarhet.ärGenomförbar ? '#00cc00' : '#ff0000'}; padding: 15px; margin-bottom: 15px; font-family: Inter, sans-serif;">
            <strong style="font-size: 1.2em;">${genomförbarhet.ärGenomförbar ? 'Planen är genomförbar' : 'Varning: Planen är inte fullt genomförbar'}</strong><br><br>
    `;

    if (transferredDays > 0 && genomförbarhet.ärGenomförbar) {
        meddelandeHtml += `
            <span style="color: #f28c38;">Överförde ${transferredDays} inkomstbaserade dagar till Förälder 1, används under ${transferredWeeks} veckor.</span><br><br>
        `;
    }

    meddelandeHtml += `
        <strong>10 dagar efter barns födsel (<i>${formatDate(dadLeaveStart)} till ${formatDate(dadLeaveEnd)}</i>)</strong><br>
        Överlappande ledighet: 10 arbetsdagar (${dadLeaveDurationWeeks} veckor)<br>
        Förälder 1: Inkomst ${dadLeaveFörälder1Inkomst.toLocaleString()} kr/månad.<br>
        Förälder 2: Inkomst ${dadLeaveFörälder2Inkomst.toLocaleString()} kr/månad.<br>
        <strong>Kombinerad inkomst: ${(dadLeaveFörälder1Inkomst + dadLeaveFörälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

        <strong>Period 1 (Förälder 1 ledig, Förälder 2 jobbar) (<i>${formatDate(period1Start)} till ${formatDate(period1End)}</i>)</strong><br>
        Förälder 1: ${(period1TotalWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1TotalWeeks)} veckor), ${safeDagarPerVecka(plan1.dagarPerVecka)} dagar/vecka, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad.<br>
        Förälder 2: Inkomst ${period1Förälder2Inkomst.toLocaleString()} kr/månad.<br>
        <strong>Kombinerad inkomst: ${(period1Förälder1Inkomst + period1Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>
        
        <strong>Period 2 (Förälder 1 jobbar, Förälder 2 ledig) (<i>${formatDate(period2Start)} till ${formatDate(period2End)}</i>)</strong><br>
        Förälder 1: Inkomst ${period2Förälder1Inkomst.toLocaleString()} kr/månad.<br>
        Förälder 2: ${(period2Weeks / 4.3).toFixed(1)} månader (~${Math.round(period2Weeks)} veckor), ${safeDagarPerVecka(plan2.dagarPerVecka)} dagar/vecka, inkomst ${period2Förälder2Inkomst.toLocaleString()} kr/månad.<br>
        <strong>Kombinerad inkomst: ${(period2Förälder1Inkomst + period2Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

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
                    const maxX = totalaWeeks - period2Weeks - 1;

                    if (chart.dragging.point.type === 'period1End') {
                        const newPeriod1Weeks = Math.max(minX, Math.min(newX + 1, maxX));
                        period1TotalWeeks = newPeriod1Weeks;
                        const period1EndDate = new Date(period1Start);
                        period1EndDate.setDate(period1EndDate.getDate() + (period1TotalWeeks * 7) - 1);
                        const period2StartDate = new Date(period1EndDate);
                        period2StartDate.setDate(period2StartDate.getDate() + 1);
                        const period2EndDate = new Date(period2StartDate);
                        period2EndDate.setDate(period2EndDate.getDate() + (period2Weeks * 7) - 1);

                        const period1TotalDays = period1TotalWeeks * safeDagarPerVecka(plan1.dagarPerVecka);
                        const daysAvailable = förälder1InkomstDagar + förälder1MinDagar;
                        if (period1TotalDays > daysAvailable) {
                            period1TotalWeeks = Math.floor(daysAvailable / safeDagarPerVecka(plan1.dagarPerVecka));
                        }

                        const period1IncomeDaysUsed = Math.min(period1TotalDays, förälder1InkomstDagar);
                        const period1NoExtraAdjustedWeeks = 0;
                        const period1MinAdjustedWeeks = period1TotalDays > period1IncomeDaysUsed ? Math.round((period1TotalDays - period1IncomeDaysUsed) / safeDagarPerVecka(plan1.dagarPerVecka)) : 0;

                        const period2TotalDays = period2Weeks * safeDagarPerVecka(plan2.dagarPerVecka);
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
        period2EndDate.setDate(period2EndDate.getDate() + (period2Weeks * 7) - 1);

        let newMeddelandeHtml = `
            <div class="feasibility-message" style="background-color: #e6ffe6; border: 1px solid #00cc00; padding: 15px; margin-bottom: 15px; font-family: Inter, sans-serif;">
                <strong style="font-size: 1.2em;">Planen är genomförbar</strong><br><br>
        `;

        if (transferredDays > 0) {
            newMeddelandeHtml += `
                <span style="color: #f28c38;">Överförde ${transferredDays.toLocaleString()} inkomstbaserade dagar till Förälder 1, används under ${transferredWeeks} veckor.</span><br><br>
            `;
        }

        newMeddelandeHtml += `
            <strong>10 dagar efter barns födsel (<i>${formatDate(dadLeaveStart)} till ${formatDate(dadLeaveEnd)}</i>)</strong><br>
            Överlappande ledighet: 10 arbetsdagar (${dadLeaveDurationWeeks} veckor)<br>
            Förälder 1: Inkomst ${dadLeaveFörälder1Inkomst.toLocaleString()} kr/månad.<br>
            Förälder 2: Inkomst ${dadLeaveFörälder2Inkomst.toLocaleString()} kr/månad.<br>
            <strong>Kombinerad inkomst: ${(dadLeaveFörälder1Inkomst + dadLeaveFörälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

            <strong>Period 1 (Förälder 1 ledig, Förälder 2 jobbar) (<i>${formatDate(period1Start)} till ${formatDate(period1EndDate)}</i>)</strong><br>
            Förälder 1: ${(period1TotalWeeks / 4.3).toFixed(1)} månader (~${Math.round(period1TotalWeeks)} veckor), ${safeDagarPerVecka(plan1.dagarPerVecka)} dagar/vecka, inkomst ${period1Förälder1Inkomst.toLocaleString()} kr/månad.<br>
            Förälder 2: Inkomst ${period1Förälder2Inkomst.toLocaleString()} kr/månad.<br>
            <strong>Kombinerad inkomst: ${(period1Förälder1Inkomst + period1Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>
            
            <strong>Period 2 (Förälder 1 jobbar, Förälder 2 ledig) (<i>${formatDate(period2StartDate)} till ${formatDate(period2EndDate)}</i>)</strong><br>
            Förälder 1: Inkomst ${period2Förälder1Inkomst.toLocaleString()} kr/månad.<br>
            Förälder 2: ${(period2Weeks / 4.3).toFixed(1)} månader (~${Math.round(period2Weeks)} veckor), ${safeDagarPerVecka(plan2.dagarPerVecka)} dagar/vecka, inkomst ${period2Förälder2Inkomst.toLocaleString()} kr/månad.<br>
            <strong>Kombinerad inkomst: ${(period2Förälder1Inkomst + period2Förälder2Inkomst).toLocaleString()} kr/månad</strong><br><br>

            <strong>Återstående dagar:</strong><br>
            Förälder 1: ${förälder1InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder1MinDagar.toLocaleString()} dagar (lägstanivå)<br>
            Förälder 2: ${förälder2InkomstDagar.toLocaleString()} dagar (sjukpenningnivå), ${förälder2MinDagar.toLocaleString()} dagar (lägstanivå)
            </div>
        `;

        messageDiv.innerHTML = newMeddelandeHtml;
    }

    // Reusable function to format tooltip/summary data
    function formatSummaryData(index) {
        if (index == null || !inkomstData[index]) {
            return '<p>Hovra över en punkt för att se detaljer.</p>';
        }
        const data = inkomstData[index];
        const weekLabel = weekLabels[index] || 'Okänd vecka';
        let html = `<strong>${weekLabel}</strong><br>`;
        html += `Period: ${data.periodLabel || 'Okänd period'}<br>`;
        html += `Kombinerad: <span class="combined-income">${data.y.toLocaleString()} kr/månad</span><br>`;
        html += `<strong>Förälder 1</strong>: ${data.förälder1Inkomst.toLocaleString()} kr/månad<br>`;
        html += `  Föräldrapenning: ${data.förälder1Components.fp.toLocaleString()} kr/månad<br>`;
        html += `  Föräldralön: ${data.förälder1Components.extra.toLocaleString()} kr/månad<br>`;
        html += `  Barnbidrag: ${data.förälder1Components.barnbidrag.toLocaleString()} kr/månad<br>`;
        html += `  Flerbarnstillägg: ${data.förälder1Components.tillägg.toLocaleString()} kr/månad<br>`;
        const showParent2 = vårdnad !== 'ensam' && beräknaPartner === 'ja';
        if (showParent2) {
            html += `<strong>Förälder 2</strong>: ${data.förälder2Inkomst.toLocaleString()} kr/månad<br>`;
            html += `  Föräldrapenning: ${data.förälder2Components.fp.toLocaleString()} kr/månad<br>`;
            html += `  Föräldralön: ${data.förälder2Components.extra.toLocaleString()} kr/månad<br>`;
            html += `  Barnbidrag: ${data.förälder2Components.barnbidrag.toLocaleString()} kr/månad<br>`;
            html += `  Flerbarnstillägg: ${data.förälder2Components.tillägg.toLocaleString()} kr/månad<br>`;
        }
        return html + '<br>';
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
                        if (x < period1TotalWeeks) {
                            if (transferredWeeks > 0 && x >= transferredStartWeek) return '#f28c38';
                            return '#28a745';
                        }
                        if (x < period1TotalWeeks + period2Weeks) return '#007bff';
                        return 'red';
                    },
                    backgroundColor: ctx => {
                        const x = ctx.p0.parsed.x;
                        if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                        if (x < period1TotalWeeks) {
                            if (transferredWeeks > 0 && x >= transferredStartWeek) return '#f28c38';
                            return '#28a745';
                        }
                        if (x < period1TotalWeeks + period2Weeks) return '#007bff';
                        return 'red';
                    }
                },
                pointBackgroundColor: inkomstData.map(data => {
                    const x = data.x;
                    if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                    if (x < period1TotalWeeks) {
                        if (transferredWeeks > 0 && x >= transferredStartWeek) return '#f28c38';
                        return '#28a745';
                    }
                    if (x < period1TotalWeeks + period2Weeks) return '#007bff';
                    return 'red';
                }),
                pointBorderColor: inkomstData.map(data => {
                    const x = data.x;
                    if (beräknaPartner === "ja" && x >= 0 && x < dadLeaveDurationWeeks) return '#800080';
                    if (x < period1TotalWeeks) {
                        if (transferredWeeks > 0 && x >= transferredStartWeek) return '#f28c38';
                        return '#28a745';
                    }
                    if (x < period1TotalWeeks + period2Weeks) return '#007bff';
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
                        generateLabels: chart => [
                            { text: 'Överlappande Ledighet', fillStyle: '#800080', strokeStyle: '#800080', hidden: false },
                            { text: 'Förälder 1 Ledig', fillStyle: '#28a745', strokeStyle: '#28a745', hidden: false },
                            transferredDays > 0 ? { text: 'Förälder 1 Ledig (Överförda dagar)', fillStyle: '#f28c38', strokeStyle: '#f28c38', hidden: false } : null,
                            { text: 'Förälder 2 Ledig', fillStyle: '#007bff', strokeStyle: '#007bff', hidden: false },
                            { text: 'Efter Ledighet', fillStyle: 'red', strokeStyle: 'red', hidden: false }
                        ].filter(Boolean)
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