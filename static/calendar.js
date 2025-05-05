/**
 * calendar.js - Interactive calendar for Föräldrapenningkalkylator
 * Allows users to distribute parental leave months with configurable days/week, reversible lägstanivå option with separate days dropdown, and see remaining sjukpenningnivå and lägstanivå days.
 */
import { beräknaMånadsinkomst } from './calculations.js';
import { barnbidragPerPerson, tilläggPerPerson, förälder1InkomstDagar, förälder2InkomstDagar, förälder1LägstanivåDagar, förälder2LägstanivåDagar } from './config.js';

/**
 * Render the interactive calendar
 * @param {number} ledigTid1 - Parent 1 leave duration in months
 * @param {number} ledigTid2 - Parent 2 leave duration in months
 * @param {string} barnDatum - Child's expected birth date (YYYY-MM-DD)
 * @param {Object} appState - Application state from index.js
 */
export function renderCalendar(ledigTid1, ledigTid2, barnDatum, appState) {
    const calendarContainer = document.getElementById('calendar-container');
    if (!calendarContainer) {
        console.error('Calendar container not found');
        return;
    }

    // Clear existing content
    calendarContainer.innerHTML = '';

    // Parse birth date
    const startDate = barnDatum ? new Date(barnDatum) : new Date();
    if (isNaN(startDate.getTime())) {
        console.warn('Invalid barnDatum, using current date:', barnDatum);
        startDate = new Date();
    }
    // Normalize to first of the month
    startDate.setDate(1);

    // Calculate calendar duration (24 months)
    const monthsToShow = 24;
    const monthLabels = [];
    const calendarState = []; // Tracks blocks, days/week, lägstanivå, transferred, and cumulative days
    for (let i = 0; i < monthsToShow; i++) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(startDate.getMonth() + i);
        const monthName = monthDate.toLocaleString('sv-SE', { month: 'short' }).charAt(0).toUpperCase() + monthDate.toLocaleString('sv-SE', { month: 'short' }).slice(1);
        const year = monthDate.getFullYear();
        monthLabels.push(`${monthName} ${year}`);
        calendarState.push({ parent1: null, parent2: null }); // { blockId, daysPerWeek, lagstaniva, lagstanivaDays, transferred, normalDays }
    }

    // Create available blocks
    const blocks = [];
    for (let i = 0; i < Math.floor(ledigTid1); i++) {
        blocks.push({ parent: 1, id: `p1-${i}`, used: false });
    }
    for (let i = 0; i < Math.floor(ledigTid2); i++) {
        blocks.push({ parent: 2, id: `p2-${i}`, used: false });
    }

    // Create calendar HTML
    let calendarHtml = `
        <style>
            .calendar-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            .calendar-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 12px;
                margin-top: 20px;
                font-family: Inter, sans-serif;
                background-color: #f7f9fc;
                padding: 14px;
                border-radius: 10px;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
            }
            .calendar-month {
                border: 1px solid #dfe3e8;
                padding: 10px;
                min-height: 180px;
                background-color: #ffffff;
                border-radius: 8px;
                transition: background-color 0.2s;
            }
            .calendar-month.below-threshold {
                background-color: #ff9999;
            }
            .calendar-month-header {
                font-weight: 600;
                font-size: 14px;
                color: #1a202c;
                margin-bottom: 6px;
            }
            .calendar-block {
                padding: 8px;
                margin: 4px 0;
                color: white;
                text-align: center;
                cursor: move;
                user-select: none;
                border-radius: 8px;
                font-size: 14px;
                display: grid;
                grid-template-columns: 1fr auto;
                grid-template-rows: auto auto auto auto auto;
                gap: 4px;
                position: relative;
                align-items: center;
            }
            .calendar-block > div:nth-child(1) {
                grid-column: 1 / 2;
                grid-row: 1 / 2;
                text-align: left;
            }
            .calendar-block .used-days {
                grid-column: 1 / 2;
                grid-row: 2 / 3;
                font-size: 12px;
                text-align: left;
            }
            .calendar-block .days-select {
                grid-column: 1 / 2;
                grid-row: 3 / 4;
            }
            .calendar-block .lagstaniva-checkbox {
                grid-column: 1 / 2;
                grid-row: 4 / 5;
            }
            .calendar-block .lagstaniva-days-select {
                grid-column: 1 / 2;
                grid-row: 5 / 6;
                display: none;
            }
            .calendar-block .lagstaniva-days-select.active {
                display: block;
            }
            .calendar-block .delete-button {
                grid-column: 2 / 3;
                grid-row: 1 / 2;
            }
            .block-parent1 {
                background-color: #28a745;
            }
            .block-parent2 {
                background-color: #007bff;
            }
            .block-parent1-lagstaniva {
                background-color: #4cff80;
            }
            .block-parent2-lagstaniva {
                background-color: #66b3ff;
            }
            .block-transferred {
                background-color: #ffc107;
            }
            .block-transferred.block-parent2-lagstaniva {
                background-color: #66b3ff;
            }
            .double-days {
                background-color: #800080;
                border: 2px solid #4b0082;
            }
            .calendar-month.double-days .income-display {
                color: #ffffff;
            }
            .income-display {
                font-size: 12px;
                color: #4a5568;
                margin-top: 6px;
                font-weight: 500;
                display: flex;
                align-items: center;
                gap: 4px;
                position: relative;
            }
            .income-display .info-button {
                display: none;
            }
            .income-display.has-blocks .info-button {
                display: inline-flex;
            }
            .info-button {
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 50%;
                width: 16px;
                height: 16px;
                font-size: 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
                position: relative;
            }
            .info-button:hover {
                background-color: #0056b3;
            }
            .info-button:hover::after {
                content: attr(data-info);
                position: absolute;
                top: -10px;
                left: 50%;
                transform: translateX(-50%);
                background-color: #2d3748;
                color: white;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                width: 200px;
                z-index: 100;
                white-space: normal;
                text-align: left;
                pointer-events: none;
            }
            .blocks-container {
                margin-bottom: 20px;
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                background-color: #edf2f7;
                padding: 14px;
                border-radius: 8px;
            }
            .blocks-container h3 {
                width: 100%;
                font-size: 16px;
                font-weight: 600;
                color: #2d3748;
                margin: 0 0 6px 0;
            }
            .calendar-month.drop-target {
                background-color: #e2e8f0;
            }
            .reset-button, .transfer-button {
                padding: 8px 14px;
                color: white;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-family: Inter, sans-serif;
                font-size: 14px;
                transition: background-color 0.2s;
                margin: 10px 0;
            }
            .reset-button {
                background-color: #dc3545;
            }
            .reset-button:hover {
                background-color: #c82333;
            }
            .transfer-button {
                background-color: #28a745;
            }
            .transfer-button:hover {
                background-color: #218838;
            }
            .days-select, .lagstaniva-days-select {
                padding: 2px;
                font-size: 12px;
                border-radius: 4px;
                background-color: #ffffff;
                color: #2d3748;
                border: 1px solid #cbd5e0;
                font-family: Inter, sans-serif;
                width: 100%;
                max-width: 120px;
            }
            .lagstaniva-checkbox {
                font-size: 12px;
                color: #2d3748;
                display: flex;
                align-items: center;
            }
            .lagstaniva-checkbox input:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .days-remaining {
                max-width: 300px;
                background-color: #edf2f7;
                padding: 12px;
                border-radius: 8px;
                font-family: Inter, sans-serif;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
                margin: 10px auto;
                text-align: center;
            }
            .days-remaining h3 {
                font-size: 16px;
                font-weight: 600;
                color: #2d3748;
                margin: 0 0 8px 0;
            }
            .days-remaining p {
                font-size: 14px;
                color: #4a5568;
                margin: 4px 0;
                padding-bottom: 4px;
                border-bottom: 1px solid #cbd5e0;
            }
            .days-remaining p:last-child {
                border-bottom: none;
            }
            .days-remaining strong {
                font-weight: 700;
            }
            .delete-button {
                background-color: transparent;
                color: #dc3545;
                border: none;
                font-size: 14px;
                font-weight: bold;
                cursor: pointer;
                width: 16px;
                height: 16px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s;
                z-index: 10;
            }
            .delete-button:hover {
                color: #c82333;
            }
            .used-days {
                font-size: 12px;
                color: white;
            }
        </style>
        <div class="calendar-container">
            <div class="calendar-grid-wrapper">
                <div class="days-remaining">
                    <h3>Kvarvarande Dagar</h3>
                    <p><strong>Förälder 1</strong>: ${förälder1InkomstDagar} sjukpenningnivå, ${förälder1LägstanivåDagar} lägstanivå</p>
                    <p><strong>Förälder 2</strong>: ${förälder2InkomstDagar} sjukpenningnivå, ${förälder2LägstanivåDagar} lägstanivå</p>
                </div>
                <button class="transfer-button">Överför optimering</button>
                <div class="blocks-container">
                    <h3>Disponibla Månadsblock</h3>
    `;

    // Add available blocks
    blocks.forEach(block => {
        calendarHtml += `
            <div class="calendar-block block-parent${block.parent}" draggable="true" data-block-id="${block.id}">
                Förälder ${block.parent}
            </div>
        `;
    });

    calendarHtml += `
                </div>
                <div class="calendar-grid">
    `;

    // Add month cells
    monthLabels.forEach((label, index) => {
        calendarHtml += `
            <div class="calendar-month" data-month-index="${index}">
                <div class="calendar-month-header">${label}</div>
                <div class="month-blocks"></div>
                <div class="income-display">Inkomst: - <button class="info-button" data-month-index="${index}">i</button></div>
            </div>
        `;
    });

    calendarHtml += `
                </div>
                <button class="reset-button">Återställ Kalender</button>
            </div>
        </div>
    `;
    calendarContainer.innerHTML = calendarHtml;

    // Drag and Drop functionality
    const blocksElements = document.querySelectorAll('.calendar-block');
    const months = document.querySelectorAll('.calendar-month');
    const resetButton = document.querySelector('.reset-button');
    const transferButton = document.querySelector('.transfer-button');
    const blocksContainer = document.querySelector('.blocks-container');

    blocksElements.forEach(block => {
        block.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('block-id', block.dataset.blockId);
            e.dataTransfer.setData('source', block.parentElement.classList.contains('month-blocks') ? 'month' : 'container');
        });
    });

    months.forEach(month => {
        month.addEventListener('dragover', (e) => {
            e.preventDefault();
            month.classList.add('drop-target');
        });

        month.addEventListener('dragleave', () => {
            month.classList.remove('drop-target');
        });

        month.addEventListener('drop', (e) => {
            e.preventDefault();
            month.classList.remove('drop-target');
            const blockId = e.dataTransfer.getData('block-id');
            const source = e.dataTransfer.getData('source');
            const block = document.querySelector(`[data-block-id="${blockId}"]`);
            if (!block) return;

            const monthIndex = parseInt(month.dataset.monthIndex);
            const parent = block.classList.contains('block-parent1') ? 1 : 2;
            const parentKey = `parent${parent}`;

            // Prevent multiple blocks of the same parent
            if (calendarState[monthIndex][parentKey]) {
                console.log(`Parent ${parent} block already exists in month ${monthIndex}`);
                return;
            }

            // If moving from another month, clear the source month's state
            if (source === 'month') {
                const sourceMonth = Array.from(months).find(m => m.querySelector(`[data-block-id="${blockId}"]`));
                if (sourceMonth) {
                    const sourceIndex = parseInt(sourceMonth.dataset.monthIndex);
                    const sourceParentKey = block.classList.contains('block-parent1') ? 'parent1' : 'parent2';
                    calendarState[sourceIndex][sourceParentKey] = null;
                    sourceMonth.classList.remove('double-days', 'below-threshold');
                }
            }

            // Calculate total normal days used before this block
            const normalDaysUsed = calculateNormalDaysUsed(monthIndex, false);

            // Update calendar state
            calendarState[monthIndex][parentKey] = {
                blockId,
                daysPerWeek: 7,
                lagstaniva: false,
                lagstanivaDays: 0,
                transferred: false,
                normalDays: normalDaysUsed
            };

            // Move block to month
            const monthBlocks = month.querySelector('.month-blocks');
            block.classList.remove(`block-parent${parent}-lagstaniva`, 'block-transferred');
            block.classList.add(`block-parent${parent}`);
            block.innerHTML = `
                <div>Förälder ${parent}</div>
                <div class="used-days">Använda dagar: ${Math.round(7 * 4.3)}</div>
                <select class="days-select">
                    ${[0, 1, 2, 3, 4, 5, 6, 7].map(days => `
                        <option value="${days}" ${days === 7 ? 'selected' : ''}>${days} dagar/vecka</option>
                    `).join('')}
                </select>
                <label class="lagstaniva-checkbox">
                    <input type="checkbox" class="lagstaniva-input" ${normalDaysUsed < 180 ? 'disabled' : ''}> Lägstanivå
                </label>
                <select class="lagstaniva-days-select">
                    ${[1, 2, 3, 4, 5, 6, 7].map(days => `
                        <option value="${days}" ${days === 1 ? 'selected' : ''}>${days} dagar/vecka</option>
                    `).join('')}
                </select>
                <button class="delete-button" title="Ta bort">X</button>
            `;
            monthBlocks.appendChild(block);

            // Update visual style for double-days
            if (calendarState[monthIndex].parent1 && calendarState[monthIndex].parent2) {
                month.classList.add('double-days');
            } else {
                month.classList.remove('double-days');
            }

            // Add event listeners
            setupBlockListeners(block, monthIndex, parent);

            // Update income and remaining days
            updateIncomeDisplay();
            updateRemainingDays();
        });
    });

    // Reset button functionality
    resetButton.addEventListener('click', () => {
        // Clear calendar state
        calendarState.forEach(state => {
            state.parent1 = null;
            state.parent2 = null;
        });

        // Reset block usage
        blocks.forEach(block => {
            block.used = false;
        });

        // Move blocks back to container
        blocksElements.forEach(block => {
            const parent = block.classList.contains('block-parent1') ? 1 : 2;
            block.classList.remove(`block-parent${parent}-lagstaniva`, 'block-transferred');
            block.classList.add(`block-parent${parent}`);
            block.innerHTML = `Förälder ${parent}`;
            blocksContainer.appendChild(block);
        });

        // Clear month blocks and reset styles
        months.forEach(month => {
            const monthBlocks = month.querySelector('.month-blocks');
            monthBlocks.innerHTML = '';
            month.classList.remove('double-days', 'below-threshold');
        });

        // Update income and remaining days
        updateIncomeDisplay();
        updateRemainingDays();
    });

    // Parse feasibility message to get periods and days/week
    function parseFeasibilityMessage(message, startDate) {
        const periods = { parent1: [], parent2: [] };
        if (!message) return periods;

        // Example: "Förälder 1: 2025-06-01 to 2026-01-31, 3 dagar/vecka; Förälder 2: 2026-02-01 to 2026-05-31, 4 dagar/vecka"
        const parentSections = message.split(';').map(s => s.trim());
        parentSections.forEach(section => {
            const match = section.match(/Förälder (\d): (\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2}), (\d) dagar\/vecka/);
            if (match) {
                const parent = parseInt(match[1]);
                const start = new Date(match[2]);
                const end = new Date(match[3]);
                const daysPerWeek = parseInt(match[4]);
                periods[`parent${parent}`].push({ start, end, daysPerWeek });
            }
        });

        // Normalize dates to calendar months
        periods.parent1.forEach(period => {
            period.startMonth = Math.max(0, (period.start.getFullYear() - startDate.getFullYear()) * 12 + period.start.getMonth() - startDate.getMonth());
            period.endMonth = Math.min(monthsToShow - 1, (period.end.getFullYear() - startDate.getFullYear()) * 12 + period.end.getMonth() - startDate.getMonth());
        });
        periods.parent2.forEach(period => {
            period.startMonth = Math.max(0, (period.start.getFullYear() - startDate.getFullYear()) * 12 + period.start.getMonth() - startDate.getMonth());
            period.endMonth = Math.min(monthsToShow - 1, (period.end.getFullYear() - startDate.getFullYear()) * 12 + period.end.getMonth() - startDate.getMonth());
        });

        console.log('Parsed feasibility periods:', periods);
        return periods;
    }

    // Transfer optimization functionality
    transferButton.addEventListener('click', () => {
        console.log('Transfer button clicked, appState:', appState);
        // Clear current calendar state
        calendarState.forEach(state => {
            state.parent1 = null;
            state.parent2 = null;
        });
        months.forEach(month => {
            const monthBlocks = month.querySelector('.month-blocks');
            monthBlocks.innerHTML = '';
            month.classList.remove('double-days', 'below-threshold');
        });

        // Reset block usage
        blocks.forEach(block => {
            block.used = false;
        });

        // Parse feasibility message
        const periods = parseFeasibilityMessage(appState.genomförbarhet?.message, startDate);

        // Generate schedule based on chart.js logic and feasibility message
        const period1Weeks = appState.plan1?.weeks || (ledigTid1 * 4.3);
        const period2Weeks = appState.plan2?.weeks || (ledigTid2 * 4.3);
        const transferredDays = parseFloat(appState.genomförbarhet?.transferredDays || 0);
        const transferredWeeks = transferredDays > 0 && appState.plan1?.dagarPerVecka > 0 ? Math.ceil(transferredDays / appState.plan1.dagarPerVecka) : 0;
        const dadLeaveWeeks = (appState.vårdnad === 'gemensam' && appState.beräknaPartner === 'ja') ? 2 : 0;
        const totalWeeks = Math.max(period1Weeks + period2Weeks, 60);
        const weeksPerMonth = 4.3;

        // Initialize schedule
        const schedule = Array(monthsToShow).fill().map(() => ({ parent1Months: 0, parent2Months: 0 }));
        let currentWeek = 0;

        // Dad leave (first 2 weeks)
        if (dadLeaveWeeks > 0) {
            const monthIndex = Math.floor(currentWeek / weeksPerMonth);
            if (monthIndex < monthsToShow) {
                schedule[monthIndex].parent1Months = 1;
                schedule[monthIndex].parent2Months = 1;
            }
            currentWeek += dadLeaveWeeks;
        }

        // Assign periods from feasibility message
        periods.parent1.forEach(period => {
            for (let i = period.startMonth; i <= period.endMonth; i++) {
                schedule[i].parent1Months = 1;
            }
        });
        periods.parent2.forEach(period => {
            for (let i = period.startMonth; i <= period.endMonth; i++) {
                schedule[i].parent2Months = 1;
            }
        });

        // Fallback: Use chart.js periods if feasibility message is incomplete
        if (!periods.parent1.length) {
            let weeksAssigned = 0;
            while (weeksAssigned < period1Weeks && currentWeek < totalWeeks) {
                const monthIndex = Math.floor(currentWeek / weeksPerMonth);
                if (monthIndex >= monthsToShow) break;
                schedule[monthIndex].parent1Months = 1;
                weeksAssigned += weeksPerMonth;
                currentWeek += weeksPerMonth;
            }
        }
        if (!periods.parent2.length) {
            let weeksAssigned = 0;
            while (weeksAssigned < period2Weeks + transferredWeeks && currentWeek < totalWeeks) {
                const monthIndex = Math.floor(currentWeek / weeksPerMonth);
                if (monthIndex >= monthsToShow) break;
                schedule[monthIndex].parent2Months = 1;
                weeksAssigned += weeksPerMonth;
                currentWeek += weeksPerMonth;
            }
        }

        console.log('Generated schedule:', schedule);
        console.log('Plan1 dagarPerVecka:', appState.plan1?.dagarPerVecka, 'Plan2 dagarPerVecka:', appState.plan2?.dagarPerVecka);

        // Place blocks based on schedule
        let parent1BlocksUsed = 0;
        let parent2BlocksUsed = 0;
        let transferredBlocksAssigned = 0;
        const maxParent2Blocks = Math.floor(ledigTid2);

        schedule.forEach((entry, monthIndex) => {
            if (monthIndex >= monthsToShow) return;

            const month = months[monthIndex];
            const monthBlocks = month.querySelector('.month-blocks');
            const normalDaysUsed = calculateNormalDaysUsed(monthIndex, false);

            // Determine daysPerWeek from feasibility periods
            let daysPerWeek1 = parseInt(appState.plan1?.dagarPerVecka || 7);
            let daysPerWeek2 = monthIndex === 0 && dadLeaveWeeks > 0 ? 5 : parseInt(appState.plan2?.dagarPerVecka || 7);
            periods.parent1.forEach(period => {
                if (monthIndex >= period.startMonth && monthIndex <= period.endMonth) {
                    daysPerWeek1 = period.daysPerWeek;
                }
            });
            periods.parent2.forEach(period => {
                if (monthIndex >= period.startMonth && monthIndex <= period.endMonth) {
                    daysPerWeek2 = period.daysPerWeek;
                }
            });

            // Parent 1
            if (entry.parent1Months > 0 && parent1BlocksUsed < Math.floor(ledigTid1)) {
                const block = blocks.find(b => b.parent === 1 && !b.used);
                if (block) {
                    block.used = true;
                    parent1BlocksUsed++;
                    calendarState[monthIndex].parent1 = {
                        blockId: block.id,
                        daysPerWeek: daysPerWeek1,
                        lagstaniva: false,
                        lagstanivaDays: 0,
                        transferred: false,
                        normalDays: normalDaysUsed
                    };

                    const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                    blockElement.classList.remove('block-parent1-lagstaniva', 'block-transferred');
                    blockElement.classList.add('block-parent1');
                    blockElement.innerHTML = `
                        <div>Förälder 1</div>
                        <div class="used-days">Använda dagar: ${Math.round(daysPerWeek1 * 4.3)}</div>
                        <select class="days-select">
                            ${[0, 1, 2, 3, 4, 5, 6, 7].map(days => `
                                <option value="${days}" ${days === daysPerWeek1 ? 'selected' : ''}>${days} dagar/vecka</option>
                            `).join('')}
                        </select>
                        <label class="lagstaniva-checkbox">
                            <input type="checkbox" class="lagstaniva-input" ${normalDaysUsed < 180 ? 'disabled' : ''}> Lägstanivå
                        </label>
                        <select class="lagstaniva-days-select">
                            ${[1, 2, 3, 4, 5, 6, 7].map(days => `
                                <option value="${days}" ${days === 1 ? 'selected' : ''}>${days} dagar/vecka</option>
                            `).join('')}
                        </select>
                        <button class="delete-button" title="Ta bort">X</button>
                    `;
                    monthBlocks.appendChild(blockElement);
                    setupBlockListeners(blockElement, monthIndex, 1);
                }
            }

            // Parent 2
            if (entry.parent2Months > 0 && parent2BlocksUsed < Math.floor(ledigTid2) + transferredWeeks) {
                const block = blocks.find(b => b.parent === 2 && !b.used);
                if (block) {
                    block.used = true;
                    parent2BlocksUsed++;
                    const isTransferred = parent2BlocksUsed > maxParent2Blocks;
                    calendarState[monthIndex].parent2 = {
                        blockId: block.id,
                        daysPerWeek: daysPerWeek2,
                        lagstaniva: false,
                        lagstanivaDays: 0,
                        transferred: isTransferred,
                        normalDays: normalDaysUsed
                    };

                    const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                    blockElement.classList.remove('block-parent2-lagstaniva');
                    blockElement.classList.add('block-parent2');
                    if (isTransferred) {
                        blockElement.classList.add('block-transferred');
                    }
                    blockElement.innerHTML = `
                        <div>Förälder 2${isTransferred ? ': Överförda dagar' : ''}</div>
                        <div class="used-days">Använda dagar: ${Math.round(daysPerWeek2 * 4.3)}</div>
                        <select class="days-select">
                            ${[0, 1, 2, 3, 4, 5, 6, 7].map(days => `
                                <option value="${days}" ${days === daysPerWeek2 ? 'selected' : ''}>${days} dagar/vecka</option>
                            `).join('')}
                        </select>
                        <label class="lagstaniva-checkbox">
                            <input type="checkbox" class="lagstaniva-input" ${normalDaysUsed < 180 ? 'disabled' : ''}> Lägstanivå
                        </label>
                        <select class="lagstaniva-days-select">
                            ${[1, 2, 3, 4, 5, 6, 7].map(days => `
                                <option value="${days}" ${days === 1 ? 'selected' : ''}>${days} dagar/vecka</option>
                            `).join('')}
                        </select>
                        <button class="delete-button" title="Ta bort">X</button>
                    `;
                    monthBlocks.appendChild(blockElement);
                    setupBlockListeners(blockElement, monthIndex, 2);
                    if (isTransferred) {
                        transferredBlocksAssigned++;
                    }
                }
            }

            // Update double-days style
            if (calendarState[monthIndex].parent1 && calendarState[monthIndex].parent2) {
                month.classList.add('double-days');
            }
        });

        // Move remaining blocks to container
        blocks.forEach(block => {
            if (!block.used) {
                const blockElement = document.querySelector(`[data-block-id="${block.id}"]`);
                blockElement.classList.remove(`block-parent${block.parent}-lagstaniva`, 'block-transferred');
                blockElement.classList.add(`block-parent${block.parent}`);
                blockElement.innerHTML = `Förälder ${block.parent}`;
                blocksContainer.appendChild(blockElement);
            }
        });

        console.log('Calendar state after transfer:', calendarState);
        console.log('Transferred blocks assigned:', transferredBlocksAssigned);

        // Update income and remaining days
        updateIncomeDisplay();
        updateRemainingDays();
    });

    // Helper to set up block event listeners
    function setupBlockListeners(block, monthIndex, parent) {
        const parentKey = `parent${parent}`;
        const select = block.querySelector('.days-select');
        const lagstanivaCheckbox = block.querySelector('.lagstaniva-input');
        const lagstanivaSelect = block.querySelector('.lagstaniva-days-select');

        // Update normal days dropdown options based on lägstanivå days
        function updateDaysOptions() {
            const lagstanivaDays = parseInt(calendarState[monthIndex][parentKey].lagstanivaDays || 0);
            const maxNormalDays = calendarState[monthIndex][parentKey].lagstaniva ? 7 - lagstanivaDays : 7;
            const currentNormalDays = parseInt(calendarState[monthIndex][parentKey].daysPerWeek);
            select.innerHTML = Array.from({ length: maxNormalDays + 1 }, (_, i) => `
                <option value="${i}" ${i === currentNormalDays ? 'selected' : ''}>${i} dagar/vecka</option>
            `).join('');
        }

        // Update lägstanivå days dropdown options
        function updateLagstanivaOptions() {
            const maxLagstanivaDays = 7 - parseInt(calendarState[monthIndex][parentKey].daysPerWeek || 0);
            const currentLagstanivaDays = parseInt(calendarState[monthIndex][parentKey].lagstanivaDays || 1);
            lagstanivaSelect.innerHTML = Array.from({ length: maxLagstanivaDays }, (_, i) => {
                const days = i + 1;
                return `<option value="${days}" ${days === currentLagstanivaDays ? 'selected' : ''}>${days} dagar/vecka</option>`;
            }).join('');
        }

        // Normal days dropdown
        select.addEventListener('change', () => {
            calendarState[monthIndex][parentKey].daysPerWeek = parseInt(select.value);
            if (calendarState[monthIndex][parentKey].lagstaniva) {
                updateLagstanivaOptions();
            }
            block.querySelector('.used-days').textContent = `Använda dagar: ${Math.round((calendarState[monthIndex][parentKey].daysPerWeek + (calendarState[monthIndex][parentKey].lagstanivaDays || 0)) * 4.3)}`;
            updateIncomeDisplay();
            updateRemainingDays();
        });

        // Lägstanivå checkbox
        lagstanivaCheckbox.addEventListener('change', () => {
            calendarState[monthIndex][parentKey].lagstaniva = lagstanivaCheckbox.checked;
            if (lagstanivaCheckbox.checked) {
                block.classList.remove(`block-parent${parent}`, 'block-transferred');
                block.classList.add(`block-parent${parent}-lagstaniva`);
                calendarState[monthIndex][parentKey].lagstanivaDays = 1;
                calendarState[monthIndex][parentKey].daysPerWeek = Math.min(calendarState[monthIndex][parentKey].daysPerWeek, 6);
                block.querySelector('.lagstaniva-days-select').classList.add('active');
                updateDaysOptions();
                updateLagstanivaOptions();
            } else {
                block.classList.remove(`block-parent${parent}-lagstaniva`);
                block.classList.add(`block-parent${parent}`);
                if (calendarState[monthIndex][parentKey].transferred) {
                    block.classList.add('block-transferred');
                }
                calendarState[monthIndex][parentKey].lagstanivaDays = 0;
                block.querySelector('.lagstaniva-days-select').classList.remove('active');
                updateDaysOptions();
            }
            block.querySelector('.used-days').textContent = `Använda dagar: ${Math.round((calendarState[monthIndex][parentKey].daysPerWeek + (calendarState[monthIndex][parentKey].lagstanivaDays || 0)) * 4.3)}`;
            updateIncomeDisplay();
            updateRemainingDays();
        });

        // Lägstanivå days dropdown
        lagstanivaSelect.addEventListener('change', () => {
            calendarState[monthIndex][parentKey].lagstanivaDays = parseInt(lagstanivaSelect.value);
            calendarState[monthIndex][parentKey].daysPerWeek = Math.min(calendarState[monthIndex][parentKey].daysPerWeek, 7 - calendarState[monthIndex][parentKey].lagstanivaDays);
            updateDaysOptions();
            block.querySelector('.used-days').textContent = `Använda dagar: ${Math.round((calendarState[monthIndex][parentKey].daysPerWeek + calendarState[monthIndex][parentKey].lagstanivaDays) * 4.3)}`;
            updateIncomeDisplay();
            updateRemainingDays();
        });

        // Delete button
        const deleteButton = block.querySelector('.delete-button');
        deleteButton.addEventListener('click', () => {
            calendarState[monthIndex][parentKey] = null;
            block.classList.remove(`block-parent${parent}-lagstaniva`, 'block-transferred');
            block.classList.add(`block-parent${parent}`);
            block.innerHTML = `Förälder ${parent}`;
            blocksContainer.appendChild(block);
            months[monthIndex].classList.remove('double-days', 'below-threshold');
            updateIncomeDisplay();
            updateRemainingDays();
        });

        // Initialize dropdowns
        if (calendarState[monthIndex][parentKey].lagstaniva) {
            block.querySelector('.lagstaniva-days-select').classList.add('active');
            updateDaysOptions();
            updateLagstanivaOptions();
        }
    }

    // Calculate total normal days used up to a given month (excluding the target month if specified)
    function calculateNormalDaysUsed(upToMonthIndex, includeCurrent = true) {
        let totalDaysUsed1 = 0;
        let totalDaysUsed2 = 0;

        for (let i = 0; i < monthsToShow; i++) {
            if (!includeCurrent && i === upToMonthIndex) continue;
            if (calendarState[i].parent1 && !calendarState[i].parent1.lagstaniva) {
                totalDaysUsed1 += calendarState[i].parent1.daysPerWeek * 4.3;
            } else if (calendarState[i].parent1) {
                totalDaysUsed1 += (calendarState[i].parent1.daysPerWeek + calendarState[i].parent1.lagstanivaDays) * 4.3;
            }
            if (calendarState[i].parent2 && !calendarState[i].parent2.lagstaniva) {
                totalDaysUsed2 += calendarState[i].parent2.daysPerWeek * 4.3;
            } else if (calendarState[i].parent2) {
                totalDaysUsed2 += (calendarState[i].parent2.daysPerWeek + calendarState[i].parent2.lagstanivaDays) * 4.3;
            }
        }

        return totalDaysUsed1 + totalDaysUsed2;
    }

    // Calculate and update remaining days (sjukpenningnivå and lägstanivå)
    function updateRemainingDays() {
        let totalDaysUsed1 = 0;
        let totalDaysUsed2 = 0;
        let lagstanivaDaysUsed1 = 0;
        let lagstanivaDaysUsed2 = 0;

        calendarState.forEach(state => {
            if (state.parent1) {
                const normalDays = state.parent1.daysPerWeek * 4.3;
                const lagstanivaDays = (state.parent1.lagstanivaDays || 0) * 4.3;
                if (state.parent1.lagstaniva) {
                    lagstanivaDaysUsed1 += lagstanivaDays;
                    totalDaysUsed1 += normalDays;
                } else {
                    totalDaysUsed1 += normalDays;
                }
            }
            if (state.parent2) {
                const normalDays = state.parent2.daysPerWeek * 4.3;
                const lagstanivaDays = (state.parent2.lagstanivaDays || 0) * 4.3;
                if (state.parent2.lagstaniva) {
                    lagstanivaDaysUsed2 += lagstanivaDays;
                    totalDaysUsed2 += normalDays;
                } else {
                    totalDaysUsed2 += normalDays;
                }
            }
        });

        const daysRemaining1 = Math.max(0, förälder1InkomstDagar - totalDaysUsed1);
        const daysRemaining2 = Math.max(0, förälder2InkomstDagar - totalDaysUsed2);
        const lagstanivaRemaining1 = Math.max(0, förälder1LägstanivåDagar - lagstanivaDaysUsed1);
        const lagstanivaRemaining2 = Math.max(0, förälder2LägstanivåDagar - lagstanivaDaysUsed2);

        document.querySelector('.days-remaining p:nth-child(2)').innerHTML = `<strong>Förälder 1</strong>: ${Math.round(daysRemaining1)} sjukpenningnivå, ${Math.round(lagstanivaRemaining1)} lägstanivå`;
        document.querySelector('.days-remaining p:nth-child(3)').innerHTML = `<strong>Förälder 2</strong>: ${Math.round(daysRemaining2)} sjukpenningnivå, ${Math.round(lagstanivaRemaining2)} lägstanivå`;

        // Update lägstanivå checkbox disabled state
        months.forEach((month, index) => {
            const checkbox = month.querySelector('.lagstaniva-input');
            if (checkbox) {
                const normalDaysUsed = calculateNormalDaysUsed(index, false);
                checkbox.disabled = normalDaysUsed < 180;
            }
        });
    }

    // Income calculation with info button
    function updateIncomeDisplay() {
        months.forEach((month, index) => {
            const incomeDisplay = month.querySelector('.income-display');
            const infoButton = month.querySelector('.info-button');
            let combinedIncome = 0;
            let infoText = '';

            const { inkomst1, inkomst2, dag1, extra1, dag2, extra2, avtal1, avtal2, barnbidragPerPerson, tilläggPerPerson, vårdnad, inkomstTröskel } = appState;
            const parsedInkomst1 = parseFloat(inkomst1 || 0);
            const parsedInkomst2 = parseFloat(inkomst2 || 0);
            const parsedDag1 = parseFloat(dag1 || 0);
            const parsedDag2 = parseFloat(dag2 || 0);
            const parsedExtra1 = parseFloat(extra1 || 0);
            const parsedExtra2 = parseFloat(extra2 || 0);

            if (calendarState[index].parent1 && calendarState[index].parent2) {
                // Double-days: Both on leave
                const days1 = calendarState[index].parent1.daysPerWeek;
                const lagstanivaDays1 = calendarState[index].parent1.lagstanivaDays || 0;
                const days2 = calendarState[index].parent2.daysPerWeek;
                const lagstanivaDays2 = calendarState[index].parent2.lagstanivaDays || 0;
                const income1 = calendarState[index].parent1.lagstaniva
                    ? (180 * lagstanivaDays1 * 4.3) + beräknaMånadsinkomst(parsedDag1, days1, avtal1 ? parsedExtra1 : 0, barnbidragPerPerson, tilläggPerPerson)
                    : beräknaMånadsinkomst(parsedDag1, days1, avtal1 ? parsedExtra1 : 0, barnbidragPerPerson, tilläggPerPerson);
                const income2 = calendarState[index].parent2.lagstaniva
                    ? (180 * lagstanivaDays2 * 4.3) + beräknaMånadsinkomst(parsedDag2, days2, avtal2 ? parsedExtra2 : 0, barnbidragPerPerson, tilläggPerPerson)
                    : beräknaMånadsinkomst(parsedDag2, days2, avtal2 ? parsedExtra2 : 0, barnbidragPerPerson, tilläggPerPerson);
                combinedIncome = income1 + (vårdnad === 'ensam' ? 0 : income2);
                infoText = `Förälder 1 Ledig: ${Math.round(days1 * 4.3)} dagar á ${Math.round(parsedDag1)} SEK/dag` +
                           (lagstanivaDays1 > 0 ? `, ${Math.round(lagstanivaDays1 * 4.3)} lägstanivådagar á 180 SEK/dag` : '') + '<br>' +
                           `Förälder 2 Ledig${calendarState[index].parent2.transferred ? ': Överförda dagar' : ''}: ${Math.round(days2 * 4.3)} dagar á ${Math.round(parsedDag2)} SEK/dag` +
                           (lagstanivaDays2 > 0 ? `, ${Math.round(lagstanivaDays2 * 4.3)} lägstanivådagar á 180 SEK/dag` : '') + '<br>' +
                           `Barnbidrag + tillägg: ${barnbidragPerPerson + tilläggPerPerson} SEK/mån`;
                incomeDisplay.classList.add('has-blocks');
            } else if (calendarState[index].parent1) {
                // Parent 1 on leave, Parent 2 working
                const days1 = calendarState[index].parent1.daysPerWeek;
                const lagstanivaDays1 = calendarState[index].parent1.lagstanivaDays || 0;
                const income1 = calendarState[index].parent1.lagstaniva
                    ? (180 * lagstanivaDays1 * 4.3) + beräknaMånadsinkomst(parsedDag1, days1, avtal1 ? parsedExtra1 : 0, barnbidragPerPerson, tilläggPerPerson)
                    : beräknaMånadsinkomst(parsedDag1, days1, avtal1 ? parsedExtra1 : 0, barnbidragPerPerson, tilläggPerPerson);
                const income2 = parsedInkomst2 + barnbidragPerPerson + tilläggPerPerson;
                combinedIncome = income1 + (vårdnad === 'ensam' ? 0 : income2);
                infoText = `Förälder 1 Ledig: ${Math.round(days1 * 4.3)} dagar á ${Math.round(parsedDag1)} SEK/dag` +
                           (lagstanivaDays1 > 0 ? `, ${Math.round(lagstanivaDays1 * 4.3)} lägstanivådagar á 180 SEK/dag` : '') + '<br>' +
                           `Förälder 2 Lön: ${parsedInkomst2} SEK/mån<br>` +
                           `Barnbidrag + tillägg: ${barnbidragPerPerson + tilläggPerPerson} SEK/mån`;
                if (calendarState[index].parent1.lagstaniva && lagstanivaDays1 * 4.3 < 30) {
                    infoText += `<br>Endast ${Math.round(lagstanivaDays1 * 4.3)} av 30 dagar är lägstanivå`;
                }
                incomeDisplay.classList.add('has-blocks');
            } else if (calendarState[index].parent2) {
                // Parent 2 on leave, Parent 1 working
                const days2 = calendarState[index].parent2.daysPerWeek;
                const lagstanivaDays2 = calendarState[index].parent2.lagstanivaDays || 0;
                const income1 = parsedInkomst1 + barnbidragPerPerson + tilläggPerPerson;
                const income2 = calendarState[index].parent2.lagstaniva
                    ? (180 * lagstanivaDays2 * 4.3) + beräknaMånadsinkomst(parsedDag2, days2, avtal2 ? parsedExtra2 : 0, barnbidragPerPerson, tilläggPerPerson)
                    : beräknaMånadsinkomst(parsedDag2, days2, avtal2 ? parsedExtra2 : 0, barnbidragPerPerson, tilläggPerPerson);
                combinedIncome = income1 + (vårdnad === 'ensam' ? 0 : income2);
                infoText = `Förälder 1 Lön: ${parsedInkomst1} SEK/mån<br>` +
                           `Förälder 2 Ledig${calendarState[index].parent2.transferred ? ': Överförda dagar' : ''}: ${Math.round(days2 * 4.3)} dagar á ${Math.round(parsedDag2)} SEK/dag` +
                           (lagstanivaDays2 > 0 ? `, ${Math.round(lagstanivaDays2 * 4.3)} lägstanivådagar á 180 SEK/dag` : '') + '<br>' +
                           `Barnbidrag + tillägg: ${barnbidragPerPerson + tilläggPerPerson} SEK/mån`;
                if (calendarState[index].parent2.lagstaniva && lagstanivaDays2 * 4.3 < 30) {
                    infoText += `<br>Endast ${Math.round(lagstanivaDays2 * 4.3)} av 30 dagar är lägstanivå`;
                }
                incomeDisplay.classList.add('has-blocks');
            } else {
                // Both working
                const income1 = parsedInkomst1 + barnbidragPerPerson + tilläggPerPerson;
                const income2 = parsedInkomst2 + barnbidragPerPerson + tilläggPerPerson;
                combinedIncome = income1 + (vårdnad === 'ensam' ? 0 : income2);
                infoText = `Förälder 1 Lön: ${parsedInkomst1} SEK/mån<br>` +
                           `Förälder 2 Lön: ${parsedInkomst2} SEK/mån<br>` +
                           `Barnbidrag + tillägg: ${barnbidragPerPerson + tilläggPerPerson} SEK/mån`;
                incomeDisplay.classList.remove('has-blocks');
            }

            // Check income threshold
            const threshold = parseFloat(inkomstTröskel || 0);
            if (!isNaN(threshold) && threshold > 0 && combinedIncome < threshold) {
                console.log(`Month ${index}: Combined income ${combinedIncome} < Threshold ${threshold}`);
                month.classList.add('below-threshold');
                infoText = `OBS! Min. inkomst om ${Math.round(threshold).toLocaleString('sv-SE')} SEK är inte uppfyllt: ${Math.round(combinedIncome).toLocaleString('sv-SE')} SEK/mån<br>` + infoText;
            } else {
                month.classList.remove('below-threshold');
            }

            incomeDisplay.firstChild.textContent = `Inkomst: ${Math.round(combinedIncome).toLocaleString('sv-SE')} kr `;
            infoButton.dataset.info = infoText;

            // Update used days display
            if (calendarState[index].parent1) {
                const block1 = month.querySelector(`[data-block-id="${calendarState[index].parent1.blockId}"]`);
                if (block1) {
                    block1.querySelector('.used-days').textContent = `Använda dagar: ${Math.round((calendarState[index].parent1.daysPerWeek + (calendarState[index].parent1.lagstanivaDays || 0)) * 4.3)}`;
                }
            }
            if (calendarState[index].parent2) {
                const block2 = month.querySelector(`[data-block-id="${calendarState[index].parent2.blockId}"]`);
                if (block2) {
                    block2.querySelector('.used-days').textContent = `Använda dagar: ${Math.round((calendarState[index].parent2.daysPerWeek + (calendarState[index].parent2.lagstanivaDays || 0)) * 4.3)}`;
                }
            }
        });
    }

    // Initial updates
    updateIncomeDisplay();
    updateRemainingDays();
}