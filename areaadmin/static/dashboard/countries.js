const areaResourcesDefaults = {
    france: {
        1: { amount: 67000000, renew_rate: 0.01 },
        2: { amount: 643801, renew_rate: 0.001 },
        3: { amount: 100000, renew_rate: 0.001 },
        4: { amount: 200000, renew_rate: 0.01 },
        5: { amount: 0, renew_rate: 0 },
        6: { amount: 0, renew_rate: 0 },
        7: { amount: 1000000, renew_rate: -0.01 },
        8: { amount: 12, renew_rate: -0.001 },
        9: { amount: 50, renew_rate: 0.002 },
        10: { amount: 250000000, renew_rate: 0 }
    },
    usa: {
        1: { amount: 331000000, renew_rate: 0.015 },
        2: { amount: 9833517, renew_rate: 0.001 },
        3: { amount: 2000000, renew_rate: 0.001 },
        4: { amount: 3000000, renew_rate: 0.01 },
        5: { amount: 500000, renew_rate: 0.005 },
        6: { amount: 800000, renew_rate: 0.005 },
        7: { amount: 5000000, renew_rate: -0.02 },
        8: { amount: 15, renew_rate: -0.002 },
        9: { amount: 100, renew_rate: 0.003 },
        10: { amount: 1800000000, renew_rate: 0 }
    }
};

document.getElementById('prefill-button').addEventListener('click', function() {
    const selectedArea = document.getElementById('area-prefill').value;
    const defaults = areaResourcesDefaults[selectedArea];

    for(let object_id of Processes.processesGetObjectsIds()) {
        document.getElementById(`area-resources-${object_id}-amount`).value = defaults[object_id] == null ? 0 : defaults[object_id].amount;
        document.getElementById(`area-resources-${object_id}-renew-rate`).value = defaults[object_id] == null ? 0 : defaults[object_id].renew_rate;
    }
});