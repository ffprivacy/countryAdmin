class Guard {

    constructor() {
        this.selected_metric = null;
        this.state = null;
        this.areas = [];
        this.puzzleChart = null;
        this.tradeChart = null;
    }

    async refresh() {
        this.state = await fetchAreaAPI('/guard');
        
        document.getElementById("guard-last-seen").innerText = this.state.last_check_date;
        let guardAlerts = document.getElementById("guard-alerts");
        guardAlerts.innerHTML = '';
        for(let alert of this.state.alerts) {
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

        const currentArea = await fetchAreaAPI('/area');
        document.getElementById("guard-title").innerText = ` - ${currentArea.name}`;

        this.areas = [];
        for(let uri of this.state.area_uris) {
            const area = await fetchAreaAPI('/area', undefined, uri);
            area['trades'] = await fetchAreaAPI('/trades', undefined, uri);
            area['metrics'] = await fetchAreaAPI('/metrics', undefined, uri);
            area['uri'] = uri;
            this.areas.push(area);
        }
    
        this.updateTable();
        this.updateCharts();
    }

    updateTable() {
        const tableBody = document.getElementById('area-table');
        tableBody.innerHTML = '';
    
        this.areas.forEach(area => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><a target="_blank" href="${dashboard_area_generate_uri_from_database(area.uri)}">${area.name}</a></td>
                <td>${area.metrics.flow.output[this.selected_metric]}</td>
                <td>${area.metrics.resources_depletion[this.selected_metric]}</td>
                <td><button class="btn btn-primary">Details</button></td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    updateCharts() {
        const labels = this.areas.map(area => area.name);
    
        {
            const data = this.areas.map(area => area.metrics.flow.output[this.selected_metric]);
            if ( this.puzzleChart == null ) {
                const ctxPuzzle = document.getElementById('puzzleChart').getContext('2d');
                this.puzzleChart = new Chart(ctxPuzzle, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Metric Comparison',
                            data: data,
                            backgroundColor: ['red', 'blue', 'green'],
                        }]
                    }
                });
            } else {
                this.puzzleChart.data.labels = labels;
                this.puzzleChart.data.datasets.forEach((dataset) => {
                    dataset.data = data;
                });
                this.puzzleChart.update();
            }
        }
    
        {
            const data = this.areas.map(area => area.metrics.resources_depletion[this.selected_metric]);
            if ( this.tradeChart == null ) {
                const ctxTrade = document.getElementById('tradeChart').getContext('2d');
                this.tradeChart = new Chart(ctxTrade, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Trade Volume',
                            data: data,
                            backgroundColor: ['purple', 'orange', 'yellow'],
                        }]
                    }
                });
            } else {
                this.tradeChart.data.labels = labels;
                this.tradeChart.data.datasets.forEach((dataset) => {
                    dataset.data = data;
                });
                this.tradeChart.update();
            }
        }
    
        this.flowGraphUpdate();
    
    }

    flowGraphColorNode(d) {
        return d.radius > 20 ? '#ff7f0e' : '#1f77b4';
    }
    
    async flowGraphUpdate() {
        const title = document.getElementById("flowGraphTitle");
        const metricObj = Processes.metricsGetList().find((o) => o.id == this.selected_metric);
        title.innerHTML = `
            <h3><img src="/static/${metricObj == undefined ? '' : metricObj.icon}" class="ms-2" style="max-width: 50px;" />${this.selected_metric} flow and amount per area</h3>
        `;
    
        const cy = cytoscape({
            container: document.getElementById('flowGraph'),
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#1f77b4',
                        'label': 'data(name)',
                        'width': 'mapData(radius, 0, 10, 10, 50)',
                        'height': 'mapData(radius, 0, 10, 10, 50)'
                    }
                },
                {
                    selector: 'edge',
                    style: {
                        'width': 2,
                        'line-color': '#999'
                    }
                }
            ],
            layout: {
                name: 'cose'
            }
        });
    
        function genGraphId(uri, area_id) {
            if (uri == null || uri == undefined) {
                return `${area_id}`;
            } else if (area_id == null || area_id == undefined) {
                return `${uri}`;
            } else {
                return `${uri} - ${area_id}`;
            }
        }
    
        let nodes = this.areas.map((area) => {
            let metricValue = area.metrics.flow.output[this.selected_metric] - area.metrics.flow.input[this.selected_metric];
            metricValue = isNaN(metricValue) ? 0 : metricValue < 0 ? 0 : metricValue;
            return {
                data: {
                    id: genGraphId(area.uri, area.id),
                    name: area.name,
                    radius: Math.log(metricValue + 1),
                    metricValue: metricValue,
                    area: area
                },
                position: { x: Math.random() * 800, y: Math.random() * 600 }
            }
        });
    
        let nodeIds = new Set(nodes.map(node => node.data.id));
    
        let edges = [];
        for (let area of this.areas) {
            for (let trade of area.trades) {
                const sourceId = genGraphId(area.uri, area.id);
                const targetId = genGraphId(trade.remote_host_uri, trade.remote_area_id);
    
                if (nodeIds.has(sourceId) && nodeIds.has(targetId)) {
                    edges.push({ data: { source: sourceId, target: targetId } });
                }
            }
        }
    
        cy.add(nodes);
        cy.add(edges);
    
        cy.nodes().on('dblclick', function (event) {
            console.warn(event);
            showModal(event.target.data());
        });
    
        cy.nodes().on('cxttap', function (event) {
            const node = event.target;
            if (node.data('expanded')) {
                collapseNode(node);
            } else {
                expandNode(node);
            }
        });
    
        const this_selected_metric = this.selected_metric;
        function showModal(nodeData) {
            const modal = new bootstrap.Modal(document.getElementById('nodeDetailModal'), {});
            const metricObj = Processes.metricsGetList().find((o) => o.id == this_selected_metric);
            document.getElementById('nodeDetailModalLabel').innerText = `Area ${nodeData.name} - ${metricObj.label}:`;
            document.getElementById('nodeDetailModalBody').innerHTML = `
                <p><strong>Name:</strong> ${nodeData.name}</p>
                <p><strong>${metricObj.label}:</strong> ${nodeData.radius}</p>
            `;
            modal.show();
        }
    
        function expandNode(node) {
            node.data('expanded', true);
            const compositions = node.data('area').compositions;
            const newNodes = compositions.map((compo, index) => ({
                data: {
                    id: genGraphId(null, compo.id),
                    name: `Compo ${compo.id}`,
                    radius: 5
                },
                position: { x: node.position().x + (index * 20), y: node.position().y + (index * 20) },
                classes: 'composition'
            }));
    
            cy.add(newNodes);
            const newEdges = newNodes.map(newNode => ({
                data: {
                    source: node.id(),
                    target: newNode.data.id
                }
            }));
    
            cy.add(newEdges);
            node.style('background-color', '#ffa500'); // Adjust the color
            cy.layout({ name: 'cose' }).run();
        }
    
        function collapseNode(node) {
            node.data('expanded', false);
            const compositions = node.data('area').compositions.map(compo => genGraphId(null, compo.id));
            cy.remove(cy.nodes().filter(n => compositions.includes(n.id())));
            node.style('background-color', '#1f77b4'); // Restore the original color
            cy.layout({ name: 'cose' }).run();
        }
    }

}

