document.getElementById('search-area').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#area-table tr');
    rows.forEach(row => {
        const areaName = row.querySelector('td').textContent.toLowerCase();
        row.style.display = areaName.includes(searchValue) ? '' : 'none';
    });
});

let guard = null;
const LOCAL_AREA = area_generate_uri_from_database("" + AREA_DATA['area_id']);
function guardClearAlerts() {
    fetch(`${LOCAL_AREA}/guard/alerts/clear`).then(response => {
        guardFrontRefresh()
    })
}
function clearPollutionDebt(alert_id, remote_area, emissionEnv=90) {
    const remote_uri = area_generate_uri_from_database(remote_area);
    const process = {
        title: 'Propose area to absorbe its emissions',
        description: 'Propose area to absorbe its emissions',
        metrics: {
            input: {
                envEmissions: emissionEnv,
                economic: 90
            },
            output: {
                envEmissions: emissionEnv,
                economic: 90
            }
        }
    }
    fetch(`${remote_uri}/set_process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(process)
    })
    .then(response => response.json())
    .then(response => {
        const tradeData = {
            remote_host_uri: remote_area,
            remote_processes: response.processes.map(obj => ({id: obj.id, amount: 1}))
        };
        fetch(`${LOCAL_AREA}/trade`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
        }).then(response => {
            fetch(`${LOCAL_AREA}/guard/alert/${alert_id}`, {method: 'DELETE'})
            guardFrontRefresh()
        })
    })
}
function fetchGuardState() {
    return fetch(`${LOCAL_AREA}/guard`)
            .then(response => response.json())
            .then(data => {
                guard = data;
                document.getElementById("guard-last-seen").innerText = data.last_check_date;
                let guardAlerts = document.getElementById("guard-alerts");
                guardAlerts.innerHTML = '';
                for(let alert of guard.alerts) {
                    let alertElement = document.createElement("div");
                    alertElement.className = "guard-alert card card-body";
                    alertElement.innerHTML = `
                        <div class="guard-alert-title">${alert.title} - ${alert.time}</div>
                        <div class="guard-alert-description">${alert.description}</div>
                    `;
                    if ( alert.title.match("pollution") ) {
                        const match = alert.description.match(/amount=(\d+)/);
                        const amount = match ? parseInt(match[1]) : null;
                        if (amount == null) {
                            console.warn("no amount provided");
                        } else {
                            alertElement.innerHTML += `
                                <button onclick="clearPollutionDebt(${alert.id},'${alert.area}',${amount})" class="btn btn-primary mt-2">Clear the debt</div>
                            `;
                        }
                    }
                    guardAlerts.appendChild(alertElement);
                }
            })
}

document.getElementById('add-area-btn').addEventListener('click', function() {
    const newUri = document.getElementById('new-area-uri').value.trim();
    if (newUri) {
        document.getElementById('new-area-uri').value = '';

        fetch(`${LOCAL_AREA}/guard/subscribe`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				uri: newUri
			})
		}).then(response => {
            guardFrontRefresh();
        })
    }
});

function guardFrontRefresh() {
    fetchGuardState().then(data => {
        fetchAreaData();
    })
}
document.getElementById('refresh-btn').addEventListener('click', function() {
    guardFrontRefresh();
});
const fetchAreaData = async () => {
    let areaData = [];
    const currentArea = await fetch(LOCAL_AREA).then(response => response.json());
    document.getElementById("guard-title").innerText = ` - ${currentArea.name}`;
    for(let uri of guard.area_uris) {
        areaData.push(await fetch(area_generate_uri_from_database(uri), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer your_access_token'
            }
        }).then(response => response.json()));
    }

    updateTable(areaData);
    updateCharts(areaData);
}

const updateTable = (areaData) => {
    const tableBody = document.getElementById('area-table');
    tableBody.innerHTML = '';

    areaData.forEach(area => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${area.name}</td>
            <td>${calculateTotalMetric(area.processes)}</td>
            <td>${calculateDepletionTime(area.resources)}</td>
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
const calculateMetric = (area, metric) => {
    return 100; //area.resources[metric] || 10;
};

const updateCharts = (areaData) => {
    const labels = areaData.map(area => area.name);
    const dataTotalMetric = areaData.map(area => calculateTotalMetric(area.processes));
    const dataDepletionTime = areaData.map(area => calculateDepletionTime(area.resources));

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

    updateGraph(areaData, 'tradeVolume');

};

document.addEventListener('DOMContentLoaded', () => {
    guardFrontRefresh();
});

document.getElementById('metric-select').addEventListener('change', function() {
    const selectedMetric = this.value;
    updateGraph(selectedMetric);
});
const updateGraph = (areaData, metric) => {
    const svg = d3.select('#graphSvg');
    svg.selectAll('*').remove();

    const width = +svg.attr('width');
    const height = +svg.attr('height');

    const nodes = areaData.map((area, index) => ({
        id: area.name,
        radius: calculateMetric(area, metric)
    }));

    const links = areaData.map((area, index) => {
        return {source: area.name, target: area.name, value: calculateMetric(area, metric)};
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
