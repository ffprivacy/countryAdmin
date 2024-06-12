document.getElementById('search-country').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#country-table tr');
    rows.forEach(row => {
        const countryName = row.querySelector('td').textContent.toLowerCase();
        row.style.display = countryName.includes(searchValue) ? '' : 'none';
    });
});

const countryURIs = ["http://127.0.0.1:5000/api/country"];

const fetchCountryData = async () => {
    const countryData = await Promise.all(countryURIs.map(uri => fetch(uri, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer your_access_token'
        }
    }).then(response => response.json())));

    updateTable(countryData);
    updateCharts(countryData);
};

const updateTable = (countryData) => {
    const tableBody = document.getElementById('country-table');
    tableBody.innerHTML = '';

    countryData.forEach(country => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${country.name}</td>
            <td>${calculateTotalMetric(country.processes)}</td>
            <td>${calculateDepletionTime(country.resources)}</td>
            <td><button class="btn btn-primary">Details</button></td>
        `;
        tableBody.appendChild(row);
    });
};

const calculateTotalMetric = (processes) => {
    return processes.reduce((total, process) => total + process.usage_count, 0);
};

const calculateDepletionTime = (resources) => {
    return Object.values(resources).reduce((minTime, resource) => {
        const time = resource.amount / (resource.usage || 1);
        return time < minTime ? time : minTime;
    }, Infinity);
};

const updateCharts = (countryData) => {
    const labels = countryData.map(country => country.name);
    const dataTotalMetric = countryData.map(country => calculateTotalMetric(country.processes));
    const dataDepletionTime = countryData.map(country => calculateDepletionTime(country.resources));

    const ctxPuzzle = document.getElementById('puzzleChart').getContext('2d');
    const puzzleChart = new Chart(ctxPuzzle, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                label: 'Metric Comparison',
                data: dataTotalMetric,
                backgroundColor: ['red', 'blue', 'green'],
            }]
        }
    });

    const ctxTrade = document.getElementById('tradeChart').getContext('2d');
    const tradeChart = new Chart(ctxTrade, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                label: 'Trade Volume',
                data: dataDepletionTime,
                backgroundColor: ['purple', 'orange', 'yellow'],
            }]
        }
    });
};

document.addEventListener('DOMContentLoaded', fetchCountryData);