const guard = new Guard()

document.getElementById('search-area').addEventListener('keyup', function() {
    const searchValue = this.value.toLowerCase();
    const rows = document.querySelectorAll('#area-table tr');
    rows.forEach(row => {
        const areaName = row.querySelector('td').textContent.toLowerCase();
        row.style.display = areaName.includes(searchValue) ? '' : 'none';
    });
});

function guardClearAlerts() {
    fetchAreaAPI('/guard/alerts/clear').then(response => {
        guard.refresh()
    })
}
function clearPollutionDebt(alert_id, remote_area, emissionEnv=90) {
    const process = {
        title: 'Remote area has capability and proposed to absorbe your emissions',
        description: 'Clear your emissions debt (overpollution)',
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
    fetchAreaAPI('/set_process',{
        method: 'POST',
        body: JSON.stringify(process)
    },remote_area)
    .then(response => {
        const tradeData = {
            remote_host_uri: remote_area,
            remote_processes: response.processes.map(obj => ({id: obj.id, amount: 1}))
        };
        fetchAreaAPI('/trade',{
            method: 'POST',
            body: JSON.stringify(tradeData)
        }).then(async function (response) {
            await fetchAreaAPI(`/guard/alert/${alert_id}`,{method: 'DELETE'})
            guard.refresh()
        })
    })
}

document.getElementById('add-area-btn').addEventListener('click', function() {
    const newUri = document.getElementById('new-area-uri').value.trim();
    if (newUri) {
        document.getElementById('new-area-uri').value = '';

        fetchAreaAPI('/guard/subscribe',{
			method: 'POST',
			body: JSON.stringify({
				uri: newUri
			})
		}).then(response => {
            guard.refresh();
        })
    }
});

document.getElementById('refresh-btn').addEventListener('click', function() {
    guard.refresh();
});

document.addEventListener('DOMContentLoaded', async () => {
    const metrics = await Processes.fetchMetricsGetList();
    const selectElement = document.getElementById('metric-select');
    selectElement.value = 'envEmissions';

    selectElement.innerHTML = '';

    metrics.forEach(metric => {
        const option = document.createElement('option');
        option.value = metric.id;
        option.textContent = metric.id;
        selectElement.appendChild(option);
    });
    guard.refresh();
});

document.getElementById('metric-select').addEventListener('change', function() {
    guard.selected_metric = this.value;
    guard.refresh();
});