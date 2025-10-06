/**
 * config.js - Constants and global variables for Föräldrapenningkalkylator
 * Stores static values like income caps, benefit amounts, and default preferences.
 */

(function initConfig(global) {
    if (global.appConfig) {
        return;
    }

    const config = {
        vårdnad: "gemensam",
        beräknaPartner: "ja",
        barnIdag: 0,
        barnPlanerat: 0,
        hasCalculated: false,
        förälder1InkomstDagar: 195,
        förälder2InkomstDagar: 195,
        förälder1LägstanivåDagar: 45,
        förälder2LägstanivåDagar: 45,
        förälder1MinDagar: 45,
        förälder2MinDagar: 45,
        barnbidragPerPerson: 625,
        tilläggPerPerson: 0,
        INCOME_CAP: 1250,
        MINIMUM_RATE: 180,
        SGI_CAP: 49000,
        DEFAULT_BARNBIDRAG: 625,
        PRISBASBELOPP: 58800,
        defaultPreferences: {
            deltid: "nej",
            ledigTid1: 6,
            minInkomst: 10000,
            strategy: "longer"
        }
    };

    global.appConfig = config;
})(window);
