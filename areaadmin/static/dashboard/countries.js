const areaResourcesDefaults = {
    france: {
        human: { amount: 67000000, renew_rate: 0.01 },
        ground: { amount: 643801, renew_rate: 0.001 },
        ores: { amount: 100000, renew_rate: 0.001 },
        water: { amount: 200000, renew_rate: 0.01 },
        oil: { amount: 0, renew_rate: 0 },
        gas: { amount: 0, renew_rate: 0 },
        envEmissions: { amount: 1000000, renew_rate: -0.01 },
        pm25: { amount: 12, renew_rate: -0.001 },
        social: { amount: 50, renew_rate: 0.002 },
        economic: { amount: 250000000, renew_rate: 0 }
    },
    usa: {
        human: { amount: 331000000, renew_rate: 0.015 },
        ground: { amount: 9833517, renew_rate: 0.001 },
        ores: { amount: 2000000, renew_rate: 0.001 },
        water: { amount: 3000000, renew_rate: 0.01 },
        oil: { amount: 500000, renew_rate: 0.005 },
        gas: { amount: 800000, renew_rate: 0.005 },
        envEmissions: { amount: 5000000, renew_rate: -0.02 },
        pm25: { amount: 15, renew_rate: -0.002 },
        social: { amount: 100, renew_rate: 0.003 },
        economic: { amount: 1800000000, renew_rate: 0 }
    }
};

document.getElementById('prefill-button').addEventListener('click', function() {
    const selectedArea = document.getElementById('area-prefill').value;
    const defaults = areaResourcesDefaults[selectedArea];

    for(let metric of Processes.metricsGetIdsList()) {
        document.getElementById(`area-resources-${metric}-amount`).value = defaults[metric].amount;
        document.getElementById(`area-resources-${metric}-renew-rate`).value = defaults[metric].renew_rate;
    }
});