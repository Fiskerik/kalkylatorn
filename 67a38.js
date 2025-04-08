class ParentalBenefitForm {
    static MIN_BENEFIT_PAYMENT = 250;
    static MAX_BENEFIT_PAYMENT = 1218;
    constructor() {
        this.formatter = new Intl.NumberFormat("sv-SE");
        this.elements = this.initializeElements();
        this.monthlyPayments = [];
        this.requiredStates = new Map();
        this.fieldErrors = new Map();
        this.handleFormEvents = this.handleFormEvents.bind(this);
        this.boundHandleResultsViewEvents = this.handleResultsViewEvents.bind(this);
        this.initializeStatusElement();
        this.initializeRequiredStates();
        this.initializeEventListeners();
    }
    initializeEventListeners() {
        this.attachFormListeners();
    }
    initializeStatusElement() {
        this.statusElement = document.createElement("div");
        this.statusElement.className = "submission-status hidden";
        this.elements.form.insertAdjacentElement("afterend", this.statusElement);
    }
    initializeElements() {
        return {
            resultsView: document.getElementById("results-view"),
            formView: document.getElementById("form-view"),
            form: document.getElementById("parental-benefit-form"),
        };
    }
    handleFormEvents(event) {
        switch (event.type) {
        case "change":
            if (event.target.matches("input, select")) {
                this.handleFieldChange(event);
            }
            break;
        case "input":
            if (event.target.matches("input, select")) {
                this.clearFieldError(event.target);
            }
            break;
        case "submit":
            this.handleSubmit(event);
            break;
        }
    }
    handleResultsViewEvents(event) {
        if (event.target.id === "back-to-form") {
            this.switchToForm();
        }
    }
    attachFormListeners() {
        this.elements.form.addEventListener("change", this.handleFormEvents);
        this.elements.form.addEventListener("input", this.handleFormEvents);
        this.elements.form.addEventListener("submit", this.handleFormEvents);
    }
    detachFormListeners() {
        this.elements.form.removeEventListener("change", this.handleFormEvents);
        this.elements.form.removeEventListener("input", this.handleFormEvents);
        this.elements.form.removeEventListener("submit", this.handleFormEvents);
    }
    attachResultsViewListeners() {
        document.addEventListener("click", this.boundHandleResultsViewEvents);
    }
    detachResultsViewListeners() {
        document.removeEventListener("click", this.boundHandleResultsViewEvents);
    }
    initializeRequiredStates() {
        this.elements.form.querySelectorAll("input, select").forEach( (input) => {
            this.requiredStates.set(input, input.required);
            if (this.isInHiddenContainer(input)) {
                input.required = false;
            }
        }
        );
    }
    isInHiddenContainer(element) {
        let parent = element.parentElement;
        while (parent) {
            if (parent.classList.contains("hidden")) {
                return true;
            }
            parent = parent.parentElement;
        }
        return false;
    }
    handleFieldChange(event) {
        const field = event.target;
        this.checkDependencies(field.name);
        if (this.fieldErrors.has(field)) {
            this.validateField(field);
        }
    }
    checkDependencies(triggerField) {
        this.elements.form.querySelectorAll(`[data-dependent-on*="${triggerField}"]`).forEach( (targetElement) => {
            const dependencies = this.getAllDependencies(targetElement);
            const shouldShow = this.checkAllDependenciesSatisfied(dependencies);
            if (shouldShow) {
                this.showAndEnableField(targetElement);
            } else {
                this.hideAndDisableField(targetElement);
            }
            targetElement.querySelectorAll("[data-dependent-on]").forEach( (child) => {
                const childDeps = this.getAllDependencies(child);
                const shouldShowChild = this.checkAllDependenciesSatisfied(childDeps);
                if (shouldShowChild && !this.isInHiddenContainer(child)) {
                    this.showAndEnableField(child);
                } else {
                    this.hideAndDisableField(child);
                }
            }
            );
        }
        );
    }
    getAllDependencies(element) {
        const dependentOn = element.dataset.dependentOn?.split(",") || [];
        const dependentValues = element.dataset.dependentValues?.split(",") || [];
        return dependentOn.map( (field, index) => ({
            field: field.trim(),
            validValues: dependentValues[index]?.split("|").map( (v) => v.trim()) || [],
        }));
    }
    checkAllDependenciesSatisfied(dependencies) {
        return dependencies.every( (dep) => {
            const currentValue = this.getCurrentFieldValue(dep.field);
            return dep.validValues.includes(currentValue);
        }
        );
    }
    getCurrentFieldValue(fieldName) {
        const element = document.querySelector(`[name="${fieldName}"]`);
        if (!element)
            return null;
        if (element.type === "radio") {
            const checked = document.querySelector(`input[name="${fieldName}"]:checked`);
            console.log("radio: ", checked?.value);
            return checked?.value || null;
        }
        return element.value;
    }
    validateForm() {
        const requiredFields = this.elements.form.querySelectorAll("[required]:not([disabled])");
        let isValid = true;
        const validatedRadioGroups = new Set();
        requiredFields.forEach( (field) => {
            if (field.type === "radio") {
                if (validatedRadioGroups.has(field.name)) {
                    return;
                }
                validatedRadioGroups.add(field.name);
                const isChecked = document.querySelector(`input[name="${field.name}"]:checked`);
                if (!isChecked) {
                    isValid = false;
                    this.showFieldError(field, "Vänligen välj ett alternativ");
                }
            } else {
                if (!this.validateField(field)) {
                    isValid = false;
                }
            }
        }
        );
        if (!isValid) {
            const firstErrorField = this.elements.form.querySelector(".field-error-input, .fieldset-error");
            if (firstErrorField) {
                firstErrorField.scrollIntoView({
                    behavior: "smooth",
                    block: "center"
                });
                if (firstErrorField.tagName === "INPUT" || firstErrorField.tagName === "SELECT") {
                    firstErrorField.focus();
                } else {
                    const firstInput = firstErrorField.querySelector("input, select");
                    if (firstInput) {
                        firstInput.focus();
                    }
                }
            }
        }
        return isValid;
    }
    validateField(field) {
        this.clearFieldError(field);
        if (field.required && !field.value.trim()) {
            this.showFieldError(field, "Detta fält är obligatoriskt");
            return false;
        }
        if (field.name.includes("monthly-income") && field.value) {
            const value = parseFloat(field.value.replace(/\s/g, ""));
            if (isNaN(value) || value <= 0) {
                this.showFieldError(field, "Vänligen ange ett giltigt belopp");
                return false;
            }
        }
        return true;
    }
    showFieldError(field, message) {
        this.fieldErrors.set(field, message);
        let fieldWrapper;
        if (field.type === "radio") {
            fieldWrapper = field.closest("fieldset") || field.parentElement.parentElement;
        } else {
            fieldWrapper = field.parentElement;
            if (fieldWrapper.classList.contains("radio-option")) {
                fieldWrapper = fieldWrapper.parentElement.parentElement;
            }
        }
        let errorElement = fieldWrapper.querySelector(".field-error");
        if (!errorElement) {
            errorElement = document.createElement("div");
            errorElement.className = "field-error";
            if (field.type === "radio") {
                const radioOptions = fieldWrapper.querySelector(".radio-options");
                if (radioOptions) {
                    fieldWrapper.insertBefore(errorElement, radioOptions.nextElementSibling);
                } else {
                    fieldWrapper.appendChild(errorElement);
                }
            } else {
                const targetElement = field.nextElementSibling || field;
                if (targetElement.nextElementSibling) {
                    fieldWrapper.insertBefore(errorElement, targetElement.nextElementSibling);
                } else {
                    fieldWrapper.appendChild(errorElement);
                }
            }
        }
        errorElement.textContent = message;
        errorElement.style.display = "block";
        field.classList.add("field-error-input");
        if (field.type === "radio") {
            const fieldset = field.closest("fieldset");
            if (fieldset) {
                fieldset.classList.add("fieldset-error");
            }
        }
    }
    clearFieldError(field) {
        this.fieldErrors.delete(field);
        let fieldWrapper;
        if (field.type === "radio") {
            fieldWrapper = field.closest("fieldset") || field.parentElement.parentElement;
        } else {
            fieldWrapper = field.parentElement;
            if (fieldWrapper.classList.contains("radio-option")) {
                fieldWrapper = fieldWrapper.parentElement.parentElement;
            }
        }
        const errorElement = fieldWrapper.querySelector(".field-error");
        if (errorElement) {
            errorElement.style.display = "none";
            errorElement.textContent = "";
        }
        field.classList.remove("field-error-input");
        if (field.type === "radio") {
            const fieldset = field.closest("fieldset");
            if (fieldset) {
                fieldset.classList.remove("fieldset-error");
            }
        }
    }
    clearAllFieldErrors() {
        this.fieldErrors.clear();
        this.elements.form.querySelectorAll(".field-error").forEach( (error) => {
            error.style.display = "none";
            error.textContent = "";
        }
        );
        this.elements.form.querySelectorAll(".field-error-input").forEach( (field) => {
            field.classList.remove("field-error-input");
        }
        );
    }
    async handleSubmit(event) {
        event.preventDefault();
        this.clearAllFieldErrors();
        try {
            if (!this.validateForm()) {
                this.showWarning("Vänligen fyll i markerade fält.");
                return;
            }
            await this.submitForm();
        } catch (error) {
            console.error("Fel med formuläret:", error);
            this.showError("Ett fel uppstod när formuläret skulle skickas. Vänligen försök senare.");
        }
    }
    async submitForm() {
        const formData = new FormData(this.elements.form);
        formData.append("action", "submit_parental_benefit_form");
        formData.append("nonce", parentalLeaveCalculator.nonce);
        this.showStatus("Beräknar...");
        try {
            const response = await fetch(parentalLeaveCalculator.ajaxUrl, {
                method: "POST",
                credentials: "same-origin",
                body: formData,
            });
            if (!response.ok) {
                this.showError("Ett fel uppstod");
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.success) {
                this.showSuccess(data.data.message || "Formuläret har skickats in!");
                this.elements.resultsView.innerHTML = data.data.html;
                this.monthlyPayments = data.data.monthlyPayments;
                this.switchToResults();
            } else {
                throw new Error(data.data.message || "Överföringen misslyckades");
            }
        } catch (error) {
            throw error;
        }
    }
    switchToResults() {
        this.clearStatusMessages();
        this.elements.formView.classList.add("fade-out");
        this.detachFormListeners();
        this.attachResultsViewListeners();
        this.initializeInfoWindows();
        this.updateProgressBars();
        setTimeout( () => {
            this.elements.formView.classList.remove("active");
            this.elements.resultsView.classList.add("active");
            const resultsContainer = document.querySelector(".calculation-results");
            if (resultsContainer) {
                resultsContainer.scrollIntoView({
                    behavior: "smooth"
                });
            }
            setTimeout( () => {
                this.elements.resultsView.classList.add("fade-in");
            }
            , 50);
        }
        , 300);
    }
    switchToForm() {
        this.elements.resultsView.classList.remove("fade-in");
        this.detachResultsViewListeners();
        this.attachFormListeners();
        setTimeout( () => {
            this.elements.resultsView.classList.remove("active");
            this.elements.formView.classList.add("active");
            setTimeout( () => {
                this.elements.formView.classList.remove("fade-out");
            }
            , 50);
        }
        , 300);
    }
    showAndEnableField(element) {
        element.classList.remove("hidden");
        element.querySelectorAll("input, select").forEach( (input) => {
            input.disabled = false;
            if (this.requiredStates.has(input)) {
                input.required = this.requiredStates.get(input);
            }
        }
        );
    }
    hideAndDisableField(element) {
        element.classList.add("hidden");
        element.querySelectorAll("input, select").forEach( (input) => {
            if (!this.requiredStates.has(input)) {
                this.requiredStates.set(input, input.required);
            }
            input.required = false;
            input.disabled = true;
            if (input.type === "checkbox" || input.type === "radio") {
                input.checked = false;
            } else {
                input.value = "";
            }
            this.clearFieldError(input);
            input.dispatchEvent(new Event("change"));
        }
        );
    }
    updateProgressBars() {
        const paymentElements = document.querySelectorAll('[id^="daily-payment-value-parent-"]');
        paymentElements.forEach( (element) => {
            const paymentValue = parseFloat(element.textContent.replace(/\s/g, ""));
            let percentage = 0;
            if (paymentValue <= ParentalBenefitForm.MIN_BENEFIT_PAYMENT) {
                percentage = 1.5;
            } else if (paymentValue >= ParentalBenefitForm.MAX_BENEFIT_PAYMENT) {
                percentage = 100;
            } else {
                percentage = ((paymentValue - ParentalBenefitForm.MIN_BENEFIT_PAYMENT) / (ParentalBenefitForm.MAX_BENEFIT_PAYMENT - ParentalBenefitForm.MIN_BENEFIT_PAYMENT)) * 100;
            }
            const progressFill = element.closest(".benefit-card").querySelector(".progress-fill");
            progressFill.style.width = `${percentage}%`;
        }
        );
    }
    showStatus(message) {
        this.statusElement.className = "submission-status info";
        this.statusElement.textContent = message;
    }
    showError(message) {
        this.statusElement.className = "submission-status error";
        this.statusElement.textContent = message;
    }
    showWarning(message) {
        this.statusElement.className = "submission-status warning";
        this.statusElement.textContent = message;
    }
    showSuccess(message) {
        this.statusElement.className = "submission-status success";
        this.statusElement.textContent = message;
    }
    clearStatusMessages() {
        this.statusElement.className = "submission-status hidden";
        this.statusElement.textContent = "";
    }
    initializeInfoWindows() {
        document.body.removeEventListener("click", this.boundHandleInfoWindowClick);
        this.boundHandleInfoWindowClick = this.handleInfoWindowClick.bind(this);
        document.body.addEventListener("click", this.boundHandleInfoWindowClick);
    }
    handleInfoWindowClick(event) {
        const button = event.target.closest(".info-window-header");
        if (!button)
            return;
        const infoWindow = button.closest(".info-window");
        if (infoWindow) {
            this.toggleInfoWindow(infoWindow);
        }
    }
    toggleInfoWindow(infoWindow) {
        const allInfoWindows = document.querySelectorAll(".info-window");
        allInfoWindows.forEach( (window) => {
            if (window !== infoWindow && window.classList.contains("expanded")) {
                window.classList.remove("expanded");
            }
        }
        );
        infoWindow.classList.toggle("expanded");
        const chevron = infoWindow.querySelector(".chevron-icon");
        if (chevron) {
            chevron.style.transform = infoWindow.classList.contains("expanded") ? "rotate(90deg)" : "rotate(0deg)";
        }
    }
}
document.addEventListener("DOMContentLoaded", () => {
    window.formHandler = new ParentalBenefitForm();
}
);
