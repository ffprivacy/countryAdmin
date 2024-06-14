document.getElementById('search-country').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#country-table tr');
    rows.forEach(row => {
        const countryName = row.querySelector('td').textContent.toLowerCase();
        row.style.display = countryName.includes(searchValue) ? '' : 'none';
    });
});

let guard = null;

function fetchGuardState() {
    return fetch('/api/guard')
            .then(response => response.json())
            .then(data => {
                guard = data;
            })
}

document.getElementById('add-country-btn').addEventListener('click', function() {
    const newUri = document.getElementById('new-country-uri').value.trim();
    if (newUri) {
        document.getElementById('new-country-uri').value = '';

        fetch(`/api/guard/subscribe`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				uri: newUri
			})
		}).then(response => {
            fetchCountries();
        })
    }
});

function fetchCountries() {
    fetchGuardState().then(data => {
        fetchCountryData();
    })
}
document.getElementById('refresh-btn').addEventListener('click', function() {
    fetchCountries();
});

const fetchCountryData = async () => {
    let countryData = [];
    for(let uri of guard.country_uris) {
        countryData.push(await fetch(`${uri}/api/country`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_access_token'
            }
        }).then(response => response.json()));
    }

    updateTable(countryData);
    updateCharts(countryData);
}

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
    return 100; //return processes.reduce((total, process) => total + process.usage_count, 0);
};

const calculateDepletionTime = (resources) => {
    return 100; /* return Object.values(resources).reduce((minTime, resource) => {
        const time = resource.amount / (resource.usage || 1);
        return time < minTime ? time : minTime;
    }, Infinity);*/
};
const calculateMetric = (country, metric) => {
    return 100; //country.resources[metric] || 10;
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

    updateGraph(countryData, 'tradeVolume');

};

document.addEventListener('DOMContentLoaded', () => {
    fetchCountries();
});

document.getElementById('metric-select').addEventListener('change', function() {
    const selectedMetric = this.value;
    updateGraph(selectedMetric);
});
const updateGraph = (countryData, metric) => {
    const svg = d3.select('#graphSvg');
    svg.selectAll('*').remove();

    const width = +svg.attr('width');
    const height = +svg.attr('height');

    const nodes = countryData.map((country, index) => ({
        id: country.name,
        radius: calculateMetric(country, metric)
    }));

    const links = countryData.map((country, index) => {
        return {source: country.name, target: country.name, value: calculateMetric(country, metric)};
    });

    const simulation = d3.forceSimulation(nodes)
        .force('link', d3.forceLink(links).id(d => d.id).distance(200))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2));

    const link = svg.append('g')
        .attr('stroke', '#999')
        .selectAll('line')
        .data(links)
        .join('line')
        .attr('stroke-width', d => d.value * 0.1);

    const node = svg.append('g')
        .attr('stroke', '#fff')
        .attr('stroke-width', 1.5)
        .selectAll('circle')
        .data(nodes)
        .join('circle')
        .attr('r', d => d.radius)
        .attr('fill', colorNode)
        .call(drag(simulation));

    node.append('title')
        .text(d => d.id);

    simulation.on('tick', () => {
        link
            .attr('x1', d => d.source.x)
            .attr('y1', d => d.source.y)
            .attr('x2', d => d.target.x)
            .attr('y2', d => d.target.y);

        node
            .attr('cx', d => d.x)
            .attr('cy', d => d.y);
    });
};
const colorNode = (d) => {
    return d.radius > 20 ? '#ff7f0e' : '#1f77b4';
};
const drag = (simulation) => {
    function dragstarted(event) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        event.subject.fx = event.subject.x;
        event.subject.fy = event.subject.y;
    }

    function dragged(event) {
        event.subject.fx = event.x;
        event.subject.fy = event.y;
    }

    function dragended(event) {
        if (!event.active) simulation.alphaTarget(0);
        event.subject.fx = null;
        event.subject.fy = null;
    }

    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
};
