const countryResourcesDefaults = {
    france: {
        human: 67000000,
        human_renew_rate: 0.01,
        ground: 643801,
        ground_renew_rate: 0.001,
        ores: 100000,
        ores_renew_rate: 0.001,
        water: 200000,
        water_renew_rate: 0.01,
        oil: 0,
        oil_renew_rate: 0,
        gas: 0,
        gas_renew_rate: 0,
        co2_capacity: 1000000,
        co2_renew_rate: 0.01
    },
    usa: {
        human: 331000000,
        human_renew_rate: 0.015,
        ground: 9833517,
        ground_renew_rate: 0.001,
        ores: 2000000,
        ores_renew_rate: 0.001,
        water: 3000000,
        water_renew_rate: 0.01,
        oil: 500000,
        oil_renew_rate: 0.005,
        gas: 800000,
        gas_renew_rate: 0.005,
        co2_capacity: 5000000,
        co2_renew_rate: 0.02
    },
    allemagne: {
        human: 83000000,
        human_renew_rate: 0.01,
        ground: 357386,
        ground_renew_rate: 0.001,
        ores: 50000,
        ores_renew_rate: 0.001,
        water: 150000,
        water_renew_rate: 0.01,
        oil: 0,
        oil_renew_rate: 0,
        gas: 0,
        gas_renew_rate: 0,
        co2_capacity: 800000,
        co2_renew_rate: 0.01
    },
    espagne: {
        human: 47000000,
        human_renew_rate: 0.01,
        ground: 505992,
        ground_renew_rate: 0.001,
        ores: 30000,
        ores_renew_rate: 0.001,
        water: 100000,
        water_renew_rate: 0.01,
        oil: 0,
        oil_renew_rate: 0,
        gas: 0,
        gas_renew_rate: 0,
        co2_capacity: 600000,
        co2_renew_rate: 0.01
    },
    'royaume-uni': {
        human: 66000000,
        human_renew_rate: 0.01,
        ground: 242495,
        ground_renew_rate: 0.001,
        ores: 40000,
        ores_renew_rate: 0.001,
        water: 120000,
        water_renew_rate: 0.01,
        oil: 50000,
        oil_renew_rate: 0.005,
        gas: 20000,
        gas_renew_rate: 0.005,
        co2_capacity: 700000,
        co2_renew_rate: 0.01
    },
    russie: {
        human: 144000000,
        human_renew_rate: 0.02,
        ground: 17098242,
        ground_renew_rate: 0.002,
        ores: 3000000,
        ores_renew_rate: 0.002,
        water: 4300000,
        water_renew_rate: 0.02,
        oil: 1000000,
        oil_renew_rate: 0.01,
        gas: 1500000,
        gas_renew_rate: 0.01,
        co2_capacity: 10000000,
        co2_renew_rate: 0.03
    }
};

document.getElementById('prefill-button').addEventListener('click', function() {
    const selectedCountry = document.getElementById('country-prefill').value;
    const defaults = countryResourcesDefaults[selectedCountry];

    document.getElementById('human-resources').value = defaults.human;
    document.getElementById('human-resources-renew').value = defaults.human_renew_rate;
    document.getElementById('ground-resources').value = defaults.ground;
    document.getElementById('ground-resources-renew').value = defaults.ground_renew_rate;
    document.getElementById('ores-resources').value = defaults.ores;
    document.getElementById('ores-resources-renew').value = defaults.ores_renew_rate;
    document.getElementById('water-resources').value = defaults.water;
    document.getElementById('water-resources-renew').value = defaults.water_renew_rate;
    document.getElementById('oil-resources').value = defaults.oil;
    document.getElementById('oil-resources-renew').value = defaults.oil_renew_rate;
    document.getElementById('gas-resources').value = defaults.gas;
    document.getElementById('gas-resources-renew').value = defaults.gas_renew_rate;
    document.getElementById('co2-capacity-resources').value = defaults.co2_capacity;
    document.getElementById('co2-capacity-absorption').value = defaults.co2_renew_rate;
});